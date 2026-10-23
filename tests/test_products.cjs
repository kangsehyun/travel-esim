const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync('assets/esim.js', 'utf8');
function setup(responses) {
  function el() { return {children:[],handlers:{},attributes:{},textContent:'',value:'',checked:false,hidden:false,set innerHTML(v){this.children=[];this.textContent='';},addEventListener(n,f){this.handlers[n]=f;},setAttribute(n,v){this.attributes[n]=v;},removeAttribute(n){delete this[n];},appendChild(e){this.children.push(e);}}; }
  const ids = Object.fromEntries(['title','subtitle','status','products','retry-products','country-guide','sort','unlimited','hotspot','search-country','search-days','more-products','data-type','coverage-type','network-type','local-number'].map(id=>[id,el()]));
  ids.sort.value='recommended';
  let calls=0;const urls=[];
  const location={search:'?country=JP&days=5&utm_source=tistory',href:'https://travel.example/esim.html?country=JP&days=5&utm_source=tistory'};
  const context={URL,URLSearchParams,AbortController,setTimeout(){return 1;},clearTimeout(){},console:{error(){}},document:{getElementById(id){return ids[id];},createElement:el},fetch:async(url)=>{urls.push(url);const next=responses[calls++];if(next instanceof Error)throw next;return {ok:true,json:async()=>next};},window:{location,history:{replaceState(){}}}};
  vm.runInNewContext(code, context);
  return {ids,context,urls,get calls(){return calls;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const a=setup([{items:[{title:'확인용',priceKrw:null,hotspot:null,isLocalNetwork:null,url:'https://www.esimoa.com/ko/plans/jp/test?ref=p_c5ion15c'},{title:'정상',priceKrw:12000,hotspot:false,isLocalNetwork:false,url:'javascript:alert(1)'}]}]);await tick();
  const cards=a.ids.products.children;
  assert.equal(cards[0].children[3].textContent,'가격 확인 필요');
  assert(cards[0].children[2].textContent.includes('핫스팟: 확인 필요'));
  assert(cards[0].children[2].textContent.includes('망 유형 확인 필요'));
  assert(cards[1].children[2].textContent.includes('핫스팟: 불가'));
  assert(cards[0].children[4].href.includes('ref=p_c5ion15c'));
  assert.equal(cards[1].children[4].href,undefined);
  assert.equal(cards[0].children[0].textContent,'eSIM');
  for(const value of [null,undefined,'',0,'0',-1,'wrong',false])assert.equal(a.context.knownPrice(value),null);
  assert.equal(a.context.knownPrice('11200'),11200);
  for(const direction of [1,-1])assert(a.context.comparePrices({priceKrw:null},{priceKrw:1},direction)>0);
  assert.equal(a.context.purchaseUrl('https://esimoa.com.evil.example/'),null);
  assert.equal(a.context.purchaseUrl('https://user@www.esimoa.com/'),null);
  const b=setup([new Error('network'),{items:[]}]);await tick();
  assert.equal(b.ids['retry-products'].hidden,false);
  assert(!b.ids.products.textContent.includes('Console'));
  await b.ids['retry-products'].handlers.click();
  assert.equal(b.calls,2);
  assert.equal(b.ids['retry-products'].hidden,true);
  assert.equal(b.ids.products.attributes['aria-busy'],'false');
  assert(b.ids.status.textContent.includes('0개'));
  const c=setup([{unexpected:true}]);await tick();assert.equal(c.ids['retry-products'].hidden,false);
  const page=(start,n)=>({success:true,items:Array.from({length:n},(_,i)=>({id:'p'+(start+i),title:'plan '+(start+i),url:'https://www.esimoa.com/ko/plans/'+(start+i)})),total:105});
  const paged=setup([page(0,50),page(50,50),page(100,5)]);await tick();
  assert.equal(paged.ids.products.children.length,50);assert.equal(paged.ids['more-products'].hidden,false);
  await paged.ids['more-products'].handlers.click();assert.equal(paged.ids.products.children.length,100);assert(paged.urls[1].includes('offset=50'));
  await paged.ids['more-products'].handlers.click();assert.equal(paged.ids.products.children.length,105);assert(paged.urls[2].includes('offset=100'));assert.equal(paged.ids['more-products'].hidden,true);
  const failedPage=setup([page(0,50),new Error('page timeout'),page(50,50)]);await tick();await failedPage.ids['more-products'].handlers.click();assert.equal(failedPage.ids.products.children.length,50);assert.equal(failedPage.ids['more-products'].hidden,false);await failedPage.ids['more-products'].handlers.click();assert(failedPage.urls[2].includes('offset=50'));assert.equal(failedPage.ids.products.children.length,100);
  const filters=setup([page(0,1),page(0,1)]);await tick();filters.ids['search-country'].value='FR';filters.ids['search-days'].value='';filters.ids.sort.value='price-asc';await filters.ids.sort.handlers.change();await tick();assert(filters.urls[1].includes('country=FR'));assert(filters.urls[1].includes('sort=price'));assert(!filters.urls[1].includes('days='));
  console.log('Product unknown values, price ordering, safe referral URLs and error retry: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
