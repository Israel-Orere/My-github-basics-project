import {NextResponse} from 'next/server';
import {createReadExchange} from '@/lib/dreamdex';
import type {StrategySpec} from '@/lib/types';

export async function POST(req:Request){
 let exchange:any;
 try{
  const {strategy}=await req.json() as {strategy:StrategySpec};
  if(!strategy?.trigger?.streakLength||!strategy.trigger.streakSide)return NextResponse.json({ready:true,reason:'No settlement streak required.',history:[]});
  exchange=createReadExchange();const client:any=exchange.client;const n=strategy.trigger.streakLength;const intervalSec=strategy.window==='15m'?900:3600;
  const rows=await client.listBinaryMarkets({status:'Finalized',asset:strategy.asset,intervalSec,orderBy:'newest',limit:Math.max(12,n+4),offset:0} as any);
  const recent=(rows||[]).sort((a:any,b:any)=>Number(b.expiry||0)-Number(a.expiry||0)).slice(0,n).map((m:any)=>({marketId:m.marketId,symbol:m.question||m.marketId,settlement:m.winningOutcome===0?'UP':m.winningOutcome===1?'DOWN':null,expiry:Number(m.expiry||0)}));
  const ready=recent.length===n&&recent.every((r:any)=>r.settlement===strategy.trigger.streakSide);
  return NextResponse.json({ready,reason:ready?`The last ${n} ${strategy.asset} ${strategy.window} contracts settled ${strategy.trigger.streakSide}.`:`Waiting for ${n} ${strategy.trigger.streakSide} results in a row.`,history:recent});
 }catch(e){return NextResponse.json({ready:false,reason:e instanceof Error?e.message:'Could not verify finalized DreamDEX results.',history:[]},{status:503})}
 finally{try{await Promise.resolve(exchange?.close?.())}catch{}}
}
