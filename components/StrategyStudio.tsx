'use client';

import {useMemo,useState} from 'react';
import type {IndicatorTimeframe,StrategySpec} from '@/lib/types';
import styles from './StrategyStudio.module.css';

type Reply={summary:string;understood:string[];execution:string[];sizing:string[];risk:string[];assumptions:string[];questions:string[];confidence:number;needsClarification:boolean;compiler:string};
type ChatMessage={id:number;role:'user'|'assistant';content:string;reply?:Reply};
type ChartBar={time:number;open:number;high:number;low:number;close:number;volume:number};
type ChartOverlay={id:string;label:string;kind:string;values:(number|null)[]};
type ChartBand={id:string;label:string;period:number;offsetBars:number;upper:(number|null)[];lower:(number|null)[]};
type ChartMarker={time:number;price:number;label:string};
type ChartData={asset:string;timeframe:IndicatorTimeframe;availableTimeframes:IndicatorTimeframe[];bars:ChartBar[];overlays:ChartOverlay[];bands:ChartBand[];markers:ChartMarker[];latestDetails:{label:string;passed:boolean;detail:string}[];ignoredSettlementRules?:number;technicalOnly?:boolean;updatedAt?:number;warning?:string};

type Props={
  initialPrompt:string;
  onDraft?:(strategy:StrategySpec)=>void;
  onConfirm:(strategy:StrategySpec,transcript:string)=>void;
};

const welcome='Describe the strategy exactly as you would explain it to another trader. I’ll restate what I think you mean, flag anything ambiguous, and update a live market chart. Nothing becomes executable until you confirm the final rules.';

function buildTranscript(messages:ChatMessage[]){
  const turns=messages.filter(m=>m.role==='user').slice(-12);
  return [
    'This is an interactive DreamForge strategy-design conversation.',
    'Treat later user turns as refinements or corrections to earlier turns. Preserve earlier rules unless the user explicitly changes or removes them.',
    'Return the best current deterministic draft and surface any unresolved ambiguity instead of guessing.',
    '',
    ...turns.map((m,i)=>`USER TURN ${i+1}:\n${m.content}`)
  ].join('\n\n');
}

function ChatBubble({message}:{message:ChatMessage}){
  if(message.role==='user')return <div className={`${styles.bubble} ${styles.userBubble}`}><small>YOU</small><p>{message.content}</p></div>;
  const r=message.reply;
  return <div className={`${styles.bubble} ${styles.agentBubble}`}><small>DREAMFORGE</small>{r?<>
    <p className={styles.agentSummary}>{r.summary}</p>
    {r.understood?.length>0&&<div className={styles.chatRules}>{r.understood.slice(0,8).map((x,i)=><div key={i}><span>✓</span><p>{x}</p></div>)}</div>}
    {r.assumptions?.length>0&&<div className={styles.miniNotice}><b>Assumptions</b>{r.assumptions.map((x,i)=><p key={i}>{x}</p>)}</div>}
    {r.questions?.length>0&&<div className={`${styles.miniNotice} ${styles.questionNotice}`}><b>Need your answer</b>{r.questions.map((x,i)=><p key={i}>{x}</p>)}</div>}
    <div className={styles.confidenceRow}><span>{Math.round((r.confidence||0)*100)}% interpretation confidence</span><span>{r.compiler==='agent'?'Agent draft':'Safe fallback'}</span></div>
  </>:<p>{message.content}</p>}</div>;
}

function ChartView({data}:{data:ChartData}){
  const model=useMemo(()=>{
    const bars=data.bars||[];if(!bars.length)return null;const values:number[]=[];for(const b of bars)values.push(b.low,b.high);for(const o of data.overlays||[])for(const v of o.values)if(typeof v==='number'&&Number.isFinite(v))values.push(v);for(const band of data.bands||[])for(const v of [...band.upper,...band.lower])if(typeof v==='number'&&Number.isFinite(v))values.push(v);const lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.06,hi*.002,1),min=lo-pad,max=hi+pad,w=900,h=360,left=18,right=72,top=16,bottom=38,plotW=w-left-right,plotH=h-top-bottom;const x=(i:number)=>left+(bars.length===1?plotW/2:(i/(bars.length-1))*plotW),y=(v:number)=>top+((max-v)/(max-min))*plotH;return{bars,min,max,w,h,left,right,top,bottom,plotW,plotH,x,y};
  },[data]);
  if(!model)return <div className={styles.chartEmpty}>{data.warning||'No completed spot candles are available yet.'}</div>;
  const {bars,min,max,w,h,left,top,plotW,plotH,x,y}=model,candleW=Math.max(2,Math.min(8,plotW/Math.max(1,bars.length)*.55)),markerByTime=new Map((data.markers||[]).map(m=>[m.time,m]));
  const firstBand=data.bands?.[0];let bandArea='';if(firstBand){const upper=firstBand.upper.map((v,i)=>typeof v==='number'?`${x(i)},${y(v)}`:null).filter(Boolean),lower=firstBand.lower.map((v,i)=>typeof v==='number'?`${x(i)},${y(v)}`:null).filter(Boolean).reverse();if(upper.length&&lower.length)bandArea=[...upper,...lower].join(' ')}
  const timeLabel=(t:number)=>new Date(t*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),price=(v:number)=>v>=1000?v.toLocaleString(undefined,{maximumFractionDigits:0}):v.toLocaleString(undefined,{maximumFractionDigits:2});
  return <div className={styles.chartWrap}>
    <svg className={styles.strategyChart} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${data.asset} ${data.timeframe} strategy chart`}>
      <rect x={left} y={top} width={plotW} height={plotH} className={styles.plotBg}/>
      {[0,.25,.5,.75,1].map((p,i)=><line key={i} x1={left} x2={left+plotW} y1={top+p*plotH} y2={top+p*plotH} className={styles.gridLine}/>)}
      {bandArea&&<polygon points={bandArea} className={styles.rangeArea}><title>{firstBand?.label}</title></polygon>}
      {(data.bands||[]).slice(0,2).map((band,bi)=><g key={band.id}>{(['upper','lower'] as const).map(edge=>{const vals=band[edge],pts=vals.map((v,i)=>typeof v==='number'?`${x(i)},${y(v)}`:null).filter(Boolean).join(' ');return <polyline key={edge} points={pts} className={bi===0?styles.rangeLine:styles.rangeLineSecondary}/>})}</g>)}
      {bars.map((b,i)=>{const up=b.close>=b.open,cx=x(i),marker=markerByTime.get(b.time);return <g key={b.time}><line x1={cx} x2={cx} y1={y(b.high)} y2={y(b.low)} className={up?styles.candleUp:styles.candleDown}/><rect x={cx-candleW/2} y={Math.min(y(b.open),y(b.close))} width={candleW} height={Math.max(1,Math.abs(y(b.open)-y(b.close)))} className={up?styles.bodyUp:styles.bodyDown}/>{marker&&<circle cx={cx} cy={y(marker.price)-10} r="4.5" className={styles.signalMarker}><title>{marker.label}</title></circle>}</g>})}
      {(data.overlays||[]).slice(0,5).map((o,idx)=>{const pts=o.values.map((v,i)=>typeof v==='number'?`${x(i)},${y(v)}`:null).filter(Boolean).join(' ');return <polyline key={o.id} points={pts} className={`${styles.overlay} ${styles[`overlay${idx+1}` as keyof typeof styles]||''}`}><title>{o.label}</title></polyline>})}
      <text x={left+plotW+8} y={top+10} className={styles.axisText}>{price(max)}</text><text x={left+plotW+8} y={top+plotH/2} className={styles.axisText}>{price((max+min)/2)}</text><text x={left+plotW+8} y={top+plotH} className={styles.axisText}>{price(min)}</text>
      <text x={left} y={h-10} className={styles.axisText}>{timeLabel(bars[0].time)}</text><text x={left+plotW/2} y={h-10} textAnchor="middle" className={styles.axisText}>{timeLabel(bars[Math.floor(bars.length/2)].time)}</text><text x={left+plotW} y={h-10} textAnchor="end" className={styles.axisText}>{timeLabel(bars[bars.length-1].time)}</text>
    </svg>
    <div className={styles.legend}><span><i className={styles.rangeSwatch}/>Rolling range</span>{(data.overlays||[]).slice(0,5).map((o,i)=><span key={o.id}><i className={`${styles.lineSwatch} ${styles[`legend${i+1}` as keyof typeof styles]||''}`}/>{o.label}</span>)}{data.markers?.length>0&&<span><i className={styles.markerSwatch}/>Technical setup match</span>}</div>
  </div>;
}

export default function StrategyStudio({initialPrompt,onDraft,onConfirm}:Props){
  const[messages,setMessages]=useState<ChatMessage[]>([{id:1,role:'assistant',content:welcome}]),[input,setInput]=useState(initialPrompt),[draft,setDraft]=useState<StrategySpec|null>(null),[reply,setReply]=useState<Reply|null>(null),[transcript,setTranscript]=useState(''),[busy,setBusy]=useState(false),[chartBusy,setChartBusy]=useState(false),[chart,setChart]=useState<ChartData|null>(null),[chartError,setChartError]=useState(''),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false);
  const needsClarification=!!reply?.needsClarification||!!draft?.interpretation?.needsClarification,canConfirm=!!draft&&!needsClarification&&draft.compiler==='agent'&&!busy,chartTimeframes=chart?.availableTimeframes||[];

  async function loadChart(strategy:StrategySpec,timeframe?:IndicatorTimeframe){setChartBusy(true);setChartError('');try{const r=await fetch('/api/chart',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({strategy,timeframe,limit:72}),cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Chart unavailable.');setChart(d)}catch(e:any){setChartError(e.message||'Chart unavailable.')}finally{setChartBusy(false)}}

  async function send(){const text=input.trim();if(!text||busy)return;setBusy(true);setError('');setConfirmed(false);const userMessage:ChatMessage={id:Date.now(),role:'user',content:text},next=[...messages,userMessage];setMessages(next);setInput('');try{const r=await fetch('/api/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:next.map(({role,content})=>({role,content}))})});const d=await r.json();if(!r.ok)throw new Error(d.error||'DreamForge could not interpret that refinement.');const agentMessage:ChatMessage={id:Date.now()+1,role:'assistant',content:d.reply?.summary||'Draft updated.',reply:d.reply};setMessages(m=>[...m,agentMessage]);setDraft(d.strategy);setReply(d.reply);setTranscript(d.transcript||buildTranscript(next));onDraft?.(d.strategy);await loadChart(d.strategy)}catch(e:any){setError(e.message||'DreamForge could not update the draft.')}finally{setBusy(false)}}

  async function confirm(){if(!draft||!canConfirm)return;setBusy(true);setError('');try{const finalTranscript=transcript||buildTranscript(messages),r=await fetch('/api/compile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:finalTranscript})}),s=await r.json();if(!r.ok)throw new Error(s.error||'Final compilation failed.');if(s.compiler!=='agent'||s.interpretation?.needsClarification){setDraft(s);setReply({summary:s.interpretation?.summary||'The final compile still needs review.',understood:s.interpretation?.entry||[],execution:s.interpretation?.execution||[],sizing:s.interpretation?.sizing||[],risk:s.interpretation?.risk||[],assumptions:s.interpretation?.assumptions||[],questions:s.interpretation?.questions||['DreamForge needs another refinement before it can finalize this strategy.'],confidence:s.interpretation?.confidence||0,needsClarification:true,compiler:s.compiler||'deterministic-fallback'});throw new Error('The final deterministic pass found something that still needs clarification. Refine the strategy once more.')}setDraft(s);setConfirmed(true);onConfirm(s,finalTranscript);setMessages(m=>[...m,{id:Date.now()+2,role:'assistant',content:'Strategy confirmed. The deterministic specification is now locked for backtesting; any new message will create a new draft version.'}]);await loadChart(s,chart?.timeframe)}catch(e:any){setError(e.message||'Could not confirm strategy.')}finally{setBusy(false)}}

  return <section className={styles.studio}>
    <div className={styles.studioHead}><div><span>01</span><div><h2>Build the strategy with DreamForge</h2><p>Chat until the interpretation is right. The chart and rule map update with every refinement; execution stays locked until you confirm.</p></div></div><div className={`${styles.draftBadge} ${confirmed?styles.confirmed:needsClarification?styles.needsInput:''}`}><b>{confirmed?'CONFIRMED':needsClarification?'NEEDS INPUT':draft?'DRAFT READY':'DRAFT'}</b><small>{draft?`${draft.asset} ${draft.window} · ${draft.side}`:'Not executable'}</small></div></div>

    <div className={styles.workspace}>
      <div className={styles.chatColumn}>
        <div className={styles.chatLog}>{messages.map(m=><ChatBubble key={m.id} message={m}/>)}</div>
        {error&&<div className={styles.errorBox}>{error}</div>}
        <div className={styles.composer}><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send()}}} placeholder={draft?'Refine it — e.g. “make that 30 bars, change RSI to 45–58, and only trade 08:00–12:00 Africa/Lagos.”':'Describe a complex trading idea…'}/><div className={styles.composerActions}><span>Ctrl/⌘ + Enter to send</span><button className={styles.sendButton} onClick={send} disabled={busy||!input.trim()}>{busy?'Updating draft…':draft?'Send refinement':'Interpret strategy'}</button></div></div>
        {draft&&<div className={styles.confirmBar}><div><b>{needsClarification?'DreamForge still needs an answer.':'Satisfied with this interpretation?'}</b><span>{confirmed?'This version is locked for backtesting. Send another message to create a new draft.':needsClarification?'Answer in the chat above; nothing can be backtested or traded yet.':'Run one final deterministic compile and then unlock the existing backtest/live workflow.'}</span></div><button onClick={confirm} disabled={!canConfirm||confirmed}>{confirmed?'Strategy confirmed':needsClarification?'Resolve questions first':'Confirm strategy'}</button></div>}
      </div>

      <div className={styles.visualColumn}>
        <div className={styles.visualHead}><div><small>LIVE STRATEGY CANVAS</small><h3>{draft?`${draft.asset} setup · ${chart?.timeframe||draft.window}`:'Chart appears after the first interpretation'}</h3></div>{chartTimeframes.length>0&&<div className={styles.timeframes}>{chartTimeframes.map(tf=><button key={tf} className={chart?.timeframe===tf?styles.activeTf:''} onClick={()=>draft&&loadChart(draft,tf)} disabled={chartBusy}>{tf}</button>)}</div>}</div>
        {chartBusy&&!chart&&<div className={styles.chartEmpty}>Loading completed DreamDEX spot candles and mapping the draft rules…</div>}
        {!chartBusy&&!chart&&!chartError&&<div className={styles.chartEmpty}><b>No final compile required.</b><span>As soon as DreamForge understands the first draft, this panel will draw the live underlying market, rolling ranges, indicator overlays and technical setup markers.</span></div>}
        {chartError&&<div className={styles.chartError}>{chartError}</div>}
        {chart&&<><ChartView data={chart}/>{chart.technicalOnly&&<div className={styles.canvasNote}>Chart markers show the technical portion of the setup. {chart.ignoredSettlementRules} DreamDEX settlement rule{chart.ignoredSettlementRules===1?' is':'s are'} evaluated separately at execution time.</div>}{chart.latestDetails?.length>0&&<div className={styles.ruleMap}><div className={styles.ruleMapHead}><b>Latest completed-bar checks</b><span>{chart.markers?.length||0} recent technical matches shown</span></div>{chart.latestDetails.map((d,i)=><div key={i} className={d.passed?styles.rulePass:styles.ruleWait}><i>{d.passed?'✓':'○'}</i><div><b>{d.label}</b><span>{d.detail}</span></div></div>)}</div>}</>}
        {reply&&<div className={styles.ruleSummary}><div><small>UNDERSTOOD</small><b>{reply.understood.length} entry rule{reply.understood.length===1?'':'s'}</b></div><div><small>ASSUMPTIONS</small><b>{reply.assumptions.length}</b></div><div><small>OPEN QUESTIONS</small><b>{reply.questions.length}</b></div><div><small>CONFIDENCE</small><b>{Math.round(reply.confidence*100)}%</b></div></div>}
      </div>
    </div>
  </section>;
}
