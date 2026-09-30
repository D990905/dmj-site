"""Verify every product gallery against the reviewed manufacturer-photo manifest.
Run after regenerating product pages and before deployment.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import json
ROOT=Path(__file__).resolve().parents[1]
class Gallery(HTMLParser):
    def __init__(self):super().__init__();self.photos=[];self.groups={}
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'data-product-photo' not in a:return
        src=a['data-product-photo'];self.photos.append(src)
        if 'data-photo-group' in a:self.groups.setdefault(a['data-photo-group'],[]).append(src)
manifest=json.loads((ROOT/'data/product-gallery-manifest.json').read_text())
products=json.loads((ROOT/'data/commerce.json').read_text())['products']
assert {p['id'] for p in products}=={p['id'] for p in manifest['products']},'Catalog/manifest mismatch: review new products'
errors=[]
for p in manifest['products']:
    page=ROOT/p['path'];s=page.read_text();g=Gallery();g.feed(s)
    if set(g.photos)!=set(p['photos']):errors.append(p['id']+': gallery photos differ from verified manifest')
    if g.groups!=p['groups']:errors.append(p['id']+': configuration photos differ')
    for src in set(g.photos):
        if not urlsplit(src).netloc and not (page.parent/urlsplit(src).path).is_file():errors.append(p['id']+': missing '+src)
    for script in ['product-gallery.js','product-gallery.css']:
        if script not in s:errors.append(p['id']+': missing '+script)
if errors:raise SystemExit('\n'.join(errors))
print(f"PASS: {len(products)} products; {sum(len(p['photos']) for p in manifest['products'])} verified gallery photos; all configuration groups and local files present")
