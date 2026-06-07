/* 임시 검증 드라이버 — 스크린샷 검증용. __verify.html 에서만 로드된다.
   index.html 의 실제 동작은 건드리지 않는다. 검증 후 삭제 대상. */
(function () {
  'use strict';
  var errs = [];
  window.addEventListener('error', function (e) {
    errs.push((e.message || 'error') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno);
  });
  function $(id) { return document.getElementById(id); }
  function title(m) {
    document.title = 'VERIFY: ' + m + (errs.length ? ' [JS오류 ' + errs.length + ': ' + errs[0] + ']' : '');
  }
  function setVal(id, v) {
    var el = $(id);
    if (!el) return;
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function waitFor(cond, then, tries) {
    tries = tries || 0;
    if (cond()) { then(); return; }
    if (tries > 160) { title('TIMEOUT'); return; }
    setTimeout(function () { waitFor(cond, then, tries + 1); }, 100);
  }
  /* 렌더된 DOM 의 실제 computed style 로 HR 표·P/S 표 통일 여부를 판정.
     타이틀은 짧고 ASCII 만 (list_tabs 잘림 방지). */
  function proof() {
    function cs(sel, prop) {
      var e = document.querySelector(sel);
      return e ? getComputedStyle(e)[prop] : 'NA';
    }
    var hrFS = cs('#hr-skill-body .stats-val', 'fontSize');
    var mgFS = cs('#maneuver-groups .stats-val', 'fontSize');
    var hrAl = cs('#hr-skill-body tbody td', 'textAlign');
    var mgAl = cs('#maneuver-groups tbody td', 'textAlign');
    var hrHd = cs('#hr-skill-body thead th', 'fontSize');
    var mgHd = cs('#maneuver-groups thead th', 'fontSize');
    var color = document.querySelectorAll(
      '#maneuver-groups [class*="mg-cell"], #hr-skill-body [class*="mg-cell"]').length;
    var hrRs = document.querySelectorAll('#hr-skill-body td.rd-grp[rowspan]').length;
    var mgRs = document.querySelectorAll('#maneuver-groups td.rd-grp[rowspan]').length;
    var valOK = hrFS === mgFS && hrFS !== 'NA';
    var alOK = hrAl === 'center' && mgAl === 'center';
    var hdOK = hrHd === mgHd && hrHd !== 'NA';
    /* 단위 라벨 영어화 검증 — 마뉴버·HR 표의 <small> 단위 중 한국어
       (회/점/초) 가 남았는지 / 영어(times/score/sec) 로 바뀌었는지. */
    var sm = document.querySelectorAll(
      '#maneuver-quality small, #maneuver-groups small, #hr-skill-body small');
    var krU = 0, enU = 0;
    for (var i = 0; i < sm.length; i++) {
      var ut = sm[i].textContent.trim();
      if (ut === '회' || ut === '점' || ut === '초') krU++;
      else if (ut === 'times' || ut === 'score' || ut === 'sec') enU++;
    }
    /* 퍼포먼스 통계 표 — 컬럼 구조·지표 행 순서 검증.
       statsCols = 2단 헤더 마지막 줄 <th> 수 = 6 (포트 평균·상위50·
       상위20 · 스타보드 평균·상위50·상위20 — Danny 2026-05-25 평균
       컬럼 복원). mOrder = 지표 등장 순서. E 후 = S(SOG)·A(풍각)·
       V(VMG)·R(심박). 힐·피치는 표본 있으면 H·P 로 VMG 뒤. */
    var statsCols = document.querySelectorAll(
      '#stats-panel-body thead tr:last-child th').length;
    var mNames = document.querySelectorAll(
      '#stats-panel-body .stats-table__metric .stats-mx__name');
    var mOrder = '';
    for (var mi = 0; mi < mNames.length; mi++) {
      var mt = mNames[mi].textContent;
      if (mt.indexOf('SOG') >= 0) mOrder += 'S';
      else if (mt.indexOf('TWA') >= 0) mOrder += 'A';
      else if (mt.indexOf('VMG') >= 0) mOrder += 'V';
      else if (mt.indexOf('힐') >= 0) mOrder += 'H';
      else if (mt.indexOf('피치') >= 0) mOrder += 'P';
      else if (mt.indexOf('심박') >= 0) mOrder += 'R';
      else mOrder += '?';
    }
    /* 세션 평균 스트립 — G. 풍향 확정 시 4 그룹
       (포트·스타보드 × 풍상·풍하). 풍향 없으면 카드 숨김 → 0. */
    var savgN = document.querySelectorAll(
      '#session-avg-card .savg-group').length;
    /* 회전효율 용어 통일 — 대시보드 본문에 '회전효율' 있고 옛 라벨
       (품질 지표 / 평균 효율 / 회전 품질) 이 사라졌는지. eff=OK 면 통일. */
    var bt = document.body.textContent || '';
    var effNew = bt.indexOf('회전효율') >= 0;
    var effOld = /품질 지표|평균 효율|회전 품질/.test(bt);
    var effStr = (effNew && !effOld) ? 'OK'
      : (effNew ? 'OLDLEFT' : 'MISSING');
    /* 통계 표 풍상 VMG 행 구성 — split(P|S) 행 수와 unsplit(전체 합산)
       행 수. G 후 = vmgSplit≥1, vmgAll=0 (전체 행 제거됨). */
    var vmgRows = document.querySelectorAll(
      '#stats-panel-body tr.stats-row--vmg');
    var vmgAll = 0, vmgSplit = 0;
    for (var vi = 0; vi < vmgRows.length; vi++) {
      if (vmgRows[vi].querySelector('.stats-unsplit-cell')) vmgAll++;
      else vmgSplit++;
    }
    return ' valFS=' + (valOK ? 'OK' + hrFS : 'FAIL[' + hrFS + '/' + mgFS + ']') +
      ' align=' + (alOK ? 'OKctr' : 'FAIL[' + hrAl + '/' + mgAl + ']') +
      ' hdrFS=' + (hdOK ? 'OK' : 'FAIL') +
      ' color=' + (color === 0 ? 'none' : 'FAIL' + color) +
      ' rowspan=' + hrRs + '/' + mgRs +
      ' krUnit=' + krU + ' enUnit=' + enU +
      ' statsCols=' + statsCols + ' mOrder=' + mOrder + ' savg=' + savgN +
      ' vmgSplit=' + vmgSplit + ' vmgAll=' + vmgAll + ' eff=' + effStr;
  }
  /* 리플레이 레이아웃 검증용 — 캔버스를 MediaRecorder 로 ~1초 녹화해
     브라우저가 실제로 디코드할 수 있는 WebM 파일을 만든다. 잘못된 mp4 는
     replay.js 가 디코드 실패로 클립을 제거(→ videoReady=false → 지도
     모드로 폴백)하므로 영상·나란히 모드를 검증할 수 없다. 진짜 영상이
     있어야 setLayout('video'·'both') 이 폴백 없이 적용된다. */
  function makeRealVideo(cb) {
    try { window.alert = function () {}; window.confirm = function () { return true; }; } catch (e) {}
    try {
      /* 정사각(280×280) 영상 — 와이드 중앙 스테이지에서 좌우 필러박스
         (pillarbox)가 생겨 영상이 가운데 정렬됐는지 눈으로 검증된다.
         가운데 사각형은 프레임 경계를 또렷이 보여 준다. */
      var c = document.createElement('canvas');
      c.width = 280; c.height = 280;
      var ctx = c.getContext('2d');
      var stream = c.captureStream(15);
      var rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        var blob = new Blob(chunks, { type: 'video/webm' });
        cb(new File([blob], 'verify.webm', { type: 'video/webm' }));
      };
      rec.start();
      var frame = 0;
      var iv = setInterval(function () {
        ctx.fillStyle = (frame % 2) ? '#2A4A5A' : '#3F6E82';
        ctx.fillRect(0, 0, 280, 280);
        ctx.fillStyle = '#FF7A1F';
        ctx.fillRect(90, 90, 100, 100);
        frame++;
      }, 60);
      setTimeout(function () { clearInterval(iv); try { rec.stop(); } catch (e) {} }, 900);
    } catch (e) { cb(null); }
  }
  /* WebM 파일 1개를 영상 파일 입력에 주입한다. */
  function injectVideoFile(file) {
    var input = $('replay-video-input');
    if (!input || !file) return;
    try {
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}
  }
  /* 리플레이 3-뷰 레이아웃을 렌더된 DOM 의 실제 박스로 판정한다.
     vpIn/mpIn = 영상·지도 패널이 좌측 컬럼(L) 인지 중앙 스테이지(C) 인지. */
  function replayProof() {
    function box(id) {
      var e = $(id);
      if (!e) return null;
      var r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }
    function par(id) {
      var e = $(id);
      if (!e || !e.parentNode) return 'NA';
      var p = e.parentNode.id || '?';
      if (p === 'replay-lcol') return 'L';
      if (p === 'replay-cstage') return 'C';
      return p;
    }
    var lc = box('replay-lcol'), vp = box('replay-vpanel'),
        mp = box('replay-mpanel'), rd = box('replay-rider');
    /* C — 바람 격자 캔버스가 존재하고 실제 크기로 그려졌는지.
       wg=OK<w>x<h> 면 격자 캔버스가 지도 위에 깔렸다는 뜻. */
    var wg = $('replay-wind-grid');
    var wgStr = wg ? (wg.width > 0 && wg.height > 0
      ? 'OK' + wg.width + 'x' + wg.height : 'EMPTY') : 'NA';
    /* C 보강 — 캔버스에 실제로 픽셀이 칠해졌는지 알파 채널을 듬성듬성
       스캔한다. drawWindGrid 가 격자를 그렸다면 알파>0 픽셀이 나온다.
       blank = 캔버스는 있는데 아무것도 안 그려짐(풍향 null·미호출 등).
       wgZ/wgOp/wgDisp = 가시성(z-index·opacity·display) 진단. */
    var wgPaint = 'NA', wgVis = '';
    if (wg && wg.getContext && wg.width > 0) {
      try {
        var gx = wg.getContext('2d');
        var dat = gx.getImageData(0, 0, wg.width, wg.height).data;
        var nz = 0, step = 4 * 1009;
        for (var p = 3; p < dat.length; p += step) { if (dat[p] !== 0) nz++; }
        wgPaint = nz > 0 ? 'paint' + nz : 'blank';
      } catch (e) { wgPaint = 'err:' + (e.message || e).toString().slice(0, 20); }
      var wcs = getComputedStyle(wg);
      wgVis = ' wgZ=' + wcs.zIndex + ' wgOp=' + wcs.opacity +
        ' wgDisp=' + wcs.display + ' wgCW=' + wg.clientWidth;
    }
    /* F — 보드 추적 토글 버튼. 누르기 전/후 aria-pressed 와 is-on
       클래스가 함께 뒤집히는지 확인하고 원복한다. */
    var mm = $('replay-mapmode');
    var fStr = 'NA';
    if (mm) {
      var before = mm.getAttribute('aria-pressed');
      mm.click();
      var afterP = mm.getAttribute('aria-pressed');
      var afterCls = mm.classList.contains('is-on');
      mm.click();
      var backP = mm.getAttribute('aria-pressed');
      fStr = (before === 'false' && afterP === 'true' && afterCls &&
        backP === 'false') ? 'OKtoggle' : 'FAIL[' + before + '>' +
        afterP + '/' + afterCls + '>' + backP + ']';
    }
    /* 8c — ladder rung. 추적 모드를 켜고(클릭 핸들러가 drawLadderRung
       호출) ladder 캔버스에 빨강 픽셀이 칠해졌는지 알파 스캔. 켠 채로
       둬서 스크린샷에도 풍상 레드라인이 보이게 한다. */
    var lad = 'NA', ladAng = 'NA';
    if (mm) {
      if (mm.getAttribute('aria-pressed') !== 'true') mm.click();
      var lcv = $('replay-ladder');
      if (lcv && lcv.getContext && lcv.width > 0) {
        try {
          var lctx = lcv.getContext('2d');
          var ldat = lctx.getImageData(0, 0, lcv.width, lcv.height).data;
          var lnz = 0;
          for (var q = 3; q < ldat.length; q += 4 * 1009) {
            if (ldat[q] !== 0) lnz++;
          }
          lad = lnz > 0 ? 'paint' + lnz : 'blank';
          /* ladder rung 실제 렌더 각도 측정 — 빨강 픽셀들로 선 각도를
             산출해 풍향(드라이버 설정 205°)과 대조한다. rung 은 풍향에
             수직: 방향벡터 (cos wd, sin wd) → 선 각도(mod 180) = wd
             mod 180. wd=205 → 기대 ≈ 25.0. (Danny 2026-05-25: 격자·
             rung 이 확정 풍향 기준인지 각도 숫자로 검증) */
          var LW = lcv.width;
          var reds = [];
          for (var rp = 0; rp < ldat.length; rp += 4 * 53) {
            if (ldat[rp] > 150 && ldat[rp + 1] < 115 &&
                ldat[rp + 2] < 115 && ldat[rp + 3] > 120) {
              var pi2 = rp / 4;
              reds.push([pi2 % LW, Math.floor(pi2 / LW)]);
            }
          }
          if (reds.length >= 4) {
            var ccx = 0, ccy = 0;
            reds.forEach(function (r) { ccx += r[0]; ccy += r[1]; });
            ccx /= reds.length; ccy /= reds.length;
            var pA = reds[0], dMax = -1;
            reds.forEach(function (r) {
              var d = (r[0] - ccx) * (r[0] - ccx) + (r[1] - ccy) * (r[1] - ccy);
              if (d > dMax) { dMax = d; pA = r; }
            });
            var pB = reds[0]; dMax = -1;
            reds.forEach(function (r) {
              var d = (r[0] - pA[0]) * (r[0] - pA[0]) +
                (r[1] - pA[1]) * (r[1] - pA[1]);
              if (d > dMax) { dMax = d; pB = r; }
            });
            var aDeg = Math.atan2(pB[1] - pA[1], pB[0] - pA[0]) * 180 / Math.PI;
            aDeg = ((aDeg % 180) + 180) % 180;
            ladAng = aDeg.toFixed(1);
          }
        } catch (e) { lad = 'err'; }
      } else { lad = 'nocv'; }
    }
    /* C/8c 가시성 — 격자·ladder 캔버스가 Leaflet pane 위로 합성되는지.
       캔버스에 픽셀이 있어도(.replay__map z-index 누락 시) Leaflet
       타일·pane 이 그 위를 덮을 수 있다. pointer-events 를 잠시 켜
       elementsFromPoint(지도 중앙)의 위→아래 순서를 보고, 격자 인덱스가
       첫 Leaflet 요소보다 작으면(위면) 지도 위에 보이는 것 (Danny
       2026-05-25: 격자·rung 미표시 = Leaflet pane 가림 버그 검증). */
    var stk = 'NA';
    var mpEl = $('replay-mpanel');
    if (mpEl && wg && document.elementsFromPoint) {
      try {
        var mr = mpEl.getBoundingClientRect();
        var cx = Math.round(mr.left + mr.width / 2);
        var cy = Math.round(mr.top + mr.height / 2);
        var ldEl = $('replay-ladder');
        var pe0 = wg.style.pointerEvents;
        var pe1 = ldEl ? ldEl.style.pointerEvents : '';
        wg.style.pointerEvents = 'auto';
        if (ldEl) ldEl.style.pointerEvents = 'auto';
        var es = document.elementsFromPoint(cx, cy) || [];
        wg.style.pointerEvents = pe0 || '';
        if (ldEl) ldEl.style.pointerEvents = pe1 || '';
        var iWg = -1, iLd = -1, iLeaf = -1;
        for (var s = 0; s < es.length; s++) {
          var ce = es[s];
          var cn = typeof ce.className === 'string' ? ce.className : '';
          if (ce === wg && iWg < 0) iWg = s;
          if (ce === ldEl && iLd < 0) iLd = s;
          if (iLeaf < 0 && /leaflet-(tile|pane|marker|map)/.test(cn)) iLeaf = s;
        }
        /* topmost-first 이므로 작은 인덱스 = 위. Leaflet 요소가 격자보다
           위(iLeaf < iWg)면 가려진 것. iLeaf<0 = 격자 위에 Leaflet 없음
           = 안 가려짐. */
        var covered = (iLeaf >= 0 && iWg >= 0 && iLeaf < iWg);
        stk = (iWg < 0 ? 'NOWG' : (covered ? 'COVERED' : 'OK')) +
          '.wg' + iWg + '.ld' + iLd + '.leaf' + iLeaf;
      } catch (e) { stk = 'err'; }
    }
    /* 동적 보드 아이콘 — 보드·세일 요소 존재 + 세일에 rotate transform.
       icon=BSR = 보드(B)·세일(S)·세일 회전 transform(R) 모두 OK. */
    var bd = document.querySelector('.rd-ph__board') ? 'B' : '-';
    var sailE = document.querySelector('.rd-ph__sail');
    bd += sailE ? 'S' : '-';
    bd += (sailE && /rotate/.test(sailE.getAttribute('transform') || ''))
      ? 'R' : '-';
    /* #44 — 좌측 컬럼 타일 분배. 데이터 패널(rider)은 flex-grow 0
       (내용 높이), 아래 타일(좌측 컬럼에 든 vpanel/mpanel/stats)은
       flex-grow 1 (남는 공간 채움). ridSc = rider 가 내용보다 작아
       스크롤바가 뜨는지(scrollHeight>clientHeight+2 면 NG). */
    function fg(id) {
      var e = $(id);
      return e ? getComputedStyle(e).flexGrow : 'NA';
    }
    var ridF = fg('replay-rider');
    var botId = null;
    ['replay-vpanel', 'replay-mpanel', 'replay-stats'].forEach(function (id) {
      var e = $(id);
      if (e && e.parentNode && e.parentNode.id === 'replay-lcol' && !e.hidden) {
        botId = id;
      }
    });
    var botF = botId ? fg(botId) : 'NA';
    var ridEl = $('replay-rider');
    var ridSc = ridEl
      ? (ridEl.scrollHeight <= ridEl.clientHeight + 2 ? 'noscroll' : 'SCROLL')
      : 'NA';
    /* #45 — 리플레이 오버레이 안에 한국어(한글)가 남았는지 스캔.
       kr=0 이면 뷰어 UI 전부 영어. 캔버스·data-* 는 제외하고 보이는
       텍스트만 — innerText 기준. */
    var rv = $('replay-view');
    var krN = 0, krTxt = '';
    if (rv) {
      var txt = rv.innerText || rv.textContent || '';
      var km = txt.match(/[가-힣]/g);
      krN = km ? km.length : 0;
      var kw = txt.match(/[가-힣]+/g);
      if (kw) krTxt = '(' + kw.slice(0, 6).join('_') + ')';
    }
    return ' lcolW=' + (lc ? lc.w : 'NA') +
      ' vpIn=' + par('replay-vpanel') + ' mpIn=' + par('replay-mpanel') +
      ' vp=' + (vp ? vp.w + 'x' + vp.h : 'NA') +
      ' mp=' + (mp ? mp.w + 'x' + mp.h : 'NA') +
      ' rd=' + (rd ? rd.w + 'x' + rd.h : 'NA') +
      ' ridF=' + ridF + ' bot=' + (botId || 'none') + ':' + botF +
      ' ridSc=' + ridSc + ' kr=' + krN + krTxt +
      ' wg=' + wgStr + ' wgP=' + wgPaint + wgVis + ' F=' + fStr +
      ' lad=' + lad + ' ladAng=' + ladAng + ' stk=' + stk + ' icon=' + bd;
  }
  /* What-if 윙 스윕 + 퍼포먼스 통계 표 풍상 VMG 를 한 화면에서 같이
     읽어 같은 앱 상태에서 대조한다. wd=확정 풍향 / spP20·spS20 = 통계
     표 풍상 VMG 포트·스타보드 상위 20% / spAll20 = 새로 추가한 양 택
     합산(전체) 행 상위 20% / actual = What-if 현재 윙(우세 택 앵커). */
  function whatifProof() {
    var wd = ($('wind-dir-input') || {}).value || '?';
    /* 통계 표 풍상 VMG — split 행(P|S)과 전체 행(unsplit)을 구분한다.
       split 셀: P평균·P50·P20·S평균·S50·S20 → .stats-val idx 2·5.
       전체 행: avg·top50·top20 → .stats-val idx 2. */
    var sp = 'sp=none', spAll = 'spAll20=none';
    var vmgRows = document.querySelectorAll('#stats-panel-body tr.stats-row--vmg');
    var splitRow = null, allRow = null;
    for (var k = 0; k < vmgRows.length; k++) {
      if (vmgRows[k].querySelector('.stats-unsplit-cell')) {
        if (!allRow) allRow = vmgRows[k];
      } else if (!splitRow) {
        splitRow = vmgRows[k];
      }
    }
    if (splitRow) {
      var sv = splitRow.querySelectorAll('.stats-val');
      if (sv.length >= 6) {
        sp = 'spP20=' + sv[2].textContent.trim() +
             ' spS20=' + sv[5].textContent.trim();
      }
    }
    if (allRow) {
      var av = allRow.querySelectorAll('.stats-val');
      if (av.length >= 3) spAll = 'spAll20=' + av[2].textContent.trim();
    }
    var rows = document.querySelectorAll('#coach-card .sweep-row');
    if (!rows.length) {
      return ' wd=' + wd + ' ' + sp + ' ' + spAll + ' whatif=none';
    }
    var sizes = [], actualVal = '?', optVal = '?';
    for (var i = 0; i < rows.length; i++) {
      var sz = rows[i].querySelector('.sweep-row__size');
      var vl = rows[i].querySelector('.sweep-row__val');
      if (sz) sizes.push(sz.textContent.replace(/[^0-9.]/g, ''));
      var cn = rows[i].className;
      if (cn.indexOf('sweep-row--actual') >= 0 && vl) actualVal = vl.textContent.trim();
      if (cn.indexOf('sweep-row--recommended') >= 0 && vl) optVal = vl.textContent.trim();
    }
    return ' wd=' + wd + ' ' + sp + ' ' + spAll +
      ' rows=' + rows.length + ' min=' + sizes[0] +
      ' max=' + sizes[sizes.length - 1] +
      ' actual=' + actualVal + ' opt=' + optVal;
  }
  function ready(mode) {
    var sel = {
      hr: '#hr-skill-card', hrzone: '#hr-zone-card', hreff: '#hr-eff-card',
      stats: '#stats-panel-card', hist: '#histogram-chart',
      mg: '#maneuver-groups', compare: '#maneuver-detail-compare',
      coach: '#coach-card', whatif: '#coach-card', prog: '#saved-body .prog-panel',
      savg: '#session-avg-card'
    }[mode];
    var t = sel ? document.querySelector(sel) : null;
    if (t) {
      var c = t.closest('.card') || t;
      c.scrollIntoView({ block: 'start' });
    }
    setTimeout(function () {
      if (mode === 'coach' || mode === 'whatif') {
        title('READY ' + mode + whatifProof());
      } else {
        var hrRows = document.querySelectorAll('#hr-skill-body table tbody tr').length;
        title('READY ' + mode + ' · HR행수=' + hrRows + proof());
      }
    }, 350);
  }
  /* 속도 분포 파이 — 작은 구간 '기타' 병합 검증 (Danny 2026-05-25).
     Chart.getChart 로 렌더된 파이 인스턴스를 직접 읽어, '기타'
     슬라이스 존재 + 0%로 표시되는 개별 슬라이스 부재를 확인한다. */
  function histProof() {
    try {
      var ch = (typeof Chart !== 'undefined' && Chart.getChart)
        ? Chart.getChart('histogram-chart') : null;
      if (!ch) return ' NOCHART';
      var labs = ch.data.labels || [];
      var data = (ch.data.datasets[0] || {}).data || [];
      var tot = data.reduce(function (s, v) { return s + v; }, 0) || 1;
      var otherN = 0, zeroLeak = 0, minMain = 999;
      for (var i = 0; i < labs.length; i++) {
        var pct = data[i] / tot * 100;
        if (String(labs[i]).indexOf('기타') >= 0) { otherN++; continue; }
        if (Math.round(pct) === 0) zeroLeak++;
        if (pct < minMain) minMain = pct;
      }
      return ' slices=' + labs.length + ' other=' + otherN +
        ' zeroLeak=' + zeroLeak + ' minMainPct=' + minMain.toFixed(1);
    } catch (e) { return ' ERR ' + (e.message || e); }
  }
  window.addEventListener('load', function () {
    var mode = (location.hash || '').replace('#', '') || 'dash';
    /* rec 모드 — 최고 기록 타일 검증 전에 localStorage 를 비운다.
       반복 QA 실행으로 저장소가 차면 트랙 데이터가 evict 돼
       hasTrack=false 가 되고 타일이 클릭 불가가 되기 때문. */
    if (mode === 'rec' || mode === 'lang') {
      try { localStorage.clear(); } catch (e) {}
    }
    title('loading sample');
    setTimeout(function () {
      $('sample-btn').click();
      waitFor(function () { return !$('dashboard-view').hidden; }, function () {
        /* 라이더·풍속 입력 — Coach Danny what-if(윙 VMG 추천 차트)에 필요 */
        setVal('rider-weight-input', 75);
        setVal('rider-wing-input', 6.0);
        setVal('wind-speed-input', 18);
        setVal('wind-dir-input', 205);
        title('confirming wind');
        $('wind-confirm-btn').click();
        setTimeout(function () {
          title('saving sessions');
          $('save-session-btn').click();
          setTimeout(function () {
            $('save-session-btn').click();
            setTimeout(function () {
              if (mode.indexOf('replay') === 0) {
                /* replay / replay-video / replay-both / replay-map */
                $('replay-btn').click();
                var sub = mode.split('-')[1] || '';
                setTimeout(function () {
                  if (sub === 'video' || sub === 'both' || sub === 'map') {
                    /* 세 뷰 모두 진짜 영상이 있는 상태로 검증한다 — 지도
                       뷰도 좌측 하단 타일에 영상이 들어가야 하기 때문. */
                    title('recording test video');
                    makeRealVideo(function (file) {
                      injectVideoFile(file);
                      /* 영상 메타데이터 로드 + 자동배치까지 넉넉히 대기 */
                      setTimeout(function () {
                        var lb = document.querySelector(
                          '.replay__lay[data-lay="' + sub + '"]');
                        if (lb) lb.click();
                        setTimeout(function () {
                          title('READY ' + mode + replayProof());
                        }, 900);
                      }, 1600);
                    });
                  } else if (sub === 'd') {
                    /* D 검증 — 영상 싱크 오프셋 persist. 영상 주입 → 시작
                       시각을 수동 입력(123.4s) → 디바운스 저장 → 전 클립
                       제거 → 같은 영상 재주입 → 복원값 비교. */
                    var SET = 123.4;
                    title('recording test video');
                    makeRealVideo(function (file) {
                      injectVideoFile(file);
                      setTimeout(function () {
                        var cn = document.querySelector(
                          '#replay-sync .replay-sync__cnum');
                        if (cn) {
                          cn.value = String(SET);
                          cn.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        setTimeout(function () {
                          var ls1 = localStorage.getItem('rd_videosync_v1') || '';
                          var rm = $('replay-video-remove');
                          if (rm) rm.click();
                          setTimeout(function () {
                            makeRealVideo(function (f2) {
                              injectVideoFile(f2);
                              setTimeout(function () {
                                var cn2 = document.querySelector(
                                  '#replay-sync .replay-sync__cnum');
                                var rest = cn2 ? parseFloat(cn2.value) : NaN;
                                var ok = Math.abs(rest - SET) < 0.2;
                                title('READY replay-d set=' + SET +
                                  ' saved=' +
                                  (ls1.indexOf('verify') >= 0 ? 'Y' : 'N') +
                                  ' restored=' +
                                  (isFinite(rest) ? rest : 'NA') + ' ' +
                                  (ok ? 'PERSIST-OK' : 'PERSIST-FAIL'));
                              }, 2300);
                            });
                          }, 500);
                        }, 850);
                      }, 1700);
                    });
                  } else if (sub === 'sail') {
                    /* 동적 보드 아이콘 — 세일이 풍하측(리워드)에 물리적
                       으로 맞게 놓이는지 검증. 각 시킹 지점에서 헤딩
                       (.rd-ph__rot style.transform)·세일각(.rd-ph__sail
                       transform)을 읽어 awa=angDiff(풍향,헤딩) 부호로
                       판정한다 — awa>0 면 바람이 좌현에서 와 세일은
                       우현(sa<0), awa<0 면 세일은 좌현(sa>0) 이어야 한다.
                       풍향은 드라이버가 설정한 205°. */
                    var sScrub = document.getElementById('replay-scrub');
                    var sSail = document.querySelector('.rd-ph__sail');
                    var sRot = document.querySelector('.rd-ph__rot');
                    var WD = 205;
                    var adf = function (a, b) {
                      return ((b - a + 540) % 360) - 180;
                    };
                    var rotVal = function (s) {
                      var m = (s || '').match(/rotate\(\s*(-?[0-9.]+)/);
                      return m ? parseFloat(m[1]) : null;
                    };
                    var sPts = [200, 350, 500, 650, 800];
                    var res = [];
                    sPts.forEach(function (v) {
                      if (sScrub) {
                        sScrub.value = String(v);
                        sScrub.dispatchEvent(
                          new Event('input', { bubbles: true }));
                      }
                      var hd = sRot ? rotVal(sRot.style.transform) : null;
                      var sa = sSail
                        ? rotVal(sSail.getAttribute('transform')) : null;
                      if (hd == null || sa == null) { res.push('NA'); return; }
                      var awa = adf(WD, hd);
                      var ok = (awa > 0 && sa < 0) || (awa < 0 && sa > 0) ||
                        Math.abs(awa) < 2;
                      res.push((ok ? 'ok' : 'BAD') + '.awa' +
                        Math.round(awa) + '.sa' + Math.round(sa));
                    });
                    var pass = res.every(function (r) {
                      return r.indexOf('BAD') < 0;
                    });
                    title('READY replay-sail leeward=' +
                      (pass ? 'OK' : 'FAIL') + ' ' + res.join(' '));
                  } else if (sub === 'wd') {
                    /* 풍향 갱신 검증 — RDReplay.setWindDir 로 풍향을
                       여러 값으로 바꾸며 ladder rung 각도가 따라가는지
                       측정. rung 각도(mod 180) = windDir mod 180.
                       205→25 · 100→100 · 270→90 · 205→25 기대.
                       (Danny 2026-05-25: 격자·rung 이 확정 풍향 기준 +
                       재확정 시 갱신) */
                    var mmW = document.getElementById('replay-mapmode');
                    if (mmW && mmW.getAttribute('aria-pressed') !== 'true') {
                      mmW.click();
                    }
                    var measLad = function () {
                      var lc = document.getElementById('replay-ladder');
                      if (!lc || !lc.width) return 'NA';
                      var d = lc.getContext('2d')
                        .getImageData(0, 0, lc.width, lc.height).data;
                      var W = lc.width, pts = [];
                      for (var i = 0; i < d.length; i += 4 * 53) {
                        if (d[i] > 150 && d[i + 1] < 115 &&
                            d[i + 2] < 115 && d[i + 3] > 120) {
                          var pi = i / 4;
                          pts.push([pi % W, Math.floor(pi / W)]);
                        }
                      }
                      if (pts.length < 4) return 'NA';
                      var cx = 0, cy = 0;
                      pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
                      cx /= pts.length; cy /= pts.length;
                      var A = pts[0], m = -1;
                      pts.forEach(function (p) {
                        var dd = (p[0] - cx) * (p[0] - cx) +
                          (p[1] - cy) * (p[1] - cy);
                        if (dd > m) { m = dd; A = p; }
                      });
                      var B = pts[0]; m = -1;
                      pts.forEach(function (p) {
                        var dd = (p[0] - A[0]) * (p[0] - A[0]) +
                          (p[1] - A[1]) * (p[1] - A[1]);
                        if (dd > m) { m = dd; B = p; }
                      });
                      var a = Math.atan2(B[1] - A[1], B[0] - A[0]) *
                        180 / Math.PI;
                      return (((a % 180) + 180) % 180).toFixed(1);
                    };
                    setTimeout(function () {
                      var a1 = measLad();              // 205 → ~25
                      window.RDReplay.setWindDir(100);
                      var a2 = measLad();              // 100 → ~100
                      window.RDReplay.setWindDir(270);
                      var a3 = measLad();              // 270 → ~90
                      window.RDReplay.setWindDir(205);
                      var a4 = measLad();              // 205 → ~25
                      title('READY replay-wd wd205=' + a1 + ' wd100=' + a2 +
                        ' wd270=' + a3 + ' wd205b=' + a4);
                    }, 500);
                  } else if (sub === 'lines') {
                    /* 보드 바우 끝 선 검증 — 풍향 축(검정)·ladder rung
                       (빨강) 개별 토글 + 보드 몸통 침범 없음 (Danny
                       2026-05-25 #2·#3). ladder 캔버스의 검정·빨강
                       픽셀을 세고, 토글을 끄면 해당 색이 사라지는지,
                       보드 중심 둘레 박스가 선 없이 비어 있는지 본다. */
                    var scanLines = function () {
                      var lc = document.getElementById('replay-ladder');
                      if (!lc || !lc.width) return null;
                      var d = lc.getContext('2d')
                        .getImageData(0, 0, lc.width, lc.height).data;
                      var blk = 0, red = 0;
                      for (var i = 0; i < d.length; i += 4 * 53) {
                        var r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
                        if (a < 120) continue;
                        if (r > 150 && g < 115 && b < 115) red++;
                        else if (r < 70 && g < 70 && b < 85) blk++;
                      }
                      return { blk: blk, red: red };
                    };
                    var boardClear = function () {
                      var ph = document.querySelector('.rd-ph');
                      var lc = document.getElementById('replay-ladder');
                      if (!ph || !lc || !lc.width) return 'NA';
                      var pr = ph.getBoundingClientRect();
                      var cr = lc.getBoundingClientRect();
                      var dp = cr.width ? (lc.width / cr.width) : 1;
                      var cx = Math.round((pr.left + pr.width / 2 -
                        cr.left) * dp);
                      var cy = Math.round((pr.top + pr.height / 2 -
                        cr.top) * dp);
                      var bx = Math.round(4 * dp);   // 보드 폭 안쪽 작은 박스
                      if (cx - bx < 0 || cy - bx < 0 ||
                          cx + bx > lc.width || cy + bx > lc.height) {
                        return 'oob';
                      }
                      try {
                        var dd = lc.getContext('2d').getImageData(
                          cx - bx, cy - bx, bx * 2, bx * 2).data;
                        var nz = 0;
                        for (var k = 3; k < dd.length; k += 4) {
                          if (dd[k] > 30) nz++;
                        }
                        return nz;
                      } catch (e) { return 'err'; }
                    };
                    setTimeout(function () {
                      var s0 = scanLines();
                      var bc = boardClear();
                      var ax = document.getElementById('replay-axis-toggle');
                      if (ax) ax.click();
                      var s1 = scanLines();
                      var ld = document.getElementById(
                        'replay-ladder-toggle');
                      if (ld) ld.click();
                      var s2 = scanLines();
                      title('READY replay-lines bothOn=blk' +
                        (s0 ? s0.blk : '?') + '/red' + (s0 ? s0.red : '?') +
                        ' axisOff=blk' + (s1 ? s1.blk : '?') +
                        ' ladderOff=red' + (s2 ? s2.red : '?') +
                        ' boardClear=' + bc);
                    }, 500);
                  } else {
                    title('READY ' + mode + replayProof());
                  }
                }, 1800);
              } else if (mode === 'compare') {
                var all = $('mv-select-all-hint');
                if (all) all.click();
                else {
                  var rows = document.querySelectorAll('#maneuver-tbody tr');
                  for (var i = 0; i < Math.min(rows.length, 6); i++) rows[i].click();
                }
                setTimeout(function () { ready('compare'); }, 700);
              } else if (mode === 'rec') {
                /* 최고 기록 타일 클릭 → 세션+구간 이동 (#5). 커리어
                   패널은 대시보드 렌더 시점에 그려지므로, 세션 2개
                   저장 뒤 샘플을 한 번 더 로드해 패널을 다시 채운 다음
                   클릭 가능 타일을 눌러 본다 — JS 오류 없이 동작하고
                   showBestRecordSegment 가 지도 커서('기록 지점')를
                   찍는지 확인. */
                $('sample-btn').click();
                waitFor(function () {
                  return !$('dashboard-view').hidden;
                }, function () {
                  setTimeout(function () {
                    var recTiles = document.querySelectorAll(
                      '.career-tile--best.is-clickable');
                    var allTiles = document.querySelectorAll(
                      '.career-tile--best');
                    var recN = recTiles.length;
                    var errPre = errs.length;
                    if (recN > 0) recTiles[0].click();
                    setTimeout(function () {
                      var cursorOK = (document.body.textContent || '')
                        .indexOf('기록 지점') >= 0;
                      title('READY rec tiles=' + recN + '/' +
                        allTiles.length + ' clickErr=' +
                        (errs.length - errPre) +
                        ' cursor=' + (cursorOK ? 'placed' : 'no'));
                    }, 900);
                  }, 1600);
                });
              } else if (mode === 'lang') {
                /* i18n 토글 검증 — 초기 상태(ko), 'en' 전환 후 dashboard
                   영역 한국어 잔존 카운트, 'ko' 복원 확인. 'site-header'
                   ·'trust-bar' (메인 사이트 영역) 는 카운트 제외. */
                function countHangul() {
                  var clone = document.body.cloneNode(true);
                  var skip = clone.querySelectorAll(
                    '.site-header,.trust-bar,[data-rd-i18n-skip],script,style');
                  for (var k = 0; k < skip.length; k++) {
                    skip[k].parentNode && skip[k].parentNode.removeChild(skip[k]);
                  }
                  var t = clone.textContent || '';
                  var m = t.match(/[가-힣]/g);
                  return m ? m.length : 0;
                }
                setTimeout(function () {
                  if (!window.RDI18n) {
                    title('READY lang ERR no-RDI18n');
                    return;
                  }
                  var l0 = RDI18n.getLang();
                  var ko0 = countHangul();
                  var tBtn = document.querySelector(
                    '.rd-langtoggle__btn[data-rd-lang-btn="en"]');
                  var btnPresent = !!tBtn;
                  RDI18n.setLang('en');
                  setTimeout(function () {
                    var l1 = RDI18n.getLang();
                    var en1 = countHangul();
                    var lsEn = (function () {
                      try { return localStorage.getItem('dmj_rd_lang'); }
                      catch (e) { return 'NA'; }
                    })();
                    var onBtn = document.querySelector(
                      '.rd-langtoggle__btn.is-on');
                    var onBtnLang = onBtn ? onBtn.getAttribute('data-rd-lang-btn') : 'NA';
                    RDI18n.setLang('ko');
                    setTimeout(function () {
                      var l2 = RDI18n.getLang();
                      var ko2 = countHangul();
                      title('READY lang init=' + l0 + ' btn=' + btnPresent
                        + ' koCount=' + ko0
                        + ' en=' + l1 + ' enCount=' + en1 + ' onBtn=' + onBtnLang
                        + ' lsKey=' + lsEn
                        + ' restored=' + l2 + ' koAfter=' + ko2);
                    }, 800);
                  }, 800);
                }, 700);
              } else if (mode === 'hist') {
                /* 속도 분포 파이 '기타' 병합 — 렌더된 파이 직접 검증 */
                setTimeout(function () {
                  title('READY hist' + histProof());
                }, 700);
              } else {
                ready(mode);
              }
            }, 800);
          }, 800);
        }, 1000);
      });
    }, 500);
  });
})();
