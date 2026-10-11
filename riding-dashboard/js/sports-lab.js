/* Presentation only. Existing tabs, calculations, forms and save handlers remain authoritative. */
(function(){
 'use strict';
 var pages = {
  'purpose-results':['00','SESSION OVERVIEW','라이딩 요약','이번 기록의 주행 특성과 분석 가능한 항목을 한눈에 확인합니다.'],
  'tab-env':['01','SESSION CONDITIONS','라이딩 조건','바람·장비·분석 구간을 확인합니다. 모든 비교의 기준이 되는 입력입니다.'],
  'tab-perf':['02','PERFORMANCE','퍼포먼스','지속시간별 속도, 바람 상대 성능과 시간 분포를 함께 살펴봅니다.'],
  'tab-track':['03','SPATIAL ANALYSIS','주행 경로','이동 경로와 구간별 변화를 지도에서 확인합니다.'],
  'tab-turns':['04','MANEUVER ANALYSIS','회전 분석','택과 자이브의 진입, 속도 손실, 회복 과정을 비교합니다.'],
  'tab-attitude':['05','BOARD ATTITUDE','장비 기울기','기록된 센서로 힐·피치와 주행 성능의 관계를 확인합니다.'],
  'tab-coach':['06','TRAINING INSIGHTS','코칭','이번 기록에서 확인된 특징을 다음 연습의 관찰 항목으로 연결합니다.'],
  'tab-phys':['07','PHYSIOLOGY','신체·운동 지표','기록된 심박과 운동 지표를 주행 강도와 함께 읽습니다.'],
  'tab-sessions':['08','SESSION LIBRARY','라이딩 기록','저장된 기록을 불러오고 같은 기준으로 비교합니다.'],
  'tab-training':['09','TRAINING LOAD','훈련 부하','기간별 운동량과 회복 관련 기록의 흐름을 살펴봅니다.']
 };
 function heading(id){
  var node=document.getElementById(id),p=pages[id];
  if(!node || node.querySelector(':scope > .sl-section-heading')) return;
  var h=document.createElement('header');h.className='sl-section-heading';
  var info=document.createElement('div'),k=document.createElement('span'),title=document.createElement('h2'),desc=document.createElement('p'),n=document.createElement('span');
  k.className='sl-section-kicker';k.textContent=p[1];title.textContent=p[2];title.id='sl-heading-'+id;desc.textContent=p[3];
  n.className='sl-section-index';n.textContent=p[0];n.setAttribute('aria-hidden','true');
  info.append(k,title,desc);h.append(info,n);node.prepend(h);
  if(id!=='purpose-results')node.setAttribute('aria-labelledby',title.id);
 }
 function panelIndex(id){
  if(id==='purpose-results')return;
  var page=document.getElementById(id);if(!page)return;
  var titles=Array.from(page.querySelectorAll('.card-title')).filter(function(t){return t.textContent.trim();});
  var tools=page.querySelector(':scope > .sl-page-tools');
  if(titles.length<4){if(tools)tools.remove();return;}
  var signature=titles.map(function(t){return t.textContent.trim();}).join('|');
  if(tools&&tools.dataset.signature===signature)return;
  if(tools)tools.remove();tools=document.createElement('div');tools.className='sl-page-tools';tools.dataset.signature=signature;
  var label=document.createElement('label'),select=document.createElement('select'),count=document.createElement('span');
  label.textContent='분석 항목';select.id='sl-jump-'+id;label.htmlFor=select.id;select.className='form-select';
  var first=document.createElement('option');first.value='';first.textContent='확인할 항목으로 이동';select.append(first);
  titles.forEach(function(t,i){var opt=document.createElement('option');opt.value=String(i);opt.textContent=t.textContent.trim();select.append(opt);});
  count.textContent=titles.length+'개 분석 패널';
  select.addEventListener('change',function(){if(select.value==='')return;var currentTitles=Array.from(page.querySelectorAll('.card-title')).filter(function(t){return t.textContent.trim();});var title=currentTitles[Number(select.value)];if(title){title.tabIndex=-1;title.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});title.focus({preventScroll:true});}});
  tools.append(label,select,count);page.querySelector('.sl-section-heading').after(tools);
 }
 function alignConditionFields(){
  var ids=['in-purpose','in-weight','in-wing','in-skill','in-windspeed'];
  var hints=['이번 기록에서 중점적으로 볼 항목','장비를 제외한 라이더 체중','장비에서 선택한 윙 크기','참고 점수의 비교 기준','라이딩 당시의 평균 풍속'];
  ids.forEach(function(id,i){
   var input=document.getElementById(id);if(!input)return;
   var field=input.parentNode;field.classList.add('sl-condition-field');
   field.parentNode.classList.add('sl-condition-grid');
   var label=field.querySelector('label');if(label)label.htmlFor=id;
   var help=field.querySelector('.sl-field-help');
   if(!help){help=document.createElement('small');help.className='sl-field-help';help.id='sl-help-'+id;field.append(help);}
   help.textContent=id==='in-wing'&&!input.readOnly?'사용한 윙 크기를 직접 입력':hints[i];
   var described=(input.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);
   if(described.indexOf(help.id)<0)described.push(help.id);input.setAttribute('aria-describedby',described.join(' '));
  });
  var action=document.getElementById('btn-rider');if(action)action.parentNode.classList.add('sl-condition-action');
 }
 function decorate(){
  alignConditionFields();
  Object.keys(pages).forEach(heading);
  Object.keys(pages).forEach(panelIndex);
  var nav=document.querySelector('#rd-domain-card .nav-tabs');if(!nav)return;
  nav.setAttribute('aria-label','라이딩 분석 영역');
  Array.from(nav.querySelectorAll('.nav-link')).forEach(function(link){
   var id=link.id==='rd-summary-tab'?'purpose-results':(link.getAttribute('href')||'').replace('#',''),p=pages[id];
   if(p)link.dataset.sectionNumber=p[0];
   if(id==='tab-coach'||id==='tab-sessions')link.parentNode.classList.add('sl-nav-break');
  });
  var parent=nav.parentNode;
  if(!parent.querySelector('.sl-mobile-nav')){
   var mobile=document.createElement('div');mobile.className='sl-mobile-nav';
   var lbl=document.createElement('label'),sel=document.createElement('select');lbl.textContent='분석 화면';lbl.htmlFor='sl-mobile-section';sel.id='sl-mobile-section';sel.className='form-select';
   Array.from(nav.querySelectorAll('.nav-link')).forEach(function(link){var id=link.id==='rd-summary-tab'?'purpose-results':(link.getAttribute('href')||'').replace('#','');if(!pages[id])return;var opt=document.createElement('option');opt.value=id;opt.textContent=pages[id][2];sel.append(opt);});
   sel.addEventListener('change',function(){var link=sel.value==='purpose-results'?document.getElementById('rd-summary-tab'):nav.querySelector('a[href="#'+sel.value+'"]');if(link)link.click();});
   mobile.append(lbl,sel);parent.prepend(mobile);
   function sync(){var active=nav.querySelector('.nav-link.active');if(active)sel.value=active.id==='rd-summary-tab'?'purpose-results':(active.getAttribute('href')||'').replace('#','');}
   new MutationObserver(sync).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});sync();
  }
  if(!parent.querySelector('.sl-nav-title')){var label=document.createElement('div');label.className='sl-nav-title';label.textContent='분석 탐색';parent.prepend(label);}
 }
 function init(){
  decorate();
  var wing=document.getElementById('in-wing');
  if(wing)new MutationObserver(alignConditionFields).observe(wing,{attributes:true,attributeFilter:['readonly']});
  var tabs=document.querySelector('#rd-domain-card .nav-tabs');
  if(tabs)tabs.addEventListener('click',function(){requestAnimationFrame(function(){window.dispatchEvent(new Event('resize'));});});
  document.addEventListener('rd:rendered',function(){requestAnimationFrame(decorate);});
  // Summary content is replaced by the existing renderer after conditions change.
  var summary=document.getElementById('purpose-results');
  if(summary)new MutationObserver(function(){heading('purpose-results');}).observe(summary,{childList:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
