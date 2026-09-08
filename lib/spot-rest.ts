import type {Asset,IndicatorTimeframe} from './types';
import type {SpotBar} from './strategy-engine';

const BASE=process.env.DREAMDEX_REST_URL||'https://stg.api.dreamdex.io/v0';
const symbolCache=new Map<Asset,{symbol:string;expires:number}>();

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

export async function fetchRecentSpotBarsRest(asset:Asset,timeframe:IndicatorTimeframe,limit=160){const symbol=await discoverSymbol(asset),n=Math.max(40,Math.min(500,Math.floor(limit)||160)),url=`${BASE}/markets/${encodeURIComponent(symbol)}/candles?interval=${encodeURIComponent(timeframe)}&limit=${n}`,j:any=await getJson(url),rows:any[]=j?.candles||j?.data||j||[],bars=normalizeRestBars(Array.isArray(rows)?rows:[]);if(!bars.length)throw new Error(`DreamDEX REST returned no ${timeframe} candles for ${symbol}.`);return bars.slice(-n)}
