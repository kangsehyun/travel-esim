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
let country = (params.get('country') || 'JP').toUpperCase();
let days = Number(params.get('days') || 5);

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
if (!names[country]) country = 'JP';

if (![1, 3, 5, 7, 10, 15, 30].includes(days)) {
days = 5;
}

countrySelect.value = country;
daysSelect.value = String(days);

function updateHeading() {
title.textContent = names[country] + ' eSIM';
subtitle.textContent =
days + '일 여행에 맞는 실제 판매 상품을 비교하세요.';
if (guideLink) {
  const paths = {JP: 'japan', TW: 'taiwan', VN: 'vietnam', TH: 'thailand', US: 'usa'};
  guideLink.href = paths[country] + '-esim.html';
  guideLink.textContent = names[country] + ' eSIM 선택 가이드';
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

status.textContent = '조건에 맞는 상품 ' + items.length + '개';
box.innerHTML = '';

if (items.length === 0) {
  box.textContent = '조건에 맞는 상품이 없습니다. 필터를 변경해보세요.';
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
    '\n제공사: ' + (p.provider || '-');

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

  box.appendChild(article);
});


}

async function load() {
const currentRequest = ++requestNumber;
if (activeController) activeController.abort();
activeController = new AbortController();
const controller = activeController;
const timer = setTimeout(function () { controller.abort(); }, 15000);
allItems = [];
box.setAttribute('aria-busy', 'true');
if (retryButton) retryButton.hidden = true;


updateHeading();
status.textContent = '실시간 eSIM 상품을 불러오는 중입니다...';
box.innerHTML = '';

try {
  const response = await fetch(
    '/api/esims?country=' +
    encodeURIComponent(country) +
    '&days=' +
    encodeURIComponent(days),
    {signal: controller.signal}
  );

  const data = await response.json();

  if (currentRequest !== requestNumber) return;

  if (!response.ok || !data || data.success === false) {
    throw new Error((data && data.error) || 'API 오류 ' + response.status);
  }

  if (!Array.isArray(data.items)) throw new Error('Invalid product response');
  allItems = data.items.filter(function (item) { return item && typeof item === 'object' && !Array.isArray(item); });
  render();
} catch (error) {
  if (currentRequest !== requestNumber) return;

  console.error('eSIM 상품 로딩 오류:', error);
  status.textContent =
    '상품 정보를 불러오지 못했습니다.';
  box.textContent =
    '잠시 후 다시 시도해 주세요. 문제가 계속되면 여행 국가나 기간을 변경해 보세요.';
  if (retryButton) retryButton.hidden = false;
} finally {
  clearTimeout(timer);
  if (currentRequest === requestNumber) box.setAttribute('aria-busy', 'false');
}

}

function searchProducts() {
  country = countrySelect.value;
  days = Number(daysSelect.value);

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('country', country);
  nextUrl.searchParams.set('days', String(days));

  window.history.replaceState({}, '', nextUrl.toString());
  load();
}

if (retryButton) retryButton.addEventListener('click', load);
countrySelect.addEventListener('change', searchProducts);
daysSelect.addEventListener('change', searchProducts);

sortSelect.addEventListener('change', render);
unlimitedCheck.addEventListener('change', render);
hotspotCheck.addEventListener('change', render);

load();
}
