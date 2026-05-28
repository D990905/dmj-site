/* SailTech Orchestrator Dashboard — Phase 1 app.js
   Read-only Cytoscape.js mindmap of 8 expert fleet + sample tasks.
   No backend. Sample data from data.sample.js (window.SAILTECH_SAMPLE).
*/
(function () {
  'use strict';

  const data = window.SAILTECH_SAMPLE;
  if (!data) { console.error('SAILTECH_SAMPLE missing'); return; }

  // Status → color/label
  const STATUS = {
    done:    { color: '#22c55e', label: '완료',     order: 0 },
    run:     { color: '#facc15', label: '진행',     order: 1 },
    block:   { color: '#ef4444', label: '차단',     order: 2 },
    wait:    { color: '#6b7280', label: '대기',     order: 3 },
    approve: { color: '#38bdf8', label: '승인대기', order: 4 }
  };
  const PRIORITY_RADIUS = { 1: 18, 2: 22, 3: 26, 4: 32 }; // task node base radius

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
        data: { id: e.id, label: `${e.icon} ${e.label}`, kind: 'expert', short: e.short }
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
      // experts
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
          'text-valign': 'bottom',
          'text-margin-y': 6,
          'text-wrap': 'wrap',
          'text-max-width': 130,
          'font-size': 10,
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
    const cx = w / 2, cy0 = h / 2;
    const expertR = Math.min(w, h) * 0.28;
    const taskR   = Math.min(w, h) * 0.46;

    cy.getElementById(data.hub.id).position({ x: cx, y: cy0 });

    const N = data.experts.length;
    data.experts.forEach((e, i) => {
      const angle = (-Math.PI / 2) + (i * (2 * Math.PI / N)); // start at top
      const ex = cx + expertR * Math.cos(angle);
      const ey = cy0 + expertR * Math.sin(angle);
      cy.getElementById(e.id).position({ x: ex, y: ey });

      // place tasks for this expert in a small arc outside
      const childTasks = data.tasks.filter(t => t.parent === e.id);
      const arcSpread = Math.min(0.55, 0.10 + childTasks.length * 0.10); // radians half-width
      childTasks.forEach((t, j) => {
        const tCount = childTasks.length;
        const offset = tCount === 1 ? 0 : (j / (tCount - 1) - 0.5) * 2 * arcSpread;
        const a = angle + offset;
        const tx = cx + taskR * Math.cos(a);
        const ty = cy0 + taskR * Math.sin(a);
        cy.getElementById(t.id).position({ x: tx, y: ty });
      });
    });

    cy.fit(cy.elements(), 40);
  }
  layoutRadial();
  window.addEventListener('resize', () => {
    layoutRadial();
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

  function renderExpertPanel(expert) {
    const tasks = data.tasks.filter(t => t.parent === expert.id);
    const counts = tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status]||0)+1; return acc; }, {});
    const order = ['run','approve','block','wait','done'];

    panelEyebrow.textContent = 'EXPERT';
    panelTitle.textContent = `${expert.icon} ${expert.label}`;
    panelBody.innerHTML = `
      <dl class="detail-grid">
        <dt>fleet</dt><dd>${expert.short}</dd>
        <dt>tasks</dt><dd>${tasks.length}</dd>
        <dt>상태</dt><dd>${order.filter(k => counts[k]).map(k => `${STATUS[k].label} ${counts[k]}`).join(' · ') || '—'}</dd>
      </dl>
      <div style="font-size:11px;color:var(--text-faint);margin-bottom:6px;letter-spacing:.5px">TASKS</div>
      <ul class="task-list">
        ${tasks.map(t => `
          <li data-task-id="${t.id}">
            <span class="ti-status" style="background:${STATUS[t.status].color}"></span>
            <span>${escapeHtml(t.label)}</span>
          </li>`).join('')}
      </ul>
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
    panelEyebrow.textContent = 'TASK';
    panelTitle.textContent = t.label;
    panelBody.innerHTML = `
      <dl class="detail-grid">
        <dt>expert</dt><dd>${exp ? exp.icon + ' ' + exp.label : '—'}</dd>
        <dt>상태</dt><dd>${statusPill(t.status)}</dd>
        <dt>priority</dt><dd>P${t.priority}</dd>
        ${dep ? `<dt>blocked by</dt><dd>${escapeHtml(dep.label)}</dd>` : ''}
      </dl>
      <p class="hint">Phase 1 read-only. 실제 작업 dispatch / 승인은 Phase 3.</p>
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
      panelBody.innerHTML = `
        <p>8 expert fleet 의 작업 현황. 노드 탭으로 상세 확인.</p>
        <dl class="detail-grid">
          <dt>experts</dt><dd>${data.experts.length}</dd>
          <dt>tasks</dt><dd>${data.tasks.length}</dd>
          <dt>승인대기</dt><dd>${data.tasks.filter(t=>t.status==='approve').length}</dd>
          <dt>last sync</dt><dd>${new Date(data.generatedAt).toLocaleString('ko-KR')}</dd>
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
    const t = new Date(data.generatedAt);
    document.getElementById('lastSync').textContent = `sync ${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`;
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
  document.getElementById('newDirectiveBtn').addEventListener('click', () => {
    alert('새 지시 — Phase 3 에서 활성화됩니다.');
  });

  // ---------- Utilities ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  // expose for debugging
  window.__cy = cy;
})();
