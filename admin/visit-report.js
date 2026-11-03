(function(){'use strict';
const host=document.createElement('section');host.id='visit-report';document.getElementById('dashboard').append(host);let generation=0;
const text=(tag,s)=>{const e=document.createElement(tag);e.textContent=s;return e};
function reset(){generation++;host.replaceChildren(text('h3','최근 2주 방문 분석'),text('p','관리자 연결 후 표시합니다.'))}reset();
window.addEventListener('dmj-ops-unavailable',reset);
window.addEventListener('dmj-auth-change',e=>{if(e.detail?.accountChanged!==false||e.detail?.event==='SIGNED_OUT')reset()});
window.addEventListener('dmj-ops-data',async e=>{
 const run=++generation;try{
  const end=new Date(Math.floor((Date.now()+9*3600000)/86400000)*86400000-9*3600000),start=new Date(+end-14*86400000),previous=new Date(+start-14*86400000);let rows=[];
  for(let n=0;n<20000;n+=500){const r=await e.detail.client.from('ops_visits').select('id,session_id,page,event,context,created_at').gte('created_at',previous.toISOString()).lt('created_at',end.toISOString()).order('created_at').order('id').range(n,n+499);if(r.error)throw Error('방문 기록 조회 실패');rows.push(...r.data);if(r.data.length<500)break;if(n===19500)throw Error('전체 집계 한도 초과')}
  if(run!==generation)return;
  rows=rows.filter(r=>r.context?.is_test!==true);const current=rows.filter(r=>r.created_at>=start.toISOString()),prior=rows.filter(r=>r.created_at<start.toISOString());
  const date=d=>d.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}),summary=r=>[r.filter(x=>x.event==='view').length,new Set(r.filter(x=>x.event==='view').map(x=>x.session_id)).size,r.filter(x=>x.event==='inquiry_click').length];
  host.replaceChildren(text('h3','최근 2주 방문 분석'),text('p',date(start)+' ~ '+date(new Date(+end-1))+' · 한국시간 완료된 날짜 기준'));
  const table=document.createElement('table');const h=document.createElement('tr');for(const v of ['지표','최근 14일','직전 14일','증감'])h.append(text('th',v));table.append(h);const a=summary(current),b=summary(prior);
  ['동의 후 페이지 조회','조회가 기록된 탭 세션','상담 링크 클릭'].forEach((label,i)=>{const row=document.createElement('tr');for(const v of [label,a[i],b[i],(a[i]-b[i]>0?'+':'')+(a[i]-b[i])])row.append(text('td',String(v)));table.append(row)});host.append(table);
  host.append(text('p','사람 수·순방문자 수가 아닙니다. 상담 클릭은 문의 완료·구매가 아닙니다. 30초 이벤트는 30초 후 화면 표시 여부입니다. 아울렛 및 유입·기기 항목은 2026-11-03 보완 배포 이후 신규 동의 기록부터 수집합니다. 과거 누락은 0 또는 복원 자료로 해석하지 마세요. 기간별 측정 범위 차이로 증감을 성장률로 단정할 수 없습니다.'));
  const views=current.filter(r=>r.event==='view'),known=views.filter(r=>r.context?.version===2);host.append(text('p','유입·기기 분류 수집: '+known.length+'건 / 항목 미수집: '+(views.length-known.length)+'건'));
  for(const [key,label] of [['page','페이지'],['source_group','유입 분류'],['device_type','기기 종류'],['utm_campaign','승인 캠페인']]){const counts=new Map();for(const r of key==='page'?views:known){const value=key==='page'?r.page:r.context[key]||'미지정';counts.set(value,(counts.get(value)||0)+1)}host.append(text('h4',label));host.append(text('p',counts.size?[...counts].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,n])=>k+': '+n+'회').join(' · '):'신규 수집 기록 없음'))}
 }catch(err){if(run===generation)host.replaceChildren(text('h3','최근 2주 방문 분석'),text('p',err.message+' · 수치를 표시하지 않습니다.'))}
});
})();
