import {NextResponse} from 'next/server';
import {createReadExchange} from '@/lib/dreamdex';
import type {StrategySpec} from '@/lib/types';

type Trade={marketId:string;time:number;side:'UP'|'DOWN';settlement:'UP'|'DOWN';entry:number;stake:number;pnl:number;equity:number};
type CandleRow={bucketStart:string;high:string;low:string};
const n2=(n:number)=>Number(n.toFixed(2));
function asSec(v:unknown,fallback:number){if(typeof v==='number'&&Number.isFinite(v))return v>1e12?Math.floor(v/1000):Math.floor(v);if(typeof v==='string'&&v){const ms=Date.parse(v);if(Number.isFinite(ms))return Math.floor(ms/1000)}return fallback}
function probability(raw:string|number|bigint,decimals:number){return Number(raw)/10**decimals}

export async function POST(req:Request){
 let exchange:any;
 try{
  const body=await req.json() as {strategy:StrategySpec;from?:string|number;to?:string|number;startingCapital?:number};
  const s=body.strategy;if(!s?.asset||!s?.window||!s?.side)throw new Error('A valid strategy is required.');
  const now=Math.floor(Date.now()/1000),to=Math.min(asSec(body.to,now),now),from=asSec(body.from,to-30*86400);
  if(from>=to)throw new Error('Backtest start must be before end.');
  const startingCapital=Math.max(1,Number(body.startingCapital)||100),intervalSec=s.window==='15m'?900:3600;
  exchange=createReadExchange();const client:any=exchange.client;
  const rows:any[]=[];const pageSize=500;let offset=0,truncated=false;
  for(let page=0;page<40;page++){
    const batch=await client.listBinaryMarkets({status:'Finalized',asset:s.asset,intervalSec,orderBy:'newest',limit:pageSize,offset} as any);
    if(!Array.isArray(batch)||!batch.length)break;
    rows.push(...batch);offset+=batch.length;
    const expiries=batch.map((m:any)=>Number(m.expiry||0)).filter(Boolean);
    const oldest=expiries.length?Math.min(...expiries):0;
    if(batch.length<pageSize||(oldest&&oldest<from))break;
    if(page===39)truncated=true;
  }
  const markets=rows.filter((m:any)=>{const t=Number(m.expiry||0);return t>=from&&t<=to&&String(m.asset).toUpperCase()===s.asset&&Number(m.intervalSec||intervalSec)===intervalSec}).sort((a:any,b:any)=>Number(a.expiry)-Number(b.expiry));
  if(!markets.length)return NextResponse.json({source:'dreamdex-finalized-markets',from,to,markets:0,trades:0,wins:0,losses:0,winRate:0,pnl:0,returnPct:0,maxDrawdown:0,endingCapital:startingCapital,equity:[startingCapital],tradeLog:[],warnings:['No finalized DreamDEX markets were found for this asset, timeframe and date range.']});

  // Binary pools are recycled across successive markets. Fetch each pool's rollups in bounded
  // chunks once, then isolate a market by its own [tradingStart, expiry) window below.
  const pools=[...new Set(markets.map((m:any)=>String(m.poolAddress).toLowerCase()))];
  const candlesByPool=new Map<string,CandleRow[]>();let historyErrors=0;
  const chunkSec=intervalSec*450;
  await Promise.all(pools.map(async pool=>{
    const all:CandleRow[]=[];
    try{
      for(let cursor=from;cursor<=to;cursor+=chunkSec){
        const end=Math.min(to,cursor+chunkSec-1);
        const batch=await client.getCandles(pool,intervalSec,{from:cursor,to:end,limit:500});
        if(Array.isArray(batch))all.push(...batch);
      }
      all.sort((a,b)=>Number(a.bucketStart)-Number(b.bucketStart));candlesByPool.set(pool,all);
    }catch{historyErrors++;candlesByPool.set(pool,[])}
  }));

  let cash=startingCapital,peak=cash,maxDD=0,wins=0,losses=0,totalPnl=0,size=s.sizing.baseUsd,sessionPnl=0,sessionTrades=0,sessionStart=from,marketsWithoutPrice=0;
  const equity=[cash],tradeLog:Trade[]=[];const prior:(('UP'|'DOWN')|null)[]=[];const streakLen=s.trigger.streakLength||0,streakSide=s.trigger.streakSide||s.side,cap=s.trigger.maxEntryPrice||1;
  for(const m of markets){
    const expiry=Number(m.expiry||0),start=Number(m.tradingStart||expiry-intervalSec);
    if(start-sessionStart>=Math.max(1,s.risk.durationHours)*3600){sessionStart=start;sessionPnl=0;sessionTrades=0;size=s.sizing.baseUsd;}
    let settlement:('UP'|'DOWN')|null=m.winningOutcome===0?'UP':m.winningOutcome===1?'DOWN':null;
    if(settlement===null){try{const oc=await client.getMarketOnchain(m.marketId as `0x${string}`);settlement=oc.isResolved?(oc.winningOutcome===0?'UP':'DOWN'):null}catch{settlement=null}}
    const trigger=streakLen===0||(prior.length>=streakLen&&prior.slice(-streakLen).every(x=>x===streakSide));
    const riskRoom=Math.max(0,s.risk.maxLossUsd+sessionPnl);
    if(trigger&&settlement&&sessionTrades<s.risk.maxTrades&&riskRoom>0){
      const decimals=Number(m.quoteDecimals??6),pool=String(m.poolAddress).toLowerCase();
      const marketCandles=(candlesByPool.get(pool)||[]).filter(c=>{const t=Number(c.bucketStart);return t>=start&&t<expiry});
      let touched=false;
      for(const c of marketCandles){const lo=probability(c.low,decimals),hi=probability(c.high,decimals);if(s.side==='UP'?lo<=cap:(1-hi)<=cap){touched=true;break}}
      if(!marketCandles.length)marketsWithoutPrice++;
      if(touched){
        const stake=Math.min(size,riskRoom);if(stake>0){const won=settlement===s.side,tradePnl=won?stake/cap-stake:-stake;cash+=tradePnl;totalPnl+=tradePnl;sessionPnl+=tradePnl;sessionTrades++;won?wins++:losses++;size=won?s.sizing.afterWinUsd:s.sizing.afterLossUsd;peak=Math.max(peak,cash);maxDD=Math.max(maxDD,peak?((peak-cash)/peak)*100:0);equity.push(n2(cash));tradeLog.push({marketId:m.marketId,time:start,side:s.side,settlement,entry:cap,stake:n2(stake),pnl:n2(tradePnl),equity:n2(cash)});}
      }
    }
    prior.push(settlement);if(prior.length>Math.max(20,streakLen+2))prior.shift();
  }
  const trades=tradeLog.length,warnings:string[]=[];
  if(trades<20)warnings.push('Small sample: fewer than 20 historical trades matched this strategy.');
  if(historyErrors)warnings.push(`Price history could not be loaded for ${historyErrors} recycled DreamDEX pool${historyErrors===1?'':'s'}; those markets were skipped.`);
  if(marketsWithoutPrice)warnings.push(`${marketsWithoutPrice} qualifying markets had no recorded fills at this candle resolution, so no entry was assumed.`);
  if(truncated)warnings.push('History exceeded the current 20,000-market scan cap; results cover the newest available portion of the selected range.');
  warnings.push(`Replay uses real finalized DreamDEX outcomes and ${s.window} pool OHLCV buckets made from actual fills. A trade is simulated only when the observed market reaches your price cap, with entry charged at the cap; queue position and transaction latency are not modeled.`);
  return NextResponse.json({source:'dreamdex-finalized-markets',from,to,markets:markets.length,trades,wins,losses,winRate:trades?n2(wins/trades*100):0,pnl:n2(totalPnl),returnPct:n2(totalPnl/startingCapital*100),maxDrawdown:n2(maxDD),endingCapital:n2(cash),equity,tradeLog,warnings});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Backtest failed.'},{status:500})}
 finally{try{await Promise.resolve(exchange?.close?.())}catch{}}
}
