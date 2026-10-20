/* TravelSimple GA4: no Google requests before optional analytics consent. */
(function () {
  'use strict';
  const id = 'G-1RLBXT6L9D';
  const consentKey = 'travelsimple-analytics-consent-v1';
  let enabled = false;
  let initialized = false;
  let panel;
  function choice() { try { return localStorage.getItem(consentKey); } catch (_) { return null; } }
  function save(value) { try { localStorage.setItem(consentKey, value); } catch (_) {} }
  function pageUrl() {
    const url = new URL(location.pathname, location.origin);
    const params = new URLSearchParams(location.search);
    const rules = {country: /^(JP|TW|VN|TH|US)$/, days: /^\d{1,3}$/, utm_source: /^tistory$/, utm_medium: /^blog$/, utm_campaign: /^post-\d+$/};
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
    style.textContent = '.ts-analytics-panel{position:fixed;bottom:56px;left:12px;right:12px;max-width:620px;margin:auto;padding:18px;background:#fff;color:#172033;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 4px 24px #0002;z-index:1000;font:14px/1.6 Arial,sans-serif}.ts-analytics-panel[hidden]{display:none}.ts-analytics-panel button,.ts-analytics-settings{cursor:pointer;padding:8px 14px;border:1px solid #64748b;border-radius:6px;background:#fff;color:#172033;margin:4px}.ts-analytics-settings{position:fixed;bottom:8px;right:8px;z-index:999;font-size:12px}.ts-analytics-panel a{color:#1d4ed8;text-decoration:underline}';
    document.head.appendChild(style);
    panel = document.createElement('section');
    panel.className = 'ts-analytics-panel';
    panel.setAttribute('aria-label', '방문 통계 설정');
    const text = document.createElement('p');
    text.textContent = '방문 통계를 허용하면 Google Analytics로 방문 경로와 상품 링크 클릭을 분석합니다. 거부해도 상품 비교를 이용할 수 있습니다.';
    const privacy = document.createElement('a'); privacy.href = '/privacy.html'; privacy.textContent = '개인정보처리방침';
    const yes = document.createElement('button'); yes.type = 'button'; yes.textContent = '통계 허용'; yes.addEventListener('click', function () { choose('granted'); });
    const no = document.createElement('button'); no.type = 'button'; no.textContent = '거부'; no.addEventListener('click', function () { choose('denied'); });
    panel.append(text, privacy, yes, no);
    panel.hidden = choice() === 'granted' || choice() === 'denied';
    const settings = document.createElement('button'); settings.type = 'button'; settings.className = 'ts-analytics-settings'; settings.textContent = '통계 설정'; settings.addEventListener('click', function () { panel.hidden = !panel.hidden; if (!panel.hidden) no.focus(); });
    document.body.append(panel, settings);
    if (choice() === 'granted') start();
  }
  document.addEventListener('click', function (event) {
    const link = event.target.closest && event.target.closest('.product-card a.buy');
    if (!enabled || !link) return;
    let url;
    try { url = new URL(link.href); } catch (_) { return; }
    if (url.protocol !== 'https:' || !['www.esimoa.com', 'esimoa.com'].includes(url.hostname)) return;
    const params = new URLSearchParams(location.search);
    window.gtag('event', 'esim_purchase_click', {country: /^(JP|TW|VN|TH|US)$/.test(params.get('country') || '') ? params.get('country') : 'JP', travel_days: Number(params.get('days')) || 5, link_domain: url.hostname, link_path: url.pathname, page_location: pageUrl(), transport_type: 'beacon'});
    // Keep the original link, new-tab behavior and eSIMOA referral parameters.
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
}());
