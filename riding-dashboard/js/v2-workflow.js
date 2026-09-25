/* Presentation workflow. Analysis and persistence remain in v2-app. */
(function(){'use strict';
const $=id=>document.getElementById(id);let identity=null,dirty=false,phase='conditions';
function tab(id){const a=document.querySelector('.nav-tabs a[href="#'+id+'"]');if(a)a.click();}
function summary(){const ids=['in-weight','in-wing','in-skill','in-windspeed'];const v=ids.map(id=>$(id)?.value||'미입력');return (document.getElementById('in-purpose')?.selectedOptions[0]?.textContent||'')+' · 체중 '+v[0]+' kg · 윙 '+v[1]+' m² · '+v[2]+' · 풍속 '+v[3]+' kt';}
function setPhase(next){phase=next;document.body.dataset.rdPhase=next;$('rd-flow-title').textContent=next==='conditions'?'라이딩 조건을 확인하세요':'라이딩 분석 결과';$('rd-flow-summary').textContent=summary();$('rd-analyze').hidden=next!=='conditions';$('rd-edit').hidden=next==='conditions';}
function detail(open){document.body.dataset.rdDetail=open?'open':'closed';document.querySelector('#rd-summary-tab')?.classList.toggle('active',!open);if(!open)document.querySelectorAll('#rd-domain-card .nav-link:not(#rd-summary-tab)').forEach(a=>a.classList.remove('active')); $('rd-show-details').hidden=open;$('rd-show-details').setAttribute('aria-expanded',String(open));$('rd-overview').hidden=!open;}
function markDirty(){dirty=true;$('rd-save-state').textContent='변경사항이 있습니다 · 분석 후 저장해 주세요';$('btn-save').textContent='변경사항 저장';$('btn-save').disabled=false;}
function tidyNotes(){
 document.querySelectorAll('#rd-domain-card .card-footer').forEach(node=>{
  if(node.querySelector('button,input,select,a,canvas,svg,details')||node.textContent.trim().length<160)return;
  const help=document.createElement('details');help.className='rd-method-note';const title=document.createElement('summary');title.textContent='지표 해석과 계산 기준';const body=document.createElement('div');while(node.firstChild)body.append(node.firstChild);help.append(title,body);node.append(help);
 });
}
function start(){
 document.addEventListener('rd:rendered',()=>requestAnimationFrame(tidyNotes));requestAnimationFrame(tidyNotes);

const nav=document.querySelector('#rd-domain-card .nav-tabs');const item=document.createElement('li');item.className='nav-item';const overview=document.createElement('button');overview.id='rd-summary-tab';overview.className='nav-link';overview.type='button';overview.textContent='요약';overview.addEventListener('click',()=>{setPhase('results');detail(false);});item.append(overview);nav.prepend(item);const content=document.querySelector('#rd-domain-card > .card-body');content.before($('purpose-results'));
setPhase('results');detail(false);
$('rd-mobile-replay').addEventListener('click',()=>{$('btn-replay').click();});
$('rd-mobile-save').addEventListener('click',()=>{if(!$('btn-save').disabled)$('btn-save').click();});
new MutationObserver(()=>{$('rd-mobile-save').disabled=$('btn-save').disabled;$('rd-mobile-save').textContent=$('btn-save').textContent;}).observe($('btn-save'),{attributes:true,childList:true,subtree:true,characterData:true});
$('rd-show-details').addEventListener('click',()=>{detail(true);const purpose=$('in-purpose').value;tab(window.RDPurposeView.definitions[purpose]?.target||'tab-perf');$('rd-domain-card').scrollIntoView({block:'start',behavior:'smooth'});});
$('rd-overview').addEventListener('click',()=>{detail(false);setPhase('results');$('purpose-results').scrollIntoView({block:'start',behavior:'smooth'});});
document.addEventListener('rd:open-detail',e=>{detail(true);setPhase('results');tab(e.detail?.target||'tab-perf');$('rd-domain-card').scrollIntoView({block:'start',behavior:'smooth'});});
$('rd-upload-again').addEventListener('click',()=>{$('v2-file').click();});
// Keep uncommon actions available without competing with the primary flow.
const more=document.createElement('details');more.className='rd-more';const title=document.createElement('summary');title.textContent='내보내기 · 더 보기';more.append(title);
['btn-pdf','btn-export-csv','btn-export-gpx'].forEach(id=>{if($(id))more.append($(id));});
$('btn-save').after(more);
$('btn-save').textContent='분석·기록 저장';
$('rd-analyze').addEventListener('click',()=>{$('btn-rider').click();});
$('rd-edit').addEventListener('click',()=>{setPhase('conditions');detail(true);tab('tab-env');$('rider-input-card').scrollIntoView({block:'start',behavior:'smooth'});});
document.addEventListener('rd:analyzed',()=>{setPhase('results');detail(false);if(dirty)$('rd-save-state').textContent='분석에 반영했습니다 · 변경사항을 저장해 주세요';const heading=$('purpose-results').querySelector('h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}$('purpose-results').scrollIntoView({block:'start',behavior:'smooth'});});
document.addEventListener('rd:dirty',markDirty);
document.addEventListener('input',e=>{if(e.target.closest('#tab-env')&&!e.target.closest('#cond-body'))markDirty();});
document.addEventListener('change',e=>{if(e.target.closest('#tab-env')&&!e.target.closest('#cond-body'))markDirty();});
document.addEventListener('rd:save-state',e=>{const d=e.detail;$('rd-save-state').textContent=d.text;if(d.state==='saved'){dirty=false;$('btn-save').disabled=true;setPhase('results');detail(false);}else if(d.state==='error')$('btn-save').disabled=false;});
document.addEventListener('rd:rendered',e=>{const d=e.detail;if(identity!==d.identity){identity=d.identity;dirty=false;detail(false);setPhase('results');$('btn-save').disabled=false;$('btn-save').textContent='분석·기록 저장';$('rd-save-state').textContent=d.demo?'샘플 기록':d.saved?'저장된 기록을 불러왔습니다':'아직 저장하지 않았습니다';}else $('rd-flow-summary').textContent=summary();});
document.querySelectorAll('.nav-tabs a').forEach(a=>a.addEventListener('click',()=>{if(a.getAttribute('href')==='#tab-env'){setPhase('conditions');detail(true);}else {setPhase('results');detail(true);}}));
// Show unit input only for a custom wing; known wing area is derived.
$('in-wing').setAttribute('aria-label','윙 크기 (제곱미터)');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
