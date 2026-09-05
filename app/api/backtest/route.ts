import {NextResponse} from 'next/server';
import {createReadExchange} from '@/lib/dreamdex';
import {createStrategyEvaluator,indicatorWarmup,requiredTimeframes,type SpotBar} from '@/lib/strategy-engine';
import {fetchSpotBars} from '@/lib/spot-history';
import type {StrategySpec} from '@/lib/types';

type Side='UP'|'DOWN';
type Trade={marketId:string;time:number;side:Side;settlement:Side;entry:number;stake:number;pnl:number;equity:number};
type CandleRow={bucketStart:string;high:string;low:string};
type HistoryJob={pool:string;from:number;to:number};
const n2=(n:number)=>Number(n.toFixed(2));
const CACHE_TTL_MS=5*60_000;
const cache=new Map<string,{expires:number;payload:any}>();
function asSec(v:unknown,fallback:number){if(typeof v==='number'&&Number.isFinite(v))return v>1e12?Math.floor(v/1000):Math.floor(v);if(typeof v==='string'&&v){const ms=Date.parse(v);if(Number.isFinite(ms))return Math.floor(ms/1000)}return fallback}
function probability(raw:string|number|bigint,decimals:number){return Number(raw)/10**decimals}
async function mapLimit<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>){const out=new Array<R>(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)break;out[i]=await fn(items[i])}}));return out}
function lowerBound(rows:CandleRow[],target:number){let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>1;if(Number(rows[mid].bucketStart)<target)lo=mid+1;else hi=mid}return lo}
function touched(rows:CandleRow[],start:number,expiry:number,decimals:number,side:Side,cap:number){for(let i=lowerBound(rows,start);i<rows.length;i++){const c=rows[i],t=Number(c.bucketStart);if(t>=expiry)break;const lo=probability(c.low,decimals),hi=probability(c.high,decimals);if(side==='UP'?lo<=cap:(1-hi)<=cap)return true}return false}
function compactCache(){if(cache.size<=30)return;for(const [k,v] of cache){if(v.expires<Date.now()||cache.size>24)cache.delete(k)}}

export const maxDuration=60;
export async function POST(req:Request){
 const started=Date.now();let exchange:any;
 try{
  const body=await req.json() as {strategy:StrategySpec;from?:string|number;to?:string|number;startingCapital?:number};
  const s=body.strategy;if(!s?.asset||!s?.window||!s?.side)throw new Error('A valid compiled strategy is required.');
  if(s.interpretation?.needsClarification)return NextResponse.json({error:'DreamForge still has unresolved questions about this strategy. Resolve them before trusting a backtest.'},{status:409});
  const now=Math.floor(Date.now()/1000),to=Math.min(asSec(body.to,now),now),from=asSec(body.from,to-30*86400);if(from>=to)throw new Error('Backtest start must be before end.');
  const startingCapital=Math.max(1,Number(body.startingCapital)||100),intervalSec=s.window==='15m'?900:3600,cacheKey=JSON.stringify({s,from,to,startingCapital}),hit=cache.get(cacheKey);
  if(hit&&hit.expires>Date.now())return NextResponse.json({...hit.payload,cached:true,durationMs:Date.now()-started});compactCache();
  exchange=createReadExchange();const client:any=exchange.client;

  const rows:any[]=[];const pageSize=500;let offset=0,truncated=false;
  for(let page=0;page<40;page++){const batch=await client.listBinaryMarkets({status:'Finalized',asset:s.asset,intervalSec,orderBy:'newest',limit:pageSize,offset} as any);if(!Array.isArray(batch)||!batch.length)break;rows.push(...batch);offset+=batch.length;const expiries=batch.map((m:any)=>Number(m.expiry||0)).filter(Boolean),oldest=expiries.length?Math.min(...expiries):0;if(batch.length<pageSize||(oldest&&oldest<from))break;if(page===39)truncated=true}
  const markets=rows.filter((m:any)=>{const t=Number(m.expiry||0);return t>=from&&t<=to&&String(m.asset).toUpperCase()===s.asset&&Number(m.intervalSec||intervalSec)===intervalSec}).sort((a:any,b:any)=>Number(a.expiry)-Number(b.expiry));
  if(!markets.length){const payload={source:'dreamdex-agent-replay',from,to,markets:0,trades:0,wins:0,losses:0,winRate:0,pnl:0,returnPct:0,maxDrawdown:0,endingCapital:startingCapital,equity:[startingCapital],tradeLog:[],warnings:['No finalized DreamDEX markets were found for this asset, contract window and date range.']};cache.set(cacheKey,{expires:Date.now()+CACHE_TTL_MS,payload});return NextResponse.json({...payload,cached:false,durationMs:Date.now()-started})}

  const settlementById=new Map<string,Side|null>();const missing=markets.filter((m:any)=>m.winningOutcome!==0&&m.winningOutcome!==1);for(const m of markets)settlementById.set(m.marketId,m.winningOutcome===0?'UP':m.winningOutcome===1?'DOWN':null);
  await mapLimit(missing,8,async(m:any)=>{try{const oc=await client.getMarketOnchain(m.marketId as `0x${string}`);settlementById.set(m.marketId,oc.isResolved?(oc.winningOutcome===0?'UP':'DOWN'):null)}catch{settlementById.set(m.marketId,null)}});

  const firstMarketStart=Math.min(...markets.map((m:any)=>Number(m.tradingStart||Number(m.expiry)-intervalSec)).filter((x:number)=>x>0)),historyFrom=Math.max(from,firstMarketStart),barsByTf:Record<string,SpotBar[]>={};
  const timeframes=requiredTimeframes(s),warmup=indicatorWarmup(s);await Promise.all(timeframes.map(async tf=>{barsByTf[tf]=await fetchSpotBars(exchange,s.asset,tf,historyFrom,to,warmup)}));
  const evaluator=createStrategyEvaluator(s,barsByTf),prior:Side[]=[],candidates:any[]=[];
  for(const m of markets){const settlement=settlementById.get(m.marketId)??null,start=Number(m.tradingStart||Number(m.expiry)-intervalSec);if(settlement){if(evaluator.evaluate(start,prior).passed)candidates.push(m);prior.push(settlement)}}

  // Only signal-qualified windows need binary-contract price history.
  const windowsByPool=new Map<string,{start:number;end:number}[]>();for(const m of candidates){const expiry=Number(m.expiry),start=Number(m.tradingStart||expiry-intervalSec),pool=String(m.poolAddress).toLowerCase(),arr=windowsByPool.get(pool)||[];arr.push({start,end:expiry});windowsByPool.set(pool,arr)}
  const jobs:HistoryJob[]=[];const maxSpan=intervalSec*480,maxGap=intervalSec*8;for(const [pool,windows] of windowsByPool){windows.sort((a,b)=>a.start-b.start);let cur:HistoryJob|null=null;for(const w of windows){if(!cur){cur={pool,from:w.start,to:w.end};continue}const mergedEnd=Math.max(cur.to,w.end);if(w.start-cur.to<=maxGap&&mergedEnd-cur.from<=maxSpan)cur.to=mergedEnd;else{jobs.push(cur);cur={pool,from:w.start,to:w.end}}}if(cur)jobs.push(cur)}
  const candlesByPool=new Map<string,CandleRow[]>();let historyErrors=0;await mapLimit(jobs,10,async job=>{try{const batch=await client.getCandles(job.pool,intervalSec,{from:job.from,to:job.to,limit:500});if(Array.isArray(batch)){const arr=candlesByPool.get(job.pool)||[];arr.push(...batch);candlesByPool.set(job.pool,arr)}}catch{historyErrors++}});for(const arr of candlesByPool.values())arr.sort((a,b)=>Number(a.bucketStart)-Number(b.bucketStart));

  let cash=startingCapital,peak=cash,maxDD=0,wins=0,losses=0,totalPnl=0,size=s.sizing.baseUsd,sessionPnl=0,sessionTrades=0,sessionStart=historyFrom,marketsWithoutPrice=0;const equity=[cash],tradeLog:Trade[]=[],candidateIds=new Set(candidates.map(m=>m.marketId)),cap=s.trigger.maxEntryPrice||.99;
  for(const m of markets){if(!candidateIds.has(m.marketId))continue;const settlement=settlementById.get(m.marketId);if(!settlement)continue;const expiry=Number(m.expiry),start=Number(m.tradingStart||expiry-intervalSec);if(start-sessionStart>=Math.max(1,s.risk.durationHours)*3600){sessionStart=start;sessionPnl=0;sessionTrades=0;size=s.sizing.baseUsd}const riskRoom=Math.max(0,s.risk.maxLossUsd+sessionPnl);if(sessionTrades>=s.risk.maxTrades||riskRoom<=0)continue;const decimals=Number(m.quoteDecimals??6),poolRows=candlesByPool.get(String(m.poolAddress).toLowerCase())||[],idx=lowerBound(poolRows,start),hasPrice=idx<poolRows.length&&Number(poolRows[idx]?.bucketStart)<expiry;if(!hasPrice){marketsWithoutPrice++;continue}if(!touched(poolRows,start,expiry,decimals,s.side,cap))continue;const stake=Math.min(size,riskRoom);if(stake<=0)continue;const won=settlement===s.side,tradePnl=won?stake/cap-stake:-stake;cash+=tradePnl;totalPnl+=tradePnl;sessionPnl+=tradePnl;sessionTrades++;won?wins++:losses++;size=won?s.sizing.afterWinUsd:s.sizing.afterLossUsd;peak=Math.max(peak,cash);maxDD=Math.max(maxDD,peak?((peak-cash)/peak)*100:0);equity.push(n2(cash));tradeLog.push({marketId:m.marketId,time:start,side:s.side,settlement,entry:cap,stake:n2(stake),pnl:n2(tradePnl),equity:n2(cash)})}
  const trades=tradeLog.length,warnings:string[]=[];if(trades<20)warnings.push('Small sample: fewer than 20 historical trades matched this strategy.');if(historyErrors)warnings.push(`${historyErrors} historical price batch${historyErrors===1?'':'es'} could not be loaded; affected candidate markets were skipped.`);if(marketsWithoutPrice)warnings.push(`${marketsWithoutPrice} candidate markets had no recorded binary-contract fills at this resolution, so no entry was assumed.`);if(truncated)warnings.push('History exceeded the current 20,000-market scan cap; results cover the newest available portion of the selected range.');warnings.push('The same deterministic condition engine powers this replay and live signal checks. Historical entries are charged at your maximum accepted probability; queue position, gas and transaction latency are not modeled.');
  const payload={source:'dreamdex-agent-replay',from:historyFrom,to,markets:markets.length,candidateMarkets:candidates.length,historyBatches:jobs.length,trades,wins,losses,winRate:trades?n2(wins/trades*100):0,pnl:n2(totalPnl),returnPct:n2(totalPnl/startingCapital*100),maxDrawdown:n2(maxDD),endingCapital:n2(cash),equity,tradeLog,warnings};cache.set(cacheKey,{expires:Date.now()+CACHE_TTL_MS,payload});return NextResponse.json({...payload,cached:false,durationMs:Date.now()-started});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Backtest failed.'},{status:500})}finally{try{await Promise.resolve(exchange?.close?.())}catch{}}
}
