import type {Asset,IndicatorTimeframe} from './types';
import type {SpotBar} from './strategy-engine';

const BASE=process.env.DREAMDEX_REST_URL||'https://stg.api.dreamdex.io/v0';
const symbolCache=new Map<Asset,{symbol:string;expires:number}>();
const TF_SEC:Record<IndicatorTimeframe,number>={ '1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400 };

function sec(v:unknown){const n=Number(v);return Number.isFinite(n)?Math.floor(n>1e12?n/1000:n):0}
function num(v:unknown){const n=Number(v);return Number.isFinite(n)?n:NaN}
function normalizeRow(r:any):SpotBar|null{
 const isArr=Array.isArray(r);
 const time=sec(isArr?r[0]:(r.bucketStart??r.timestamp??r.time??r.openTime??r.t));
 const open=num(isArr?r[1]:(r.open??r.o)),high=num(isArr?r[2]:(r.high??r.h)),low=num(isArr?r[3]:(r.low??r.l)),close=num(isArr?r[4]:(r.close??r.c)),volume=num(isArr?r[5]:(r.volume??r.v??0));
 if(!(time>0&&Number.isFinite(open)&&Number.isFinite(high)&&Number.isFinite(low)&&Number.isFinite(close)&&close>0))return null;
 return{time,open,high,low,close,volume:Number.isFinite(volume)?volume:0};
}
export function normalizeRestBars(rows:any[]):SpotBar[]{const out:SpotBar[]=[];for(const r of rows||[]){const b=normalizeRow(r);if(b)out.push(b)}out.sort((a,b)=>a.time-b.time);const seen=new Set<number>();return out.filter(b=>!seen.has(b.time)&&(seen.add(b.time),true))}

async function getJson(url:string,timeoutMs=10_000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});const text=await r.text();if(!r.ok)throw new Error(`DreamDEX REST ${r.status}: ${text.slice(0,300)}`);try{return JSON.parse(text)}catch{throw new Error('DreamDEX REST returned invalid JSON')}}finally{clearTimeout(timer)}}

async function discoverSymbol(asset:Asset){const cached=symbolCache.get(asset);if(cached&&cached.expires>Date.now())return cached.symbol;const j:any=await getJson(`${BASE}/markets`),markets:any[]=j?.markets||j?.data||j||[],target=asset==='BTC'?'WBTC':'WETH';const market=markets.find(m=>String(m?.base||'').toUpperCase()===target)||markets.find(m=>String(m?.symbol||'').toUpperCase().includes(target));if(!market)throw new Error(`${target} spot market is unavailable from DreamDEX REST.`);const symbol=String(market.symbol||'');if(!symbol)throw new Error(`${target} market did not expose a symbol.`);symbolCache.set(asset,{symbol,expires:Date.now()+5*60_000});return symbol}

function rowsFrom(j:any){const rows:any[]=j?.candles||j?.data||j||[];return normalizeRestBars(Array.isArray(rows)?rows:[])}

export async function fetchRecentSpotBarsRest(asset:Asset,timeframe:IndicatorTimeframe,limit=160){const symbol=await discoverSymbol(asset),n=Math.max(40,Math.min(1000,Math.floor(limit)||160)),url=`${BASE}/markets/${encodeURIComponent(symbol)}/candles?interval=${encodeURIComponent(timeframe)}&limit=${n}`,bars=rowsFrom(await getJson(url));if(!bars.length)throw new Error(`DreamDEX REST returned no ${timeframe} candles for ${symbol}.`);return bars.slice(-n)}

/**
 * Historical spot candles from DreamDEX REST. The API pages backwards with
 * endTime (unix milliseconds), returning bucket timestamps strictly before it.
 * This is intentionally the backtest source: unlike an old hard-coded pool
 * address, symbol history survives spot-pool migrations and can be paged.
 */
export async function fetchSpotBarsRestRange(asset:Asset,timeframe:IndicatorTimeframe,fromSec:number,toSec:number,warmupBars=0){
 const symbol=await discoverSymbol(asset),step=TF_SEC[timeframe],targetFrom=Math.max(0,Math.floor(fromSec)-Math.max(0,Math.floor(warmupBars))*step),targetTo=Math.floor(toSec);
 if(!(targetFrom<targetTo))return[];
 const collected:SpotBar[]=[];let endMs=(targetTo+step)*1000,pages=0,oldest=Infinity;
 while(oldest>targetFrom&&pages<200){
  const url=`${BASE}/markets/${encodeURIComponent(symbol)}/candles?interval=${encodeURIComponent(timeframe)}&limit=1000&endTime=${Math.floor(endMs)}`;
  const page=rowsFrom(await getJson(url));if(!page.length)break;
  collected.push(...page);oldest=page[0].time;pages++;
  if(oldest<=targetFrom||page.length<1000)break;
  endMs=oldest*1000;
 }
 const bars=normalizeRestBars(collected).filter(b=>b.time>=targetFrom&&b.time<=targetTo);
 if(!bars.length)throw new Error(`DreamDEX REST returned no historical ${timeframe} candles for ${symbol} between ${targetFrom} and ${targetTo}.`);
 // If we hit the pagination safety ceiling before reaching the requested range,
 // fail rather than silently backtesting on a truncated indicator history.
 if(oldest>targetFrom&&pages>=200)throw new Error(`DreamDEX REST ${timeframe} history exceeded the 200-page safety limit.`);
 return bars;
}
