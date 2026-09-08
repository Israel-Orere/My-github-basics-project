import {createReadExchange} from '../lib/dreamdex';

function candleTimes(rows:any[]){const times=(rows||[]).map((r:any)=>Number(Array.isArray(r)?r[0]:(r.bucketStart??r.timestamp??r.time??r.openTime??r.t))).filter(Number.isFinite).map((x:number)=>x>1e12?Math.floor(x/1000):Math.floor(x));return{count:times.length,first:times.length?Math.min(...times):null,last:times.length?Math.max(...times):null}}
async function probe(label:string,url:string){const started=Date.now();try{const r=await fetch(url,{cache:'no-store'});const text=await r.text();let info:any={};try{const j=JSON.parse(text),rows=j?.candles||j?.data||j||[];info=Array.isArray(rows)?candleTimes(rows):{keys:Object.keys(j||{})}}catch{info={body:text.slice(0,250)}}console.log('REST_PROBE',label,'STATUS',r.status,'MS',Date.now()-started,JSON.stringify(info));return{text,status:r.status}}catch(e){console.log('REST_PROBE',label,'ERROR',e instanceof Error?e.message:String(e));return{text:'',status:0}}}

async function main(){
 const nowMs=Date.now(),weekMs=nowMs-7*86400000,nowSec=Math.floor(nowMs/1000),weekSec=nowSec-7*86400;
 const marketsResp=await fetch('https://stg.api.dreamdex.io/v0/markets',{cache:'no-store'}),marketsJson:any=await marketsResp.json(),spotMarkets:any[]=marketsJson?.markets||marketsJson?.data||marketsJson||[],wbtc=spotMarkets.find(m=>String(m?.base||'').toUpperCase()==='WBTC')||spotMarkets.find(m=>String(m?.symbol||'').toUpperCase().includes('WBTC'));
 console.log('REST_WBTC_MARKET',JSON.stringify(wbtc));

 const exchange:any=createReadExchange();
 try{
  const client:any=exchange.client;
  const live:any[]=await client.listLiveBinaryMarkets({asset:'BTC',intervalSec:900,limit:20,offset:0} as any);
  console.log('TRUE_LIVE_COUNT',live.length);
  console.log('TRUE_LIVE_SAMPLE',JSON.stringify(live.slice(0,5).map((m:any)=>({marketId:m.marketId,operatorId:m.operatorId,venueId:m.venueId,asset:m.asset,intervalSec:m.intervalSec,tradingStart:m.tradingStart,expiry:m.expiry,poolAddress:m.poolAddress,tradeCount:m.tradeCount}))));
  const pairs=[...new Map(live.map((m:any)=>[`${m.operatorId??''}:${m.venueId??''}`,{operatorId:m.operatorId,venueId:m.venueId}])).values()];
  console.log('TRUE_LIVE_OPERATOR_VENUE',JSON.stringify(pairs));
  for(const p of pairs.slice(0,4)){
    const filter:any={status:'Finalized',asset:'BTC',intervalSec:900,orderBy:'newest',limit:250,offset:0};if(p.operatorId!==undefined&&p.operatorId!==null)filter.operatorId=p.operatorId;if(p.venueId!==undefined&&p.venueId!==null)filter.venueId=p.venueId;
    const t=Date.now(),rows:any[]=await client.listBinaryMarkets(filter);console.log('FILTER_SAMPLE',JSON.stringify(p),'MS',Date.now()-t,'COUNT',rows.length,'NEWEST_EXPIRY',rows[0]?.expiry,'OLDEST_EXPIRY',rows.at(-1)?.expiry);
  }
  if(wbtc?.contract){
    for(const [label,from,to] of [['full-week',weekSec,nowSec],['old-chunk',weekSec,Math.min(nowSec,weekSec+480*900-1)],['recent-chunk',Math.max(weekSec,nowSec-480*900),nowSec]] as const){
      const t=Date.now();try{const rows:any[]=await client.getCandles(String(wbtc.contract),900,{from,to,limit:500});console.log('INDEXER_CURRENT_SPOT',label,'MS',Date.now()-t,JSON.stringify(candleTimes(rows)))}catch(e){console.log('INDEXER_CURRENT_SPOT',label,'ERROR',e instanceof Error?e.message:String(e))}
    }
  }
 }finally{try{await Promise.resolve(exchange.close())}catch{}}

 const base='https://stg.api.dreamdex.io/v0/markets/WBTC%3AUSDso/candles';
 await probe('plain',`${base}?interval=15m&limit=5`);
 await probe('since-until-ms',`${base}?interval=15m&limit=5&since=${weekMs}&until=${nowMs}`);
 await probe('since-until-sec',`${base}?interval=15m&limit=5&since=${weekSec}&until=${nowSec}`);
 await probe('startTime-endTime-ms',`${base}?interval=15m&limit=5&startTime=${weekMs}&endTime=${nowMs}`);
 await probe('from-to-sec',`${base}?interval=15m&limit=5&from=${weekSec}&to=${nowSec}`);
 await probe('from-to-ms',`${base}?interval=15m&limit=5&from=${weekMs}&to=${nowMs}`);
}
main().catch(e=>{console.error(e);process.exit(1)});
