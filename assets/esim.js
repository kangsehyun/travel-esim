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
}

function render() {
let items = allItems.slice();

```
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
    return Number(a.priceKrw || 0) - Number(b.priceKrw || 0);
  });
} else if (sortSelect.value === 'price-desc') {
  items.sort(function (a, b) {
    return Number(b.priceKrw || 0) - Number(a.priceKrw || 0);
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
  label.textContent = i < 3 ? '추천 상품' : 'eSIM';

  const heading = document.createElement('h3');
  heading.textContent = p.title || 'eSIM 상품';

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent =
    '데이터: ' + (p.dataAmount || '-') +
    '\n이용기간: ' + (p.validityDays || '-') + '일' +
    '\n통신망: ' + (p.networkType || '-') +
    ' · ' + (p.isLocalNetwork ? '현지망' : '로밍') +
    '\n핫스팟: ' + (p.hotspot ? '가능' : '불가') +
    '\n제공사: ' + (p.provider || '-');

  const price = document.createElement('strong');
  price.className = 'price';
  price.textContent =
    Number(p.priceKrw || 0).toLocaleString('ko-KR') + '원';

  const link = document.createElement('a');
  link.className = 'buy';
  link.textContent = '구매 페이지 보기';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  if (p.url) {
    link.href = p.url;
  } else {
    link.href = '#';
    link.addEventListener('click', function (event) {
      event.preventDefault();
      alert('이 상품은 구매 링크가 없습니다.');
    });
  }

  article.appendChild(label);
  article.appendChild(heading);
  article.appendChild(meta);
  article.appendChild(price);
  article.appendChild(link);

  box.appendChild(article);
});
```

}

async function load() {
const currentRequest = ++requestNumber;

```
updateHeading();
status.textContent = '실시간 eSIM 상품을 불러오는 중입니다...';
box.innerHTML = '';

try {
  const response = await fetch(
    '/api/esims?country=' +
    encodeURIComponent(country) +
    '&days=' +
    encodeURIComponent(days)
  );

  const data = await response.json();

  if (currentRequest !== requestNumber) return;

  if (!response.ok || data.success === false) {
    throw new Error(data.error || 'API 오류 ' + response.status);
  }

  allItems = Array.isArray(data.items) ? data.items : [];
  render();
} catch (error) {
  if (currentRequest !== requestNumber) return;

  console.error('eSIM 상품 로딩 오류:', error);
  status.textContent =
    '상품을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.';
  box.textContent =
    '오류가 발생했습니다. 브라우저 Console의 오류 메시지를 확인해주세요.';
}
```

}

<WritingBlock id="72518" variant="document">function searchProducts() {
  country = countrySelect.value;
  days = Number(daysSelect.value);

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('country', country);
  nextUrl.searchParams.set('days', String(days));

  window.history.replaceState({}, '', nextUrl.toString());
  load();
}

countrySelect.addEventListener('change', searchProducts);
daysSelect.addEventListener('change', searchProducts);

sortSelect.addEventListener('change', render);
unlimitedCheck.addEventListener('change', render);
hotspotCheck.addEventListener('change', render);

load();
}</WritingBlock>
