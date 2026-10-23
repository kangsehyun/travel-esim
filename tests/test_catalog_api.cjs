const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('src/index.js')).toString('base64'));
const env={ESIMOA_API_KEY:'test-secret-never-return',ASSETS:{fetch:async()=>new Response('asset')}};
let upstream;global.fetch=async(url,options)=>{upstream={url:new URL(url),options};return Response.json({success:true,items:[{id:'one',url:'https://www.esimoa.com/ko/plans/x?ref=test'}],total:130,limit:50,offset:Number(new URL(url).searchParams.get('offset')||0)})};
const call=q=>worker.fetch(new Request('https://travelsimple-esim.com'+q),env);
assert.equal((await call('/api/esims')).status,200);assert.equal(upstream.url.searchParams.has('country'),false);assert.equal(upstream.url.searchParams.has('days'),false);
assert.equal((await call('/api/esims?country=FR&offset=100&sort=price&dataType=daily&multiCountry=true&localNumber=true&network=local')).status,200);
assert.equal(upstream.url.searchParams.get('offset'),'100');assert.equal(upstream.url.searchParams.get('country'),'FR');assert.equal(upstream.url.searchParams.get('limit'),'50');assert.equal(upstream.url.searchParams.get('network'),'local');assert.equal(upstream.options.headers['X-API-Key'],env.ESIMOA_API_KEY);
for(const query of ['country=INVALID','offset=1','offset=-50','days=0','days=366','sort=evil','multiCountry=maybe','network=5G'])assert.equal((await call('/api/esims?'+query)).status,400,query);
assert.equal((await call('/api/countries?q=프랑스')).status,200);assert.equal(upstream.url.pathname,'/v1/countries');assert.equal(upstream.url.searchParams.get('q'),'프랑스');
global.fetch=async()=>new Response('test-secret-never-return upstream error',{status:500});const failed=await call('/api/esims');assert.equal(failed.status,502);assert(!(await failed.text()).includes('test-secret'));
global.fetch=async()=>{throw Error('timeout')};assert.equal((await call('/api/countries')).status,502);
global.fetch=async()=>Response.json({unexpected:true});assert.equal((await call('/api/esims')).status,502);
console.log('Full catalog API: unfiltered access, all-country queries, paging, filters, validation and sanitized failures: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
