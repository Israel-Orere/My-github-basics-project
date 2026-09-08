import {NextResponse} from 'next/server';
import {compileStrategyResilient} from '@/lib/strategy-compiler';
export const maxDuration=30;
export async function POST(req:Request){
 try{
  const {prompt}=await req.json();
  if(!prompt||typeof prompt!=='string')return NextResponse.json({error:'Describe the strategy you want DreamForge to understand.'},{status:400});
  const strategy=await compileStrategyResilient(prompt.trim());
  return NextResponse.json(strategy,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Strategy interpretation failed.'},{status:500})}
}