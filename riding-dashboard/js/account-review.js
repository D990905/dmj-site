/* Account inspection uses the existing signed-in SDK. No record persistence. */
(function(g){
  'use strict';
  g.RD_PUBLIC_NO_SAMPLE=true;
  var enabled=new URLSearchParams(g.location.search).get('review')==='readonly';
  var api={enabled:enabled};g.RDReadOnlyReview=api;
  if(!enabled)return;
  var memory=new Map(),reports=new Map(),cloudCount=null,owner=null,banner=null;
  var originalStorage=g.localStorage,originalFetch=g.fetch.bind(g);
  Object.defineProperty(g,'indexedDB',{configurable:true,value:{open:function(){throw new Error('읽기 전용 검사: 로컬 영상 데이터베이스 접근 차단');},deleteDatabase:function(){throw new Error('읽기 전용 검사: 로컬 영상 데이터베이스 삭제 차단');},databases:function(){return Promise.resolve([]);}}});
  var nativeGet=originalStorage.getItem.bind(originalStorage),nativeSet=originalStorage.setItem.bind(originalStorage),nativeRemove=originalStorage.removeItem.bind(originalStorage);
  function isAuthKey(key){return String(key).indexOf('dmj_sb_auth')===0;}
  function currentOwner(){return g.DMJAuth&&typeof g.DMJAuth.currentUserId==='function'?g.DMJAuth.currentUserId():null;}
  function keys(){return Array.from(memory.keys());}
  function updateBanner(){
    if(!banner)return;
    var logged=!!currentOwner(),last=Array.from(reports.values()).slice(-1)[0];
    banner.textContent='읽기 전용 확인 · 기록은 브라우저 메모리에서만 열립니다 · 기존 로컬 노트·영상은 읽지 않습니다 · 지도 타일 요청 차단'+(logged?'':' · 로그인 대기')+(cloudCount==null?'':' · 계정 목록 '+cloudCount+'건');
    if(last){banner.textContent+=' · '+last.format+' 원문 '+(last.samples==null?'표본 수 미확인':last.samples+'표본')+' · UTC 중복 '+last.duplicateUtc+'건';if(last.conflictingUtc)banner.textContent+='(상이값 후보 '+last.conflictingUtc+'건)';banner.textContent+=' · 원문 채널 '+(Object.keys(last.channels).join(', ')||'없음/미확인')+' · 센서 부착·보정 미검증';}
  }
  function summarize(text){
    var result={format:'unknown',samples:null,timedSamples:0,duplicateUtc:0,conflictingUtc:0,nonIncreasingUtc:0,gapsOver4Sec:0,channels:{},validStructure:false};
    if(typeof text!=='string'||text.length>32*1024*1024)return result;
    var rows=[],times=[],signatures=[],seen=new Map();
    function channel(name,value){if(value!==null&&value!==''&&Number.isFinite(Number(value)))result.channels[name]=(result.channels[name]||0)+1;}
    if(/^RDTRK[12]\|/.test(text)&&g.RDStorage&&g.RDStorage.decodeTrack){
      result.format=text.slice(0,6);var points=g.RDStorage.decodeTrack(text);if(!points)return result;
      rows=points;points.forEach(function(p){times.push(points.hasTime===false?NaN:p.t*1000);signatures.push(JSON.stringify(p));Object.keys(p).forEach(function(k){if(k!=='lat'&&k!=='lng'&&k!=='t'&&k.indexOf('__')!==0)channel(k,p[k]);});});
      result.channels.latitude=points.filter(function(p){return Number.isFinite(p.lat);}).length;result.channels.longitude=points.filter(function(p){return Number.isFinite(p.lng);}).length;
      result.validStructure=points.length>=2;
    }else if(/^\s*<\??/.test(text)){
      result.format='GPX';var doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)return result;
      rows=Array.from(doc.getElementsByTagNameNS('*','trkpt'));if(!rows.length)rows=Array.from(doc.getElementsByTagNameNS('*','rtept'));
      rows.forEach(function(p){
        channel('latitude',p.getAttribute('lat'));channel('longitude',p.getAttribute('lon'));
        var t=p.getElementsByTagNameNS('*','time')[0],fields=[];times.push(t?Date.parse(t.textContent):NaN);
        Array.from(p.getElementsByTagName('*')).forEach(function(el){if(el.children.length)return;var name=el.localName,value=el.textContent.trim();if(name!=='time'){channel(name,value);fields.push([name,value]);}});
        fields.sort(function(a,b){return a[0].localeCompare(b[0]);});signatures.push(JSON.stringify([p.getAttribute('lat'),p.getAttribute('lon'),fields]));
      });result.validStructure=rows.length>=2;
    }else if(text.indexOf('RDFUSED1|')===0){result.format='RDFUSED1';return result;}
    else return result;
    result.samples=rows.length;var previous=null;
    times.forEach(function(t,i){if(!Number.isFinite(t))return;result.timedSamples++;if(seen.has(t)){result.duplicateUtc++;if(seen.get(t)!==signatures[i])result.conflictingUtc++;}else seen.set(t,signatures[i]);if(previous!=null){if(t<=previous)result.nonIncreasingUtc++;if(t-previous>4000)result.gapsOver4Sec++;}previous=t;});
    return result;
  }
  var facade={
    getItem:function(key){key=String(key);return isAuthKey(key)?nativeGet(key):(memory.has(key)?memory.get(key):null);},
    setItem:function(key,value){key=String(key);value=String(value);if(isAuthKey(key)){nativeSet(key,value);return;}memory.set(key,value);if(key.indexOf('_track_v1_')!==-1){reports.set(key,summarize(value));updateBanner();}},
    removeItem:function(key){key=String(key);if(isAuthKey(key))nativeRemove(key);else{memory.delete(key);reports.delete(key);}},
    clear:function(){memory.clear();reports.clear();updateBanner();},
    key:function(i){return keys()[i]||null;}
  };
  Object.defineProperty(facade,'length',{get:function(){return keys().length;}});
  Object.defineProperty(g,'localStorage',{configurable:true,value:facade});
  g.fetch=function(input,options){
    var url=new URL(typeof input==='string'?input:input.url,g.location.href),method=String(options&&options.method||input&&input.method||'GET').toUpperCase();
    if(method!=='GET'&&method!=='HEAD'&&url.pathname.indexOf('/auth/v1/')!==0)return Promise.reject(new Error('읽기 전용 검사: 수정 요청을 차단했습니다'));
    return originalFetch(input,options);
  };
  api.summarize=summarize;
  api.summary=function(){return {enabled:true,cloudRecordCount:cloudCount,payloadsRead:reports.size,lastBodyReport:Array.from(reports.values()).slice(-1)[0]||null};};
  g.addEventListener('dmj-auth-change',function(){var next=currentOwner();if(next!==owner){owner=next;memory.clear();reports.clear();cloudCount=null;}updateBanner();});
  g.addEventListener('pagehide',function(){memory.clear();reports.clear();cloudCount=null;});
  g.addEventListener('rd:cloud-synced',function(e){cloudCount=e.detail&&e.detail.count;updateBanner();});
  document.addEventListener('DOMContentLoaded',function(){
    // Opening a missing video database can itself create a persistent database.
    if(g.RDStorage){g.RDStorage.loadVideoBlobs=function(){return Promise.resolve([]);};['saveVideoBlob','removeVideoBlob','clearVideoBlobs'].forEach(function(key){if(typeof g.RDStorage[key]==='function')g.RDStorage[key]=function(){return Promise.reject(new Error('읽기 전용 검사에서는 영상 파일을 변경하지 않습니다'));};});}
    owner=currentOwner();banner=document.createElement('p');banner.id='rd-review-banner';banner.setAttribute('role','status');banner.style.cssText='position:relative;z-index:1200;margin:0;padding:10px 16px;background:#172b35;color:#e8f1f4;font-size:13px;line-height:1.5';document.body.insertBefore(banner,document.body.firstChild);updateBanner();
    document.addEventListener('click',function(e){var button=e.target.closest('button,a');if(!button)return;var text=[button.textContent,button.getAttribute('aria-label'),button.getAttribute('title')].join(' ');if(button.matches('[download],#btn-pdf,#btn-export-csv,#btn-export-gpx')||/저장|삭제|백업|내보내기|Save session|Delete|Backup|Export|Save note|Save segment/i.test(text)){e.preventDefault();e.stopImmediatePropagation();var message='읽기 전용 확인 중입니다. 기록 저장·삭제·백업·내보내기는 차단합니다.';banner.textContent=message;var status=document.querySelector('[data-replay-local-status]');if(status)status.textContent=message;}},true);
  });
})(window);
