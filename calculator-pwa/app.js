/* ==========================================================================
   DMJ Lifting Calculator — PWA · app.js
   UI 컨트롤 + lift-calculator.js engine binding + Service Worker register.
   v1 (2026-05-19)
   ========================================================================== */
(function () {
  'use strict';

  // ───────── helpers ─────────
  function $(sel)  { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function num(id, fallback) {
    var el = $('#' + id);
    if (!el) return fallback;
    var v = parseFloat(el.value);
    return (isFinite(v)) ? v : fallback;
  }
  function radioVal(name, fallback) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : fallback;
  }
  function text(id, val) {
    var el = $('#' + id);
    if (el) el.textContent = val;
  }
  function html(id, val) {
    var el = $('#' + id);
    if (el) el.innerHTML = val;
  }

  // ───────── default values (Danny baseline) ─────────
  var DEFAULTS = {
    'ci-rider': 70,
    'ci-gear': 10,
    'ci-area': 1200,
    'ci-ar': 6.5,
    'ci-wind': 13,
    'wso-mast': 112,
    'wso-height': 175,
    'wso-wingar': 4.5
  };

  // ───────── foil preset dropdown ─────────
  var presets = [];

  function populatePresets() {
    var sel = $('#ci-foil-preset');
    if (!sel) return;
    sel.innerHTML = '';
    var emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '— 직접 입력 —';
    sel.appendChild(emptyOpt);

    var P = window.DMJ_FOIL_PRESETS;
    if (!P) return;
    var groups = [
      ['levitaz', 'Levitaz'],
      ['chubanga', 'Chubanga'],
      ['takoon', 'Takoon'],
      ['north', 'North']
    ];
    groups.forEach(function (grp) {
      var arr = P[grp[0]];
      if (!Array.isArray(arr) || arr.length === 0) return;
      var og = document.createElement('optgroup');
      og.label = grp[1];
      arr.forEach(function (f) {
        var opt = document.createElement('option');
        opt.value = f.id;
        var area = f.area_display_cm2 || f.area_cm2;
        opt.textContent = f.model + ' (' + area + 'cm² · AR ' + f.ar + ')';
        og.appendChild(opt);
        presets.push(f);
      });
      sel.appendChild(og);
    });
  }

  function onPresetChange(e) {
    var id = e.target.value;
    if (!id) return;
    var f = presets.filter(function (p) { return p.id === id; })[0];
    if (!f) return;
    $('#ci-area').value = f.area_cm2;
    $('#ci-ar').value = f.ar;
    recompute();
  }

  // ───────── main takeoff recompute ─────────
  function recompute() {
    if (!window.DMJLift) return;

    var rider   = num('ci-rider', 70);
    var area    = num('ci-area', 1200);
    var ar      = num('ci-ar', 6.5);
    var gear    = num('ci-gear', 10);
    var wind    = num('ci-wind', 13);
    var pumping = radioVal('pumping', 'moderate');
    var water   = radioVal('water_type', 'sea');
    var surface = radioVal('surface', 'flat');

    var input = {
      rider_kg: rider,
      front_wing_area_cm2: area,
      front_wing_ar: ar,
      wind_kt: wind,
      pumping: pumping,
      gear_kg: gear,
      water_type: water,
      surface: surface
    };

    var r = window.DMJLift.calculate(input);

    text('r-vmin',    r.vmin_kt != null ? r.vmin_kt.toFixed(1) : '—');
    text('r-vtarget', r.vtarget_kt != null ? r.vtarget_kt.toFixed(1) : '—');

    // 추천 윙 사이즈 = 부상 가능 최소 (§177)
    var recMin = window.DMJLift.recommendMinFeasibleWingSize
      ? window.DMJLift.recommendMinFeasibleWingSize(input)
      : null;

    var rWing = $('#r-wing');
    var rWingDetail = $('#r-wing-detail');

    if (recMin && recMin.recommended_size_m2 != null) {
      rWing.textContent = recMin.recommended_size_m2.toFixed(1);
      var marginTxt = (recMin.margin_kt != null && recMin.margin_kt >= 0)
        ? '여유 +' + recMin.margin_kt.toFixed(1) + 'kt' : '';
      var bindLabel = recMin.binding === 'comfort'
        ? '컨트롤 floor 결정' : '부상 한계 결정';
      rWingDetail.innerHTML = bindLabel + (marginTxt ? ' · ' + marginTxt : '')
        + ' · 부상 min ' + recMin.precise_takeoff_min_m2.toFixed(2)
        + ' / floor ' + recMin.precise_comfort_floor_m2.toFixed(2) + ' m²';
    } else if (recMin && recMin.extreme) {
      rWing.textContent = '—';
      var alt = [];
      if (recMin.min_wind_kt != null) alt.push('풍속 ≥ ' + recMin.min_wind_kt.toFixed(1) + 'kt');
      if (recMin.min_foil_area_cm2 != null) alt.push('foil ≥ ' + recMin.min_foil_area_cm2 + 'cm²');
      rWingDetail.innerHTML = '<span style="color:var(--err-fg)">라인업으로 불가</span> · 필요: ' + alt.join(' 또는 ');
    } else {
      rWing.textContent = '—';
      rWingDetail.textContent = '';
    }

    // 풍속 등급
    var tierLabel = r.wind_tier === 'light'  ? '미풍 — 윙 ↑'
                  : r.wind_tier === 'strong' ? '강풍 — 윙 ↓'
                  : '중풍 — 기본';
    text('r-windtier', tierLabel);

    text('r-meta',
      'CL ' + r.cl + ' · ' + r.ar_class + ' · A ' + r.area_m2.toFixed(3) + 'm²');
    text('r-mass',
      rider + ' + ' + r.gear_kg + ' = ' + r.total_mass_kg + ' kg');
    var waterLabel = r.water_type === 'fresh' ? '강·호수 (ρ1000)' : '바다 (ρ1025)';
    var surfaceLabel = ({ flat: '플랫', choppy: '초피', swell: '너울', mixed: '혼합' })[r.surface] || r.surface;
    text('r-water-surface',
      waterLabel + ' · ' + surfaceLabel + ' (×' + r.surface_factor.toFixed(2) + ') · 펌핑 ×' + r.pumping_factor.toFixed(2));

    // feasibility badge
    var fz = $('#feasible-badge');
    if (r.feasible) {
      fz.className = 'badge badge--ok';
      fz.textContent = '✓ takeoff 가능 — v_target ' + r.vtarget_kt + 'kt ≤ 풍속 ' + wind + 'kt + 여유 3kt';
    } else {
      var rec = window.DMJLift.recommendTakeoffWing
        ? window.DMJLift.recommendTakeoffWing(input) : null;
      if (rec && rec.recommended_size_m2 != null) {
        fz.className = 'badge badge--rec';
        fz.innerHTML = '<b>💡 부상 가능 윙: ' + rec.recommended_size_m2.toFixed(1) + ' m² 이상</b>'
          + '<small>역산 ' + rec.min_wing_needed_m2.toFixed(2) + 'm² → 라인업 매핑 · v_target ' + r.vtarget_kt + 'kt vs ' + wind + 'kt</small>';
      } else if (rec && rec.extreme) {
        fz.className = 'badge badge--no';
        var alt2 = [];
        if (rec.min_wind_kt != null) alt2.push('풍속 ≥ ' + rec.min_wind_kt.toFixed(1) + 'kt');
        if (rec.min_foil_area_cm2 != null) alt2.push('foil ≥ ' + rec.min_foil_area_cm2 + 'cm²');
        fz.innerHTML = '<b>이 조합으로는 어떤 윙으로도 부상 불가</b>'
          + (alt2.length ? '<br><small>필요: ' + alt2.join(' 또는 ') + '</small>' : '');
      } else {
        fz.className = 'badge badge--no';
        fz.innerHTML = '<b>현재 셋업 takeoff 불가</b><br><small>v_target ' + r.vtarget_kt + 'kt > 가용 ' + wind + 'kt — 윙 ↑ 또는 더 큰 foil</small>';
      }
    }

    html('r-formula',
      'v_min = √(2·M·g / (ρ·A·CL)) = √(2·' + r.total_mass_kg + '·9.81 / (' + r.rho + '·' + r.area_m2.toFixed(3) + '·' + r.cl + ')) = ' + r.vmin_ms + ' m/s = ' + r.vmin_kt + ' kt<br>' +
      'v_target = v_min × pump(' + r.pumping_factor.toFixed(2) + ') × surface(' + r.surface_factor.toFixed(2) + ') = ' + r.vtarget_kt + ' kt');
  }

  // ───────── WSO (Wing Size Optimizer) ─────────
  function recomputeWSO() {
    if (!window.DMJLift || !window.DMJLift.wingSizeOptimal) return;

    var rider   = num('ci-rider', 70);
    var ar      = num('ci-ar', 6.5);
    var gear    = num('ci-gear', 10);
    var skill   = $('#wso-skill') ? $('#wso-skill').value : '상급-선수';
    var pref    = radioVal('wso-pref', 'small');
    var mast    = num('wso-mast', 112);
    var height  = num('wso-height', 175);
    var wingAR  = num('wso-wingar', 4.5);
    var windKt  = num('ci-wind', 13);

    // foil_span from preset
    var presetId = $('#ci-foil-preset') ? $('#ci-foil-preset').value : '';
    var preset = presets.filter(function (p) { return p.id === presetId; })[0];
    var foilSpan = preset && preset.span_cm ? preset.span_cm : 80;

    var r = window.DMJLift.wingSizeOptimal({
      v_wind_kt: windKt,
      m_rider_kg: rider,
      skill: skill,
      foil_ar: ar,
      foil_span_cm: foilSpan,
      mast_cm: mast,
      rider_height_cm: height,
      wing_ar: wingAR,
      preference: pref,
      gear_kg: gear
    });

    if (r.error) {
      ['wso-min', 'wso-opt', 'wso-max'].forEach(function (id) { text(id, '—'); });
      $('#wso-evolution').hidden = true;
      return;
    }

    text('wso-opt', r.optimal.toFixed(1));
    text('wso-min', r.min.toFixed(1));
    text('wso-max', r.max.toFixed(1));

    // size cap visualization
    var capMsg = '레이싱 클래스 규정상 max ' + (r.size_cap_m2 || 7.4) + ' m².';
    ['#wso-min', '#wso-opt', '#wso-max'].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      var parent = el.closest('.bracket__cell');
      if (!parent) return;
      if (r.size_cap_hit) {
        parent.setAttribute('title', capMsg);
        parent.classList.add('bracket__cell--capped');
      } else {
        parent.removeAttribute('title');
        parent.classList.remove('bracket__cell--capped');
      }
    });

    // v-limit / VMG per wing size
    if (r.v_upwind_detail) {
      var det = r.v_upwind_detail;
      var allDepow = det.min.depowered && det.optimal.depowered && det.max.depowered &&
        Math.abs(det.min.kt - det.optimal.kt) < 0.05 &&
        Math.abs(det.max.kt - det.optimal.kt) < 0.05;
      formatVlim('wso-vlim-min', det.min);
      formatVlim('wso-vlim-opt', det.optimal);
      formatVlim('wso-vlim-max', det.max);
      formatVmg('wso-vlim-min-vmg', det.min);
      formatVmg('wso-vlim-opt-vmg', det.optimal);
      formatVmg('wso-vlim-max-vmg', det.max);
      formatVlimDelta('wso-vlim-min-delta', det.min, det.optimal, allDepow);
      formatVlimDelta('wso-vlim-max-delta', det.max, det.optimal, allDepow);
      text('wso-vlim-tack', det.optimal.tack_angle_deg || '—');
      var optDelta = $('#wso-vlim-opt-delta');
      if (optDelta) {
        if (allDepow) {
          optDelta.innerHTML = '<span style="color:var(--warn-fg);font-weight:600">⚠ 라이더 한계 수렴</span>';
        } else {
          optDelta.innerHTML = 'tack ' + (det.optimal.tack_angle_deg || '—') + '°';
        }
      }
    }

    // VMG advisor
    var currentFoilId = presetId;
    var currentArea = num('ci-area', null);
    var foilBrand = null, foilPool = null;
    if (currentFoilId && window.DMJ_FOIL_PRESETS) {
      var prefix = currentFoilId.split('-')[0];
      var brandMap = { lev: 'levitaz', tak: 'takoon', chu: 'chubanga', nor: 'north' };
      foilBrand = brandMap[prefix] || null;
      if (foilBrand && Array.isArray(window.DMJ_FOIL_PRESETS[foilBrand])) {
        foilPool = window.DMJ_FOIL_PRESETS[foilBrand];
      }
    }
    renderUpwindAdvisor({
      v_wind_kt: windKt, m_rider_kg: rider, gear_kg: gear, skill: skill,
      foil_ar: ar, wing_area_m2: r.optimal, wing_ar: wingAR,
      foil_pool: foilPool, current_foil_id: currentFoilId,
      front_wing_area_cm2: currentArea, foil_brand: foilBrand
    });

    // 이론 측정값 (collapsed by default)
    text('wso-raw',     r.raw.toFixed(3) + ' m²');
    text('wso-aceil',   r.A_opt_ceiling.toFixed(3) + ' m² (η=0.92)');
    text('wso-amin',    r.A_min_drive.toFixed(2) + ' m²');
    text('wso-amax',    r.A_max_heel.toFixed(2) + ' m²');
    text('wso-vapp',    r.V_app_ms.toFixed(2) + ' m/s (' + (r.V_app_ms * 1.94384).toFixed(1) + ' kt)');
    text('wso-ldfoil',  r.LD_foil.toFixed(2));
    text('wso-ldwmax',  r.LD_wing_max.toFixed(2));
    text('wso-ldweff',  r.LD_wing_eff.toFixed(2) + ' (η ' + r.eta_pct + '%)');
    text('wso-clear',   r.B_wing_m.toFixed(2) + ' / ' + r.reach_max_m.toFixed(2) + ' m');
    text('wso-eta-pct', r.eta_pct);

    // flags
    var flags = $('#wso-flags');
    flags.innerHTML = '';
    if (r.underpowered)     addFlag(flags, '⚠ underpowered (foil 발진 불가)', 'err');
    if (r.overpowered)      addFlag(flags, '⚠ overpowered (depower 필요)', 'warn');
    if (r.clearance_capped) addFlag(flags, '⚠ tip clearance cap', 'warn');
    if (!r.underpowered && !r.overpowered && !r.clearance_capped)
      addFlag(flags, '✓ in-bounds', 'ok');

    // evolution box (lower skill + overpowered)
    renderEvolution(skill, r.overpowered, r.optimal);
  }

  function formatVlim(id, vl) {
    var el = $('#' + id);
    if (!el || !vl) return;
    if (!vl.feasible || vl.kt <= 0.05) {
      el.className = 'vlimit-cell__val vlimit-cell__val--op';
      el.textContent = '풍상 X';
      el.title = '이 윙 사이즈로 풍상 진행 불가';
    } else if (vl.depowered) {
      el.className = 'vlimit-cell__val';
      el.innerHTML = vl.kt.toFixed(1) + '<small>kt¹</small>';
      el.title = '라이더 한계 영역 (윙 풀파워 X)';
    } else {
      el.className = 'vlimit-cell__val';
      el.innerHTML = vl.kt.toFixed(1) + '<small>kt</small>';
      el.title = 'tack ' + (vl.tack_angle_deg || '?') + '° · β ' + (vl.beta_deg || '?') + '°';
    }
  }

  function formatVmg(id, vl) {
    var el = $('#' + id);
    if (!el) return;
    if (!vl || !vl.feasible) { el.innerHTML = 'VMG —'; return; }
    el.innerHTML = '<b>VMG</b> ' + vl.vmg_kt.toFixed(1) + ' kt';
  }

  function formatVlimDelta(id, vl, base, allDepow) {
    var el = $('#' + id);
    if (!el) return;
    if (!vl || !base) { el.textContent = '—'; return; }
    if (!vl.feasible || vl.kt <= 0.05) {
      el.innerHTML = '<span style="color:var(--err-fg)">불가</span>';
      return;
    }
    var d = Math.round((vl.kt - base.kt) * 10) / 10;
    if (allDepow && Math.abs(d) < 0.05) {
      el.innerHTML = '<span style="color:var(--warn-fg)">한계 수렴</span>';
      return;
    }
    var sign = (d > 0) ? '+' : (d === 0 ? '±' : '');
    var color = (d > 0) ? 'var(--ok-fg)' : (d < 0 ? 'var(--err-fg)' : 'var(--slate)');
    el.innerHTML = '<span style="color:' + color + '">' + sign + d.toFixed(1) + ' kt</span> vs opt';
  }

  function addFlag(parent, label, cls) {
    var f = document.createElement('span');
    f.className = 'flag flag--' + cls;
    f.textContent = label;
    parent.appendChild(f);
  }

  function renderUpwindAdvisor(p) {
    var box = $('#wso-advisor');
    var list = $('#wso-advisor-list');
    if (!box || !list || !window.DMJLift || !window.DMJLift.upwindAdvisor) return;
    var res = window.DMJLift.upwindAdvisor(p);
    if (res.error || !res.scenarios) {
      box.style.display = 'none';
      return;
    }
    box.style.display = '';

    var baseEl = $('#wso-adv-base-vb');
    if (baseEl) {
      baseEl.innerHTML = 'SOG <b>' + res.base.V_boat_kt.toFixed(1) + ' kt</b> · '
        + 'VMG <b>' + res.base.V_vmg_kt.toFixed(1) + ' kt</b> · '
        + 'tack ' + res.base.tack_angle_deg + '°'
        + (res.base.depowered ? ' · <span style="color:var(--warn-fg)">⚠ 라이더 한계</span>' : '')
        + (res.base.feasible ? '' : ' · <span style="color:var(--err-fg)">⚠ 풍상 X</span>');
    }

    list.innerHTML = '';
    var positives = res.scenarios.filter(function (s) { return s.delta_vmg > 0; }).slice(0, 5);
    var negatives = res.scenarios.filter(function (s) { return s.delta_vmg < 0; });

    if (positives.length === 0) {
      var li = document.createElement('li');
      li.style.cssText = 'color:var(--err-fg);font-weight:600';
      li.innerHTML = '작은 변경으로 VMG 개선이 어렵습니다 — 라이더 한계 또는 최적 근처. 스킬 향상 또는 포일 교체를 고려하세요.';
      list.appendChild(li);
    } else {
      positives.forEach(function (s, idx) {
        var li = document.createElement('li');
        var medal = idx === 0 ? '🥇 ' : (idx === 1 ? '🥈 ' : (idx === 2 ? '🥉 ' : ''));
        var dvmg = s.delta_vmg > 0 ? '+' + s.delta_vmg.toFixed(1) : s.delta_vmg.toFixed(1);
        var dvb  = s.delta_vb  > 0 ? '+' + s.delta_vb.toFixed(1)  : s.delta_vb.toFixed(1);
        li.innerHTML =
          '<b>' + medal + s.label + '</b> <small style="color:#0c4a6e">(' + s.detail + ')</small><br>' +
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px">' +
            'SOG ' + (s.new_V_boat_kt != null ? s.new_V_boat_kt.toFixed(1) : '—') + ' (Δ ' + dvb + ') · ' +
            'VMG ' + (s.new_V_vmg_kt != null ? s.new_V_vmg_kt.toFixed(1) : '—') + ' <b style="color:#0369a1">(Δ ' + dvmg + ')</b>' +
            (s.depowered_after ? ' ⚠' : '') +
          '</span><br>' +
          '<small style="color:#075985">' + s.rationale + '</small>';
        list.appendChild(li);
      });
    }
    if (negatives.length > 0) {
      var hr = document.createElement('li');
      hr.style.cssText = 'list-style:none;margin:8px 0 4px;border-top:1px dashed #7dd3fc;padding-top:6px;color:var(--err-fg);font-weight:600';
      hr.textContent = '⚠ 손해 변경 (참고)';
      list.appendChild(hr);
      negatives.slice(0, 3).forEach(function (s) {
        var li = document.createElement('li');
        li.style.cssText = 'list-style:none;color:var(--err-fg);font-size:11px;margin-bottom:2px';
        li.innerHTML = '× ' + s.label + ' → VMG ' + s.delta_vmg.toFixed(1) + 'kt';
        list.appendChild(li);
      });
    }
  }

  var LOWER_SKILLS = { '입문': true, '초급': true, '중급': true };

  function renderEvolution(skill, overpowered, recommended) {
    var box = $('#wso-evolution');
    if (!box) return;
    if (!LOWER_SKILLS[skill] || !overpowered) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    var skillNoun = (skill === '입문') ? '입문' : (skill === '초급' ? '초급' : '중급');
    var sizeTxt = recommended.toFixed(1) + ' m²';
    text('wso-evo-warning', '추천 윙 ' + sizeTxt + ' — ' + skillNoun + ' 라이더에게는 컨트롤 어려움. 강사 도움 권장.');
    html('wso-evo-body',
      '힐 (heel) 자세를 유지하며 큰 윙의 힘을 끌어내는 능력 = 다음 스킬 단계. 이 능력을 갖추면 옵티멀 사이즈 (<b>' + sizeTxt + '</b>) 도전 가능.');
  }

  // ───────── wind sync (main ↔ wso) ─────────
  // PWA 에서는 main wind input 하나만 사용 — sync 필요 X.

  // ───────── reset to defaults ─────────
  function resetDefaults() {
    Object.keys(DEFAULTS).forEach(function (id) {
      var el = $('#' + id);
      if (el) el.value = DEFAULTS[id];
    });
    // radios → defaults
    var defaults = {
      pumping: 'moderate', water_type: 'sea', surface: 'flat', 'wso-pref': 'small'
    };
    Object.keys(defaults).forEach(function (name) {
      var sel = 'input[name="' + name + '"][value="' + defaults[name] + '"]';
      var el = document.querySelector(sel);
      if (el) el.checked = true;
    });
    // selects → first option
    var skillSel = $('#wso-skill');
    if (skillSel) skillSel.value = '상급-선수';
    var presetSel = $('#ci-foil-preset');
    if (presetSel) presetSel.value = '';
    recompute();
    recomputeWSO();
  }

  // ───────── wire up listeners ─────────
  function wire() {
    $$('#calc-form input, #calc-form select').forEach(function (el) {
      el.addEventListener('input', function () { recompute(); recomputeWSO(); });
      el.addEventListener('change', function () { recompute(); recomputeWSO(); });
    });
    var presetSel = $('#ci-foil-preset');
    if (presetSel) presetSel.addEventListener('change', onPresetChange);
    $$('#wso-skill, #wso-mast, #wso-height, #wso-wingar, input[name="wso-pref"]').forEach(function (el) {
      el.addEventListener('input', recomputeWSO);
      el.addEventListener('change', recomputeWSO);
    });
    var resetBtn = $('#btn-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetDefaults);
  }

  // ───────── Service Worker register + status ─────────
  function registerSW() {
    var status = $('#sw-status');
    if (!('serviceWorker' in navigator)) {
      if (status) status.textContent = 'SW 상태: 미지원 (브라우저)';
      return;
    }
    // SW 는 https 또는 localhost 또는 file:// 외에서 동작 — 환경 가드
    if (location.protocol === 'file:') {
      if (status) status.textContent = 'SW 상태: file:// 환경 — 미등록 (호스팅 시 활성화)';
      return;
    }
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(function (reg) {
        if (status) status.textContent = 'SW 상태: 등록 OK · scope ' + (reg.scope || './');
        // 새 SW 발견 시 reload
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (status) status.textContent = 'SW 상태: 새 버전 사용 가능 — 새로고침 시 적용';
            }
          });
        });
      })
      .catch(function (err) {
        if (status) status.textContent = 'SW 상태: 등록 실패 — ' + (err && err.message || err);
        console.warn('[PWA] SW register failed', err);
      });
  }

  // ───────── A2HS (Add to Home Screen) prompt — Android Chrome ─────────
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    // 가벼운 안내: 앱 상단에 작은 install hint 추가 (1회만)
    if (sessionStorage.getItem('a2hs-shown')) return;
    sessionStorage.setItem('a2hs-shown', '1');
    var hint = document.createElement('div');
    hint.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;background:var(--sun);color:var(--navy-deep);padding:12px 16px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:space-between;gap:8px;z-index:100;max-width:540px;margin:0 auto';
    hint.innerHTML = '<span>홈 화면에 설치하시겠어요?</span><button id="a2hs-go" style="padding:8px 14px;border:0;background:var(--navy-deep);color:#fff;border-radius:8px;font-weight:700;cursor:pointer">설치</button><button id="a2hs-x" style="padding:8px 10px;border:0;background:transparent;color:var(--navy-deep);cursor:pointer;font-weight:700">×</button>';
    document.body.appendChild(hint);
    document.getElementById('a2hs-go').addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
      }
      hint.remove();
    });
    document.getElementById('a2hs-x').addEventListener('click', function () {
      hint.remove();
    });
  });

  window.addEventListener('appinstalled', function () {
    console.info('[PWA] installed');
  });

  // ───────── boot ─────────
  function boot() {
    populatePresets();
    wire();
    recompute();
    recomputeWSO();
    registerSW();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
