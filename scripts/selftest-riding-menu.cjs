const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/commerce.js'), 'utf8');
const boundary = source.indexOf('\n\n(() => {');
assert(boundary > 0, 'The independent navigation bootstrap must precede commerce logic');
const bootstrap = source.slice(0, boundary);

function fixture({ pathname = '/index.html', root = '', existing = false, auth = true, menu = true } = {}) {
  const login = { href: root + 'login.html', textContent: '로그인 / 회원가입', auth: true };
  const links = [{ href: root + 'outlet.html', textContent: '아울렛·중고' }];
  if (existing) links.push({ href: root + 'riding-dashboard/v2.html', textContent: '라이딩 분석' });
  if (auth) links.push(login);
  const nav = {
    querySelector(selector) {
      if (selector === '[data-customer-auth]') return links.find(link => link.auth) || null;
      if (selector === 'a[href$="riding-dashboard/v2.html"]') return links.find(link => link.href.endsWith('riding-dashboard/v2.html')) || null;
      throw new Error('Unexpected selector: ' + selector);
    },
    insertBefore(link, before) {
      if (before === null) links.push(link);
      else links.splice(links.indexOf(before), 0, link);
    }
  };
  const context = {
    document: {
      currentScript: { dataset: { root } },
      querySelector(selector) { assert.equal(selector, '#store-nav'); return menu ? nav : null; },
      createElement(tag) { assert.equal(tag, 'a'); return {}; }
    },
    location: { pathname }
  };
  return { links, run: () => vm.runInNewContext(bootstrap, context) };
}

let checks = 0;
for (const config of [
  {},
  { pathname: '/catalog.html' },
  { pathname: '/products/takoon/cruise.html', root: '../../' },
  { pathname: '/dmj-site/products/ppc/m1-x.html', root: '../../' },
  { auth: false },
  { existing: true }
]) {
  const test = fixture(config);
  test.run();
  test.run();
  const links = test.links.filter(link => link.textContent === '라이딩 분석');
  assert.equal(links.length, 1, 'Repeated load or future static links must not duplicate the entry');
  assert.equal(links[0].href, (config.root || '') + 'riding-dashboard/v2.html');
  const authIndex = test.links.findIndex(link => link.auth);
  if (authIndex !== -1) assert.equal(test.links[authIndex - 1], links[0]);
  checks++;
}
for (const config of [
  { pathname: '/admin/index.html', root: '../' },
  { pathname: '/dmj-site/admin/outlet.html', root: '../' },
  { menu: false }
]) {
  const test = fixture(config);
  test.run();
  assert.equal(test.links.some(link => link.textContent === '라이딩 분석'), false);
  checks++;
}
console.log(`PASS: ${checks} shared-navigation scenarios, including nested routes, duplicates and admin exclusion`);
