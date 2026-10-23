(function(){
 'use strict';
 const root=document.getElementById('destination-tiles');
 const select=document.getElementById('search-country')||document.getElementById('country');
 const dialog=document.getElementById('destination-dialog');
 if(!root||!select||!dialog)return;
 const query=document.getElementById('destination-query'),results=document.getElementById('destination-results'),count=document.getElementById('destination-count');
 const inCatalog=!!document.getElementById('search-country');
 const popular=[['GLOBAL','글로벌','🌍'],['KR','한국','🏯'],['JP','일본','⛩️'],['US','미국','🗽'],['TH','태국','🛕'],['VN','베트남','🏝️'],['CN','중국','🐉'],['TW','대만','🏙️'],['SG','싱가포르','🦁'],['FR','프랑스','🗼']];
 function flag(code){return /^[A-Z]{2}$/.test(code)?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'🌐'}
 function target(code){const url=new URL('/esim',location.href);if(code&&code!=='GLOBAL')url.searchParams.set('country',code);else url.searchParams.set('scope','all');if(code==='GLOBAL')url.searchParams.set('multiCountry','true');const p=new URLSearchParams(location.search);['utm_source','utm_medium','utm_campaign','utm_content'].forEach(k=>{if(p.has(k))url.searchParams.set(k,p.get(k));});return url.pathname+url.search;}
 function choose(code){
  if(!inCatalog)return;
  const country=code==='GLOBAL'?'':code;
  if(country&&![...select.options].some(o=>o.value===country)){const o=document.createElement('option');o.value=country;o.textContent=popular.find(p=>p[0]===country)?.[1]||country;select.appendChild(o)}
  select.value=country;select.dataset.all=country?'false':'true';
  const multi=document.getElementById('coverage-type');if(multi)multi.value=code==='GLOBAL'?'true':'';
  select.dispatchEvent(new Event('change',{bubbles:true}));
  dialog.close();renderTiles();
  document.getElementById('title')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function card(code,name,icon,compact){
  const el=document.createElement(inCatalog?'button':'a');el.className=compact?'destination-option':'destination-tile';
  if(inCatalog){el.type='button';el.addEventListener('click',()=>choose(code));if(!compact)el.setAttribute('aria-pressed',String(select.value===code||(code==='GLOBAL'&&select.value===''&&document.getElementById('coverage-type')?.value==='true')))}else el.href=target(code);
  const visual=document.createElement('span');visual.className='destination-illustration';visual.textContent=icon||flag(code);visual.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.textContent=name;
  el.append(visual,label);return el;
 }
 function renderTiles(){root.replaceChildren(...popular.map(p=>card(...p,false)))}
 function renderResults(){const text=query.value.trim().toLowerCase();const options=[...select.options].filter(o=>o.value&&/^[A-Z]{2}$/.test(o.value)&&(o.textContent+' '+o.value).toLowerCase().includes(text));
  results.replaceChildren();if(!text)results.append(card('','전체 상품 보기','🌐',true));
  options.forEach(o=>results.append(card(o.value,o.textContent,flag(o.value),true)));
  count.textContent=text?(options.length+'개 여행지'):'국가·지역 '+options.length+'개 · 여행지를 선택하세요';
  if(!options.length){const p=document.createElement('p');p.className='destination-empty';p.textContent='검색 결과가 없습니다. 다른 이름이나 국가 코드로 검색해 주세요.';results.append(p)}
 }
 document.querySelectorAll('[data-open-destinations]').forEach(b=>b.addEventListener('click',()=>{renderResults();dialog.showModal();query.focus()}));
 document.getElementById('destination-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
 query.addEventListener('input',renderResults);select.addEventListener('change',renderTiles);
 new MutationObserver(()=>{if(dialog.open)renderResults();renderTiles()}).observe(select,{childList:true});
 renderTiles();
}());
