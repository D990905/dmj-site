/* ============================================================
 * app.js — UI 오케스트레이션 (라이딩 통계 대시보드 Phase 1)
 * 업로드 → 파싱 → 분석 → 렌더. 풍향·단위·세션 저장 처리.
 * ============================================================ */
(function () {
  'use strict';

  var Geo = window.RDGeo, Gpx = window.RDGpx, Vkx = window.RDVkx, Csv = window.RDCsv, An = window.RDAnalysis;
  var Storage = window.RDStorage, Charts = window.RDCharts;
  /* §430 — 다중 파일 자동 융합 */
  var Merger = window.RDSessionMerger, RaceboxCSV = window.RDRaceboxCSV;
  var KT = Geo.MS_TO_KNOTS;

  /* i18n 변환 헬퍼 — 동적 보간 문자열을 영어 모드에서 영어로.
     RDI18n 미로드 시 한국어 원문(폴백). */
  function i18nT(k, v) {
    return (window.RDI18n && window.RDI18n.T) ? window.RDI18n.T(k, v) : k;
  }

  /* 지원 스포츠 6종 (Vantage sport type 참고) */
  var SPORTS = {
    wingfoil:    { label: '윙포일',        foiling: true },
    windsurf:    { label: '윈드서핑',      foiling: false },
    windfoil:    { label: '윈드포일',      foiling: true },
    formulakite: { label: '포뮬라 카이트', foiling: true },
    kite:        { label: '카이트',        foiling: false },
    iqfoil:      { label: 'iQFOiL',        foiling: true }
  };
  var SPORT_ORDER = ['wingfoil', 'windsurf', 'windfoil', 'formulakite', 'kite', 'iqfoil'];

  /* 스킬 등급 — lift-calculator(ETA_BY_SKILL / TACK_ANGLE_DEG) 와 동일 키.
     표시 순서는 입문 → 선수 (상급-선수는 상급·선수 사이). */
  var SKILL_ORDER = ['입문', '초급', '중급', '상급', '상급-선수', '선수'];

  var state = {
    parsed: null, gpxText: null, session: null, fullSession: null, analysis: null,
    windDir: null, windSpeedKt: null,
    sport: 'wingfoil', unit: 'kt',
    selectedManeuvers: [],
    /* sessionName = 헤더에 표시되는 실제 제목(사용자 편집 반영).
       autoSessionName = 파일명·트랙명에서 자동 생성한 기본 제목 —
       사용자가 제목을 비우면 이 값으로 되돌아간다. */
    sessionName: '라이딩 세션', autoSessionName: '라이딩 세션',
    selectedRun: null,          // 선택된 고속 구간 인덱스 — 지도 트랙 강조용
    windSourcesCollapsed: false, // 풍향 추정 소스 패널 접힘 상태
    editState: null, sessionSig: '', windPending: null,
    /* §423 — cloud 기록상 영상이 있던 세션인지(_hasVideo) + 그 세션의 저장
       시각. 다른 기기에서 cloud 로 불러온 세션은 영상이 local 에만 있어
       이 기기엔 없으므로, 리플레이에서 '영상 없음' 안내 배너의 판정에 쓴다. */
    sessionHasVideoFlag: false, sessionRemoteDateEpoch: null,
    /* 권장 풍향이 자동 적용됐는지 — 자동 적용 시 { windDir, confidence,
       sourceId }, 수동 확정·미설정이면 null. 풍향 소스 패널이 이 값을 보고
       자동 추정값을 '수동 확정'으로 오표시하지 않도록 한다 (§422). */
    windAutoApplied: null,
    maneuverFilter: 'all', maneuverShowAll: false,
    timeAxisMode: 'elapsed',
    /* 심박 추이 차트에 속도 곡선을 우축으로 겹쳐 보일지 — 기본 false
       (심박만 보이는 깔끔한 뷰). 카드 헤더 '라이딩 오버랩' 토글로
       on/off (Danny 2026-05-27 §175). */
    hrShowSpeed: false,
    violinMetric: 'sog', violinWind: 'upwind', violinPop: 'all',
    /* 세션 비교 그래프 — 3분리 → 1통합 (Danny 2026-05-23 §C).
       progMetrics = 표시할 지표(중복 선택), progChartType = 막대/선. */
    progMetrics: ['avgSpeed', 'maxSpeed'], progChartType: 'line',
    /* 라이더·장비 (VPS·Coach Danny 입력) — Storage 에서 마지막 값 복원.
       maxHr = 심박 존 분석용 최대 심박수(bpm). null 이면 세션 관측
       최대값을 기본으로 쓴다. 한 번 입력하면 다음 세션에 자동 적용. */
    rider: { weightKg: null, skill: '중급', wingM2: null, foilAR: null, maxHr: null },
    vps: null, whatif: null,
    /* skillHr = computeSkillHr 결과 — 스킬-심박수 분석 카드용. 저장 시
       세션 회복 지수를 레코드에 함께 담아 장기 추세에 쓴다. */
    skillHr: null
  };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 단위·포맷 헬퍼 ---------- */
  function unitLabel() { return state.unit === 'kmh' ? 'km/h' : 'kt'; }
  function toSpeed(ms) { return state.unit === 'kmh' ? ms * 3.6 : ms * KT; }
  function fmtSpeed(ms, dec) { return toSpeed(ms).toFixed(dec == null ? 1 : dec); }
  function fmtSpeedU(ms, dec) { return fmtSpeed(ms, dec) + ' ' + unitLabel(); }
  function fmtDist(m) {
    return m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m';
  }
  function fmtDur(s) {
    s = Math.max(0, Math.round(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    if (h > 0) return h + 'hr ' + m + 'min';
    return m + 'min ' + ss + 'sec';
  }
  /* KPI 타일·hero 전용 컴팩트 시간 표기 (Layer 2.0 — Danny 2026-05-26).
     공백을 없애 큰 폰트가 줄바꿈되는 문제 해결. 라벨에 (min:sec) 표시가
     있어 의미가 모호하지 않다. h:mm:ss · mm:ss 콜론 형식. */
  function fmtDurCompact(s) {
    s = Math.max(0, Math.round(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    if (h > 0) return h + ':' + pad(m) + ':' + pad(ss);
    return m + ':' + pad(ss);
  }
  function mmss(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }
  /* 속도 시계열 X축 표기 — 경과 시간 또는 실제(시계) 시각 */
  function fmtTimeAxis(tSec) {
    if (state.timeAxisMode === 'clock' && state.session && state.session.startEpoch) {
      var d = new Date(state.session.startEpoch + tSec * 1000);
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    return mmss(tSec);
  }
  function fmtDate(ep) {
    if (!ep) return i18nT('날짜 정보 없음');
    var d = new Date(ep);
    var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
    /* §410 — 영문 모드면 EN 날짜 포맷(요일 약어 포함). 한글 요일 '(화)' 가
       텍스트노드에 합쳐져 DOM 번역이 못 닿던 잔존을 빌드 시점에 EN 으로. */
    if (window.RDI18n && window.RDI18n.getLang && window.RDI18n.getLang() === 'en') {
      var EN_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var EN_MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return EN_MO[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() +
             ' (' + EN_WD[d.getDay()] + ') ' + hh + ':' + mm;
    }
    var wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() +
           '. (' + wd + ') ' + hh + ':' + mm;
  }
  function compass(deg) {
    var dirs = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
    /* §410 — 영문 모드면 8방위를 EN 약어(N·NE·…)로. MAP 에 한↔영 8방위가
       모두 있어 i18nT 로 변환 — '212° 남서' 처럼 노드가 합쳐져도 빌드 시 EN. */
    return i18nT(dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8]);
  }
  /* 실제(시계) 시각 HH:MM:SS — 세션 시작 epoch 기준 */
  function fmtClock(tSec) {
    if (state.session && state.session.startEpoch) {
      var d = new Date(state.session.startEpoch + tSec * 1000);
      return ('0' + d.getHours()).slice(-2) + ':' +
             ('0' + d.getMinutes()).slice(-2) + ':' +
             ('0' + d.getSeconds()).slice(-2);
    }
    return mmss(tSec);
  }
  /* 풍향 기준 좌현(P)/우현(S) 약식 라벨.
     §420 (옥대표님 verbatim 2026-06-12, Vantage 비교) — heading 이 풍축
     기준 시계방향 (angleDiff > 0) = Port tack (좌현 풍). Larsson 2022 ch.7
     + ISAF Racing Rules definition. DO_NOT_REVERT §420. */
  function sideShort(heading) {
    if (state.windDir == null || heading == null) return '–';
    return Geo.angleDiff(state.windDir, heading) >= 0 ? 'P' : 'S';
  }
  /* 회전 방향 — 풍향 있으면 P→S / S→P, 없으면 좌·우선회 */
  function maneuverDir(m) {
    if (state.windDir == null) {
      return m.turnDir === 'starboard' ? '우선회' : '좌선회';
    }
    return sideShort(m.headingBefore) + '→' + sideShort(m.headingAfter);
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 초기화 ---------- */
  function init() {
    buildSportChips();
    buildSportSelect();

    // 라이더·장비 프로필 복원 (이전 입력 자동 채움 — 재입력 회피)
    var savedRider = Storage.loadRider();
    if (savedRider) {
      state.rider = {
        weightKg: (savedRider.weightKg != null) ? savedRider.weightKg : null,
        skill: savedRider.skill || '중급',
        wingM2: (savedRider.wingM2 != null) ? savedRider.wingM2 : null,
        foilAR: (savedRider.foilAR != null) ? savedRider.foilAR : null,
        maxHr: (savedRider.maxHr != null) ? savedRider.maxHr : null
      };
    }

    var dz = $('drop-zone'), fi = $('file-input');
    dz.addEventListener('click', function () { fi.click(); });
    dz.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); }
    });
    dz.addEventListener('dragover', function (e) {
      e.preventDefault(); dz.classList.add('is-over');
    });
    dz.addEventListener('dragleave', function () { dz.classList.remove('is-over'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); dz.classList.remove('is-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });
    fi.addEventListener('change', function () {
      if (fi.files && fi.files.length) handleFiles(fi.files);
    });

    $('sample-btn').addEventListener('click', loadSample);
    $('new-file-btn').addEventListener('click', resetToIntro);
    $('save-session-btn').addEventListener('click', saveCurrentSession);

    /* PDF 보고서 — 클릭 시 lazy load → 9 페이지 PDF 생성 + 미리보기 모달.
       §178 (Danny 2026-05-27): 즉시 다운로드/공유 대신 미리보기 모달
       을 띄워 사용자가 내용 확인 후 모달 내 버튼으로 직접 다운로드/공유.
       모바일 Web Share API 지원 시 모달의 '공유' 버튼이 자동 활성화된다. */
    var pdfBtn = $('pdf-export-btn');
    if (pdfBtn && window.RDPdfExport) {
      pdfBtn.textContent = '📄 ' + i18nT('PDF 미리보기');
      pdfBtn.setAttribute('aria-label', i18nT('PDF 보고서 미리보기'));
      pdfBtn.addEventListener('click', function () {
        if (pdfBtn.disabled) return;
        pdfBtn.disabled = true;
        var origText = pdfBtn.textContent;
        pdfBtn.textContent = (window.RDI18n && window.RDI18n.T)
          ? window.RDI18n.T('생성 중…') : '생성 중…';
        window.RDPdfExport.generate({ preview: true })
          .catch(function (e) { console.warn('PDF export failed:', e); })
          .then(function () {
            pdfBtn.disabled = false;
            pdfBtn.textContent = origText;
          });
      });
    }

    /* 세션 제목 인라인 편집 — 제목 클릭·✎ 아이콘으로 진입,
       Enter·blur 저장, Esc 취소 */
    var titleH2 = $('session-title'), titleInp = $('session-title-input'),
        titleBtn = $('session-title-edit-btn');
    if (titleH2) {
      titleH2.addEventListener('click', beginTitleEdit);
      titleH2.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault(); beginTitleEdit();
        }
      });
    }
    if (titleBtn) titleBtn.addEventListener('click', beginTitleEdit);
    if (titleInp) {
      titleInp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commitTitleEdit(); }
        else if (e.key === 'Escape' || e.key === 'Esc') {
          e.preventDefault(); cancelTitleEdit();
        }
      });
      titleInp.addEventListener('blur', commitTitleEdit);
    }
    $('clear-sessions-btn').addEventListener('click', function () {
      if (confirm('저장된 모든 세션을 삭제할까요?')) {
        /* §415-del — clearAll 전에 id 를 모아 cloud 에서도 각각 삭제 */
        var delIds = (Storage.listSessions() || []).map(function (s) { return s.id; });
        Storage.clearAll();
        delIds.forEach(function (id) { deleteSessionFromCloud(id); });
        renderSavedSessions();
      }
    });

    // 단위 토글
    $('unit-toggle').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.unit = b.getAttribute('data-unit');
      Array.prototype.forEach.call(this.children, function (c) {
        c.classList.toggle('is-active', c === b);
      });
      if (state.analysis) renderDashboard();
    });

    // 스포츠 선택 (대시보드)
    $('session-sport-select').addEventListener('change', function () {
      state.sport = this.value;
      if (state.analysis) { renderSummaryStrip(); renderRunsHint(); }
    });

    // 풍향 컨트롤 · 트랙 편집
    buildWindArrows();
    wireWindControls();
    wireRiderControls();
    $('edit-reset-btn').addEventListener('click', resetEdit);
    $('edit-save-btn').addEventListener('click', saveEditedCopy);

    // 정보(i) 토글 — VPS 산출 방식 설명 패널
    document.addEventListener('click', function (e) {
      var ib = e.target.closest('.info-btn');
      if (!ib) return;
      var card = ib.closest('.card');
      var panel = card ? card.querySelector('.info-panel') : null;
      if (panel) panel.hidden = !panel.hidden;
    });

    /* ⓘ(tip-label) 정의 팝오버 — title 속성 툴팁은 hover 에서만 떠서
       클릭하면 아무 반응이 없었다(Danny 검토). tip-label 을 클릭하면
       정의를 팝오버로 띄우고, 같은 ⓘ 재클릭·바깥 클릭·스크롤 시 닫는다. */
    var tipPop = document.createElement('div');
    tipPop.className = 'tip-popover';
    tipPop.hidden = true;
    document.body.appendChild(tipPop);
    function hideTipPop() { tipPop.hidden = true; tipPop._anchor = null; }
    document.addEventListener('click', function (e) {
      var label = e.target.closest ? e.target.closest('.tip-label') : null;
      if (!label) { hideTipPop(); return; }            // 바깥 클릭 → 닫기
      if (!tipPop.hidden && tipPop._anchor === label) { // 같은 ⓘ 재클릭 → 닫기
        hideTipPop(); return;
      }
      var tip = label.getAttribute('data-tip') || label.getAttribute('title') || '';
      if (!tip) { hideTipPop(); return; }
      tipPop._anchor = label;
      tipPop.textContent = tip;
      tipPop.hidden = false;
      // 라벨 아래에 배치 — 화면 경계 안으로 클램프, 아래가 좁으면 위로
      var r = label.getBoundingClientRect();
      var pw = tipPop.offsetWidth, ph = tipPop.offsetHeight;
      var x = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left));
      var y = r.bottom + 7;
      if (y + ph > window.innerHeight - 8) y = Math.max(8, r.top - ph - 7);
      tipPop.style.left = x + 'px';
      tipPop.style.top = y + 'px';
    });
    window.addEventListener('scroll', hideTipPop, true);
    window.addEventListener('resize', hideTipPop);

    // 택킹/자이빙 목록 필터 + 자세히
    $('mv-filter').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.maneuverFilter = b.getAttribute('data-mvf');
      state.maneuverShowAll = false;
      renderManeuverTable();
    });
    $('mv-detail-toggle').addEventListener('click', function () {
      state.maneuverShowAll = !state.maneuverShowAll;
      renderManeuverTable();
    });

    // 속도/심박 시계열 X축 — 경과 시간 / 실제 시간 토글.
    // 트랙편집 카드와 심박 추이 카드 두 곳에 동일한 토글 UI 가 있고,
    // 둘 다 같은 state.timeAxisMode 를 갱신한 뒤 두 차트를 다시 그린다.
    function setTimeAxisMode(mode) {
      state.timeAxisMode = mode;
      ['time-axis-toggle', 'hr-time-axis-toggle'].forEach(function (id) {
        var box = $(id); if (!box) return;
        Array.prototype.forEach.call(box.children, function (c) {
          c.classList.toggle('is-active', c.getAttribute('data-tmode') === mode);
        });
      });
      if (state.analysis) {
        renderSpeedChart();
        if (state.analysis.hr && state.analysis.hr.hasHR) renderHrZonesAndTrend();
      }
    }
    function bindTimeAxisToggle(id) {
      var box = $(id); if (!box) return;
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        setTimeAxisMode(b.getAttribute('data-tmode'));
      });
    }
    bindTimeAxisToggle('time-axis-toggle');
    bindTimeAxisToggle('hr-time-axis-toggle');

    // 라이딩 오버랩 토글 — 심박만 ↔ 속도 우축 overlay (Danny 2026-05-27 §175)
    function setHrOverlayMode(mode) {
      state.hrShowSpeed = (mode === 'overlay');
      var box = $('hr-overlay-toggle');
      if (box) {
        Array.prototype.forEach.call(box.children, function (c) {
          c.classList.toggle('is-active', c.getAttribute('data-omode') === mode);
        });
      }
      // hint 텍스트도 모드에 맞춰 갱신 — '우측 축 = 속도' 안내는 오버랩일 때만
      var hint = $('hr-trend-hint');
      if (hint) {
        hint.textContent = state.hrShowSpeed
          ? '배경 띠 = 심박 존 · 우측 축 = 속도 · 그래프 클릭 시 지도가 그 시점으로 이동'
          : '배경 띠 = 심박 존 · 그래프 클릭 시 지도가 그 시점으로 이동';
      }
      if (state.analysis && state.analysis.hr && state.analysis.hr.hasHR) {
        renderHrZonesAndTrend();
      }
    }
    var overlayBox = $('hr-overlay-toggle');
    if (overlayBox) {
      overlayBox.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        setHrOverlayMode(b.getAttribute('data-omode'));
      });
    }

    // 심박수 — 최대 심박수 입력 → 존 분포·추이 배경 띠·%HRmax 재계산.
    // 라이더 프로필에 저장돼 다음 세션에 자동 적용된다(재입력 회피).
    var hrMaxEl = $('hr-maxhr-input');
    if (hrMaxEl) {
      hrMaxEl.addEventListener('input', debounce(function () {
        var v = parseInt($('hr-maxhr-input').value, 10);
        state.rider.maxHr = (isFinite(v) && v >= 100 && v <= 240) ? v : null;
        Storage.saveRider(state.rider);
        if (state.analysis && state.analysis.hr && state.analysis.hr.hasHR) {
          renderHrSummaryStrip(state.analysis.hr);
          renderHrZonesAndTrend();
        }
      }, 280));
    }

    // 바이올린 — 풍상/풍하 토글
    $('violin-wind-toggle').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.violinWind = b.getAttribute('data-vwind');
      Array.prototype.forEach.call(this.children, function (c) {
        c.classList.toggle('is-active', c === b);
      });
      if (state.analysis) renderViolin();
    });
    // 바이올린 — 지표(SOG/VMG/TWA) 토글
    $('violin-metric-toggle').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.violinMetric = b.getAttribute('data-vmetric');
      Array.prototype.forEach.call(this.children, function (c) {
        c.classList.toggle('is-active', c === b);
      });
      if (state.analysis) renderViolin();
    });
    // 바이올린 — 모집단(전체/상위 50%/상위 20%) 토글.
    // 겹쳐 그리지 않고, 선택한 모집단의 분포·평균만 본다.
    $('violin-pop-toggle').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.violinPop = b.getAttribute('data-vpop');
      Array.prototype.forEach.call(this.children, function (c) {
        c.classList.toggle('is-active', c === b);
      });
      if (state.analysis) renderViolin();
    });

    // 세션 비교 — 지표 다중선택 드롭다운 (Danny 2026-05-23 §C).
    // 체크박스 토글 → state.progMetrics 갱신 후 통합 그래프 다시 그림.
    var progSel = $('prog-metric-select');
    if (progSel) {
      progSel.addEventListener('change', function (e) {
        var cb = e.target.closest('input[data-pmetric]');
        if (!cb) return;
        var key = cb.getAttribute('data-pmetric');
        var arr = state.progMetrics.slice();
        var at = arr.indexOf(key);
        if (cb.checked && at < 0) arr.push(key);
        else if (!cb.checked && at >= 0) arr.splice(at, 1);
        /* 지표 순서를 체크박스 DOM 순서로 고정 — 범례·축 순서 안정 */
        var order = ['avgSpeed', 'maxSpeed', 'distance', 'time', 'hrRecovery'];
        arr.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
        state.progMetrics = arr;
        updateProgMetricSummary();
        renderProgressionChart();
      });
    }
    // 세션 비교 — 막대/선 차트 타입 토글
    var progType = $('prog-type-toggle');
    if (progType) {
      progType.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        state.progChartType = b.getAttribute('data-ptype');
        Array.prototype.forEach.call(this.children, function (c) {
          c.classList.toggle('is-active', c === b);
        });
        renderProgressionChart();
      });
    }

    // GPS 트랙 전체화면
    $('map-fs-btn').addEventListener('click', enterMapFullscreen);
    $('map-fs-close').addEventListener('click', exitMapFullscreen);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') exitMapFullscreen();
    });

    // 라이딩 리플레이 (지도·영상 동기 재생)
    $('replay-btn').addEventListener('click', enterReplay);
    window.addEventListener('resize', debounce(function () {
      if (!state.analysis) return;
      renderTargetPolar();
      renderViolin();
      Charts.sizeCrosshair();
      // 풍향 그리드 캔버스도 새 지도 크기에 맞춰 다시 그린다
      resizeWindGrid();
      WG.deg = currentWindGridDeg();
      if (!WG.glintRaf) drawWindGrid(WG.deg, 0);
    }, 200));

    renderSavedSessions();

    // ?demo — 샘플 데이터 자동 로드 (공유용 딥링크)
    // ?demo&wind=270 처럼 풍향을 함께 지정할 수도 있다.
    if (/[?&]demo\b/i.test(location.search)) {
      setTimeout(function () {
        loadSample();
        var wm = location.search.match(/[?&]wind=(\d+)/);
        if (wm) { setWindPending(parseInt(wm[1], 10)); confirmWind(); }
      }, 50);
    }

    // §415 (Alex Park #4 · 2026-06-10) — ?session=<id> URL parameter handler.
    // profile.html '최근 라이딩' row click (§411) — cross-page URL navigate 시
    // 세션 자동 load. app.js 의 [data-load] global click handler 는 같은 도메인
    // inline click 처리, 본 handler 가 진입 시점 URL parameter 처리.
    // 매칭 X 또는 load 실패 시 인트로 화면 그대로 (showError 가 안내).
    var sessMatch = location.search.match(/[?&]session=([A-Za-z0-9_-]+)/);
    if (sessMatch) {
      pendingDeepLinkSession = sessMatch[1];   /* §415 — cloud pull 후 재시도용 */
      setTimeout(function () { loadSavedSession(sessMatch[1]); }, 50);
    }
  }

  function buildSportChips() {
    var box = $('sport-chips');
    box.innerHTML = SPORT_ORDER.map(function (k) {
      return '<label class="sport-chip' + (k === state.sport ? ' is-active' : '') + '">' +
        '<input type="radio" name="sport" value="' + k + '"' +
        (k === state.sport ? ' checked' : '') + '>' +
        '<span>' + SPORTS[k].label + '</span></label>';
    }).join('');
    box.addEventListener('change', function (e) {
      if (e.target.name !== 'sport') return;
      state.sport = e.target.value;
      Array.prototype.forEach.call(box.children, function (c) {
        c.classList.toggle('is-active', c.querySelector('input').checked);
      });
      var sel = $('session-sport-select'); if (sel) sel.value = state.sport;
    });
  }
  function buildSportSelect() {
    $('session-sport-select').innerHTML = SPORT_ORDER.map(function (k) {
      return '<option value="' + k + '">' + SPORTS[k].label + '</option>';
    }).join('');
    $('session-sport-select').value = state.sport;
  }

  /* ---------- 파일 처리 ---------- */
  /* §430 — 업로드 진입점. 파일 1개면 기존 단일 경로(하위 호환), 여러 개면
     자동 융합(형식 감지→primary 선택→IMU/HR 시간축 병합)을 돌린다. */
  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    if (files.length === 1) { handleFile(files[0]); return; }   // 단일 = 기존 경로

    if (!Merger) { showError('융합 모듈을 불러오지 못했습니다. 파일을 하나씩 올려 주세요.'); return; }
    /* 융합은 텍스트 형식(.gpx·.csv·.tcx)만 — .vkx(바이너리)는 단독 업로드 안내 */
    var textFiles = [], skipped = [];
    files.forEach(function (f) {
      if (/\.(gpx|csv|tcx)$/i.test(f.name)) textFiles.push(f);
      else skipped.push(f.name);
    });
    if (!textFiles.length) {
      showError('융합 가능한 파일(.gpx · .csv · .tcx)이 없습니다. .vkx 는 하나씩 올려 주세요.');
      return;
    }
    readAllAsText(textFiles, function (loaded, readErr) {
      if (readErr) { showError('파일을 읽지 못했습니다: ' + readErr); return; }
      try {
        var res = Merger.mergeFiles(loaded);
        processFusion(res, loaded, skipped);
      } catch (e) {
        showError(e && e.message ? e.message : '세션 융합에 실패했습니다.');
      }
    });
  }

  /* 여러 파일을 모두 텍스트로 읽어 [{name,text}] 로 콜백. 순서 보존. */
  function readAllAsText(files, done) {
    var out = new Array(files.length), remaining = files.length, errored = false;
    files.forEach(function (f, idx) {
      var reader = new FileReader();
      reader.onerror = function () {
        if (errored) return; errored = true; done(null, f.name);
      };
      reader.onload = function () {
        out[idx] = { name: f.name, text: reader.result };
        if (--remaining === 0 && !errored) done(out, null);
      };
      reader.readAsText(f);
    });
  }

  /* 확장자로 .gpx ↔ .vkx ↔ .csv 파서를 분기한다. .vkx 는 Vakaros Atlas 2 의
     바이너리 포맷이라 ArrayBuffer 로, .gpx·.csv 는 텍스트로 읽는다.
     §430: .csv 는 RaceBox CSV 면 IMU 융합 경로, 아니면 기존 SailTech 경로. */
  function handleFile(file) {
    var isVkx = /\.vkx$/i.test(file.name);
    var isCsv = /\.csv$/i.test(file.name);
    var isGpx = /\.gpx$/i.test(file.name) ||
                file.type.indexOf('gpx') !== -1 || file.type.indexOf('xml') !== -1;
    if (!isVkx && !isCsv && !isGpx) {
      showError('GPX, VKX 또는 CSV 파일만 지원합니다 (.gpx · .vkx · .csv). 선택한 파일: ' + file.name);
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () { showError('파일을 읽지 못했습니다.'); };
    if (isVkx) {
      reader.onload = function () {
        processVkx(reader.result, file.name.replace(/\.vkx$/i, ''));
      };
      reader.readAsArrayBuffer(file);   // .vkx 는 바이너리
    } else if (isCsv) {
      reader.onload = function () {
        var text = reader.result;
        /* RaceBox CSV — 단일이라도 IMU(heel/pitch) 융합 경로로. SailTech
           통합 CSV 는 기존 processCsv 유지(하위 호환). */
        if (Merger && RaceboxCSV && RaceboxCSV.looksLike && RaceboxCSV.looksLike(text)) {
          try {
            var res = Merger.mergeFiles([{ name: file.name, text: text }]);
            processFusion(res, [{ name: file.name, text: text }], []);
          } catch (e) {
            showError(e && e.message ? e.message : 'RaceBox CSV 를 분석하지 못했습니다.');
          }
        } else {
          processCsv(text, file.name.replace(/\.csv$/i, ''));
        }
      };
      reader.readAsText(file);          // .csv 는 텍스트
    } else {
      reader.onload = function () {
        processGpx(reader.result, file.name.replace(/\.gpx$/i, ''));
      };
      reader.readAsText(file);          // .gpx 는 XML 텍스트
    }
  }

  function loadSample() {
    var name = '샘플 — 부산 송정 (실측 GPX)';
    if (window.RD_SAMPLE_GPX) {
      processGpx(window.RD_SAMPLE_GPX, name);
    } else {
      fetch('sample/sample-songjeong-busan.gpx')
        .then(function (r) { return r.text(); })
        .then(function (t) { processGpx(t, name); })
        .catch(function () {
          showError('샘플 데이터를 불러오지 못했습니다. 직접 GPX 파일을 업로드해 주세요.');
        });
    }
  }

  function processGpx(text, name) {
    try {
      var parsed = Gpx.parseGPX(text);
      var session = An.normalizeSession(parsed);
      state.parsed = parsed;
      state.gpxText = text;        // 원본 GPX — 세션 저장 시 '다시 보기'용으로 보관
      state.fusion = null;         // §430 — 단일 GPX 는 융합 아님
      state.fullSession = session;
      state.autoSessionName = autoTitleFrom(name, parsed);
      state.sessionName = state.autoSessionName;
      state.windDir = null;
      state.windPending = null;
      state.windSpeedKt = null;
      state.selectedManeuvers = [];
      state.maneuverFilter = 'all';
      state.maneuverShowAll = false;
      /* §423 — 새 파일 분석은 기본적으로 '이 기기' 세션이므로 영상 플래그 리셋.
         저장된(cloud) 세션을 다시 보기 할 때만 loadSavedSessionLocal 이 덮는다. */
      state.sessionHasVideoFlag = false;
      state.sessionRemoteDateEpoch = null;
      state.sessionSig = sessionSignature(session);
      /* 사용자가 직접 편집·저장한 제목이 있으면 자동 제목 대신 복원한다 —
         같은 트랙은 시그니처가 같아 새 업로드·'다시 보기' 모두 유지된다. */
      var savedTitle = Storage.loadSessionTitle(state.sessionSig);
      if (savedTitle) state.sessionName = savedTitle;
      state.editState = session.hasTime ? Storage.loadEditState(state.sessionSig) : null;
      applyCurrentEdits();   // state.session 설정 + 재분석
      /* §422 — 권장 풍향 자동 적용(높음·보통만). 적용되면 풍향 반영해 재분석. */
      if (state.windDir == null && autoApplyRecommendedWind()) recompute();
      $('intro-view').hidden = true;
      $('dashboard-view').hidden = false;
      resetAnimMarks();        /* 새 분석 — 카운트업 재시작 (2026-05-26) */
      renderDashboard();
      window.scrollTo(0, 0);
      showHeroSummary();       /* 분석 완료 임팩트 — Layer 2 (2026-05-26) */
    } catch (e) {
      showError(e && e.message ? e.message : 'GPX 파일을 분석하지 못했습니다.');
    }
  }

  /* .vkx (Vakaros Atlas 2 바이너리) 처리. vkx-parser 가 GPX 파서와 동일한
     구조를 돌려주므로 normalizeSession 이후 흐름은 processGpx 와 같다.
     각 포인트에는 GPX 에 없는 heel·pitch 가 함께 담겨 분석으로 전달된다.
     원본이 바이너리라 '다시 보기'용 텍스트(gpxText)는 보관하지 않는다. */
  function processVkx(buffer, name) {
    try {
      var parsed = Vkx.parseVKX(buffer);
      var session = An.normalizeSession(parsed);
      state.parsed = parsed;
      state.gpxText = null;        // .vkx 는 바이너리 — 텍스트 원본 없음
      state.fusion = null;         // §430 — 단일 VKX 는 융합 아님
      state.fullSession = session;
      state.autoSessionName = autoTitleFrom(name, parsed);
      state.sessionName = state.autoSessionName;
      state.windDir = null;
      state.windPending = null;
      state.windSpeedKt = null;
      state.selectedManeuvers = [];
      state.maneuverFilter = 'all';
      state.maneuverShowAll = false;
      /* §423 — 새 파일 분석은 기본적으로 '이 기기' 세션이므로 영상 플래그 리셋.
         저장된(cloud) 세션을 다시 보기 할 때만 loadSavedSessionLocal 이 덮는다. */
      state.sessionHasVideoFlag = false;
      state.sessionRemoteDateEpoch = null;
      state.sessionSig = sessionSignature(session);
      /* 사용자가 직접 편집·저장한 제목이 있으면 자동 제목 대신 복원한다 —
         같은 트랙은 시그니처가 같아 새 업로드·'다시 보기' 모두 유지된다. */
      var savedTitle = Storage.loadSessionTitle(state.sessionSig);
      if (savedTitle) state.sessionName = savedTitle;
      state.editState = session.hasTime ? Storage.loadEditState(state.sessionSig) : null;
      applyCurrentEdits();   // state.session 설정 + 재분석
      /* §422 — 권장 풍향 자동 적용(높음·보통만). 적용되면 풍향 반영해 재분석. */
      if (state.windDir == null && autoApplyRecommendedWind()) recompute();
      $('intro-view').hidden = true;
      $('dashboard-view').hidden = false;
      resetAnimMarks();        /* 새 분석 — 카운트업 재시작 (2026-05-26) */
      renderDashboard();
      window.scrollTo(0, 0);
      showHeroSummary();       /* 분석 완료 임팩트 — Layer 2 (2026-05-26) */
    } catch (e) {
      showError(e && e.message ? e.message : 'VKX 파일을 분석하지 못했습니다.');
    }
  }

  /* .csv (SailTech 통합 CSV) 처리. csv-parser 가 GPX·VKX 파서와 동일한
     구조를 돌려주므로 normalizeSession 이후 흐름은 processGpx 와 같다.
     각 포인트에는 heel·pitch·hr 이 함께 담겨 분석으로 전달된다. */
  function processCsv(text, name) {
    try {
      var parsed = Csv.parseCSV(text);
      var session = An.normalizeSession(parsed);
      state.parsed = parsed;
      state.gpxText = null;
      state.fusion = null;         // §430 — SailTech CSV 단일은 융합 아님
      state.fullSession = session;
      state.autoSessionName = autoTitleFrom(name, parsed);
      state.sessionName = state.autoSessionName;
      state.windDir = null;
      state.windPending = null;
      state.windSpeedKt = null;
      state.selectedManeuvers = [];
      state.maneuverFilter = 'all';
      state.maneuverShowAll = false;
      state.sessionHasVideoFlag = false;
      state.sessionRemoteDateEpoch = null;
      state.sessionSig = sessionSignature(session);
      var savedTitle = Storage.loadSessionTitle(state.sessionSig);
      if (savedTitle) state.sessionName = savedTitle;
      state.editState = session.hasTime ? Storage.loadEditState(state.sessionSig) : null;
      applyCurrentEdits();
      if (state.windDir == null && autoApplyRecommendedWind()) recompute();
      $('intro-view').hidden = true;
      $('dashboard-view').hidden = false;
      resetAnimMarks();
      renderDashboard();
      window.scrollTo(0, 0);
      showHeroSummary();
    } catch (e) {
      showError(e && e.message ? e.message : 'CSV 파일을 분석하지 못했습니다.');
    }
  }

  /* 세션의 풍향 자동 추정 결과(신뢰도 포함) — 트랙 구조에만 의존하므로
     세션당 한 번만 계산해 캐시한다. 편집·크롭 세션은 객체가 새로 생성돼
     자연히 다시 계산된다. */
  function sessionWindEstimate(session) {
    if (session._windEst === undefined) {
      try { session._windEst = An.estimateWindFromTrack(session) || null; }
      catch (e) { session._windEst = null; }
    }
    return session._windEst;
  }

  /* 세션의 회전 기하 풍향 추정 결과 — no-go zone 과 독립된 두 번째
     추정기. 트랙 구조에만 의존하므로 세션당 한 번만 계산해 캐시한다. */
  function sessionManeuverEstimate(session) {
    if (session._windEstMvr === undefined) {
      try { session._windEstMvr = An.estimateWindFromManeuvers(session) || null; }
      catch (e) { session._windEstMvr = null; }
    }
    return session._windEstMvr;
  }

  /* §422 — 권장 풍향 자동 적용. 사용자가 아직 풍향을 수동 확정하지 않은
     세션에 한해, no-go zone + 회전 기하 교차검증의 권장값을 신뢰도 '높음'·
     '보통'일 때만 자동으로 풍향에 넣는다. '낮음'(리칭 위주 등 추정이 빗나갈
     수 있는 세션)은 미설정으로 두고 직접 입력을 유도한다 (옥대표님 결정
     2026-06-18). 수동 확정값은 항상 우선 — 이 함수는 windDir 이 아직 null
     일 때만 호출하며, 저장 세션 복원 시 저장된 수동 풍향이 그 뒤 confirmWind
     로 덮어쓴다(restoreSession). state.session·DOM(#wind-note)이 준비된 뒤
     호출할 것. 적용 시 true 반환 → 호출부가 recompute 로 재분석한다. */
  function autoApplyRecommendedWind() {
    state.windAutoApplied = null;
    if (!state.session || !state.session.hasTime) return false;
    var ws = An.buildWindSources({
      manualDir: null,
      nogo: sessionWindEstimate(state.session),
      rotation: sessionManeuverEstimate(state.session),
      weather: null
    });
    var r = ws && ws.recommended;
    if (!r || r.windDir == null) return false;
    if (r.confidence !== '높음' && r.confidence !== '보통') return false;
    state.windDir = r.windDir;
    state.windPending = r.windDir;
    state.windAutoApplied = {
      windDir: r.windDir, confidence: r.confidence, sourceId: r.sourceId
    };
    var note = $('wind-note');
    if (note) {
      note.textContent = i18nT(
        '✓ 풍향 {deg}° ({dir}) 자동 적용 — 회전 기하·no-go 교차검증 권장값(신뢰도 {conf})입니다. 필요하면 다이얼로 보정 후 “확정”을 다시 누르세요.',
        { deg: r.windDir, dir: compass(r.windDir), conf: i18nT(r.confidence) });
    }
    return true;
  }

  function recompute() {
    /* 풍향 자동 추정 신뢰도를 함께 넘긴다 — 신뢰도가 '낮음' 이면
       회전 효율을 VMG 가 아닌 SOG 기준으로 산출해 점수가 0/100 으로
       튀지 않게 한다 (Danny 검토 §issue-2). */
    var est = sessionWindEstimate(state.session);
    /* fullSession — 편집본을 분석 중이면 편집 전 원본 세션을 함께 넘긴다.
       회전 성공률만은 원본 세션 회전으로 산출해, 트랙 편집 제외 구간에
       든 실패 택·자이브가 분모에서 빠져 성공률이 부풀지 않게 한다
       (Danny 검토 2026-05-23). 편집이 없으면 둘이 같은 객체라 무영향. */
    state.analysis = An.analyzeSession(state.session, state.windDir,
      { windConfidence: est ? est.confidence : null,
        fullSession: state.fullSession });
    /* 분석을 다시 돌리면 고속 구간 배열이 새로 만들어진다 — 선택 인덱스를
       초기화해 지도 강조가 옛 구간을 가리키지 않게 한다. */
    state.selectedRun = null;
  }

  function resetToIntro() {
    Charts.destroyAll();
    state.fusion = null;                 /* §430 — 융합 배너 상태 리셋 */
    $('dashboard-view').hidden = true;
    $('intro-view').hidden = false;
    $('file-input').value = '';
    window.scrollTo(0, 0);
  }

  /* ---------- 대시보드 렌더 ---------- */
  function renderDashboard() {
    renderSessionHeader();
    renderFusionBanner();     /* §430 — 다중 파일 융합 배너 (융합 세션만) */
    renderSummaryStrip();
    renderMapAndLegend();
    renderSpeedChart();
    renderSessionAvg();
    renderStatsPanel();
    renderRaceMetrics();
    renderHistogram();
    renderRuns();
    renderWindUI();
    renderWindSources();
    renderManeuverSection();
    renderViolin();
    renderTargetPolar();
    renderHrSection();
    renderSessionSummary();
    renderSavedSessions();
    /* 시각 폴리시 — 분석 결과 KPI 들이 0 → 최종값으로 카운트업 (Danny
       2026-05-26 Layer 1). data-rd-num 이 부여된 노드만 잡힌다. 재렌더
       (언어 토글·트랙 편집)에서는 이미 카운트가 끝난 노드는 건너뛰어
       값 점멸이 없다. requestAnimationFrame 으로 차트 렌더와 시각적으로
       겹쳐 첫 인상의 임팩트를 만든다. */
    if (window.RDAnim) {
      requestAnimationFrame(function () {
        try { window.RDAnim.markRendered({}); }
        catch (e) { /* 시각 헬퍼 실패는 무음 — 데이터는 이미 렌더됨 */ }
      });
    }
  }
  /* 새 파일을 분석할 때마다 카운트업 다시 시작 — onNewAnalysis 가
     state.analysis 갱신 직후 호출. */
  function resetAnimMarks() {
    if (window.RDAnim) {
      try { window.RDAnim.resetCounted(); }
      catch (e) { /* noop */ }
    }
  }

  /* ============================================================
   * 분석 완료 Hero Summary 오버레이 (Layer 2 — Danny 2026-05-26)
   * ------------------------------------------------------------
   * 분석이 끝난 직후 1회만 표시. 큰 글자 KPI 4개(VPS·이동 시간·최고
   * 속도·총 거리) + 트랙 GPS overview 의 SVG path 가 옅게 깔린다.
   * 5초 자동 dismiss 또는 클릭(skip 버튼·배경 어디든)으로 사라진다.
   * 데이터 흐름은 건드리지 않는다 — state.analysis 의 기존 산출값만
   * 골라 표시한다. (Esc 키도 dismiss 처리)
   * ============================================================ */
  var heroDismissTimer = null;

  function dismissHeroSummary() {
    var el = $('hero-summary');
    if (!el || el.hidden) return;
    if (heroDismissTimer) { clearTimeout(heroDismissTimer); heroDismissTimer = null; }
    el.classList.add('is-leaving');
    setTimeout(function () {
      el.hidden = true;
      el.classList.remove('is-leaving');
      el.setAttribute('aria-hidden', 'true');
      document.removeEventListener('keydown', heroEsc);
    }, 480);
  }
  function heroEsc(e) {
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
      dismissHeroSummary();
    }
  }

  /* 트랙 GPS overview SVG path 생성 — 분석에 영향 없는 시각 전용 추출.
     normalizeSession 산출물의 samples (lat/lng) 를 box 에 맞춰 정규화한
     path 문자열을 반환. 너무 많으면 균등 추출 (시각만, 분석 영향 X). */
  function buildHeroTrackPath(session, w, h) {
    if (!session || !session.samples || session.samples.length < 2) return '';
    var pts = session.samples;
    var n = pts.length;
    var STEP = Math.max(1, Math.floor(n / 200));
    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (var i = 0; i < n; i += STEP) {
      var p = pts[i];
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    var dLat = maxLat - minLat || 1e-9;
    var dLng = maxLng - minLng || 1e-9;
    var pad = 40;
    var sX = (w - 2 * pad) / dLng;
    var sY = (h - 2 * pad) / dLat;
    var s = Math.min(sX, sY);
    var offX = (w - dLng * s) / 2;
    var offY = (h - dLat * s) / 2;
    var d = '';
    for (var j = 0; j < n; j += STEP) {
      var q = pts[j];
      var x = offX + (q.lng - minLng) * s;
      var y = offY + (maxLat - q.lat) * s;       /* Y inverted */
      d += (j === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d;
  }

  /* 인라인 SVG 아이콘 — Lucide 스타일 line icons. 외부 의존성 X.
     stroke=currentColor, width/height=1em 으로 부모 컨텍스트 따른다. */
  var HERO_ICONS = {
    trophy:    '<svg class="rd-icon rd-icon--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    timer:     '<svg class="rd-icon rd-icon--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>',
    gauge:     '<svg class="rd-icon rd-icon--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
    route:     '<svg class="rd-icon rd-icon--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>'
  };

  function showHeroSummary() {
    var s = state.session;
    var a = state.analysis;
    if (!s || !a || !a.summary) return;
    var hero = $('hero-summary');
    if (!hero) return;

    /* 제목·메타 */
    $('hero-title').textContent = state.sessionName || '라이딩 세션';
    var meta = fmtDate(s.startEpoch);
    var src = s.speedSource === 'device' ? 'Device' : 'GPS';
    $('hero-meta').textContent = meta + ' · ' +
      i18nT(SPORTS[state.sport].label || state.sport) + ' · ' + src;

    /* 4 핵심 KPI */
    var sum = a.summary;
    var u = unitLabel();
    var hasTime = sum.hasTime;
    /* VPS — coach.js 의 산출치(state.vps) 가 있으면 종합 점수, 없으면 '—' */
    var vpsScore = (state.vps && state.vps.ok && state.vps.overall &&
                    state.vps.overall.score != null)
      ? state.vps.overall.score : null;

    var kpis = [];
    if (vpsScore != null) {
      kpis.push({
        icon:'trophy',
        label:'세일링 퍼포먼스',
        valueStr:String(vpsScore),
        unit:'<small>/ 100</small>'
      });
    }
    if (hasTime) {
      kpis.push({
        icon:'timer',
        label:'이동 시간',
        valueStr:fmtDurCompact(sum.movingTimeSec),
        unit:''
      });
      kpis.push({
        icon:'gauge',
        label:'최고 속도',
        valueStr:fmtSpeed(sum.maxSpeedMs),
        unit:'<small>' + u + '</small>'
      });
    }
    kpis.push({
      icon:'route',
      label:'총 거리',
      valueStr:(sum.totalDistanceM / 1000).toFixed(2),
      unit:'<small>km</small>'
    });

    $('hero-kpis').innerHTML = kpis.map(function (k) {
      return '<div class="rd-hero-kpi">' +
        HERO_ICONS[k.icon] +
        '<span class="rd-hero-kpi__val">' + numHtml(k.valueStr) + k.unit + '</span>' +
        '<span class="rd-hero-kpi__lbl">' + esc(k.label) + '</span>' +
        '</div>';
    }).join('');

    /* 트랙 SVG path 생성 */
    var heroSvg = $('hero-track');
    if (heroSvg) {
      var pathD = buildHeroTrackPath(s, 800, 600);
      heroSvg.innerHTML = pathD
        ? '<defs><linearGradient id="hero-track-grad" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#1F8FFF" stop-opacity=".55"/>' +
          '<stop offset="100%" stop-color="#0A2540" stop-opacity=".25"/>' +
          '</linearGradient></defs>' +
          '<path d="' + pathD + '" fill="none" ' +
          'stroke="url(#hero-track-grad)" stroke-width="3" ' +
          'stroke-linecap="round" stroke-linejoin="round" ' +
          'stroke-dasharray="5000" stroke-dashoffset="5000">' +
          '<animate attributeName="stroke-dashoffset" from="5000" to="0" ' +
          'dur="1.8s" fill="freeze"/></path>'
        : '';
    }

    /* 표시 + 카운트업 */
    hero.hidden = false;
    hero.setAttribute('aria-hidden', 'false');
    if (window.RDAnim) {
      requestAnimationFrame(function () {
        try { window.RDAnim.countAll($('hero-kpis')); }
        catch (e) {}
      });
    }

    /* 5초 자동 dismiss */
    if (heroDismissTimer) clearTimeout(heroDismissTimer);
    heroDismissTimer = setTimeout(dismissHeroSummary, 5000);

    /* 클릭 / 키보드 dismiss — 한 번만 부착 */
    hero.onclick = function (ev) {
      /* skip 버튼은 자체 처리 — 중복 호출 무시 */
      if (ev.target && ev.target.id === 'hero-skip') return;
      dismissHeroSummary();
    };
    var skipBtn = $('hero-skip');
    if (skipBtn) skipBtn.onclick = function () { dismissHeroSummary(); };
    document.addEventListener('keydown', heroEsc);
  }

  /* §412 (Alex Park #4 · 2026-06-11) — DMJAuth 세션이 async 로 해소되면
     (로그인/로그아웃/탭간) storage namespace 가 'rd_<uid>_*' 로 바뀐다.
     init() 은 DOMContentLoaded = uid 미확정 시점이라 저장 세션 패널이 빈
     목록으로 그려질 수 있고, auth 해소 후 본인 namespace 데이터로 교체해야
     옥대표님 마이그레이션 4건이 보인다. 로그아웃 시엔 빈 목록(격리). */
  window.addEventListener('dmj-auth-change', function () {
    try {
      if (Storage && Storage.migrateLegacyIfNeeded) Storage.migrateLegacyIfNeeded();
      renderSavedSessions();
    } catch (e) { console.warn('renderSavedSessions on auth-change failed:', e); }
  });

  /* §415 (Sprint 1.1) — cloud pull 이 끝나면(다른 기기에서 저장한 세션이
     로컬 namespace 로 병합됨) 세션 패널을 다시 그린다. ?session 딥링크가
     auth 해소 전에 한 번 실패했더라도(대시보드가 아직 인트로) cloud 동기화
     후 트랙이 받아질 수 있으므로 1회 재시도한다. */
  var pendingDeepLinkSession = null;
  window.addEventListener('rd:cloud-synced', function () {
    try {
      renderSavedSessions();
      if (pendingDeepLinkSession && $('dashboard-view') && $('dashboard-view').hidden) {
        var id = pendingDeepLinkSession;
        pendingDeepLinkSession = null;     /* 1회만 재시도 (루프 방지) */
        loadSavedSession(id);
      }
    } catch (e) { console.warn('cloud-synced refresh failed:', e); }
  });

  /* 언어 토글 (한↔영) — 세션이 로드돼 있으면 전 대시보드 재렌더하여
     캔버스(Chart.js·custom canvas) 문자열까지 새 언어로 baked in 되게.
     세션 없으면 정적 DOM 만 i18n.js 가 자동 번역(이미 처리됨). */
  window.addEventListener('rd:langchange', function () {
    if (state && state.session) {
      try { renderDashboard(); }
      catch (e) { console.warn('renderDashboard on langchange failed:', e); }
      /* §410 — renderDashboard 가 다시 만들지 않는 'built-once' 노드(영웅 카드
         메타·풍향 확정 토스트)는 토글 시 빌드 당시 언어로 굳어 한글이 남는다.
         텍스트만 현재 언어로 갱신(오버레이 재표시 없이). */
      try {
        var s = state.session;
        var heroMeta = $('hero-meta');
        if (heroMeta && s && state.analysis) {
          heroMeta.textContent = fmtDate(s.startEpoch) + ' · ' +
            i18nT(SPORTS[state.sport].label || state.sport) + ' · ' +
            (s.speedSource === 'device' ? 'Device' : 'GPS');
        }
        if (state.windDir != null) {
          var wn = $('wind-note');
          if (wn) wn.textContent = windConfirmNote();
        }
      } catch (e2) { /* 토글 갱신 실패는 무음 — renderDashboard 가 본문은 처리 */ }
    }
  });

  function renderSessionHeader() {
    renderSessionTitle();
    $('session-date').textContent = fmtDate(state.session.startEpoch);
    $('session-sport-select').value = state.sport;
    /* §410 — 속도원·포인트 수 source 줄을 i18nT 로(영문 모드 한글 잔존 제거).
       이전엔 PATTERNS 의 '$1 · $2' 백참조가 한국어 캡처를 그대로 재출력했다. */
    var src = state.session.speedSource === 'device'
      ? i18nT('속도원: 기기 기록') : i18nT('속도원: GPS 좌표 계산');
    // 원본 GPX trkpt 전량 사용 (다운샘플링 없음)
    var ptN = (state.parsed && state.parsed.pointCount) || state.session.pointCount;
    src += i18nT(' · GPS 포인트 {n}개 전량 사용', { n: ptN.toLocaleString() });
    if (state.session.editApplied) {
      src += i18nT(' · 편집 적용 {n}개 분석', { n: state.session.pointCount.toLocaleString() });
    }
    $('session-source').textContent = src;

    var notice = $('data-notice');
    if (!state.session.hasTime) {
      notice.hidden = false;
      notice.textContent = '⚠ 이 GPX 에는 시각 정보가 없어 속도·시간 분석을 할 수 없습니다. ' +
        '지도와 총 거리만 표시됩니다.';
    } else { notice.hidden = true; }
  }

  /* ---------- 세션 제목 인라인 편집 ----------
     헤더 제목을 클릭하거나 ✎ 아이콘을 누르면 입력칸으로 바뀐다.
     Enter·blur 로 저장, Esc 로 취소한다. 저장한 제목은 세션
     시그니처별로 보관돼(Storage.saveSessionTitle) 같은 트랙을 새로
     업로드하거나 '다시 보기' 해도 그대로 복원된다. 제목을 비우면
     파일명 기반 자동 제목으로 되돌아간다. ' · 편집본' 같은 상태는
     제목 본문이 아니라 별도 배지로 표시한다. */
  var titleEditing = false;

  /* 헤더 제목 본문 + 편집본 배지 렌더 (편집 입력 중에는 본문 갱신 생략) */
  function renderSessionTitle() {
    var h2 = $('session-title');
    if (h2 && !titleEditing) h2.textContent = state.sessionName;
    var badge = $('session-edited-badge');
    if (badge) badge.hidden = !(state.session && state.session.edited);
  }

  function beginTitleEdit() {
    if (titleEditing || !state.session) return;
    var h2 = $('session-title'), inp = $('session-title-input'),
        btn = $('session-title-edit-btn');
    if (!h2 || !inp) return;
    titleEditing = true;
    inp.value = state.sessionName;
    h2.hidden = true;
    if (btn) btn.hidden = true;
    inp.hidden = false;
    inp.focus();
    inp.select();
  }

  /* 편집 UI 를 닫고 표시 상태로 복귀 (저장·취소 공통) */
  function endTitleEdit() {
    var h2 = $('session-title'), inp = $('session-title-input'),
        btn = $('session-title-edit-btn');
    titleEditing = false;
    if (inp) inp.hidden = true;
    if (h2) h2.hidden = false;
    if (btn) btn.hidden = false;
    renderSessionTitle();
  }

  function commitTitleEdit() {
    if (!titleEditing) return;          /* Esc·중복 blur 로 이미 닫힌 경우 무시 */
    var inp = $('session-title-input');
    var raw = inp ? String(inp.value || '').trim() : '';
    /* 빈 값 = 자동 제목으로 복귀. 자동 제목과 같으면 별도 저장하지 않아
       (시그니처 항목 삭제) 다음에 파일명이 바뀌어도 자연히 따라간다. */
    var next = raw || state.autoSessionName;
    state.sessionName = next;
    if (state.sessionSig) {
      Storage.saveSessionTitle(state.sessionSig,
        (next === state.autoSessionName) ? '' : next);
    }
    endTitleEdit();
  }

  function cancelTitleEdit() {
    if (!titleEditing) return;
    endTitleEdit();                     /* 입력값 폐기 — state.sessionName 유지 */
  }

  /* statTile — 라벨/값/보조 3행 KPI 타일.
     2026-05-26 시각 폴리시: 값(value)이 단일 숫자(또는 prefix+숫자+suffix)
     꼴이면 data-rd-num 을 부여해 카운트업 대상이 된다. 'min:sec' 같은
     비숫자 라벨은 자동으로 카운트업 제외된다.
     value 가 이미 문자열이면 그대로 두고, 안에 첫 숫자만 카운트업 대상으로
     쓴다(예: '12.34 kt' → suffix=' kt', target=12.34).
     2026-05-26 Layer 1.5: opts.spark — 시계열 배열을 받으면 미니 sparkline
     SVG 를 타일 하단에 그린다. opts.trend — { delta, label, dir } chip 표시.
     opts.color — sparkline 그라데이션 hex 색 (기본 sea).
     opts.donutPct — 0~100 진행 도넛 표시 (성공률·효율 같은 % 지표).
     opts.donutColor — 도넛 진행 색. donutPct 있으면 sparkline 대신
     도넛이 값 옆에 배치된다(타일 안 split 레이아웃). */
  function statTile(label, value, sub, opts) {
    var valHtml = numHtml(value);
    var trendHtml = (opts && opts.trend) ? trendChip(opts.trend) : '';
    /* 도넛 % 지표 모드 — 값 옆에 미니 도넛 (Layer 1.5) */
    if (opts && opts.donutPct != null && isFinite(opts.donutPct)) {
      var dColor = opts.donutColor ||
        (opts.donutPct >= 70 ? '#27AE60' :
         opts.donutPct >= 40 ? '#E0A100' : '#C0392B');
      return '<div class="stat stat--with-donut">' +
        '<span class="stat__label">' + label +
        (trendHtml ? trendHtml : '') + '</span>' +
        '<div class="stat__donutrow">' +
        donutSvg(opts.donutPct, 100, dColor, { size: 64, stroke: 7 }) +
        '<div class="stat__donutmeta">' +
        '<span class="stat__value stat__value--donut">' + valHtml + '</span>' +
        (sub ? '<span class="stat__sub">' + sub + '</span>' : '') +
        '</div></div></div>';
    }
    var sparkHtml = (opts && opts.spark)
      ? sparklineSvg(opts.spark, opts.color || '#1F8FFF') : '';
    return '<div class="stat"><span class="stat__label">' + label +
      (trendHtml ? trendHtml : '') + '</span>' +
      '<span class="stat__value">' + valHtml + '</span>' +
      (sub ? '<span class="stat__sub">' + sub + '</span>' : '') +
      sparkHtml +
      '</div>';
  }

  /* sparklineSvg — 미니 영역(area) 그라데이션 차트.
     values 배열을 viewBox 0..100 x 0..32 에 맞춰 정규화. 30 점이 넘어가면
     균등 추출. 데이터 1개 이하면 빈 문자열. (Layer 1.5 — Danny 2026-05-26) */
  function sparklineSvg(values, color) {
    if (!values || values.length < 2) return '';
    var n = values.length;
    var STEP = Math.max(1, Math.floor(n / 64));
    var pts = [];
    for (var i = 0; i < n; i += STEP) pts.push(values[i]);
    if (pts[pts.length - 1] !== values[n - 1]) pts.push(values[n - 1]);
    var lo = Infinity, hi = -Infinity;
    for (var j = 0; j < pts.length; j++) {
      var v = pts[j];
      if (v == null || !isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!isFinite(lo)) return '';
    var span = hi - lo || 1;
    var W = 100, H = 32;
    var stepX = W / (pts.length - 1);
    var d = '', area = '';
    for (var k = 0; k < pts.length; k++) {
      var x = (k * stepX).toFixed(2);
      var y = (H - ((pts[k] - lo) / span) * (H - 4) - 2).toFixed(2);
      d += (k === 0 ? 'M' : 'L') + x + ',' + y;
      area += (k === 0 ? 'M' : 'L') + x + ',' + y;
    }
    area += 'L' + W + ',' + H + 'L0,' + H + 'Z';
    var gradId = 'rd-spark-' + Math.random().toString(36).slice(2, 8);
    return '<svg class="stat__spark" viewBox="0 0 ' + W + ' ' + H + '" ' +
      'preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.32"/>' +
      '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gradId + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color +
      '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  /* trendChip — KPI 라벨 옆에 작은 비교 chip.
     trend: { delta, label, dir } — delta 부호로 ▲/▼/= 결정.
     dir 가 'good'/'bad'/'neutral' 이면 색을 명시. (Layer 1.5) */
  function trendChip(trend) {
    if (!trend) return '';
    var d = trend.delta;
    var sign = '', cls = 'flat';
    if (d != null && isFinite(d)) {
      if (d > 0)      { sign = '▲ +'; cls = 'up'; }
      else if (d < 0) { sign = '▼ −'; cls = 'down'; }
      else            { sign = '='; cls = 'flat'; }
    }
    var dirCls = trend.dir ? ' rd-chip--' + trend.dir : '';
    var num = (d == null || !isFinite(d)) ? '' :
      Math.abs(d) >= 100 ? Math.round(Math.abs(d))
      : Math.abs(d).toFixed(Math.abs(d) >= 10 ? 0 : 1);
    var lab = trend.label ? ' <small>' + esc(trend.label) + '</small>' : '';
    return ' <span class="rd-chip rd-chip--' + cls + dirCls + '">' +
      sign + num + (trend.unit || '%') + lab + '</span>';
  }

  /* numHtml — 문자열 값을 받아 첫 숫자를 카운트업 가능한 span 으로 감싼다.
     '12.34 kt' → <span data-rd-num="12.34" data-rd-suffix=" kt">12.34 kt</span>
     숫자가 없거나 '미입력' '—' 같은 라벨은 그대로 둔다. */
  function numHtml(value) {
    if (value == null) return '—';
    var s = String(value);
    /* 부호·소수·천단위 콤마 허용. 첫 매치만 카운트업 대상. */
    var m = s.match(/^(\D*)(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?)(.*)$/);
    if (!m) return s;       /* 숫자 없음 — 그대로 */
    var prefix = m[1], numStr = m[2], suffix = m[3];
    var raw = parseFloat(numStr.replace(/,/g, ''));
    if (!isFinite(raw)) return s;
    var decimals = (numStr.indexOf('.') >= 0)
      ? numStr.split('.')[1].length : 0;
    return '<span data-rd-num="' + raw + '"' +
      (prefix ? ' data-rd-prefix="' + esc(prefix) + '"' : '') +
      (suffix ? ' data-rd-suffix="' + esc(suffix) + '"' : '') +
      ' data-rd-decimals="' + decimals + '">' + esc(s) + '</span>';
  }

  /* 회전 지표 정의 툴팁 — 효율·손실·소요·회복이 같은 기준을 보도록
     하고, 사용자가 표만 보고도 정의를 알 수 있게 한다(자기설명적 지표).
     analysis.js 의 실제 계산식과 일치한다. */
  /* 손실 — 효율 점수와 같은 기준으로 표시한다(Danny 검토 §issue-2):
     풍향이 신뢰도 있게 확정된 세션은 VMG 기준이라 손실 + 효율 = 100,
     그렇지 않으면 SOG 기준(진입·탈출 대비 최저 속도 감속폭). */
  var LOSS_TIP = '회전이 골 방향(풍상·풍하) 속도를 얼마나 잃었는지를 ' +
    '효율 점수와 같은 기준으로 나타냅니다. 풍향이 신뢰도 있게 확정된 ' +
    '세션은 VMG(풍상·풍하 유효속도) 기준이라 손실 % + 효율 점수 = 100 ' +
    '이며, 그렇지 않으면 SOG(속도)의 진입·탈출 중 빠른 쪽 대비 ' +
    '회전 중 최저 속도까지의 감속폭입니다.';
  /* 회전효율 — 0~100 회전효율 점수. */
  var EFF_TIP = '회전효율 점수(0~100)입니다. 풍향이 신뢰도 있게 ' +
    '확정된 세션은 회전 전후 VMG 의 보존율(탈출 VMG ÷ 진입 VMG), ' +
    '그렇지 않으면 속도 손실(65%)과 회복 시간(35%) 을 합산해 산출합니다. ' +
    '높을수록 좋은 회전입니다.';
  /* 소요 — 회전 구간 자체의 길이. */
  var DURATION_TIP = '소요 시간 = 회전에 걸린 시간. 진행 방향(헤딩)이 ' +
    '꺾이기 시작한 순간부터 회전이 끝나 헤딩이 안정될 때까지를 잰 값으로, ' +
    '회전 후 속도를 되찾는 회복 시간과는 별개입니다.';
  /* 회복 — 회전 후 활주 속도 복귀까지. */
  var RECOVERY_TIP = '회복 시간 = 회전 중 최저 속도 지점부터, 회전 전후의 ' +
    '기준 속도(진입·탈출 중 빠른 쪽)의 95% 까지 다시 가속하는 데 걸린 ' +
    '시간입니다. 45초 안에 회복하지 못하면 “—” 로 표시합니다.';
  /* 성공률 — 터치다운 없이 완료한 회전 비율. */
  var SUCCESS_TIP = '전체 시도 중 터치다운 없이 완료한 비율입니다. ' +
    '회전 도중 최저 속도가 포일링 속도 임계 아래로 떨어지지 않고 ' +
    '포일을 유지한 채 완료한 회전을 “성공” 으로 봅니다. ' +
    '트랙 편집으로 일부 구간을 제외해도, 성공률은 편집 전 세션 전체의 ' +
    '택·자이브를 분모로 삼습니다 — 제외한 구간에 든 실패 회전이 빠져 ' +
    '성공률이 부풀지 않게 하기 위함입니다.';

  /* 지표 라벨에 정의 툴팁을 붙인다 — 작은 ⓘ 표식과 점선 밑줄로 hover 시
     설명이 뜸을 알린다. 네이티브 title 속성을 써, 가로 스크롤되는 표
     셀 안에서도 잘리지 않고 동작한다. */
  function tipLabel(text, tip) {
    return '<span class="tip-label" title="' + esc(tip) + '">' + esc(text) +
      '<span class="tip-label__i" aria-hidden="true">ⓘ</span></span>';
  }

  function renderSummaryStrip() {
    var s = state.analysis.summary;
    var foiling = SPORTS[state.sport].foiling;
    var u = unitLabel();

    /* Layer 1.5 — KPI 시계열 미니 sparkline 데이터 추출.
       state.session.samples 의 속도·거리 progression 을 100점 이하로 균등
       추출한다. 분석에 영향 없는 시각 전용 (Danny 2026-05-26). */
    var sparkSpeed = [], sparkCum = [];
    var totalSec = 0, sCount = 0;
    if (state.session && state.session.samples && state.session.hasTime) {
      var samps = state.session.samples;
      var stride = Math.max(1, Math.floor(samps.length / 80));
      for (var i = 0; i < samps.length; i += stride) {
        var sp = samps[i].speed;
        if (sp != null && isFinite(sp)) sparkSpeed.push(sp);
        sparkCum.push(samps[i].cumDist || 0);
      }
      sCount = sparkCum.length;
    }

    /* 트렌드 chip — 저장된 세션이 있으면 이전 세션 대비 비교 (Layer 1.5).
       Storage.loadSessions 가 시간 역순 정렬 가정. 이번 세션과 동일 시그니처는
       제외한다(다시 보기 시 자기 자신과 비교 방지). */
    function deltaTrend(prevVal, curVal, unit) {
      if (prevVal == null || !isFinite(prevVal) || prevVal === 0) return null;
      var pct = ((curVal - prevVal) / prevVal) * 100;
      return { delta: pct, label: 'vs 이전', dir: pct >= 0 ? 'good' : 'bad', unit: '%' };
    }
    var prev = null;
    try {
      if (window.Storage && Storage.listSessions) {
        var sessions = Storage.listSessions() || [];
        /* listSessions 는 dateEpoch 오름차순. 현재 세션 startEpoch 와 다른
           가장 최근(끝쪽) 세션을 비교 대상으로. ±10초 이내는 same 세션 간주. */
        var curEp = state.session.startEpoch || 0;
        for (var p = sessions.length - 1; p >= 0; p--) {
          if (Math.abs((sessions[p].dateEpoch || 0) - curEp) > 10000) {
            prev = sessions[p]; break;
          }
        }
      }
    } catch (e) { /* noop — 시각 chip 만 영향 */ }

    var html = statTile('총 거리 (km)',
      (s.totalDistanceM / 1000).toFixed(2),
      null,
      { spark: sparkCum,
        trend: prev ? deltaTrend(prev.distanceM / 1000, s.totalDistanceM / 1000) : null });
    if (s.hasTime) {
      /* Layer 2.0 — 시간 값은 컴팩트 콜론 포맷(mm:ss)으로 줄바꿈 방지.
         Sparkline 색은 모든 타일 동일 sea blue (mockup 일관성 패턴). */
      html += statTile('이동 시간 (min:sec)', fmtDurCompact(s.movingTimeSec),
        '전체 ' + fmtDurCompact(s.totalDurationSec),
        { trend: prev ? deltaTrend(prev.movingTimeSec, s.movingTimeSec) : null });
      html += statTile('최고 속도 (' + u + ')', fmtSpeed(s.maxSpeedMs),
        '2초 구간 최고',
        { spark: sparkSpeed,
          trend: prev ? deltaTrend(prev.maxSpeedMs, s.maxSpeedMs) : null });
      html += statTile('평균 속도 (' + u + ')', fmtSpeed(s.avgSpeedMovingMs),
        '이동 중',
        { spark: sparkSpeed,
          trend: prev ? deltaTrend(prev.avgSpeedMovingMs, s.avgSpeedMovingMs) : null });
      html += statTile((foiling ? '포일링' : '플레이닝') + ' 시간 (min:sec)',
        fmtDurCompact(s.activeTimeSec),
        Math.round(s.activeRatio * 100) + '% 비율');
    }
    html += statTile('풍향 (°)',
      state.windDir != null ? String(state.windDir) : '미입력',
      state.windDir != null
        ? (compass(state.windDir) +
           (state.windSpeedKt != null ? ' · 풍속 ' + state.windSpeedKt + ' kt' : ''))
        : '');
    $('summary-strip').innerHTML = html;
  }

  /* ---------- 트랙 편집 ---------- */
  function sessionSignature(s) {
    return (s.pointCount || 0) + '_' + Math.round(s.totalDistanceM || 0) +
           '_' + (s.startEpoch || 0);
  }

  /* 이름 끝의 ' · 편집본' 상태 접미사를 떼어낸다. 예전 버전은 편집본을
     저장할 때 이름 자체에 접미사를 박았다 — 그 레코드를 '다시 보기' 할 때
     접미사가 제목 본문에 섞이지 않도록 정규화한다(편집 상태는 배지로 분리). */
  function stripEditedSuffix(name) {
    return String(name == null ? '' : name).replace(/\s*·\s*편집본\s*$/, '').trim();
  }
  /* 파일명·트랙명에서 자동 생성하는 기본 세션 제목 */
  function autoTitleFrom(name, parsed) {
    return stripEditedSuffix(name) ||
           stripEditedSuffix(parsed && parsed.trackName) ||
           '라이딩 세션';
  }
  function isEmptyEdit(e) {
    if (!e) return true;
    return (e.trimStart == null) && (e.trimEnd == null) &&
           (!e.excludeRanges || !e.excludeRanges.length);
  }

  /* editState 를 적용해 state.session 갱신 + 재분석 */
  function applyCurrentEdits() {
    if (state.editState && !isEmptyEdit(state.editState)) {
      try {
        state.session = An.applyEdits(state.fullSession, state.editState);
      } catch (e) {
        showError(e && e.message ? e.message : '편집 적용에 실패했습니다.');
        state.editState = null;
        state.session = state.fullSession;
      }
    } else {
      state.session = state.fullSession;
    }
    recompute();
  }

  /* 통합 속도 시계열의 편집 상태 표시 + 버튼 활성/비활성.
     트랙 편집 기능이 속도 시계열 차트로 흡수되어, 상태 텍스트만
     카드 헤더에 둔다 (별도 트랙 편집 스트립 제거). */
  function renderEditControls() {
    var st = $('edit-status');
    var resetBtn = $('edit-reset-btn');
    if (!st) return;
    var e = state.editState, fs = state.fullSession;
    if (!fs || !fs.hasTime) {
      st.className = 'card__hint';
      st.textContent = '';
      if (resetBtn) resetBtn.disabled = true;
      return;
    }
    var fullDur = fs.samples[fs.samples.length - 1].t;
    if (e && !isEmptyEdit(e) && state.analysis) {
      st.className = 'card__hint is-edited';
      var parts = [];
      if ((e.trimStart || 0) > 0.5) parts.push('앞 ' + mmss(e.trimStart) + ' 잘림');
      if (e.trimEnd != null && e.trimEnd < fullDur - 0.5) {
        parts.push('뒤 ' + mmss(fullDur - e.trimEnd) + ' 잘림');
      }
      if (e.excludeRanges && e.excludeRanges.length) {
        parts.push('제외 ' + e.excludeRanges.length + '구간');
      }
      st.textContent = '편집됨 · ' + parts.join(' · ') +
        ' · 분석 길이 ' + fmtDur(state.analysis.summary.totalDurationSec || 0);
      if (resetBtn) resetBtn.disabled = false;
    } else {
      st.className = 'card__hint';
      st.textContent = '원본 전체 (' + fmtDur(fullDur) + ')';
      if (resetBtn) resetBtn.disabled = true;
    }
  }

  /* 통합 차트의 양끝 트림 핸들 → editState 의 trimStart/trimEnd 갱신.
     좌표는 원본 세션 기준 초(=실제 시간 축). 트림 밖으로 벗어난 제외
     구간은 잘라 맞추고, 0/끝에 닿으면 null 로 정규화한다. */
  function trimFromChart(newStart, newEnd) {
    var fs = state.fullSession;
    if (!fs || !fs.hasTime) return;
    var fullDur = fs.samples[fs.samples.length - 1].t;
    var ns = Math.max(0, Math.min(newStart, newEnd));
    var ne = Math.min(fullDur, Math.max(newStart, newEnd));
    if (ne - ns < 10) return;          // 너무 짧으면 무시
    var e = state.editState || {};
    var ranges = (e.excludeRanges || []).map(function (r) {
      return { from: Math.max(ns, r.from), to: Math.min(ne, r.to) };
    }).filter(function (r) { return r.to - r.from >= 1; });
    onEditChange({
      trimStart: ns > 0.5 ? ns : null,
      trimEnd: ne < fullDur - 0.5 ? ne : null,
      excludeRanges: ranges
    });
  }

  function onEditChange(newEdit) {
    state.editState = isEmptyEdit(newEdit) ? null : newEdit;
    state.selectedManeuvers = [];
    Storage.saveEditState(state.sessionSig, state.editState);
    applyCurrentEdits();
    renderDashboard();
  }

  function resetEdit() {
    if (isEmptyEdit(state.editState)) return;
    state.editState = null;
    state.selectedManeuvers = [];
    Storage.saveEditState(state.sessionSig, null);
    applyCurrentEdits();
    renderDashboard();
  }

  function saveEditedCopy() {
    if (!state.session || !state.analysis) return;
    var edited = !!(state.session.edited);
    var res = Storage.saveSession({
      name: state.sessionName,
      edited: edited,
      dateEpoch: state.session.startEpoch || Date.now(),
      sport: state.sport, windDir: state.windDir, windSpeedKt: state.windSpeedKt,
      vps: vpsMeta(),
      hrRecoveryIndex: skillHrRecoveryIndex(),
      gpxText: state.gpxText        // '다시 보기'용 원본 GPX
    }, state.analysis);
    var st = $('save-status');
    st.hidden = false;
    if (res.ok) {
      st.textContent = edited
        ? '✓ 편집본을 저장된 세션으로 복사했습니다.'
        : '✓ 세션을 저장했습니다.';
      st.className = 'save-status save-status--ok';
      renderSavedSessions();
    } else {
      st.textContent = '✗ ' + (res.error || '저장에 실패했습니다.');
      st.className = 'save-status save-status--err';
    }
    setTimeout(function () { st.hidden = true; }, 6000);
  }

  /* ---------- 차트 ↔ 지도 ↔ 편집 타임라인 커서 sync ---------- */
  var cursorRaf = null, cursorPending;
  function syncCursor(fullT) {
    cursorPending = fullT;
    if (cursorRaf) return;
    cursorRaf = requestAnimationFrame(function () {
      cursorRaf = null;
      applyCursor(cursorPending);
    });
  }
  function applyCursor(fullT) {
    if (fullT == null) {
      Charts.hideCursor();
      return;
    }
    var fs = state.fullSession;
    if (fs) {
      var s = fs.samples[nearestFullByTime(fullT)];
      Charts.setMapCursorLatLng(s.lat, s.lng,
        mmss(s.t) + ' · ' + fmtSpeed(s.speed) + ' ' + unitLabel());
    }
    var e = state.editState || {};
    var fullDur = fs ? fs.samples[fs.samples.length - 1].t : 1e9;
    var ts = e.trimStart != null ? e.trimStart : 0;
    var te = e.trimEnd != null ? e.trimEnd : fullDur;
    var kept = fullT >= ts && fullT <= te;
    if (kept && e.excludeRanges) {
      for (var k = 0; k < e.excludeRanges.length; k++) {
        if (fullT >= e.excludeRanges[k].from && fullT <= e.excludeRanges[k].to) kept = false;
      }
    }
    Charts.setChartCursorByTime(kept ? (fullT - ts) : null);
  }
  function nearestFullByTime(t) {
    var S = state.fullSession.samples;
    var lo = 0, hi = S.length - 1;
    while (lo < hi) {
      var m = (lo + hi) >> 1;
      if (S[m].t < t) lo = m + 1; else hi = m;
    }
    if (lo > 0 && Math.abs(S[lo - 1].t - t) < Math.abs(S[lo].t - t)) return lo - 1;
    return lo;
  }
  /* 차트 클릭 → 지도 시점 점프 (Danny 2026-05-27 §173 + §175 보강).
     커서 동기화 + 지도 자체를 해당 위치로 부드럽게 팬한다.
     심박/속도 차트는 보통 지도 아래에 있어, 차트 클릭만으로는
     사용자가 지도의 변화를 못 볼 수 있다. 클릭 시 지도가 뷰포트에
     일부라도 보이지 않으면 부드럽게 스크롤해서 명시적으로 보여준다
     (사용자가 이미 지도를 보고 있으면 스크롤 안 함). */
  function jumpMapToTime(fullT) {
    syncCursor(fullT);
    if (!state.fullSession) return;
    var s = state.fullSession.samples[nearestFullByTime(fullT)];
    if (!s) return;
    Charts.panMapToLatLng(s.lat, s.lng);
    /* 지도 카드가 뷰포트에 충분히 보이지 않으면 스크롤 — */
    var mapCard = document.querySelector('.card--map');
    if (mapCard) {
      var r = mapCard.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var visibleH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      var minVisible = Math.min(r.height, vh * 0.35);
      if (visibleH < minVisible) {
        mapCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
  /* 편집된 세션 기준 exclude 구간 (속도 차트 음영용) */
  function rebasedExcludes() {
    var e = state.editState;
    if (!e || !e.excludeRanges) return [];
    var ts = e.trimStart || 0;
    return e.excludeRanges.map(function (r) {
      return { from: r.from - ts, to: r.to - ts };
    });
  }

  /* 속도 시계열에서 드래그한 구간을 제외 — 트랙 편집과 동일한
     editState.excludeRanges 에 반영(겹치면 병합) 후 즉시 재분석. */
  function excludeFromChart(fromEditedT, toEditedT) {
    var fs = state.fullSession;
    if (!fs || !fs.hasTime) return;
    var e = state.editState || {};
    var fullDur = fs.samples[fs.samples.length - 1].t;
    var ts = e.trimStart != null ? e.trimStart : 0;
    var te = e.trimEnd != null ? e.trimEnd : fullDur;
    // 차트(편집 세션) 시각 → 원본 세션 시각
    var from = Math.max(ts, Math.min(te, fromEditedT + ts));
    var to = Math.max(ts, Math.min(te, toEditedT + ts));
    if (to - from < 1) return;
    var ranges = (e.excludeRanges || []).concat([{ from: from, to: to }]);
    ranges.sort(function (x, y) { return x.from - y.from; });
    var merged = [];
    ranges.forEach(function (r) {
      var last = merged[merged.length - 1];
      if (last && r.from <= last.to + 0.5) last.to = Math.max(last.to, r.to);
      else merged.push({ from: r.from, to: r.to });
    });
    onEditChange({ trimStart: e.trimStart, trimEnd: e.trimEnd, excludeRanges: merged });
  }

  /* 속도 시계열에서 제외 구간을 클릭 → 그 제외를 해제 */
  function removeExcludeFromChart(index) {
    var e = state.editState;
    if (!e || !e.excludeRanges || !e.excludeRanges[index]) return;
    var ranges = e.excludeRanges.slice();
    ranges.splice(index, 1);
    onEditChange({ trimStart: e.trimStart, trimEnd: e.trimEnd, excludeRanges: ranges });
  }

  /* ---------- GPS 트랙 전체화면 ---------- */
  function enterMapFullscreen() {
    if (!state.session) return;
    $('map-fs').hidden = false;
    document.body.style.overflow = 'hidden';
    // 전체화면 지도 + 하단 가로 속도차트 (inst.* 가 전체화면으로 전환)
    Charts.renderMap('fs-map', state.session, state.analysis, {
      onHover: function (t) { syncCursor(t); }
    });
    if (state.session.hasTime) {
      Charts.renderSpeedChart('fs-speed-chart', state.session, state.analysis, {
        toSpeed: toSpeed, unitLabel: unitLabel(),
        excludeRanges: rebasedExcludes(),
        onHover: function (t) { syncCursor(t); },
        onExclude: excludeFromChart,
        onExcludeRemove: removeExcludeFromChart
      });
    }
    // 풍향 오버레이(격자·화살표)를 전체화면 지도에도 그린다 (§417).
    // fs-map 이 이제 보이므로 캔버스 크기를 측정해 다시 그리고, 현재
    // 풍향(미리보기 우선)으로 화살표를 켠다 — 일반 mode 와 동일한 표시.
    buildWindArrows();              // fs-wind-arrows 가 비어 있으면 채움
    var deg = currentWindGridDeg();
    resizeWindGrid();               // fs-wind-grid 캔버스 크기 재설정
    WG.deg = deg;
    if (!WG.glintRaf) drawWindGrid(WG.deg, 0);
    updateWindArrows(deg);
  }
  function exitMapFullscreen() {
    if ($('map-fs').hidden) return;
    $('map-fs').hidden = true;
    document.body.style.overflow = '';
    Charts.hideCursor();
    // 일반 대시보드 지도·차트 복원 (inst.* 가 일반으로 전환)
    renderMapAndLegend();
    renderSpeedChart();
  }

  /* ---------- 라이딩 리플레이 ----------
     리플레이 뷰어는 RDCharts.renderMap 으로 지도(inst.map)를 가져가
     자체 화면에 그린다 — GPS 트랙 전체화면과 같은 패턴. 닫을 때
     대시보드 지도를 복원한다. */
  function enterReplay() {
    if (!state.session || !state.analysis) return;
    if (!state.session.hasTime) {
      showError('리플레이는 시각 정보가 있는 세션에서만 가능합니다.');
      return;
    }
    if (!window.RDReplay) {
      showError('리플레이 모듈을 불러오지 못했습니다.');
      return;
    }
    RDReplay.open({
      session: state.session,
      analysis: state.analysis,
      windDir: state.windDir,
      unit: state.unit,
      sessionSig: state.sessionSig,
      title: state.sessionName,
      /* §423 — cloud 기록상 영상 있던 세션 + 저장 시각. 이 기기에 영상
         blob 이 없으면 리플레이가 '영상 없음' 안내 배너를 띄운다. */
      hasVideoFlag: state.sessionHasVideoFlag,
      videoUploadedAt: state.sessionRemoteDateEpoch,
      onClose: exitReplay
    });
  }
  function exitReplay() {
    // 리플레이가 renderMap 으로 inst.map 을 가져갔으므로 대시보드
    // 지도·범례를 다시 그려 복원한다 (전체화면 종료와 동일 패턴).
    if (!state.session || !state.analysis) return;
    renderMapAndLegend();
    Charts.hideCursor();
  }

  function renderMapAndLegend() {
    Charts.renderMap('map', state.session, state.analysis, {
      onManeuverClick: selectManeuver,
      onHover: function (fullT) { syncCursor(fullT); }
    });
    // 풍향 모눈종이 그리드 — 지도 크기에 맞춰 캔버스를 재설정 후 다시 그린다
    resizeWindGrid();
    WG.deg = currentWindGridDeg();
    if (!WG.glintRaf) drawWindGrid(WG.deg, 0);
    var maxKt = (state.analysis.summary.maxSpeedMs || 1) * KT;
    var stops = '';
    for (var i = 0; i <= 6; i++) {
      stops += Charts.mapSpeedColor(maxKt * i / 6, maxKt) + ' ' + (i / 6 * 100) + '%' +
        (i < 6 ? ',' : '');
    }
    $('map-legend').innerHTML =
      '<span>' + i18nT('느림') + '</span><span class="map-legend__bar" style="background:' +
      'linear-gradient(90deg,' + stops + ')"></span><span>' + i18nT('빠름') + ' (' +
      fmtSpeed(state.analysis.summary.maxSpeedMs, 0) + ' ' + unitLabel() + ')</span>';
    /* 지도가 새로 그려졌으므로(전체화면·리플레이 토글 등) 선택된
       고속 구간이 있으면 강조를 다시 적용한다. */
    if (state.selectedRun != null && state.analysis && state.analysis.runs) {
      var selRun = state.analysis.runs.runs[state.selectedRun];
      if (selRun) Charts.highlightMapRun(selRun);
      else state.selectedRun = null;
    }
  }

  /* 캔버스를 지우지 않고 빈 메시지 토글 (재업로드 시 복구 가능하도록) */
  function chartEmpty(canvasId, msg) {
    var c = $(canvasId); if (!c) return;
    c.style.display = 'none';
    var note = c.parentNode.querySelector('.empty-note');
    if (!note) {
      note = document.createElement('p');
      note.className = 'empty-note';
      c.parentNode.appendChild(note);
    }
    note.textContent = msg; note.style.display = '';
  }
  function chartShow(canvasId) {
    var c = $(canvasId); if (!c) return;
    c.style.display = '';
    var note = c.parentNode.querySelector('.empty-note');
    if (note) note.style.display = 'none';
  }

  function renderSpeedChart() {
    if (!state.session.hasTime) {
      chartEmpty('speed-chart', '시각 정보가 없어 속도 그래프를 표시할 수 없습니다.');
      renderEditControls();
      return;
    }
    chartShow('speed-chart');
    var fs = state.fullSession;
    var fullDur = fs.samples[fs.samples.length - 1].t;
    var e = state.editState || {};
    Charts.renderSpeedChart('speed-chart', state.session, state.analysis, {
      toSpeed: toSpeed, unitLabel: unitLabel(),
      selectedManeuvers: state.selectedManeuvers,
      excludeRanges: rebasedExcludes(),
      fmtX: fmtTimeAxis,
      xTitle: state.timeAxisMode === 'clock' ? '실제 시각' : '경과 시간',
      onManeuverClick: selectManeuver,
      onHover: function (fullT) { syncCursor(fullT); },
      onExclude: excludeFromChart,
      onExcludeRemove: removeExcludeFromChart,
      // 통합 위젯 — 양끝 트림 핸들 (원본 세션 기준 초 = 실제 시간 축)
      trim: {
        start: e.trimStart != null ? e.trimStart : 0,
        end: e.trimEnd != null ? e.trimEnd : fullDur,
        fullDur: fullDur
      },
      fullSamples: fs.samples,
      excludeRangesFull: e.excludeRanges || [],
      onTrim: trimFromChart
    });
    renderEditControls();
  }

  function renderRaceMetrics() {
    var box = $('race-metrics');
    var title = $('race-title');
    if (title) {
      title.textContent = '오늘의 세션 속도 (' +
        (state.unit === 'kmh' ? 'km/h' : '노트') + ')';
    }
    if (!state.session.hasTime) {
      box.innerHTML = '<p class="empty-note">시각 정보가 없어 표준 지표를 계산할 수 없습니다.</p>';
      return;
    }
    var a = state.analysis;
    function pk(w) {
      var x = a.peaks.filter(function (p) { return p.windowSec === w; })[0];
      return x ? x.speedMs : 0;
    }
    function db(d) {
      var x = a.distanceBests.filter(function (p) { return p.distanceM === d; })[0];
      return x ? x.speedMs : 0;
    }
    var items = [
      ['최고 속도 (2초)', pk(2)], ['10초 peak', pk(10)],
      ['100 m', db(100)], ['250 m', db(250)], ['500 m', db(500)],
      ['1 해리 (1NM)', db(1852)],
      ['알파 500', a.alpha ? a.alpha.speedMs : 0]
    ];
    box.innerHTML = items.map(function (it) {
      var v = it[1] > 0 ? fmtSpeed(it[1]) : '—';
      /* numHtml 로 wrap → 카운트업 가능 (2026-05-26 시각 폴리시) */
      return '<div class="metric"><span class="metric__val">' + numHtml(v) +
        '</span><span class="metric__label">' + it[0] + '</span></div>';
    }).join('');
  }

  /* ---------- 퍼포먼스 통계 패널 (Njord 'Statistics' 벤치마크 §3.2 / 갭분석 §6-3) ----------
     핵심 지표(SOG·VMG·풍각·힐·피치·심박)를 평균·상위 50%·상위 20%
     한 표로 압축한다. 표시값은 분석 엔진이 이미 산출한 것을
     An.computeStatsPanel 이 재배치해 준 것뿐 — 여기서 다시 계산하지 않는다
     (중복 재계산 금지). 상위 50%/20% 는 좋은 방향 기준 구간의 시간가중
     평균(단일 GPS 포인트 노이즈 배제) — 전체→상위50→상위20 점층 표기. */
  /* 지표의 '좋은 방향' 배지 — direction(computeStatsPanel 산출)에 대응.
     표만 보고도 '상위'가 어느 쪽인지 알 수 있게 한다(자기설명적). */
  var STATS_DIR_BADGE = {
    high:    { txt: '높을수록 좋음', cls: 'good', arrow: '▲ ' },
    low:     { txt: '낮을수록 좋음', cls: 'good', arrow: '▼ ' },
    neutral: { txt: '중립 지표',     cls: 'neutral', arrow: '' }
  };
  /* neutral 지표 배지 문구 — 좋고 나쁨이 없는 이유. */
  var STATS_NEUTRAL_NOTE = {
    'twa-downwind': '중립 · 최적각 ≈140–150°',
    heel:  '중립 · 좌우 트림',
    pitch: '중립 · 앞뒤 트림',
    hr:    '중립 · 신체 부하 참고'
  };
  var STATS_MODE_LABEL = { upwind: '풍상', downwind: '풍하' };
  /* 지표별 정의·산출법 툴팁 — 표만 보고도 의미를 알 수 있게(자기설명적). */
  var STATS_TIP = {
    sog: 'SOG = 속도(GPS 기준 실제 이동 속도). 높을수록 좋습니다. ' +
      '풍상/풍하 × 포트/스타보드 택별로, 평균과 상위 50%·20%(높은 값 ' +
      '구간의 시간가중 평균)를 보여 줍니다 — 단일 GPS 포인트의 순간 ' +
      '극값(노이즈)은 쓰지 않습니다.',
    vmg: 'VMG = 풍상·풍하 유효속도(바람 축으로 다가가거나 멀어지는 ' +
      '속도). 풍상·풍하 모두 양수로 저장하므로 높을수록 좋습니다. ' +
      '포트/스타보드 택별 상위 50%·20% 는 높은 값 구간의 시간가중 평균.',
    twa: 'CWA = 보트 헤딩과 풍향이 이루는 각. 풍상은 작을수록 ' +
      '바람에 가깝게 포인팅이라 좋아 \'상위\'가 가장 좁은 각 쪽입니다. ' +
      '풍하는 VMG 최적각이 약 140~150°이고 정풍하(180°)는 오히려 느려 ' +
      '중립으로 두고 크기가 큰(깊은) 각 쪽을 상위로 표시합니다. 포트/' +
      '스타보드 택별로 나눠 좌우 포인팅 차이를 볼 수 있습니다.',
    heel: '힐(Heel) = 보드 좌우 기울기. 택에 따라 부호가 갈리므로(한 택 ' +
      '−/반대 택 +) 포트·스타보드 버킷으로 나눠 부호 있는 실제 값을 ' +
      '보여 줍니다 — 포트(−)와 스타보드(+)의 크기가 비슷하면 좌우로 ' +
      '대칭되게 기운 것입니다. 평균·상위 50%/20% 는 각 버킷에서 더 크게 ' +
      '기운 구간의 시간가중 평균. 트림 특성이라 좋고 나쁨을 매기지 않습니다.',
    pitch: '피치(Pitch·트림) = 보드 앞뒤 기울기. 포일링 중에는 대체로 ' +
      '뱃머리 들림(+) 한 방향이라 부호 그대로 평균합니다. 다른 지표처럼 ' +
      '풍상/풍하 × 포트/스타보드 버킷으로 나눠 좌우 택 차이를 함께 ' +
      '봅니다. 상위 50%·20% 는 뱃머리가 더 들린 구간. 트림 특성이라 ' +
      '좋고 나쁨을 매기지 않습니다. 자세 센서가 담긴 .vkx 에서만 표시.',
    hr: '심박수(HR) = 센서 관측 심박. 좌우 택과 무관해 풍상/풍하로만 ' +
      '나눠, 위쪽 SOG 와 같은 풍상/풍하 구조로 나란히 봅니다 — 풍상·' +
      '풍하에서 더 빠를 때 실제로 더 애쓰는지 비교할 수 있습니다. ' +
      '평균은 시간가중, 상위 50%·20% 는 심박이 높은 구간의 시간가중 ' +
      '평균입니다 — 지속된 고심박 구간을 뜻하며 단일 순간 최고가 ' +
      '아닙니다. 신체 부하 참고 지표라 좋고 나쁨을 매기지 않습니다.'
  };

  /* 한 지표·방향의 '좋은 방향' 배지 HTML. withMode=true 면 풍상/풍하
     접두를 붙인다(풍각처럼 풍상·풍하 방향이 다른 지표용). */
  function statsDirBadge(row, withMode) {
    var dir = row.direction || 'neutral';
    var b = STATS_DIR_BADGE[dir] || STATS_DIR_BADGE.neutral;
    var txt = b.txt;
    if (dir === 'neutral') {
      var nk = (row.metric === 'twa') ? 'twa-' + row.mode : row.metric;
      if (STATS_NEUTRAL_NOTE[nk]) txt = STATS_NEUTRAL_NOTE[nk];
    }
    /* §410 — 풍상/풍하 접두·배지 문구를 i18nT 로 변환(노드가 '풍상 ▼ 낮을수록
       좋음' 처럼 합쳐져 DOM 번역이 못 닿던 잔존을 빌드 시점에 EN 으로). */
    var pre = withMode ? (i18nT(STATS_MODE_LABEL[row.mode]) + ' ') : '';
    return '<span class="stats-dir stats-dir--' + b.cls + '">' +
      esc(pre) + b.arrow + esc(i18nT(txt)) + '</span>';
  }
  function statsUnitOf(row) {
    return row.unit === 'speed' ? unitLabel()
      : (row.unit === 'deg' ? '°' : 'bpm');
  }
  /* 지표 그룹의 첫 칸(rowspan) — 지표명·단위·'좋은 방향' 배지.
     풍각은 풍상·풍하 방향이 달라 배지를 모드별로 둘 단다. rowspanN 은
     그 지표가 차지하는 표 행 수(= 방향(풍상/풍하) 수). */
  function statsMetricCell(rows, rowspanN) {
    var r0 = rows[0];
    /* §410 — 지표명(SOG (속도)·VMG (풍상·풍하 유효속도)·심박수 (HR) 등)을
       i18nT 로 변환. 단위와 합쳐진 'SOG (속도) (kt)' 노드를 빌드 시 EN 으로. */
    var nameTxt = i18nT(r0.label) + ' (' + statsUnitOf(r0) + ')';
    var tip = STATS_TIP[r0.metric];
    var nameHtml = '<span class="stats-mx__name">' +
      (tip ? tipLabel(nameTxt, tip) : esc(nameTxt)) + '</span>';
    var dirs = {};
    rows.forEach(function (r) { dirs[r.mode] = r.direction; });
    var badges;
    if (dirs.upwind && dirs.downwind && dirs.upwind !== dirs.downwind) {
      var up = rows.filter(function (r) { return r.mode === 'upwind'; })[0];
      var dn = rows.filter(function (r) { return r.mode === 'downwind'; })[0];
      badges = statsDirBadge(up, true) + statsDirBadge(dn, true);
    } else {
      badges = statsDirBadge(r0, false);
    }
    return '<td class="stats-table__metric" rowspan="' + rowspanN + '">' +
      nameHtml + '<span class="stats-mx__dir">' + badges + '</span></td>';
  }
  /* 방향(풍상/풍하) 칸 — 포트·스타보드가 열(column)로 빠지면서 한
     방향이 표의 한 행이 됐다. rowspan 없이 행마다 한 번만 둔다
     (Danny 2026-05-23: 포트/스타보드 반복 행 완전 제거). label 은
     렌더 루프가 정한 최종 문구('풍상'·'풍하'·'풍상 전체' 등). */
  function statsModeCell(label) {
    return '<td class="stats-dir-cell">' +
      '<span class="stats-bucket__mode">' + esc(label) + '</span></td>';
  }
  /* 한 통계값 텍스트 — which: 'avg'|'tier50'|'tier20'. 힐은 좌우 대비가
     한눈에 보이도록 양수에 + 부호를 명시한다(포트 −, 스타보드 +). */
  function statsFmtValue(row, which) {
    var v = row[which];
    if (v == null || !isFinite(v)) return '—';
    if (row.unit === 'speed') return fmtSpeed(v);
    if (row.unit === 'deg') {
      var t = v.toFixed(1);
      return (row.metric === 'heel' && v > 0) ? '+' + t : t;
    }
    return String(Math.round(v));
  }
  /* 한 통계값 셀 — 숫자만 둔다(컬럼 헤더가 의미를 전한다). cls 는
     선택적 td 클래스(포트/스타보드 경계 구분선 등). */
  function statsValueCell(row, which, cls) {
    return '<td' + (cls ? ' class="' + cls + '"' : '') +
      '><span class="stats-val">' + statsFmtValue(row, which) + '</span></td>';
  }
  /* 한 택(포트 또는 스타보드)의 세 값 칸 — 평균·상위50%·상위20%.
     평균은 그 방향 행(풍상/풍하)의 시간가중 평균(row.avg) — 상위 구간
     처럼 방향별로 다른 값이다 (Danny 2026-05-25: G 에서 뺐던 평균
     컬럼 복원, 소통오류였음). 버킷 결측 시 세 칸 모두 '—'. 포트 그룹의
     마지막 칸에는 좌우 경계 구분선 클래스(stats-c-div)를 붙인다. */
  function statsSideValues(row, side) {
    var endCls = (side === 'P') ? 'stats-c-div' : '';
    if (!row) {
      var dash = '<td><span class="stats-val">—</span></td>';
      return dash + dash +
        '<td' + (endCls ? ' class="' + endCls + '"' : '') +
        '><span class="stats-val">—</span></td>';
    }
    return statsValueCell(row, 'avg') + statsValueCell(row, 'tier50') +
      statsValueCell(row, 'tier20', endCls);
  }
  /* 좌우 택 분할이 없는 지표(심박)의 값 줄 — 포트·스타보드 두 열에
     걸쳐(colspan 2) 상위50%/상위20% 를 한 번씩만 둔다. 어느 열에
     걸치는지와 무관하게 읽히도록 칸 안에 작은 구간 라벨을 함께 둔다. */
  function statsUnsplitValues(row) {
    var tiers = [['avg', '평균'], ['tier50', '상위 50%'], ['tier20', '상위 20%']];
    return tiers.map(function (t) {
      return '<td colspan="2" class="stats-unsplit-cell">' +
        '<span class="stats-unsplit-tier">' + t[1] + '</span>' +
        '<span class="stats-val">' + statsFmtValue(row, t[0]) + '</span></td>';
    }).join('');
  }

  function renderStatsPanel() {
    var body = $('stats-panel-body');
    if (!body) return;
    var a = state.analysis;
    if (!a || !state.session || !state.session.hasTime) {
      body.innerHTML = '<p class="empty-note">시각 정보가 없어 퍼포먼스 ' +
        '통계를 계산할 수 없습니다.</p>';
      return;
    }
    var data = An.computeStatsPanel(a);
    if (!data.rows.length) {
      body.innerHTML = '<p class="empty-note">풍향을 확정하면 SOG·VMG·CWA ' +
        '통계가, 심박 데이터가 있으면 심박 통계가 이 표에 표시됩니다.</p>';
      return;
    }
    /* 지표별 그룹 — rows 는 이미 지표 순서로 나온다. 각 지표는 첫 행에
       rowspan 으로 지표 칸을 한 번만 두고, 그 안에서 풍상/풍하도 좌측에
       rowspan 앵커로 한 번씩만 두어(라벨 반복 제거) 포트/스타보드 세부를
       그 오른쪽으로 펼친다. */
    var groups = [], byMetric = {};
    data.rows.forEach(function (row) {
      if (!byMetric[row.metric]) {
        byMetric[row.metric] = [];
        groups.push(byMetric[row.metric]);
      }
      byMetric[row.metric].push(row);
    });
    /* 헤더는 2단 — 포트·스타보드를 좌우 '열 그룹'으로 한 번씩만 둔다
       (Danny 2026-05-23: 포트/스타보드가 지표마다 반복되던 '택' 행을
       완전히 제거). 풍상/풍하는 행(rowspan), 포트·스타보드는 열. */
    var html = '<div class="stats-panel-wrap"><table class="rd-table stats-table">' +
      '<thead>' +
      '<tr>' +
      '<th class="stats-table__metric" rowspan="2">지표 (단위)</th>' +
      '<th class="stats-table__bucket" rowspan="2">방향</th>' +
      '<th class="stats-side-head stats-side-head--p" colspan="3">포트</th>' +
      '<th class="stats-side-head stats-side-head--s" colspan="3">스타보드</th>' +
      '</tr>' +
      '<tr>' +
      '<th>평균<small>시간가중</small></th>' +
      '<th>상위 50%<small>노이즈 거부</small></th>' +
      '<th class="stats-c-div">상위 20%<small>노이즈 거부</small></th>' +
      '<th>평균<small>시간가중</small></th>' +
      '<th>상위 50%<small>노이즈 거부</small></th>' +
      '<th>상위 20%<small>노이즈 거부</small></th>' +
      '</tr>' +
      '</thead><tbody>';
    groups.forEach(function (rows) {
      /* 한 지표를 방향(풍상/풍하)별로 묶고, 각 방향 안에서 택별(P/S)
         행과 양 택 합산(전체) 행을 분리한다. P|S 행은 한 줄에 좌·우로
         펼치고, 합산 행은 심박처럼 좌우 미분할(statsUnsplitValues)로
         렌더한다 — VMG 풍상에만 합산 행이 붙는다 (Danny 2026-05-24). */
      var metricSplit = rows.some(function (r) { return r.side != null; });
      var modeOrder = [], byMode = {};
      rows.forEach(function (row) {
        var mk = row.mode || '_';
        if (!byMode[mk]) {
          byMode[mk] = { P: null, S: null, all: null };
          modeOrder.push(mk);
        }
        var b = byMode[mk];
        if (row.side === 'P') b.P = row;
        else if (row.side === 'S') b.S = row;
        else b.all = row;
      });
      /* 이 지표가 만들 <tr> 목록 — 방향마다 P|S 행, 있으면 합산 행 */
      var trs = [];
      modeOrder.forEach(function (mk, mi) {
        var b = byMode[mk];
        var modeLabel = mk ? (STATS_MODE_LABEL[mk] || mk) : '전체';
        if (b.P || b.S) {
          trs.push({ kind: 'split', P: b.P, S: b.S,
            modeLabel: modeLabel, newMode: (mi > 0) });
        }
        if (b.all) {
          /* 택 분할 지표(VMG)의 합산 행은 '풍상 전체'로 명시하고,
             미분할 지표(심박)는 방향 라벨('풍상'/'풍하') 그대로 둔다. */
          trs.push({ kind: 'unsplit', row: b.all,
            modeLabel: metricSplit ? (modeLabel + ' 전체') : modeLabel,
            newMode: (mi > 0 && !(b.P || b.S)) });
        }
      });
      trs.forEach(function (t, ti) {
        var first = (ti === 0);
        var cls = 'stats-row stats-row--' + esc(rows[0].metric);
        if (first) cls += ' stats-row--group';
        else if (t.newMode) cls += ' stats-row--mode';   // 풍하 행 구분선
        html += '<tr class="' + cls + '">';
        if (first) html += statsMetricCell(rows, trs.length);
        html += statsModeCell(t.modeLabel);
        if (t.kind === 'split') {
          html += statsSideValues(t.P, 'P') + statsSideValues(t.S, 'S');
        } else {
          html += statsUnsplitValues(t.row);
        }
        html += '</tr>';
      });
    });
    html += '</tbody></table></div>';

    var foot = [];
    if (data.windAvailable) {
      foot.push('풍상·풍하 통계는 풍향 확정 후 주행 표본의 시간가중값입니다 ' +
        '(풍상 ' + fmtDur(data.upwindTimeSec) + ' · 풍하 ' +
        fmtDur(data.downwindTimeSec) + ' 기준).');
    } else {
      foot.push('풍향을 확정하면 SOG·VMG·CWA 통계가 이 표에 추가됩니다.');
    }
    foot.push('SOG·VMG·CWA·힐·피치는 풍상/풍하 × 포트/스타보드 4 버킷으로 ' +
      '나눠 좌우 택 차이를 함께 봅니다(심박은 좌우 택과 무관해 분할하지 ' +
      '않고 풍상/풍하로만 나눔). 평균·상위 50%·상위 20% 세 구간을 두며, ' +
      '평균은 그 방향(풍상/풍하)의 시간가중 평균, 상위 N% 는 시간가중 ' +
      '구간 평균(단일 GPS 포인트 노이즈 배제)입니다. \'상위\'는 지표의 ' +
      '좋은 방향 기준이며(SOG·VMG 높은 값, 풍상 CWA 좁은 각), 중립 ' +
      '지표는 크기가 큰 값 쪽입니다. 힐은 포트(−)·스타보드(+) 부호 ' +
      '그대로 표시합니다.');
    html += '<p class="stats-note">' + esc(foot.join(' ')) + '</p>';
    body.innerHTML = html;
  }

  /* ---------- 세션 평균 스트립 — SPS 카드 바로 아래 (G · Danny 2026-05-24)
     포트·스타보드 × 풍상·풍하 4 그룹, 각 그룹의 VMG·풍각·SOG 평균값.
     퍼포먼스 통계 표에서 떼어낸 '평균'을 한 줄 가로 스트립으로 모은다.
     풍향 확정 시에만 표시(없으면 카드 숨김). 심박(HR)은 포함하지 않는다.
     값 셀은 무색, 좌우(포트/스타보드) 구분만 그룹 헤더 색으로. */
  function renderSessionAvg() {
    var card = $('session-avg-card');
    if (!card) return;
    var a = state.analysis;
    var w = a && a.wind && a.wind.tackSplit;
    if (!w || !state.session || !state.session.hasTime) {
      card.hidden = true; card.innerHTML = '';
      return;
    }
    card.hidden = false;
    var groups = [
      { mode: 'upwind',   side: 'P', label: '포트 · 풍상',     cls: 'p' },
      { mode: 'upwind',   side: 'S', label: '스타보드 · 풍상', cls: 's' },
      { mode: 'downwind', side: 'P', label: '포트 · 풍하',     cls: 'p' },
      { mode: 'downwind', side: 'S', label: '스타보드 · 풍하', cls: 's' }
    ];
    var metrics = [['vmg', 'VMG'], ['twa', 'CWA'], ['sog', 'SOG']];
    var blocks = groups.map(function (g) {
      var grp = w[g.mode] && w[g.mode][g.side];
      var rows = metrics.map(function (m) {
        var st = grp && grp[m[0]];
        var has = !!(grp && grp.count && st &&
                     st.avg != null && isFinite(st.avg));
        var val, unit;
        if (!has) { val = '—'; unit = ''; }
        else if (m[0] === 'twa') { val = Math.round(st.avg) + ''; unit = '°'; }
        else { val = fmtSpeed(st.avg); unit = unitLabel(); }
        return '<div class="savg-row">' +
          '<span class="savg-k">' + m[1] + '</span>' +
          '<span class="savg-v">' + val +
          (unit ? ' <small>' + unit + '</small>' : '') + '</span></div>';
      }).join('');
      return '<div class="savg-group savg-group--' + g.cls + '">' +
        '<div class="savg-group__hd">' + g.label + '</div>' + rows + '</div>';
    }).join('');
    card.innerHTML =
      '<div class="card__head"><h3>세션 평균</h3>' +
      '<span class="card__hint">포트·스타보드 × 풍상·풍하 평균 — ' +
      'VMG·CWA·SOG · 구간 통계(상위 50%·20%)는 아래 퍼포먼스 통계 표</span>' +
      '</div>' +
      '<div class="savg-strip">' + blocks + '</div>';
  }

  function renderHistogram() {
    if (!state.session.hasTime) {
      chartEmpty('histogram-chart', '시각 정보 없음'); return;
    }
    chartShow('histogram-chart');
    /* 자잘한 구간은 renderHistogram 내부에서 체류 비율 임계로 단일
       '기타' 조각에 자동 병합한다 (Danny 2026-05-25) — 추가 옵션 불필요. */
    Charts.renderHistogram('histogram-chart', state.analysis.histogram,
      { unit: state.unit });
  }

  function renderRunsHint() {
    var r = state.analysis.runs;
    $('runs-hint').textContent = r && r.runs.length
      ? '임계 ' + fmtSpeed(r.thresholdMs, 0) + ' ' + unitLabel() + ' 이상'
      : '';
  }
  function renderRuns() {
    var box = $('runs-list');
    if (!state.session.hasTime) { box.innerHTML = '<p class="empty-note">시각 정보 없음</p>'; return; }
    renderRunsHint();
    var runs = state.analysis.runs.runs;
    if (!runs.length) { box.innerHTML = '<p class="empty-note">검출된 고속 구간이 없습니다.</p>'; return; }
    var sel = state.selectedRun;
    box.innerHTML = runs.slice(0, 6).map(function (r, i) {
      /* 구간 평균 심박수 — HR 이 기록된 세션만 표시(없으면 생략) */
      var hr = (r.avgHr != null)
        ? ' · <span class="run-row__hr">♥ ' + Math.round(r.avgHr) + ' bpm</span>'
        : '';
      var on = (i === sel);
      return '<div class="run-row run-row--clickable' +
        (on ? ' run-row--selected' : '') + '" data-run="' + i + '"' +
        ' role="button" tabindex="0" aria-pressed="' + (on ? 'true' : 'false') +
        '" title="클릭하면 지도에 이 구간 트랙이 표시됩니다">' +
        '<span class="run-row__rank">' + (i + 1) + '</span>' +
        '<span class="run-row__main"><strong>' + fmtSpeedU(r.avgSpeedMs) + '</strong>' +
        ' <span class="run-row__sub">' + i18nT('평균 · 최고') + ' ' + fmtSpeedU(r.maxSpeedMs) +
        hr + '</span></span>' +
        '<span class="run-row__meta">' + fmtDur(r.durationSec) + ' · ' +
        Math.round(r.distanceM) + ' m · ' + Math.round(r.heading) + '° ' +
        compass(r.heading) + '</span></div>';
    }).join('');
  }

  /* ---------- 고속 구간(run) 선택 — 지도 트랙 강조 ----------
     같은 항목을 다시 누르면 선택이 해제된다. */
  function selectRun(i) {
    if (!state.analysis || !state.analysis.runs) return;
    var runs = state.analysis.runs.runs;
    if (!(i >= 0 && i < runs.length)) return;
    state.selectedRun = (state.selectedRun === i) ? null : i;
    var run = state.selectedRun != null ? runs[state.selectedRun] : null;
    Charts.highlightMapRun(run);
    renderRuns();
    if (run) {
      var mapCard = document.querySelector('.card--map');
      if (mapCard) mapCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ---------- 풍향 UI (Vantage 스타일: 미리보기 → 확정) ---------- */
  /* 풍향 화살표 격자를 일반(#wind-arrows) + 전체화면(#fs-wind-arrows) 양쪽에
     채운다 — 전체화면 진입 시 같은 풍향 오버레이가 보이도록 (§417). */
  function buildWindArrows() {
    // 화살표 길이 3배 — 위치·개수·각도·굵기·화살촉 크기는 그대로,
    // 길이만 3배(21→63)로 늘려 지도에서 풍향을 더 또렷이 읽게 한다.
    var svg = '<svg width="20" height="69" viewBox="0 0 20 69">' +
      '<line x1="10" y1="66" x2="10" y2="14" stroke="#0A2540" stroke-width="2.4" ' +
      'stroke-linecap="round"/><path d="M10 3 L4 14 L16 14 Z" fill="#0A2540"/></svg>';
    var html = '';
    for (var i = 0; i < 24; i++) html += '<span class="wa">' + svg + '</span>';
    ['wind-arrows', 'fs-wind-arrows'].forEach(function (id) {
      var box = $(id);
      if (box && !box.children.length) box.innerHTML = html;
    });
  }
  function updateWindArrows(deg) {
    ['wind-arrows', 'fs-wind-arrows'].forEach(function (id) {
      var box = $(id);
      if (!box) return;
      if (deg == null) { box.classList.remove('is-on'); return; }
      box.classList.add('is-on');
      // 화살표는 바람이 흘러가는 방향(풍하)을 가리킴
      box.style.setProperty('--wind-rot', ((deg + 180) % 360) + 'deg');
    });
  }

  /* ---------- 풍향 모눈종이 그리드 (지도 오버레이) ----------
     흰 그리드가 풍향과 함께 회전하며, 바람 기준 ±45°(전형적 클로즈홀드
     택 각도)에 고정된다 — 즉 그리드 라인이 풍상 포트·스타보드 택의
     항로 방향을 나타낸다. 풍향을 드래그할 때 그리드 ±45° 라인이 실제
     포트·스타보드 풍상 항적과 가장 잘 맞는 순간, 곧 정렬도
     (An.tackAlignment)가 국소 최댓값에 닿는 순간 그리드 선이 반짝
     (glint)이며 순간적으로 굵어진다 — 정확한 풍향을 찾는 시각 피드백.
     정렬도 계산은 풍향 자동 추정(estimateWindFromTrack)과 같은 함수를
     공유한다. */
  var WG = {
    deg: null,             // 현재 그리드 각(= 풍향, null 이면 정적 0°)
    gap: 38,               // 그리드 간격(px)
    glintT0: 0,            // glint 펄스 시작 시각
    glintRaf: 0,           // glint rAF 핸들
    armed: true,           // 다음 정렬 피크에서 glint 발동 가능 여부
    peak: 0,               // 세션 전체 정렬도 최댓값(적응형 임계용)
    peakSession: null      // peak 를 산출한 세션 참조
  };
  var WG_GLINT_MS = 520;

  function nowMs() {
    return (window.performance && performance.now)
      ? performance.now() : Date.now();
  }

  function resizeWindGrid() {
    var dpr = window.devicePixelRatio || 1;
    ['wind-grid', 'fs-wind-grid'].forEach(function (id) {
      var cv = $(id);
      if (!cv) return;
      var w = cv.clientWidth, h = cv.clientHeight;
      if (w <= 0 || h <= 0) return;   // 숨김(전체화면 닫힘) 상태면 0 → 건너뜀
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    });
  }

  /* 풍향 그리드 1회 그리기 — angleDeg(null=정적 0°) · glint 펄스 0~1.
     정사각 그리드를 풍향+45°로 회전해 두 라인 군이 ±45° 택 방향을
     따라가게 한다(정사각이라 90° 주기 — +45°·−45° 결과가 동일). */
  function drawWindGrid(angleDeg, pulse) {
    pulse = pulse || 0;
    var dpr = window.devicePixelRatio || 1;
    var rot = ((angleDeg == null ? 0 : angleDeg + 45) * Math.PI) / 180;
    // 일반(#wind-grid) + 전체화면(#fs-wind-grid) 양쪽 캔버스를 각자
    // 고유 크기로 그린다 (§417). 숨김 캔버스(width 0)는 건너뛴다.
    ['wind-grid', 'fs-wind-grid'].forEach(function (id) {
      var cv = $(id);
      if (!cv || !cv.getContext) return;
      var w = cv.width, h = cv.height;
      if (w <= 0 || h <= 0) return;
      var ctx = cv.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var gap = WG.gap * dpr;
      var diag = Math.sqrt(w * w + h * h);
      var half = Math.ceil(diag / 2 / gap) * gap + gap;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.42 * pulse) + ')';
      ctx.lineWidth = (1 + 2.4 * pulse) * dpr;
      if (pulse > 0) {
        ctx.shadowColor = 'rgba(255,255,255,0.92)';
        ctx.shadowBlur = 6 * pulse * dpr;
      }
      var x, y;
      for (x = -half; x <= half; x += gap) {
        ctx.beginPath(); ctx.moveTo(x, -half); ctx.lineTo(x, half); ctx.stroke();
      }
      for (y = -half; y <= half; y += gap) {
        ctx.beginPath(); ctx.moveTo(-half, y); ctx.lineTo(half, y); ctx.stroke();
      }
      ctx.restore();
    });
  }

  /* glint 펄스 모양 — 0→1→0 (반 사인) */
  function glintPulse() {
    if (!WG.glintT0) return 0;
    var t = (nowMs() - WG.glintT0) / WG_GLINT_MS;
    if (t < 0 || t >= 1) return 0;
    return Math.sin(Math.PI * t);
  }
  /* 그리드 선이 반짝이며 순간 굵어지는 glint 애니메이션 시작 */
  function startGlint() {
    WG.glintT0 = nowMs();
    if (WG.glintRaf) return;            // 이미 펄스 루프가 돌고 있으면 재사용
    (function loop() {
      var p = glintPulse();
      drawWindGrid(WG.deg, p);
      if (p > 0) {
        WG.glintRaf = window.requestAnimationFrame(loop);
      } else {
        WG.glintRaf = 0; WG.glintT0 = 0;
        drawWindGrid(WG.deg, 0);
      }
    })();
  }

  /* 세션 전체 정렬도 최댓값 — glint 적응형 임계용 (세션당 1회 산출) */
  function windGridPeak() {
    if (WG.peakSession === state.session) return WG.peak;
    WG.peakSession = state.session;
    WG.peak = 0;
    if (state.session && An.headingHistogram && An.tackAlignment) {
      var hh = An.headingHistogram(state.session);
      if (hh && hh.total > 0) {
        for (var d = 0; d < 360; d += 2) {
          var s = An.tackAlignment(state.session, d, hh).score;
          if (s > WG.peak) WG.peak = s;
        }
      }
    }
    return WG.peak;
  }

  /* 풍향 그리드 갱신 — 회전 + 정렬 glint 판정.
     deg 가 그리드를 정렬도 국소 최댓값에 올려놓는 순간 glint 발동. */
  function updateWindGrid(deg) {
    WG.deg = deg;
    if (!WG.glintRaf) drawWindGrid(deg, glintPulse());
    if (deg == null || !state.session ||
        !An.headingHistogram || !An.tackAlignment) {
      WG.armed = true;
      return;
    }
    var hh = An.headingHistogram(state.session);
    if (!hh || hh.total <= 0) return;
    var thr = Math.max(0.12, 0.6 * windGridPeak());
    var here = An.tackAlignment(state.session, deg, hh).score;
    var lo = An.tackAlignment(state.session, deg - 3, hh).score;
    var hi = An.tackAlignment(state.session, deg + 3, hh).score;
    var isLocalMax = here >= lo && here >= hi && (here > lo || here > hi);
    if (here < 0.6 * thr) WG.armed = true;        // 골짜기로 빠지면 재장전
    if (WG.armed && isLocalMax && here >= thr) {
      WG.armed = false;
      startGlint();
    }
  }
  /* 현재 그리드가 따라야 할 풍향 — 미리보기(pending) 우선, 없으면 확정값 */
  function currentWindGridDeg() {
    return state.windPending != null ? state.windPending : state.windDir;
  }

  function wireWindControls() {
    var num = $('wind-dir-input'), rng = $('wind-dir-range');
    num.addEventListener('input', function () {
      var v = parseInt(num.value, 10);
      if (isFinite(v)) setWindPending(((v % 360) + 360) % 360);
    });
    rng.addEventListener('input', function () { setWindPending(parseInt(rng.value, 10)); });
    $('wind-speed-input').addEventListener('input', function () {
      var v = parseFloat(this.value);
      state.windSpeedKt = isFinite(v) ? v : null;
      renderSummaryStrip();
      if (state.analysis) renderSessionSummary();   // VPS·what-if 는 풍속 의존
    });
    $('wind-clear-btn').addEventListener('click', function () { setWindPending(null); });
    $('wind-confirm-btn').addEventListener('click', confirmWind);
    $('wind-estimate-btn').addEventListener('click', function () {
      /* 다중 소스(no-go zone + 회전 기하) 교차검증으로 권장값을 미리보기에
         적용한다. 소스별 값·신뢰도는 아래 "풍향 추정 소스" 패널에 함께
         표시된다 — 사용자가 비교 후 다른 소스를 골라 적용할 수도 있다. */
      var ws = An.buildWindSources({
        manualDir: null,
        nogo: sessionWindEstimate(state.session),
        rotation: sessionManeuverEstimate(state.session),
        weather: null
      });
      if (!ws.recommended) {
        $('wind-note').textContent =
          '풍상/풍하 주행과 택·자이브가 모두 부족해 풍향을 추정할 수 없습니다. ' +
          '리칭(횡주) 위주이거나 직진 구간이 적은 세션입니다 — 직접 설정해 주세요.';
        return;
      }
      var r = ws.recommended;
      setWindPending(r.windDir);
      $('wind-note').textContent = '권장 추정값 ' + r.windDir + '° (' +
        compass(r.windDir) + ') · 신뢰도 ' + i18nT(r.confidence) + ' — ' + r.note +
        ' 다이얼·슬라이더로 보정 후 “확정”을 누르세요.';
      renderWindSources();
    });
    // 다이얼 클릭으로 풍향 미리보기 설정
    $('wind-dial').addEventListener('click', function (e) {
      var r = this.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width * 120 - 60;
      var y = (e.clientY - r.top) / r.height * 120 - 60;
      setWindPending(Math.round((Math.atan2(x, -y) * 180 / Math.PI + 360)) % 360);
    });
  }

  /* 미리보기 값 갱신 — 분석은 갱신하지 않음 (다이얼·슬라이더·지도 화살표만) */
  function setWindPending(deg) {
    state.windPending = (deg == null || isNaN(deg)) ? null : (((deg % 360) + 360) % 360);
    renderWindUI();
  }
  /* 미리보기 값을 실제 풍향으로 확정 — 모든 분석 갱신 */
  function confirmWind() {
    state.windDir = state.windPending;
    /* §422 — 사용자가 직접 확정·해제하면 더 이상 자동 적용 상태가 아니다
       (수동 우선). 풍향 소스 패널이 '수동 입력 · 확정'으로 표시하도록. */
    state.windAutoApplied = null;
    state.selectedManeuvers = [];
    recompute();
    renderWindUI();
    renderWindSources();
    renderSummaryStrip();
    renderSessionAvg();
    renderStatsPanel();
    renderManeuverSection();
    renderViolin();
    renderTargetPolar();
    /* 심박 섹션도 반드시 재렌더한다 — 풍향이 확정되면 회전이 'turn' 에서
       택킹/자이빙 + 포트/스타보드로 재분류되므로, 스킬-심박수 표가 이를
       반영하도록 함께 다시 그린다. 이 호출 누락이 ① 4행 분리가 화면에
       안 보이던 버그의 원인이었다 (Danny 검토 2026-05-24 B). */
    renderHrSection();
    renderMapAndLegend();
    renderRuns();   // recompute 가 selectedRun 을 초기화 → 목록 강조도 갱신
    renderSpeedChart();
    renderSessionSummary();
    $('wind-note').textContent = windConfirmNote();
    /* 리플레이 뷰어가 열려 있으면 새 확정 풍향을 즉시 반영한다 —
       리플레이는 open() 시점 풍향을 캐시하므로 재확정 시 격자·ladder
       rung·세일이 갱신되도록 알린다 (Danny 2026-05-25). 닫혀 있으면
       다음 open() 이 state.windDir 을 새로 읽어 가므로 불필요. */
    if (window.RDReplay && RDReplay.isOpen()) {
      RDReplay.setWindDir(state.windDir);
    }
  }

  /* 풍향 확정 안내문을 현재 언어로 생성 — confirmWind 와 rd:langchange
     핸들러가 공유한다(중복 방지 + 토글 시 상세줄 유실 방지).
     §410 — 단일 i18nT 템플릿(compass 는 lang-aware → 방위 EN). */
  function windConfirmNote() {
    if (state.windDir == null) return i18nT('풍향이 해제되었습니다.');
    var note = i18nT(
      '✓ 풍향 {deg}° ({dir}) 확정 — 택킹/자이빙·VMG·폴라에 반영되었습니다.',
      { deg: state.windDir, dir: compass(state.windDir) });
    /* §428 — 옥대표님 "218→211 바꿔도 미미함". 헤드라인 합산 VMG 는
       cos(twa+δ)+cos(twa-δ)=2cos(twa)cos(δ) 로 2차 둔감이라 작은 풍향
       변화에 거의 안 움직인다. 그러나 신호는 포트/스타보드 비대칭에
       살아 있다(7° 변화에도 택별 ±10-15%, .repro-428 검증). 확정 직후
       방금 재계산된 택별 풍상 VMG 실측값을 함께 보여, 재계산이 실제로
       일어났고 변화가 어디에 있는지 사용자가 즉시 확인하게 한다. */
    var up = state.analysis && state.analysis.wind &&
             state.analysis.wind.tackSplit && state.analysis.wind.tackSplit.upwind;
    var pV = up && up.P && up.P.count && up.P.vmg && isFinite(up.P.vmg.avg) ? up.P.vmg.avg : null;
    var sV = up && up.S && up.S.count && up.S.vmg && isFinite(up.S.vmg.avg) ? up.S.vmg.avg : null;
    if (pV != null && sV != null) {
      note += '  ' + i18nT(
        '풍상 VMG — 포트 {p} · 스타보드 {s}. 작은 풍향 변화는 합산 평균보다 포트↔스타보드 균형을 주로 바꿉니다.',
        { p: fmtSpeedU(pV), s: fmtSpeedU(sV) });
    }
    return note;
  }

  function renderWindUI() {
    var num = $('wind-dir-input'), rng = $('wind-dir-range'), arrow = $('wind-arrow');
    var p = state.windPending, ro = $('wind-readout');
    if (p == null) {
      num.value = '';
      arrow.setAttribute('transform', 'rotate(0 60 60)');
      arrow.style.opacity = '0.2';
      ro.textContent = '풍향 미설정';
      ro.className = 'wind-dial__readout';
      updateWindArrows(state.windDir);   // 확정값이 있으면 그대로
      updateWindGrid(state.windDir);     // 그리드도 확정값(없으면 정적)
    } else {
      num.value = p; rng.value = p;
      arrow.setAttribute('transform', 'rotate(' + p + ' 60 60)');
      arrow.style.opacity = '1';
      var confirmed = (state.windDir === p);
      ro.textContent = '풍향 ' + p + '° (' + compass(p) + ') · ' +
        (confirmed ? i18nT('확정됨') : i18nT('미확정 — 확정 필요'));
      ro.className = 'wind-dial__readout' + (confirmed ? '' : ' is-pending');
      updateWindArrows(p);
      updateWindGrid(p);                 // 그리드를 미리보기 풍향으로 회전
    }
    var btn = $('wind-confirm-btn');
    btn.disabled = (state.windPending === state.windDir);
    btn.textContent = (state.windPending == null && state.windDir != null)
      ? '✓ 풍향 해제' : '✓ 이 풍향으로 확정';
  }

  /* ---------- 풍향 추정 소스 비교 패널 ----------
     수동 입력 · no-go zone 추정 · 회전 기하 추정 · 외부 날씨(준비 중)를
     한 패널에 나란히 놓아 값·신뢰도를 비교하고 골라 적용하게 한다.
     두 독립 추정(no-go·회전기하)이 일치하면 권장 신뢰도를 높여 표기. */
  var WIND_CONF_CLS = { '높음': 'high', '보통': 'mid', '낮음': 'low', '확정': 'set' };
  /* 신뢰도 칩 — i18n 토글 시 "신뢰도" 와 값을 각각 별도 텍스트노드로 두어야
     사전 매칭이 가능하다 (한 텍스트노드에 두 단어가 합쳐지면 walker 가
     trimmed 전체로만 MAP 조회 → 둘 다 번역되지 않음). Danny 2026-05-26. */
  function windConfChip(conf) {
    if (!conf) return '';
    var cls = WIND_CONF_CLS[conf] || 'low';
    return '<span class="wsrc__conf wsrc__conf--' + cls + '">' +
      '<span class="wsrc__conf-label">신뢰도</span> ' +
      '<span class="wsrc__conf-val">' + conf + '</span></span>';
  }
  /* 소스별 추정 근거 수치 — 단위 표기 일관(°, %p) */
  function windSourceDetail(s) {
    if (!s.detail) return '';
    var parts = [];
    if (s.id === 'nogo') {
      if (s.detail.noGoWidthDeg != null)
        parts.push('무항주 구역 폭 ' + s.detail.noGoWidthDeg + '°');
      if (s.detail.alignmentScore != null)
        parts.push('그리드 정렬도 ' + s.detail.alignmentScore.toFixed(2));
    } else if (s.id === 'rotation') {
      if (s.detail.maneuverCount != null)
        parts.push('회전 ' + s.detail.maneuverCount + '개');
      if (s.detail.spreadDeg != null)
        parts.push('추정 분산 ' + s.detail.spreadDeg + '°');
      if (s.detail.resolutionMarginPct != null)
        parts.push('풍상·풍하 판정 여유 ' + s.detail.resolutionMarginPct + '%p');
    }
    return parts.join(' · ');
  }
  function windSourceRow(s) {
    var valHtml = (s.windDir != null)
      ? Math.round(s.windDir) + '°<small> ' + compass(s.windDir) + '</small>'
      : '<span class="wsrc__none">—</span>';
    var applyBtn = '';
    if (s.id !== 'manual' && s.available && s.windDir != null) {
      applyBtn = '<button type="button" class="btn btn--sm btn--ghost wsrc__apply" ' +
        'data-apply-val="' + Math.round(s.windDir) + '">미리보기 적용</button>';
    }
    var mod = s.placeholder ? ' wsrc--soon' : (!s.available ? ' wsrc--na' : '');
    var detail = windSourceDetail(s);
    return '<div class="wsrc' + mod + '">' +
      '<div class="wsrc__row">' +
        '<span class="wsrc__label">' + s.label + '</span>' +
        '<span class="wsrc__val">' + valHtml + '</span>' +
        windConfChip(s.confidence) + applyBtn +
      '</div>' +
      '<p class="wsrc__note">' + s.note +
        (detail ? ' <span class="wsrc__detail">(' + detail + ')</span>' : '') +
      '</p>' +
    '</div>';
  }
  function windRecBanner(ws) {
    var r = ws.recommended;
    if (!r) {
      return '<div class="wsrc-rec wsrc-rec--none">' +
        '<p class="wsrc-rec__note">자동 추정에 쓸 풍상·풍하 주행이나 ' +
        '택·자이브가 부족합니다 — 다이얼·슬라이더로 직접 입력해 주세요.</p></div>';
    }
    if (r.sourceId === 'manual') {
      return '<div class="wsrc-rec wsrc-rec--set">' +
        '<div class="wsrc-rec__body">' +
          '<span class="wsrc-rec__tag">현재 적용</span>' +
          '<span class="wsrc-rec__val">' + Math.round(r.windDir) + '° ' +
            '<span class="wsrc-rec__compass">' + compass(r.windDir) +
            '</span></span>' + windConfChip('확정') +
        '</div>' +
        '<p class="wsrc-rec__note">' + r.note +
          ' 아래 추정값으로 바꾸려면 “미리보기 적용” 후 다시 확정해 주세요.</p>' +
      '</div>';
    }
    var cls = WIND_CONF_CLS[r.confidence] || 'low';
    return '<div class="wsrc-rec wsrc-rec--' + cls + '">' +
      '<div class="wsrc-rec__body">' +
        '<span class="wsrc-rec__tag">권장</span>' +
        '<span class="wsrc-rec__val">' + Math.round(r.windDir) + '° ' +
          '<span class="wsrc-rec__compass">' + compass(r.windDir) +
          '</span></span>' + windConfChip(r.confidence) +
        '<button type="button" class="btn btn--sm btn--primary wsrc__apply" ' +
          'data-apply-val="' + Math.round(r.windDir) + '">권장값 적용</button>' +
      '</div>' +
      '<p class="wsrc-rec__note">' + r.note + '</p>' +
    '</div>';
  }
  function renderWindSources() {
    var box = $('wind-sources');
    if (!box) return;
    if (!state.session) { box.hidden = true; box.innerHTML = ''; return; }
    var ws = An.buildWindSources({
      /* §422 — 자동 적용된 풍향은 '수동 입력'이 아니다. windAutoApplied 면
         manualDir 을 비워, 패널이 권장(추정) 소스를 그대로 표시하게 한다
         (자동값을 '수동 확정'으로 오표시 방지). 수동 확정이면 windDir 전달. */
      manualDir: state.windAutoApplied ? null : state.windDir,
      nogo: sessionWindEstimate(state.session),
      rotation: sessionManeuverEstimate(state.session),
      weather: null   // 외부 날씨 — API 키 연동 시 채워질 슬롯
    });
    /* 접기/펴기 — 풍향을 정하고 나면 4줄짜리 소스 목록을 접어 둘 수
       있다(화면 정리용). 접어도 현재 적용 풍향 배너는 남겨, 어떤 값이
       쓰이는지는 항상 보이게 한다. 기본값은 펼침(풍향 판단의 주 도구). */
    var collapsed = !!state.windSourcesCollapsed;
    box.classList.toggle('wind-sources--collapsed', collapsed);
    var html = '<div class="wsrc-head"><h4>풍향 추정 소스</h4>' +
      '<span class="wsrc-head__hint">여러 방식의 추정을 비교해 적용하세요</span>' +
      '<button type="button" class="wsrc-toggle" id="wsrc-toggle" ' +
      'aria-expanded="' + (collapsed ? 'false' : 'true') + '" ' +
      'aria-controls="wsrc-list">' +
      (collapsed ? '▸ 소스 펴기' : '▾ 소스 접기') + '</button></div>';
    html += windRecBanner(ws);
    html += '<div class="wsrc-list" id="wsrc-list">';
    ws.sources.forEach(function (s) { html += windSourceRow(s); });
    html += '</div>';
    box.hidden = false;
    box.innerHTML = html;
    /* 접기/펴기 토글 — 상태만 바꾸고 클래스·라벨을 갱신(재렌더 불필요) */
    var tgl = box.querySelector('#wsrc-toggle');
    if (tgl) {
      tgl.addEventListener('click', function () {
        state.windSourcesCollapsed = !state.windSourcesCollapsed;
        var col = state.windSourcesCollapsed;
        box.classList.toggle('wind-sources--collapsed', col);
        tgl.textContent = col ? '▸ 소스 펴기' : '▾ 소스 접기';
        tgl.setAttribute('aria-expanded', col ? 'false' : 'true');
      });
    }
    /* "미리보기 적용"·"권장값 적용" — 선택 소스 값을 미리보기로 올린다.
       실제 분석 반영은 사용자가 “확정”을 눌러야 일어난다(기존 흐름 유지). */
    Array.prototype.forEach.call(box.querySelectorAll('.wsrc__apply'),
      function (b) {
        b.addEventListener('click', function () {
          var v = parseInt(b.getAttribute('data-apply-val'), 10);
          if (!isFinite(v)) return;
          setWindPending(((v % 360) + 360) % 360);
          $('wind-note').textContent = '추정값 ' + v + '° (' + compass(v) +
            ') 을(를) 미리보기에 적용했습니다 — 다이얼로 보정 후 “확정”을 ' +
            '누르세요.';
        });
      });
  }

  /* ---------- Maneuver Analysis ---------- */
  var TYPE_META = {
    tack: { label: '택킹', cls: 'tack' },
    gybe: { label: '자이빙', cls: 'gybe' },
    turn: { label: '회전', cls: 'turn' }
  };

  function renderManeuverSection() {
    var a = state.analysis, ms = a.maneuverStats;
    if (!state.session.hasTime) {
      $('maneuver-stats').innerHTML = '<p class="empty-note">시각 정보가 없어 회전 분석 불가</p>';
      $('maneuver-bestworst').innerHTML = '';
      $('maneuver-tbody').innerHTML = '';
      var mq0 = $('maneuver-quality'); if (mq0) mq0.innerHTML = '';
      renderManeuverDetail();
      return;
    }
    // 집계 스탯 — 회전 개수만. 품질 지표(손실·회복·효율·회전 속도)는
    // 택킹·자이빙이 물리적으로 다른 기동이라 합산하지 않고,
    // renderManeuverQuality 가 유형별로 따로 표시한다.
    /* 회전 요약 타일 — 풍향 확정 시 5개:
       전체 회전 / 택킹 횟수 / 택킹 성공률 / 자이빙 횟수 / 자이빙 성공률.
       성공률 = 전체 시도 중 터치다운 없이(포일 유지) 완료한 비율.
       (Danny 검토 §issue-1) */
    function pctTile(rate) {
      return (rate == null) ? '—' : Math.round(rate) + '%';
    }
    /* 성공률 부제 — '성공/시도' 회수. 편집본은 분모(total)가 편집 전
       세션 전체 회전이라, 택킹·자이빙 횟수 타일(분석 구간 기준)과
       다를 수 있어 '세션 전체 기준' 임을 함께 적는다 (Danny 검토). */
    function successSub(succ, total) {
      if (!total) return null;
      return succ + ' / ' + total + '회 성공' +
        (ms.successRateWhole ? ' · 세션 전체 기준' : '');
    }
    var stats = statTile('전체 회전', ms.total + ' times');
    if (state.windDir != null) {
      stats += statTile('택킹 횟수', ms.tack + ' times');
      /* 성공률 — 미니 도넛 + 숫자 (Layer 1.5 — Danny 2026-05-26) */
      stats += statTile(tipLabel('택킹 성공률', SUCCESS_TIP),
        pctTile(ms.tackSuccessRate),
        successSub(ms.tackSuccess, ms.tackSuccessTotal),
        { donutPct: ms.tackSuccessRate });
      stats += statTile('자이빙 횟수', ms.gybe + ' times');
      stats += statTile(tipLabel('자이빙 성공률', SUCCESS_TIP),
        pctTile(ms.gybeSuccessRate),
        successSub(ms.gybeSuccess, ms.gybeSuccessTotal),
        { donutPct: ms.gybeSuccessRate });
    } else {
      stats += statTile('택킹 / 자이빙', '풍향 필요', '풍향 입력 시 분류');
    }
    $('maneuver-stats').innerHTML = stats;
    renderManeuverQuality();

    // 베스트 택킹 · 베스트 자이브
    var bw = '';
    if (ms.bestTackIdx >= 0) {
      bw += bwCard('베스트 택킹', a.maneuvers[ms.bestTackIdx], ms.bestTackIdx, 'good');
    }
    if (ms.bestGybeIdx >= 0) {
      bw += bwCard('베스트 자이빙', a.maneuvers[ms.bestGybeIdx], ms.bestGybeIdx, 'good');
    }
    if (!bw) {
      bw = '<p class="empty-note">' + (state.windDir == null
        ? '풍향을 입력하면 택킹·자이빙을 분류하고 베스트 회전을 가립니다.'
        : '검출된 택킹·자이빙이 없습니다.') + '</p>';
    }
    $('maneuver-bestworst').innerHTML = bw;

    renderManeuverGroups();
    renderManeuverTable();
    renderManeuverDetail();
  }

  /* 택킹·자이빙 품질 지표 — 평균 속도 손실·회복 시간·효율·회전 속도를
     택킹/자이빙 각각 따로 보여 준다. 택킹과 자이빙은 풍축 통과 감속
     정도가 달라(택킹은 크고 자이빙은 덜함) 합산 평균이 무의미하다.
     손실·회복·효율은 분석 엔진의 유형별 통계(groups)를 그대로 쓰고,
     회전 속도(°/s)만 엔진에 유형별 값이 없어 같은 식으로 여기서 낸다. */
  function renderManeuverQuality() {
    var box = $('maneuver-quality');
    if (!box) return;
    var a = state.analysis, ms = a.maneuverStats, g = ms.groups;
    /* 한 유형의 평균 회전 속도(°/s) — 엔진 avgTurnRateDegSec 와 같은 식
       (회전당 총 회전각 ÷ 지속 시간 의 평균). */
    function rateOf(type) {
      var rs = 0, rn = 0;
      (a.maneuvers || []).forEach(function (m) {
        if (type && m.type !== type) return;
        if (m.durationSec > 0) { rs += m.turnAngle / m.durationSec; rn++; }
      });
      return rn ? rs / rn : null;
    }
    /* 값 셀 — HR·P/S 표와 동일한 .stats-val 타이포 (Danny 검토 6차) */
    function cell(v, dec, suf) {
      return '<td><span class="stats-val">' +
        (v == null ? '—' : (dec ? v.toFixed(dec) : Math.round(v)) + suf) +
        '</span></td>';
    }
    function row(label, loss, rec, eff, rate) {
      return '<tr><td class="rd-grp">' + label + '</td>' +
        cell(loss, 0, '%') + cell(rec, 1, ' sec') +
        cell(eff, 0, ' score') + cell(rate, 1, ' °/s') + '</tr>';
    }
    var rows = '';
    if (state.windDir != null && (g.tack.all.count || g.gybe.all.count)) {
      if (g.tack.all.count) {
        rows += row('택킹', g.tack.all.lossAvg, g.tack.all.recAvg,
          g.tack.all.effAvg, rateOf('tack'));
      }
      if (g.gybe.all.count) {
        rows += row('자이빙', g.gybe.all.lossAvg, g.gybe.all.recAvg,
          g.gybe.all.effAvg, rateOf('gybe'));
      }
    } else if (ms.total) {
      /* 풍향 미설정 — 택킹·자이빙 분류 전이라 전체 회전 한 행으로 둔다 */
      rows += row('전체 회전', ms.avgLossPct, ms.avgRecoverySec,
        ms.avgEfficiency, ms.avgTurnRateDegSec);
    }
    if (!rows) { box.innerHTML = ''; return; }
    box.innerHTML =
      '<h4 class="mg-title">회전효율 — 택킹 · 자이빙 따로</h4>' +
      '<div class="mg-table-wrap"><table class="rd-table mg-table">' +
      '<thead><tr><th>종류</th>' +
      '<th>' + tipLabel('평균 속도 손실', LOSS_TIP) + '<small>%</small></th>' +
      '<th>' + tipLabel('평균 회복 시간', RECOVERY_TIP) + '<small>sec</small></th>' +
      '<th>' + tipLabel('평균 회전효율', EFF_TIP) + '<small>score</small></th>' +
      '<th>평균 회전 속도<small>°/s</small></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      '<p class="mg-foot">택킹과 자이빙은 풍축 통과 감속이 달라 회전효율을 ' +
      '합산하지 않고 유형별로 나눠 봅니다.</p>';
  }

  /* 택킹·자이빙 기술 — 종류 × 전환 방향(P→S / S→P / 종합)별 효율 분포.
     grp.P = 진입 택이 포트인 회전(= 포트→스타보드 전환),
     grp.S = 진입 택이 스타보드인 회전(= 스타보드→포트 전환). */
  function renderManeuverGroups() {
    var box = $('maneuver-groups');
    if (!box) return;
    var g = state.analysis.maneuverStats.groups;
    if (state.windDir == null || (!g.tack.all.count && !g.gybe.all.count)) {
      box.innerHTML = ''; return;
    }
    /* 값 셀 — HR 표와 동일한 .stats-val 타이포로 렌더. 표 셀에는 상태색
       틴트를 넣지 않는다 — 색 없이 숫자만 (Danny 검토 2026-05-24 6차). */
    function valSpan(inner) {
      return '<td><span class="stats-val">' + inner + '</span></td>';
    }
    /* 평균 ± 표준편차 셀 (표본 1개면 ± 생략, 0개면 —) */
    function avgSdCell(avg, sd, n, suf) {
      if (avg == null) return valSpan('—');
      return valSpan(Math.round(avg) +
        (n >= 2 && sd != null ? ' <small>± ' + Math.round(sd) + '</small>' : '') +
        (suf || ''));
    }
    function valCell(v) {
      return valSpan(v == null ? '—' : Math.round(v));
    }
    function rows(typeLabel, grp) {
      /* 행 순서 — P→S, S→P, 종합(맨 아래). 종류 칸은 그룹 전체를 rowspan
         으로 묶어 반복을 없앤다 (Danny 검토 2026-05-24 6차). */
      var sides = [['포트 → 스타보드 (P→S)', grp.P, 'p'],
                   ['스타보드 → 포트 (S→P)', grp.S, 's'],
                   ['종합', grp.all, 'all']];
      return sides.map(function (s, idx) {
        var x = s[1];
        return '<tr class="mg-row mg-row--' + s[2] + (idx === 0 ? ' mg-row--head' : '') + '">' +
          (idx === 0 ? '<td class="rd-grp" rowspan="' + sides.length + '">' +
            typeLabel + '</td>' : '') +
          '<td>' + s[0] + '</td>' +
          valSpan(x.count) +
          avgSdCell(x.effAvg, x.effSd, x.count, '') +
          valCell(x.effTop50) +
          valCell(x.effTop20) +
          avgSdCell(x.lossAvg, x.lossSd, x.count, '') +
          '</tr>';
      }).join('');
    }
    box.innerHTML =
      '<h4 class="mg-title">택킹·자이빙 기술 — 포트 / 스타보드별</h4>' +
      '<div class="mg-table-wrap"><table class="rd-table mg-table">' +
      '<thead><tr><th>종류</th><th>구분</th><th>회전수<small>times</small></th>' +
      '<th>' + tipLabel('평균 회전효율', EFF_TIP) + '<small>score</small></th>' +
      '<th>상위 50%<small>score</small></th><th>상위 20%<small>score</small></th>' +
      '<th>' + tipLabel('평균 손실', LOSS_TIP) + '<small>%</small></th></tr></thead>' +
      '<tbody>' + rows('택킹', g.tack) + rows('자이빙', g.gybe) + '</tbody>' +
      '</table></div>' +
      '<p class="mg-foot">회전효율 점수 0–100점 척도 · 평균 회전효율·손실의 ± 는 ' +
      '표준편차(±1σ) · 상위 n% 는 회전효율 높은 회전 순 평균</p>';
  }

  /* 베스트 콜아웃 카드 — 한 줄 가로 배치(좁으면 최대 2줄). 좌측 클러스터
     (라벨 + #번호 + 유형 배지)와 우측 클러스터(손실·회복·효율 메트릭)를
     좌우로 펼쳐 카드 우측 공백을 없앤다 (Danny 검토 2026-05-24). */
  function bwCard(title, m, idx, tone) {
    var tm = TYPE_META[m.type];
    return '<button type="button" class="bw-card bw-card--' + tone +
      '" data-mv="' + idx + '">' +
      '<span class="bw-card__lead">' +
        '<span class="bw-card__title">' + title + '</span>' +
        '<span class="bw-card__head">#' + (idx + 1) +
        ' <span class="mv-badge mv-badge--' + tm.cls + '">' + tm.label + '</span></span>' +
      '</span>' +
      '<span class="bw-card__metrics">' +
        i18nT('손실 {loss}% · 회복 {rec} · 회전효율 {eff} score', {
          loss: Math.round(m.lossDisplayPct),
          rec: (m.recoverySec != null ? m.recoverySec.toFixed(1) + ' sec' : '—'),
          eff: m.efficiency
        }) +
      '</span></button>';
  }

  function renderManeuverTable() {
    var ms = state.analysis.maneuverStats;
    // 풍향 미확정 — 회전을 택킹·자이빙으로 분류할 수 없으므로, 미분류 회전
    // 목록을 그대로 쏟아내지 않고 안내를 표시한다. 풍향 확정 후 진짜
    // 택킹·자이빙(S→S·P→P 제외)만 목록에 나타난다.
    if (state.windDir == null) {
      var cBox = $('mv-list-controls');
      if (cBox) cBox.hidden = true;
      var lg = $('mv-legend'); if (lg) { lg.hidden = true; lg.innerHTML = ''; }
      $('maneuver-thead-row').innerHTML = '';
      $('maneuver-tbody').innerHTML =
        '<tr><td colspan="11" class="mv-need-wind">' +
        '<b>풍향을 먼저 설정하세요.</b><br>' +
        '풍향이 확정되면 회전이 택킹·자이빙으로 분류되어, 풍축을 넘는 ' +
        '진짜 택킹·자이빙만 골라 여기에 표시됩니다. 위 <b>풍향 설정</b> ' +
        '카드에서 풍향을 확정해 주세요.</td></tr>';
      $('mv-list-note').textContent = '';
      return;
    }
    var cShow = $('mv-list-controls');
    if (cShow) cShow.hidden = false;
    var filter = state.maneuverFilter || 'all';
    // 접힌 기본 상태에서 회전 종류별로 미리 보여줄 개수 ("자세히" → 전체)
    var PREVIEW_CAP = 5;
    // 인덱스(지도 번호와 일치) 보존하며 필터
    var all = state.analysis.maneuvers.map(function (m, i) { return { m: m, i: i }; });
    var rows = (filter === 'all') ? all
      : all.filter(function (r) { return r.m.type === filter; });
    var totalInFilter = rows.length;
    // 기본은 종류별 PREVIEW_CAP 회까지만, "자세히" 누르면 전체
    var shown = rows;
    if (!state.maneuverShowAll) {
      if (filter === 'all') {
        var cap = { tack: 0, gybe: 0, turn: 0 };
        shown = rows.filter(function (r) {
          var t = r.m.type;
          if (cap[t] < PREVIEW_CAP) { cap[t]++; return true; }
          return false;
        });
      } else {
        shown = rows.slice(0, PREVIEW_CAP);
      }
    }
    // 헤더 — 단위는 제목에 (속도 단위는 토글 연동)
    var u = unitLabel();
    $('maneuver-thead-row').innerHTML =
      '<th>#</th><th>종류</th><th>방향</th><th>시각</th>' +
      '<th>' + i18nT('진입') + ' (' + u + ')</th><th>' + i18nT('최저') + ' (' + u +
        ')</th><th>' + i18nT('탈출') + ' (' + u + ')</th>' +
      '<th>' + tipLabel('손실 (%)', LOSS_TIP) + '</th>' +
      '<th>' + tipLabel('소요 (sec)', DURATION_TIP) + '</th>' +
      '<th>' + tipLabel('회복 (sec)', RECOVERY_TIP) + '</th>' +
      '<th>' + tipLabel('회전효율 (score)', EFF_TIP) + '</th>';

    var html = shown.map(function (r) {
      var m = r.m, i = r.i, tm = TYPE_META[m.type];
      var effCls = m.efficiency >= 70 ? 'eff--hi' : (m.efficiency >= 45 ? 'eff--mid' : 'eff--lo');
      // 베스트 회전 — 인라인 태그 대신 행 전체를 그라데이션으로 하이라이트
      // (# 컬럼 폭 정상화 · 좌측 공백 제거). 의미는 목록 위 범례로 안내.
      var rowCls = [];
      if (i === ms.bestTackIdx || i === ms.bestGybeIdx) rowCls.push('is-best');
      if (state.selectedManeuvers.indexOf(i) >= 0) rowCls.push('is-selected');
      return '<tr data-mv="' + i + '"' +
        (rowCls.length ? ' class="' + rowCls.join(' ') + '"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><span class="mv-badge mv-badge--' + tm.cls + '">' + tm.label + '</span></td>' +
        '<td>' + maneuverDir(m) + '</td>' +
        '<td>' + fmtClock(m.tSec) + '</td>' +
        '<td>' + fmtSpeed(m.entrySpeedMs) + '</td>' +
        '<td>' + fmtSpeed(m.minSpeedMs) + '</td>' +
        '<td>' + fmtSpeed(m.exitSpeedMs) + '</td>' +
        '<td>' + Math.round(m.lossDisplayPct) + '</td>' +
        '<td>' + m.durationSec.toFixed(0) + '</td>' +
        '<td>' + (m.recoverySec != null ? m.recoverySec.toFixed(1) : '—') + '</td>' +
        '<td><span class="eff ' + effCls + '">' + m.efficiency + '</span></td>' +
        '</tr>';
    }).join('');
    $('maneuver-tbody').innerHTML = html ||
      '<tr><td colspan="11" class="empty-note">해당 종류의 회전이 없습니다.</td></tr>';

    // 필터 버튼 active 상태
    Array.prototype.forEach.call($('mv-filter').children, function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-mvf') === filter);
    });
    // "자세히" 토글 + 안내
    var toggle = $('mv-detail-toggle'), note = $('mv-list-note');
    if (totalInFilter > shown.length || state.maneuverShowAll && totalInFilter > 20) {
      toggle.hidden = false;
      toggle.textContent = state.maneuverShowAll ? '접기 ▴' : '자세히 ▾';
    } else { toggle.hidden = true; }
    note.textContent = totalInFilter
      ? (filter === 'all' ? '총 ' : (filter === 'tack' ? '택킹 ' : '자이빙 ')) +
        totalInFilter + '회 중 ' + shown.length + '회 표시'
      : '';

    // 베스트 회전 그라데이션 하이라이트 범례 — 화면에 베스트가 보일 때만
    var legend = $('mv-legend');
    if (legend) {
      var hasBest = shown.some(function (r) {
        return r.i === ms.bestTackIdx || r.i === ms.bestGybeIdx;
      });
      if (hasBest) {
        legend.hidden = false;
        legend.innerHTML =
          '<span class="mv-legend__swatch" aria-hidden="true"></span>' +
          /* §410 — <b> 로 노드가 셋으로 갈려 DOM 번역이 못 닿던 잔존을, 한 문장을
             {b} 보간하는 단일 i18nT 키로 묶어 영문 모드에서 한글 0. */
          '<span>' + i18nT(
            '그라데이션으로 강조된 줄은 {b}입니다 — 택킹·자이빙 각 종류에서 효율 점수가 가장 높은 회전을 표시합니다.',
            { b: '<b>' + i18nT('세션 베스트 회전') + '</b>' }) + '</span>';
      } else {
        legend.hidden = true;
        legend.innerHTML = '';
      }
    }
  }

  /* 풍향 기준 좌현/우현 라벨.
     §420 (옥대표님 verbatim 2026-06-12) — sideShort() 와 동일 swap fix.
     angleDiff > 0 = Port tack 표준 convention. DO_NOT_REVERT §420. */
  function sideLabel(heading) {
    if (state.windDir == null || heading == null) return '';
    return Geo.angleDiff(state.windDir, heading) >= 0 ? '포트(P)' : '스타보드(S)';
  }

  /* 선택한 회전들이 한 종류(택킹만/자이빙만)이면 그 종류 이름을, 택·
     자이빙이 섞였으면 generic '회전' 을 돌려준다 — 회전 상세 섹션의
     제목·개수·차트 라벨이 선택한 종류를 그대로 따라가게 한다. */
  function maneuverKindNoun(picked) {
    var hasTack = picked.some(function (m) { return m.type === 'tack'; });
    var hasGybe = picked.some(function (m) { return m.type === 'gybe'; });
    if (hasTack && !hasGybe) return '택킹';
    if (hasGybe && !hasTack) return '자이빙';
    return '회전';
  }
  /* 회전 상세 카드 제목을 선택 종류에 맞춰 갱신. */
  function setManeuverDetailHeading(noun) {
    var h = $('maneuver-detail-heading');
    if (h) h.textContent = noun + ' 상세 — ±10초 곡선';
  }

  /* 선택한 회전들의 ±10초 상세 — 1개면 단일 상세, 여러 개면 겹쳐+평균 */
  function renderManeuverDetail() {
    var hint = $('maneuver-detail-hint'), body = $('maneuver-detail-body');
    var mvs = state.analysis ? state.analysis.maneuvers : [];
    var selIdx = (state.selectedManeuvers || [])
      .filter(function (i) { return mvs[i]; })
      .sort(function (a, b) { return a - b; });
    var hintActions = $('maneuver-detail-hint-actions');
    if (!state.session || !state.session.hasTime || !selIdx.length) {
      body.hidden = true; hint.hidden = false;
      setManeuverDetailHeading('회전');   // 선택 없음 — generic 으로 복귀
      // 아직 선택 전 — 풍향 확정 + 분류된 회전이 있으면 "모두 선택" 노출
      if (hintActions) {
        hintActions.hidden = !(state.windDir != null && mvs.length > 0);
      }
      return;
    }
    hint.hidden = true; body.hidden = false;
    if (hintActions) hintActions.hidden = true;
    var picked = selIdx.map(function (i) { return mvs[i]; });
    var multi = picked.length > 1;
    /* 선택한 종류(택킹만·자이빙만·혼합)에 맞춰 제목·개수·차트 라벨을
       한 단어로 통일한다 — 자이빙만 봤는데 '회전' 으로 나오지 않게. */
    var kindNoun = maneuverKindNoun(picked);
    setManeuverDetailHeading(kindNoun);
    var noteEl = $('maneuver-detail-note');
    // 다중선택에 포트·스타보드 양쪽 택이 섞이면 좌우 분할 비교
    var nP = picked.filter(function (m) { return m.side === 'P'; }).length;
    var nS = picked.filter(function (m) { return m.side === 'S'; }).length;
    var doSplit = multi && state.windDir != null && nP > 0 && nS > 0;

    // 선택 개수 + 전체 해제
    var selDesc = doSplit ? ' · 좌우 = 포트 · 스타보드 · 밴드 = ±1σ'
      : (multi ? ' · 굵은 선 = 평균 · 밴드 = ±1σ' : '');
    $('maneuver-detail-controls').innerHTML =
      '<span class="mv-sel-count">' + kindNoun + ' ' + picked.length +
      '회 선택' + selDesc + '</span>' +
      '<span class="mv-sel-btns">' +
      '<button type="button" class="btn btn--sm btn--ghost" id="mv-select-all">' +
      '모두 선택</button>' +
      '<button type="button" class="btn btn--sm btn--ghost" id="mv-clear-sel">' +
      '전체 해제</button>' +
      '</span>';

    if (!multi) {
      var i = selIdx[0], m = picked[0], tm = TYPE_META[m.type];
      var dir = (state.windDir != null)
        ? sideLabel(m.headingBefore) + ' → ' + sideLabel(m.headingAfter)
        : (m.turnDir === 'starboard' ? '우선회' : '좌선회');
      $('maneuver-detail-title').innerHTML =
        '#' + (i + 1) + ' <span class="mv-badge mv-badge--' + tm.cls + '">' + tm.label +
        '</span> · ' + dir + ' · ' + mmss(m.tSec) + ' · 회전효율 ' + m.efficiency + '/100';
      var mets = [
        ['진입 SOG', fmtSpeedU(m.entrySpeedMs)],
        ['최저 SOG', fmtSpeedU(m.minSpeedMs)],
        ['탈출 SOG', fmtSpeedU(m.exitSpeedMs)],
        [tipLabel('속도 손실', LOSS_TIP), Math.round(m.lossDisplayPct) + '%'],
        ['총 회전각', Math.round(m.turnAngle) + '°'],
        ['평균 회전율', (m.avgTurnRateDegSec || 0).toFixed(1) + ' °/s'],
        [tipLabel('소요 시간', DURATION_TIP), m.durationSec.toFixed(0) + ' sec'],
        [tipLabel('회복 시간', RECOVERY_TIP),
          m.recoverySec != null ? m.recoverySec.toFixed(1) + ' sec' : '미회복']
      ];
      $('maneuver-detail-metrics').innerHTML = mets.map(function (d) {
        return '<div class="dm"><span class="dm__l">' + d[0] + '</span>' +
          '<span class="dm__v">' + d[1] + '</span></div>';
      }).join('');
      // 진입 < 최저 (가속 통과) 상황 설명
      if (noteEl) {
        var msg = '';
        if (m.minSpeedMs >= m.entrySpeedMs) {
          msg = '✓ 회전 직전(4초 평균)보다 최저 속도가 더 빠릅니다 — 속도를 잃지 ' +
            '않고 오히려 가속하며 빠져나온 좋은 회전입니다. 손실은 진입·이탈 중 ' +
            '더 빠른 속도(' + fmtSpeedU(m.refSpeedMs) + ') 기준으로 계산합니다.';
        } else if (m.lossDisplayPct < 8) {
          msg = '✓ 속도 손실이 거의 없는 깔끔한 회전입니다.';
        }
        noteEl.textContent = msg;
        noteEl.hidden = !msg;
      }
    } else {
      // 다중 — 회전별 지표 대신 선택 요약
      var nT = 0, nG = 0, effSum = 0;
      picked.forEach(function (mv) {
        if (mv.type === 'tack') nT++;
        else if (mv.type === 'gybe') nG++;
        effSum += mv.efficiency;
      });
      $('maneuver-detail-title').innerHTML = doSplit
        ? (kindNoun + ' ' + picked.length + '회 — 포트 ' + nP + ' · 스타보드 ' +
           nS + ' 좌우 분할 비교 (Y축 동일 스케일)')
        : (kindNoun + ' ' + picked.length +
           '회 겹쳐 보기 — 개별 곡선(연한 선) + 평균(굵은 선) + ±1σ 밴드');
      /* 3 타일 — 선택 안 된 종류의 0회 타일은 숨긴다(자이빙만 선택 시
         '택킹 0회' 제거). 택·자이빙이 섞였을 때만 둘 다 표시. */
      var tiles = '';
      if (nT > 0) tiles += '<div class="dm"><span class="dm__l">택킹</span>' +
        '<span class="dm__v">' + nT + '회</span></div>';
      if (nG > 0) tiles += '<div class="dm"><span class="dm__l">자이빙</span>' +
        '<span class="dm__v">' + nG + '회</span></div>';
      tiles += '<div class="dm"><span class="dm__l">평균 회전효율</span>' +
        '<span class="dm__v">' + Math.round(effSum / picked.length) + '점</span></div>';
      $('maneuver-detail-metrics').innerHTML = tiles;
      if (noteEl) { noteEl.textContent = ''; noteEl.hidden = true; }
    }

    // 단일/분할 컨테이너 토글 — 차트 렌더 전에 보이게 해야 캔버스 폭 측정됨
    var singleBox = $('maneuver-detail-single');
    var splitBox = $('maneuver-detail-split');
    if (singleBox) singleBox.hidden = doSplit;
    if (splitBox) splitBox.hidden = !doSplit;
    // 분할 차트 제목도 선택 종류에 맞춘다 ('포트 회전' → '포트 자이빙' 등)
    var capP = $('maneuver-detail-tile-cap-p');
    var capS = $('maneuver-detail-tile-cap-s');
    if (capP) capP.textContent = '포트 ' + kindNoun;
    if (capS) capS.textContent = '스타보드 ' + kindNoun;
    Charts.renderManeuverDetail('maneuver-detail-chart', state.session, picked, {
      toSpeed: toSpeed, unitLabel: unitLabel(), windDir: state.windDir,
      split: doSplit,
      splitTargets: { p: 'maneuver-detail-chart-p', s: 'maneuver-detail-chart-s' }
    });

    // 좌우 그래프를 정확한 수치로 보완 — 공용 레전드 + 포트·스타보드 비교 표
    renderManeuverDetailLegend(multi);
    renderManeuverCompareTable(picked, doSplit);
    renderTurnCoachComment(picked);
  }

  /* 회전 상세 다중선택 — 그래프 아래 공용 레전드.
     분할 타일·겹쳐보기 차트마다 같은 범례가 중복돼 산만하던 것을, 차트
     범례를 끄고(charts.js) 여기 하나로 모은다. 표가 정확한 수치를 맡으면
     레전드는 색·선 모양의 의미만 간결히 전한다. */
  var MV_DETAIL_LEGEND_HTML =
    '<span class="mvl-item"><span class="mvl-mark mvl-mark--line"' +
    ' style="border-color:var(--navy)"></span>평균 SOG</span>' +
    '<span class="mvl-item"><span class="mvl-mark mvl-mark--band"' +
    ' style="background:rgba(31,143,255,.32)"></span>SOG ±1σ 밴드</span>' +
    '<span class="mvl-item"><span class="mvl-mark mvl-mark--line"' +
    ' style="border-color:var(--gybe)"></span>평균 회전율</span>' +
    '<span class="mvl-item"><span class="mvl-mark mvl-mark--band"' +
    ' style="background:rgba(239,125,0,.32)"></span>회전율 ±1σ 밴드</span>' +
    '<span class="mvl-item"><span class="mvl-mark mvl-mark--faint"></span>' +
    '개별 회전</span>';

  function renderManeuverDetailLegend(multi) {
    var el = $('maneuver-detail-legend');
    if (!el) return;
    el.hidden = !multi;
    el.innerHTML = multi ? MV_DETAIL_LEGEND_HTML : '';
  }

  /* 회전들의 한 스칼라 지표 → 평균·표준편차.
     표준편차는 모표준편차(÷N) — charts.js meanStdCurves 의 ±1σ 밴드와
     같은 정의라, 표의 ± 수치와 그래프 밴드가 같은 분산을 가리킨다. */
  function meanSd(vals) {
    var n = vals.length;
    if (!n) return { n: 0, mean: null, sd: 0 };
    var sum = 0, i;
    for (i = 0; i < n; i++) sum += vals[i];
    var m = sum / n, v = 0;
    for (i = 0; i < n; i++) v += (vals[i] - m) * (vals[i] - m);
    return { n: n, mean: m, sd: Math.sqrt(v / n) };
  }

  /* 비교 표 한 칸 — "평균 ± 표준편차 단위". 표본 1개면 표준편차 생략. */
  function mvCompareCell(stat, dec, unit) {
    if (!stat || stat.n === 0 || stat.mean == null) {
      return '<span class="mvc-na">—</span>';
    }
    var us = unit ? ' ' + unit : '';
    if (stat.n < 2) {
      return '<span class="mvc-mean">' + stat.mean.toFixed(dec) + '</span>' +
        '<span class="mvc-unit">' + us + '</span>' +
        '<span class="mvc-n"> · 표본 1</span>';
    }
    return '<span class="mvc-mean">' + stat.mean.toFixed(dec) + '</span>' +
      '<span class="mvc-sd"> ± ' + stat.sd.toFixed(dec) + '</span>' +
      '<span class="mvc-unit">' + us + '</span>';
  }

  /* 차이 칸 — 스타보드 평균 − 포트 평균 (부호 포함). */
  function mvCompareDiff(pStat, sStat, dec, unit) {
    if (!pStat || !sStat || pStat.mean == null || sStat.mean == null) {
      return '<span class="mvc-na">—</span>';
    }
    var d = sStat.mean - pStat.mean;
    var sign = d > 1e-9 ? '+' : (d < -1e-9 ? '−' : '');
    var us = unit ? ' ' + unit : '';
    return '<span class="mvc-diff">' + sign + Math.abs(d).toFixed(dec) +
      us + '</span>';
  }

  /* 회전 상세 다중선택 — 포트 vs 스타보드 비교 표.
     그래프(±1σ 밴드)가 시각적으로 보여주는 회전 간 분산을, 표에선
     정확한 평균·표준편차 수치로 보완한다 — 그래프를 대체하지 않고 함께
     본다. P·S 가 섞이면 2열 + 차이, 한쪽 택만이면 1열로 자연스럽게.
     세일링 퍼포먼스 스코어(SPS) 행은 선택에 든 회전 유형(택킹/자이빙)
     기준으로 포트·스타보드 각각의 회전 효율 점수를 표기한다. */
  function renderManeuverCompareTable(picked, doSplit) {
    var box = $('maneuver-detail-compare');
    if (!box) return;
    if (!picked || picked.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;

    var u = unitLabel();
    var METRICS = [
      { label: '진입 SOG', unit: u, dec: 1,
        get: function (m) { return toSpeed(m.entrySpeedMs); } },
      { label: '최저 SOG', unit: u, dec: 1,
        get: function (m) { return toSpeed(m.minSpeedMs); } },
      { label: '탈출 SOG', unit: u, dec: 1,
        get: function (m) { return toSpeed(m.exitSpeedMs); } },
      { label: '속도 손실', unit: '%', dec: 0, tip: LOSS_TIP,
        get: function (m) { return m.lossDisplayPct; } },
      { label: '평균 회전율', unit: '°/s', dec: 1,
        get: function (m) { return m.avgTurnRateDegSec || 0; } },
      { label: '소요 시간', unit: 'sec', dec: 1, tip: DURATION_TIP,
        get: function (m) { return m.durationSec; } }
    ];

    // 열 구성 — 분할이면 포트·스타보드, 아니면 단일 열(자동 라벨)
    var cols;
    if (doSplit) {
      cols = [
        { label: '포트', cls: 'p',
          list: picked.filter(function (m) { return m.side === 'P'; }) },
        { label: '스타보드', cls: 's',
          list: picked.filter(function (m) { return m.side === 'S'; }) }
      ];
    } else {
      var allP = picked.every(function (m) { return m.side === 'P'; });
      var allS = picked.every(function (m) { return m.side === 'S'; });
      cols = [{
        label: allP ? '포트' : (allS ? '스타보드' : '선택 회전'),
        cls: allP ? 'p' : (allS ? 's' : 'n'),
        list: picked.slice()
      }];
    }
    var split = cols.length > 1;

    // SPS 행 — 선택에 든 회전 유형별. 택킹·자이빙이 둘 다면 두 행,
    // 풍향 미확정 등으로 유형을 못 가르면 일반 회전 효율 한 행.
    var hasTack = picked.some(function (m) { return m.type === 'tack'; });
    var hasGybe = picked.some(function (m) { return m.type === 'gybe'; });
    var dpsRows = [];
    if (hasTack) dpsRows.push({ type: 'tack', label: '세일링 퍼포먼스 스코어 (택킹)' });
    if (hasGybe) dpsRows.push({ type: 'gybe', label: '세일링 퍼포먼스 스코어 (자이빙)' });
    if (!dpsRows.length) dpsRows.push({ type: null, label: '회전효율 점수' });

    // --- 헤더 ---
    var head = '<tr><th scope="col">지표</th>';
    cols.forEach(function (c) {
      head += '<th scope="col" class="mvc-h mvc-h--' + c.cls + '">' +
        esc(c.label) + '<span class="mvc-h__n">' + c.list.length + '회</span></th>';
    });
    if (split) head += '<th scope="col" class="mvc-h">차이 (S−P)</th>';
    head += '</tr>';

    // --- 일반 지표 행 ---
    var body = '';
    METRICS.forEach(function (mt) {
      var stats = cols.map(function (c) { return meanSd(c.list.map(mt.get)); });
      var row = '<tr><th scope="row">' +
        (mt.tip ? tipLabel(mt.label, mt.tip) : mt.label) + '</th>';
      stats.forEach(function (st, i) {
        row += '<td class="mvc-col--' + cols[i].cls + '">' +
          mvCompareCell(st, mt.dec, mt.unit) + '</td>';
      });
      if (split) {
        row += '<td>' + mvCompareDiff(stats[0], stats[1], mt.dec, mt.unit) + '</td>';
      }
      body += row + '</tr>';
    });

    // --- 세일링 퍼포먼스 스코어 행 ---
    dpsRows.forEach(function (dr) {
      var stats = cols.map(function (c) {
        var list = dr.type
          ? c.list.filter(function (m) { return m.type === dr.type; })
          : c.list;
        return meanSd(list.map(function (m) { return m.efficiency; }));
      });
      var row = '<tr class="mvc-row--dps"><th scope="row">' + dr.label + '</th>';
      stats.forEach(function (st, i) {
        row += '<td class="mvc-col--' + cols[i].cls + '">' +
          mvCompareCell(st, 0, 'score') + '</td>';
      });
      if (split) row += '<td>' + mvCompareDiff(stats[0], stats[1], 0, 'score') + '</td>';
      body += row + '</tr>';
    });

    var cap = split ? '포트 · 스타보드 비교 — 평균 ± 표준편차'
      : '선택한 회전 — 평균 ± 표준편차';
    var foot = '각 값은 선택한 회전들의 평균 ± 표준편차(±1σ)입니다. ' +
      '그래프가 밴드로 보여주는 회전 간 분산을 정확한 수치로 정리한 것입니다. ' +
      '세일링 퍼포먼스 스코어는 회전 전후 VMG 의 로스·게인 기반 점수(0–100)의 ' +
      '평균으로, SPS 카드의 회전 항목과 같은 정의입니다.';

    box.innerHTML =
      '<p class="mvc-cap">' + cap + '</p>' +
      '<div class="mvc-table-wrap"><table class="rd-table mvc-table">' +
      '<thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<p class="mvc-foot">' + foot + '</p>';
  }

  /* ---------- 회전 Coach Danny 코멘트 ----------
     비교 표 아래에 자연어 코칭 코멘트를 띄운다. 데이터 패턴 감지는
     coach.js 의 결정적 알고리즘이, 진단·조언 문구는 코치 검토 초안이다.
     단일 회전·다중 선택 모두 동작한다(coach.js computeTurnCoaching). */
  function renderTurnCoachComment(picked) {
    var box = $('maneuver-detail-coach');
    if (!box) return;
    if (!window.RDCoach || !RDCoach.computeTurnCoaching ||
        !picked || !picked.length) {
      box.hidden = true; box.innerHTML = ''; return;
    }
    var res = RDCoach.computeTurnCoaching(
      picked, state.windDir, state.analysis, state.rider,
      { toSpeed: toSpeed, speedUnit: unitLabel() });
    if (!res || !res.ok || (!res.comments.length && !res.guard)) {
      box.hidden = true; box.innerHTML = ''; return;
    }
    box.hidden = false;
    /* Coach Danny v1 세션 요약과 같은 Coach Danny(Danny 실사) 아바타를 함께 노출 —
       일관된 코치 페르소나. */
    var html = '<div class="mv-coach__cap-row">' + COACH_AVATAR_HTML +
      '<p class="mv-coach__cap">Coach Danny 코멘트</p></div>';
    if (res.headline) {
      html += '<p class="mv-coach__headline">' + esc(res.headline) + '</p>';
    }
    res.comments.forEach(function (c) {
      html += '<div class="coach-card coach-card--' + esc(c.status) + '">' +
        '<p class="coach-card__title">' + esc(c.title) + '</p>' +
        (c.numbers ? '<p class="coach-card__nums">' + esc(c.numbers) + '</p>' : '') +
        '<p class="coach-card__line"><b>진단</b>' + esc(c.diagnosis) + '</p>' +
        (c.advice
          ? '<p class="coach-card__line"><b>조언</b>' + esc(c.advice) + '</p>' : '') +
        '</div>';
    });
    if (res.guard) {
      html += '<p class="mv-coach__guard">' + esc(res.guard) + '</p>';
    }
    html += '<p class="mv-coach__foot">데이터 패턴 감지는 알고리즘이, ' +
      '진단·조언은 코치 검토 초안입니다 — 추정·과장 없이 가설로 제시합니다.</p>';
    box.innerHTML = html;
  }

  /* ---------- 택 분포 (바이올린) — 포트/스타보드 SOG·VMG·TWA·Heel·Pitch ----------
     데이터 표현은 그래프 우선 — 좌·우 택의 분포·평균·상위치를 한
     차트로 본다. 지표(SOG/VMG/TWA/Heel/Pitch)·풍상/풍하 토글로 전환.
     Heel·Pitch 버튼은 항상 노출하되, 로드된 파일에 자세 데이터가 없으면
     차트 자리에 안내를 띄운다 — 추후 Vakaros .vkx 처럼 heel·pitch 가
     담긴 파일을 올리면 같은 경로로 실제 분포가 자동으로 그려진다. */
  var VIOLIN_METRIC_LABEL = {
    sog: 'SOG', vmg: 'VMG', twa: 'CWA', heel: '힐(Heel)', pitch: '피치(Pitch)'
  };
  var VIOLIN_POP_LABEL = { all: '전체', top50: '상위 50%', top20: '상위 20%' };

  /* 지표를 현재 로드된 파일에서 그릴 수 있는지 — SOG·VMG·TWA 는 풍향만
     있으면 항상 가능하고, Heel·Pitch 는 표본에 자세 데이터가 있을 때만
     가능하다. computeWindMetrics 가 표본에 heel·pitch 가 있을 때만 택
     그룹 통계를 만들어 두므로, 그 존재 여부로 판별한다. */
  function violinMetricAvailable(metric) {
    if (metric === 'sog' || metric === 'vmg' || metric === 'twa') return true;
    var w = state.analysis && state.analysis.wind;
    if (!w || !w.tackSplit) return false;
    var ts = w.tackSplit;
    return !!((ts.upwind && ts.upwind.all && ts.upwind.all[metric]) ||
              (ts.downwind && ts.downwind.all && ts.downwind.all[metric]));
  }

  /* 바이올린 차트 자리에 안내문을 띄우거나(mainText 있을 때 차트 숨김)
     해제한다(mainText 가 null 이면 차트 복원). */
  function showViolinEmpty(mainText, subText) {
    var cv = $('violin-canvas');
    var wrap = cv ? cv.parentNode : null;
    var empty = $('violin-empty'), legend = $('violin-legend');
    if (wrap) wrap.hidden = !!mainText;
    if (empty) {
      empty.hidden = !mainText;
      if (mainText) {
        empty.innerHTML = '<div class="violin-empty__main">' + mainText + '</div>' +
          (subText ? '<div class="violin-empty__sub">' + subText + '</div>' : '');
      }
    }
    if (legend && mainText) legend.innerHTML = '';
  }

  /* 표본의 시간가중 평균 (한 지표). */
  function weightedMean(samples, key) {
    var totDt = 0, sum = 0;
    samples.forEach(function (o) { totDt += o.dt; sum += o[key] * o.dt; });
    return totDt ? sum / totDt : 0;
  }
  /* 지표별 "좋은 방향" — 바이올린 "상위 N%" 모집단을 고를 기준.
     SOG·VMG 는 값이 클수록(높을수록) 좋고, 풍상 TWA 는 작을수록(바람에
     가깝게 포인팅) 좋다. 풍하 TWA 는 단조롭지 않다 — VMG 최적각이
     ≈140~150° 이고 정풍하(180°)는 오히려 느리므로 '클수록 좋음'이
     아니다. 그래서 풍하 TWA 자체의 '좋은 방향'은 두지 않고, 모집단은
     호출부(sideData)에서 풍하 VMG(유효속도) 기준으로 따로 고른다 — '잘
     달린 구간이 어떤 풍각이었나'를 보는 것이다. Heel·Pitch 는 트림
     특성이라 명확한 단일 방향이 없어 0(수평·중립)에 가까울수록 상위로
     본다. */
  function violinGoodDir(metric, mode) {
    if (metric === 'twa') return (mode === 'upwind') ? 'low' : 'neutral';
    if (metric === 'heel' || metric === 'pitch') return 'neutral';
    return 'high';
  }
  /* 지표값 "상위 frac"(시간가중)에 드는 표본 부분집합 — 바이올린 모집단
     선택용. dir 로 좋은 방향을 받아 그 방향 기준 상위를 고른다:
       'high'    값이 클수록 상위 (SOG·VMG)
       'low'     값이 작을수록 상위 (풍상 TWA — 바람에 가깝게 포인팅)
       'neutral' 0(중립)에 가까울수록 상위 (Heel·Pitch)
     analysis.js statsBy 의 topMean 과 같은 누적 규칙이라, 상위
     50%/20% 모집단의 평균이 대시보드 다른 곳의 상위 N% 와 일관된다. */
  function topSubset(samples, key, frac, dir) {
    if (frac >= 1) return samples.slice();
    var totDt = 0;
    samples.forEach(function (o) { totDt += o.dt; });
    var rank = (dir === 'low')
      ? function (a, b) { return a[key] - b[key]; }
      : (dir === 'neutral')
        ? function (a, b) { return Math.abs(a[key]) - Math.abs(b[key]); }
        : function (a, b) { return b[key] - a[key]; };
    var sorted = samples.slice().sort(rank);
    var lim = totDt * frac, acc = 0, out = [];
    for (var k = 0; k < sorted.length; k++) {
      out.push(sorted[k]);
      acc += sorted[k].dt;
      if (acc >= lim) break;
    }
    return out;
  }

  function renderViolin() {
    var note = $('violin-note'), body = $('violin-body'), legend = $('violin-legend');
    if (!note || !body) return;
    var w = state.analysis && state.analysis.wind;
    if (!w || !w.tackSplit) {
      body.style.display = 'none';
      showViolinEmpty(null);
      if (legend) legend.innerHTML = '';
      note.textContent = '풍향을 입력·확정하면 포트·스타보드 택별 ' +
        '속도 분포(바이올린)를 표시합니다.';
      return;
    }
    var metric = state.violinMetric;          // 'sog'|'vmg'|'twa'|'heel'|'pitch'
    var mode = state.violinWind;              // 'upwind' | 'downwind'
    var mLabel = VIOLIN_METRIC_LABEL[metric] || metric.toUpperCase();

    // Heel·Pitch — 로드된 파일에 자세 데이터가 없으면 차트 자리에 안내.
    // (현재 GPX 에는 heel·pitch 가 없어 항상 이 분기를 탄다. .vkx 처럼
    //  자세 데이터가 담긴 파일이면 violinMetricAvailable 가 참이 되어
    //  아래 정상 경로로 분포가 그려진다.)
    if ((metric === 'heel' || metric === 'pitch') && !violinMetricAvailable(metric)) {
      body.style.display = '';   // 토글은 그대로 노출 — 다른 지표로 전환 가능
      showViolinEmpty('입력하신 파일에 해당 데이터가 없습니다.',
        mLabel + ' 분포는 heel·pitch(자세) 센서 값이 담긴 파일에서만 그릴 수 ' +
        '있습니다. 현재 GPX 에는 GPS·심박 데이터만 들어 있습니다 — Vakaros ' +
        '.vkx 처럼 자세 데이터가 포함된 파일을 올리면 이 자리에 분포가 ' +
        '표시됩니다.');
      note.textContent = mLabel + ' — 로드된 파일에 자세(heel·pitch) 데이터가 ' +
        '없습니다.';
      return;
    }

    var grp = w.tackSplit[mode];
    var isAngle = (metric === 'twa' || metric === 'heel' || metric === 'pitch');
    var mUnit = isAngle ? '°' : unitLabel();

    /* 바이올린은 "포일링(활주) 중"인 시점만 본다 — SOG 가 포일링 임계
       미만인 표본은 분포·통계에서 제외한다. 임계는 포일링 시간·비율
       계산에 쓰는 활주 기준(cfg.activeSpeedKt)을 그대로 재사용 — 한
       기준으로 일관. SOG·VMG·TWA·Heel·Pitch 어느 지표든 같은 시점 필터다. */
    var actKt = (state.session && state.session.cfg &&
                 state.session.cfg.activeSpeedKt) || An.DEFAULTS.activeSpeedKt;
    var foilMs = actKt / KT;
    var actWord = SPORTS[state.sport].foiling ? '포일링' : '플레이닝';

    /* 모집단 선택 — 전체 / 상위 50% / 상위 20% (현재 지표값 기준 시간가중).
       겹쳐 그리지 않고, 선택한 한 모집단의 분포·평균만 본다. */
    var popLabel = VIOLIN_POP_LABEL[state.violinPop] || '전체';
    var popFrac = (state.violinPop === 'top20') ? 0.2
      : (state.violinPop === 'top50') ? 0.5 : 1;

    /* 한 택(P/S) → 바이올린 입력 {values, weights, avg, count, foilSec}.
       포일링 표본을 고른 뒤 선택한 모집단(전체/상위 N%)으로 다시 좁혀,
       분포·평균을 그 모집단 기준으로 낸다. tackSplit 의 사전 통계는
       비포일링 표본을 포함하므로 쓰지 않는다.
       각도 지표(twa·heel·pitch)는 도(°) 그대로, 속도 지표는 표시 단위로. */
    function sideData(st) {
      var all = (st && st.samples) || [];
      var foil = all.filter(function (s) { return s.sog >= foilMs; });
      /* 모집단 선택 기준 — 대개 표시 지표 자신(과 그 좋은 방향)이지만,
         풍하 TWA 는 단조롭지 않아(클수록 좋음이 아님) 풍하 VMG(유효속도)로
         엘리트 구간을 고른다 — '잘 달린 구간이 어떤 풍각이었나'를 본다. */
      var popKey = metric, popDir = violinGoodDir(metric, mode);
      if (metric === 'twa' && mode === 'downwind') {
        popKey = 'vmg'; popDir = 'high';
      }
      var samples = (popFrac < 1)
        ? topSubset(foil, popKey, popFrac, popDir) : foil;
      if (!samples.length) {
        return { values: [], weights: [], avg: null,
                 top50: null, top20: null, count: 0, foilSec: 0 };
      }
      var fs = 0;
      samples.forEach(function (s) { fs += s.dt; });
      function conv(v) { return v == null ? null : (isAngle ? v : toSpeed(v)); }
      return {
        values: samples.map(function (s) { return conv(s[metric]); }),
        weights: samples.map(function (s) { return s.dt; }),
        avg: conv(weightedMean(samples, metric)),
        top50: null, top20: null,        // 모집단 토글로 대체 — 기준선 겹쳐 그리지 않음
        count: samples.length, foilSec: fs
      };
    }
    var pd = sideData(grp.P), sd = sideData(grp.S);

    if (!pd.count && !sd.count) {
      body.style.display = '';   // 토글은 노출 유지
      showViolinEmpty((mode === 'upwind' ? '풍상' : '풍하') +
        ' ' + actWord + ' 구간 표본이 없습니다.',
        mLabel + ' 분포는 ' + actWord + ' 중(SOG ' + actKt +
        ' kt 이상)인 구간만 사용합니다. 해당 방향의 ' + actWord +
        ' 주행 구간이 필요합니다.');
      note.textContent = (mode === 'upwind' ? '풍상' : '풍하') +
        ' ' + actWord + ' 구간 표본이 없어 ' + mLabel + ' 분포를 표시할 수 없습니다.';
      return;
    }
    body.style.display = '';
    showViolinEmpty(null);

    /* 값 축 범위 — 바이올린 분포가 위·아래 경계에 붙어 잘려 보이지
       않도록, 표본·평균·상위선을 모두 감싼 데이터 범위에 위아래
       여유(padding)를 둔다. 여유 폭은 charts.js KDE 의 대역폭(bw)
       공식을 그대로 따라 3·bw 로 잡아, 가우시안 분포의 꼬리가 경계에서
       사실상 0 으로 수렴하게 한다 — 어떤 지표·모집단이든 클리핑이
       생기지 않는다. 속도·각도(twa)는 0 미만으로 내려가지 않게 하한을
       0 으로 막고, 자세 지표(heel·pitch)만 음수 축을 허용한다. */
    var axisMin, axisMax;
    var allowNegAxis = (metric === 'heel' || metric === 'pitch');
    var loV = Infinity, hiV = -Infinity;
    function spanV(v) {
      if (v == null || isNaN(v)) return;
      if (v < loV) loV = v;
      if (v > hiV) hiV = v;
    }
    pd.values.concat(sd.values).forEach(spanV);
    [pd.avg, sd.avg, pd.top20, sd.top20, pd.top50, sd.top50].forEach(spanV);
    if (loV === Infinity) { loV = 0; hiV = (metric === 'twa') ? 90 : 1; }
    /* 자세 지표(heel·pitch)는 0°(수평·중립) 기준선을 늘 축 안에 둔다. */
    if (allowNegAxis) { if (loV > 0) loV = 0; if (hiV < 0) hiV = 0; }

    /* charts.js renderViolin 의 KDE 대역폭과 같은 식 — 한 택의
       시간가중 표준편차·유효표본수로 bw 를 구한다. */
    function kdeBw(side) {
      var vals = side.values || [], wts = side.weights || [], i;
      if (vals.length < 2) return 0;
      var sw = 0, swx = 0, sw2 = 0;
      for (i = 0; i < vals.length; i++) {
        sw += wts[i]; swx += wts[i] * vals[i]; sw2 += wts[i] * wts[i];
      }
      var mean = sw > 0 ? swx / sw : 0, swxx = 0;
      for (i = 0; i < vals.length; i++) {
        swxx += wts[i] * (vals[i] - mean) * (vals[i] - mean);
      }
      var sdv = Math.sqrt(sw > 0 ? swxx / sw : 0);
      var neff = sw2 > 0 ? (sw * sw) / sw2 : vals.length;
      return 1.06 * sdv * Math.pow(Math.max(2, neff), -0.2);
    }
    var dataSpan = Math.max(hiV - loV, 1e-6);
    /* 여유 = 3·bw. charts.js 의 bw 하한(span/60)도 dataSpan/45 로 함께
       반영해, 매우 뾰족한 분포에서도 여유가 부족하지 않게 한다.
       각도는 최소 3°, 속도는 최소 0.6 단위의 여유를 보장한다. */
    var vBw = Math.max(kdeBw(pd), kdeBw(sd), dataSpan / 45);
    var vPad = Math.max(3 * vBw, isAngle ? 3 : 0.6);
    var rawMin = loV - vPad, rawMax = hiV + vPad;
    if (!allowNegAxis && rawMin < 0) rawMin = 0;
    var gridStep = isAngle ? 5 : (rawMax > 30 ? 5 : 2);
    axisMin = Math.floor(rawMin / gridStep) * gridStep;
    axisMax = Math.ceil(rawMax / gridStep) * gridStep;
    if (!allowNegAxis && axisMin < 0) axisMin = 0;
    if (axisMax <= axisMin) axisMax = axisMin + gridStep;

    Charts.renderViolin('violin-canvas', {
      port: pd, starboard: sd,
      axisMin: axisMin, axisMax: axisMax, unit: mUnit
    });

    // 범례 — 선택한 모집단의 평균(실선), 포트·스타보드 각각.
    function fmtv(v) {
      if (v == null || isNaN(v)) return '—';
      return (Math.round(v * 10) / 10) + (isAngle ? '°' : ' ' + mUnit);
    }
    function grpHtml(cap, pv, sv) {
      return '<div class="violin-legend__grp">' +
        '<div class="violin-legend__cap">' + cap + '</div>' +
        '<div class="violin-legend__row">' +
        '<span class="violin-legend__side">포트 (P)</span>' +
        '<span class="violin-legend__val violin-legend__val--p">' + fmtv(pv) +
        '</span></div>' +
        '<div class="violin-legend__row">' +
        '<span class="violin-legend__side">스타보드 (S)</span>' +
        '<span class="violin-legend__val violin-legend__val--s">' + fmtv(sv) +
        '</span></div></div>';
    }
    if (legend) {
      /* §410 — 모집단 라벨·캡션을 i18nT 로(영문 모드 한글 잔존 제거). */
      legend.innerHTML =
        grpHtml(i18nT('{pop} 모집단 — 평균 (실선)', { pop: i18nT(popLabel) }), pd.avg, sd.avg);
    }

    /* §410 — 분포 subtitle 전체를 단일 i18nT 템플릿으로(지표·모집단·방향·구간을
       각각 i18nT 변환 후 보간). 한글 enum 이 한 텍스트노드로 합쳐져도 빌드 시 EN. */
    var twaDesc = (metric === 'twa') ? i18nT(' · CWA = 풍향 대비 진행 각도') : '';
    note.textContent = i18nT(
      '{m} 분포 · {pop} 모집단 · {dir} {act} 구간 (SOG {kt} kt 이상) · 표본 P {p}개 · S {s}개', {
        m: i18nT(mLabel), pop: i18nT(popLabel),
        dir: i18nT(mode === 'upwind' ? '풍상' : '풍하'), act: i18nT(actWord),
        kt: actKt, p: pd.count, s: sd.count
      }) + twaDesc;
  }

  /* ============================================================
   *  통합 폴라 · % of target (Danny 검토 2026-05-23 §A1 — 풍각 폴라 +
   *  타깃 폴라를 한 폴라로 통합). 한 차트에 3곡선:
   *    · 이번 세션 포트·스타보드 — 실선(파랑/주황, '실제 라이딩')
   *    · 개인 베스트 타깃 — 옅은 점선 1줄('기준선')
   *  타깃 곡선은 저장된 다른 세션들의 풍각별 폴라를 누적해 만든다(개인
   *  베스트). 저장 세션이 없으면 이번 세션 단독 기준(v1)으로 폴백한다.
   *  현재 세션이 그 타깃의 몇 %인지(풍상·풍하 따로)도 타일로 함께 보인다.
   *  (구축·산출 로직은 analysis.js · 여기서는 데이터 수집 + 렌더)
   * ============================================================ */
  function renderTargetPolar() {
    var empty = $('target-polar-empty');
    var body = $('target-polar-body');
    if (!body || !empty) return;

    function showEmpty(msg) {
      body.hidden = true;
      empty.hidden = false;
      empty.textContent = msg;
    }

    if (state.windDir == null || !state.session || !state.session.hasTime) {
      showEmpty('풍향을 설정하면 타깃 폴라와 % of target 가 표시됩니다 — ' +
        'CWA 계산에 풍향이 필요합니다.');
      return;
    }
    var curProfile = An.sessionPolarProfile(state.session, state.windDir);
    if (!curProfile) {
      showEmpty('타깃 폴라를 만들 폴라 데이터가 부족합니다.');
      return;
    }
    /* 저장된 다른 세션들의 폴라 프로파일 누적 — 시작 시각이 현재 세션과
       같은 레코드는 같은 세션이므로 중복으로 보고 제외한다. */
    var curEpoch = state.session.startEpoch || 0;
    var savedProfiles = [];
    Storage.listSessions().forEach(function (rec) {
      if (!rec.polarProfile || !rec.polarProfile.bins) return;
      if (curEpoch && rec.dateEpoch === curEpoch) return;
      savedProfiles.push(rec.polarProfile);
    });
    var basis = savedProfiles.length ? 'cumulative' : 'single-session';
    var profiles = savedProfiles.length ? savedProfiles : [curProfile];
    var target = An.buildTargetPolar(profiles, { basis: basis });
    if (!target || (target.filledBins + target.interpolatedBins) < 2) {
      showEmpty('타깃 곡선을 만들 표본이 부족합니다 — ' +
        'CWA 빈별 주행 데이터가 더 필요합니다.');
      return;
    }
    var cmp = An.computeTargetComparison(state.session, state.windDir, target);

    empty.hidden = true;
    body.hidden = false;

    renderTargetWindBanner();

    $('target-pct-strip').innerHTML =
      pctOfTargetTile('풍상 % of target', cmp && cmp.upwind) +
      pctOfTargetTile('풍하 % of target', cmp && cmp.downwind);

    Charts.renderTargetPolar('target-polar-canvas',
      { polar: state.analysis.polar, target: target, comparison: cmp },
      { unit: state.unit });

    $('target-polar-note').textContent = targetPolarNoteText(target);
  }

  /* % of target 타일 — side = cmp.upwind | cmp.downwind */
  function pctOfTargetTile(label, side) {
    if (!side || side.pctOfTarget == null) {
      return statTile(label, '–', '비교 가능한 구간 없음');
    }
    var pct = Math.round(side.pctOfTarget);
    var tstr = (side.comparedTimeSec >= 60
      ? Math.round(side.comparedTimeSec / 60) + 'min'
      : Math.round(side.comparedTimeSec) + 'sec');
    var sub = i18nT('{t} 비교', { t: tstr });
    if (side.coverage < 0.995) {
      sub += i18nT(' · 주행의 {p}%만 타깃 보유', { p: Math.round(side.coverage * 100) });
    }
    return statTile(label, pct + ' %', sub);
  }

  /* 타깃 폴라 설명 문구 — 단위·기준·보간/표본부족을 정직하게 표기 */
  function targetPolarNoteText(target) {
    var parts = [];
    if (target.basis === 'cumulative') {
      parts.push('타깃 = 저장된 세션 ' + target.sourceSessionCount +
        '개의 CWA별 개인 베스트(지속 속도 95퍼센타일)입니다.');
    } else {
      parts.push('타깃 = 이번 세션 단독 기준입니다(누적 데이터 없음) — ' +
        '세션을 저장하면 다음부터 누적 베스트로 갱신됩니다.');
    }
    parts.push('곡선 반지름 = CWA별 속도(' + unitLabel() +
      ') · 파랑 실선 = 이번 세션 포트(P) · 주황 실선 = 스타보드(S) · ' +
      '옅은 점선 = 개인 베스트 타깃(기준). 실선=실제 라이딩, 점선=기준. ' +
      '곡선이나 점에 커서를 올리면 해당 곡선이 강조되고 값이 표시됩니다.');
    parts.push('% of target 타일은 매 순간 속도(시간가중 평균)를 ' +
      '같은 CWA의 타깃과 비교한 값입니다.');
    if (target.interpolatedBins > 0 || target.sparseBins > 0) {
      var weak = [];
      if (target.interpolatedBins > 0) {
        weak.push('점선 빈 ' + target.interpolatedBins + '개(표본 없음·보간 추정)');
      }
      if (target.sparseBins > 0) {
        weak.push('연한 점 빈 ' + target.sparseBins + '개(표본 60초 미만)');
      }
      parts.push(weak.join(' 와 ') +
        '는 타깃을 신뢰하기 어려워 % of target 계산에서 제외했습니다.');
    }
    return parts.join(' ');
  }

  /* 풍향 신뢰도 정직 표기 — TWA 가 틀리면 타깃 폴라 전체가 어긋난다 */
  function renderTargetWindBanner() {
    var banner = $('target-wind-banner');
    if (!banner) return;
    var nogo = sessionWindEstimate(state.session);
    var rot = sessionManeuverEstimate(state.session);
    var ests = [];
    if (nogo && nogo.windDir != null) ests.push(nogo);
    if (rot && rot.windDir != null) ests.push(rot);
    var allLow = ests.length === 0 ||
      ests.every(function (e) { return e.confidence === '낮음'; });
    var farDelta = 0;
    ests.forEach(function (e) {
      if (e.confidence === '낮음') return;
      var d = Math.abs(Geo.angleDiff(e.windDir, state.windDir));
      if (d > farDelta) farDelta = d;
    });
    banner.hidden = false;
    if (allLow) {
      banner.className = 'tp-banner tp-banner--warn';
      banner.textContent = '⚠ ' + i18nT(
        '이 세션은 풍향 자동 추정 신뢰도가 낮습니다{x} — CWA·타깃 폴라·% of target 가 부정확할 수 있으니 풍향을 직접 확인해 주세요.',
        { x: ests.length ? '' : i18nT(' (추정 불가)') });
    } else if (farDelta > 25) {
      banner.className = 'tp-banner tp-banner--warn';
      banner.textContent = '⚠ 설정한 풍향 ' + Math.round(state.windDir) +
        '° 가 자동 추정값과 최대 ' + Math.round(farDelta) +
        '° 차이 납니다 — 풍향이 틀리면 타깃 폴라 전체가 어긋납니다. ' +
        '풍향을 확인해 주세요.';
    } else {
      banner.className = 'tp-banner tp-banner--info';
      banner.textContent = '풍향 ' + Math.round(state.windDir) + '° (' +
        compass(state.windDir) + ') 기준으로 CWA 를 계산했습니다.';
    }
  }

  /* ============================================================
   *  심박수 분석 — 추이 · 존 분포 · 퍼포먼스 대비 심박 효율
   *  HR 이 없는 세션(.vkx · HR 미기록 GPX)은 섹션 전체를 숨긴다.
   *  (산출 로직은 analysis.js · 여기서는 렌더만)
   * ============================================================ */

  /* 심박 존 색 — js/chart-theme.js (RDChartTheme.hrZone) 가 단일 소스.
     추이 배경 띠·존 막대·범례 색이 같은 의미를 가리키도록 토큰을 공유한다. */
  var _RDT = window.RDChartTheme;
  var HR_ZONE_COLORS = (_RDT && _RDT.hrZone)
    ? { z1: _RDT.hrZone.z1, z2: _RDT.hrZone.z2, z3: _RDT.hrZone.z3,
        z4: _RDT.hrZone.z4, z5: _RDT.hrZone.z5 }
    : { z1: '#3D8BD4', z2: '#27AE60', z3: '#E0A100', z4: '#EF7D00', z5: '#C0392B' };
  var HR_ZONE_REST_COLOR = (_RDT && _RDT.hrZone) ? _RDT.hrZone.rest : '#8295A8';

  function renderHrSection() {
    var hr = state.analysis && state.analysis.hr;
    var has = !!(hr && hr.hasHR && state.session && state.session.hasTime);
    ['hr-section-head', 'hr-summary-card', 'hr-trend-card',
     'hr-zone-card', 'hr-eff-card', 'hr-skill-card'].forEach(function (id) {
      var el = $(id); if (el) el.hidden = !has;
    });
    if (!has) { Charts.clearHr(); state.skillHr = null; return; }

    renderHrSummaryStrip(hr);

    /* 최대 심박수 입력칸 — 저장된 값으로 채운다(입력 중이면 건드리지
       않아 커서가 튀지 않게). placeholder 는 세션 관측 최대값. */
    var input = $('hr-maxhr-input');
    if (input) {
      if (document.activeElement !== input) {
        input.value = (state.rider.maxHr != null) ? state.rider.maxHr : '';
      }
      input.placeholder = String(hr.defaultMaxHr);
    }

    renderHrZonesAndTrend();
    renderHrEfficiencyCard(hr);
    renderSkillHrCard();
  }

  /* ---------- 스킬-심박수 분석 카드 (분석 3-4) ----------
     택킹·자이빙을 '진입 전 → 기술 중 → 완료 후' 세 국면으로 나눠
     심박 반응과 회복을 본다. 순항 기준 심박 대비 어느 택·어느 스킬이
     가장 큰 생리적 반응을 부르는지, 회전 후 심박이 얼마나 빨리·많이
     회복되는지를 표시한다. HR 데이터가 있는 세션에서만 보인다
     (renderHrSection 이 hr-skill-card 가시성을 관리). 산출 로직은
     analysis.js computeSkillHr — 여기서는 렌더만 (Danny 검토 2026-05-23). */
  function renderSkillHrCard() {
    var strip = $('hr-skill-strip'), body = $('hr-skill-body');
    if (!strip || !body) return;
    var sk = (state.session && state.analysis)
      ? An.computeSkillHr(state.session, state.analysis.maneuvers) : null;
    state.skillHr = sk;
    if (!sk || !sk.hasHR || !sk.groups.length) {
      strip.innerHTML = '';
      body.innerHTML = '<p class="empty-note">' +
        (state.windDir == null
          ? '풍향을 확정하면 택킹·자이빙별 심박 반응과 회복을 분석합니다.'
          : '심박이 함께 기록된 택킹·자이빙이 아직 없습니다.') + '</p>';
      return;
    }
    /* 부호 있는 정수 표기 — 양수 +, 음수는 정식 마이너스(−). */
    function sgn(v) {
      return (v > 0 ? '+' : (v < 0 ? '−' : '')) + Math.abs(v);
    }
    var rec = sk.recovery || { n: 0 };
    strip.innerHTML =
      statTile('순항 기준 심박 (bpm)', sk.cruiseHr, '포일링·회전 밖 시간가중 평균') +
      statTile('최대 생리 반응 (bpm)',
        sk.biggest ? sgn(sk.biggest.riseBpm) : '—',
        sk.biggest ? (i18nT(sk.biggest.label) + ' · 순항 대비') : null) +
      statTile('세션 회복 지수 (bpm/min)',
        sk.recoveryIndex != null ? sk.recoveryIndex.toFixed(1) : '—',
        rec.n ? ('회복 표본 ' + rec.n + '회 평균 · 클수록 빠른 회복')
              : '회복 표본 부족') +
      statTile('분석한 회전 (times)', sk.analyzedCount,
        '심박이 함께 기록된 택킹·자이빙');
    /* 표 — '퍼포먼스 통계' 표준(stats-table) 구조·타이포 그대로 사용.
       택킹·자이빙을 포트/스타보드로 갈라 행으로 펼치고(택킹 포트 / 택킹
       스타보드 / 자이빙 포트 / 자이빙 스타보드), 맨 아래 '전체' 합산 행과
       'SPS 포트·스타보드 표' 와 같은 차이(S−P) 열을 둔다. 심박은 참고
       지표이므로 표에는 잘함/못함 색 신호를 넣지 않는다 — 중립 표기만
       쓴다 (Danny 검토 2026-05-23).

       차이(S−P) 열 — '순항 대비 상승(riseBpm)' 기준. 같은 회전 종류에서
       스타보드 행에 '스타보드 − 포트' 를, 전체 행에는 전체 스타보드 평균
       − 전체 포트 평균을 표기한다(양수 = 스타보드 쪽 심박 반응이 큼).
       포트 행·기준이 없는 행은 '—'. */
    /* 값 셀 — P/S 표와 동일한 .stats-val 타이포. 표 셀에 색 신호 없음. */
    function valSpan(inner) {
      return '<td><span class="stats-val">' + inner + '</span></td>';
    }
    var HR_TYPE_LABEL = { tack: '택킹', gybe: '자이빙', turn: '회전' };
    var HR_SIDE_LABEL = { P: '포트', S: '스타보드' };
    var portByType = {};
    sk.groups.forEach(function (g) {
      if (g.side === 'P') portByType[g.type] = g;
    });
    function diffCell(g) {
      if (g.side === 'S' && portByType[g.type]) {
        return sgn(g.riseBpm - portByType[g.type].riseBpm);
      }
      return '—';
    }
    function recCell(bpm, n) {
      return (bpm != null) ? (bpm + ' <small>(' + n + ' times)</small>') : '—';
    }
    /* 종류별로 묶어 종류 칸을 rowspan 으로 합친다 — 택킹/자이빙 반복
       제거. P/S 표와 동일한 종류(rowspan)+구분 2열 구조 (Danny 6차). */
    var byType = [];
    sk.groups.forEach(function (g) {
      var b = byType.filter(function (x) { return x.type === g.type; })[0];
      if (!b) { b = { type: g.type, list: [] }; byType.push(b); }
      b.list.push(g);
    });
    var rows = byType.map(function (b) {
      return b.list.map(function (g, i) {
        return '<tr>' +
          (i === 0 ? '<td class="rd-grp" rowspan="' + b.list.length + '">' +
            esc(HR_TYPE_LABEL[g.type] || g.type) + '</td>' : '') +
          '<td>' + esc(g.side ? HR_SIDE_LABEL[g.side] : '—') + '</td>' +
          valSpan(g.n) +
          valSpan(g.entryHr) +
          valSpan(g.peakHr) +
          valSpan(sgn(g.riseBpm)) +
          valSpan(recCell(g.recoveryBpm, g.recoveryN)) +
          valSpan(diffCell(g)) +
          '</tr>';
      }).join('');
    }).join('');

    /* 종합(합산) 행 — 모든 분석 회전을 합쳐 평균낸다. 맨 아래 전체 행. */
    var pt = sk.perTurn, allN = pt.length;
    var sumEntry = 0, sumPeak = 0, sumRise = 0, pRise = [], sRise = [];
    pt.forEach(function (p) {
      sumEntry += p.entryHr; sumPeak += p.peakHr; sumRise += p.riseBpm;
      if (p.side === 'P') pRise.push(p.riseBpm);
      else if (p.side === 'S') sRise.push(p.riseBpm);
    });
    function mean(a) {
      if (!a.length) return null;
      var s = 0; a.forEach(function (v) { s += v; }); return s / a.length;
    }
    var rec = sk.recovery || { n: 0, avgBpm: null };
    var allDiff = (pRise.length && sRise.length)
      ? Math.round(mean(sRise) - mean(pRise)) : null;
    var allRow = allN ? (
      '<tr class="skillhr-row--all">' +
      '<td class="rd-grp" colspan="2">종합</td>' +
      valSpan(allN) +
      valSpan(Math.round(sumEntry / allN)) +
      valSpan(Math.round(sumPeak / allN)) +
      valSpan(sgn(Math.round(sumRise / allN))) +
      valSpan(recCell(rec.avgBpm != null ? Math.round(rec.avgBpm) : null, rec.n)) +
      valSpan(allDiff != null ? sgn(allDiff) : '—') +
      '</tr>') : '';

    body.innerHTML =
      '<div class="stats-panel-wrap"><table class="rd-table stats-table">' +
      '<thead><tr>' +
      '<th>종류</th><th>구분</th>' +
      '<th>분석 수<small>times</small></th>' +
      '<th>진입 전<small>bpm</small></th>' +
      '<th>기술 중 최고<small>bpm</small></th>' +
      '<th>순항 대비<small>bpm</small></th>' +
      '<th>완료 후 회복<small>bpm 하강</small></th>' +
      '<th>차이 (S−P)<small>순항 대비 bpm</small></th>' +
      '</tr></thead><tbody>' + rows + allRow + '</tbody></table></div>' +
      '<p class="stats-note">' +
      '순항 기준 심박은 포일링 중이면서 회전 밖인 구간의 시간가중 평균입니다. ' +
      '‘기술 중 최고’는 심박 반응 지연을 고려해 회전 종료 직후 20초까지 ' +
      '포함한 최고 심박, ‘순항 대비’는 그 값과 순항 기준 심박의 차이입니다. ' +
      '‘완료 후 회복’은 정점 이후 순항으로 돌아갈 때의 심박 하강폭(bpm)이며 ' +
      '괄호는 집계 표본 수입니다 — 회전이 실제로 심박을 올렸고 다음 회전까지 ' +
      '관찰 시간이 충분한 경우만 셉니다. ‘차이(S−P)’ 는 같은 회전 종류에서 ' +
      '스타보드 택과 포트 택의 순항 대비 상승 차이로, 양수면 스타보드 쪽 ' +
      '심박 반응이 더 큽니다 — 심박은 참고 지표라 좋고 나쁨이 아니라 좌우 ' +
      '균형을 보는 수치입니다. 맨 아래 ‘종합’ 행은 모든 회전을 합산한 ' +
      '값입니다. 세션 회복 지수(bpm/min)는 회복 하강 속도의 평균으로, ' +
      '높을수록 회전 직후 심박이 빠르게 안정돼 심혈관 회복이 빠르다는 ' +
      '뜻입니다. 세션이 쌓이면 이 지수의 추세로 장기 변화를 봅니다.' +
      '</p>';
  }

  /* 심박 요약 스탯 — 평균(시간가중)·최고·최저·기록률.
     기록률 문구는 '기록된 포인트 중 심박 포함 비율' 임을 분모·분자로
     명확히 한다 — 그래프 시간 공백과 혼동되지 않게 (Danny 2026-05-23 §D). */
  function renderHrSummaryStrip(hr) {
    var box = $('hr-summary-strip');
    if (!box) return;
    var recTotal = (hr.recordedCount != null) ? hr.recordedCount : hr.count;
    /* %HRmax — 라이더가 입력한 최대 심박수 기준 비율.
       입력 없으면 세션 관측 최대(maxBpm)를 fallback 으로 쓰지만,
       그 경우엔 '관측 기준' 임을 부수 설명에서 명시한다 (Danny 2026-05-27 §174). */
    var maxHr = (state.rider && state.rider.maxHr) || hr.maxBpm;
    /* §410 — 기준 라벨·부수 문구를 i18nT 로(영문 모드 한글 잔존 제거). */
    var basisLabel = (state.rider && state.rider.maxHr)
      ? i18nT('입력 최대 {n} bpm', { n: maxHr })
      : i18nT('관측 최대 {n} bpm', { n: maxHr });
    function pctOf(bpm) {
      if (!bpm || !maxHr) return null;
      return Math.round(bpm / maxHr * 100);
    }
    function withPct(sub, bpm) {
      var p = pctOf(bpm);
      return p != null ? i18nT(sub) + ' · ' + p + '% HRmax' : i18nT(sub);
    }
    box.innerHTML =
      statTile('평균 심박 (bpm)', Math.round(hr.avgBpm),
        withPct('세션 시간가중 평균', hr.avgBpm)) +
      statTile('최고 심박 (bpm)', hr.maxBpm,
        withPct('세션 관측 최대', hr.maxBpm)) +
      statTile('최저 심박 (bpm)', hr.minBpm,
        withPct('세션 관측 최소', hr.minBpm)) +
      statTile('심박 기록률 (%)', Math.round(hr.coveragePct),
        i18nT('기록 포인트 {rec}개 중 심박 {hr}개 · 기준 {basis}', {
          rec: recTotal.toLocaleString(), hr: hr.count.toLocaleString(), basis: basisLabel
        }));
  }

  /* 심박 존 분포 + 추이 차트(존 배경 띠) — 최대 심박수 입력이 바뀔
     때마다 다시 호출된다(가벼운 재계산). */
  function renderHrZonesAndTrend() {
    var hr = state.analysis && state.analysis.hr;
    if (!hr || !hr.hasHR) return;
    var zoneData = An.computeHrZones(state.session, state.rider.maxHr);

    var note = $('hr-maxhr-note');
    if (note) {
      if (zoneData.maxHrSource === 'user') {
        note.textContent = '입력하신 최대 심박수 ' + zoneData.maxHrUsed +
          ' bpm 기준으로 존을 나눕니다.';
      } else {
        note.textContent = '미입력 — 세션 관측 최대값 ' + zoneData.maxHrUsed +
          ' bpm 을 기준으로 합니다. 본인의 최대 심박수를 입력하시면 더 정확해집니다.';
      }
    }

    // 추이 차트 — HR 존 배경 띠 + 속도 overlay (우축) + 클릭→지도 점프.
    // 속도는 현재 단위 설정(kt/km/h)에 맞춰 변환된 값을 우축에 띄우고,
    // 클릭하면 지도가 그 시점으로 panTo 한다 (Danny 2026-05-27 §173).
    var pad = 6;
    Charts.renderHrChart('hr-trend-chart', state.session, {
      fmtX: fmtTimeAxis,
      xTitle: state.timeAxisMode === 'clock' ? '실제 시각' : '경과 시간',
      zones: zoneData,
      yMin: Math.max(0, hr.minBpm - pad),
      yMax: hr.maxBpm + pad,
      /* §175 — '라이딩 오버랩' 토글로 속도 곡선 표시 여부 결정.
         기본 OFF (심박만 — 깔끔한 뷰). 사용자가 토글 ON 시 우축 속도 overlay. */
      includeSpeed: state.hrShowSpeed,
      toSpeed: toSpeed,
      speedUnitLabel: unitLabel(),
      onHover: function (fullT) { syncCursor(fullT); },
      onSeek: function (fullT) { jumpMapToTime(fullT); }
    });

    /* 기록 공백 안내 (Danny 2026-05-23 §D) — leg 가 2개 이상이면 추이
       그래프 중간에 시간 공백이 있다(GPS 장치 8초+ 기록 중단 또는 트랙
       편집 제외 구간). '심박 기록률' 100% 와 모순돼 보이지 않도록 그
       의미를 분명히 한다. */
    var gapNote = $('hr-trend-gapnote');
    if (gapNote) {
      var legCount = (state.session.legs && state.session.legs.length) || 1;
      if (legCount > 1) {
        gapNote.hidden = false;
        gapNote.textContent = '그래프 중간의 옅은 띠는 GPS 장치가 8초 넘게 ' +
          '기록을 멈춘 시간대(또는 트랙 편집에서 제외한 구간)입니다 — 이 세션 ' +
          (legCount - 1) + '곳. ‘심박 기록률’은 기록된 포인트 중 심박이 함께 ' +
          '잡힌 비율이라, 이런 시간 공백이 있어도 100%에 가까울 수 있습니다 — ' +
          '둘은 서로 다른 것을 잰 값입니다.';
      } else {
        gapNote.hidden = true;
        gapNote.textContent = '';
      }
    }

    // 존 분포 막대 + 자기설명적 범례
    Charts.renderHrZoneBars('hr-zone-chart', zoneData);
    renderHrZoneLegend(zoneData);
  }

  /* 심박 존 범례 — 존 이름·bpm 범위·의미·머문 시간을 모두 표기해,
     숫자만이 아니라 "무슨 뜻인지"가 보이게 한다(자기설명적 지표). */
  function renderHrZoneLegend(zoneData) {
    var box = $('hr-zone-legend');
    if (!box) return;
    var tot = zoneData.totalSec || 1;
    var rows = [{
      sw: HR_ZONE_REST_COLOR, name: '휴식', tag: 'Z1 미만',
      range: '< ' + zoneData.zones[0].loBpm + ' bpm',
      desc: '회복 구간 아래 — 정지·표류·휴식', sec: zoneData.belowSec
    }];
    zoneData.zones.forEach(function (z) {
      rows.push({
        sw: HR_ZONE_COLORS[z.key] || HR_ZONE_REST_COLOR,
        name: z.name, tag: z.key.toUpperCase(),
        range: z.loBpm + '–' + z.hiBpm + ' bpm', desc: z.desc, sec: z.seconds
      });
    });
    box.innerHTML = rows.map(function (r) {
      var pct = Math.round(r.sec / tot * 100);
      return '<div class="hr-zone-row">' +
        '<span class="hr-zone-row__sw" style="background:' + r.sw + '"></span>' +
        '<span class="hr-zone-row__name">' + esc(i18nT(r.name)) + ' (' + i18nT(r.tag) + ')</span>' +
        '<span class="hr-zone-row__range">' + esc(r.range) + '</span>' +
        '<span class="hr-zone-row__desc">' + esc(i18nT(r.desc)) + '</span>' +
        '<span class="hr-zone-row__time">' + fmtDur(r.sec) + '</span>' +
        '<span class="hr-zone-row__pct">' + pct + '%</span>' +
        '</div>';
    }).join('');
  }

  /* metric 그리드 타일 — 값 + 단위 + 라벨 */
  function effTile(val, unit, label) {
    return '<div class="metric"><span class="metric__val">' + esc(String(val)) +
      (unit ? ' <span class="metric__unit">' + esc(unit) + '</span>' : '') +
      '</span><span class="metric__label">' + esc(label) + '</span></div>';
  }

  /* 퍼포먼스 대비 심박 효율 — 헤드라인 지표 + 속도-심박 산점/추세 */
  function renderHrEfficiencyCard(hr) {
    var eff = hr.efficiency;
    var box = $('hr-eff-metrics'), note = $('hr-eff-note');
    if (!eff || !eff.available) {
      if (box) box.innerHTML = '';
      Charts.renderHrEff('hr-eff-chart', null);
      chartEmpty('hr-eff-chart', '효율 분석에 필요한 주행 구간이 부족합니다.');
      if (note) note.textContent = '';
      return;
    }
    chartShow('hr-eff-chart');

    /* 효율 지수는 화면 표시 단위 기준으로 계산해, 위의 "주행 평균
       속도" 타일·아래 설명과 단위가 일관되게 한다. */
    var dispIndex = eff.avgHr > 0
      ? (toSpeed(eff.avgSpeedMs) / eff.avgHr * 100) : 0;
    var html =
      effTile(Math.round(eff.avgHr), 'bpm', '주행 평균 심박') +
      effTile(fmtSpeed(eff.avgSpeedMs), unitLabel(), '주행 평균 속도') +
      effTile(dispIndex.toFixed(1), '', '심박 효율 지수');
    if (eff.drift && eff.drift.available) {
      var d = eff.drift.driftPct;
      html += effTile((d >= 0 ? '+' : '') + d.toFixed(1), '%', '심박 드리프트');
    }
    if (box) box.innerHTML = html;

    Charts.renderHrEff('hr-eff-chart', eff,
      { toSpeed: toSpeed, unitLabel: unitLabel() });

    var txt = '심박 효율 지수 = 주행 평균 속도(' + unitLabel() +
      ') ÷ 평균 심박(bpm) × 100 입니다. 값이 클수록 같은 심박으로 더 ' +
      '빠르게 달린 것 — 유산소 효율이 좋다는 뜻이며, 세션을 거듭하며 ' +
      '이 값이 오르면 체력이 향상되고 있는 것입니다. 아래 그래프에서 ' +
      '같은 속도라도 점이 아래쪽(낮은 심박)에 모일수록 효율적입니다.';
    if (eff.drift && eff.drift.available) {
      txt += ' 심박 드리프트는 활주 구간의 후반 평균 심박이 전반보다 ' +
        (eff.drift.driftBpm >= 0 ? '+' : '') +
        Math.round(eff.drift.driftBpm) + ' bpm 달라진 값입니다 — ' +
        '0 에 가까울수록 같은 강도를 끝까지 잘 유지하신 것입니다.';
    }
    if (note) note.textContent = txt;
  }

  /* ============================================================
   *  세션 요약 — VPS · Coach Danny
   *  (산출 로직은 js/coach.js · 여기서는 입력 연동과 렌더만)
   * ============================================================ */

  /* 스킬 선택 옵션 — lift-calculator 스킬 키와 동일 */
  function buildSkillSelect() {
    var sel = $('rider-skill-select');
    if (!sel) return;
    sel.innerHTML = SKILL_ORDER.map(function (k) {
      return '<option value="' + k + '">' + k + '</option>';
    }).join('');
  }

  /* 저장된 라이더 프로필을 입력칸에 채움 (세션마다 재입력 회피) */
  function prefillRiderFields() {
    var r = state.rider || {};
    if ($('rider-weight-input')) {
      $('rider-weight-input').value = (r.weightKg != null) ? r.weightKg : '';
    }
    if ($('rider-skill-select')) $('rider-skill-select').value = r.skill || '중급';
    if ($('rider-wing-input')) {
      $('rider-wing-input').value = (r.wingM2 != null) ? r.wingM2 : '';
    }
    if ($('rider-foilar-input')) {
      $('rider-foilar-input').value = (r.foilAR != null) ? r.foilAR : '';
    }
  }

  function wireRiderControls() {
    buildSkillSelect();
    prefillRiderFields();
    function commit() {
      var w = parseFloat($('rider-weight-input').value);
      var wing = parseFloat($('rider-wing-input').value);
      var far = parseFloat($('rider-foilar-input').value);
      state.rider = {
        weightKg: (isFinite(w) && w > 0) ? w : null,
        skill: $('rider-skill-select').value || '중급',
        wingM2: (isFinite(wing) && wing > 0) ? wing : null,
        foilAR: (isFinite(far) && far > 0) ? far : null,
        /* 최대 심박수는 심박수 섹션 입력칸이 따로 관리한다 — 라이더
           카드 commit 이 덮어쓰지 않도록 기존 값을 보존한다. */
        maxHr: (state.rider && state.rider.maxHr != null) ? state.rider.maxHr : null
      };
      Storage.saveRider(state.rider);
      if (state.analysis) renderSessionSummary();
    }
    ['rider-weight-input', 'rider-wing-input', 'rider-foilar-input'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', commit);
    });
    var sk = $('rider-skill-select');
    if (sk) sk.addEventListener('change', commit);
  }

  /* state.vps · state.whatif 갱신 */
  function computeCoachAnalysis() {
    if (!state.analysis || !state.session || !state.session.hasTime ||
        !window.RDCoach) {
      state.vps = null; state.whatif = null;
      return;
    }
    state.vps = RDCoach.computeVPS(state.analysis, state.rider,
      state.windDir, state.windSpeedKt);
    /* what-if 는 실측 풍상 VMG 에 앵커링하므로 analysis 를 함께 넘긴다. */
    state.whatif = RDCoach.computeWhatIf(state.analysis, state.rider,
      state.windSpeedKt);
  }

  function renderSessionSummary() {
    computeCoachAnalysis();
    renderVPSCard();
    renderCoachCard();
  }

  /* 풍속(kt) → 풍속 영역대(밴드) 키.
     reference_dmj_wind_classification.md SoT — 미풍 ≤10kt · 중풍
     11–16kt · 강풍 ≥17kt. */
  function windBandKey(kt) {
    if (kt == null || !(kt > 0)) return null;
    if (kt <= 10) return 'light';
    if (kt <= 16) return 'medium';
    return 'strong';
  }
  var WIND_BAND_LABEL = {
    light: '미풍 ≤10kt', medium: '중풍 11–16kt', strong: '강풍 ≥17kt'
  };

  /* 동일 풍속 영역대 비교 (Danny 2026-05-23 §A-2·A-3) —
     SPS 델타 기준을 '이전 세션 대비' 에서 '같은 풍속 밴드 평균 대비' 로
     바꾼다. 현재 세션과 같은 풍속 밴드에 속한 다른 저장 세션들의 VPS
     평균을 항목(종합·풍상·풍하·택킹·자이빙)별로 산출한다. 같은 밴드
     세션이 없는 항목은 avg=null → 카드에 '비교 데이터 부족' 으로 정직히
     표기한다. 반환: { band, label, overall/upwind/downwind/tack/gybe(평균),
     counts:{...} }. */
  function windBandVPSAverage() {
    var band = windBandKey(state.windSpeedKt);
    var curEpoch = (state.session && state.session.startEpoch) || 0;
    var acc = { overall: [], upwind: [], downwind: [], tack: [], gybe: [] };
    if (band) {
      Storage.listSessions().forEach(function (r) {
        if (windBandKey(r.windSpeedKt) !== band) return;
        /* 현재 세션이 이미 저장돼 있으면 자기 자신은 평균에서 제외 */
        if (curEpoch && r.dateEpoch === curEpoch) return;
        if (r.vpsOverall  != null) acc.overall.push(r.vpsOverall);
        if (r.vpsUpwind   != null) acc.upwind.push(r.vpsUpwind);
        if (r.vpsDownwind != null) acc.downwind.push(r.vpsDownwind);
        if (r.vpsTack     != null) acc.tack.push(r.vpsTack);
        if (r.vpsGybe     != null) acc.gybe.push(r.vpsGybe);
      });
    }
    function avg(a) {
      if (!a.length) return null;
      var s = 0;
      a.forEach(function (x) { s += x; });
      return s / a.length;
    }
    return {
      band: band,
      label: band ? WIND_BAND_LABEL[band] : null,
      overall: avg(acc.overall), upwind: avg(acc.upwind),
      downwind: avg(acc.downwind), tack: avg(acc.tack), gybe: avg(acc.gybe),
      counts: {
        overall: acc.overall.length, upwind: acc.upwind.length,
        downwind: acc.downwind.length, tack: acc.tack.length,
        gybe: acc.gybe.length
      }
    };
  }

  /* 저장 메타용 VPS 스냅샷 */
  function vpsMeta() {
    computeCoachAnalysis();
    var v = state.vps;
    if (!v || !v.ok) return null;
    return {
      overall: v.overall ? v.overall.score : null,
      upwind: v.upwind ? v.upwind.score : null,
      downwind: v.downwind ? v.downwind.score : null,
      /* 택킹·자이빙 효율 — overall segment 에 둘 다 실려 있다.
         택킹·자이빙 카드의 동일 풍속대 평균 대비 델타 비교용. */
      tack: v.overall ? v.overall.tackScore : null,
      gybe: v.overall ? v.overall.gybeScore : null
    };
  }

  /* 저장 메타용 스킬-심박수 회복 지수 — 회전 후 심박 회복 속도(bpm/분).
     세션이 쌓이면 progression 그래프에서 장기 추세를 본다. HR 미기록·
     회복 표본 부족이면 null (Danny 검토 2026-05-23). */
  function skillHrRecoveryIndex() {
    return (state.skillHr && state.skillHr.recoveryIndex != null)
      ? state.skillHr.recoveryIndex : null;
  }

  /* ---------- VPS 카드 ----------
     설명 패널 — 속도 점수를 '풍상 속도'·'풍하 속도' 로 대칭 정리한다
     (Danny 2026-05-23 §A-4: 풍상 속도 설명 누락·풍하 비대칭 해소). */
  var VPS_INFO_HTML =
    '<div class="info-panel" hidden>' +
    '<b>세일링 퍼포먼스 스코어 산출 방식</b> — 속도 점수 70% + 회전 효율 ' +
    '30% 가중.' +
    '<ul>' +
    '<li><b>속도 점수 70%</b> — 풍상·풍하 속도를 각각 계산기 예측 대비 ' +
    '평가합니다. <b>Upwind 풍상</b> 카드는 풍상 속도, <b>Downwind 풍하</b> ' +
    '카드는 풍하 속도, <b>Overall 종합</b> 카드는 둘을 풍상·풍하 주행 시간 ' +
    '으로 가중 평균한 값을 씁니다.</li>' +
    '<li><b>풍상 속도</b> — 같은 풍속·체중·스킬·장비로 리프팅 계산기가 ' +
    '예측한 달성 가능 풍상 VMG 대비, 실측 풍상 VMG(상위 50%) 의 비율. ' +
    '<b>100점</b> = 예측치 도달·초과, <b>0점</b> = 예측치의 50% 이하. ' +
    '계산기 예측은 입력한 스킬 등급에 맞춘 값이라, 100점은 “세계 최고” 가 ' +
    '아니라 “이 조건의 물리 모델이 본 달성 가능치 도달” 을 뜻합니다.</li>' +
    '<li><b>풍하 속도</b> — 계산기에 아직 풍하 전용 속도 모델이 없어, ' +
    '같은 조건의 풍상 보드 속도를 상대 기준으로 쓴 휴리스틱입니다. ' +
    '실측 풍하 SOG(상위 50%) 가 풍상 보드 속도의 1.4배 = 100점, ' +
    '1.0배 = 50점, 0.6배 = 0점. 풍상 속도처럼 정밀한 물리 예측은 아니며, ' +
    'v2 에서 풍하 폴라 모델로 개선 예정입니다.</li>' +
    '<li><b>회전 효율 30%</b> — 이 세션 회전의 효율 점수(0~100) 평균. ' +
    '풍향이 신뢰도 있게 확정되면 회전 전후 VMG 의 로스·게인, 그렇지 않으면 ' +
    '속도 손실·회복 시간 기반입니다. 합성 점수의 회전 항은 Upwind 가 택킹 ' +
    '효율, Downwind 가 자이빙 효율, Overall 이 전체 회전 효율 평균이며, ' +
    '<b>Tacking 택킹·Gybing 자이빙</b> 카드로 따로 보여드립니다.</li>' +
    '<li><b>델타(+/−)</b> — 같은 풍속 영역대(미풍 ≤10kt · 중풍 11–16kt · ' +
    '강풍 ≥17kt) 에 저장된 다른 세션들의 평균 대비 변화입니다. 풍속 조건이 ' +
    '비슷한 세션끼리 비교해야 공정하기 때문입니다. 같은 풍속대에 저장된 ' +
    '세션이 없으면 ‘비교 데이터 부족’ 으로 표기합니다.</li>' +
    '</ul></div>';

  function vpsTone(s) {
    return s >= 70 ? 'hi' : (s >= 45 ? 'mid' : 'lo');
  }
  /* SPS 점수 → 5단계 상태색 (Danny 2026-05-26).
     CHART-DESIGN-SYSTEM.md status 5-step 앵커를 연속 보간한 RGB 를 반환.
     RDChartTheme.statusAt(0..1) 가 없으면 (구버전·테스트 컨텍스트) null
     을 반환해 기존 3-tone 클래스만 적용되게 한다. */
  function vpsStatusColor(score) {
    if (score == null || !window.RDChartTheme ||
        typeof RDChartTheme.statusAt !== 'function') return null;
    return RDChartTheme.statusAt(Math.max(0, Math.min(100, score)) / 100);
  }

  /* 한 점수 카드 타일 — 방향(Upwind / Overall / Downwind)과
     마네버(택킹 / 자이빙) 5개 카드가 모두 이 함수를 공유한다.
     cmp = { avg, count } — 동일 풍속 영역대 평균(없으면 avg=null).
     라벨은 한국어 단일 단어(풍상·풍하·종합·택킹·자이빙)로 두고 EN 모드는
     i18n MAP 이 'Upwind' 등으로 치환한다. 점수에는 5단계 상태색 (number·
     progress bar) 을 inline style 로 입혀 카드 5장이 동일 척도로 보인다. */
  /* ============================================================
   * 도넛 SVG 헬퍼 (Layer 1.5 — Danny 2026-05-26)
   * ------------------------------------------------------------
   * 점수(0~100) 또는 임의 progress 를 원형 진행 표시로 그린다.
   * - 배경 트랙(연한 톤) + 채워지는 진행 호(상태색 그라데이션) + 중앙 텍스트
   * - mockup 의 도넛 패턴: Sales Statistics, Traffic Sources 카드
   * - 색은 chart-theme 의 status 또는 sea 톤. 의미 변경 X.
   * size = px 단위 원 지름. stroke = 두께.
   * gradId 인자가 있으면 그라데이션 색 사용(없으면 단색).
   * ============================================================ */
  function donutSvg(value, max, color, opts) {
    opts = opts || {};
    var size = opts.size || 140;
    var stroke = opts.stroke || 12;
    var r = (size - stroke) / 2;
    var cx = size / 2, cy = size / 2;
    var circ = 2 * Math.PI * r;
    var pct = Math.max(0, Math.min(1, (value || 0) / (max || 100)));
    var dash = circ * pct;
    var gradId = 'rd-donut-grad-' + Math.random().toString(36).slice(2, 8);
    var trackColor = opts.trackColor || 'rgba(10,37,64,.06)';
    /* 그라데이션 — 시작 색은 살짝 옅게, 끝은 진하게 (mockup soft tone) */
    var c2 = opts.lightColor || color;
    var grad =
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="' + c2 + '" stop-opacity="0.85"/>' +
      '<stop offset="100%" stop-color="' + color + '" stop-opacity="1"/>' +
      '</linearGradient></defs>';
    return '<svg class="rd-donut" viewBox="0 0 ' + size + ' ' + size + '" ' +
      'width="' + size + '" height="' + size + '" aria-hidden="true">' +
      grad +
      /* 배경 트랙 */
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" ' +
      'fill="none" stroke="' + trackColor + '" stroke-width="' + stroke + '"/>' +
      /* 진행 호 — 12시 방향에서 시계방향. transform 으로 -90° 회전 */
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" ' +
      'fill="none" stroke="url(#' + gradId + ')" stroke-width="' + stroke + '" ' +
      'stroke-linecap="round" ' +
      'stroke-dasharray="' + circ.toFixed(2) + '" ' +
      'stroke-dashoffset="' + (circ - dash).toFixed(2) + '" ' +
      'transform="rotate(-90 ' + cx + ' ' + cy + ')" ' +
      'style="transition:stroke-dashoffset .9s var(--ease-out)">' +
      '</circle>' +
      '</svg>';
  }

  function vpsTile(label, seg, cmp, isMain) {
    var cls = 'vps-tile' + (isMain ? ' vps-tile--main' : '');
    var inner = '<span class="vps-tile__label">' + label + '</span>';
    if (!seg || seg.score == null) {
      inner += '<div class="vps-tile__donutwrap">' +
        donutSvg(0, 100, '#C7CFD8',
          { size: isMain ? 150 : 110, stroke: isMain ? 14 : 11 }) +
        '<div class="vps-tile__donutctr">' +
        '<span class="vps-tile__score vps-score--na">—</span>' +
        '<span class="vps-tile__max">산출 불가</span>' +
        '</div></div>' +
        '<p class="vps-tile__note">' +
        esc(seg && seg.note ? seg.note : '산출 불가') + '</p>';
      return '<div class="' + cls + '">' + inner + '</div>';
    }
    var s = seg.score, tone = vpsTone(s);
    /* §424-F — SPS 티어 밴드(canonical, coach.js) 색을 단일 출처로 쓴다.
       80+ Elite(gold) / 60–80 Advanced(green) / 40–60 Intermediate(blue)
       / 20–40 Foundational(yellow) / 0–20 Learning(orange). coach.js 미로드
       시에만 기존 status-ramp 폴백. */
    var band = (window.RDCoach && RDCoach.vpsBand) ? RDCoach.vpsBand(s) : null;
    var statColor = band ? band.color : (vpsStatusColor(s) ||
      (tone === 'hi' ? '#27AE60' : tone === 'mid' ? '#E0A100' : '#C0392B'));
    /* 도넛으로 진행 표시 — bar 대신 (Layer 1.5 — Danny 2026-05-26)
       점수 숫자에 data-rd-num 부여 → 카운트업.
       밴드 티어 색 + 티어 라벨(§424-F). */
    inner += '<div class="vps-tile__donutwrap">' +
      donutSvg(s, 100, statColor,
        { size: isMain ? 150 : 110, stroke: isMain ? 14 : 11 }) +
      '<div class="vps-tile__donutctr">' +
      '<span class="vps-tile__score vps-score--' + tone + '"' +
      ' style="color:' + statColor + '"' +
      ' data-rd-num="' + s + '" data-rd-decimals="0">' + s + '</span>' +
      '<span class="vps-tile__max">/ 100</span>' +
      (band ? '<span class="vps-tile__tier" style="color:' + band.color + '">' +
        esc(band.label) + '</span>' : '') +
      '</div></div>';
    /* 비교 델타 — 동일 풍속 영역대(밴드) 평균 대비 (Danny 2026-05-23
       §A-2·A-3). cmp.avg 가 있으면 델타를, 없으면(같은 풍속대 세션 없음)
       '비교 데이터 부족' 을 정직하게 표기한다 — 방향 카드 5장 전부. */
    if (cmp) {
      if (cmp.avg != null) {
        var diff = Math.round(s - cmp.avg);
        var dCls = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'flat');
        var dTxt = diff > 0 ? '▲ +' + diff + ' score'
          : (diff < 0 ? '▼ −' + Math.abs(diff) + ' score' : '= 0 score');
        inner += '<span class="vps-delta vps-delta--' + dCls + '">' + dTxt +
          ' <span style="color:var(--text-dim);font-weight:600">동일 풍속대 평균 대비</span></span>';
      } else {
        inner += '<span class="vps-delta vps-delta--flat">비교 데이터 부족' +
          ' <span style="color:var(--text-dim);font-weight:600">— 동일 풍속대 세션 없음</span></span>';
      }
    }
    /* 카드 하단 군더더기 제거 (Danny 2026-05-23) — 점수 숫자 + 델타만
       남긴다. '속도 N점' 세부 분해와 택킹·자이빙 효율 설명 문단은 더
       이상 표시하지 않는다. 점수 결측 시 안내 문구는 위 결측 분기에서만
       렌더한다(카드가 비지 않도록). */
    return '<div class="' + cls + '">' + inner + '</div>';
  }

  /* 마네버(택킹·자이빙) 정식 카드용 segment 래퍼.
     coach.js computeVPS 가 이미 산출한 tackScore·gybeScore 를 그대로
     점수로 승격할 뿐 — 계산식은 건드리지 않는다. 점수가 결측이면
     산출 불가 안내 문구만 note 로 실어 카드가 비지 않게 한다. 점수가
     있으면 카드 하단 설명 문단은 더 이상 달지 않는다 (Danny 2026-05-23
     — SPS 카드 하단 군더더기 제거). */
  function maneuverSeg(score, kind) {
    if (score == null) {
      return { score: null,
        note: '이 세션에 분류된 ' + kind + '이 없어 점수를 산출할 수 없습니다.' };
    }
    return { score: score };
  }

  /* 미입력 항목을 '어느 카드의 어느 필드' 인지로 묶어 안내한다 —
     무엇이 빠졌는지 사용자가 바로 찾아 채울 수 있게 한다
     (Danny 검토 §issue-3). coach.js 가 돌려주는 missing 항목명 기준. */
  var INPUT_CARD = {
    '풍향(확정)': '풍향 설정', '풍속': '풍향 설정',
    '실측 풍상 VMG(풍향 확정 필요)': '풍향 설정',
    '체중': '라이더 · 장비', '스킬 등급': '라이더 · 장비',
    '윙 사이즈': '라이더 · 장비'
  };
  var INPUT_FIELD = {
    '풍향(확정)': '풍향 확정', '실측 풍상 VMG(풍향 확정 필요)': '풍향 확정',
    '풍속': '풍속', '체중': '체중', '스킬 등급': '스킬 등급', '윙 사이즈': '윙 사이즈'
  };
  function missingInputHelp(missing) {
    if (!missing || !missing.length) return '필요한 입력이 부족합니다';
    var byCard = {}, order = [], other = [];
    missing.forEach(function (m) {
      var card = INPUT_CARD[m];
      if (!card) { if (other.indexOf(m) < 0) other.push(m); return; }
      var field = INPUT_FIELD[m] || m;
      if (!byCard[card]) { byCard[card] = []; order.push(card); }
      if (byCard[card].indexOf(field) < 0) byCard[card].push(field);
    });
    var parts = order.map(function (card) {
      return '<b>‘' + esc(card) + '’ 카드</b>의 ' + esc(byCard[card].join(' · '));
    });
    other.forEach(function (o) { parts.push(esc(o)); });
    return parts.join(', ');
  }

  function renderVPSCard() {
    var card = $('vps-card');
    if (!card) return;
    var head = '<div class="card__head"><h3>세일링 퍼포먼스 스코어 (SPS)</h3>' +
      '<button type="button" class="info-btn" aria-label="세일링 퍼포먼스 스코어 산출 방식 설명">i</button>' +
      '</div>' + VPS_INFO_HTML;

    if (!state.session || !state.session.hasTime) {
      card.innerHTML = head +
        '<p class="empty-note">시각 정보가 없는 GPX 라 세일링 퍼포먼스 스코어를 ' +
        '산출할 수 없습니다.</p>';
      return;
    }
    var v = state.vps;
    if (!v || !v.ok) {
      var missArr = (v && v.missing && v.missing.length) ? v.missing : [];
      card.innerHTML = head +
        '<p class="empty-note">세일링 퍼포먼스 스코어를 산출하려면 다음 입력이 ' +
        '더 필요합니다 — ' + missingInputHelp(missArr) + '.</p>';
      return;
    }
    var bc = windBandVPSAverage();
    /* 5개 정식 점수 카드 — 풍상·풍하(좌) → 종합(가운데) → 택킹·자이빙(우)
       순서, 종합이 정중앙(3번째) (Danny 2026-05-23 §A-1). 마네버 점수는
       coach.js computeVPS 가 이미 산출한 tackScore·gybeScore(= overall
       의 택킹·자이빙 효율 평균)를 그대로 카드로 승격한 것이라 점수
       계산식은 불변 — 배치 순서와 비교 기준만 바꾼다. 델타는 동일
       풍속 영역대 평균 대비 (§A-2·A-3) — 5장 전부 동일 기준. */
    var grid = '<div class="vps-grid">' +
      vpsTile('풍상', v.upwind,
        { avg: bc.upwind, count: bc.counts.upwind }, false) +
      vpsTile('풍하', v.downwind,
        { avg: bc.downwind, count: bc.counts.downwind }, false) +
      vpsTile('종합', v.overall,
        { avg: bc.overall, count: bc.counts.overall }, true) +
      vpsTile('택킹',
        maneuverSeg(v.overall ? v.overall.tackScore : null, '택킹'),
        { avg: bc.tack, count: bc.counts.tack }, false) +
      vpsTile('자이빙',
        maneuverSeg(v.overall ? v.overall.gybeScore : null, '자이빙'),
        { avg: bc.gybe, count: bc.counts.gybe }, false) +
      '</div>';
    var d = v.detail;
    /* 델타 기준 안내 — 동일 풍속 영역대 평균 대비 (§A-2). 종합 항목의
       같은 풍속대 세션 수를 대표값으로 쓴다. */
    var bandTxt;
    if (bc.label && bc.counts.overall > 0) {
      bandTxt = '델타는 같은 풍속 영역대(' + bc.label + ') 에 저장된 다른 세션 ' +
        bc.counts.overall + '개의 세일링 퍼포먼스 스코어 평균 대비입니다. ' +
        '같은 풍속대 세션이 없는 항목은 ‘비교 데이터 부족’ 으로 표시합니다.';
    } else {
      bandTxt = '같은 풍속 영역대(' + (bc.label || '풍속 미입력') +
        ') 에 저장된 다른 세션이 없어 델타 비교를 생략했습니다 — ' +
        '같은 풍속대 세션이 쌓이면 자동으로 비교됩니다.';
    }
    var foot = '기준 — 풍속 ' + d.windSpeedKt + ' kt · 체중 ' + state.rider.weightKg +
      ' kg · ' + esc(state.rider.skill) + ' · 윙 ' + wing1(state.rider.wingM2) +
      ' m² · 프론트 윙 AR ' + d.foilAR + '. ' + bandTxt;
    if (!d.upwindFeasible) {
      foot += ' 계산기가 이 조건에서 풍상 주행 불가로 예측해 속도 점수 일부가 ' +
        '산출되지 않았습니다.';
    }
    card.innerHTML = head + grid + '<p class="vps-foot">' + foot + '</p>';
  }

  /* ---------- Coach Danny 카드 ---------- */
  /* Coach Danny 아바타 = 단무지 사이트 Coach Danny(Danny 실사) 아이콘과 동일 이미지.
     site/assets/images/agent-deny-photo-* 를 상대경로로 참조 (lift-calculator.js
     를 ../assets/js 로 참조하는 것과 같은 방식). WebP 우선 + PNG 폴백. */
  var COACH_AVATAR_HTML =
    '<span class="coach-avatar">' +
    '<picture>' +
    '<source type="image/webp" srcset="../assets/images/agent-deny-photo-160.webp">' +
    '<img src="../assets/images/agent-deny-photo-160.png" alt="Coach Danny" ' +
    'width="56" height="56" loading="lazy" decoding="async">' +
    '</picture></span>';

  /* kt → 현재 단위 숫자 문자열 */
  function uv(kt) { return fmtSpeed(kt / KT); }
  /* kt → 현재 단위 "값 단위" 문자열 */
  function uvU(kt) { return (kt == null) ? '—' : uv(kt) + ' ' + unitLabel(); }
  /* 윙 사이즈 0.5 단위 표기 (4 → "4.0") */
  function wing1(m2) { return Number(m2).toFixed(1); }

  function coachHedge() {
    return '<p class="coach-hedge">현재 윙 값은 이번 세션 <b>실측 풍상 VMG</b> 이고, ' +
      '다른 윙 사이즈 수치는 계산기의 상대 윙-사이즈 곡선을 그 실측값에 곱해 ' +
      '환산한 <b>추정값</b>입니다. 이 분석은 풍상 VMG 만 기준으로 하므로, 더 작은 ' +
      '윙은 이륙·풍하에서 불리할 수 있어 세션 전체 장비는 종합적으로 판단하세요. ' +
      '실제 체감은 파도·체력·세팅에 따라 달라집니다.</p>';
  }

  /* what-if 결과 → 코치 코멘트 HTML (<p> 묶음).
     모든 수치는 실측 풍상 VMG 에 앵커링된 값 — "현재 윙"은 항상 실측,
     다른 윙은 계산기 상대 곡선을 곱한 추정값 (coach.js computeWhatIf). */
  function buildCoachComment(wi) {
    var out = [];
    var measKt = wi.measuredVmgKt;
    var windTxt = state.windSpeedKt + ' kt';
    var wtTxt = state.rider.weightKg + ' kg';
    var skill = esc(state.rider.skill);

    /* 실측 풍상 VMG — what-if 의 기준점. 현재 윙 막대가 이 값과 같다. */
    if (measKt != null) {
      out.push('<p>이번 세션 풍상 VMG 상위 20% — <b>양 택 중 우세 택 기준</b> ' +
        '실측값은 <span class="coach-num">' + uvU(measKt) + '</span> 이고, ' +
        'what-if 의 <b>현재 윙 값은 이 실측값을 그대로 씁니다</b>. ' +
        '약한 택(스킬 갭)이 평균을 깎지 않도록 잘하는 쪽 택을 기준으로 ' +
        '잡았습니다.</p>');
    }

    /* 앵커 불가 — 계산기가 이 조건의 현재 윙을 모델링 못함. 가짜 곡선을
       만들지 않고 실측값만 정직하게 제시한다. */
    if (!wi.anchored) {
      out.push('<p>계산기가 이번 조건(' + windTxt + ' 바람·체중 ' + wtTxt + '·' +
        skill + ')에서 현재 윙(<span class="coach-num">' + wing1(wi.actualWingM2) +
        ' m²</span>)을 풍상 주행으로 모델링하지 못해, 윙 사이즈별 비교는 ' +
        '제공하지 않습니다 — 신뢰할 수 있는 값은 위 실측 풍상 VMG 뿐입니다.</p>');
      return out.join('');
    }

    var dv = wi.deltaVmgKt;
    var perfSameAsActual = (Math.round(wi.optimumWingM2 * 2) ===
      Math.round(wi.actualWingM2 * 2));

    /* --- 퍼포먼스 추천 (메인) — 풍상 VMG 곡선 정점 --- */
    if (!wi.recommendChange) {
      /* 라이더가 이미 정점이거나 개선 추정폭이 노이즈 수준 → 정직하게
         "현재 윙이 적절"이라 말한다. 억지 업그레이드를 만들지 않는다. */
      var gainTxt = (dv != null && dv > 0)
        ? '차이가 ' + uv(dv) + ' ' + unitLabel() + ' 수준에 그쳐 '
        : '의미 있는 개선 여지가 없어 ';
      if (perfSameAsActual) {
        out.push('<p><b>퍼포먼스 추천</b> — 같은 ' + windTxt + ' 바람·체중 ' +
          wtTxt + '·' + skill + ' 기준으로, 계산기는 현재 <span class="coach-num">' +
          wing1(wi.actualWingM2) + ' m²</span> 윙이 곧 풍상 VMG 정점이라고 봅니다 — ' +
          '지금 윙 선택이 적절했습니다.</p>');
      } else {
        out.push('<p><b>퍼포먼스 추천</b> — 같은 ' + windTxt + ' 바람·체중 ' +
          wtTxt + '·' + skill + ' 기준으로, 풍상 VMG 정점은 <span class="coach-num">' +
          wing1(wi.optimumWingM2) + ' m²</span> 이지만 현재 ' + wing1(wi.actualWingM2) +
          ' m² 와의 ' + gainTxt + '(추천 기준 ' +
          wing1(wi.meaningfulDeltaThresholdKt) + ' ' + unitLabel() +
          ' 미만), 굳이 바꾸지 않아도 됩니다.</p>');
      }
    } else {
      var dir = wi.optimumWingM2 < wi.actualWingM2 ? '더 작은' : '더 큰';
      out.push('<p><b>퍼포먼스 추천</b> — 같은 ' + windTxt + ' 바람·체중 ' + wtTxt +
        '·' + skill + ' 기준으로, 계산기는 윙을 <span class="coach-num--good">' +
        wing1(wi.optimumWingM2) + ' m²</span> 로 바꿨을 때 풍상 VMG 가 가장 높을 ' +
        '것으로 추정합니다 — 실측값을 기준으로 환산하면 약 ' +
        '<span class="coach-num--good">' + uvU(wi.optimumVmgKt) + '</span> ' +
        '(현재 ' + wing1(wi.actualWingM2) + ' m² 실측 ' + uvU(wi.actualVmgKt) +
        ' 대비 +' + uv(dv) + ' ' + unitLabel() + ' 추정). 다음 세션에서 ' + dir +
        ' 윙을 시도해 볼 만합니다.</p>');
      if (wi.optimumAtBoundary) {
        out.push('<p>참고 — 정점이 분석 범위(' + wing1(wi.sweep.min) + '~' +
          wing1(wi.sweep.max) + ' m²) 경계에 있어, 실제 정점은 이 범위 밖일 수 ' +
          '있습니다.</p>');
      }
    }

    /* --- 편안함 추천 (참고) — 퍼포먼스 정점보다 한 사이즈 작게 --- */
    if (wi.comfortWingM2 != null) {
      var comfortSame = (Math.round(wi.comfortWingM2 * 2) ===
        Math.round(wi.optimumWingM2 * 2));
      if (comfortSame) {
        out.push('<p><b>편안함 추천</b> — 참고로, <span class="coach-num">' +
          wing1(wi.optimumWingM2) + ' m²</span> 가 풍상 주행이 가능한 가장 작은 ' +
          '윙이라, 퍼포먼스 추천보다 더 작은 편안함용 윙은 따로 없습니다.</p>');
      } else {
        var comfActual = (Math.round(wi.comfortWingM2 * 2) ===
          Math.round(wi.actualWingM2 * 2));
        var cVmgTxt = (wi.comfortVmgKt != null)
          ? '풍상 VMG 는 약 <span class="coach-num">' + uvU(wi.comfortVmgKt) +
            '</span> 로 정점보다 다소 낮지만'
          : '풍상 VMG 는 정점보다 다소 낮지만';
        out.push('<p><b>편안함 추천</b> — 참고로, 한 사이즈 작은 ' +
          '<span class="coach-num">' + wing1(wi.comfortWingM2) + ' m²</span> 는 ' +
          cVmgTxt + ' 윙이 가볍고 펌핑·기동이 한결 수월합니다' +
          (comfActual ? ' — 지금 쓰시는 윙이 바로 이 편안함 추천입니다' : '') +
          '. 빠르게 갈 땐 퍼포먼스 추천을, 길게 편히 탈 땐 이쪽을 고르세요.</p>');
      }
    }

    out.push(coachHedge());
    return out.join('');
  }

  /* what-if 윙 사이즈 스윕 시각화 (0.5 m² 격자 막대).
     막대 값 = 실측 풍상 VMG 에 앵커링된 추정값(p.vmgKt) — "현재 윙"
     막대는 실측값 그대로, 나머지는 계산기 상대 곡선 환산값.
     앵커 불가(anchored=false)면 신뢰할 수 있는 곡선이 없어 생략. */
  function renderWhatIfSweep(wi) {
    if (!wi.anchored) return '';
    var pts = wi.points || [];
    /* 막대 너비(%) = VMG ÷ 최대 VMG. 모든 행의 트랙 폭이 같아야
       막대 길이가 VMG 에 정확히 비례한다 — 트랙 폭 일관성은 CSS
       (.sweep-row__track / __tag min-width:0) 가 보장한다 (§issue-5). */
    var maxV = 0;
    pts.forEach(function (p) { if (p.vmgKt != null && p.vmgKt > maxV) maxV = p.vmgKt; });
    if (maxV <= 0) maxV = 1;
    /* 편안함 추천이 퍼포먼스 추천과 같은 윙이면(정점이 풍상 가능 최소 윙)
       별도 편안함 막대는 표시하지 않는다. */
    var comfortSame = (wi.comfortWingM2 != null && wi.optimumWingM2 != null &&
      Math.round(wi.comfortWingM2 * 2) === Math.round(wi.optimumWingM2 * 2));
    var showComfort = !comfortSame && pts.some(function (p) { return p.isComfort; });
    var rows = pts.map(function (p) {
      var cls = 'sweep-row';
      if (p.isActual) cls += ' sweep-row--actual';
      /* 메인 강조(초록 채움) = 퍼포먼스 추천(VMG 정점),
         보조 강조(초록 테두리) = 편안함 추천(참고). */
      if (p.isOptimum) cls += ' sweep-row--recommended';
      else if (p.isComfort && showComfort) cls += ' sweep-row--comfort';
      var feas = (p.vmgKt != null);
      if (!feas) cls += ' sweep-row--infeasible';
      var w = feas ? Math.max(3, Math.round(p.vmgKt / maxV * 100)) : 0;
      var tag = '';
      if (p.isOptimum) {
        tag = '<span class="sweep-tag sweep-tag--rec">퍼포먼스 추천' +
          (p.isActual ? ' · 현재' : '') + '</span>';
      } else if (p.isComfort && showComfort) {
        tag = '<span class="sweep-tag sweep-tag--comfort">편안함 · 참고' +
          (p.isActual ? ' · 현재' : '') + '</span>';
      } else if (p.isActual) {
        tag = '<span class="sweep-tag sweep-tag--actual">현재 윙</span>';
      }
      var val = feas ? ('VMG ' + uvU(p.vmgKt)) : '풍상 주행 불가';
      return '<div class="' + cls + '">' +
        '<span class="sweep-row__size">' + p.area_m2.toFixed(1) + ' m²</span>' +
        '<span class="sweep-row__track"><span class="sweep-row__bar" style="width:' +
        w + '%"></span></span>' +
        '<span class="sweep-row__val">' + val + '</span>' +
        '<span class="sweep-row__tag">' + tag + '</span></div>';
    }).join('');
    var legend = '<span><i class="lg-actual"></i>현재 사용 윙 (실측)</span>' +
      '<span><i class="lg-recommended"></i>퍼포먼스 추천 (VMG 정점)</span>';
    if (showComfort) {
      legend += '<span><i class="lg-comfort"></i>편안함 추천 (참고)</span>';
    }
    legend += '<span><i class="lg-feasible"></i>다른 윙 추정치</span>';
    return '<div class="coach-whatif">' +
      '<p class="coach-whatif__title">What-if · 윙 사이즈별 풍상 VMG ' +
      '<span class="coach-whatif__basis">상위 20% · 양 택 중 우세 택 기준</span></p>' +
      '<p class="coach-whatif__sub">현재 윙 막대는 이번 세션 풍상 VMG 상위 20% ' +
      '(양 택 중 우세 택 기준), 나머지는 계산기의 상대 윙-사이즈 곡선을 이 값에 ' +
      '곱한 추정치입니다 (0.5 m² 간격) · 초록 채움 = 퍼포먼스 추천, ' +
      '초록 테두리 = 편안함 추천(참고)</p>' +
      rows +
      '<div class="sweep-legend">' + legend + '</div></div>';
  }

  function renderCoachCard() {
    var card = $('coach-card');
    if (!card) return;
    var head = '<div class="card__head"><h3>Coach Danny</h3>' +
      '<span class="card__hint">계산기 기반 장비 코칭 · 추정</span></div>';

    if (!state.session || !state.session.hasTime) {
      card.innerHTML = head +
        '<p class="empty-note">시각 정보가 없는 GPX 라 코칭을 제공할 수 없습니다.</p>';
      return;
    }
    var wi = state.whatif;
    if (!wi || !wi.ok) {
      var missArr = (wi && wi.missing && wi.missing.length) ? wi.missing : [];
      card.innerHTML = head + '<div class="coach-row">' + COACH_AVATAR_HTML +
        '<div class="coach-bubble"><p class="coach-bubble__name">Coach Danny</p>' +
        '<div class="coach-bubble__body"><p>장비 코칭을 시작하려면 다음 입력이 ' +
        '더 필요합니다 — ' + missingInputHelp(missArr) + '. what-if 는 실측 ' +
        '풍상 VMG 에 맞춰 산출되므로 풍향 확정이 필요합니다.</p></div></div></div>';
      return;
    }
    var bubble = '<div class="coach-row">' + COACH_AVATAR_HTML +
      '<div class="coach-bubble">' +
      '<p class="coach-bubble__name">Coach Danny ' +
      '<span class="coach-tag">what-if · 추정</span></p>' +
      '<div class="coach-bubble__body">' + buildCoachComment(wi) + '</div>' +
      '</div></div>';
    card.innerHTML = head + bubble + renderWhatIfSweep(wi);
  }

  /* ---------- 회전 선택 (다중 선택 · 지도·그래프·표 연동) ---------- */
  function selectManeuver(i) {
    var arr = state.selectedManeuvers;
    var pos = arr.indexOf(i);
    var added = pos < 0;
    if (added) arr.push(i); else arr.splice(pos, 1);   // 토글
    Charts.highlightMapManeuver(arr);
    renderSpeedChart();
    renderManeuverTable();
    renderManeuverDetail();
    if (added && arr.length === 1) {   // 첫 선택일 때만 상세로 스크롤
      var card = document.getElementById('maneuver-detail-body');
      if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function clearManeuverSelection() {
    state.selectedManeuvers = [];
    Charts.highlightMapManeuver([]);
    renderSpeedChart();
    renderManeuverTable();
    renderManeuverDetail();
  }

  /* 현재 필터(전체/택킹/자이빙)에 보이는 회전을 모두 선택 */
  function selectAllManeuvers() {
    if (!state.analysis) return;
    var mvs = state.analysis.maneuvers || [];
    var filter = state.maneuverFilter || 'all';
    var arr = [];
    mvs.forEach(function (m, i) {
      if (filter === 'all' || m.type === filter) arr.push(i);
    });
    state.selectedManeuvers = arr;
    Charts.highlightMapManeuver(arr);
    renderSpeedChart();
    renderManeuverTable();
    renderManeuverDetail();
  }

  // 표·베스트 카드 클릭 위임 + 모두 선택 / 전체 해제
  document.addEventListener('click', function (e) {
    if (e.target.closest('#mv-clear-sel')) { clearManeuverSelection(); return; }
    if (e.target.closest('#mv-select-all') ||
        e.target.closest('#mv-select-all-hint')) {
      selectAllManeuvers(); return;
    }
    var t = e.target.closest('[data-mv]');
    if (t && (t.closest('#maneuver-table') || t.closest('#maneuver-bestworst'))) {
      selectManeuver(parseInt(t.getAttribute('data-mv'), 10));
      return;
    }
    // 고속 구간 행 클릭 → 지도 트랙 강조
    var rr = e.target.closest('#runs-list [data-run]');
    if (rr) { selectRun(parseInt(rr.getAttribute('data-run'), 10)); }
  });
  // 고속 구간 행 키보드 접근 (Enter·Space)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var rr = e.target.closest('#runs-list [data-run]');
    if (rr) {
      e.preventDefault();
      selectRun(parseInt(rr.getAttribute('data-run'), 10));
    }
  });

  /* ---------- 세션 저장 / 저장된 세션 ---------- */
  function saveCurrentSession() {
    /* 제목 본문(state.sessionName)과 편집본 여부(edited)를 분리해 저장한다 —
       이름에 ' · 편집본' 을 박지 않고 레코드 플래그로 둔다(헤더 배지로 표시). */
    var res = Storage.saveSession({
      name: state.sessionName,
      edited: !!(state.session && state.session.edited),
      dateEpoch: state.session.startEpoch || Date.now(),
      sport: state.sport,
      windDir: state.windDir,
      windSpeedKt: state.windSpeedKt,
      vps: vpsMeta(),
      hrRecoveryIndex: skillHrRecoveryIndex(),
      gpxText: state.gpxText        // '다시 보기'용 원본 GPX
    }, state.analysis);
    var st = $('save-status');
    st.hidden = false;
    if (res.ok) {
      st.textContent = '✓ 세션을 저장했습니다. 아래 “저장된 세션”에서 비교할 수 있습니다.';
      st.className = 'save-status save-status--ok';
      renderSavedSessions();
      pushSessionToCloud(res.record);   /* §415 — 트랙·메타 Supabase 동기화 (영상 제외) */
    } else {
      st.textContent = '✗ ' + (res.error || '저장에 실패했습니다.');
      st.className = 'save-status save-status--err';
    }
    setTimeout(function () { st.hidden = true; }, 6000);
  }

  /* §415 (Sprint 1.1) — 저장한 세션을 Supabase 로 올린다. 로컬 저장은 위에서
     이미 끝났고, 여기는 cross-device 동기화용 백업이라 실패해도 로컬엔 무영향.
     영상 파일은 cloud 에 올리지 않는다(옥대표님 결정 2026-06-18) — 로컬에
     영상 blob 이 있는지만 검사해 has_video 플래그로 기록한다. */
  /* §415-del — 로컬 세션 삭제 시 cloud 에서도 삭제(부활 방지). best-effort:
     비로그인/오프라인이면 RDCloud 가 tombstone 만 남기고, 다음 pull 이 정리한다.
     로컬 삭제는 이미 완료된 뒤라 실패해도 UX 영향 없음(조용히). */
  function deleteSessionFromCloud(id) {
    if (!id || !window.RDCloud || typeof RDCloud.deleteSession !== 'function') return;
    try { RDCloud.deleteSession(id); } catch (e) {}
  }

  function pushSessionToCloud(record) {
    if (!record || !window.RDCloud || typeof RDCloud.pushSession !== 'function') return;
    var gpx = state.gpxText;
    var sig = state.sessionSig;
    var hasVideoP = Promise.resolve(false);
    if (sig && Storage && typeof Storage.loadVideoBlobs === 'function') {
      hasVideoP = Storage.loadVideoBlobs(sig)
        .then(function (blobs) { return !!(blobs && blobs.length); })
        .catch(function () { return false; });
    }
    hasVideoP.then(function (hasVideo) {
      RDCloud.pushSession(record, gpx, { hasVideo: hasVideo }).then(function (r) {
        /* 성공(r.ok) 또는 no-op(r.reason: not-logged-in/no-record 등) 은 조용히.
           §426 (2026-07-02) — guest-only 모드에선 항상 not-logged-in 이라, 이전엔
           r.ok=false 라 "클라우드 동기화 나중에" cross-device 안내가 뜨던 회귀 fix.
           실제 실패(r.error, reason 없음)만 살짝 안내한다 (로컬 저장은 이미 안전). */
        if (!r || r.ok || r.reason) return;
        var st = $('save-status');              /* 실패만 살짝 안내 (로컬은 안전) */
        if (st) {
          st.hidden = false;
          st.textContent = '✓ 로컬에 저장했습니다. (클라우드 동기화는 나중에 다시 시도됩니다)';
          st.className = 'save-status save-status--ok';
          setTimeout(function () { st.hidden = true; }, 6000);
        }
      });
    });
  }

  /* 세션 목록 펼침 상태 — 기본은 최근 5개만, '전체보기'로 펼친다. */
  var savedTableExpanded = false;
  var SAVED_TABLE_LIMIT = 5;

  /* ---------- 세션 비교 통합 그래프 (Danny 2026-05-23 §C) ---------- */
  var PROG_METRIC_LABEL = {
    avgSpeed: '평균 속도', maxSpeed: '최고 속도',
    distance: '거리', time: '라이딩 시간', hrRecovery: '심박 회복 지수'
  };
  /* 드롭다운 summary 의 현재 선택 표시 갱신 */
  function updateProgMetricSummary() {
    var el = $('prog-metric-summary');
    if (!el) return;
    var sel = state.progMetrics || [];
    el.textContent = sel.length
      ? sel.map(function (m) { return PROG_METRIC_LABEL[m]; }).join(' · ')
      : '선택 없음';
  }
  /* 통합 그래프를 현재 선택 지표·차트 타입으로 다시 그린다.
     지표 0개면 차트를 비우고 빈 안내를 보인다. */
  function renderProgressionChart() {
    updateProgMetricSummary();
    var note = $('prog-empty-note');
    var has = !!(state.progMetrics && state.progMetrics.length);
    if (note) note.hidden = has;
    Charts.renderProgression('progression-chart', Storage.listSessions(), {
      unit: state.unit,
      metrics: state.progMetrics,
      chartType: state.progChartType
    });
  }

  function renderSavedSessions() {
    var list = Storage.listSessions();
    var empty = $('saved-empty'), body = $('saved-body');
    if (!list.length) { empty.hidden = false; body.hidden = true; return; }
    empty.hidden = true; body.hidden = false;

    /* 비교 그래프 — 3분리 → 1통합 (Danny 2026-05-23 §C) */
    renderProgressionChart();

    /* 커리어 누적 데이터 패널 (Danny 검토 2026-05-23 §A2) */
    renderCareerPanel();

    /* 세션 목록 — 최신순. 기본은 최근 5개만 보이고, 나머지는 '전체보기'
       버튼으로 펼치고 '접기'로 다시 숨긴다 (Danny 2026-05-23). */
    var ordered = list.slice().reverse();
    var hasMore = ordered.length > SAVED_TABLE_LIMIT;
    var shown = (hasMore && !savedTableExpanded)
      ? ordered.slice(0, SAVED_TABLE_LIMIT) : ordered;
    var moreWrap = $('saved-table-more'), toggleBtn = $('saved-table-toggle');
    if (moreWrap) moreWrap.hidden = !hasMore;
    if (toggleBtn && hasMore) {
      toggleBtn.textContent = savedTableExpanded
        ? '접기 ▴ · 최근 ' + SAVED_TABLE_LIMIT + '개만'
        : '전체보기 ▾ · 전체 ' + ordered.length + '개';
    }

    $('saved-tbody').innerHTML = shown.map(function (r) {
      /* hasTrack 인 세션만 다시 보기 가능 — 원본 GPX 가 저장돼 있어야 재분석된다.
         이 기능 도입 전에 저장한 세션은 요약만 있어 '요약만' 으로 표시한다. */
      var canLoad = !!r.hasTrack;
      var openCell = canLoad
        ? '<button type="button" class="link-load" data-load="' + r.id +
          '">↻ 다시 보기</button>'
        : '<span class="saved-norec" ' +
          'title="요약만 저장된 세션이라 다시 불러올 수 없습니다">요약만</span>';
      return '<tr class="saved-row' + (canLoad ? ' is-loadable' : '') + '"' +
        (canLoad ? ' data-load="' + r.id + '" title="클릭하면 이 세션을 대시보드에 다시 불러옵니다"' : '') +
        '>' +
        '<td>' + fmtDate(r.dateEpoch).split(' (')[0] + '</td>' +
        '<td>' + i18nT(SPORTS[r.sport] ? SPORTS[r.sport].label : r.sport) + '</td>' +
        '<td>' + fmtDist(r.distanceM) + '</td>' +
        '<td>' + fmtSpeedU(r.maxSpeedMs) + '</td>' +
        '<td>' + fmtSpeedU(r.avgSpeedMovingMs) + '</td>' +
        '<td>' + r.tackCount + '회</td>' +
        '<td>' + r.gybeCount + '회</td>' +
        '<td class="saved-actions">' + openCell +
        '<button type="button" class="link-del" data-del="' + r.id + '">삭제</button></td>' +
        '</tr>';
    }).join('');
  }

  /* §415 (Sprint 1.1) — 다시 보기 cloud-aware 래퍼.
     로컬에 트랙이 있으면 즉시 동기 로드(기존 동작 그대로). 없고 cloud 에
     올라가 있으면(다른 기기에서 저장한 세션) 먼저 GPX 를 받아 로컬에 채운
     뒤 로드한다. 다운로드 경로에선 낙관적으로 true 를 돌려준다 — 호출자
     (showBestRecordSegment)는 같은 기기 로컬 세션이 대부분이라 동기 경로를 탄다. */
  function loadSavedSession(id) {
    if (Storage.loadTrack(id) || !(window.RDCloud && typeof RDCloud.ensureTrack === 'function')) {
      return loadSavedSessionLocal(id);
    }
    var st = $('save-status');
    if (st) {
      st.hidden = false;
      st.textContent = '☁ 클라우드에서 세션을 불러오는 중…';
      st.className = 'save-status';
    }
    RDCloud.ensureTrack(id).then(function () { loadSavedSessionLocal(id); });
    return true;
  }

  /* 저장된 세션 다시 보기(로컬) — 원본 GPX 를 분석 파이프라인에 재투입해
     속도·회전·VMG·지도·세션 요약까지 그 세션 기준으로 다시 렌더한다. */
  function loadSavedSessionLocal(id) {
    var list = Storage.listSessions(), rec = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { rec = list[i]; break; }
    }
    if (!rec) { showError('저장된 세션을 찾을 수 없습니다.'); return false; }
    var gpx = Storage.loadTrack(id);
    if (!gpx) {
      showError('이 세션은 요약만 저장되어 다시 불러올 수 없습니다. ' +
        '새로 저장하는 세션부터 다시 보기가 가능합니다.');
      return false;
    }
    // 스포츠를 먼저 맞춘 뒤 분석 파이프라인을 태운다 (processGpx 는 스포츠를 건드리지 않음)
    if (rec.sport && SPORTS[rec.sport]) state.sport = rec.sport;
    processGpx(gpx, rec.name || '라이딩 세션');
    if ($('dashboard-view').hidden) return false;   // 재파싱 실패 — showError 가 이미 표시됨
    /* §423 — 저장 시점에 영상이 있었는지(cloud _hasVideo) + 저장 시각을 보존.
       processGpx 가 위에서 false 로 리셋했으므로 여기서 덮어쓴다. 이 기기에
       영상 blob 이 없으면 리플레이가 '영상 없음' 안내를 띄운다. */
    state.sessionHasVideoFlag = !!rec._hasVideo;
    state.sessionRemoteDateEpoch = rec.dateEpoch || null;
    // 저장 당시 풍향·풍속 복원 → 택킹/자이빙 분류·VMG·폴라까지 그대로 재현
    if (rec.windSpeedKt != null) {
      state.windSpeedKt = rec.windSpeedKt;
      $('wind-speed-input').value = rec.windSpeedKt;
    }
    if (rec.windDir != null) { setWindPending(rec.windDir); confirmWind(); }
    var st = $('save-status');
    st.hidden = false;
    st.textContent = '✓ 저장된 세션을 다시 불러왔습니다 — ' + (rec.name || '라이딩 세션') + '.';
    st.className = 'save-status save-status--ok';
    setTimeout(function () { st.hidden = true; }, 6000);
    return true;
  }

  /* ============================================================
   *  커리어 누적 데이터 패널 (Danny 검토 2026-05-23 §A2)
   *  히스토리 스탯을 '누적 합계 · 최고 기록 · 평균' 세 종류로 구분.
   *  최고 기록 타일을 누르면 그 기록을 세운 세션 분석으로 이동하고,
   *  지도에 그 기록 구간을 강조한다.
   * ============================================================ */
  function careerGroup(title, tilesHtml, hint) {
    if (!tilesHtml) return '';
    return '<div class="career-group">' +
      '<div class="career-group__title">' + esc(title) +
      (hint ? '<span class="career-group__hint">' + esc(hint) + '</span>' : '') +
      '</div><div class="career-tiles">' + tilesHtml + '</div></div>';
  }
  function careerTile(label, value, sub) {
    return '<div class="career-tile">' +
      '<span class="career-tile__label">' + esc(label) + '</span>' +
      '<span class="career-tile__val">' + esc(value) + '</span>' +
      (sub ? '<span class="career-tile__sub">' + esc(sub) + '</span>' : '') +
      '</div>';
  }
  /* 최고 기록 타일 — hasTrack 인 세션은 클릭 시 그 세션으로 이동 */
  function careerBestTile(label, value, rec, metric) {
    var loadable = rec && rec.hasTrack;
    var src = (rec ? fmtDate(rec.dateEpoch).split(' (')[0] + ' · ' +
      esc(rec.sessionName) : '');
    if (loadable) {
      return '<div class="career-tile career-tile--best is-clickable" ' +
        'data-best-load="' + esc(rec.sessionId) + '" ' +
        'data-best-metric="' + esc(metric) + '" ' +
        'title="클릭하면 이 기록을 세운 세션 분석으로 이동합니다">' +
        '<span class="career-tile__label">' + esc(label) +
          ' <span class="career-tile__go" aria-hidden="true">↗</span></span>' +
        '<span class="career-tile__val">' + esc(value) + '</span>' +
        '<span class="career-tile__sub">' + src + '</span></div>';
    }
    return '<div class="career-tile career-tile--best" ' +
      'title="요약만 저장된 세션이라 이동할 수 없습니다">' +
      '<span class="career-tile__label">' + esc(label) + '</span>' +
      '<span class="career-tile__val">' + esc(value) + '</span>' +
      '<span class="career-tile__sub">' + src + '</span></div>';
  }

  function renderCareerPanel() {
    var box = $('personal-bests');
    if (!box) return;
    var career = Storage.careerStats();
    var pb = Storage.personalBests();
    if (!career) { box.innerHTML = ''; return; }

    /* 누적 합계 — 거리·시간·횟수 */
    var cum =
      careerTile('누적 거리', (career.totalDistanceM / 1000).toFixed(1) + ' km',
        career.sessionCount + '개 세션 합계') +
      careerTile('누적 시간', fmtDur(career.totalMovingSec), '이동 시간 합계') +
      careerTile('누적 횟수', career.sessionCount + ' 회', '저장된 세션 수');

    /* 최고 기록 — 전체 세션 통틀어. 클릭 → 그 세션 분석으로 이동 */
    var bestDefs = [
      ['maxSpeedMs', '최고 속도', 'speed'],
      ['peak10sMs', '10초 Peak', 'speed'],
      ['best500mMs', '500m 베스트', 'speed'],
      ['distanceM', '최장 거리', 'dist']
    ];
    var best = bestDefs.map(function (d) {
      var rec = pb && pb[d[0]];
      if (!rec || !rec.value) return '';
      var v = (d[2] === 'speed') ? fmtSpeedU(rec.value) : fmtDist(rec.value);
      return careerBestTile(d[1], v, rec, d[0]);
    }).join('');

    /* 평균 — 누적 데이터 기준 */
    var avg =
      careerTile('평균 속도', fmtSpeedU(career.avgSpeedMs), '누적 거리 ÷ 누적 시간') +
      careerTile('평균 거리', fmtDist(career.avgDistanceM), '세션당 평균');

    box.innerHTML =
      careerGroup('누적 합계', cum) +
      careerGroup('최고 기록', best,
        '타일을 누르면 그 기록을 세운 세션 분석으로 이동합니다') +
      careerGroup('평균', avg);
  }

  /* 한 기록(metric)이 찍힌 세션 구간(샘플 인덱스 범위) — 지도 강조용.
     최장 거리(distanceM)는 세션 전체가 기록이라 특정 구간이 없어 null. */
  function bestRecordSegment(a, metric) {
    if (!a || !state.session || !state.session.samples) return null;
    var S = state.session.samples;
    if (!S.length) return null;
    function clampI(i) { return Math.max(0, Math.min(S.length - 1, i)); }
    function windowAround(idx, pad) {
      if (idx == null || idx < 0 || idx >= S.length) return null;
      var lo = clampI(idx - pad), hi = clampI(idx + pad);
      return (hi > lo) ? { startIdx: lo, endIdx: hi } : null;
    }
    function rangeFromStart(startIdx, sec) {
      if (startIdx == null || startIdx < 0 || startIdx >= S.length) return null;
      var t0 = S[startIdx].t, j = startIdx;
      while (j < S.length - 1 && S[j].t - t0 < sec) j++;
      return (j > startIdx) ? { startIdx: startIdx, endIdx: j }
                            : windowAround(startIdx, 5);
    }
    if (metric === 'maxSpeedMs') {
      return windowAround(a.summary && a.summary.maxSpeedIdx, 6);
    }
    if (metric === 'peak10sMs') {
      var p = (a.peaks || []).filter(function (x) { return x.windowSec === 10; })[0];
      return p ? rangeFromStart(p.startIdx, 10) : null;
    }
    if (metric === 'best500mMs') {
      var d = (a.distanceBests || []).filter(function (x) {
        return x.distanceM === 500;
      })[0];
      return (d && d.startIdx != null && d.endIdx != null &&
              d.endIdx > d.startIdx)
        ? { startIdx: d.startIdx, endIdx: d.endIdx } : null;
    }
    return null;     // distanceM(최장 거리) — 세션 전체
  }

  /* 최고 기록 타일 클릭 → 그 세션 분석으로 이동 + 기록 구간으로 이동.
     세션만 여는 게 아니라, 그 기록이 찍힌 정확한 구간으로 차트·지도
     커서를 함께 옮긴다 (Danny 검토 2026-05-23 ②). 지도 재렌더의
     invalidateSize(60ms) 가 끝난 뒤 강조·이동하도록 한 박자 늦춘다. */
  function showBestRecordSegment(id, metric) {
    if (!loadSavedSession(id)) return;       // 로드 실패 — showError 가 안내
    setTimeout(function () {
      var seg = bestRecordSegment(state.analysis, metric);
      var S = state.session && state.session.samples;
      if (seg && S && S.length) {
        /* 지도 — 기록 구간을 굵게 강조하고 그 범위로 줌 */
        Charts.highlightMapRun(seg);
        /* 차트·지도 커서 — 기록 구간의 대표 지점(구간 중앙)으로 이동.
           최고 속도는 ±6 샘플 창의 중앙이 곧 정점이다. */
        var rep = Math.round((seg.startIdx + seg.endIdx) / 2);
        rep = Math.max(0, Math.min(S.length - 1, rep));
        var s = S[rep];
        if (s) {
          Charts.setChartCursorByTime(s.t);                 // 속도·심박 차트 crosshair
          Charts.setMapCursorLatLng(s.lat, s.lng, '기록 지점');
        }
      }
      /* 속도 차트와 지도가 함께 보이도록 속도 차트 카드로 스크롤 */
      var anchor = $('speed-card') || document.querySelector('.card--map');
      if (anchor) anchor.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 100);
  }

  document.addEventListener('click', function (e) {
    /* 세션 목록 전체보기 / 접기 토글 */
    if (e.target.closest('#saved-table-toggle')) {
      savedTableExpanded = !savedTableExpanded;
      renderSavedSessions();
      return;
    }
    var d = e.target.closest('[data-del]');
    if (d) {
      var delId = d.getAttribute('data-del');
      Storage.deleteSession(delId);
      deleteSessionFromCloud(delId);          /* §415-del — cloud 에서도 삭제 */
      renderSavedSessions();
      return;
    }
    /* 커리어 최고 기록 타일 → 그 세션 분석으로 이동 + 기록 구간 강조 */
    var bl = e.target.closest('[data-best-load]');
    if (bl) {
      showBestRecordSegment(bl.getAttribute('data-best-load'),
        bl.getAttribute('data-best-metric'));
      return;
    }
    var ld = e.target.closest('[data-load]');
    if (ld) loadSavedSession(ld.getAttribute('data-load'));
  });

  /* ---------- 유틸 ---------- */
  function showError(msg) {
    var t = $('error-toast');
    t.textContent = '⚠ ' + msg;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.hidden = true; }, 6500);
  }
  function debounce(fn, ms) {
    var id;
    return function () {
      var a = arguments, c = this;
      clearTimeout(id);
      id = setTimeout(function () { fn.apply(c, a); }, ms);
    };
  }

  // §401 — Expose state to window for pdf-export.js consumption.
  //        (Sam Phase 0-2 Exec block reads global state to render
  //         Grade chip / Top 3 / delta chip / sparkline. Ported from
  //         v2 §400 — 옥대표님 2026-06-07 "go v1".)
  //        state is declared once (L33) and only mutated thereafter,
  //        so this single reference stays live for all later reads.
  window.state = state;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
