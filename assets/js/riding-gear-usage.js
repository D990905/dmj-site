/* Derived from saved sessions only. Never modifies gear or riding records. */
(function(root){'use strict';
function summarize(records){
 var seen=new Set(),byGear=new Map(),confirmed=0,unconfirmed=0;
 (Array.isArray(records)?records:[]).forEach(function(r){
  if(!r||!r.id)return;
  var key=r.sig||r.id;if(seen.has(key))return;seen.add(key);
  var g=r.gear;if(!g||g.backfilled===true){unconfirmed++;return;}
  var used=false;
  [['handWing','handWingName','윙'],['frontWing','frontWingName','포일'],['board','boardName','보드']].forEach(function(fields){
   var id=g[fields[0]],name=g[fields[1]];
   if(!id||/_default$/.test(id)||!name||['Board','보드','Unknown'].includes(name))return;
   used=true;var k=fields[0]+':'+id;
   var row=byGear.get(k)||{id:String(id),category:fields[2],name:String(name),count:0,lastUsed:null};
   row.count++;if(Number.isFinite(r.dateEpoch)&&(!row.lastUsed||r.dateEpoch>row.lastUsed))row.lastUsed=r.dateEpoch;
   byGear.set(k,row);
  });
  if(used)confirmed++;else unconfirmed++;
 });
 return {confirmedSessions:confirmed,unconfirmedSessions:unconfirmed,gear:Array.from(byGear.values()).sort(function(a,b){return b.count-a.count||a.name.localeCompare(b.name);})};
}
if(typeof module!=='undefined'&&module.exports){module.exports={summarize:summarize};return;}
root.DMJGearUsage={summarize:summarize};
function render(){
 var host=document.getElementById('riding-gear-usage');if(!host)return;
 host.replaceChildren();var owner=root.DMJAuth&&root.DMJAuth.currentUserId();
 if(!owner)return;
 var records=[];try{records=JSON.parse(localStorage.getItem('rd_'+owner+'_sessions_v1')||'[]');}catch(e){}
 var data=summarize(records),caption=document.createElement('p');
 caption.textContent='장비 선택을 확인한 라이딩 '+data.confirmedSessions+'회';host.append(caption);
 if(data.gear.length){var list=document.createElement('ul');list.className='gear-use-list';data.gear.forEach(function(row){var item=document.createElement('li'),name=document.createElement('span'),count=document.createElement('strong');name.textContent=row.category+' · '+row.name;count.textContent=row.count+'회';item.append(name,count);list.append(item);});host.append(list);}
 var details=document.createElement('details'),summary=document.createElement('summary'),note=document.createElement('p');summary.textContent='집계 기준';note.textContent='라이딩에 직접 선택한 장비만 집계합니다. 장비 미선택 또는 나중에 일괄 지정한 '+data.unconfirmedSessions+'회는 제외했습니다. 같은 기록을 다시 가져와도 중복 계산하지 않습니다.';details.append(summary,note);host.append(details);
}
['rd:cloud-synced','dmj-auth-change','rd:sessions-changed','storage'].forEach(function(name){root.addEventListener(name,render);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})(typeof window!=='undefined'?window:globalThis);
