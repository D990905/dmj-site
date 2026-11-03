// Custom publishable-key check for anonymous consented events; rate limiting is server-side.
const publicKey='sb_publishable_Xt5qEA_0Ar1HWWuecR4AAQ_9qxooFY1';
Deno.serve(async (req) => {
 const origin=req.headers.get('origin')||'';
 const allowed=['https://dmjgroup.kr','https://www.dmjgroup.kr','http://127.0.0.1:8765','http://localhost:8765'];
 const headers={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
 if(!allowed.includes(origin))return new Response('Forbidden',{status:403});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers});
 if(req.headers.get('apikey')!==publicKey)return new Response('Publishable key required',{status:401,headers});
 if(!req.headers.get('content-type')?.startsWith('application/json'))return new Response('JSON required',{status:415,headers});
 try{
  if(Number(req.headers.get('content-length')||0)>1500)return new Response('Too large',{status:413,headers});
  const reader=req.body?.getReader();if(!reader)throw Error('Body required');let length=0;const chunks=[];
  for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>1500){await reader.cancel();return new Response('Too large',{status:413,headers})}chunks.push(part.value)}
  const bytes=new Uint8Array(length);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}
  const d=JSON.parse(new TextDecoder().decode(bytes));
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(!['analytics-2026-09-24','analytics-2026-11-03'].includes(d.consent)||!uuid.test(d.id)||!uuid.test(d.session)||!['view','engaged','inquiry_click'].includes(d.event)||typeof d.page!=='string'||d.page.length>160||!/^\/(?:[a-zA-Z0-9/_-]+\.html)?$/.test(d.page)||/admin|profile|login|auth|account/i.test(d.page))return new Response('Invalid event',{status:400,headers});
  if(/bot|crawler|spider|headless|lighthouse|preview|facebookexternalhit/i.test(req.headers.get('user-agent')||''))return new Response(null,{status:204,headers});
  const v2=d.consent==='analytics-2026-11-03';
  const allowedTags={source:['google','naver','instagram','facebook','youtube','kakao','band','newsletter','dmj'],medium:['organic','social','cpc','email','referral','qr'],campaign:['supersonic','outlet','lisa','takoon','ppc','levitaz','wip']};
  const tag=k=>d['utm_'+k]?(allowedTags[k].includes(d['utm_'+k])?d['utm_'+k]:'other'):null;
  const context=v2?{version:2,source_group:['direct','internal','search','social','referral','unknown'].includes(d.source_group)?d.source_group:'unknown',device_type:['mobile','tablet','desktop'].includes(d.device_type)?d.device_type:'unknown',utm_source:tag('source'),utm_medium:tag('medium'),utm_campaign:tag('campaign'),is_test:origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:')}:null;
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),url=Deno.env.get('SUPABASE_URL');
  const secret=Deno.env.get('VISIT_HASH_SECRET')||serviceKey;if(!secret||!url)throw Error('Missing server configuration');
  // Use the deployment gateway's trusted forwarded-IP header; never log or store the raw value.
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
  const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,enc.encode('dmj-visit-bucket-v1|'+new Date().toISOString().slice(0,10)+'|'+ip));
  const bucket=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const response=await fetch(url+'/rest/v1/rpc/'+(v2?'ops_record_visit_v2':'ops_record_visit'),{method:'POST',headers:{'Content-Type':'application/json','apikey':serviceKey,'Authorization':'Bearer '+serviceKey},body:JSON.stringify({p_id:d.id,p_session:d.session,p_bucket:bucket,p_page:d.page,p_event:d.event,p_consent:d.consent,...(v2?{p_context:context}:{})})});
  if(!response.ok)throw Error('Ingestion failed');const data=await response.json();return new Response(JSON.stringify({ok:data}),{status:data?200:429,headers});
 }catch{return new Response('Event not accepted',{status:400,headers})}
});
