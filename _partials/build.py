#!/usr/bin/env python3
"""§530 파샬 주입 — <!--#nav--> / <!--#foot--> 를 실제 마크업으로 바꾼다.

왜 빌더인가: 헤더를 페이지마다 복사해 두면 반드시 어긋난다(지금 사이트가
그래서 짜깁기로 보인다). 한 곳에서 고치고 전 페이지에 뿌린다.

주입은 **멱등**이다 — 이미 주입된 파일을 다시 돌려도 같은 결과가 나오도록
주입 구간을 마커로 감싼다."""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def load(name):
    return io.open(os.path.join(HERE, name), encoding='utf-8').read().rstrip('\n')

def inject(html, tag, body):
    begin = '<!--#%s:begin-->' % tag
    end   = '<!--#%s:end-->' % tag
    block = '%s\n%s\n%s' % (begin, body, end)
    if begin in html and end in html:
        return re.sub(re.escape(begin) + r'.*?' + re.escape(end), lambda m: block, html, flags=re.S)
    marker = '<!--#%s-->' % tag
    if marker in html:
        return html.replace(marker, block, 1)
    return html

def main(files):
    nav, foot = load('nav.html'), load('foot.html')
    changed = []
    for f in files:
        p = os.path.join(ROOT, f)
        if not os.path.exists(p):
            print('  건너뜀(없음):', f); continue
        s = io.open(p, encoding='utf-8').read()
        out = inject(inject(s, 'nav', nav), 'foot', foot)
        if out != s:
            io.open(p, 'w', encoding='utf-8').write(out)
            changed.append(f)
    print('주입:', len(changed), '파일')
    for c in changed: print('  ', c)

if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        args = [f for f in os.listdir(ROOT)
                if f.endswith('.html') and not f.startswith('_')]
    main(args)
