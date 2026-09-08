import {NextResponse} from 'next/server';
import {compileStrategyResilient} from '@/lib/strategy-compiler';

type ChatMessage={role:'user'|'assistant';content:string};

function transcript(messages:ChatMessage[]){
  const userTurns=messages.filter(m=>m.role==='user'&&m.content.trim()).slice(-12);
  return [
    'This is an interactive DreamForge strategy-design conversation.',
    'Treat later user turns as refinements or corrections to earlier turns. Preserve earlier rules unless the user explicitly changes or removes them.',
    'Return the best current deterministic draft and surface any unresolved ambiguity instead of guessing.',
    '',
    ...userTurns.map((m,i)=>`USER TURN ${i+1}:\n${m.content.trim()}`)
  ].join('\n\n');
}

export const maxDuration=60;
export async function POST(req:Request){
  try{
    const body=await req.json() as {messages?:ChatMessage[]};
    const messages=Array.isArray(body.messages)?body.messages:[];
    if(!messages.some(m=>m?.role==='user'&&String(m.content||'').trim()))return NextResponse.json({error:'Tell DreamForge what you want to trade first.'},{status:400});
    const prompt=transcript(messages);
    const strategy=await compileStrategyResilient(prompt);
    const i=strategy.interpretation;
    return NextResponse.json({
      strategy,
      reply:{
        summary:i?.summary||`${strategy.asset} ${strategy.window} ${strategy.side} strategy draft.`,
        understood:i?.entry||[],
        execution:i?.execution||[],
        sizing:i?.sizing||[],
        risk:i?.risk||[],
        assumptions:i?.assumptions||[],
        questions:i?.questions||[],
        confidence:i?.confidence??0,
        needsClarification:!!i?.needsClarification,
        compiler:strategy.compiler||'agent'
      },
      transcript:prompt
    });
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'DreamForge could not update the strategy draft.'},{status:500});
  }
}
