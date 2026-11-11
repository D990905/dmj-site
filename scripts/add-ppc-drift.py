# -*- coding: utf-8 -*-
"""Add the reviewed Drift record/pages without rebuilding the legacy storefront.
Run from any directory with Python 3. Existing non-Drift products are preserved.
"""
from pathlib import Path
import json, re
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from html import escape
ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://ppcfoiling.com/products/drift-wing'
IMAGES = [f'assets/images/products/ppc/drift/product-{n}.jpg' for n in range(1, 4)]
SUMMARY = 'PPC가 웨이브와 스웰 라이딩을 위해 설계한 듀얼스킨 윙으로 소개하는 모델입니다. EXO-PE 리딩엣지, FlyLite 스킨과 싱글 붐 구성이 특징입니다.'
p = dict(id='ppc-drift', brand='ppc', name='Drift Wing', category='wing', path='products/ppc/drift-wing.html', image=IMAGES[0], description=SUMMARY, options=['2.7m','3.5m','4.3m'], price=None, availability='inquiry', source=SOURCE, priority='performance', discipline='wing', environments=['wave'], purposes=['wave'], raceOnly=False, headline='웨이브·스웰을 위한 듀얼스킨 윙', manufacturerSummary=SUMMARY, verifiedAt='2026-11-11', priceStatus='inquiry', pricingStatus='가격·입고 문의', priceNote='국내 판매가 미확정 · 가격, 붐 포함 구성과 입고 일정은 상담에서 확인', gallery=IMAGES, specs={'사이즈':'2.7m / 3.5m / 4.3m','구조':'듀얼스킨','리딩엣지':'EXO-PE','스킨':'FlyLite','핸들':'싱글 붐'}, notes=['본사 설명에 따른 제품 소개이며 독립 성능 시험 결과가 아닙니다.','사진은 공식 3.5m 샘플로, 사이즈별 외관은 다를 수 있습니다.'])
# Match Sonic's established import-price basis, then the storefront KRW 10,000 rounding.
def retail_price(usd):
    total = (Decimal(usd) * 1390 + 200000) * Decimal('1.08') * Decimal('1.10') * Decimal('0.90')
    thousands = (total / 1000).quantize(Decimal('1'), rounding=ROUND_DOWN) * 1000
    return int((thousands / 10000).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * 10000)
variants = [dict(option=size, priceKRW=retail_price(usd), sourcePriceUSD=usd, sourceVariantId=variant, estimated=False)
            for size, usd, variant in [('2.7m', 2210, '68210681446585'), ('3.5m', 2340, '68143227338937'), ('4.3m', 2520, '68210682003641')]]
p.update(price=min(v['priceKRW'] for v in variants), priceMax=max(v['priceKRW'] for v in variants),
         retailVariants=variants, priceStatus='fixed', pricingStatus='고정 판매가',
         priceNote='고정 판매가 · 붐 포함 구성과 입고 일정은 상담에서 확인',
         priceReviewedAt='2026-11-11', priceFixedAt='2026-11-11',
         priceSource='2026-11-11 PPC 공식 표시가 · 기존 PPC USD 1390원 · 운임 가정 20만원 기준',
         pricingBasis=dict(currency='USD', fx=1390, sourcePriceType='displayed_price', freightAllowanceKRW=200000,
                           dutyAssumption=0.08, vat=0.1, discount=0.1, rounding='floor_1000_then_round_half_up_10000',
                           policyReference='PPC Sonic FDS 2026-09-29; retail rounding 2026-09-30'))
def save_json(path, data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
f=ROOT/'data/commerce.json';data=json.loads(f.read_text());data['products']=[x for x in data['products'] if x['id']!=p['id']];pos=next(i for i,x in enumerate(data['products']) if x['id']=='ppc-m2');data['products'].insert(pos,p);save_json(f,data)
f=ROOT/'data/product-gallery-manifest.json';data=json.loads(f.read_text());data['products']=[x for x in data['products'] if x['id']!=p['id']];data['products'].append(dict(id=p['id'],path=p['path'],source=SOURCE,photos=['../../'+s for s in IMAGES],groups={},checkedAt='2026-11-11'));save_json(f,data)
# Reuse the currently deployed shared header/footer, not the obsolete product generator.
template=(ROOT/'products/ppc/m2.html').read_text()
head=template.split('<main id="main">')[0]
head=head.replace('PPC M2 | DMJ','PPC Drift Wing | DMJ').replace('https://dmjgroup.kr/products/ppc/m2.html','https://dmjgroup.kr/'+p['path']).replace('https://dmjgroup.kr/assets/images/products/ppc/m2/product-official.jpg','https://dmjgroup.kr/'+IMAGES[0])
head=re.sub(r'(<meta (?:name="description"|property="og:description") content=")[^"]*',lambda m:m[1]+SUMMARY,head)
footer=template.split('</main>',1)[1]
thumbs=''.join(f'<button type="button" class="gallery-thumb" data-product-photo="../../{s}" aria-label="Drift 제품 사진 {i} / 3"><img src="../../{s}" alt="Drift Wing {alt}" loading="lazy"></button>' for i,(s,alt) in enumerate(zip(IMAGES,['상면','리딩엣지 정면','싱글 붐과 하면']),1))
options=''.join(f'<option value="{s}" data-price-krw="{next(v["priceKRW"] for v in variants if v["option"] == s)}"'+(' selected' if s=='4.3m' else '')+f'>{s}</option>' for s in p['options'])
specs=''.join(f'<tr><th scope="row">{k}</th><td>{v}</td></tr>' for k,v in p['specs'].items())
body=f'''<main id="main"><div class="breadcrumbs"><a href="../../catalog.html">전체 장비</a><span>/</span><a href="../../ppc.html">PPC</a><span>/</span><span>Drift Wing</span></div>
<section class="product-detail"><div class="gallery"><div class="detail-photo"><img src="../../{IMAGES[0]}" alt="PPC Drift Wing 상면" width="1200" height="766" loading="eager"></div><div class="gallery-thumbs" role="group" aria-label="제품 사진 선택">{thumbs}</div><p class="gallery-note">PPC 공식 3.5m 제품 사진입니다. 사이즈별 외관과 실제 공급 구성은 상담에서 확인해 주세요.</p></div>
<div class="detail-copy"><span class="eyebrow">PPC / 윙</span><h1>Drift Wing</h1><h2 class="detail-subtitle">웨이브·스웰을 위한 듀얼스킨 윙</h2><p class="detail-description">{SUMMARY}</p><label class="detail-option">관심 사이즈<select id="detail-option"><option value="">사이즈 선택</option>{options}</select></label><div class="detail-availability"><strong data-detail-price aria-live="polite">₩3,960,000</strong><p>판매가 · 붐 포함 구성과 입고 일정은 구매 상담에서 안내합니다.</p></div><a class="button lime full" id="detail-inquiry" href="../../inquiry.html?product=ppc-drift&amp;size=4.3m">이 제품 구매 문의 ↗</a><a class="text-link" href="#specifications">사양표 확인 ↓</a><button class="share-button" data-share>제품 링크 공유 ↗</button></div></section>
<section class="section product-help"><div><span class="eyebrow">THE DRIFT, IN DETAIL</span><h2>파도와 스웰을 위한<br>Drift Wing</h2></div><div class="product-facts"><article><span>01 / WAVE &amp; SWELL</span><h3>웨이브 중심 설계</h3><p>PPC는 파도와 스웰에서 윙을 흘려두는 라이딩에 초점을 맞춘 모델로 소개합니다. 체중, 경험과 주로 타는 환경에 맞춰 사이즈를 상담해 주세요.</p></article>
<article><span>02 / CONSTRUCTION</span><h3>듀얼스킨 구조</h3><p>본사 표기 기준 EXO-PE 리딩엣지와 FlyLite 스킨을 사용합니다. 제조사의 설계 설명이며 DMJ의 독립 성능 시험 결과는 아닙니다.</p></article>
<article><span>03 / YOUR SETUP</span><h3>세 가지 사이즈 · 싱글 붐</h3><p>2.7m, 3.5m, 4.3m 옵션을 제공합니다. 붐 포함 여부와 국내 공급 구성, 판매가 및 입고 일정은 주문 전에 확인합니다.</p></article></div></section>
<section class="section specifications" id="specifications"><div class="section-heading"><h2>사이즈와 세부 사양</h2></div><div class="spec-scroll" tabindex="0" aria-label="Drift 제품 정보"><table><caption>본사 공개 제품 정보</caption><tbody>{specs}</tbody></table></div><div class="spec-scroll" tabindex="0" aria-label="제조사 제시 사이즈별 무게와 풍속"><table><caption>PPC 제시 사이즈별 무게와 풍속</caption><thead><tr><th scope="col">사이즈</th><th scope="col">붐 제외 무게*</th><th scope="col">붐 포함 무게*</th><th scope="col">풍속 (kts)</th></tr></thead><tbody><tr><th scope="row">2.7m</th><td>1.61</td><td>2.02</td><td>28–40+</td></tr><tr><th scope="row">3.5m</th><td>1.80</td><td>2.21</td><td>20–38+</td></tr><tr><th scope="row">4.3m</th><td>1.99</td><td>2.40</td><td>15–27</td></tr></tbody></table></div><p class="small">*무게는 본사 표기값입니다. 원문에 단위가 명시되지 않아 확인이 필요합니다.</p><p class="small">풍속은 제조사 표기이며 안전한 사용 범위를 보장하지 않습니다. 체중·숙련도·돌풍·해상 상태·보드 및 포일 구성에 따라 적합한 사이즈가 달라집니다.</p><details class="source-details"><summary>원문과 확인 기준</summary><p>본사 제품 설명을 한국어로 요약했습니다. 확인일: 2026-11-11. 국내 판매가는 기존 PPC 가격 산정 기준을 적용했습니다. 공급 구성과 재고는 별도 확인이 필요합니다.</p><a href="{SOURCE}" target="_blank" rel="noopener">PPC 본사 원문·사진 출처 ↗</a></details></section></main>'''
(ROOT/p['path']).write_text(head+body+footer)
card=f'''<article class="product-card" data-product="ppc-drift" data-brand="ppc" data-category="wing" data-subcategory="" data-priority="performance" data-search="drift wing 드리프트 웨이브 스웰 듀얼스킨"><a class="product-image" href="{p['path']}"><img src="{IMAGES[0]}" alt="PPC Drift Wing 제품 사진" width="1200" height="766" loading="lazy"><span>윙</span></a><div class="product-info"><span class="eyebrow">PPC / 웨이브</span><h3><a href="{p['path']}">Drift Wing</a></h3><div class="product-labels" aria-label="추천 용도"><span>웨이브</span><span>스웰</span></div><p class="product-positioning">{p['headline']}</p><p class="product-price">₩3,500,000부터</p></div></article>'''
for name in ['ppc.html','catalog.html','index.html']:
    f=ROOT/name;s=f.read_text();s=re.sub(r'<article class="product-card" data-product="ppc-drift".*?</article>','',s,flags=re.S)
    if name=='index.html':
        marker='<article class="product-card" data-product="ppc-m1x"';i=s.index(marker);s=s[:i]+card+s[i:]
    else:
        # Append after the last priced PPC wing, preserving the existing price order.
        pattern=r'(<article class="product-card" data-product="ppc-fds".*?</article>)';s,n=re.subn(pattern,lambda m:m[1]+card,s,count=1,flags=re.S);assert n==1
    if name=='ppc.html':s=s.replace('6개 모델 · 판매가 · 입고 상담','7개 모델 · 판매가 · 입고 상담')
    f.write_text(s)
f=ROOT/'inquiry.html';s=f.read_text();option='<option value="ppc-drift">PPC · Drift Wing</option>';s=s.replace(option,'');s=s.replace('<option value="ppc-m2">',option+'<option value="ppc-m2">',1);f.write_text(s)
f=ROOT/'sitemap.xml';s=f.read_text();url='https://dmjgroup.kr/'+p['path'];s=re.sub(r'\s*<url>\s*<loc>'+re.escape(url)+r'</loc>.*?</url>','',s,flags=re.S);s=s.replace('</urlset>',f'  <url><loc>{url}</loc><lastmod>2026-11-11</lastmod></url>\n</urlset>');f.write_text(s)
print('Added Drift: commerce record, detail page, gallery manifest, PPC/catalog/home cards, inquiry and sitemap.')

# Keep the shared card-framing correction fresh when rebuilding Drift surfaces.
for name in ['ppc.html', 'catalog.html', 'index.html', p['path']]:
    f = ROOT / name
    f.write_text(re.sub(r'product-framing\.css\?v=[^"<>]+', 'product-framing.css?v=20261111-drift-framing', f.read_text()))
