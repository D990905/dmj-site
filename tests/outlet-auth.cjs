const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const file=process.argv[2]||'assets/js/outlet-common.js';
function setup(){const handlers={};const window={addEventListener:(n,f)=>handlers[n]=f};vm.runInNewContext(fs.readFileSync(file,'utf8'),{window,document:{querySelectorAll:()=>[]},URL,Map,Set,Date,console});return {O:window.DMJOutlet,event:detail=>handlers['dmj-auth-change']({detail})};}
(async()=>{
 for(const detail of [{event:'INITIAL_SESSION',accountChanged:false},{event:'PROFILE_SYNCED',accountChanged:false},{event:'TOKEN_REFRESHED',accountChanged:false},{event:'SIGNED_IN',accountChanged:true},{event:'SIGNED_OUT',accountChanged:true}]){
  const {O,event}=setup();let calls=0;
  const c={storage:{from:()=>({createSignedUrls:async()=>{calls++;if(calls===1)event(detail);return {data:[{path:'photo',signedUrl:'url-'+calls}]}}})}};
  const r=await O.signed(c,[{path:'photo'}]);assert.equal(r.photo,detail.accountChanged?'url-2':'url-1');
  await O.signed(c,[{path:'photo'}]);assert.equal(calls,detail.accountChanged?2:1);
  console.log('PASS in-flight '+detail.event+' and repeat cache');
 }
 {const {O,event}=setup();let calls=0;const c={storage:{from:()=>({createSignedUrls:async()=>{calls++;event({accountChanged:true});return {data:[]}}})}};await assert.rejects(O.signed(c,[{path:'x'}]));assert.equal(calls,3);console.log('PASS bounded session churn, stale URLs discarded');}
 {const {O}=setup();const c={storage:{from:()=>({createSignedUrls:async()=>({error:{message:'denied'}})})}};await assert.rejects(O.signed(c,[{path:'x'}]),/사진/);console.log('PASS storage denial remains an error');}
})().catch(e=>{console.error(e);process.exitCode=1});
