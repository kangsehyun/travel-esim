const ESIMOA_API = 'https://api.esimoa.com/v1';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Keep deep links and search conditions when moving to the public domain.
    if (['travel-esim.rkdalstjd8921-cfa.workers.dev', 'www.travelsimple-esim.com'].includes(url.hostname) && ['GET', 'HEAD'].includes(request.method) && !url.pathname.startsWith('/api/')) {
      url.protocol = 'https:';
      url.host = 'travelsimple-esim.com';
      return Response.redirect(url.toString(), 301);
    }

    if (['/api/esims', '/api/countries'].includes(url.pathname)) {
      return handleCatalog(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleCatalog(request, env, url) {
  if (request.method !== 'GET') return json({ success: false, error: 'Method not allowed' }, 405);
  if (!env.ESIMOA_API_KEY) return json({ success: false, error: '상품 연결을 사용할 수 없습니다.' }, 503);
  const params = new URLSearchParams({ lang: 'ko' });
  const countriesRequest = url.pathname === '/api/countries';
  if (countriesRequest) {
    const q = url.searchParams.get('q');
    if (q && q.length > 100) return json({success:false,error:'Invalid query'},400);
    if (q) params.set('q', q);
  } else {
    const country = (url.searchParams.get('country') || '').toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) return json({success:false,error:'Invalid country code'},400);
    if (country) params.set('country', country);
    for (const key of ['days','minDays','maxDays','minPriceKrw','maxPriceKrw','offset']) {
      const value = url.searchParams.get(key);
      if (value === null || value === '') continue;
      const max = ['days','minDays','maxDays'].includes(key) ? 365 : key === 'offset' ? 1000000 : 100000000;
      if (!/^\d+$/.test(value) || Number(value) > max || (key !== 'offset' && Number(value) < 1) || (key === 'offset' && Number(value)%50 !== 0)) return json({success:false,error:'Invalid '+key},400);
      params.set(key, value);
    }
    for (const key of ['unlimited','localNumber','multiCountry']) {
      const value=url.searchParams.get(key);
      if(value===null||value==='')continue;
      if(!['true','false'].includes(value))return json({success:false,error:'Invalid '+key},400);
      params.set(key,value);
    }
    for (const [key,allowed] of Object.entries({sort:['recommended','price','data','price_per_gb','validity'],dataType:['daily','total'],network:['local','roaming']})) {
      const value=url.searchParams.get(key);
      if(value&&!allowed.includes(value))return json({success:false,error:'Invalid '+key},400);
      if(value)params.set(key,value);
    }
    params.set('limit','50');
    if(!params.has('sort'))params.set('sort','recommended');
  }
  try {
    const response = await fetch(`${ESIMOA_API}/${countriesRequest?'countries':'esims'}?${params}`, {
      headers:{'X-API-Key':env.ESIMOA_API_KEY,Accept:'application/json'}, signal:AbortSignal.timeout(12000)
    });
    if(!response.ok)return json({success:false,error:response.status===429?'조회가 많습니다. 잠시 후 다시 시도해 주세요.':'상품 공급사 조회에 실패했습니다.'},response.status===429?429:502);
    const data=await response.json();
    if(data.success===false||!Array.isArray(data.items))return json({success:false,error:'상품 응답을 확인할 수 없습니다.'},502);
    return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=120'}});
  } catch (_) { return json({success:false,error:'상품 조회가 지연되고 있습니다. 다시 시도해 주세요.'},502); }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}
