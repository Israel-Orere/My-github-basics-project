import type {Asset,IndicatorTimeframe} from './types';
import {timeframeSeconds,type SpotBar} from './strategy-engine';

function candidates(asset:Asset){const base=asset==='BTC'?'WBTC':'WETH';return [`${base}/USDso`,`${base}:USDso`,`${base}/USDC`,`${base}:USDC`]}
function normalize(rows:any[]):SpotBar[]{return rows.map((r:any)=>Array.isArray(r)?{time:Math.floor(Number(r[0])/1000),open:Number(r[1]),high:Number(r[2]),low:Number(r[3]),close:Number(r[4]),volume:Number(r[5]||0)}:{time:Math.floor(Number(r.timestamp??r.time??0)/1000),open:Number(r.open),high:Number(r.high),low:Number(r.low),close:Number(r.close),volume:Number(r.volume||0)}).filter(b=>Number.isFinite(b.time)&&b.time>0&&Number.isFinite(b.close)).sort((a,b)=>a.time-b.time)}

export async function fetchSpotBars(exchange:any,asset:Asset,timeframe:IndicatorTimeframe,fromSec:number,toSec:number,warmupBars=100){
 const step=timeframeSeconds(timeframe),start=Math.max(0,fromSec-warmupBars*step),limit=1000;let symbol='';
 for(const c of candidates(asset)){try{const test=await exchange.fetchOHLCV(c,timeframe,start*1000,2);if(Array.isArray(test)){symbol=c;break}}catch{}}
 if(!symbol)throw new Error(`Underlying ${asset} spot candles are unavailable on DreamDEX right now.`);
 const out:SpotBar[]=[];let cursor=start*1000,calls=0;
 while(cursor<=toSec*1000&&calls<80){calls++;const rows=await exchange.fetchOHLCV(symbol,timeframe,cursor,limit);if(!Array.isArray(rows)||!rows.length)break;const normalized=normalize(rows);if(!normalized.length)break;out.push(...normalized);const last=normalized[normalized.length-1].time*1000,next=last+step*1000;if(next<=cursor)break;cursor=next;if(normalized.length<limit&&last>=toSec*1000-step*1000)break}
 const seen=new Set<number>();return out.filter(b=>b.time<=toSec&&!seen.has(b.time)&&(seen.add(b.time),true));
}
