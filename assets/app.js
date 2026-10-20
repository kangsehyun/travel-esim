/* Native GET form handles search; JS keeps guide and country links in sync. */
(function () {
  'use strict';
  const countries = {
    JP: {name: '일본', guide: 'japan-esim.html'},
    TW: {name: '대만', guide: 'taiwan-esim.html'},
    VN: {name: '베트남', guide: 'vietnam-esim.html'},
    TH: {name: '태국', guide: 'thailand-esim.html'},
    US: {name: '미국', guide: 'usa-esim.html'}
  };
  const allowedDays = [3, 5, 7, 10, 15, 30];
  const form = document.getElementById('esim-search');
  const country = document.getElementById('country');
  const browseDays = document.getElementById('browse-days');
  const guide = document.getElementById('selected-country-guide');
  const summary = document.getElementById('selection-summary');
  const productLinks = document.querySelectorAll('.trip-product-link[data-trip-country]');
  function refresh() {
    const selected = document.querySelector('input[name="days"]:checked');
    const rawDays = Number(browseDays ? browseDays.value : selected ? selected.value : 5);
    const days = allowedDays.includes(rawDays) ? rawDays : 5;
    const selectedCountry = countries[country && country.value] || countries.JP;
    if (guide) {
      guide.href = selectedCountry.guide;
      guide.textContent = '먼저 ' + selectedCountry.name + ' eSIM 선택 기준 보기 →';
    }
    productLinks.forEach(function (link) {
      const code = link.dataset.tripCountry;
      if (!countries[code]) return;
      link.href = 'esim.html?country=' + code + '&days=' + days;
      link.textContent = countries[code].name + ' ' + days + '일 상품 비교 →';
    });
    if (summary) summary.textContent = form
      ? selectedCountry.name + ' · ' + days + '일 조건으로 조회합니다.'
      : '아래 상품 링크는 ' + days + '일 조건으로 조회합니다.';
  }
  if (form) form.addEventListener('change', refresh);
  if (browseDays) browseDays.addEventListener('change', refresh);
  window.addEventListener('pageshow', refresh);
  refresh();
}());
