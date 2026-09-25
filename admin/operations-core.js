(function(root){'use strict';
function alerts(data,now=Date.now()){
 const today=new Date(now).toISOString().slice(0,10),out=[];
 for(const r of data.inventory||[]){const available=r.on_hand-r.reserved;
 if(available<=r.reorder_point)out.push({priority:2,text:`재고 확인: ${r.sku} 판매 가능 ${available}개`});
 if(r.inbound>0&&r.eta&&r.eta<today)out.push({priority:1,text:`입고 지연: ${r.sku} · 예정 ${r.eta}`});}
 for(const r of data.orders||[])if(r.status==='awaiting_payment'&&r.payment_due_at){const due=Date.parse(r.payment_due_at);if(due<now)out.push({priority:1,text:`입금 확인 필요: ${r.id}`});else if(due<=now+86400000)out.push({priority:2,text:`24시간 안에 입금 확인 예정: ${r.id}`});}
 for(const r of data.inquiries||[])if(r.status==='new')out.push({priority:Date.parse(r.created_at)<now-86400000?1:2,text:`상담 응대 ${Date.parse(r.created_at)<now-86400000?'지연':'대기'}: ${r.product_id} · ${r.id}`});
 for(const r of (data.tasks||[]).slice().sort((a,b)=>(a.due_at||'9999').localeCompare(b.due_at||'9999')))if(r.status!=='done'){const due=Date.parse(r.due_at),soon=due>=now&&due<=now+172800000,label={todo:'예정',doing:'진행',blocked:'확인 필요'}[r.status]||r.status;if(r.status!=='blocked'&&!soon&&!(due<now))continue;out.push({priority:r.status==='blocked'||due<now?1:2,text:`${soon?'48시간 내 준비 · ':''}${r.title} · ${label}${r.blocker?' · '+r.blocker:''}`})}
 for(const r of data.campaigns||[])if(!['published','paused'].includes(r.status)&&r.planned_at&&Date.parse(r.planned_at)<=now+172800000)out.push({priority:Date.parse(r.planned_at)<now?1:2,text:`홍보 게시 준비: ${r.title} · ${r.channel} · ${new Date(r.planned_at).toLocaleDateString('ko-KR')}`});
 return out.sort((a,b)=>a.priority-b.priority);
}
function stockAfter(r,action,qty){if(!Number.isInteger(qty)||qty===0||action!=='adjust'&&qty<0)throw Error('Invalid quantity');const x={...r};if(action==='receive'){x.on_hand+=qty;x.inbound=Math.max(0,x.inbound-qty)}else if(action==='reserve')x.reserved+=qty;else if(action==='release')x.reserved-=qty;else if(action==='ship'){x.on_hand-=qty;x.reserved-=qty}else if(action==='adjust')x.on_hand+=qty;else throw Error('Invalid action');if(x.on_hand<0||x.reserved<0||x.reserved>x.on_hand)throw Error('Insufficient stock');return x}
const api={alerts,stockAfter};if(typeof module!=='undefined')module.exports=api;else root.DMJOps=api;
})(typeof window!=='undefined'?window:globalThis);
