/* TravelSimple GA4: no Google requests before optional analytics consent. */
(function () {
  'use strict';
  const id = 'G-1RLBXT6L9D';
  const consentKey = 'travelsimple-analytics-consent-v2';
  const noticeVersion = '2026-10-20';
  let enabled = false;
  let initialized = false;
  let panel;
  function choice() { try { const record = JSON.parse(localStorage.getItem(consentKey)); return record && record.version === noticeVersion && ['granted', 'denied'].includes(record.choice) ? record.choice : null; } catch (_) { return null; } }
  function save(value) { try { localStorage.setItem(consentKey, JSON.stringify({choice: value, version: noticeVersion, at: new Date().toISOString()})); } catch (_) {} }
  function pageUrl() {
    const url = new URL(location.pathname, location.origin);
    const params = new URLSearchParams(location.search);
    // Preserve only our published campaign vocabulary, never arbitrary query values.
    const rules = {
      country: /^(?!ZZ$)[A-Z]{2}$/,
      days: /^\d{1,3}$/,
      utm_source: /^(tistory|instagram|threads|youtube)$/,
      utm_medium: /^(blog|social)$/,
      utm_campaign: /^(post-\d+|profile|shorts-launch|(?:launch|ig|reel|threads|shorts|shorts-launch)-\d{8})$/
    };
    Object.keys(rules).forEach(function (key) { const value = params.get(key); if (value && rules[key].test(value)) url.searchParams.set(key, value); });
    return url.href;
  }
  function start() {
    if (enabled) return;
    enabled = true;
    window['ga-disable-' + id] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', initialized ? 'update' : 'default', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    if (initialized) return;
    initialized = true;
    window.gtag('js', new Date());
    let referrer = '';
    try { referrer = new URL(document.referrer).origin; } catch (_) {}
    window.gtag('config', id, {page_location: pageUrl(), page_referrer: referrer, cookie_domain: 'none', cookie_expires: 7776000, allow_google_signals: false, allow_ad_personalization_signals: false});
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(script);
  }
  function stop() {
    enabled = false;
    window['ga-disable-' + id] = true;
    if (window.gtag) window.gtag('consent', 'update', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    document.cookie.split(';').forEach(function (part) {
      const name = part.trim().split('=')[0];
      if (/^_ga(?:_|$)/.test(name)) {
        document.cookie = name + '=; Max-Age=0; path=/';
        document.cookie = name + '=; Max-Age=0; path=/; domain=' + location.hostname;
      }
    });
  }
  function choose(value) {
    save(value);
    if (value === 'granted') start(); else stop();
    panel.hidden = true;
  }
  function render() {
    const style = document.createElement('style');
    style.textContent = '.ts-analytics-panel{position:fixed;bottom:56px;left:12px;right:12px;max-width:620px;max-height:70vh;overflow:auto;margin:auto;padding:18px;background:#fff;color:#172033;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 4px 24px #0002;z-index:1000;font:14px/1.6 Arial,sans-serif}.ts-analytics-panel[hidden]{display:none}.ts-analytics-panel button,.ts-analytics-settings{cursor:pointer;padding:8px 14px;border:1px solid #64748b;border-radius:6px;background:#fff;color:#172033;margin:4px}.ts-analytics-settings{position:fixed;bottom:8px;right:8px;z-index:999;font-size:12px}.ts-analytics-panel a{color:#1d4ed8;text-decoration:underline}.ts-analytics-panel label{display:block;margin:10px 0}.ts-analytics-panel button:disabled{cursor:not-allowed;opacity:.5}.ts-analytics-panel button,.ts-analytics-settings{min-height:44px}.ts-analytics-panel{overscroll-behavior:contain}.ts-analytics-panel>p{margin:0 0 8px}.ts-analytics-panel summary{min-height:44px;cursor:pointer;font-weight:700;padding:10px 0}.ts-analytics-panel input{width:18px;height:18px;vertical-align:middle}@media(max-width:700px){.ts-analytics-panel{bottom:64px;max-height:48vh;max-height:48dvh;padding:16px;font-size:14px;overflow-wrap:anywhere}.ts-analytics-panel button{margin:4px 2px;padding:10px 12px;font-size:14px}.ts-analytics-settings{bottom:max(8px,env(safe-area-inset-bottom));font-size:13px}}';
    document.head.appendChild(style);
    panel = document.createElement('section');
    panel.className = 'ts-analytics-panel';
    panel.setAttribute('aria-label', '방문 통계 설정');
    const text = document.createElement('p');
    text.textContent = '방문 통계는 선택 사항입니다. 두 동의 항목을 각각 확인한 뒤 허용해 주세요. 거부해도 상품 비교를 이용할 수 있습니다. 만 14세 미만은 통계를 허용하지 말아 주세요.';
    const privacy = document.createElement('a'); privacy.href = '/privacy.html'; privacy.textContent = '개인정보처리방침';
    const collectionLabel = document.createElement('label');
    const collection = document.createElement('input'); collection.type = 'checkbox';
    collectionLabel.append(collection, ' [선택] 방문·유입·기기 정보, 쿠키 식별자, 스크롤·링크 클릭의 통계 수집·이용에 동의합니다. 목적: 서비스 개선. 사용자·이벤트 데이터 보관 설정: 각 2개월(집계 보고서 제외).');
    const overseasLabel = document.createElement('label');
    const overseas = document.createElement('input'); overseas.type = 'checkbox';
    overseasLabel.append(overseas, ' [선택] 위 통계·통신 정보를 Google LLC에 국외 처리하는 데 동의합니다. 미국 등 Google 데이터센터 소재 국가로 동의 후 이용 시 암호화 전송되며, 통계 분석에 사용됩니다. 국가 목록·연락처·삭제 기준은 아래 방침 4항을 확인하세요.');
    const yes = document.createElement('button'); yes.type = 'button'; yes.textContent = '통계 허용'; yes.disabled = true;
    const update = function () { yes.disabled = !(collection.checked && overseas.checked); };
    collection.addEventListener('change', update); overseas.addEventListener('change', update);
    yes.addEventListener('click', function () { if (collection.checked && overseas.checked) choose('granted'); });
    const no = document.createElement('button'); no.type = 'button'; no.textContent = '거부'; no.addEventListener('click', function () { collection.checked = false; overseas.checked = false; update(); choose('denied'); });
    const intro = document.createElement('p');
    intro.textContent = '방문 통계는 선택 사항입니다. 거부해도 상품 비교를 이용할 수 있습니다.';
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '통계 수집 항목 확인·설정';
    details.append(summary, text, collectionLabel, overseasLabel, privacy, yes);
    panel.append(intro, details, no);
    panel.hidden = choice() === 'granted' || choice() === 'denied';
    const settings = document.createElement('button'); settings.type = 'button'; settings.className = 'ts-analytics-settings'; settings.textContent = '통계 설정'; settings.addEventListener('click', function () { panel.hidden = !panel.hidden; if (!panel.hidden) no.focus(); });
    document.body.append(panel, settings);
    if (choice() === 'granted') start(); else stop();
  }
  document.addEventListener('click', function (event) {
    const link = event.target.closest && event.target.closest('.product-card a.buy');
    if (!enabled || !link) return;
    let url;
    try { url = new URL(link.href); } catch (_) { return; }
    if (url.protocol !== 'https:' || !['www.esimoa.com', 'esimoa.com'].includes(url.hostname)) return;
    const params = new URLSearchParams(location.search);
    const details = {link_domain: url.hostname, link_path: url.pathname, page_location: pageUrl(), transport_type: 'beacon'};
    const selectedCountry = params.get('country') || '';
    const selectedDays = params.get('days') || '';
    if (/^(?!ZZ$)[A-Z]{2}$/.test(selectedCountry)) details.country = selectedCountry;
    if (/^\d{1,3}$/.test(selectedDays) && Number(selectedDays) > 0 && Number(selectedDays) <= 365) details.travel_days = Number(selectedDays);
    // Missing filters mean all countries/periods, never an assumed Japan five-day trip.
    window.gtag('event', 'esim_purchase_click', details);
    // Keep the original link, new-tab behavior and eSIMOA referral parameters.
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
}());
