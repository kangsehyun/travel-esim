/* Country availability comes from the same live catalogue as product search. */
(function(){
 'use strict';
 const selects=['country','search-country'].map(id=>document.getElementById(id)).filter(Boolean);
 const directory=document.getElementById('all-countries');
 const status=document.getElementById('country-load-status');
 const search=document.getElementById('country-search');
 if(!selects.length&&!directory)return;
 let countries=[];
 function render(){
  if(!directory)return;
  const q=(search?search.value:'').trim().toLowerCase();directory.textContent='';
  const items=countries.filter(c=>(c.name+' '+c.countryCode).toLowerCase().includes(q));
  items.forEach(c=>{
   const a=document.createElement('a');a.className='catalog-country';
   const url=new URL('esim.html',window.location.href);url.searchParams.set('country',c.countryCode);
   // Preserve only approved campaign tags; never copy arbitrary query values.
   const tags=new URLSearchParams(window.location.search);['utm_source','utm_medium','utm_campaign','utm_content'].forEach(k=>{if(tags.has(k))url.searchParams.set(k,tags.get(k));});
   a.href=url.pathname+url.search;
   const name=document.createElement('strong');name.textContent=c.name+' · '+c.countryCode;
   const detail=document.createElement('span');detail.textContent=(Number.isInteger(c.planCount)?c.planCount+'개 상품':'상품 보기')+(typeof c.lowestPriceKrw==='number'&&c.lowestPriceKrw>0?' · '+c.lowestPriceKrw.toLocaleString('ko-KR')+'원부터':'');
   a.appendChild(name);a.appendChild(detail);directory.appendChild(a);
  });
  if(status)status.textContent='판매 국가 '+countries.length+'개 · 현재 표시 '+items.length+'개. 최종 조건·가격은 구매 페이지에서 확인하세요.';
 }
 async function load(){
  try{
   const response=await fetch('/api/countries',{signal:AbortSignal.timeout(15000)});const data=await response.json();
   if(!response.ok||data.success===false||!Array.isArray(data.items))throw Error('countries');
   countries=data.items.filter(c=>c&&/^[A-Z]{2}$/.test(c.countryCode)&&typeof c.name==='string').sort((a,b)=>a.name.localeCompare(b.name,'ko'));
   selects.forEach(el=>{
    const selected=el.value;el.textContent='';
    const all=document.createElement('option');all.value='';all.textContent='전체 국가';el.appendChild(all);
    countries.forEach(c=>{const o=document.createElement('option');o.value=c.countryCode;o.textContent=c.name;el.appendChild(o)});
    if(selected&&!countries.some(c=>c.countryCode===selected)){const o=document.createElement('option');o.value=selected;o.textContent=selected+' (상품 조회로 확인)';el.appendChild(o)}
    el.value=selected;
   });
   if(status)status.textContent='판매 국가 '+countries.length+'개 조회 완료';render();
  }catch(_){
   if(status)status.textContent='전체 국가를 불러오지 못했습니다. 기존 국가 검색은 이용할 수 있습니다.';
   if(status){const button=document.createElement('button');button.type='button';button.textContent='국가 다시 불러오기';button.addEventListener('click',load);status.appendChild(button);}
  }
 }
 if(search)search.addEventListener('input',render);load();
}());
