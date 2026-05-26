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
    // §180-D — Levitaz·Takoon = 단무지 취급 / Chubanga·North = 사용자 보유 포일 입력용
    var groups = [
      ['levitaz', 'Levitaz'],
      ['takoon', 'Takoon'],
      ['chubanga', 'Chubanga · 직접 입력용'],
      ['north', 'North · 직접 입력용']
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
    var gust    = radioVal('wso-gust', 'clean');   // §181-G — 변풍 정도
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
      preference: 'mid',   // §181-G — wingSizeOptimal 은 진단용. 추천은 wingRecommendation(변풍) 사용
      gear_kg: gear
    });

    // §181-F/G (Danny 2026-05-22) — 추천은 풍상 VMG 곡선에서 파생 + 변풍 정도 반영.
    var rec = window.DMJLift.wingRecommendation
      ? window.DMJLift.wingRecommendation({
          v_wind_kt: windKt, m_rider_kg: rider, skill: skill,
          foil_ar: ar, wing_ar: wingAR, gear_kg: gear
        }, { gust: gust })
      : null;
    function fmtWing(v) {
      return (v % 1 === 0) ? v.toFixed(1) : String(Math.round(v * 100) / 100);
    }

    if (r.error || !rec || !rec.feasible) {
      ['wso-min', 'wso-opt'].forEach(function (id) { text(id, '—'); });
      $('#wso-evolution').hidden = true;
      return;
    }

    // 퍼포먼스(곡선 정점, 메인) + practical(변풍 반영 실사용 추천)
    text('wso-opt', fmtWing(rec.performance));
    text('wso-min', fmtWing(rec.practical));
    var GUST_LABEL = {
      clean: { name: '깨끗한 바람', sub: '정점 그대로 — 퍼포먼스와 동일' },
      light: { name: '약간의 변풍', sub: '정점 − 0.5 m² — 다루기 쉬움' },
      heavy: { name: '심한 변풍',   sub: '정점 − 1.0 m² — 컨트롤 우선' }
    };
    var gInfo = GUST_LABEL[rec.gust] || GUST_LABEL.clean;
    if ($('#wso-min-label')) $('#wso-min-label').textContent = '실사용 추천 — ' + gInfo.name;
    if ($('#wso-min-sub')) $('#wso-min-sub').textContent = gInfo.sub;

    // size cap visualization
    var sizeCap = r.size_cap_m2 || 7.4;
    var capMsg = '레이싱 클래스 규정상 max ' + sizeCap + ' m².';
    var capHit = rec.performance > sizeCap - 1e-6;
    ['#wso-min', '#wso-opt'].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      var parent = el.closest('.bracket__cell');
      if (!parent) return;
      if (capHit) {
        parent.setAttribute('title', capMsg);
        parent.classList.add('bracket__cell--capped');
      } else {
        parent.removeAttribute('title');
        parent.classList.remove('bracket__cell--capped');
      }
    });

    // v-limit 3셀 = 퍼포먼스 윙 ±0.5 m² 속도 민감도 (변풍 선택과 무관, 고정 윈도)
    function vlFromUpwind(u) {
      if (!u || u.error) return { feasible: false, kt: 0, vmg_kt: 0, depowered: false,
        tack_angle_deg: 0, beta_deg: 0 };
      return { feasible: !!u.feasible, kt: u.V_boat_kt, vmg_kt: u.V_vmg_kt,
        depowered: !!u.depowered, tack_angle_deg: u.tack_angle_deg, beta_deg: u.beta_deg };
    }
    function upwindAtArea(area) {
      return window.DMJLift.upwindSpeed({
        v_wind_kt: windKt, m_rider_kg: rider, gear_kg: gear, skill: skill,
        foil_ar: ar, wing_area_m2: area, wing_ar: wingAR
      });
    }
    var vUpwindDetail = {
      min: vlFromUpwind(upwindAtArea(rec.performance - 0.5)),
      optimal: vlFromUpwind(rec.performance_detail),
      max: vlFromUpwind(upwindAtArea(rec.performance + 0.5))
    };
    if (vUpwindDetail) {
      var det = vUpwindDetail;
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
      foil_ar: ar, wing_area_m2: rec.performance, wing_ar: wingAR,
      foil_pool: foilPool, current_foil_id: currentFoilId,
      front_wing_area_cm2: currentArea, foil_brand: foilBrand
    });

    // §181 곡선 그래프 — §181-F/G: 마커 = 퍼포먼스 정점 + 변풍 반영 실사용 추천
    renderUpwindCurveGraph(
      { v_wind_kt: windKt, m_rider_kg: rider, gear_kg: gear, skill: skill,
        foil_ar: ar, wing_ar: wingAR },
      { performance: rec.performance, practical: rec.practical, gust: rec.gust,
        size_cap_m2: r.size_cap_m2 || 7.4 }
    );

    // §181-B (Danny 2026-05-21) — heel 각도별 버틸 수 있는 max 윙 그래프
    renderHeelMaxWingGraph(
      { m_rider_kg: rider, gear_kg: gear, v_wind_kt: windKt, skill: skill,
        foil_ar: ar, wing_ar: wingAR, ref_wing_m2: rec.performance },
      { optimal: rec.performance, size_cap_m2: r.size_cap_m2 || 7.4 }
    );

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
    renderEvolution(skill, r.overpowered, rec.performance);
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

  /* §181 (Danny 2026-05-21) — 윙 사이즈별 속도 역U자 곡선 그래프 (SVG)
     입력 p = upwindCurve 인자, rec = { min, optimal, max, size_cap_m2 } */
  var wsoCurveMetric = 'vb';     // 'vb' 보드 속도 | 'vmg'
  var wsoCurveLastArgs = null;   // 토글 재렌더용

  function renderUpwindCurveGraph(p, rec) {
    var wrap = $('#wso-curve-svg');
    var legendEl = $('#wso-curve-legend');
    var captionEl = $('#wso-curve-caption');
    if (!wrap || !window.DMJLift || !window.DMJLift.upwindCurve) return;
    wsoCurveLastArgs = { p: p, rec: rec };

    var A_MIN = 2.5, A_MAX = 8.5, STEP = 0.25;
    var cap = (rec && rec.size_cap_m2) ? rec.size_cap_m2 : 7.4;
    var curve = window.DMJLift.upwindCurve(p, { area_min_m2: A_MIN, area_max_m2: A_MAX, step_m2: STEP });
    var pts = curve.points || [];
    var feas = pts.filter(function (q) { return q.feasible; });

    if (feas.length < 2) {
      wrap.innerHTML = '<p class="wso-curve__empty">현재 입력 조합에서는 풍상으로 진행 가능한 윙 사이즈가 없습니다.<br>풍속을 높이거나 더 효율 좋은 포일을 선택해 보세요.</p>';
      if (legendEl) legendEl.innerHTML = '';
      if (captionEl) captionEl.textContent = '';
      return;
    }

    var metric = wsoCurveMetric;
    function val(q) { return metric === 'vmg' ? q.V_vmg_kt : q.V_boat_kt; }
    var yLabel = (metric === 'vmg') ? 'VMG' : '보드 속도';

    // ── y 범위 (보기 좋은 상한) ──
    var yMax = 1;
    pts.forEach(function (q) { if (val(q) > yMax) yMax = val(q); });
    var yTop = Math.ceil(yMax * 1.14 / 2) * 2;
    if (yTop < 4) yTop = 4;

    // ── SVG 좌표계 ──
    var W = 480, H = 280, mL = 42, mR = 16, mT = 16, mB = 40;
    var pw = W - mL - mR, ph = H - mT - mB;
    function sx(a) { return mL + (a - A_MIN) / (A_MAX - A_MIN) * pw; }
    function sy(v) { return mT + ph - (Math.max(0, v) / yTop) * ph; }
    function f1(n) { return Math.round(n * 10) / 10; }

    var s = [];
    s.push('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="윙 사이즈별 ' + yLabel + ' 곡선">');
    s.push('<rect x="' + mL + '" y="' + mT + '" width="' + pw + '" height="' + ph + '" fill="#fbfcfd" stroke="#E3E8EE"/>');

    // y 격자 + 눈금
    for (var i = 0; i <= 4; i++) {
      var yv = yTop * i / 4, yy = sy(yv);
      s.push('<line x1="' + mL + '" y1="' + f1(yy) + '" x2="' + (mL + pw) + '" y2="' + f1(yy) + '" stroke="#EDF1F5"/>');
      s.push('<text x="' + (mL - 6) + '" y="' + f1(yy + 3) + '" text-anchor="end" font-size="9" fill="#5C6F7E">' + yv.toFixed(0) + '</text>');
    }
    s.push('<text x="13" y="' + (mT + ph / 2) + '" text-anchor="middle" font-size="9" fill="#5C6F7E" transform="rotate(-90 13 ' + (mT + ph / 2) + ')">' + yLabel + ' (kt)</text>');

    // x 눈금 (정수)
    for (var a = 3; a <= 8; a++) {
      var xx = sx(a);
      s.push('<line x1="' + f1(xx) + '" y1="' + (mT + ph) + '" x2="' + f1(xx) + '" y2="' + (mT + ph + 4) + '" stroke="#C8D2DC"/>');
      s.push('<text x="' + f1(xx) + '" y="' + (mT + ph + 16) + '" text-anchor="middle" font-size="9" fill="#5C6F7E">' + a + '</text>');
    }
    s.push('<text x="' + (mL + pw / 2) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="9" fill="#5C6F7E">윙 사이즈 (m²)</text>');

    // §181-F/G — 추천 밴드: 실사용(변풍 반영) ~ 퍼포먼스
    var recPerf = (rec && rec.performance) ? rec.performance : null;
    var recPrac = (rec && rec.practical) ? rec.practical : null;
    if (recPerf && recPrac && recPerf > recPrac) {
      var bx1 = sx(Math.max(A_MIN, recPrac)), bx2 = sx(Math.min(A_MAX, recPerf));
      s.push('<rect x="' + f1(bx1) + '" y="' + mT + '" width="' + f1(bx2 - bx1) + '" height="' + ph + '" fill="#FFB800" fill-opacity="0.14"/>');
    }

    // 레이싱 클래스 상한 (7.4) 점선
    if (cap >= A_MIN && cap <= A_MAX) {
      var cx = sx(cap);
      s.push('<line x1="' + f1(cx) + '" y1="' + mT + '" x2="' + f1(cx) + '" y2="' + (mT + ph) + '" stroke="#8b2014" stroke-width="1.2" stroke-dasharray="4 3"/>');
      s.push('<text x="' + f1(cx - 4) + '" y="' + (mT + ph - 6) + '" text-anchor="end" font-size="8" fill="#8b2014">레이싱 상한 ' + cap + '</text>');
    }

    // 곡선 (영역 채움 + 라인)
    var lineD = '';
    pts.forEach(function (q, idx) {
      lineD += (idx === 0 ? 'M' : 'L') + f1(sx(q.area_m2)) + ' ' + f1(sy(val(q))) + ' ';
    });
    var areaD = lineD + 'L' + f1(sx(pts[pts.length - 1].area_m2)) + ' ' + (mT + ph) +
                ' L' + f1(sx(pts[0].area_m2)) + ' ' + (mT + ph) + ' Z';
    s.push('<path d="' + areaD + '" fill="#1F8FFF" fill-opacity="0.09"/>');
    s.push('<path d="' + lineD + '" fill="none" stroke="#0A2540" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>');

    // 마커 helper
    function dot(area, value, color, label, labelAbove) {
      var x = sx(Math.max(A_MIN, Math.min(A_MAX, area))), y = sy(value);
      var g = '';
      g += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="5" fill="' + color + '" stroke="#fff" stroke-width="1.8"/>';
      if (label) {
        var ly = labelAbove ? (y - 11) : (y + 19);
        var tw = label.length * 6.0 + 8;
        var lx = Math.max(mL + tw / 2, Math.min(mL + pw - tw / 2, x));
        g += '<rect x="' + f1(lx - tw / 2) + '" y="' + f1(ly - 9) + '" width="' + f1(tw) + '" height="14" rx="3" fill="' + color + '"/>';
        g += '<text x="' + f1(lx) + '" y="' + f1(ly + 1.5) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">' + label + '</text>';
      }
      return g;
    }
    function ptValAt(area) {
      var best = null, bd = 99;
      pts.forEach(function (q) { var d = Math.abs(q.area_m2 - area); if (d < bd) { bd = d; best = q; } });
      return best;
    }

    var peak = curve.optimum;
    // §181-F/G — 마커: 퍼포먼스(곡선 정점) + 변풍 반영 실사용 추천.
    //   깨끗한 바람(둘이 같음)이면 마커 1개만 표시.
    function fmtM(v) { return (v % 1 === 0) ? v.toFixed(1) : String(Math.round(v * 100) / 100); }
    var perfPt = recPerf ? ptValAt(recPerf) : peak;
    var pracPt = recPrac ? ptValAt(recPrac) : null;
    var twoMarkers = recPerf && recPrac && Math.abs(recPerf - recPrac) > 0.01;
    if (twoMarkers && pracPt) s.push(dot(recPrac, val(pracPt), '#1F8FFF', '실사용 ' + fmtM(recPrac), false));
    if (perfPt) s.push(dot(recPerf || perfPt.area_m2, val(perfPt), '#0A2540', '퍼포먼스 ' + fmtM(recPerf || perfPt.area_m2), true));

    s.push('</svg>');
    wrap.innerHTML = s.join('');

    // ── 범례 ──
    if (legendEl) {
      var lg = [];
      lg.push('<span><i style="background:#0A2540"></i>속도 곡선</span>');
      lg.push('<span><i style="background:#0A2540;border-radius:50%;width:10px;height:10px;border-top:0"></i>퍼포먼스 추천 (곡선 정점)</span>');
      if (twoMarkers) {
        lg.push('<span><i style="background:#FFB800;opacity:0.5"></i>실사용~퍼포먼스 범위</span>');
        lg.push('<span><i style="background:#1F8FFF;border-radius:50%;width:10px;height:10px;border-top:0"></i>실사용 추천 (변풍 반영)</span>');
      }
      lg.push('<span style="color:#8b2014"><i class="dash"></i>레이싱 클래스 상한 ' + cap + ' m²</span>');
      legendEl.innerHTML = lg.join('');
    }

    // ── 캡션 (곡선 모양 자동 설명) ──
    if (captionEl) {
      var firstFeas = feas[0], lastFeas = feas[feas.length - 1];
      var peakV = peak ? val(peak) : 0;
      var endV = val(lastFeas);
      var dropFromPeak = peakV - endV;
      var risingToEnd = peak && (peak.area_m2 >= lastFeas.area_m2 - 0.3);
      var fallingFromStart = peak && (peak.area_m2 <= firstFeas.area_m2 + 0.3);
      var txt;
      if (!risingToEnd && !fallingFromStart && dropFromPeak >= 0.3) {
        txt = '<b>역U자 곡선</b> — 윙을 키우면 끄는 힘이 늘어 속도가 오르지만, '
            + '약 ' + peak.area_m2.toFixed(1) + ' m² 를 넘으면 윙 자체 저항이 커져 다시 느려집니다. '
            + '이 조합의 최고 속도 지점은 약 <b>' + peak.area_m2.toFixed(1) + ' m²</b> 입니다.';
      } else if (fallingFromStart) {
        txt = '바람이 강해 <b>작은 윙일수록 빠릅니다</b> — 큰 윙은 라이더가 다 받쳐내지 못해 오히려 느려집니다.';
      } else {
        txt = '이 조합에서는 <b>윙을 키울수록 속도가 오릅니다</b> — 라이더·바람 조건상 사용 가능한 범위 안에서는 과출력 정점이 나타나지 않습니다. '
            + '실제 사이즈는 컨트롤·이착수 편의를 고려해 추천 범위에서 고르세요.';
      }
      captionEl.innerHTML = txt;
    }
  }

  /* §181 — 곡선 그래프 보드 속도 ↔ VMG 토글 */
  (function () {
    var tg = $('#wso-curve-toggle');
    if (!tg) return;
    tg.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-metric]');
      if (!btn) return;
      wsoCurveMetric = btn.getAttribute('data-metric');
      tg.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });
      if (wsoCurveLastArgs) renderUpwindCurveGraph(wsoCurveLastArgs.p, wsoCurveLastArgs.rec);
    });
  })();

  /* §181-B (Danny 2026-05-21) — heel 각도별 버틸 수 있는 max 윙 사이즈 그래프 (SVG)
     입력 p = heelMaxWingCurve 인자, rec = { optimal, size_cap_m2 } */
  function renderHeelMaxWingGraph(p, rec) {
    var wrap = $('#wso-heelcurve-svg');
    var legendEl = $('#wso-heelcurve-legend');
    var captionEl = $('#wso-heelcurve-caption');
    if (!wrap || !window.DMJLift || !window.DMJLift.heelMaxWingCurve) return;

    var curve = window.DMJLift.heelMaxWingCurve(p, { deg_min: 0, deg_max: 45, step_deg: 1 });
    if (curve.error) {
      wrap.innerHTML = '<p class="wso-curve__empty">입력값을 확인해 주세요.</p>';
      if (legendEl) legendEl.innerHTML = '';
      if (captionEl) captionEl.textContent = '';
      return;
    }
    var pts = curve.points, marks = curve.skill_marks || [];
    var curSkill = String(p.skill || '중급');
    var cap = (rec && rec.size_cap_m2) ? rec.size_cap_m2 : 7.4;

    // y 상한 — 곡선 max 와 cap 둘 다 보이게
    var yMaxData = pts[pts.length - 1].max_wing_m2;
    var yTop = Math.ceil(Math.max(yMaxData, cap) * 1.12 / 2) * 2;
    if (yTop < 4) yTop = 4;

    var W = 480, H = 280, mL = 42, mR = 16, mT = 16, mB = 40;
    var pw = W - mL - mR, ph = H - mT - mB;
    var D_MIN = 0, D_MAX = 45;
    function sx(d) { return mL + (d - D_MIN) / (D_MAX - D_MIN) * pw; }
    function sy(v) { return mT + ph - (Math.max(0, v) / yTop) * ph; }
    function f1(n) { return Math.round(n * 10) / 10; }

    var s = [];
    s.push('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="heel 각도별 버틸 수 있는 max 윙 사이즈 곡선">');
    s.push('<rect x="' + mL + '" y="' + mT + '" width="' + pw + '" height="' + ph + '" fill="#fbfcfd" stroke="#E3E8EE"/>');

    // y 격자 + 눈금
    for (var i = 0; i <= 4; i++) {
      var yv = yTop * i / 4, yy = sy(yv);
      s.push('<line x1="' + mL + '" y1="' + f1(yy) + '" x2="' + (mL + pw) + '" y2="' + f1(yy) + '" stroke="#EDF1F5"/>');
      s.push('<text x="' + (mL - 6) + '" y="' + f1(yy + 3) + '" text-anchor="end" font-size="9" fill="#5C6F7E">' + yv.toFixed(0) + '</text>');
    }
    s.push('<text x="13" y="' + (mT + ph / 2) + '" text-anchor="middle" font-size="9" fill="#5C6F7E" transform="rotate(-90 13 ' + (mT + ph / 2) + ')">버틸 수 있는 max 윙 (m²)</text>');

    // x 눈금 (heel 각도)
    [0, 10, 20, 30, 40].forEach(function (d) {
      var xx = sx(d);
      s.push('<line x1="' + f1(xx) + '" y1="' + (mT + ph) + '" x2="' + f1(xx) + '" y2="' + (mT + ph + 4) + '" stroke="#C8D2DC"/>');
      s.push('<text x="' + f1(xx) + '" y="' + (mT + ph + 16) + '" text-anchor="middle" font-size="9" fill="#5C6F7E">' + d + '°</text>');
    });
    s.push('<text x="' + (mL + pw / 2) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="9" fill="#5C6F7E">heel (기댐) 각도</text>');

    // 레이싱 클래스 상한 (7.4) 수평 점선
    if (cap <= yTop) {
      var cy = sy(cap);
      s.push('<line x1="' + mL + '" y1="' + f1(cy) + '" x2="' + (mL + pw) + '" y2="' + f1(cy) + '" stroke="#8b2014" stroke-width="1.2" stroke-dasharray="4 3"/>');
      s.push('<text x="' + (mL + pw - 3) + '" y="' + f1(cy - 4) + '" text-anchor="end" font-size="8" fill="#8b2014">레이싱 상한 ' + cap + ' m²</text>');
    }

    // 곡선 (영역 채움 + 라인)
    var lineD = '';
    pts.forEach(function (q, idx) {
      lineD += (idx === 0 ? 'M' : 'L') + f1(sx(q.heel_deg)) + ' ' + f1(sy(q.max_wing_m2)) + ' ';
    });
    var areaD = lineD + 'L' + f1(sx(pts[pts.length - 1].heel_deg)) + ' ' + (mT + ph) +
                ' L' + f1(sx(pts[0].heel_deg)) + ' ' + (mT + ph) + ' Z';
    s.push('<path d="' + areaD + '" fill="#1F8FFF" fill-opacity="0.09"/>');
    s.push('<path d="' + lineD + '" fill="none" stroke="#0A2540" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>');

    // 스킬별 heel 각도 마커 — 비현재 스킬은 작은 흰 점, 현재 스킬은 강조 + 라벨
    var curMark = null;
    marks.forEach(function (mk) {
      if (mk.skill === curSkill) { curMark = mk; return; }
      var x = sx(mk.heel_deg), y = sy(mk.max_wing_m2);
      s.push('<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="3.2" fill="#fff" stroke="#5C6F7E" stroke-width="1.4"/>');
    });
    if (curMark) {
      var cx2 = sx(curMark.heel_deg), cy2 = sy(curMark.max_wing_m2);
      s.push('<circle cx="' + f1(cx2) + '" cy="' + f1(cy2) + '" r="5.5" fill="#0A2540" stroke="#fff" stroke-width="1.8"/>');
      var lbl = curMark.skill + ' ' + curMark.heel_deg + '° · ' + curMark.max_wing_m2.toFixed(1) + ' m²';
      var tw = lbl.length * 6.2 + 10;
      var lx = Math.max(mL + tw / 2, Math.min(mL + pw - tw / 2, cx2));
      var ly = cy2 - 12;
      s.push('<rect x="' + f1(lx - tw / 2) + '" y="' + f1(ly - 9) + '" width="' + f1(tw) + '" height="14" rx="3" fill="#0A2540"/>');
      s.push('<text x="' + f1(lx) + '" y="' + f1(ly + 1.5) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">' + lbl + '</text>');
    }

    s.push('</svg>');
    wrap.innerHTML = s.join('');

    // ── 범례 ──
    if (legendEl) {
      legendEl.innerHTML =
        '<span><i style="background:#0A2540"></i>버틸 수 있는 max 윙</span>'
        + '<span><i style="background:#0A2540;border-radius:50%;width:10px;height:10px;border-top:0"></i>현재 스킬</span>'
        + '<span><i style="background:#fff;border:1.4px solid #5C6F7E;border-radius:50%;width:9px;height:9px"></i>다른 스킬 등급</span>'
        + '<span style="color:#8b2014"><i class="dash"></i>레이싱 클래스 상한 ' + cap + ' m²</span>';
    }

    // ── 캡션 ──
    if (captionEl) {
      var cm = curMark || marks[0];
      var maxW = cm ? cm.max_wing_m2 : 0;
      var txt = 'heel(기댐) 각도 = 라이더가 바람 반대쪽으로 기대는 각도. 클수록 윙의 측면 견인력을 더 버틸 수 있어 '
              + '<b>더 큰 윙</b>이 가능합니다. 현재 스킬 <b>' + (cm ? cm.skill : '') + ' ' + (cm ? cm.heel_deg : '') + '°</b> 기준 '
              + '버틸 수 있는 윙은 약 <b>' + maxW.toFixed(1) + ' m²</b> 입니다.';
      if (rec && rec.optimal) {
        if (rec.optimal > maxW + 0.1) {
          txt += ' 추천 사이즈 ' + rec.optimal.toFixed(1) + ' m² 가 이 한계를 넘어 — 강풍에서 과출력(컨트롤 어려움) 영역입니다.';
        } else {
          txt += ' 추천 사이즈 ' + rec.optimal.toFixed(1) + ' m² 는 한계 안에 있습니다.';
        }
      }
      txt += '<br><span style="color:#5C6F7E">스킬별 heel: 입문 9° / 초급 19° / 중급 29° / 상급 39° / 상급-선수 41° / 선수 42°</span>';
      captionEl.innerHTML = txt;
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
      pumping: 'moderate', water_type: 'sea', surface: 'flat', 'wso-gust': 'clean'
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
    $$('#wso-skill, #wso-mast, #wso-height, #wso-wingar, input[name="wso-gust"]').forEach(function (el) {
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
