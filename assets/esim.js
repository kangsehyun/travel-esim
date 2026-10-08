
const names = {
  JP: '일본',
  TW: '대만',
  VN: '베트남',
  TH: '태국',
  US: '미국'
};

const params = new URLSearchParams(location.search);
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
const searchButton = document.getElementById('search-esim');

let allItems = [];

countrySelect.value = names[country] ? country : 'JP';
daysSelect.value = [1, 3, 5, 7, 10, 15, 30].includes(days)
  ? String(days)
  : '5';

function updateHeading() {
  title.textContent = `${names[country] || country} eSIM`;
  subtitle.textContent = `${days}일 여행에 맞는 실제 판매 상품을 비교하세요.`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[c]);
}

function render() {
  let items = [...allItems];

  if (unlimitedCheck.checked) {
    items = items.filter(p => p.isUnlimited === true);
  }

  if (hotspotCheck.checked) {
    items = items.filter(p => p.hotspot === true);
  }

  if (sortSelect.value === 'price-asc') {
    items.sort((a, b) => a.priceKrw - b.priceKrw);
  } else if (sortSelect.value === 'price-desc') {
    items.sort((a, b) => b.priceKrw - a.priceKrw);
  }

  status.textContent = `조건에 맞는 상품 ${items.length}개`;

  if (items.length === 0) {
    box.innerHTML = '<p>조건에 맞는 상품이 없습니다. 필터를 변경해보세요.</p>';
    return;
  }

  box.innerHTML = items.map((p, i) => `
    <article class="product-card">
      <span class="eyebrow">${i < 3 ? '추천 상품' : 'eSIM'}</span>
      <h3>${esc(p.title)}</h3>
      <p class="meta">
        데이터: ${esc(p.dataAmount)}<br>
        이용기간: ${esc(p.validityDays)}일<br>
        통신망: ${esc(p.networkType || '-')} ·
        ${p.isLocalNetwork ? '현지망' : '로밍'}<br>
        핫스팟: ${p.hotspot ? '가능' : '불가'}<br>
        제공사: ${esc(p.provider || '-')}
      </p>
      <strong class="price">
        ${Number(p.priceKrw || 0).toLocaleString('ko-KR')}원
      </strong>
      <a class="buy"
         href="${esc(p.url)}"
         target="_blank"
         rel="noopener noreferrer">
        구매 페이지 보기
      </a>
    </article>
  `).join('');
}

async function load() {
  updateHeading();
  status.textContent = '실시간 eSIM 상품을 불러오는 중입니다...';
  box.innerHTML = '';

  try {
    const response = await fetch(
      `/api/esims?country=${encodeURIComponent(country)}&days=${encodeURIComponent(days)}`
    );

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(data.error || `API 오류 ${response.status}`);
    }

    allItems = Array.isArray(data.items) ? data.items : [];
    render();
  } catch (error) {
    console.error(error);
    allItems = [];
    status.textContent = '상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
  }
}

searchButton.addEventListener('click', () => {
  country = countrySelect.value;
  days = Number(daysSelect.value);

  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set('country', country);
  nextUrl.searchParams.set('days', String(days));
  history.replaceState({}, '', nextUrl);

  load();
});

sortSelect.addEventListener('change', render);
unlimitedCheck.addEventListener('change', render);
hotspotCheck.addEventListener('change', render);

load();
