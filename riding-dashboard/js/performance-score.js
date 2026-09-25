/* Reviewed prototype v1. These weights/coverage thresholds are product heuristics,
 * not a validated skill grade. Straight scores retain the legacy model scaling.
 * Scores use the analyzed track consistently, including turn success denominators.
 * Minimums: 60 eligible seconds per straight side; 5 fully observed turns per
 * turn side. 3–4 turns are provisional. Time coverage is not independent sample
 * count or statistical confidence. Missing cells never silently change weights.
 */
(function (global) {
  'use strict';
  var KT = 1.9438444924406;
  var WEIGHTS = { upwind: 0.35, downwind: 0.35, tack: 0.15, gybe: 0.15 };
  function finite(n) { return typeof n === 'number' && isFinite(n); }
  function clamp(n) { return Math.max(0, Math.min(100, n)); }
  function mean(a) { return a.length ? a.reduce(function (s, n) { return s+n; },0)/a.length : null; }
  function round(n) { return finite(n) ? Math.round(n) : null; }
  function cell() { return {score:null, eligible:false, status:'no-data', count:0, seconds:0, confidence:'insufficient', metrics:{}}; }
  function compute(analysis, legacy, options) {
    var a=analysis||{}, o=options||{}, detail=(legacy&&legacy.detail)||{};
    var windKnown=finite(a.windDir), low=o.windConfidence==='낮음'||o.windConfidence==='low';
    var windUsable=windKnown&&!low;
    var domains={}, eligibleCells=0;
    ['upwind','downwind'].forEach(function (key) {
      var domain={weight:WEIGHTS[key],score:null,S:cell(),P:cell()};
      ['S','P'].forEach(function (side) {
        var c=domain[side], g=a.wind&&a.wind.tackSplit&&a.wind.tackSplit[key]&&a.wind.tackSplit[key][side];
        c.basis=key==='upwind'?'upwind-vmg-model':'downwind-sog-upwind-model';
        if (!g) { if (!windUsable) c.status='wind-unavailable'; return; }
        c.count=g.count||0;c.seconds=g.timeSec||0;
        var m=g[key==='upwind'?'vmg':'sog'];
        var measured=m&&finite(m.top50)?m.top50*KT:null;
        var predicted=key==='upwind'?detail.predUpwindVmgKt:detail.predUpwindVboatKt;
        c.metrics={measuredKt:measured,referenceKt:finite(predicted)?predicted:null,scale:key==='upwind'?1.2:2.6};
        if (!windUsable) {c.status='wind-unavailable';return;}
        if (!(measured>=0)||!(predicted>0)) {c.status='model-unavailable';return;}
        if (c.seconds<60) {c.status=c.seconds>0?'insufficient':'no-data';return;}
        c.score=round(clamp(measured/predicted/c.metrics.scale*100));
        c.eligible=true;c.status='eligible';c.confidence=c.seconds>=180?'more-coverage':'limited';
      });domains[key]=domain;
    });
    ['tack','gybe'].forEach(function (key) {
      var domain={weight:WEIGHTS[key],score:null,S:cell(),P:cell()};
      ['S','P'].forEach(function (side) {
        var c=domain[side], turns=(a.maneuvers||[]).filter(function(m){return m.type===key&&m.side===side;});
        c.basis='retention40-recovery30-success30';c.count=turns.length;
        var losses=[],recoveries=[],scores=[],success=0,censored=0;
        turns.forEach(function(m){
          if(m.turnSuccess)success++;
          if(finite(m.lossPct))losses.push(m.lossPct);
          var observed=m.recoveryStatus==='recovered'||m.recoveryStatus==='not-recovered';
          if(!observed){censored++;return;}
          if(!(m.refSpeedMs>0)||!finite(m.minSpeedMs)||typeof m.turnSuccess!=='boolean')return;
          if(m.recoveryStatus==='recovered'&&(!finite(m.recoverySec)||m.recoverySec<0))return;
          var recovery=m.recoveryStatus==='recovered'?m.recoverySec:null;
          if(recovery!=null)recoveries.push(recovery);
          var retention=clamp(100*m.minSpeedMs/m.refSpeedMs);
          var recScore=recovery==null?0:clamp(100*(1-recovery/25));
          scores.push(.4*retention+.3*recScore+.3*(m.turnSuccess?100:0));
        });
        c.validCount=scores.length;c.censoredCount=censored;
        c.metrics={lossPct:mean(losses),recoverySec:mean(recoveries),recoveredCount:recoveries.length,successCount:success,attemptCount:turns.length,successRate:turns.length?100*success/turns.length:null};
        if(!windUsable){c.status='wind-unavailable';return;}
        if(!turns.length)return;
        // Do not drop poorly observed attempts and inflate the remaining score.
        if(scores.length!==turns.length){c.status='incomplete-observation';return;}
        if(scores.length<3){c.status='insufficient';return;}
        c.score=round(mean(scores));c.eligible=scores.length>=5;
        c.status=c.eligible?'eligible':'provisional';c.confidence=scores.length>=10?'more-coverage':'limited';
      });domains[key]=domain;
    });
    Object.keys(domains).forEach(function(k){var d=domains[k];['S','P'].forEach(function(s){if(d[s].eligible)eligibleCells++;});if(d.S.eligible&&d.P.eligible)d.score=round((d.S.score+d.P.score)/2);});
    var total={score:null,S:null,P:null,status:'partial',eligibleCells:eligibleCells,requiredCells:8};
    ['S','P'].forEach(function(side){if(Object.keys(domains).every(function(k){return domains[k][side].eligible;}))total[side]=round(Object.keys(domains).reduce(function(sum,k){return sum+WEIGHTS[k]*domains[k][side].score;},0));});
    if(eligibleCells===8){total.score=round(Object.keys(domains).reduce(function(sum,k){return sum+WEIGHTS[k]*(domains[k].S.score+domains[k].P.score)/2;},0));total.status='complete';}
    return {version:'draft-v1',label:'모델 대비 참고 점수',total:total,domains:domains,wind:{source:o.windSource||'unknown',confidence:o.windConfidence||'unknown',usable:windUsable},notes:['검토용 휴리스틱이며 실력 등급이 아닙니다.','풍상: VMG 상위 50% / 풍상 예측 VMG / 1.2. 풍하: SOG 상위 50% / 풍상 예측 속도 / 2.6.','회전: 최저 속도 유지 40% + 회복 30% + 속도 기준 추정 성공 30%. 회복 25초 이상은 회복 항목 0점.','분석 대상 구간 기준입니다. 회전의 S/P는 진입 택입니다.']};
  }
  var api={compute:compute,weights:WEIGHTS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else global.RDPerformanceScore=api;
})(typeof window!=='undefined'?window:globalThis);
