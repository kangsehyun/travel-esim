// Unknown values must remain unknown, rather than becoming free or unavailable.
function knownPrice(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}
function comparePrices(a, b, direction) {
  const left = knownPrice(a.priceKrw), right = knownPrice(b.priceKrw);
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return direction * (left - right);
}
function purchaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && ['www.esimoa.com', 'esimoa.com'].includes(url.hostname) && !url.port ? url.href : null;
  } catch (_) { return null; }
}

const names = {
JP: '일본',
TW: '대만',
VN: '베트남',
TH: '태국',
US: '미국'
};

const params = new URLSearchParams(window.location.search);
let country = (params.get('country') || '').toUpperCase();
let days = Number(params.get('days') || 0);
let scopeAll=params.get('scope')==='all';

const title = document.getElementById('title');
const subtitle = document.getElementById('subtitle');
const status = document.getElementById('status');
const box = document.getElementById('products');
const retryButton = document.getElementById('retry-products');
const guideLink = document.getElementById('country-guide');
let activeController = null;

const sortSelect = document.getElementById('sort');
const unlimitedCheck = document.getElementById('unlimited');
const hotspotCheck = document.getElementById('hotspot');
const countrySelect = document.getElementById('search-country');
const daysSelect = document.getElementById('search-days');

let allItems = [];
let requestNumber = 0;
let nextOffset=0, total=null, hasMore=false, loading=false;
const moreButton=document.getElementById('more-products');
const extraFilters={dataType:document.getElementById('data-type'),multiCountry:document.getElementById('coverage-type'),network:document.getElementById('network-type'),localNumber:document.getElementById('local-number')};

if (
!title ||
!subtitle ||
!status ||
!box ||
!sortSelect ||
!unlimitedCheck ||
!hotspotCheck ||
!countrySelect ||
!daysSelect
) {
console.error('esim.html에서 필요한 HTML 요소를 찾을 수 없습니다.');
} else {
if (country && !/^[A-Z]{2}$/.test(country)) country = '';
if (country && !names[country]) { const option=document.createElement('option');option.value=country;option.textContent=country;countrySelect.appendChild(option); }

if (!Number.isInteger(days) || days<0 || days>365) days=0;
if(days && ![1,3,5,7,10,15,30].includes(days)){const option=document.createElement('option');option.value=String(days);option.textContent=days+'일';daysSelect.appendChild(option);}

countrySelect.value = country;
if(countrySelect.dataset)countrySelect.dataset.all=scopeAll?'true':'false';
daysSelect.value = days ? String(days) : '';
if(params.has('sort'))sortSelect.value=params.get('sort');
if(!sortSelect.value)sortSelect.value='recommended';
unlimitedCheck.checked=params.get('unlimited')==='true';
Object.entries(extraFilters).forEach(([key,el])=>{if(el){if(key==='localNumber')el.checked=params.get(key)==='true';else el.value=params.get(key)||'';}});

function updateHeading() {
let countryName=names[country]||country;
try {if(country&&!names[country])countryName=new Intl.DisplayNames(['ko'],{type:'region'}).of(country)}catch(_){}
title.textContent = country ? countryName+' eSIM' : extraFilters.multiCountry?.value==='true'?'여러 국가 eSIM':'전체 eSIM 상품';
subtitle.textContent = (days ? '이용기간 '+days+'일 상품' : '모든 이용기간 상품')+'을 비교하세요. 가격·사용 조건은 구매 전 확인하세요.';
if (guideLink) {
 const paths={JP:'japan',TW:'taiwan',VN:'vietnam',TH:'thailand',US:'usa'};
 guideLink.hidden=!paths[country];
 if(paths[country]){guideLink.href=paths[country]+'-esim.html';guideLink.textContent=countryName+' eSIM 선택 가이드';}
}
}

function render() {
let items = allItems.slice();


if (unlimitedCheck.checked) {
  items = items.filter(function (p) {
    return p.isUnlimited === true;
  });
}

if (hotspotCheck.checked) {
  items = items.filter(function (p) {
    return p.hotspot === true;
  });
}

if (sortSelect.value === 'price-asc') {
  items.sort(function (a, b) {
    return comparePrices(a, b, 1);
  });
} else if (sortSelect.value === 'price-desc') {
  items.sort(function (a, b) {
    return comparePrices(a, b, -1);
  });
}

status.textContent = '불러온 상품 '+allItems.length+'개'+(total===null?'':' / 검색 결과 '+total+'개')+' · 현재 표시 '+items.length+'개'+(hotspotCheck.checked?' (핫스팟 필터는 불러온 상품에 적용)':'');
if(moreButton){moreButton.hidden=!hasMore;moreButton.disabled=loading;}
box.innerHTML = '';

if (items.length === 0) {
  box.textContent = hasMore ? '불러온 상품 중 일치하는 상품이 없습니다. 상품 더 보기를 누르거나 필터를 변경하세요.' : '조건에 맞는 상품이 없습니다. 필터를 변경해보세요.';
  return;
}

items.forEach(function (p, i) {
  const article = document.createElement('article');
  article.className = 'product-card';

  const label = document.createElement('span');
  label.className = 'eyebrow';
  label.textContent = 'eSIM';

  const heading = document.createElement('h3');
  heading.textContent = p.title || 'eSIM 상품';

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent =
    '데이터: ' + (p.dataAmount || '-') +
    '\n이용기간: ' + (p.validityDays || '-') + '일' +
    '\n통신망: ' + (p.networkType || '-') +
    ' · ' + (p.isLocalNetwork === true ? '현지망' : p.isLocalNetwork === false ? '로밍' : '망 유형 확인 필요') +
    '\n핫스팟: ' + (p.hotspot === true ? '가능' : p.hotspot === false ? '불가' : '확인 필요') +
    '\n제공사: ' + (p.provider || '-') +
    '\n제공 방식: '+(p.dataType==='daily'?'매일 제공':p.dataType==='total'?'총량 제공':'확인 필요')+
    '\n전화번호: '+(p.hasLocalNumber===true?'포함':p.hasLocalNumber===false?'미포함':'확인 필요')+
    '\n사용 국가: '+(Array.isArray(p.coverageCountries)&&p.coverageCountries.length?p.coverageCountries.join(', '):p.countryName||p.countryCode||'구매 페이지 확인');

  meta.hidden=true;meta.id='product-conditions-'+i;
  const specs=document.createElement('p');specs.className='product-key-spec';specs.textContent=(p.isUnlimited===true?'무제한 데이터':p.dataAmount||'데이터 확인 필요')+' · '+(p.validityDays?p.validityDays+'일':'기간 확인 필요')+'\n'+(p.dataType==='daily'?'매일 제공':p.dataType==='total'?'전체 기간 총량':'제공 방식 확인 필요');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='product-details-toggle';toggle.textContent='상세 조건 보기 ⌄';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',meta.id);toggle.addEventListener('click',()=>{meta.hidden=!meta.hidden;toggle.setAttribute('aria-expanded',String(!meta.hidden));toggle.textContent=meta.hidden?'상세 조건 보기 ⌄':'상세 조건 접기 ⌃';});

  const price = document.createElement('strong');
  price.className = 'price';
  const amount = knownPrice(p.priceKrw);
  price.textContent = amount === null ? '가격 확인 필요' : amount.toLocaleString('ko-KR') + '원';

  const link = document.createElement('a');
  link.className = 'buy';
  link.textContent = '구매 페이지 보기';
  link.target = '_blank';
  link.rel = 'sponsored noopener noreferrer';
  link.setAttribute('aria-label', (p.title || 'eSIM 상품') + ' 구매 페이지 보기 (새 창)');

  const safeUrl = purchaseUrl(p.url);
  if (safeUrl) {
    link.href = safeUrl;
  } else {
    link.textContent = '구매 링크 확인 중';
    link.setAttribute('aria-disabled', 'true');
    link.removeAttribute('target');
    link.addEventListener('click', function (event) {
      event.preventDefault();
      // Unavailable links never navigate or create a purchase-click event.
    });
  }

  article.appendChild(label);
  article.appendChild(heading);
  article.appendChild(meta);
  article.appendChild(price);
  article.appendChild(link);
  article.appendChild(specs);article.appendChild(toggle);

  box.appendChild(article);
});


}

async function load(append = false) {
if(!country&&!scopeAll){
 if(activeController)activeController.abort();++requestNumber;allItems=[];hasMore=false;loading=false;box.innerHTML='';box.setAttribute('aria-busy','false');status.textContent='위에서 여행지를 선택해 주세요. 전체 상품은 여행지 검색에서 볼 수 있어요.';if(moreButton)moreButton.hidden=true;if(retryButton)retryButton.hidden=true;updateHeading();return;
}
if(append&&loading)return;
loading=true;
if(moreButton)moreButton.disabled=true;
const currentRequest = ++requestNumber;
if (activeController) activeController.abort();
activeController = new AbortController();
const controller = activeController;
const timer = setTimeout(function () { controller.abort(); }, 15000);
if(!append){allItems=[];nextOffset=0;total=null;hasMore=false;}
box.setAttribute('aria-busy', 'true');
if (retryButton) retryButton.hidden = true;


updateHeading();
status.textContent = '실시간 eSIM 상품을 불러오는 중입니다...';
if(!append)box.innerHTML = '';

try {
  const query=new URLSearchParams({offset:String(nextOffset),sort:sortSelect.value==='price-asc'?'price':sortSelect.value});
  if(country)query.set('country',country);
  if(days)query.set('days',String(days));
  if(unlimitedCheck.checked)query.set('unlimited','true');
  Object.entries(extraFilters).forEach(([key,el])=>{if(el){const value=key==='localNumber'?(el.checked?'true':''):el.value;if(value)query.set(key,value);}});
  const response = await fetch(
    '/api/esims?'+query,
    {signal: controller.signal}
  );

  const data = await response.json();

  if (currentRequest !== requestNumber) return;

  if (!response.ok || !data || data.success === false) {
    throw new Error((data && data.error) || 'API 오류 ' + response.status);
  }

  if (!Array.isArray(data.items)) throw new Error('Invalid product response');
  const received=data.items.filter(function(item){return item&&typeof item==='object'&&!Array.isArray(item)});
  const seen=new Set(allItems.map(p=>p.id||p.url));
  allItems=allItems.concat(received.filter(p=>{const key=p.id||p.url;if(!key)return true;if(seen.has(key))return false;seen.add(key);return true;}));
  total=Number.isInteger(data.total)&&data.total>=0?data.total:null;
  nextOffset+=50;hasMore=received.length>0&&(total!==null?nextOffset<total:received.length===50);
  render();
} catch (error) {
  if (currentRequest !== requestNumber) return;

  console.error('eSIM 상품 로딩 오류:', error);
  status.textContent = append?'다음 상품을 불러오지 못했습니다. 상품 더 보기를 눌러 다시 시도하세요.':'상품 정보를 불러오지 못했습니다.';
  if(!append)box.textContent='잠시 후 다시 시도해 주세요. 국가·기간 조건을 변경할 수도 있습니다.';
  if (retryButton) retryButton.hidden = false;
} finally {
  clearTimeout(timer);
  if (currentRequest === requestNumber) {loading=false;box.setAttribute('aria-busy','false');if(moreButton){moreButton.disabled=false;moreButton.hidden=!hasMore;}}
}

}

function searchProducts() {
  country = countrySelect.value;
  scopeAll=!!(countrySelect.dataset&&countrySelect.dataset.all==='true');
  days = Number(daysSelect.value);

  const nextUrl = new URL(window.location.href);
  if(country)nextUrl.searchParams.set('country',country);else nextUrl.searchParams.delete('country');
  if(scopeAll)nextUrl.searchParams.set('scope','all');else nextUrl.searchParams.delete('scope');
  if(days)nextUrl.searchParams.set('days',String(days));else nextUrl.searchParams.delete('days');
  nextUrl.searchParams.set('sort',sortSelect.value);
  if(unlimitedCheck.checked)nextUrl.searchParams.set('unlimited','true');else nextUrl.searchParams.delete('unlimited');
  Object.entries(extraFilters).forEach(([key,el])=>{if(el){const value=key==='localNumber'?(el.checked?'true':''):el.value;if(value)nextUrl.searchParams.set(key,value);else nextUrl.searchParams.delete(key);}});

  window.history.replaceState({}, '', nextUrl.toString());
  load();
}

if (retryButton) retryButton.addEventListener('click', ()=>load(false));
countrySelect.addEventListener('change', searchProducts);
daysSelect.addEventListener('change', searchProducts);

sortSelect.addEventListener('change', searchProducts);
unlimitedCheck.addEventListener('change', searchProducts);
Object.values(extraFilters).forEach(el=>{if(el)el.addEventListener('change',searchProducts)});
if(moreButton)moreButton.addEventListener('click',()=>load(true));
hotspotCheck.addEventListener('change', render);

load();
}
