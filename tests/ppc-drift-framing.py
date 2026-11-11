"""Read-only measurement: Drift must match the existing 82% wing silhouette width."""
from pathlib import Path
from PIL import Image, ImageChops
import re, subprocess
ROOT = Path(__file__).resolve().parents[1]
photo = 'assets/images/products/ppc/drift/product-1.jpg'
im = Image.open(ROOT / photo).convert('RGB')
w, h = im.size
bounds = ImageChops.difference(im, Image.new('RGB', im.size, im.getpixel((0, 0)))).convert('L').point(lambda v: 255 if v > 34 else 0).getbbox()
assert bounds == (108, 28, 1131, 613)
l, t, r, b = bounds
css = (ROOT / 'assets/css/product-framing.css').read_text()
rule = re.search(r'\.commerce \.product-card\[data-product="ppc-drift"\] \.product-image img\{([^}]+)\}', css)[1]
values = {k: float(re.search(r'(?:^|;)' + k + r':([\d.]+)%', rule)[1]) for k in ['width', 'height', 'left', 'top']}
sx, sy = values['width'] / w, values['height'] / h
assert abs(sx - sy) < 0.000001, 'Original image aspect ratio must be preserved'
assert abs((r-l)*sx - 82) < 0.001, 'Visible canopy must occupy 82% of the square card'
assert abs(values['left'] + ((l+r)/2-w/2)*sx - 50) < 0.001
assert abs(values['top'] + ((t+b)/2-h/2)*sy - 50) < 0.001
for f in ['ppc.html', 'catalog.html', 'index.html', 'products/ppc/drift-wing.html']:
    assert 'product-framing.css?v=20261111-drift-framing' in (ROOT / f).read_text()
for n in range(1, 4):
    f = f'assets/images/products/ppc/drift/product-{n}.jpg'
    assert (ROOT / f).read_bytes() == subprocess.check_output(['git','show','2783735:'+f],cwd=ROOT), 'Source photographs must not change'
print('PASS: original pixels unchanged; Drift visible width 82%, silhouette centered, natural aspect ratio, shared CSS cache refreshed.')
