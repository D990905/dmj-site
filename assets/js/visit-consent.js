(async function(){'use strict';
if(window.__dmjVisitConsent)return;window.__dmjVisitConsent=true;
const src=document.currentScript.src,root=new URL('../../',src),version='analytics-2026-11-03';let config;
try{const r=await fetch(new URL('data/operations-config.json',root),{cache:'no-store'});if(!r.ok)return;config=await r.json()}catch{return}
if(!config.visitorAnalyticsEnabled||!config.visitEndpoint)return;
const key='dmj_analytics_consent_v1';let started=false,viewed=false,consent=null,timer,session,clickAt=0,admin=false;
const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const valid=c=>c?.allow===true&&c.version===version&&Number.isFinite(c.date)&&c.date<=Date.now()&&Date.now()-c.date<=90*86400000;
consent=read();
function excluded(){return !['dmjgroup.kr','www.dmjgroup.kr'].includes(location.hostname)||/\/(admin|profile|login|signup|auth|account|cart|quote|consult|membership|skill-assessment)(?:[/.]|$)/i.test(location.pathname)||new URLSearchParams(location.search).get('dmj_analytics_test')==='1'||navigator.webdriver||admin}
// Check the existing admin RPC only for signed-in members; no identity is sent to analytics.
async function checkAdmin(){try{if(!window.DMJAuth)return;await DMJAuth._ensureClient();const c=DMJAuth._supabase(),s=await c.auth.getSession();if(s.data?.session){const r=await c.rpc('is_ops_admin');admin=r.error?true:r.data===true}}catch{admin=true}}
const bar=document.createElement('aside');bar.className='dmj-consent';bar.setAttribute('aria-label','방문 분석 선택');
const text=document.createElement('p');text.textContent='사이트 개선을 위해 본 페이지, 탭 세션, 30초 후 화면 표시, 상담 링크 클릭과 유입 분류·승인된 UTM 캠페인·기기 종류를 동의 후 90일간 분석합니다. 이름·연락처·전체 URL·정확한 위치·기기 지문은 수집하지 않습니다. 거부해도 상품 조회와 상담을 이용할 수 있습니다.';bar.append(text);
const notice=document.createElement('a');notice.href=new URL('policy/privacy.html#visitor-analytics',root).href;notice.textContent='방문 분석 상세 안내';notice.style.display='block';notice.style.marginBottom='12px';bar.append(notice);
function stop(){viewed=false;clearTimeout(timer);try{sessionStorage.removeItem('dmj_visit_session')}catch{}session=null}
function choice(label,value){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{consent={allow:value,date:Date.now(),version};try{localStorage.setItem(key,JSON.stringify(consent))}catch{}bar.remove();if(value)start();else stop()};bar.append(b)}
choice('동의',true);choice('동의하지 않음',false);
const settings=document.createElement('button');settings.type='button';settings.className='dmj-privacy-settings';settings.textContent='방문 분석 설정';settings.onclick=()=>document.body.append(bar);document.body.append(settings);
window.addEventListener('storage',e=>{if(e.key===key){consent=read();if(!valid(consent))stop();else start()}});
if(!valid(consent)){if(consent?.allow!==false||consent?.version!==version)document.body.append(bar)}else start();
function context(){
 const params=new URLSearchParams(location.search),allow=config.analyticsUtmAllowlist||{},out={};
 for(const k of ['source','medium','campaign']){const v=(params.get('utm_'+k)||'').toLowerCase();out['utm_'+k]=v?(allow[k]?.includes(v)?v:'other'):null}
 let ref='direct';try{if(document.referrer){const h=new URL(document.referrer).hostname;if(h===location.hostname)ref='internal';else if(/(^|\.)(google\.[a-z.]+|naver\.com|bing\.com|daum\.net)$/.test(h))ref='search';else if(/(^|\.)(instagram\.com|facebook\.com|youtube\.com|youtu\.be|band\.us|kakao\.com|t\.co)$/.test(h))ref='social';else ref='referral'}}catch{ref='unknown'}
 const ua=navigator.userAgent||'';return {...out,source_group:ref,device_type:/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)?'tablet':/Mobile|iPhone|Android/i.test(ua)?'mobile':'desktop'};
}
async function send(event){if(!valid(consent)||excluded())return;await checkAdmin();if(!valid(consent)||excluded())return;
 if(!session){try{session=sessionStorage.getItem('dmj_visit_session');if(!session){session=crypto.randomUUID();sessionStorage.setItem('dmj_visit_session',session)}}catch{session=crypto.randomUUID()}}
 const page=location.pathname;if(!/^\/(?:[a-zA-Z0-9/_-]+\.html)?$/.test(page))return;
 fetch(config.visitEndpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':config.visitPublicKey},body:JSON.stringify({id:crypto.randomUUID(),session,page,event,consent:version,...context()}),keepalive:true}).catch(()=>{});
}
function start(){if(excluded())return;if(!viewed){viewed=true;send('view')}if(!started){started=true;document.addEventListener('click',e=>{if(e.target.closest('a[href*="inquiry.html"],a[href*="pf.kakao.com"]')&&Date.now()-clickAt>1000){clickAt=Date.now();send('inquiry_click')}})}clearTimeout(timer);timer=setTimeout(()=>{if(!document.hidden)send('engaged')},30000)}
})();
