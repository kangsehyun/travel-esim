const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const source = fs.readFileSync('src/index.js', 'utf8');
  const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  for (const host of ['travel-esim.rkdalstjd8921-cfa.workers.dev', 'www.travelsimple-esim.com']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await worker.fetch(new Request(`https://${host}/esim.html?country=JP&days=7&utm_source=tistory`, { method }), env);
      assert.equal(response.status, 301);
      assert.equal(response.headers.get('location'), 'https://travelsimple-esim.com/esim.html?country=JP&days=7&utm_source=tistory');
    }
    const response = await worker.fetch(new Request(`https://${host}/api/esims?country=JP`, { method: 'POST' }), env);
    assert.equal(response.status, 405);
    const invalid = await worker.fetch(new Request(`https://${host}/api/esims?country=INVALID`), { ...env, ESIMOA_API_KEY: 'test-only' });
    assert.equal(invalid.status, 400);
  }
  assert.equal(await (await worker.fetch(new Request('https://travelsimple-esim.com/'), env)).text(), 'asset');
  assert.equal(await (await worker.fetch(new Request('https://preview.example/'), env)).text(), 'asset');
  assert.equal(JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8')).assets.run_worker_first, true);
  console.log('Domain redirects preserve conditions, avoid loops, and retain API behavior.');
})();
