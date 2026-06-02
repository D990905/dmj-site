/* SailTech Orchestrator Dashboard — Phase 1 app.js
   Read-only Cytoscape.js mindmap of 8 expert fleet + sample tasks.

   Data flow (Phase 1, post-infra-trio 8 합의):
     - hostname=localhost → daemon HTTP http://localhost:8765/state (#11 dev hot-loop)
     - else                → same-origin static ./dashboard-state.json (#11 commit + Pages serve)
     - fetch 실패          → window.SAILTECH_SAMPLE fixture (data.sample.js)
   Schema is owned by #11 (state.json) + #10 (Supabase). Adapter `adaptState()` isolates
   transformation so dashboard renderer is schema-agnostic during 42h freeze.
*/
(function () {
  'use strict';

  // mutable; refreshed by fetchState() / pollLoop().
  // Initial = sample fixture (schema_v0.1 shape) passed through adapter.
  // Real fetch overrides via init() at bottom.
  let data = null; // set after adapter loads (defined below)
  if (!window.SAILTECH_SAMPLE) { console.error('SAILTECH_SAMPLE missing'); return; }

  // ---------- State fetch (Phase 1 dual publish) ----------
  const STATE_URL =
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:8765/state'
      : './dashboard-state.json';
  const POLL_INTERVAL_MS = 30000;
  let pollTimer = null;

  // ---------- Adapter: schema_v0.1 → internal mindmap shape ----------
  // Source: dashboard_state_schema_v0.md (Thread 002, #11 owner).
  // Target: { hub, experts, tasks, approvalQueue, generatedAt, cost, heartbeat, recentDecisions }
  // Slugs match #10 의 0006_seed_agents.sql (15-row roster).
  const STATUS_MAP = {
    'pending': 'wait',
    'in_progress': 'run',
    'blocked': 'block',
    'awaiting_approval': 'approve',
    'done': 'done',
    'cancelled': 'done'
  };
  const PRIORITY_MAP = { 'p0': 4, 'p1': 3, 'p2': 2, 'p3': 1 };
  const ROLE_ICON = {
    pm: '🧭', research: '🔬', design: '✨', frontend: '🎨',
    mobile_ux: '📱', data_science: '📊', content: '📝',
    mobile_eng: '📲', devops: '🛡️', backend: '⚙️',
    orchestrator: '🧩', riding_analytics: '🌊',
    business: '💼', legal: '⚖️', marketing: '📢',
    hardware: '🔌', sports: '🏃'
  };

  // Mobile label truncation — overlap fix per #11 진단 (2026-06-02 11:47 KST).
  // Full title 은 `labelFull` 에 보존, side panel 에서 표시.
  function isMobileViewport() {
    return (window.innerWidth || document.documentElement.clientWidth || 1024) < 640;
  }
  function truncateForViewport(s) {
    if (!s) return '';
    const max = isMobileViewport() ? 14 : 28;
    if (s.length <= max) return s;
    return s.slice(0, max - 1).trimEnd() + '…';
  }

  function adaptState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    // schema_v0.x shape
    if (typeof raw.schema_version === 'string' && raw.personas && Array.isArray(raw.directives)) {
      return transformV0(raw);
    }
    // Legacy passthrough (old SAILTECH_SAMPLE shape — safety net during transition)
    if (raw.hub && Array.isArray(raw.experts) && Array.isArray(raw.tasks)) return raw;
    return null;
  }

  function transformV0(s) {
    const hub = { id: 'hub', label: 'SailTech\n· dmjgroup ·', kind: 'hub' };

    const mobileNow = isMobileViewport();
    const experts = Object.entries(s.personas || {}).map(([slug, p]) => {
      const fullName = p.display_name || p.role || slug;
      const icon = ROLE_ICON[p.role] || '👤';
      // Mobile: icon only (full name in side panel + dropdown).
      // Desktop: icon + display_name.
      const nodeLabel = mobileNow ? icon : `${icon} ${fullName}`;
      return {
        id: slug,
        label: fullName,         // canonical (dropdown, panels)
        nodeLabel,               // cytoscape 의 mindmap 표시 only
        short: (p.role || slug).slice(0, 6).toUpperCase(),
        icon,
        role: p.role,
        domain: p.domain,
        agentStatus: p.status,
        lastActiveAt: p.last_active_at,
        idleMinutes: p.idle_minutes,
        currentTask: p.current_task
      };
    });

    // experts must include hub-only fallback if 0
    const expertIds = new Set(experts.map(e => e.id));

    const tasks = (s.directives || [])
      .map(d => {
        // unassigned directives fall under the first expert (or are dropped)
        let parent = d.target_agent_slug;
        if (!parent || !expertIds.has(parent)) {
          parent = experts[0] ? experts[0].id : null;
        }
        if (!parent) return null;
        const fullTitle = d.title || '(no title)';
        return {
          id: d.directive_id,
          parent,
          label: truncateForViewport(fullTitle),
          labelFull: fullTitle,
          status: STATUS_MAP[d.status] || 'wait',
          priority: PRIORITY_MAP[d.priority] || 2,
          issueUrl: d.issue_url,
          promptExcerpt: d.prompt_excerpt,
          costUsd: d.cost_usd,
          turns: d.turns,
          updatedAt: d.updated_at,
          createdAt: d.created_at
        };
      })
      .filter(Boolean);

    const approvalQueue = (s.pending_approvals || []).map(a => ({
      id: a.approval_id,
      expert: a.asked_by_slug || '—',
      title: a.question || '',
      summary: Array.isArray(a.options) ? a.options.map(o => o.label).join(' / ') : '',
      scope: a.scope,
      taskId: a.task_id,
      directiveId: a.directive_id,
      ageMinutes: a.age_minutes,
      createdAt: a.created_at
    }));

    return {
      hub, experts, tasks, approvalQueue,
      generatedAt: s.last_updated_at,
      schemaVersion: s.schema_version,
      cost: s.cost || null,
      heartbeat: s.heartbeat || null,
      recentDecisions: s.recent_decisions || []
    };
  }

  async function fetchState() {
    try {
      const res = await fetch(STATE_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const adapted = adaptState(json);
      if (!adapted) throw new Error('invalid shape');
      return adapted;
    } catch (e) {
      console.warn('[orchestrator] state fetch failed (' + e.message + '), using fixture');
      return null;
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      const next = await fetchState();
      if (next) {
        data = next;
        rerender();
        renderStats();
      }
    }, POLL_INTERVAL_MS);
  }

  // Status → color/label
  const STATUS = {
    done:    { color: '#22c55e', label: '완료',     order: 0 },
    run:     { color: '#facc15', label: '진행',     order: 1 },
    block:   { color: '#ef4444', label: '차단',     order: 2 },
    wait:    { color: '#6b7280', label: '대기',     order: 3 },
    approve: { color: '#38bdf8', label: '승인대기', order: 4 }
  };
  const PRIORITY_RADIUS = { 1: 18, 2: 22, 3: 26, 4: 32 }; // task node base radius

  // Now that adapter is defined, initialize data from sample fixture.
  data = adaptState(window.SAILTECH_SAMPLE);
  if (!data) {
    console.error('[orchestrator] SAILTECH_SAMPLE failed adaptState');
    return;
  }

  // ---------- Build cytoscape elements ----------
  function buildElements() {
    const els = [];

    // Hub
    els.push({
      data: { id: data.hub.id, label: data.hub.label, kind: 'hub' }
    });

    // Experts
    data.experts.forEach(e => {
      els.push({
        data: { id: e.id, label: e.nodeLabel || `${e.icon} ${e.label}`, kind: 'expert', short: e.short }
      });
      els.push({
        data: { id: `eg_${e.id}`, source: data.hub.id, target: e.id, kind: 'spine' }
      });
    });

    // Tasks
    data.tasks.forEach(t => {
      const s = STATUS[t.status] || STATUS.wait;
      els.push({
        data: {
          id: t.id, label: t.label,
          kind: 'task', status: t.status, statusColor: s.color,
          priority: t.priority || 1,
          radius: PRIORITY_RADIUS[t.priority] || 18,
          parentExpert: t.parent
        }
      });
      els.push({
        data: { id: `tg_${t.id}`, source: t.parent, target: t.id, kind: 'branch' }
      });
      if (t.dependsOn) {
        els.push({
          data: { id: `dep_${t.id}`, source: t.dependsOn, target: t.id, kind: 'dep' }
        });
      }
    });

    return els;
  }

  // ---------- Cytoscape init ----------
  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements: buildElements(),
    wheelSensitivity: 0.25,
    minZoom: 0.3,
    maxZoom: 2.5,
    layout: { name: 'preset' }, // we set positions below
    style: [
      // hub
      {
        selector: 'node[kind = "hub"]',
        style: {
          'shape': 'round-rectangle',
          'background-color': '#1a2238',
          'border-color': '#3b82f6',
          'border-width': 2,
          'label': 'data(label)',
          'color': '#e8ecf4',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': 120,
          'font-size': 13,
          'font-weight': 700,
          'width': 130, 'height': 80,
          'padding': '10px'
        }
      },
      // experts (desktop default; mobile override applied after init via isMobileViewport)
      {
        selector: 'node[kind = "expert"]',
        style: {
          'shape': 'round-rectangle',
          'background-color': '#121829',
          'border-color': '#3b82f6',
          'border-width': 1.5,
          'label': 'data(label)',
          'color': '#e8ecf4',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': 12,
          'font-weight': 600,
          'width': 116, 'height': 40,
          'padding': '6px'
        }
      },
      // experts on mobile: smaller circle, icon-only label
      {
        selector: 'node[kind = "expert"].mobile-compact',
        style: {
          'shape': 'ellipse',
          'background-color': '#121829',
          'border-color': '#3b82f6',
          'border-width': 1.5,
          'label': 'data(label)',
          'color': '#e8ecf4',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': 16,    // emoji-friendly
          'width': 40, 'height': 40,
          'padding': '0px'
        }
      },
      // tasks
      {
        selector: 'node[kind = "task"]',
        style: {
          'shape': 'ellipse',
          'background-color': 'data(statusColor)',
          'border-color': '#0a0e1a',
          'border-width': 2,
          'label': 'data(label)',
          'color': '#e8ecf4',
          'text-valign': 'data(labelValign)',  // 'top' or 'bottom' set by layoutRadial
          'text-halign': 'center',
          'text-margin-x': 'data(labelOffsetX)',
          'text-margin-y': 'data(labelOffsetY)',
          'text-wrap': 'wrap',
          'text-max-width': 100,
          'font-size': 9.5,
          'text-outline-color': '#0a0e1a',
          'text-outline-width': 2,
          'text-outline-opacity': 0.9,
          'width': 'data(radius)', 'height': 'data(radius)'
        }
      },
      // selected
      {
        selector: 'node:selected',
        style: {
          'border-color': '#60a5fa',
          'border-width': 3,
          'overlay-opacity': 0
        }
      },
      // edges — spine (hub→expert)
      {
        selector: 'edge[kind = "spine"]',
        style: {
          'curve-style': 'straight',
          'line-color': '#243046',
          'width': 2,
          'opacity': 0.7
        }
      },
      // edges — branch (expert→task)
      {
        selector: 'edge[kind = "branch"]',
        style: {
          'curve-style': 'bezier',
          'line-color': '#1f2942',
          'width': 1.2,
          'opacity': 0.55
        }
      },
      // edges — dependency
      {
        selector: 'edge[kind = "dep"]',
        style: {
          'curve-style': 'bezier',
          'line-color': '#ef4444',
          'line-style': 'dashed',
          'width': 1.5,
          'opacity': 0.8,
          'target-arrow-color': '#ef4444',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.8
        }
      },
      // dim non-related when something is selected
      {
        selector: '.dim',
        style: { 'opacity': 0.18 }
      }
    ]
  });

  // ---------- Radial layout (deterministic, mobile-friendly) ----------
  function layoutRadial() {
    const w = cy.width(), h = cy.height();
    const mobile = w < 640;
    cy.nodes('[kind = "expert"]').toggleClass('mobile-compact', mobile);

    // Layout — circle on desktop, vertical OVAL on mobile.
    // Mobile reason: screen is ~1:2 (390×800). Using min(w,h) wastes ~50% vertical space.
    // Reserve UI gutters (topbar + legend top, FAB + sheet + status bar bottom).
    let expertRX, expertRY, taskRX, taskRY, layoutCX, layoutCY;
    if (mobile) {
      const padTop = 70;   // topbar + legend
      const padBot = 130;  // status-bar + sheet handle + FAB margin
      const padX   = 24;   // side gutter
      const usableW = Math.max(200, w - 2 * padX);
      const usableH = Math.max(300, h - padTop - padBot);
      // Tall oval: RY > RX
      expertRX = usableW * 0.34;
      expertRY = usableH * 0.30;
      taskRX   = usableW * 0.50;
      taskRY   = usableH * 0.44;
      layoutCX = w / 2;
      layoutCY = padTop + usableH / 2;
    } else {
      const R = Math.min(w, h);
      expertRX = expertRY = R * 0.28;
      taskRX   = taskRY   = R * 0.46;
      layoutCX = w / 2;
      layoutCY = h / 2;
    }

    cy.getElementById(data.hub.id).position({ x: layoutCX, y: layoutCY });

    const N = data.experts.length;
    data.experts.forEach((e, i) => {
      const angle = (-Math.PI / 2) + (i * (2 * Math.PI / N)); // top, clockwise
      const ex = layoutCX + expertRX * Math.cos(angle);
      const ey = layoutCY + expertRY * Math.sin(angle);
      cy.getElementById(e.id).position({ x: ex, y: ey });

      // Task arc — cap at half-distance to neighbor expert minus margin,
      // so an expert with many tasks never invades the next expert's territory.
      // (Earlier overlap: adjacent experts with 1+2 task counts collided
      // because spread 0.46rad > inter-expert 0.42rad.)
      const childTasks = data.tasks.filter(t => t.parent === e.id);
      const interExpertAngle = (2 * Math.PI) / N;
      const SAFE_MARGIN = 0.06; // ~3.5° each side
      const safeArcSpread = Math.max(0.05, (interExpertAngle / 2) - SAFE_MARGIN);
      const arcSpread = Math.min(safeArcSpread, 0.08 + childTasks.length * 0.05);

      childTasks.forEach((t, j) => {
        const tCount = childTasks.length;
        const offset = tCount === 1 ? 0 : (j / (tCount - 1) - 0.5) * 2 * arcSpread;
        const a = angle + offset;
        // Multi-child experts: monotonic radial offset per index so EVERY task
        // sits at a different distance from hub — labels separate radially.
        // j=0 closest in (0.85), last j farthest out (1.15). Linear ramp.
        const radialMult = (tCount > 1)
          ? 0.85 + (j / (tCount - 1)) * 0.30  // 0.85 → 1.15 across children
          : 1;
        const tx = layoutCX + taskRX * radialMult * Math.cos(a);
        const ty = layoutCY + taskRY * radialMult * Math.sin(a);
        const n = cy.getElementById(t.id);
        n.position({ x: tx, y: ty });

        // Outward label direction = unit vector from layout center to node.
        // (Geometric "from-center" direction — close enough for oval too.)
        const vx = tx - layoutCX;
        const vy = ty - layoutCY;
        const vmag = Math.hypot(vx, vy) || 1;
        const ux = vx / vmag, uy = vy / vmag;
        const labelDist = mobile ? 16 : 12;
        n.data('labelOffsetX', ux * labelDist);
        n.data('labelOffsetY', uy * labelDist);
        n.data('labelValign', uy < -0.15 ? 'top' : 'bottom');
      });
    });

    // Fit margin: mobile = smaller, oval is already sized.
    cy.fit(cy.elements(), mobile ? 20 : 40);
  }
  layoutRadial();

  // Resize: re-truncate task labels + recompute expert nodeLabel (icon-only on mobile) + 재배치.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const mobileNow = isMobileViewport();
      // task labels
      data.tasks.forEach(t => {
        if (t.labelFull) t.label = truncateForViewport(t.labelFull);
        const n = cy.getElementById(t.id);
        if (n && n.length) n.data('label', t.label);
      });
      // expert labels (icon-only on mobile, icon + name on desktop)
      data.experts.forEach(e => {
        e.nodeLabel = mobileNow ? e.icon : `${e.icon} ${e.label}`;
        const n = cy.getElementById(e.id);
        if (n && n.length) n.data('label', e.nodeLabel);
      });
      layoutRadial();
    }, 120);
  });

  // ---------- Side panel ----------
  const sidePanel = document.getElementById('sidePanel');
  const panelTitle = document.getElementById('selectedTitle');
  const panelEyebrow = document.getElementById('panelEyebrow');
  const panelBody = document.getElementById('panelBody');
  const closePanel = document.getElementById('closePanel');

  closePanel.addEventListener('click', () => closeSidePanel());

  function openSidePanel() { sidePanel.classList.add('open'); sidePanel.setAttribute('aria-hidden', 'false'); }
  function closeSidePanel() {
    sidePanel.classList.remove('open');
    sidePanel.setAttribute('aria-hidden', 'true');
    cy.elements().removeClass('dim');
    cy.$(':selected').unselect();
  }

  function statusPill(status) {
    const s = STATUS[status] || STATUS.wait;
    return `<span class="pill"><i class="lg-dot" style="background:${s.color}"></i>${s.label}</span>`;
  }

  // PR 4 — Persona triggers + standby (data.sample.js 의 persona enrichment 미존재 시 fallback)
  // Visual Designer (Rose, 2026-06-02) 의 brand_color_spec §3-1 매핑 기반.
  const PERSONA_TRIGGERS = {
    '03-design':           ['@로즈 윤', '@visual', '@design', '@design-token', '@a11y', '@dashboard', '@component'],
    '06-data-science':     ['@샘 정', '@dataviz', '@chart', '@chart-theme', '@oklch'],
    '12-riding-analytics': ['@티모 강', '@sports-science', '@trimp', '@ctl-atl-tsb', '@hrv', '@calibration'],
    '04-frontend':         ['@알렉스 박', '@frontend', '@web', '@css', '@ios', '@a11y', '@astro', '@performance'],
    '02-research':         ['@메이 한', '@ux', '@heuristic', '@onboarding', '@nielsen'],
    '15-marketing':        ['@캔 최', '@marketing', '@brand-voice', '@social', '@content'],
    '08-mobile-eng':       ['@왕 정', '@mobile', '@ble', '@healthkit', '@store', '@ota'],
    '11-orchestrator':     ['@데이빗', '@orchestrator', '@dispatch', '@daemon']
  };
  const AGENT_STATUS_LABEL = { active: '활동 중', idle: '대기', offline: '오프라인' };

  function renderExpertPanel(expert) {
    const tasks = data.tasks.filter(t => t.parent === expert.id);
    const counts = tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status]||0)+1; return acc; }, {});
    const order = ['run','approve','block','wait','done'];
    const triggers = PERSONA_TRIGGERS[expert.id] || [];
    const standby = expert.standby || []; // schema 미존재 시 빈 배열
    const commits = expert.commits || []; // schema 미존재 시 빈 배열
    const agentStatus = expert.agentStatus || 'idle';
    const statusDot = ({ active: 's-active', idle: 's-idle', offline: 's-offline' })[agentStatus] || 's-idle';
    const idleMin = typeof expert.idleMinutes === 'number' ? expert.idleMinutes : null;

    panelEyebrow.textContent = 'EXPERT';
    panelTitle.innerHTML = `<span class="persona-mono" data-persona="${escapeHtml(expert.id)}">${escapeHtml((expert.short||'?').charAt(0))}</span>${expert.icon || ''} ${escapeHtml(expert.label)}`;
    panelBody.innerHTML = `
      <div class="panel-meta">
        <span class="panel-meta__item"><span class="panel-meta__dot ${statusDot}"></span>${AGENT_STATUS_LABEL[agentStatus] || agentStatus}</span>
        ${idleMin !== null ? `<span class="panel-meta__item">idle ${idleMin}분</span>` : ''}
        <span class="panel-meta__item">${expert.domain || expert.role || ''}</span>
      </div>

      <div class="panel-current">
        <span class="panel-current__label">현재 task</span>
        ${expert.currentTask
          ? `${escapeHtml(expert.currentTask.title || expert.currentTask.id || '—')}`
          : `<span class="panel-current__none">대기 중 — 활성 task 없음</span>`}
      </div>

      ${triggers.length ? `
      <div class="panel-section">
        <h4 class="panel-section__title">Trigger keyword</h4>
        <ul class="panel-triggers">
          ${triggers.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${standby.length ? `
      <div class="panel-section">
        <h4 class="panel-section__title">Standby (즉시 dispatch 가능)</h4>
        <ol class="panel-standby">
          ${standby.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>
      </div>` : ''}

      <div class="panel-section">
        <h4 class="panel-section__title">Tasks (${tasks.length})</h4>
        <dl class="detail-grid">
          <dt>fleet</dt><dd>${escapeHtml(expert.short || '')}</dd>
          <dt>상태</dt><dd>${order.filter(k => counts[k]).map(k => `${STATUS[k].label} ${counts[k]}`).join(' · ') || '—'}</dd>
        </dl>
        <ul class="task-list">
          ${tasks.map(t => `
            <li data-task-id="${t.id}">
              <span class="ti-status" style="background:${STATUS[t.status].color}"></span>
              <span>${escapeHtml(t.labelFull || t.label)}</span>
            </li>`).join('')}
        </ul>
      </div>

      ${commits.length ? `
      <div class="panel-section">
        <h4 class="panel-section__title">최근 commit</h4>
        <ul class="panel-commits">
          ${commits.slice(0, 5).map(c => `
            <li><a href="https://github.com/D990905/dmj-site/commit/${escapeHtml(c.sha || '')}" target="_blank" rel="noopener">${escapeHtml((c.sha || '').substring(0,7))}</a></li>
          `).join('')}
        </ul>
      </div>` : ''}
    `;
    panelBody.querySelectorAll('li[data-task-id]').forEach(li => {
      li.addEventListener('click', () => {
        const tid = li.getAttribute('data-task-id');
        const n = cy.getElementById(tid);
        if (n) { cy.elements().unselect(); n.select(); focusNode(n); renderTaskPanel(tid); }
      });
    });
  }

  function renderTaskPanel(taskId) {
    const t = data.tasks.find(x => x.id === taskId);
    if (!t) return;
    const exp = data.experts.find(e => e.id === t.parent);
    const dep = t.dependsOn ? data.tasks.find(x => x.id === t.dependsOn) : null;
    const updated = t.updatedAt ? new Date(t.updatedAt).toLocaleString('ko-KR') : '—';
    const costStr = (typeof t.costUsd === 'number') ? `$${t.costUsd.toFixed(2)}` : '—';
    const turnsStr = (typeof t.turns === 'number') ? `${t.turns}` : '—';
    panelEyebrow.textContent = 'DIRECTIVE';
    panelTitle.textContent = t.labelFull || t.label;
    panelBody.innerHTML = `
      <dl class="detail-grid">
        <dt>expert</dt><dd>${exp ? exp.icon + ' ' + escapeHtml(exp.label) : '—'}</dd>
        <dt>상태</dt><dd>${statusPill(t.status)}</dd>
        <dt>priority</dt><dd>P${t.priority}</dd>
        <dt>cost</dt><dd>${costStr} · ${turnsStr} turns</dd>
        <dt>updated</dt><dd>${updated}</dd>
        ${dep ? `<dt>blocked by</dt><dd>${escapeHtml(dep.label)}</dd>` : ''}
        ${t.issueUrl ? `<dt>source</dt><dd><a href="${t.issueUrl}" target="_blank" rel="noopener" class="ext-link">GitHub Issue ↗</a></dd>` : ''}
      </dl>
      ${t.promptExcerpt ? `<p style="font-size:12px;color:var(--text-dim);margin:8px 0 4px;line-height:1.55">${escapeHtml(t.promptExcerpt)}</p>` : ''}
      <p class="hint">Phase 1 read-only. 승인/dispatch 는 Phase 2/3.</p>
    `;
  }

  function focusNode(node) {
    const related = node.closedNeighborhood();
    cy.elements().addClass('dim');
    related.removeClass('dim');
  }

  cy.on('tap', 'node', (evt) => {
    const n = evt.target;
    const kind = n.data('kind');
    if (kind === 'hub') {
      cy.elements().removeClass('dim');
      panelEyebrow.textContent = 'HUB';
      panelTitle.textContent = 'SailTech · dmjgroup';
      const hb = data.heartbeat || {};
      const c = data.cost || {};
      panelBody.innerHTML = `
        <p>Expert fleet 의 작업 현황. 노드 탭으로 상세 확인.</p>
        <dl class="detail-grid">
          <dt>experts</dt><dd>${data.experts.length}</dd>
          <dt>directives</dt><dd>${data.tasks.length}</dd>
          <dt>승인대기</dt><dd>${data.tasks.filter(t=>t.status==='approve').length}</dd>
          <dt>오늘 cost</dt><dd>$${(c.day_total_usd||0).toFixed(2)} / 월 cap $${(c.month_cap_usd||0).toFixed(0)}</dd>
          <dt>daemon</dt><dd>${hb.daemon_alive ? '🟢 alive · ' + (hb.mode||'') : '🔴 down'} (${hb.stale_seconds||0}s stale)</dd>
          <dt>schema</dt><dd>${data.schemaVersion || 'unknown'}</dd>
          <dt>last sync</dt><dd>${data.generatedAt ? new Date(data.generatedAt).toLocaleString('ko-KR') : '—'}</dd>
        </dl>
      `;
      openSidePanel();
      return;
    }
    if (kind === 'expert') {
      const exp = data.experts.find(e => e.id === n.id());
      if (exp) { renderExpertPanel(exp); focusNode(n); openSidePanel(); }
      return;
    }
    if (kind === 'task') {
      renderTaskPanel(n.id());
      focusNode(n);
      openSidePanel();
    }
  });
  cy.on('tap', (evt) => {
    if (evt.target === cy) {
      cy.elements().removeClass('dim');
    }
  });

  // ---------- Stats ----------
  function renderStats() {
    const total = data.tasks.length;
    const run = data.tasks.filter(t => t.status === 'run').length;
    const block = data.tasks.filter(t => t.status === 'block').length;
    const approve = data.tasks.filter(t => t.status === 'approve').length;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statRun').textContent = run;
    document.getElementById('statBlock').textContent = block;
    document.getElementById('statApprove').textContent = approve;
    document.getElementById('approvalCount').textContent = approve;
    document.getElementById('notifDot').textContent = approve + block;

    // cost widget (schema_v0.1 §2-6)
    const c = data.cost || {};
    const day = typeof c.day_total_usd === 'number' ? c.day_total_usd : 0;
    const mo  = typeof c.month_total_usd === 'number' ? c.month_total_usd : 0;
    const cap = typeof c.month_cap_usd === 'number' ? c.month_cap_usd : 0;
    document.getElementById('statCostDay').textContent = '$' + day.toFixed(2);
    document.getElementById('statCostMonth').textContent =
      cap > 0 ? `$${mo.toFixed(2)}/$${cap.toFixed(0)}` : `$${mo.toFixed(2)}`;

    // heartbeat (schema_v0.1 §2-7)
    const hb = data.heartbeat || {};
    const dot = document.getElementById('daemonDot');
    dot.classList.remove('dmn-up', 'dmn-stale', 'dmn-down');
    if (hb.daemon_alive && (hb.stale_seconds || 0) < 300) {
      dot.classList.add('dmn-up');
      dot.setAttribute('title', `daemon up · ${hb.mode || ''} · stale ${hb.stale_seconds || 0}s`);
    } else if (hb.daemon_alive) {
      dot.classList.add('dmn-stale');
      dot.setAttribute('title', `daemon stale ${hb.stale_seconds}s (>300s)`);
    } else {
      dot.classList.add('dmn-down');
      dot.setAttribute('title', 'daemon down');
    }

    const t = data.generatedAt ? new Date(data.generatedAt) : new Date();
    document.getElementById('lastSync').textContent =
      `sync ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
  }
  renderStats();

  // ---------- Approval bottom sheet ----------
  const sheet = document.getElementById('bottomSheet');
  const sheetHandle = document.getElementById('sheetHandle');
  const sheetBody = document.getElementById('sheetBody');
  function renderApprovals() {
    sheetBody.innerHTML = data.approvalQueue.map(a => `
      <div class="approval-card" data-task-id="${a.id}">
        <div class="ac-head">
          <span class="ac-expert">${escapeHtml(a.expert)}</span>
          ${statusPill('approve')}
        </div>
        <div class="ac-title">${escapeHtml(a.title)}</div>
        <p style="font-size:12px;color:var(--text-dim);margin:0 0 10px;line-height:1.5">${escapeHtml(a.summary)}</p>
        <div class="ac-actions">
          <button class="btn btn-primary" disabled title="Phase 3">승인</button>
          <button class="btn btn-ghost" disabled title="Phase 3">보류</button>
          <button class="btn btn-ghost" data-jump="${a.id}">노드 보기</button>
        </div>
      </div>
    `).join('') || '<p class="hint" style="padding:8px 6px">승인 대기 항목 없음.</p>';
    sheetBody.querySelectorAll('[data-jump]').forEach(b => {
      b.addEventListener('click', () => {
        const tid = b.getAttribute('data-jump');
        const n = cy.getElementById(tid);
        if (n) {
          cy.elements().unselect(); n.select(); focusNode(n);
          cy.animate({ center: { eles: n }, zoom: 1.1 }, { duration: 350 });
          renderTaskPanel(tid); openSidePanel();
          sheet.classList.remove('open');
        }
      });
    });
  }
  renderApprovals();

  sheetHandle.addEventListener('click', () => {
    sheet.classList.toggle('open');
    sheet.setAttribute('aria-hidden', sheet.classList.contains('open') ? 'false' : 'true');
  });

  // ---------- Canvas controls ----------
  document.getElementById('fitBtn').addEventListener('click', () => cy.fit(cy.elements(), 40));
  document.getElementById('zoomInBtn').addEventListener('click', () => cy.zoom({ level: cy.zoom() * 1.25, renderedPosition: { x: cy.width()/2, y: cy.height()/2 } }));
  document.getElementById('zoomOutBtn').addEventListener('click', () => cy.zoom({ level: cy.zoom() * 0.8, renderedPosition: { x: cy.width()/2, y: cy.height()/2 } }));

  document.getElementById('refreshBtn').addEventListener('click', () => {
    // Phase 2: poll JSON. For now: re-layout.
    layoutRadial();
    renderStats();
  });
  document.getElementById('notifBtn').addEventListener('click', () => {
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
  });
  document.getElementById('filterBtn').addEventListener('click', () => {
    // toggle: dim everything except non-done
    const dimmed = cy.elements('[status = "done"]').hasClass('dim');
    cy.elements().removeClass('dim');
    if (!dimmed) cy.elements('node[kind = "task"][status = "done"]').addClass('dim');
  });
  document.getElementById('newDirectiveBtn').addEventListener('click', openDirectiveModal);

  // ---------- "+새지시" modal (Phase 1, infra 0) ----------
  // 합의 ⑥: dashboard → GitHub Issue 자동 생성 → 트리오 dispatch.
  // 우리 쪽 토큰·서버 0. window.open(...issues/new?title=...&body=...&labels=...).
  // URL 길이 한계 ~8KB (#11 경고). 7KB 초과 시 paste fallback.
  const REPO_ISSUES_NEW = 'https://github.com/D990905/dmj-site/issues/new';
  const URL_SAFE_LIMIT = 7000; // bytes; #11 7KB note

  function openDirectiveModal() {
    let modal = document.getElementById('directiveModal');
    if (!modal) modal = buildDirectiveModal();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => modal.querySelector('input[name=title]')?.focus(), 50);
  }
  function closeDirectiveModal() {
    const modal = document.getElementById('directiveModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
  function buildDirectiveModal() {
    const modal = document.createElement('div');
    modal.id = 'directiveModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <form class="modal-card" id="directiveForm" autocomplete="off">
        <header class="modal-head">
          <div>
            <div class="panel-eyebrow">NEW DIRECTIVE</div>
            <div class="panel-title">새 지시</div>
          </div>
          <button type="button" class="close-btn" data-close aria-label="close">×</button>
        </header>
        <div class="modal-body">
          <label class="fld">
            <span>대상 expert</span>
            <select name="persona" required>
              <option value="">선택</option>
              ${data.experts.map(e => `<option value="${e.id}">${e.icon} ${e.label}</option>`).join('')}
            </select>
          </label>
          <label class="fld">
            <span>우선순위</span>
            <select name="priority">
              <option value="2">P2 · 보통</option>
              <option value="3" selected>P3 · 높음</option>
              <option value="4">P4 · 긴급</option>
              <option value="1">P1 · 낮음</option>
            </select>
          </label>
          <label class="fld">
            <span>제목 <small>(필수, ≤120자)</small></span>
            <input name="title" type="text" maxlength="120" required placeholder="예: 라이딩 리플레이 폴리시 v2 검토" />
          </label>
          <label class="fld">
            <span>본문 <small>(컨텍스트 · 산출물 · 마감)</small></span>
            <textarea name="body" rows="6" placeholder="컨텍스트: ___
산출물: ___
마감: ___"></textarea>
          </label>
          <div class="fld-meta">
            <span id="sizeHint" class="hint">URL size: 0 / ${URL_SAFE_LIMIT.toLocaleString()} bytes</span>
          </div>
          <div id="fallbackBox" class="fallback" hidden>
            <p><b>본문 7KB 초과.</b> GitHub UI 에서 paste 권장:</p>
            <ol>
              <li>아래 "GitHub Issue 열기" 클릭 → 빈 새 Issue 페이지가 열림</li>
              <li>"본문 복사" 클릭 → 클립보드에 복사됨</li>
              <li>GitHub 페이지 본문 input 에 paste</li>
            </ol>
            <button type="button" class="btn btn-ghost" id="copyBodyBtn">본문 복사</button>
          </div>
        </div>
        <footer class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>취소</button>
          <button type="submit" class="btn btn-primary">GitHub Issue 열기</button>
        </footer>
      </form>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', closeDirectiveModal);
    });

    const form = modal.querySelector('#directiveForm');
    const sizeHint = modal.querySelector('#sizeHint');
    const fallback = modal.querySelector('#fallbackBox');

    function computeUrlSize() {
      const fd = new FormData(form);
      const url = buildIssueUrl({
        persona: fd.get('persona') || '',
        title: fd.get('title') || '',
        body: fd.get('body') || '',
        priority: fd.get('priority') || '3'
      });
      return new Blob([url]).size; // byte size, multi-byte-safe
    }
    function updateSize() {
      const sz = computeUrlSize();
      sizeHint.textContent = `URL size: ${sz.toLocaleString()} / ${URL_SAFE_LIMIT.toLocaleString()} bytes`;
      const over = sz > URL_SAFE_LIMIT;
      sizeHint.style.color = over ? 'var(--c-red)' : 'var(--text-dim)';
      fallback.hidden = !over;
    }
    form.addEventListener('input', updateSize);
    form.addEventListener('change', updateSize);
    updateSize();

    modal.querySelector('#copyBodyBtn').addEventListener('click', () => {
      const body = form.querySelector('[name=body]').value;
      navigator.clipboard.writeText(body).then(() => {
        const btn = modal.querySelector('#copyBodyBtn');
        const orig = btn.textContent;
        btn.textContent = '✓ 복사됨';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      });
    });

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const persona = fd.get('persona');
      const title = (fd.get('title') || '').trim();
      const body = (fd.get('body') || '').trim();
      const priority = fd.get('priority') || '3';
      if (!persona || !title) return;
      const url = buildIssueUrl({ persona, title, body, priority });
      const sz = new Blob([url]).size;
      if (sz > URL_SAFE_LIMIT) {
        // strip body, open blank Issue with title only; user pastes body manually
        const urlMin = buildIssueUrl({ persona, title, body: '', priority });
        window.open(urlMin, '_blank', 'noopener');
      } else {
        window.open(url, '_blank', 'noopener');
      }
      closeDirectiveModal();
      // Phase 2: POST 후 즉시 dashboard-state.json 폴링 trigger.
    });
    return modal;
  }

  function buildIssueUrl({ persona, title, body, priority }) {
    // persona = agents.slug (e.g. '04-frontend'). Labels follow Thread 002 t1
    // pattern: `directive,pending,<slug>,priority:p<n>`. Daemon polls by `directive`+`pending`.
    const PRIORITY_TO_SCHEMA = { '1': 'p3', '2': 'p2', '3': 'p1', '4': 'p0' }; // form numeric → schema enum
    const priorityLabel = PRIORITY_TO_SCHEMA[priority] || 'p2';
    const labels = ['directive', 'pending', persona, `priority:${priorityLabel}`].join(',');
    const qs = new URLSearchParams({ title, body, labels });
    return `${REPO_ISSUES_NEW}?${qs.toString()}`;
  }

  // ============================================================
  // PR 1-3 — Visual Designer (Rose) contributions, 2026-06-02
  // γ 채택 후속 — visual_designer_pr_dashboard_contributions.md spec.
  // PR 4 (PersonaDetailPanel) 는 renderExpertPanel() 안에 enrich.
  // ============================================================

  // ---------- PR 1: Decision Feed ----------
  function formatDecisionTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}-${dd} ${hh}:${mi}`;
  }
  const DECISION_ICON = { approve: '✓', reject: '✗', hold: '◐' };
  const DECISION_ICON_CLASS = { approve: '', reject: ' decision-feed__icon--reject', hold: ' decision-feed__icon--hold' };
  function renderDecisions() {
    const listEl = document.getElementById('decisionList');
    const countEl = document.getElementById('decisionCount');
    if (!listEl) return;
    const decisions = Array.isArray(data.recentDecisions) ? data.recentDecisions : [];

    if (decisions.length === 0) {
      listEl.innerHTML = '<li class="decision-feed__empty">결정 기록 없음</li>';
      if (countEl) countEl.textContent = '0';
      return;
    }

    // recent 5, 시간 역순
    const recent = decisions
      .slice()
      .sort((a, b) => new Date(b.decided_at || 0) - new Date(a.decided_at || 0))
      .slice(0, 5);

    listEl.innerHTML = recent.map(d => {
      const verdict = d.decision || 'approve';
      const icon = DECISION_ICON[verdict] || '·';
      const iconCls = DECISION_ICON_CLASS[verdict] || '';
      const text = d.question || d.text || '결정 기록';
      const actorLabel = d.decided_by_email
        ? (d.decided_by_email.split('@')[0] || d.decided_by_email)
        : (d.actor_label || '대표님');
      return `
        <li class="decision-feed__item">
          <time class="decision-feed__time" datetime="${escapeHtml(d.decided_at || '')}">${escapeHtml(formatDecisionTime(d.decided_at))}</time>
          <span class="decision-feed__icon${iconCls}" aria-hidden="true">${icon}</span>
          <span class="decision-feed__text">${escapeHtml(text)}</span>
          <span class="decision-feed__actor">${escapeHtml(actorLabel)}</span>
        </li>`;
    }).join('');

    if (countEl) countEl.textContent = String(decisions.length);
  }

  // ---------- PR 2: Priority Lane ----------
  // 정렬 logic — active state (run + block) 우선, 그 다음 priority 큰 순, 그 다음 approve, 그 다음 wait.
  // task.priority 는 PRIORITY_MAP 후 int (p0=4, p1=3, p2=2, p3=1).
  // labelFull 우선 (truncate 보다 풀 텍스트), assignee 는 첫 글자.
  const STATE_DOT_CLASS = { run: 's-run', done: 's-done', block: 's-block', wait: 's-wait', approve: 's-approve' };
  const STATE_SORT_RANK = { run: 0, block: 1, approve: 2, wait: 3, done: 4 };
  function renderPriority() {
    const listEl = document.getElementById('priorityList');
    if (!listEl) return;

    const tasks = (data.tasks || []).slice().filter(t => t.status !== 'done');
    if (tasks.length === 0) {
      listEl.innerHTML = '<li class="priority-lane__empty">우선순위 task 없음</li>';
      return;
    }

    tasks.sort((a, b) => {
      // 1) state rank
      const ra = STATE_SORT_RANK[a.status] !== undefined ? STATE_SORT_RANK[a.status] : 9;
      const rb = STATE_SORT_RANK[b.status] !== undefined ? STATE_SORT_RANK[b.status] : 9;
      if (ra !== rb) return ra - rb;
      // 2) priority 큰 순 (4 → 1)
      const pa = a.priority || 0, pb = b.priority || 0;
      if (pa !== pb) return pb - pa;
      // 3) updatedAt 최신 우선
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

    const top3 = tasks.slice(0, 3);
    const ranks = ['①', '②', '③'];

    listEl.innerHTML = top3.map((t, i) => {
      const expert = data.experts.find(e => e.id === t.parent);
      const expertMono = expert ? (expert.short || '?').charAt(0) : '?';
      const stateLabel = (STATUS[t.status] || STATUS.wait).label;
      return `
        <li class="priority-lane__item" data-task-id="${escapeHtml(t.id)}" data-state="${escapeHtml(t.status)}" tabindex="0" role="button">
          <span class="priority-lane__rank">${ranks[i]}</span>
          <span class="priority-lane__title-text" title="${escapeHtml(t.labelFull || t.label)}">${escapeHtml(t.labelFull || t.label)}</span>
          <span class="priority-lane__assignee" data-persona="${escapeHtml(t.parent || '')}">${escapeHtml(expertMono)}</span>
          <span class="priority-lane__state ${STATE_DOT_CLASS[t.status] || 's-wait'}" aria-label="${stateLabel}"></span>
        </li>`;
    }).join('');

    // click → focus on graph + open side panel
    listEl.querySelectorAll('li[data-task-id]').forEach(li => {
      const tid = li.getAttribute('data-task-id');
      const goto = () => {
        const n = cy.getElementById(tid);
        if (n && n.length) {
          cy.elements().unselect(); n.select(); focusNode(n);
          renderTaskPanel(tid); openSidePanel();
        }
      };
      li.addEventListener('click', goto);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goto(); }
      });
    });
  }

  // ---------- PR 3: David Offline Banner ----------
  // daemon offline 또는 mode != 'full' 시 노출. sessionStorage 로 dismiss 가능.
  function updateDavidBanner() {
    const banner = document.getElementById('davidBanner');
    if (!banner) return;

    // 사용자가 이 세션에서 close 했으면 숨김 유지
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('davidBannerDismissed') === '1'; } catch (e) {}
    if (dismissed) { banner.hidden = true; return; }

    const hb = data.heartbeat || {};
    // offline 판단: daemon 죽었거나, full mode 가 아닌 deploy-only mode (= directive_loop 미가동)
    const directiveLoopInactive = hb.mode && hb.mode !== 'full';
    const daemonDown = !hb.daemon_alive;
    const isOffline = daemonDown || directiveLoopInactive;

    banner.hidden = !isOffline;
    if (isOffline) {
      const etaEl = banner.querySelector('[data-eta]');
      if (etaEl) etaEl.textContent = hb.eta_iso ? formatDecisionTime(hb.eta_iso) : '?';
      // 사유 텍스트 정교화
      const textEl = banner.querySelector('.david-banner__text');
      if (textEl) {
        textEl.textContent = daemonDown
          ? 'David offline · daemon down · manual dispatch active'
          : `David offline · ${hb.mode || 'deploy-only'} mode · manual dispatch active`;
      }
    }
  }

  // banner close button
  document.getElementById('davidBannerClose')?.addEventListener('click', () => {
    const banner = document.getElementById('davidBanner');
    if (banner) banner.hidden = true;
    try { sessionStorage.setItem('davidBannerDismissed', '1'); } catch (e) {}
  });

  // ---------- D Avatar → 옥대표님 PersonaPanel (CoS β 채택, 2026-06-02 12:55) ----------
  // PR 4 PersonaDetailPanel 패턴 재사용 — 대표님 본인의 standby + fleet 진행 + 비용 + 최근 결정.
  function showDannyPanel() {
    const pending = (data.approvalQueue || []).length;
    const totalDir = (data.tasks || []).length;
    const running = (data.tasks || []).filter(t => t.status === 'run').length;
    const blocked = (data.tasks || []).filter(t => t.status === 'block').length;
    const done = (data.tasks || []).filter(t => t.status === 'done').length;
    const c = data.cost || {};
    const recent = (data.recentDecisions || [])
      .slice()
      .sort((a, b) => new Date(b.decided_at || 0) - new Date(a.decided_at || 0))
      .slice(0, 5);

    panelEyebrow.textContent = 'CEO';
    panelTitle.innerHTML = `<span class="persona-mono persona-mono--danny">D</span>옥대표님 — Danny Ok`;

    panelBody.innerHTML = `
      <div class="panel-meta">
        <span class="panel-meta__item"><span class="panel-meta__dot s-active"></span>활동 중</span>
        <span class="panel-meta__item">운동생리학 PhD · NSCA-CSCS</span>
        <span class="panel-meta__item">단무지공방 · SailTechCo CEO</span>
      </div>

      <div class="panel-current">
        <span class="panel-current__label">오늘 결정 대기</span>
        ${pending > 0
          ? `<strong>${pending} 건</strong> · 승인 큐 (bottom-sheet 펼치기)`
          : `<span class="panel-current__none">대기 결정 없음 — 모든 dispatch 자율 진행 중</span>`}
      </div>

      <div class="panel-section">
        <h4 class="panel-section__title">Fleet 진행</h4>
        <dl class="detail-grid">
          <dt>전체</dt><dd>${totalDir} directives</dd>
          <dt>진행 중</dt><dd>${running}</dd>
          <dt>차단</dt><dd>${blocked}</dd>
          <dt>승인 대기</dt><dd>${pending}</dd>
          <dt>완료</dt><dd>${done}</dd>
        </dl>
      </div>

      <div class="panel-section">
        <h4 class="panel-section__title">오늘 비용</h4>
        <dl class="detail-grid">
          <dt>day</dt><dd>$${(typeof c.day_total_usd === 'number' ? c.day_total_usd : 0).toFixed(2)}</dd>
          <dt>month</dt><dd>$${(typeof c.month_total_usd === 'number' ? c.month_total_usd : 0).toFixed(2)} / $${(typeof c.month_cap_usd === 'number' ? c.month_cap_usd : 50).toFixed(0)}</dd>
          <dt>remaining</dt><dd>$${(typeof c.month_remaining_usd === 'number' ? c.month_remaining_usd : 0).toFixed(2)}</dd>
        </dl>
      </div>

      ${recent.length ? `
      <div class="panel-section">
        <h4 class="panel-section__title">최근 결정 (대표님)</h4>
        <ul class="panel-standby">
          ${recent.map(d => `
            <li>${escapeHtml(d.question || d.text || '결정 기록')}
              <span style="color:var(--text-faint);font-size:10px;margin-left:4px">${escapeHtml(formatDecisionTime(d.decided_at))}</span>
            </li>`).join('')}
        </ul>
      </div>` : ''}

      <div class="panel-section">
        <h4 class="panel-section__title">Trigger keyword</h4>
        <ul class="panel-triggers">
          <li>@옥대표님</li>
          <li>@대표님</li>
          <li>@Danny</li>
          <li>@CEO</li>
        </ul>
      </div>
    `;

    openSidePanel();
  }

  // D avatar click handler (mobile + desktop)
  document.getElementById('dannyAvatar')?.addEventListener('click', showDannyPanel);
  document.getElementById('dannyAvatar')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDannyPanel(); }
  });

  // ---------- Initial render (PR 1-3) ----------
  renderDecisions();
  renderPriority();
  updateDavidBanner();

  // ---------- Initial state fetch + polling ----------
  function rerender() {
    cy.elements().remove();
    cy.add(buildElements());
    layoutRadial();
    renderApprovals();
    renderDecisions();
    renderPriority();
    updateDavidBanner();
  }
  (async function init() {
    const fetched = await fetchState();
    if (fetched) {
      data = fetched;
      rerender();
      renderStats();
    }
    startPolling();
  })();

  // ---------- Utilities ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  // expose for debugging
  window.__cy = cy;
})();
