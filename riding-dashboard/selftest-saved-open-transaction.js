/* Saved-session failure safety. All records/coordinates are synthetic.
   Runs actual open/load/show functions with offline DOM/storage doubles.
   Optional DMJ_V2_APP_SOURCE checks the same assertions against an older source. */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RealAnalysis = require('./js/analysis.js');
const source = fs.readFileSync(process.env.DMJ_V2_APP_SOURCE || path.join(__dirname, 'js/v2-app.js'), 'utf8');
function block(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, 'function boundaries exist');
  return source.slice(a, b);
}
const code = [
  block('  function openSavedSession(', '  /* 화면 상단에 한 줄 안내'),
  block('  function loadGpxText(', '  /* §543'),
  block('  function show(session,', '  /* 세션 시그니처'),
  block('  function applyWind(dir, mode)', '  var qaApplying = false;'),
  block('  function restoreRiderInputs(', '  function openSavedSession('),
  block('  function reapplyEdits()', '  function renderEditBar()'),
  block('  function restoreSavedExclusions(', '  /* §487')
].join('\n');
function setup(options = {}) {
  const oldSession = {samples:[{t:0,lat:0,lng:0}], startEpoch:946684800000};
  const CUR = {session:oldSession, fullSession:oldSession, analysis:{windDir:5},
    name:'Old synthetic ride', openedRecId:'old-id', openedRevision:7, gpxText:'old track',
    windDir:5, est:{windDir:5}, sessionGear:{board:'old board'}, restoredInputs:{old:true},
    edit:{excludeRanges:[{from:3,to:4}]}, fusion:{old:true}, windNogo:{old:true}};
  const nodes = {};
  ['in-purpose','in-windspeed','in-weight','in-wing','in-skill'].forEach(id => nodes[id] = {value:'old '+id});
  const points = Array.from({length:15}, (_,i) => ({lat:0,lng:i*0.00005,time:946684900000+i*1000,speed:null}));
  const parsed = {tracks:[{name:'New synthetic ride',segments:[points]}],hasTime:true,speedSource:'derived'};
  const alerts = [], analysisWinds = [], writes = [], events = [];
  const handlers = {};
  let analysisCalls = 0, rendered = 0;
  const ctx = {CUR,console,Date,Math,JSON,Object,Number,Array,Promise,KT:1.943844,plots:[],THEME:{},qaApplying:false,
    window:{scrollTo(){}},document:{getElementById(){return null},querySelector(){return null},dispatchEvent(event){events.push(event)}},
    CustomEvent:function(type,opts){this.type=type;this.detail=opts.detail},
    $(id){return nodes[id] || (nodes[id]={value:'',style:{},textContent:'',addEventListener(type,fn){handlers[id+':'+type]=fn}})},
    alertLine(msg){alerts.push(msg)},
    RDStorage:{nsPrefix(){return 'synthetic-owner:'},loadTrack(){return options.missing ? null : options.compact ? 'RDTRK1:synthetic' : '<gpx>synthetic</gpx>'},
      isCompactTrack(){return !!options.compact},decodeTrack(){if(options.decodeThrow)throw new Error('decode fault');return options.decodeNull ? null : points.map(p=>({...p,t:p.time/1000}))}},
    Gpx:{parseGPX(){if(options.parseFault)throw new Error('parse fault');return parsed}},
    An:{normalizeSession(p){if(options.normalizeFault)throw new Error('normalize fault');return RealAnalysis.normalizeSession(p)},
      analyzeSession(s,w,o){analysisWinds.push(w);if(++analysisCalls===(options.analysisFaultAt||-1))throw new Error('analysis fault');return RealAnalysis.analyzeSession(s,w,o)},
      applyEdits:RealAnalysis.applyEdits},
    estimateWind(){CUR.windNogo={new:true};CUR.windRotation={new:true};if(options.estimateFault)throw new Error('estimate fault');return {windDir:90}},
    analysisOpts(){return {}},seedFromProfile(got){return got},
    renderFusionBanner(){if(options.bannerFault)throw new Error('banner fault')},
    qaExclusions(){return options.qa ? [{from:4,to:6}] : []},
    setEditableTitle(){if(options.drawFault)throw new Error('draw fault');rendered++},
    riderFromForm(){return {}},riderFromFormSynced(){return {}},windSpeedFromForm(){return 12},
    Store:{saveSession(meta,analysis){writes.push({meta,analysis});return options.savePending ? options.savePending : {ok:true,record:{id:meta.replaceId||'created-id',revision:9}}}},
    setTimeout(){},v2SessionWorkload(){return null},sessionSig(s){return 'synthetic-'+s.samples.length},
    gearForSave(){return null},p0CurrentId(){return CUR.openedRecId}
  };
  ctx.window.RDStorage=ctx.RDStorage;
  ['autoRecordRideLoad','renderKpis','renderCompare','renderGuestBanner','renderRace','renderRiderNote',
   'renderInputSources','renderHistogram','renderTimeline','renderTurns','renderTurnExtras','renderPerfExtra',
   'renderSessions','renderTraining','populateReplayGhost','renderPhysiology','renderEnvironment','renderTrack',
   'renderSegmentStepper','renderAttitude','renderCoach'].forEach(k=>ctx[k]=()=>{});
  vm.createContext(ctx);vm.runInContext(code,ctx);
  vm.runInContext(block("    var sb = $('btn-save');","    var rb = $('btn-rider');"),ctx);
  const rec = {id:'new-id',revision:8,name:'New synthetic ride',windDir:210,purpose:'race',
    windSpeedKt:18,rider:{weightKg:70,wingM2:5,skill:'advanced'},gear:{board:'new board'}};
  return {ctx,CUR,nodes,alerts,analysisWinds,oldSession,rec,writes,events,save:()=>handlers['btn-save:click'](),rendered:()=>rendered};
}
let passed = 0, failed = 0;
const cases=[];
function test(name,run){cases.push({name,run})}
for(const compact of [false,true]) {
  const kind=compact?'compact':'GPX';
  for(const fault of ['normalizeFault','estimateFault','analysisFaultAt','bannerFault']) {
    test(kind+' '+fault+' preserves track, identity, inputs and save target',()=>{
      const e=setup({compact,[fault]:fault==='analysisFaultAt'?1:true});
      const previous={...e.CUR}, values=Object.fromEntries(Object.entries(e.nodes).map(([k,v])=>[k,v.value]));
      assert.doesNotThrow(()=>e.ctx.openSavedSession(e.rec));
      assert.strictEqual(e.CUR.openedRecId,'old-id');assert.strictEqual(e.CUR.fullSession,e.oldSession);
      for(const key of Object.keys(previous))assert.strictEqual(e.CUR[key],previous[key],key);
      for(const key of Object.keys(e.CUR))assert(key==='requestSeq'||key in previous,key+' leaked');
      for(const [key,val] of Object.entries(values))assert.strictEqual(e.nodes[key].value,val,key);
      assert(e.alerts.some(t=>/Could not reopen/.test(t)));
    });
  }
  test(kind+' successful reopen uses saved wind, new track and original revision',()=>{
    const e=setup({compact});assert.strictEqual(e.ctx.openSavedSession(e.rec),true);
    assert.strictEqual(e.CUR.openedRecId,'new-id');assert.strictEqual(e.CUR.openedRevision,8);
    assert.notStrictEqual(e.CUR.fullSession,e.oldSession);assert.strictEqual(e.CUR.session,e.CUR.fullSession);
    assert.strictEqual(e.CUR.windDir,210);assert.deepStrictEqual(e.analysisWinds,[210]);
    assert.strictEqual(e.CUR.name,e.rec.name);assert(e.rendered()>0);assert.strictEqual(e.CUR.edit,null);
  });
  test(kind+' panel failure retains matching new record and track',()=>{
    const e=setup({compact,drawFault:true});assert.strictEqual(e.ctx.openSavedSession(e.rec),true);
    assert.strictEqual(e.CUR.openedRecId,'new-id');assert.notStrictEqual(e.CUR.session,e.oldSession);
    assert.strictEqual(e.CUR.session,e.CUR.fullSession);assert.strictEqual(e.CUR.windDir,210);
    assert(e.alerts.some(t=>/loaded, but analysis or a panel/.test(t)));assert.strictEqual(e.CUR.restoringSaved,false);
  });
  test(kind+' QA exclusions use new title, wind and full track on first draw',()=>{
    const e=setup({compact,qa:true});assert.strictEqual(e.ctx.openSavedSession(e.rec),true);
    assert.strictEqual(e.CUR.name,e.rec.name);assert.strictEqual(e.CUR.windDir,210);
    assert.notStrictEqual(e.CUR.fullSession,e.oldSession);assert.strictEqual(e.CUR.fullSession.samples.length,15);
    assert(e.CUR.session.samples.length<15);assert(e.analysisWinds.every(w=>w===210));
  });
  test(kind+' repeated failed reopen does not change the successfully opened record',()=>{
    const e=setup({compact,analysisFaultAt:2});e.ctx.openSavedSession(e.rec);const loaded=e.CUR.session;
    e.ctx.openSavedSession({...e.rec,id:'third-id',revision:9,name:'Third ride'});
    assert.strictEqual(e.CUR.openedRecId,'new-id');assert.strictEqual(e.CUR.openedRevision,8);
    assert.strictEqual(e.CUR.session,loaded);assert.strictEqual(e.CUR.fullSession,loaded);
  });
  for (const qa of [false,true]) {
    test(kind+' failed saved-exclusion analysis keeps manual edits for retry (QA '+qa+')',()=>{
      const e=setup({compact,qa,analysisFaultAt:2});e.rec.excludeRanges=[{from:1,to:3}];
      assert.doesNotThrow(()=>e.ctx.openSavedSession(e.rec));
      assert.strictEqual(e.CUR.openedRecId,'new-id');
      assert.strictEqual(JSON.stringify(e.CUR.edit.excludeRanges),JSON.stringify(e.rec.excludeRanges));
      // Actual recalculation used by Save, not a direct call to reapplyEdits.
      e.ctx.applyWind(null, 'keep');
      const times=e.CUR.session.samples.map(p=>p.origT == null ? p.t : p.origT);
      assert(!times.some(t=>t>=1&&t<=3),'manual exclusions survive retry');
      if(qa)assert(!times.some(t=>t>=4&&t<=6),'QA exclusions survive retry');
      assert.strictEqual(e.CUR.fullSession.samples.length,15);
    });
  }
  for(const qa of [false,true]) {
    test(kind+' actual Save retries exclusions and updates saved revision (QA '+qa+')',async()=>{
      const e=setup({compact,qa,analysisFaultAt:2});e.rec.excludeRanges=[{from:1,to:3}];
      e.ctx.openSavedSession(e.rec);await e.save();
      assert.strictEqual(e.writes.length,1);assert.strictEqual(e.writes[0].meta.replaceId,'new-id');
      assert.strictEqual(e.writes[0].meta.samples.length,15,'raw track retained');
      assert.strictEqual(e.CUR.openedRevision,9,'post-reanalysis identity guard accepts own save');
      const times=e.CUR.session.samples.map(p=>p.origT==null?p.t:p.origT);
      assert(!times.some(t=>t>=1&&t<=3),'saved analysis excludes manual range');
      if(qa)assert(!times.some(t=>t>=4&&t<=6),'saved analysis excludes QA range');
      assert.strictEqual(e.writes[0].analysis,e.CUR.analysis);
      assert(e.events.some(ev=>ev.type==='rd:save-state'&&ev.detail.state==='saved'));
    });
  }
  test(kind+' stale request and different account do not open a track',()=>{
    const e=setup({compact});e.CUR.requestSeq=3;
    e.ctx.openSavedSession(e.rec,true,{seq:2,scope:'synthetic-owner:'});
    e.ctx.openSavedSession(e.rec,true,{seq:3,scope:'other-owner:'});
    assert.strictEqual(e.CUR.session,e.oldSession);assert.strictEqual(e.CUR.openedRecId,'old-id');
    assert.strictEqual(e.analysisWinds.length,0);
  });
}
test('invalid GPX preserves previous session without changing inputs',()=>{
 const e=setup({parseFault:true});e.ctx.openSavedSession(e.rec);
 assert.strictEqual(e.CUR.openedRecId,'old-id');assert.strictEqual(e.CUR.session,e.oldSession);
 assert.strictEqual(e.nodes['in-weight'].value,'old in-weight');
});
test('compact decoder exception is reported without losing the current track',()=>{
 const e=setup({compact:true,decodeThrow:true});assert.doesNotThrow(()=>e.ctx.openSavedSession(e.rec));
 assert.strictEqual(e.CUR.openedRecId,'old-id');assert.strictEqual(e.CUR.fullSession,e.oldSession);
 assert(e.alerts.some(t=>/decode fault/.test(t)));
});
test('navigation during pending Save does not apply the previous record identity',async()=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve});
 const e=setup({savePending:pending});e.ctx.openSavedSession(e.rec);
 const done=e.save();e.CUR.session={samples:[{t:0}],startEpoch:99};e.CUR.openedRecId='navigated-id';e.CUR.openedRevision=20;
 finish({ok:true,record:{id:'new-id',revision:9}});await done;
 assert.strictEqual(e.CUR.openedRecId,'navigated-id');assert.strictEqual(e.CUR.openedRevision,20);
 assert(!e.events.some(ev=>ev.type==='rd:save-state'&&ev.detail.state==='saved'));
});
(async()=>{
 for(const c of cases){try{await c.run();passed++;console.log('PASS '+c.name)}catch(e){failed++;console.error('FAIL '+c.name+': '+e.message)}}
 console.log(`${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
})();
