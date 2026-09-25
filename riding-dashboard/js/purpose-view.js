(function(){'use strict';
const definitions={
freeride:{label:'프리라이드',focus:'얼마나 오래, 편안하게 탔는지 확인하세요.',next:'거리·이동 시간·속도 기준 포일링 추정 시간을 먼저 확인하세요.',target:'tab-perf'},
race:{label:'레이스 · 시합',focus:'풍상·풍하 주행과 회전 손실을 함께 비교합니다.',next:'풍향을 확인한 뒤 양 택의 유효 속도와 회전 손실을 비교하세요. 부표·스타트 정보가 없으면 순위나 코스 완주 여부는 판정하지 않습니다.',target:'tab-track'},
wave:{label:'웨이브',focus:'주행 경로와 속도 변화를 중심으로 돌아봅니다.',next:'GPS만으로 파도의 질, 실제 서핑 횟수나 웨이브 실력을 판정할 수 없습니다. 리플레이와 현장 영상을 함께 확인하세요.',target:'tab-track'},
maneuver:{label:'태킹 · 자이빙 연습',focus:'진입 택별 속도 유지와 회복에 집중합니다.',next:'회전 횟수·속도 손실·회복 시간·속도 기준 추정 성공률을 비교하세요. 시작한 택을 기준으로 좌우를 구분합니다.',target:'tab-turns'},
slalom:{label:'슬라럼 연습',focus:'지속 속도와 자이빙 후 재가속을 확인합니다.',next:'자이빙 진입·최저·탈출 속도와 회복을 먼저 보세요. 부표가 지정된 기록에서만 구간·랩 비교가 의미 있습니다.',target:'tab-turns'},
speed:{label:'스피드 기록',focus:'순간 최고보다 일정 구간에서 유지한 속도를 봅니다.',next:'2초·10초·100m·500m·1해리 기록을 비교하세요. 알파 500은 회전이 포함된 별도 기록입니다.',target:'tab-perf'}
};
const status={'no-data':'기록 없음','wind-unavailable':'풍향 확인 필요','model-unavailable':'조건 입력 필요','insufficient':'표본 부족','incomplete-observation':'회복 관측 부족','provisional':'잠정 점수','eligible':'산출 가능'};
function e(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
function number(v,suffix){return typeof v==='number'&&Number.isFinite(v)?v.toFixed(1)+(suffix||''):'—';}
function scaled(v,f){return typeof v==='number'&&Number.isFinite(v)?v*f:NaN;}
let previewMap=null;
function render(a,vps,options){const host=document.getElementById('purpose-results');if(!host)return;if(previewMap){previewMap.remove();previewMap=null;}host.replaceChildren();const key=document.getElementById('in-purpose')?.value||'freeride',d=definitions[key]||definitions.freeride;
const card=e('section','rd-purpose-card');card.append(e('h3','',d.label));
const link=e('button','btn rd-purpose-detail','이 결과 자세히 보기');link.type='button';link.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('rd:open-detail',{detail:{target:d.target}})));card.append(link);host.append(card);
const score=window.RDPerformanceScore?.compute(a,vps,options);if(!score)return;
const strip=e('div','rd-purpose-metrics'),sum=a.summary||{};let metrics=[];
if(key==='freeride')metrics=[['거리',number(scaled(sum.totalDistanceM,1/1000),' km')],['이동 시간',number(scaled(sum.movingTimeSec,1/60),' 분')],['포일링 추정 시간',number(scaled(sum.activeTimeSec,1/60),' 분')]];
else if(key==='maneuver'||key==='slalom'){const turns=(a.maneuvers||[]).filter(m=>m.type==='gybe'||(key!=='slalom'&&m.type==='tack'));const losses=turns.filter(m=>Number.isFinite(m.lossPct));metrics=[['분석한 회전',turns.length+'회'],['속도 기준 추정 성공',turns.filter(m=>m.turnSuccess).length+'/'+turns.length+'회'],['평균 속도 손실',losses.length?number(losses.reduce((n,m)=>n+m.lossPct,0)/losses.length,'%'):'—']];}
else if(key==='speed')metrics=[['2초 최고 평균',number(scaled((a.peaks||[]).find(x=>x.windowSec===2)?.speedMs,1.94384),' kt')],['10초 최고 평균',number(scaled((a.peaks||[]).find(x=>x.windowSec===10)?.speedMs,1.94384),' kt')],['500m 최고 평균',number(scaled((a.distanceBests||[]).find(x=>x.distanceM===500)?.speedMs,1.94384),' kt')]];
else if(key==='race')metrics=[['풍상 VMG 상위 50%',number(a.wind?.vmgUpwindTop50Ms*1.94384,' kt')],['풍하 VMG 상위 50%',number(a.wind?.vmgDownwindTop50Ms*1.94384,' kt')],['회전 횟수',(a.maneuvers||[]).length+'회']];
else metrics=[['주행 거리',number(scaled(sum.totalDistanceM,1/1000),' km')],['이동 시간',number(scaled(sum.movingTimeSec,1/60),' 분')],['웨이브 판정','GPS로 판정 불가']];
metrics.forEach(([name,value])=>{const box=e('div');box.append(e('span','lab',name),e('strong','',value));strip.append(box);});card.insertBefore(strip,link);link.remove();
const coaching=e('details','rd-next-practice');coaching.open=true;coaching.append(e('summary','','다음 연습 보기'));
let suggestions=[];
if(!score.wind.usable)suggestions.push('풍향 확인이 먼저입니다. 당시 바람 방향을 확인한 뒤 좌우 택을 비교하세요.');
else {Object.entries(score.domains).forEach(([k,g])=>{if(!g.S.eligible||!g.P.eligible)return;const gap=Math.abs(g.S.score-g.P.score);if(gap<8)return;const side=g.S.score<g.P.score?'스타보드':'포트',label={upwind:'풍상 주행',downwind:'풍하 주행',tack:'태킹',gybe:'자이빙'}[k];suggestions.push({gap,text:side+' '+label+' 참고 점수가 반대쪽보다 '+gap+'점 낮습니다. '+((k==='tack'||k==='gybe')?'비슷한 진입 속도에서 '+side+' 진입 회전을 반복하고 속도 유지와 회복 시간을 비교하세요.':'비슷한 풍속과 장비로 양쪽 택을 번갈아 타며 속도와 진행 각도를 비교하세요.')});});suggestions.sort((a,b)=>b.gap-a.gap);suggestions=suggestions.slice(0,1).map(x=>x.text);}
if(!suggestions.length)suggestions.push('양쪽 택의 기록을 더 모아 주세요. 지금은 특정 택을 약점으로 판단할 표본이 부족합니다.');suggestions.forEach(t=>coaching.append(e('p','',t)));const rationale=e('details','rd-coaching-detail');rationale.append(e('summary','','분석 기준'),e('p','',d.next),e('p','','이 기록 안의 비교이며 전국 순위나 다른 회원의 수준을 의미하지 않습니다.'));coaching.append(rationale);card.append(coaching);
const nationwide=e('a','rd-national-link','전국 현황 · 비슷한 참여자 비교 →');nationwide.href='../spots.html';rationale.append(nationwide);

const track=e('div','rd-summary-map');track.setAttribute('aria-label','이번 라이딩 주행 지도');card.insertBefore(track,strip);
const samples=(options?.session?.samples||[]);const valid=samples.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng));
if(window.L&&valid.length>1){
 previewMap=L.map(track,{zoomControl:false,scrollWheelZoom:false,attributionControl:true,preferCanvas:true});
 track.classList.add('rd-analysis-map');
 let base=null,satellite=true;
 const setBase=()=>{if(base)previewMap.removeLayer(base);track.classList.toggle('rd-satellite-map',satellite);base=L.tileLayer(satellite?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,maxNativeZoom:satellite?18:19,attribution:satellite?'Imagery © Esri, Maxar, Earthstar Geographics':'© OpenStreetMap'}).addTo(previewMap);};setBase();
 const legStarts=new Set((options?.session?.legs||[]).map(l=>l.start));
 const maxSpeed=(sum.maxSpeedMs>0?sum.maxSpeedMs:valid.reduce((m,p)=>Math.max(m,Number.isFinite(p.speed)?p.speed:0),0));
 const ramp=f=>{f=Math.max(0,Math.min(1,f));const stops=[[231,76,60],[243,156,18],[46,204,113]],k=f<.5?0:1,t=(f-k*.5)*2;return 'rgb('+stops[k].map((v,j)=>Math.round(v+(stops[k+1][j]-v)*t)).join(',')+')';};
 samples.forEach((p,i)=>{const prev=samples[i-1];if(!prev||legStarts.has(i)||![p.lat,p.lng,prev.lat,prev.lng,p.speed].every(Number.isFinite)||p.t<=prev.t||p.t-prev.t>4||(p.legId!=null&&prev.legId!=null&&p.legId!==prev.legId))return;L.polyline([[prev.lat,prev.lng],[p.lat,p.lng]],{color:ramp(maxSpeed?p.speed/maxSpeed:0),weight:2.5,opacity:.95}).addTo(previewMap);});
 const fit=()=>previewMap.fitBounds(valid.map(p=>[p.lat,p.lng]),{padding:[42,42],maxZoom:15});fit();
 const controls=L.control({position:'topright'});controls.onAdd=()=>{const bar=e('div','rd-map-tools');L.DomEvent.disableClickPropagation(bar);L.DomEvent.disableScrollPropagation(bar);const toggle=e('button','','분석 지도'),reset=e('button','','전체 경로');toggle.type=reset.type='button';toggle.onclick=()=>{satellite=!satellite;setBase();toggle.textContent=satellite?'분석 지도':'위성 지도';toggle.setAttribute('aria-pressed',String(satellite));};reset.onclick=fit;bar.append(toggle,reset);return bar;};controls.addTo(previewMap);
 L.control.scale({position:'bottomright',imperial:false}).addTo(previewMap);
 const north=L.control({position:'topleft'});north.onAdd=()=>e('div','rd-map-north','↑ N');north.addTo(previewMap);
 const launch=L.control({position:'bottomright'});launch.onAdd=()=>{const b=e('button','rd-map-launch','▶ 라이딩 재생');b.type='button';L.DomEvent.disableClickPropagation(b);b.onclick=()=>document.getElementById('btn-replay')?.click();return b;};launch.addTo(previewMap);
 [valid[0],valid[valid.length-1]].forEach((p,i)=>L.circleMarker([p.lat,p.lng],{radius:5,color:'#fff',weight:2,fillColor:i?'#202622':'#dce65a',fillOpacity:1}).bindTooltip(i?'도착':'출발').addTo(previewMap));
 const legend=L.control({position:'bottomleft'});legend.onAdd=()=>{const box=e('div','rd-map-speed');box.append(e('span','','0'),e('i'),e('span','',(maxSpeed*1.94384).toFixed(1)+' kt'));box.setAttribute('aria-label','속도: 빨강 느림, 주황 중간, 초록 빠름');return box;};legend.addTo(previewMap);

 requestAnimationFrame(()=>{if(previewMap)previewMap.invalidateSize();});
}else track.textContent='주행 위치 정보 없음';
if(!score.wind.usable){const flag=e('button','rd-wind-flag','풍향 확인 필요');flag.type='button';flag.onclick=()=>document.getElementById('rd-edit').click();card.insertBefore(flag,track);}
const section=e('details','rd-score-panel');section.open=true;section.append(e('summary','','점수와 좌우 택 비교'));
const head=e('div','rd-score-heading');head.append(e('h3','','전체 점수 '+(score.total.score==null?'—':score.total.score+' / 100')),e('p','',score.total.score==null?'점수 산출 조건을 충족한 항목 '+score.total.eligibleCells+'/8 · 부족한 항목을 0점으로 계산하지 않습니다.':'풍상 35% · 풍하 35% · 태킹 15% · 자이빙 15%'));section.append(head);
section.append(e('p','rd-score-caution','검토용 참고 점수입니다. 목적에 따라 강조하는 지표가 달라지며, 동일 점수의 산식은 바꾸지 않습니다. 풍향의 신뢰도가 낮으면 택별 점수를 보류합니다.'));
const wrap=e('div','rd-score-table-wrap'),table=e('table','rd-score-table');const h=e('thead'),r=e('tr');['항목','종합','스타보드 택','포트 택'].forEach(t=>r.append(e('th','',t)));h.append(r);table.append(h);const body=e('tbody');
Object.entries({upwind:'풍상',downwind:'풍하',tack:'태킹',gybe:'자이빙'}).forEach(([k,label])=>{const domain=score.domains[k],row=e('tr');row.append(e('th','',label),e('td','rd-domain-total',domain.score==null?'—':domain.score));['S','P'].forEach(side=>{const c=domain[side],td=e('td');td.append(e('strong','rd-cell-score',c.score==null?'—':c.score),e('span','rd-cell-status',status[c.status]||c.status));if(k==='tack'||k==='gybe'){td.append(e('small','','진입 '+c.count+'회 · 추정 성공 '+c.metrics.successCount+'/'+c.count),e('small','','평균 손실 '+number(c.metrics.lossPct,'%')+' · 회복 '+number(c.metrics.recoverySec,'초')));}else{td.append(e('small','',Math.round(c.seconds)+'초 관측'),e('small','',(k==='upwind'?'풍상 VMG ':'주행 속도 ')+number(c.metrics.measuredKt,' kt')));}row.append(td);});body.append(row);});table.append(body);wrap.append(table);section.append(wrap);
const details=e('details','rd-score-method');details.append(e('summary','','점수 계산과 해석 기준'));details.append(e('p','','풍상·풍하 각 택은 60초 이상, 회전은 각 진입 택별 5회 이상 완전한 관측이 필요합니다. 회전 3~4회는 잠정 점수입니다. 이는 검토용 기준이며 통계적 신뢰도를 보장하지 않습니다.'));
score.notes.forEach(n=>details.append(e('p','',n)));details.append(e('p','','스타보드 택은 바람을 오른쪽에서, 포트 택은 왼쪽에서 받는 주행입니다. 태킹·자이빙은 회전 전 진입 택으로 구분합니다. 풍하 점수는 기존 속도 모델의 참고값이며 풍하 VMG 실력 등급이 아닙니다.'));section.append(details);host.append(section);
}
window.RDPurposeView={render,definitions};
})();
