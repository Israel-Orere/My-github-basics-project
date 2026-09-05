import {NextResponse} from 'next/server';
import {createReadExchange,getLiveMarkets} from '@/lib/dreamdex';
import {compileStrategyWithAgent} from '@/lib/strategy-agent';
import {fetchSpotBars} from '@/lib/spot-history';

export const dynamic='force-dynamic';
export const maxDuration=30;
export async function GET(req:Request){
 const started=Date.now();
 try{
  const markets=await getLiveMarkets();
  const url=new URL(req.url);
  if(url.searchParams.get('deep')!=='strategy-os-2026-09-05')return NextResponse.json({ok:true,service:'DreamForge',network:'Somnia Shannon',chainId:50312,liveMarkets:markets.length,latencyMs:Date.now()-started,execution:'wallet-authorized only',syntheticFallback:false});
  const compiled=await compileStrategyWithAgent('Trade BTC 15-minute UP when RSI 14 on the 15-minute chart crosses above its 9-period EMA. Only enter if UP is 65 cents or less. Stake $5 and stop after losing $15.');
  let exchange:any;let bars=0;let spotError='';
  try{exchange=createReadExchange();const now=Math.floor(Date.now()/1000);bars=(await fetchSpotBars(exchange,'BTC','15m',now-4*3600,now,40)).length}catch(e){spotError=e instanceof Error?e.message:'spot candle check failed'}finally{try{await Promise.resolve(exchange?.close?.())}catch{}}
  const agentOk=compiled.compiler==='agent'&&!compiled.interpretation?.needsClarification&&(compiled.conditionGroups?.some(g=>g.conditions.some(c=>c.type==='CROSS'))??false);
  const spotOk=bars>0;
  return NextResponse.json({ok:agentOk&&spotOk,service:'DreamForge',network:'Somnia Shannon',liveMarkets:markets.length,agent:{ok:agentOk,compiler:compiled.compiler,summary:compiled.interpretation?.summary,conditions:compiled.conditionGroups?.flatMap(g=>g.conditions.map(c=>c.label))||[],questions:compiled.interpretation?.questions||[]},spot:{ok:spotOk,bars,error:spotError||undefined},latencyMs:Date.now()-started},{status:agentOk&&spotOk?200:503});
 }catch(e){return NextResponse.json({ok:false,service:'DreamForge',network:'Somnia Shannon',chainId:50312,error:e instanceof Error?e.message:'health check failed',syntheticFallback:false},{status:503})}
}
