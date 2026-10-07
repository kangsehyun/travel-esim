const names={JP:'일본',TW:'대만',VN:'베트남',TH:'태국',US:'미국'};
const q=new URLSearchParams(location.search);
const country=(q.get('country')||'JP').toUpperCase();
const days=Number(q.get('days')||5);

document.getElementById('title').textContent=`${names[country]||country} eSIM`;
document.getElementById('subtitle').textContent=`${days}일 여행에 맞는 실제 판매 상품을 확인하세요.`;

const status=document.getElementById('status');
const box=document.getElementById('products');

function esc(value){
  return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function render(items){
  if(!items.length){
    status.textContent='선택한 기간에 맞는 상품이 없습니다. 다른 기간을 선택해보세요.';
    box.innerHTML='';
    return;
  }
  status.textContent=`실시간 판매 상품 ${items.length}개를 불러왔습니다.`;
  box.innerHTML=items.map((p,i)=>`
    <article class="product-card">
      <span class="eyebrow">${i<3?'추천':'eSIM'}</span>
      <h3>${esc(p.title)}</h3>
      <p class="meta">
        데이터: ${esc(p.dataAmount)}<br>
        이용기간: ${esc(p.validityDays)}일<br>
        통신망: ${esc(p.networkType||'-')} · ${p.isLocalNetwork?'현지망':'로밍'}<br>
        핫스팟: ${p.hotspot?'가능':'확인 필요'}
      </p>
      <strong class="price">${Number(p.priceKrw||0).toLocaleString('ko-KR')}원</strong>
      <a class="buy" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">구매 페이지 보기</a>
    </article>`).join('');
}

async function load(){
  status.textContent='실시간 eSIM 상품을 불러오는 중입니다...';
  box.innerHTML='';
  try{
    const res=await fetch(`/api/esims?country=${encodeURIComponent(country)}&days=${encodeURIComponent(days)}`);
    const data=await res.json();
    if(!res.ok || data.success===false) throw new Error(data.error||`API 오류 ${res.status}`);
    render(Array.isArray(data.items)?data.items:[]);
  }catch(err){
    console.error(err);
    status.textContent='상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
    box.innerHTML=`<article class="product-card"><h3>일시적인 오류</h3><p class="meta">eSIM 상품 정보를 가져오는 중 문제가 발생했습니다.</p></article>`;
  }
}

load();
