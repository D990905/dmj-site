const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const page = read('products/ppc/drift-wing.html');
const generator = read('scripts/add-ppc-drift.py');
const tableOf = s => s.match(/<table><caption>PPC 제시 사이즈별 무게와 풍속<\/caption>[\s\S]*?<\/table>/)?.[0];
const table = tableOf(page);
assert(table, 'The complete specification table must be present');
assert.equal(tableOf(generator), table, 'Regeneration must preserve the same table');
assert.deepEqual([...table.matchAll(/<th scope="col">(.*?)<\/th>/g)].map(m => m[1]),
  ['사이즈', '붐 제외 무게*', '붐 포함 무게*', '풍속 (kts)']);
assert.deepEqual([...table.matchAll(/<tr><th scope="row">(.*?)<\/th><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/g)].map(m => m.slice(1)), [
  ['2.7m', '1.61', '2.02', '28–40+'],
  ['3.5m', '1.80', '2.21', '20–38+'],
  ['4.3m', '1.99', '2.40', '15–27']
]);
for (const s of [page, generator]) {
  assert(s.includes('*무게는 본사 표기값입니다. 원문에 단위가 명시되지 않아 확인이 필요합니다.'));
  assert(s.includes('풍속은 제조사 표기이며 안전한 사용 범위를 보장하지 않습니다.'));
  assert(s.includes('체중·숙련도·돌풍·해상 상태·보드 및 포일 구성'));
}
assert(!/kg|킬로/i.test(table), 'Do not invent a weight unit');
assert(page.includes('href="https://ppcfoiling.com/products/drift-wing"'));
assert.equal(read('data/commerce.json'), cp.execFileSync('git', ['show', 'e6a2ede:data/commerce.json'], {cwd: root, encoding: 'utf8'}), 'Commerce and all prices must remain unchanged');
console.log('PASS: exact four-column specifications, generator parity, explicit unknown unit, safety caveat, source link and unchanged commerce/prices.');
