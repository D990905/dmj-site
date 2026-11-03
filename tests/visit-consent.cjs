const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{webcrypto:crypto}=require('node:crypto');
const source=fs.readFileSync('assets/js/visit-consent.js','utf8');
async function boot(options={}){
 const events={},buttons=[],timers=[],sent=[],storage=new Map();if(options.consent)storage.set('dmj_analytics_consent_v1',JSON.stringify(options.consent));
 const node=()=>({style:{},append(){},remove(){},setAttribute(){},set textContent(v){this.text=v}});
 const document={currentScript:{src:'https://dmjgroup.kr/assets/js/visit-consent.js'},referrer:options.referrer||'',body:node(),hidden:false,createElement:tag=>{const n=node();if(tag==='button')buttons.push(n);return n},addEventListener:(k,f)=>events[k]=f};
 const window={addEventListener:(k,f)=>events[k]=f};const localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},sessionStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const context={window,document,localStorage,sessionStorage,crypto,URL,URLSearchParams,Date,navigator:{userAgent:'iPhone Mobile',webdriver:options.bot||false},location:{hostname:options.host||'dmjgroup.kr',pathname:'/outlet.html',search:'?utm_source=instagram&utm_campaign=person@example.com&private=secret'},setTimeout:f=>{timers.push(f);return timers.length},clearTimeout(){},fetch:async(url,opts)=>{if(opts?.method){sent.push(JSON.parse(opts.body));return {ok:true}}return {ok:true,json:async()=>({visitorAnalyticsEnabled:true,visitEndpoint:'https://test/visit',analyticsUtmAllowlist:{source:['instagram']}})}}};
 vm.runInNewContext(source,context);await new Promise(setImmediate);await new Promise(setImmediate);return {sent,buttons,timers,events,context,storage};
}
(async()=>{
 let b=await boot();assert.equal(b.sent.length,0);b.buttons.find(x=>x.text==='동의하지 않음').onclick();b.timers.forEach(f=>f());assert.equal(b.sent.length,0);console.log('PASS no consent and rejection: no events');
 b=await boot({consent:{allow:true,date:Date.now(),version:'old'}});assert.equal(b.sent.length,0);console.log('PASS old consent requires renewal');
 b=await boot();b.buttons.find(x=>x.text==='동의').onclick();await new Promise(setImmediate);assert.equal(b.sent.length,1);assert.equal(b.sent[0].utm_source,'instagram');assert.equal(b.sent[0].utm_campaign,'other');assert.equal(b.sent[0].device_type,'mobile');assert(!JSON.stringify(b.sent).includes('secret'));assert(!JSON.stringify(b.sent).includes('example.com'));vm.runInNewContext(source,b.context);await new Promise(setImmediate);assert.equal(b.sent.length,1);console.log('PASS minimized context and duplicate script guard');
 b.buttons.find(x=>x.text==='동의하지 않음').onclick();b.events.click({target:{closest:()=>true}});b.timers.forEach(f=>f());await new Promise(setImmediate);assert.equal(b.sent.length,1);assert(!b.storage.has('dmj_visit_session'));console.log('PASS withdrawal stops timers and clicks, clears session');
 for(const option of [{host:'localhost'},{bot:true}]){b=await boot({...option,consent:{allow:true,date:Date.now(),version:'analytics-2026-11-03'}});assert.equal(b.sent.length,0)}console.log('PASS local tests and explicit automation excluded');
})().catch(e=>{console.error(e);process.exitCode=1});
