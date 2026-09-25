(async function(){'use strict';
const src=document.currentScript.src,root=new URL('../../',src);let config;
try{const r=await fetch(new URL('data/operations-config.json',root));if(!r.ok)return;config=await r.json()}catch{return}
if(!config.visitorAnalyticsEnabled||!config.visitEndpoint)return;
const key='dmj_analytics_consent_v1';let started=false,consent=null;try{consent=JSON.parse(localStorage.getItem(key)||'null')}catch{}
const bar=document.createElement('aside');bar.className='dmj-consent';bar.setAttribute('aria-label','방문 분석 선택');
const text=document.createElement('p');text.textContent='사이트 개선을 위해 방문 시각, 본 페이지, 30초 이상 조회 여부와 상담 버튼 클릭을 90일간 분석합니다. 이름·연락처·정확한 위치는 수집하지 않습니다. 동의하지 않아도 모든 구매 상담 기능을 이용할 수 있습니다.';
bar.append(text);function choice(label,value){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{consent={allow:value,date:Date.now()};try{localStorage.setItem(key,JSON.stringify(consent))}catch{}bar.remove();if(value)start()};bar.append(b)}
choice('동의',true);choice('동의하지 않음',false);
const settings=document.createElement('button');settings.type='button';settings.className='dmj-privacy-settings';settings.textContent='방문 분석 설정';settings.onclick=()=>document.body.append(bar);document.body.append(settings);
if(!consent||Date.now()-consent.date>90*86400000)document.body.append(bar);else if(consent.allow)start();
function start(){if(started)return;started=true;let session;try{session=sessionStorage.getItem('dmj_visit_session');if(!session){session=crypto.randomUUID();sessionStorage.setItem('dmj_visit_session',session)}}catch{session=crypto.randomUUID()}
 const send=event=>{if(!consent?.allow)return;const page=location.pathname;if(page.includes('/admin/')||page.includes('profile')||page.includes('login'))return;fetch(config.visitEndpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':config.visitPublicKey},body:JSON.stringify({id:crypto.randomUUID(),session,page,event,consent:'analytics-2026-09-24'}),keepalive:true}).catch(()=>{})};
 send('view');setTimeout(()=>{if(!document.hidden)send('engaged')},30000);document.addEventListener('click',e=>{if(e.target.closest('a[href*="inquiry.html"],a[href*="pf.kakao.com"]'))send('inquiry_click')});
}
})();
