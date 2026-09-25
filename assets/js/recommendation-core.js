(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DMJRecommend=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const levels={beginner:0,intermediate:1,advanced:2,pro:3};
 const labels={priority:{all:'가성비·퍼포먼스 비교',value:'가성비',performance:'퍼포먼스·프리미엄'},level:{beginner:'입문·초급',intermediate:'중급',advanced:'상급',pro:'선수'},purpose:{freeride:'편안한 라이딩·성장',wave:'웨이브',freestyle:'프리스타일·점프',parawing:'파라윙·다운윈드','race-wing':'윙 레이스'},environment:{flat:'잔잔한 수면',chop:'초피',wave:'파도',light:'약한 바람'},category:{all:'전체 셋업',wing:'윙',parawing:'파라윙',foil:'포일',board:'보드',accessory:'액세서리'}};
 function normalize(input){const out={};for(const k of Object.keys(labels))out[k]=Object.hasOwn(labels[k],input[k])?input[k]:Object.keys(labels[k])[0];const weight=Number(input.weight);if(Number.isFinite(weight)&&weight>=25&&weight<=180)out.weight=weight;return out}
 function recommend(products,input){const s=normalize(input),level=levels[s.level],race=s.purpose.startsWith('race-'),warnings=[];
 if(race&&level<2)warnings.push('레이스가 목표여도 현재 경험에 맞는 기본 셋업을 먼저 확인합니다. 레이스 전용 장비는 자동 추천에서 제외했습니다.');
 if(s.environment==='light')warnings.push('약풍에서는 체중·실제 풍속·보드 볼륨과 포일 크기를 함께 확인해야 합니다. 표시된 모델만으로 사이즈를 확정하지 않습니다.');
 if(s.purpose==='wave'&&s.environment!=='wave')warnings.push('웨이브 목적과 선택한 주 환경이 다릅니다. 실제 파도 조건을 상담에서 확인하세요.');
 const effectivePurpose=level===0&&s.purpose!=='parawing'?'freeride':s.purpose;
 if(level===0&&s.environment==='chop')warnings.push('초피 환경에서도 입문 보드는 Cruise를 우선 제안합니다. 연습 장소의 수면·풍속 적합성은 별도로 확인하세요.');
 const results=products.filter(p=>{
 if(s.category!=='all'&&p.category!==s.category)return false;
 if(s.priority!=='all'&&p.priority!==s.priority)return false;
 if(p.minLevel>level)return false;
 if(p.raceOnly&&(!race||level<2))return false;
 return (p.purposes||[]).includes(effectivePurpose);
 }).map(p=>{
 let rank=10,reasons=[p.headline||p.description];
 if(level===0&&p.id==='takoon-cruise'){rank=100;reasons.unshift('입문·초급 보드 우선 추천: 안정성과 첫 이륙 중심');}
 if(level===0&&p.id==='takoon-v4')rank=95;
 if(level===0&&p.id==='tkn-starter')rank=90;
 if(s.purpose==='parawing'&&p.id==='takoon-slide'){rank=90;reasons.unshift('본사가 파라윙을 우선 용도로 안내하는 보드');}
 if(s.purpose==='wave'&&['ppc-m1x','takoon-prosurf'].includes(p.id))rank=85;
 if(s.environment==='light'&&['takoon-ultra-glide','takoon-glide-midlength'].includes(p.id)){rank=level===0?50:85;reasons.push('글라이드와 이륙을 중시하는 보드 후보');}
 if(race&&p.brand==='levitaz')rank=p.category==='foil'?95:90;
 if(p.category==='accessory'){rank=0;reasons.push('사이즈·착용감·현재 장비와의 호환성을 확인하세요.');}
 const v=p.volumeGuidance?.[s.level];
 if(s.weight&&v)reasons.push('본사 볼륨 가이드: 약 '+(s.weight+v[0])+(v[1]!==v[0]?'–'+(s.weight+v[1]):'')+'L. 실제 생산 사이즈와 조건을 상담에서 확인하세요.');
 return {product:p,reasons,rank};
 }).sort((a,b)=>b.rank-a.rank);
 if(!results.length)warnings.push('이 조건에 맞는 검토된 후보가 없습니다. 조건을 바꾸거나 현재 조건 그대로 상담하세요.');
 return {selection:s,results,warnings};
 }
 function summary(input){const s=normalize(input);return Object.keys(labels).map(k=>labels[k][s[k]]).join(' · ')+(s.weight?' · '+s.weight+'kg':'')}
 return {recommend,normalize,summary,labels};
});
