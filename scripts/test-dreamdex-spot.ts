import assert from 'node:assert/strict';

async function main(){
 const base=process.env.DREAMDEX_REST_URL||'https://stg.api.dreamdex.io/v0';
 const mr=await fetch(`${base}/markets`);assert.ok(mr.ok,`market discovery returned ${mr.status}`);const mj:any=await mr.json();const markets:any[]=mj.markets||mj.data||[];
 const market=markets.find(m=>String(m.base).toUpperCase()==='WBTC')||markets.find(m=>String(m.symbol).toUpperCase().includes('WBTC'));
 assert.ok(market,`WBTC market not found; available symbols: ${markets.map(m=>m.symbol).join(', ')}`);
 const symbol=String(market.symbol),url=`${base}/markets/${encodeURIComponent(symbol)}/candles?interval=15m&limit=100`;
 const r=await fetch(url);assert.ok(r.ok,`candle endpoint ${symbol} returned ${r.status}: ${await r.text()}`);const j:any=await r.json();const rows:any[]=j.candles||j.data||j;
 assert.ok(Array.isArray(rows)&&rows.length>=20,`expected real ${symbol} spot candles, received ${Array.isArray(rows)?rows.length:'non-array response'}`);
 const closes=rows.map(x=>Number(x.close??x[4])).filter(Number.isFinite);assert.ok(closes.length>=20&&closes.every(x=>x>1_000&&x<1_000_000),'BTC spot candles must be human-scale quote prices');
 console.log(`DreamDEX REST spot integration passed: ${symbol}, ${rows.length} 15m bars, latest close ${closes[closes.length-1]}`);
}
main().catch(e=>{console.error(e);process.exit(1)});
