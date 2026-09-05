import type {Asset,IndicatorTimeframe} from './types';
import {timeframeSeconds,type SpotBar} from './strategy-engine';

const SPOT_POOLS:Record<Asset,`0x${string}`>={
 BTC:'0x3605f28aA7C50e7441211e77Cb0762d49539326C',
 ETH:'0xD180195da5459C7a0DEA188ed61216ec43682b50',
};
const QUOTE_DECIMALS=18;
function sec(v:unknown){const n=Number(v);return Number.isFinite(n)?Math.floor(n>1e12?n/1000:n):0}
function price(v:unknown){const n=Number(v);if(!Number.isFinite(n))return NaN;return Math.abs(n)>1e12?n/10**QUOTE_DECIMALS:n}
function volume(v:unknown){const n=Number(v);return Number.isFinite(n)?n:0}
function normalize(rows:any[]):SpotBar[]{return rows.map((r:any)=>({time:sec(r.bucketStart??r.timestamp??r.time),open:price(r.open),high:price(r.high),low:price(r.low),close:price(r.close),volume:volume(r.volume)})).filter(b=>b.time>0&&Number.isFinite(b.close)&&b.close>0).sort((a,b)=>a.time-b.time)}

export async function fetchSpotBars(exchange:any,asset:Asset,timeframe:IndicatorTimeframe,fromSec:number,toSec:number,warmupBars=100){
 const step=timeframeSeconds(timeframe),start=Math.max(0,fromSec-warmupBars*step),pool=SPOT_POOLS[asset],out:SpotBar[]=[];
 const chunkSec=step*450;
 for(let cursor=start,calls=0;cursor<=toSec&&calls<100;cursor+=chunkSec,calls++){
  const end=Math.min(toSec,cursor+chunkSec-1);
  const rows=await exchange.client.getCandles(pool,step,{from:cursor,to:end,limit:500});
  if(Array.isArray(rows))out.push(...normalize(rows));
 }
 const seen=new Set<number>();
 return out.filter(b=>b.time<=toSec&&!seen.has(b.time)&&(seen.add(b.time),true));
}
