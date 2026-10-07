const ESIMOA_API = 'https://api.esimoa.com/v1';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/esims') {
      return handleEsims(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleEsims(request, env, url) {
  if (request.method !== 'GET') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  if (!env.ESIMOA_API_KEY) {
    return json({ success: false, error: 'ESIMOA_API_KEY is not configured' }, 500);
  }

  const country = (url.searchParams.get('country') || '').toUpperCase();
  const days = Number(url.searchParams.get('days') || '');

  if (!/^[A-Z]{2}$/.test(country)) {
    return json({ success: false, error: 'Invalid country code' }, 400);
  }

  const params = new URLSearchParams({
    country,
    lang: 'ko',
    sort: 'recommended',
    limit: '50',
  });

  if (Number.isInteger(days) && days >= 1 && days <= 365) {
    params.set('days', String(days));
  }

  const response = await fetch(`${ESIMOA_API}/esims?${params.toString()}`, {
    headers: {
      'X-API-Key': env.ESIMOA_API_KEY,
      Accept: 'application/json',
    },
  });

  const text = await response.text();

  if (!response.ok) {
    return new Response(text || JSON.stringify({ success: false, error: `esimoa API ${response.status}` }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
