import {NextResponse} from 'next/server';
import {applyChartStrategyEdit,type ChartStrategyEdit} from '@/lib/chart-strategy-edit';
import type {StrategySpec} from '@/lib/types';

export async function POST(req:Request){
 try{
  const body=await req.json() as {strategy?:StrategySpec;edit?:ChartStrategyEdit};
  if(!body.strategy||!body.edit)return NextResponse.json({error:'A strategy and chart edit are required.'},{status:400});
  const strategy=applyChartStrategyEdit(body.strategy,body.edit);
  return NextResponse.json({strategy,summary:strategy.interpretation?.summary||'Chart edit applied.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Chart edit failed.'},{status:400})}
}
