import {NextResponse} from 'next/server';
import {createReadExchange} from '@/lib/dreamdex';
import {createStrategyEvaluator,indicatorWarmup,requiredTimeframes,timeframeSeconds,type SpotBar} from '@/lib/strategy-engine';
import {fetchSpotBars} from '@/lib/spot-history';
import type {StrategySpec} from '@/lib/types';

export const maxDuration=30;
export async function POST(req:Request){
 let exchange:any;
 try{
  const {strategy}=await req.json() as {strategy:StrategySpec};
  if(!strategy?.asset||!strategy?.window)return NextResponse.json({ready:false,reason:'A compiled strategy is required.',history:[]},{status:400});
  if(strategy.interpretation?.needsClarification)return NextResponse.json({ready:false,reason:'DreamForge still has unresolved questions about this strategy.',details:strategy.interpretation.questions,history:[]},{status:409});
  exchange=createReadExchange();const client:any=exchange.client,intervalSec=strategy.window==='15m'?900:3600,now=Math.floor(Date.now()/1000);
  const rows=await client.listBinaryMarkets({status:'Finalized',asset:strategy.asset,intervalSec,orderBy:'newest',limit:36,offset:0} as any);
  const recent=(rows||[]).sort((a:any,b:any)=>Number(a.expiry||0)-Number(b.expiry||0)).map((m:any)=>({marketId:m.marketId,symbol:m.question||m.marketId,settlement:m.winningOutcome===0?'UP':m.winningOutcome===1?'DOWN':null,expiry:Number(m.expiry||0)})).filter((r:any)=>r.settlement);
  const prior=recent.map((r:any)=>r.settlement as 'UP'|'DOWN');
  const timeframes=requiredTimeframes(strategy),warmup=indicatorWarmup(strategy),barsByTf:Record<string,SpotBar[]>={};
  await Promise.all(timeframes.map(async tf=>{const lookback=timeframeSeconds(tf)*Math.max(4,warmup);barsByTf[tf]=await fetchSpotBars(exchange,strategy.asset,tf,now-lookback,now,Math.min(100,warmup))}));
  const result=createStrategyEvaluator(strategy,barsByTf).evaluate(now,prior),details=result.details.map(d=>({label:d.label,passed:d.passed,detail:d.detail}));
  const reason=result.passed?'All required strategy conditions are satisfied on completed market data.':details.filter(d=>!d.passed).map(d=>d.label).slice(0,3).join(' · ')||'Waiting for the strategy conditions.';
  return NextResponse.json({ready:result.passed,reason,details,history:recent.slice(-8)});
 }catch(e){return NextResponse.json({ready:false,reason:e instanceof Error?e.message:'Could not evaluate the live strategy signal.',history:[]},{status:503})}
 finally{try{await Promise.resolve(exchange?.close?.())}catch{}}
}
