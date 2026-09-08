'use client';

import {useEffect,useMemo,useState} from 'react';
import {formatUnits,parseUnits} from 'viem';
import {ORDER_TYPE} from '@somnia-chain/markets-sdk';
import type {MarketSnapshot,StrategySpec} from '@/lib/types';
import {connectShannonWallet,createWalletExchange} from '@/lib/wallet';
import {liveReadiness,matchingStrategyMarket} from '@/lib/live-readiness';
import StrategyStudio from '@/components/StrategyStudio';

const defaultPrompt="Trade BTC 15-minute UP contracts only when current price is inside the highest high and lowest low of the previous 20 completed 15-minute candles, RSI(14) is between 42 and 60, EMA20 is above EMA50, and volume is above its 20-period SMA. Only pay 58 cents or less. Risk $8 initially, $8 after wins, $3 after losses, and stop after losing $25 or 12 trades.";

type Signal={ready:boolean;reason:string;details?:{label:string;passed:boolean;detail:string}[];history?:{symbol?:string;settlement?:string|null}[]};
type RuleStat={label:string;checks:number;passes:number;passRate:number;lastDetail:string};
type Backtest={source:string;from:number;to:number;markets:number;candidateMarkets?:number;trades:number;wins:number;losses:number;winRate:number;pnl:number;returnPct:number;maxDrawdown:number;endingCapital:number;equity:number[];tradeLog:{marketId:string;time:number;side:string;settlement:string;entry:number;stake:number;pnl:number;equity:number}[];ruleStats?:RuleStat[];warnings:string[];durationMs?:number;cached?:boolean};
type StoredTrade={marketId:string;side:'UP'|'DOWN';stake:number;entry:number;time:number;quantity?:number;cost?:number;resolved?:boolean;pnl?:number};
type StoredRisk={startedAt:number;trades:StoredTrade[]};

function dateInput(d:Date){return d.toISOString().slice(0,10)}
function riskKey(s:StrategySpec){return `dreamforge-risk-v3:${s.asset}:${s.window}:${s.side}:${JSON.stringify(s.conditionGroups||s.trigger)}:${s.trigger.maxEntryPrice}:${s.risk.maxLossUsd}:${s.risk.maxTrades}:${s.risk.durationHours}`}
function loadRisk(s:StrategySpec):StoredRisk{try{return JSON.parse(localStorage.getItem(riskKey(s))||'') as StoredRisk}catch{return{startedAt:Date.now(),trades:[]}}}
function saveRisk(s:StrategySpec,state:StoredRisk){localStorage.setItem(riskKey(s),JSON.stringify(state))}

export default function Home(){
  const[prompt,setPrompt]=useState(defaultPrompt);
  const[strategy,setStrategy]=useState<StrategySpec|null>(null);
  const[markets,setMarkets]=useState<MarketSnapshot[]>([]);
  const[mode,setMode]=useState('offline');
  const[busy,setBusy]=useState(false);
  const[wallet,setWallet]=useState('');
  const[selected,setSelected]=useState<MarketSnapshot|null>(null);
  const[status,setStatus]=useState('READY');
  const[tx,setTx]=useState('');
  const[signal,setSignal]=useState<Signal|null>(null);
  const[backtest,setBacktest]=useState<Backtest|null>(null);
  const[backtestError,setBacktestError]=useState('');
  const[range,setRange]=useState<'7D'|'30D'|'90D'|'ALL'|'CUSTOM'>('30D');
  const[fromDate,setFromDate]=useState(dateInput(new Date(Date.now()-30*86400000)));
  const[toDate,setToDate]=useState(dateInput(new Date()));
  const[activated,setActivated]=useState(false);

  const needsReview=!!strategy?.interpretation?.needsClarification;
  const replayRules=useMemo(()=>strategy?.conditionGroups?.flatMap((g,gi)=>g.conditions.map(c=>({group:gi+1,label:c.label,type:c.type})))||[],[strategy]);

  async function refresh(){
    try{
      const r=await fetch('/api/markets',{cache:'no-store'}),d=await r.json(),next=Array.isArray(d.markets)?d.markets:[];
      setMarkets(next);setMode(r.ok&&Array.isArray(d.markets)?'live':'offline');
      setSelected(prev=>prev&&next.some((m:MarketSnapshot)=>m.id===prev.id)?next.find((m:MarketSnapshot)=>m.id===prev.id)??null:next[0]??null);
    }catch{setMode('offline')}
  }
  useEffect(()=>{refresh();const t=setInterval(refresh,15000);return()=>clearInterval(t)},[]);

  // Once a strategy is confirmed, keep the live-contract selection on the exact
  // asset/window that strategy can actually trade instead of leaving an unrelated
  // first market selected.
  useEffect(()=>{
    if(!strategy||!markets.length)return;
    setSelected(prev=>matchingStrategyMarket(markets,strategy,prev));
  },[strategy,markets]);

  async function checkSignal(s:StrategySpec){
    try{
      const r=await fetch('/api/signal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({strategy:s}),cache:'no-store'}),d=await r.json();
      setSignal({ready:!!d.ready,reason:d.reason||'Signal unavailable.',details:d.details||[],history:d.history||[]});
      return r.ok&&!!d.ready;
    }catch{
      setSignal({ready:false,reason:'Strategy data could not be verified. Trading stays locked.'});
      return false;
    }
  }
  useEffect(()=>{if(!strategy||!activated||needsReview)return;const t=setInterval(()=>checkSignal(strategy),15000);return()=>clearInterval(t)},[strategy,activated,needsReview]);

  async function connect(){try{setWallet(await connectShannonWallet())}catch(e:any){alert(e.message)}}
  function marketReady(){
    if(!strategy||!selected||strategy.asset!==selected.asset||strategy.window!==selected.window)return false;
    const px=strategy.side==='UP'?selected.upPrice:selected.downPrice;
    return px<=(strategy.trigger.maxEntryPrice??1);
  }

  const readiness=useMemo(()=>strategy?liveReadiness({strategy,needsReview,activated,venueLive:mode==='live',selected,signal,wallet}):null,[strategy,needsReview,activated,mode,selected,signal,wallet]);
  const liveReady=!!readiness?.ready;

  function resolvedRange(){
    const now=new Date();
    if(range==='CUSTOM')return{from:new Date(`${fromDate}T00:00:00`).toISOString(),to:new Date(`${toDate}T23:59:59`).toISOString()};
    if(range==='ALL')return{from:'1970-01-01T00:00:00.000Z',to:now.toISOString()};
    const days=range==='7D'?7:range==='90D'?90:30;
    return{from:new Date(now.getTime()-days*86400000).toISOString(),to:now.toISOString()};
  }

  async function runBacktest(){
    if(!strategy||needsReview)return;setBusy(true);setBacktestError('');
    try{
      const dates=resolvedRange(),r=await fetch('/api/backtest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({strategy,...dates,startingCapital:100})}),d=await r.json();
      if(!r.ok)throw new Error(d.error||'Backtest failed.');setBacktest(d);setStatus('BACKTEST READY');
    }catch(e:any){setBacktest(null);setBacktestError(e.message||'Backtest failed.')}finally{setBusy(false)}
  }

  async function reconcileRisk(client:any,s:StrategySpec){
    const state=loadRisk(s),sessionMs=Math.max(1,s.risk.durationHours)*3600000;
    if(Date.now()-state.startedAt>sessionMs){const fresh={startedAt:Date.now(),trades:[] as StoredTrade[]};saveRisk(s,fresh);return{state:fresh,size:s.sizing.baseUsd,pnl:0,count:0}}
    for(const t of state.trades.filter(x=>!x.resolved)){
      try{
        const oc=await client.getMarketOnchain(t.marketId as `0x${string}`);
        if(oc.isResolved){const won=(oc.winningOutcome===0?'UP':'DOWN')===t.side,cost=t.cost??t.stake,quantity=t.quantity??(t.entry>0?t.stake/t.entry:0);t.pnl=won?quantity-cost:-cost;t.resolved=true}
        else if(oc.isVoided){t.pnl=0;t.resolved=true}
      }catch{}
    }
    saveRisk(s,state);
    const resolved=state.trades.filter(t=>t.resolved),pnl=resolved.reduce((a,t)=>a+(t.pnl||0),0),last=resolved[resolved.length-1],size=last?(last.pnl||0)>=0?s.sizing.afterWinUsd:s.sizing.afterLossUsd:s.sizing.baseUsd;
    return{state,size,pnl,count:state.trades.length};
  }

  async function execute(){
    if(!wallet)return alert('Connect your wallet first.');
    if(!strategy||!selected||needsReview)return;
    if(!liveReady)return alert(readiness?.detail||'DreamForge is still waiting for your strategy conditions.');
    setBusy(true);setStatus('RECHECKING');let exchange:any,watch:any;
    try{
      const freshSignal=await checkSignal(strategy);if(!freshSignal)throw new Error('The strategy signal is no longer valid. No trade was sent.');
      const wx=await createWalletExchange();exchange=wx.exchange;const client:any=exchange.client,risk=await reconcileRisk(client,strategy);
      if(risk.count>=strategy.risk.maxTrades)throw new Error('Your strategy trade limit has been reached for this session.');
      if(risk.pnl<=-strategy.risk.maxLossUsd)throw new Error('Your strategy max-loss limit has been reached.');
      const oc=await client.getMarketOnchain(selected.id as `0x${string}`);if(oc.status!==1)throw new Error('This market has stopped trading.');
      const market=await client.getBinaryMarket(selected.id);if(!market)throw new Error('DreamDEX could not resolve this live market.');watch=await client.watchMarket(market.poolAddress);
      const room=Math.max(0,strategy.risk.maxLossUsd+risk.pnl),usd=Math.min(risk.size,room);if(usd<=0)throw new Error('No risk budget remains for this session.');
      const stake=parseUnits(String(usd),oc.decimals),quote=await client.quoteBinaryStake({marketId:selected.id,side:strategy.side==='UP'?'BUY_YES':'BUY_NO',stake,depth:10});if(!quote)throw new Error('There is not enough executable liquidity for this stake right now.');
      const quotedPrice=Number(formatUnits(quote.limitPrice,oc.decimals)),cap=strategy.trigger.maxEntryPrice??1;if(quotedPrice>cap)throw new Error(`Executable price is ${Math.round(quotedPrice*100)}¢, above your ${Math.round(cap*100)}¢ maximum. No trade was sent.`);
      setStatus('APPROVE IN WALLET');
      const result=await wx.trader.placeOrder({pool:oc.pool,side:quote.side,price:quote.yesPrice,quantity:quote.quantity,orderType:ORDER_TYPE.MARKET}),hash=(result as any)?.hash||(result as any)?.receipt?.transactionHash;if(!hash)throw new Error('DreamDEX did not return a confirmed transaction hash.');setTx(hash);
      const fills=Array.isArray((result as any)?.fills)?(result as any).fills:[];
      if(!fills.length){setStatus('ORDER SENT · NO FILL');alert('The transaction was mined, but the IOC found no fillable shares by execution time. No trade was added to your strategy history.');await refresh();return}
      const one=10n**BigInt(oc.decimals);let filledRaw=0n,costRaw=0n;
      for(const fill of fills){const q=BigInt(fill?.quantityFilled??fill?.quantity??0);if(q<=0n)continue;const yesPrice=BigInt(fill?.fillPrice??fill?.price??quote.yesPrice),ownPrice=strategy.side==='UP'?yesPrice:one-yesPrice;filledRaw+=q;costRaw+=(q*ownPrice)/one}
      if(filledRaw<=0n){setStatus('ORDER SENT · NO FILL');alert('The transaction was mined but DreamForge could not verify a positive filled quantity. It was not counted as a strategy trade.');await refresh();return}
      const actualQuantity=Number(formatUnits(filledRaw,oc.decimals)),actualCost=costRaw>0n?Number(formatUnits(costRaw,oc.decimals)):Number(formatUnits(quote.escrow,oc.decimals)),actualEntry=actualQuantity>0?actualCost/actualQuantity:quotedPrice;
      risk.state.trades.push({marketId:selected.id,side:strategy.side,stake:actualCost,entry:actualEntry,cost:actualCost,quantity:actualQuantity,time:Date.now()});saveRisk(strategy,risk.state);setStatus('TRADE FILLED');await refresh();
    }catch(e:any){setStatus('NO TRADE');alert(e?.shortMessage||e?.message||'Trade stopped safely.')}finally{try{watch?.stop?.()}catch{}try{await Promise.resolve(exchange?.close?.())}catch{}setBusy(false)}
  }

  const chart=useMemo(()=>{const eq=backtest?.equity||[];if(eq.length<2)return'';const min=Math.min(...eq),max=Math.max(...eq),span=Math.max(.01,max-min);return eq.map((v,i)=>`${(i/(eq.length-1))*100},${100-((v-min)/span)*100}`).join(' ')},[backtest]);

  return <main className="shell">
    <nav className="nav"><div className="brand">DreamForge</div><div className="navright"><span className={`dot ${mode}`}/><span className="network">DreamDEX · Shannon</span><button className="secondary" onClick={connect}>{wallet?`${wallet.slice(0,6)}…${wallet.slice(-4)}`:'Connect wallet'}</button></div></nav>
    <header className="intro"><div><span className="kicker">AGENTIC STRATEGY BUILDER · DETERMINISTIC EXECUTION</span><h1>Describe it. Refine it. See it. Then compile it.</h1><p>DreamForge chats through the strategy with you, visualizes the live setup and only locks a deterministic specification after you confirm the interpretation.</p></div><div className="statusbox"><span>STATUS</span><strong>{status}</strong><small>{strategy?needsReview?'Answer DreamForge’s question before testing.':activated?(readiness?.detail||'Watching the confirmed strategy.'):'Backtest the confirmed strategy before activation.':'Build and confirm a strategy to begin.'}</small></div></header>

    <StrategyStudio initialPrompt={prompt} onDraft={s=>setStatus(s.interpretation?.needsClarification?'DRAFT · NEEDS INPUT':'DRAFT READY')} onConfirm={(s,text)=>{setPrompt(text);setStrategy(s);setBacktest(null);setSignal(null);setBacktestError('');setActivated(false);setTx('');setStatus('STRATEGY CONFIRMED')}}/>

    {strategy&&<section className="panel backtest"><div className="panelhead"><span>02</span><div><h2>Backtest the exact confirmed rules</h2><p>DreamForge first finds historical contracts where your signal qualified, then loads binary-contract price history only for those candidates.</p></div></div><div className="rangebar">{(['7D','30D','90D','ALL','CUSTOM'] as const).map(x=><button key={x} className={range===x?'range active':'range'} onClick={()=>setRange(x)}>{x}</button>)}</div>{range==='CUSTOM'&&<div className="dates"><label>From<input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label>To<input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label></div>}<button className="primary" onClick={runBacktest} disabled={busy||needsReview}>{needsReview?'Answer DreamForge first':busy?'Running optimized replay…':'Run backtest'}</button>{backtestError&&<div className="notice bad">{backtestError}</div>}{backtest&&<><div className="metrics"><div><small>RETURN</small><b className={backtest.returnPct>=0?'good':'badtext'}>{backtest.returnPct>=0?'+':''}{backtest.returnPct}%</b></div><div><small>P&L</small><b>${backtest.pnl}</b></div><div><small>WIN RATE</small><b>{backtest.winRate}%</b></div><div><small>TRADES</small><b>{backtest.trades}</b></div><div><small>MAX DRAWDOWN</small><b>{backtest.maxDrawdown}%</b></div><div><small>MARKETS TESTED</small><b>{backtest.markets}</b></div></div>{backtest.candidateMarkets!==undefined&&<div className="notice">The compiled signal qualified on <b>{backtest.candidateMarkets}</b> of {backtest.markets} finalized contracts.{backtest.durationMs!==undefined&&<> Replay completed in {(backtest.durationMs/1000).toFixed(1)}s{backtest.cached?' from cache':''}.</>}</div>}{replayRules.length>0&&<div className="replayrules"><div className="replayruleshead"><div><small>INDICATORS & RULES REPLAYED</small><b>The result below used these exact confirmed conditions</b></div><span>{strategy.conditionGroups?.length||1} logic branch{(strategy.conditionGroups?.length||1)===1?'':'es'}</span></div><div className="replayrulegrid">{replayRules.map((r,i)=><div key={`${r.group}-${i}`}><em>GROUP {r.group} · {r.type.replaceAll('_',' ')}</em><b>{r.label}</b></div>)}</div></div>}{backtest.ruleStats&&backtest.ruleStats.length>0&&<div className="ruleactivity"><div className="ruleactivityhead"><div><small>HISTORICAL RULE ACTIVITY</small><b>How often each indicator condition was true while DreamForge scanned completed-data boundaries</b></div><span>Diagnostic only · not a standalone win probability</span></div><div className="ruleactivitygrid">{backtest.ruleStats.map((r,i)=><div key={`${r.label}-${i}`}><div><b>{r.label}</b><span>{r.passes.toLocaleString()} / {r.checks.toLocaleString()} checks</span></div><strong>{r.passRate}%</strong><i><span style={{width:`${Math.max(0,Math.min(100,r.passRate))}%`}}/></i><small>{r.lastDetail}</small></div>)}</div></div>}<div className="chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={chart}/></svg><div><span>$100 start</span><span>${backtest.endingCapital} end</span></div></div>{backtest.warnings?.map((w,i)=><div key={i} className="notice">{w}</div>)}<details><summary>View {backtest.tradeLog?.length||0} historical trades</summary><div className="trades">{backtest.tradeLog?.map((t,i)=><div key={t.marketId+i}><span>{new Date(t.time*1000).toLocaleString()}</span><b>{t.side} @ {Math.round(t.entry*100)}¢</b><span>${t.stake}</span><strong className={t.pnl>=0?'good':'badtext'}>{t.pnl>=0?'+':''}${t.pnl}</strong></div>)}</div></details><button className="primary activate" onClick={()=>{setActivated(true);setStatus('WATCHING');checkSignal(strategy)}}>{activated?'Strategy active':'Activate live strategy'}</button></>}</section>}

    {strategy&&activated&&<><div className="workspace"><section className="panel markets"><div className="panelhead"><span>03</span><div><h2>Live contracts</h2><p>DreamForge automatically selects the live contract matching your confirmed asset and timeframe. You can still inspect the others.</p></div></div><div className="marketlist">{markets.length===0&&<div className="empty">No live DreamDEX contracts available.</div>}{markets.map(m=><button className={`market ${selected?.id===m.id?'selected':''}`} key={m.id} onClick={()=>setSelected(m)}><div><b>{m.asset} <em>{m.window}</em></b><small>{m.symbol}</small></div><div className="prices"><span>UP <b>{Math.round(m.upPrice*100)}¢</b></span><span>DOWN <b>{Math.round(m.downPrice*100)}¢</b></span></div></button>)}</div></section><section className="panel action"><div className="panelhead"><span>04</span><div><h2>Live trade readiness</h2><p>Every blocker is shown explicitly. The button unlocks only when the confirmed signal, matching contract, price limit, DreamDEX feed and wallet all pass.</p></div></div><div className="checks"><div className={signal?.ready?'check pass':'check wait'}><i>{signal?.ready?'✓':'1'}</i><div><b>Confirmed strategy signal</b><span>{signal?.reason||'Checking completed underlying candles and finalized contracts…'}</span>{signal?.details?.slice(0,6).map((d,i)=><small key={i}>{d.passed?'✓':'○'} {d.label}: {d.detail}</small>)}</div></div><div className={marketReady()?'check pass':'check wait'}><i>{marketReady()?'✓':'2'}</i><div><b>Matching contract + price</b><span>{!selected||selected.asset!==strategy.asset||selected.window!==strategy.window?`Waiting for a live ${strategy.asset} ${strategy.window} contract.`:marketReady()?`${strategy.side} is ${Math.round((strategy.side==='UP'?selected.upPrice:selected.downPrice)*100)}¢, within your ${Math.round((strategy.trigger.maxEntryPrice??1)*100)}¢ limit.`:`${strategy.side} is ${Math.round((strategy.side==='UP'?selected.upPrice:selected.downPrice)*100)}¢, above your ${Math.round((strategy.trigger.maxEntryPrice??1)*100)}¢ maximum.`}</span></div></div><div className={wallet?'check pass':'check wait'}><i>{wallet?'✓':'3'}</i><div><b>Wallet</b><span>{wallet?'Connected. You approve every transaction.':'Connect your wallet when you are ready.'}</span></div></div></div><button className="primary trade" onClick={execute} disabled={busy||!liveReady}>{busy?'Rechecking confirmed rules…':readiness?.buttonLabel||'Checking live readiness…'}</button>{readiness&&!readiness.ready&&<div className="notice">{readiness.detail}</div>}{tx&&<a className="proof" href={`https://shannon-explorer.somnia.network/tx/${tx}`} target="_blank" rel="noreferrer">View transaction ↗</a>}<p className="fineprint">The AI is used to understand intent only. Deterministic code evaluates indicators, risk and execution. A mined IOC counts as a trade only when DreamDEX reports an actual fill. Your wallet approves every write.</p></section></div></>}
    <footer>DreamForge · Conversational strategy design · Live strategy canvas · Deterministic rules · Non-custodial · Somnia Shannon</footer>
  </main>;
}
