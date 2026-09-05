import assert from 'node:assert/strict';
import {createReadExchange} from '../lib/dreamdex';

async function main(){
 const exchange:any=createReadExchange();
 try{
  const rows:any[]=await exchange.client.listBinaryMarkets({status:'Finalized',asset:'BTC',intervalSec:900,orderBy:'tradeCount',limit:80,offset:0} as any);
  assert.ok(Array.isArray(rows)&&rows.length>0,'expected finalized BTC 15m DreamDEX markets');
  const market=rows.find(m=>Number(m.tradeCount||0)>0&&m.poolAddress&&Number(m.expiry||0)>0);
  assert.ok(market,'expected at least one finalized BTC 15m market with recorded trades');
  const expiry=Number(market.expiry),start=Number(market.tradingStart||expiry-900),pool=String(market.poolAddress);
  const oneMinute=await exchange.client.getCandles(pool,60,{from:start,to:expiry,limit:100});
  const contractWindow=await exchange.client.getCandles(pool,900,{from:start,to:expiry,limit:20});
  assert.ok(Array.isArray(oneMinute),'1-minute event-contract candle request must return an array');
  assert.ok(Array.isArray(contractWindow),'15-minute event-contract candle request must return an array');
  assert.ok(oneMinute.length>0,`market ${market.marketId} reports ${market.tradeCount} trades but returned no 1-minute candles`);
  const starts=oneMinute.map((c:any)=>Number(c.bucketStart)).filter(Number.isFinite);
  assert.ok(starts.every((x:number)=>x>=start&&x<expiry),'event-contract 1m candles must stay inside the selected finalized market window');
  console.log(`DreamDEX event history passed: ${market.marketId}, ${market.tradeCount} trades, ${oneMinute.length} one-minute candles, ${contractWindow.length} 15-minute candles`);
 }finally{try{await Promise.resolve(exchange.close())}catch{}}
}
main().catch(e=>{console.error(e);process.exit(1)});
