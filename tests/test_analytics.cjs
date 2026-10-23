const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync('assets/analytics.js', 'utf8');
function setup(stored = null, legacy = null, search = '?country=JP&days=5&utm_source=tistory&utm_medium=blog&utm_campaign=post-1&email=private@example.com&key=secret') {
  const nodes = [], scripts = [], events = {};
  const storage = new Map();
  if (stored) storage.set('travelsimple-analytics-consent-v2', typeof stored === 'string' ? JSON.stringify({choice: stored, version: '2026-10-20'}) : JSON.stringify(stored));
  if (legacy) storage.set('travelsimple-analytics-consent-v1', legacy);
  function element(tag) { const e = {tag, children: [], handlers: {}, setAttribute() {}, addEventListener(n,f) {this.handlers[n]=f;}, append(...items){this.children.push(...items);}, focus(){}}; nodes.push(e); return e; }
  const document = {readyState:'complete',referrer:'https://newtravelinformation.tistory.com/1?email=private@example.com',cookie:'',createElement:element,head:{appendChild(e){if(e.tag==='script')scripts.push(e);}},body:{append(){}},addEventListener(n,f){events[n]=f;}};
  const context = {document,location:{origin:'https://travelsimple-esim.com',hostname:'travel-esim.rkdalstjd8921-cfa.workers.dev',pathname:'/esim.html',search},localStorage:{getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}},URL,URLSearchParams,Date};
  context.window=context;
  vm.runInNewContext(code,context);
  const clickButton = label => nodes.find(e=>e.textContent===label).handlers.click();
  const clickProduct = href => events.click({target:{closest(){return {href};}}});
  const checks = nodes.filter(e=>e.tag==='input');
  const agree = index => {checks[index].checked=true;checks[index].handlers.change();};
  return {context,scripts,clickButton,clickProduct,agree,storage,nodes};
}
const a=setup();
assert.equal(a.scripts.length,0);
a.clickProduct('https://www.esimoa.com/ko/plans/jp/test?ref=partner');
assert.equal(a.context.dataLayer,undefined);
a.clickButton('통계 허용'); assert.equal(a.scripts.length,0);
a.agree(0); a.clickButton('통계 허용'); assert.equal(a.scripts.length,0);
a.agree(1); a.clickButton('통계 허용');
assert.equal(a.scripts.length,1);
assert.equal(JSON.parse(a.storage.get('travelsimple-analytics-consent-v2')).version,'2026-10-20');
const args=()=>a.context.dataLayer.map(x=>Array.from(x));
const config=args().find(x=>x[0]==='config')[2];
assert(!config.page_location.includes('secret'));
assert(!config.page_location.includes('email'));
assert(config.page_location.includes('utm_campaign=post-1'));
assert.equal(config.page_referrer,'https://newtravelinformation.tistory.com');
a.clickProduct('https://www.esimoa.com/ko/plans/jp/test?ref=partner');
assert.equal(args().filter(x=>x[0]==='event'&&x[1]==='esim_purchase_click').length,1);
a.clickButton('거부');
a.clickProduct('https://www.esimoa.com/ko/plans/jp/test?ref=partner');
assert.equal(args().filter(x=>x[0]==='event').length,1);
a.agree(0);a.agree(1);a.clickButton('통계 허용');assert.equal(a.scripts.length,1);
assert.equal(args().filter(x=>x[0]==='config').length,1);
const b=setup('denied');assert.equal(b.scripts.length,0);
const c=setup('granted');assert.equal(c.scripts.length,1);
c.clickProduct('javascript:alert(1)');assert(!c.context.dataLayer.some(x=>x[0]==='event'));
assert.equal(setup(null,'granted').scripts.length,0);
assert.equal(setup({choice:'granted',version:'old'}).scripts.length,0);
console.log('Analytics separate consent, legacy rejection, sanitized attribution and withdrawal checks: PASS');

// Use real profile, launch and daily-publishing link patterns, including Meta noise.
for (const [source, campaign] of [
  ['instagram', 'profile'], ['threads', 'profile'],
  ['instagram', 'launch-20261022'], ['threads', 'launch-20261022'],
  ['instagram', 'ig-20261023'], ['instagram', 'reel-20261023'],
  ['threads', 'threads-20261023'],
  ['youtube', 'profile'], ['youtube', 'shorts-launch-20261023'],
  ['youtube', 'shorts-20261024'],
]) {
  const query = '?country=TW&days=7&utm_source=' + source + '&utm_medium=social&utm_campaign=' + campaign + '&utm_content=link_in_bio&fbclid=secret-meta-id&email=private%40example.com&token=secret';
  const test = setup(null, null, query);
  assert.equal(test.scripts.length, 0, 'No collection before consent');
  test.agree(0); test.agree(1); test.clickButton('통계 허용');
  const sent = () => test.context.dataLayer.map(x => Array.from(x));
  const location = new URL(sent().find(x => x[0] === 'config')[2].page_location);
  assert.equal(location.searchParams.get('utm_source'), source);
  assert.equal(location.searchParams.get('utm_medium'), 'social');
  assert.equal(location.searchParams.get('utm_campaign'), campaign);
  assert.equal(location.searchParams.get('country'), 'TW');
  assert.equal(location.searchParams.get('days'), '7');
  for (const key of ['email', 'token', 'fbclid', 'utm_content']) assert.equal(location.searchParams.has(key), false);
  assert.equal(location.hash, '');
  const referral = 'https://www.esimoa.com/ko/plans/tw/test?ref=p_example&utm_source=esimoa_partner';
  test.clickProduct(referral);
  const event = sent().find(x => x[0] === 'event' && x[1] === 'esim_purchase_click');
  assert.equal(event[2].page_location, location.href);
  assert.equal(event[2].country, 'TW');
  assert.equal(event[2].travel_days, 7);
  assert.equal(event[2].link_domain, 'www.esimoa.com');
  assert.equal(event[2].link_path, '/ko/plans/tw/test');
  assert(!JSON.stringify(event).includes('p_example'), 'Do not transmit referral identifiers');
  test.clickButton('거부');
  const eventCount = sent().filter(x => x[0] === 'event').length;
  test.clickProduct(referral);
  assert.equal(sent().filter(x => x[0] === 'event').length, eventCount);
}
// Reject arbitrary campaign text and unsupported values instead of broadening collection.
const rejected = setup('granted', null, '?utm_source=private%40example.com&utm_medium=secret&utm_campaign=profile-private%40example.com&country=ZZ&days=1000');
const rejectedLocation = new URL(rejected.context.dataLayer.map(x => Array.from(x)).find(x => x[0] === 'config')[2].page_location);
assert.equal(rejectedLocation.search, '');
console.log('Instagram/Threads attribution, campaign formats, privacy filtering and consent regression checks: PASS');

