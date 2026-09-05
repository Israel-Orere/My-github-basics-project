import type {Asset,IndicatorTimeframe} from './types';
import {timeframeSeconds,type SpotBar} from './strategy-engine';

const SPOT_POOLS:Record<Asset,`0x${string}`>={BTC:'0x3605f28aA7C50e7441211e77Cb0762d49539326C',ETH:'0xD180195da5459C7a0DEA188ed61216ec43682b50'};
const QUOTE_DECIMALS=18,MAX_CHUNKS=900,CONCURRENCY=10;
const cache=new Map<string,{expires:number;bars:SpotBar[]}>();
function sec(v:unknown){const n=Number(v);return Number.isFinite(n)?Math.floor(n>1e12?n/1000:n):0}
function price(v:unknown){const n=Number(v);if(!Number.isFinite(n))return NaN;return Math.abs(n)>1e12?n/10**QUOTE_DECIMALS:n}
function volume(v:unknown){const n=Number(v);return Number.isFinite(n)?n:0}
function normalize(rows:any[]):SpotBar[]{return rows.map((r:any)=>({time:sec(r.bucketStart??r.timestamp??r.time),open:price(r.open),high:price(r.high),low:price(r.low),close:price(r.close),volume:volume(r.volume)})).filter(b=>b.time>0&&Number.isFinite(b.open)&&Number.isFinite(b.high)&&Number.isFinite(b.low)&&Number.isFinite(b.close)&&b.close>0).sort((a,b)=>a.time-b.time)}
async function mapLimit<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>){const out=new Array<R>(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)break;out[i]=await fn(items[i])}}));return out}
async function fetchChunk(exchange:any,pool:string,step:number,from:number,to:number){const k=`${pool}:${step}:${from}:${to}`,hit=cache.get(k);if(hit&&hit.expires>Date.now())return hit.bars;let last:unknown;for(let attempt=0;attempt<3;attempt++){try{const rows=await exchange.client.getCandles(pool,step,{from,to,limit:500});const bars=Array.isArray(rows)?normalize(rows):[];const historical=to<Math.floor(Date.now()/1000)-step*3;cache.set(k,{bars,expires:Date.now()+(historical?15*60_000:20_000)});return bars}catch(e){last=e;if(attempt<2)await new Promise(r=>setTimeout(r,200*(2**attempt)+Math.floor(Math.random()*100)))}}throw last instanceof Error?last:new Error('DreamDEX spot candle request failed')}
function compactCache(){if(cache.size<3000)return;const now=Date.now();for(const [k,v] of cache){if(v.expires<now||cache.size>2200)cache.delete(k)}}

export async function fetchSpotBars(exchange:any,asset:Asset,timeframe:IndicatorTimeframe,fromSec:number,toSec:number,warmupBars=100){
 const step=timeframeSeconds(timeframe),start=Math.max(0,fromSec-warmupBars*step),pool=SPOT_POOLS[asset],chunkSec=step*480,jobs:{from:number;to:number}[]=[];
 for(let cursor=start;cursor<=toSec;cursor+=chunkSec)jobs.push({from:cursor,to:Math.min(toSec,cursor+chunkSec-1)});
 if(jobs.length>MAX_CHUNKS)throw new Error(`${timeframe} indicator history needs ${jobs.length} DreamDEX candle batches for this range. Choose a shorter range or a higher indicator timeframe so DreamForge can replay it exactly.`);
 compactCache();const chunks=await mapLimit(jobs,CONCURRENCY,j=>fetchChunk(exchange,pool,step,j.from,j.to)),out=chunks.flat().sort((a,b)=>a.time-b.time),seen=new Set<number>();
 return out.filter(b=>b.time<=toSec&&!seen.has(b.time)&&(seen.add(b.time),true));
}
