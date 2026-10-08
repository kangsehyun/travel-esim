<WritingBlock id="63814" variant="document">const names = { JP: '일본', TW: '대만', VN: '베트남', TH: '태국', US: '미국' };

const params = new URLSearchParams(window.location.search); let country = (params.get('country') || 'JP').toUpperCase(); let days = Number(params.get('days') || 5);

const title = document.getElementById('title'); const subtitle = document.getElementById('subtitle'); const status = document.getElementById('status'); const box = document.getElementById('products');

const sortSelect = document.getElementById('sort'); const unlimitedCheck = document.getElementById('unlimited'); const hotspotCheck = document.getElementById('hotspot'); const countrySelect = document.getElementById('search-country'); const daysSelect = document.getElementById('search-days');

let allItems = []; let requestNumber = 0;

countrySelect.value = names[country] ? country : 'JP';

if (![1, 3, 5, 7, 10, 15, 30].includes(days)) { days = 5; }

daysSelect.value = String(days);

function updateHeading() { title.textContent = (names[country] || country) + ' eSIM'; subtitle.textContent = days + '일 여행에 맞는 실제 판매 상품을 비교하세요.'; }

function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (c) { return { '&': '&', '<': '<', '>': '>', "'": ''', '"': '"' }[c]; }); }

function render() { let items = allItems.slice();

if (unlimitedCheck.checked) { items = items.filter(function (p) { return p.isUnlimited === true; }); }

if (hotspotCheck.checked) { items = items.filter(function (p) { return p.hotspot === true; }); }

if (sortSelect.value === 'price-asc') { items.sort(function (a, b) { return Number(a.priceKrw || 0) - Number(b.priceKrw || 0); }); } else if (sortSelect.value === 'price-desc') { items.sort(function (a, b) { return Number(b.priceKrw || 0) - Number(a.priceKrw || 0); }); }

status.textContent = '조건에 맞는 상품 ' + items.length + '개';

if (items.length === 0) { box.innerHTML = '<p>조건에 맞는 상품이 없습니다. 필터를 변경해보세요.</p>'; return; }

box.innerHTML = items.map(function (p, i) { const article = document.createElement('article'); article.className = 'product-card';

const label = document.createElement('span'); label.className = 'eyebrow'; label.textContent = i < 3 ? '추천 상품' : 'eSIM';

const heading = document.createElement('h3'); heading.textContent = p.title || 'eSIM 상품';

const meta = document.createElement('p'); meta.className = 'meta'; meta.textContent = '데이터: ' + (p.dataAmount || '-') + '\n이용기간: ' + (p.validityDays || '-') + '일' + '\n통신망: ' + (p.networkType || '-') + ' · ' + (p.isLocalNetwork ? '현지망' : '로밍') + '\n핫스팟: ' + (p.hotspot ? '가능' : '불가') + '\n제공사: ' + (p.provider || '-');

const price = document.createElement('strong'); price.className = 'price'; price.textContent = Number(p.priceKrw || 0).toLocaleString('ko-KR') + '원';

const link = document.createElement('a'); link.className = 'buy'; link.href = p.url || '#'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '구매 페이지 보기';

article.appendChild(label); article.appendChild(heading); article.appendChild(meta); article.appendChild(price); article.appendChild(link);

return article; }).forEach(function (article) { box.appendChild(article); }); }

async function load() { const currentRequest = ++requestNumber;

updateHeading(); status.textContent = '실시간 eSIM 상품을 불러오는 중입니다...'; box.innerHTML = '';

try { const response = await fetch( '/api/esims?country=' + encodeURIComponent(country) + '&days=' + encodeURIComponent(days) );

const data = await response.json();

if (currentRequest !== requestNumber) { return; }

if (!response.ok || data.success === false) { throw new Error(data.error || 'API 오류 ' + response.status); }

allItems = Array.isArray(data.items) ? data.items : []; render(); } catch (error) { if (currentRequest !== requestNumber) { return; }

console.error('eSIM 상품 로딩 오류:', error); allItems = []; status.textContent = '상품을 불러오지 못했습니다. 페이지를 새로고침해주세요.'; } }

function searchProducts() { country = countrySelect.value; days = Number(daysSelect.value);

const nextUrl = new URL(window.location.href); nextUrl.searchParams.set('country', country); nextUrl.searchParams.set('days', String(days));

window.history.replaceState({}, '', nextUrl.toString()); load(); }

countrySelect.addEventListener('change', searchProducts); daysSelect.addEventListener('change', searchProducts);

sortSelect.addEventListener('change', render); unlimitedCheck.addEventListener('change', render); hotspotCheck.addEventListener('change', render);

load();</WritingBlock>
