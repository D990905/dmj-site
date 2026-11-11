const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),data=JSON.parse(read('data/commerce.json')),p=data.products.find(x=>x.id==='ppc-drift');
assert(p);assert.equal(data.products.filter(x=>x.id===p.id).length,1);assert.deepEqual(p.options,['2.7m','3.5m','4.3m']);assert.equal(p.price,null);assert.equal(p.priceStatus,'inquiry');
const baseline=JSON.parse(cp.execFileSync('git',['show','c5af728:data/commerce.json'],{cwd:root,encoding:'utf8'}));assert.deepEqual(data.products.filter(x=>x.id!==p.id),baseline.products,'Existing products must be unchanged');
const detail=read(p.path);for(const name of ['ppc.html','catalog.html','index.html']){assert.equal((read(name).match(/data-product="ppc-drift"/g)||[]).length,1);assert(read(name).includes(p.path));}assert(read('inquiry.html').includes('<option value="ppc-drift">'));assert(read('sitemap.xml').includes('https://dmjgroup.kr/'+p.path));
for(const image of p.gallery)assert(fs.statSync(path.join(root,image)).size>1000);
assert(!detail.includes('₩'));assert(!detail.includes('data-price-krw'));assert(!detail.includes('M2'));assert(detail.includes('3.5m 제품 사진'));assert(detail.includes('안전한 사용 범위를 보장하지 않습니다'));
const api=require('../assets/js/commerce-core.js');for(const size of p.options){assert.equal(api.selectedRetailPrice(data.products,p.id,size),null);assert(!api.inquiryText({product:'PPC · Drift Wing',size,price:api.selectedRetailPrice(data.products,p.id,size)}).includes('₩'));}
// Exercise the actual shared detail selector, including deep-link override and inquiry propagation.
for(const requested of ['', '?size=2.7m','?size=3.5m','?size=4.3m']){
 const option={value:'4.3m',options:p.options.map(value=>({value})),selectedOptions:[{dataset:{}}],addEventListener:(event,fn)=>option.change=fn};
 const link={href:'https://dmjgroup.kr/inquiry.html?product=ppc-drift&size=4.3m'},price={dataset:{},textContent:''};
 vm.runInNewContext(read('assets/js/product-details.js'),{URL,URLSearchParams,location:{search:requested},document:{querySelectorAll:()=>[],getElementById:id=>id==='detail-option'?option:link,querySelector:s=>s==='[data-detail-price]'?price:null}});
 assert.equal(option.value,new URLSearchParams(requested).get('size')||'4.3m');assert.equal(new URL(link.href).searchParams.get('size'),option.value);assert.equal(price.textContent,'가격·구성 확인 후 안내');
 for(const size of p.options){option.value=size;option.change();assert.equal(new URL(link.href).searchParams.get('size'),size);assert.equal(new URL(link.href).searchParams.get('product'),p.id);}
}
console.log('PASS: Drift data, unchanged legacy products, 3 catalog surfaces, inquiry, images, no invented price, default/deep-linked sizes and selector propagation.');
