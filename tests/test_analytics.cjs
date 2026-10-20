const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync('assets/analytics.js', 'utf8');
function setup(stored = null) {
  const nodes = [], scripts = [], events = {};
  const storage = new Map(stored ? [['travelsimple-analytics-consent-v1', stored]] : []);
  function element(tag) { const e = {tag, children: [], handlers: {}, setAttribute() {}, addEventListener(n,f) {this.handlers[n]=f;}, append(...items){this.children.push(...items);}, focus(){}}; nodes.push(e); return e; }
  const document = {readyState:'complete',referrer:'https://newtravelinformation.tistory.com/1?email=private@example.com',cookie:'',createElement:element,head:{appendChild(e){if(e.tag==='script')scripts.push(e);}},body:{append(){}},addEventListener(n,f){events[n]=f;}};
  const context = {document,location:{origin:'https://travel-esim.rkdalstjd8921-cfa.workers.dev',hostname:'travel-esim.rkdalstjd8921-cfa.workers.dev',pathname:'/esim.html',search:'?country=JP&days=5&utm_source=tistory&utm_medium=blog&utm_campaign=post-1&email=private@example.com&key=secret'},localStorage:{getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}},URL,URLSearchParams,Date};
  context.window=context;
  vm.runInNewContext(code,context);
  const clickButton = label => nodes.find(e=>e.textContent===label).handlers.click();
  const clickProduct = href => events.click({target:{closest(){return {href};}}});
  return {context,scripts,clickButton,clickProduct};
}
const a=setup();
assert.equal(a.scripts.length,0);
a.clickProduct('https://www.esimoa.com/ko/plans/jp/test?ref=partner');
assert.equal(a.context.dataLayer,undefined);
a.clickButton('통계 허용');
assert.equal(a.scripts.length,1);
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
a.clickButton('통계 허용');assert.equal(a.scripts.length,1);
assert.equal(args().filter(x=>x[0]==='config').length,1);
const b=setup('denied');assert.equal(b.scripts.length,0);
const c=setup('granted');assert.equal(c.scripts.length,1);
c.clickProduct('javascript:alert(1)');assert(!c.context.dataLayer.some(x=>x[0]==='event'));
console.log('Analytics consent, sanitized attribution, purchase-click and re-consent checks: PASS');
