'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import type {IndicatorTimeframe,StrategySpec} from '@/lib/types';
import type {ChartStrategyEdit} from '@/lib/chart-strategy-edit';
import styles from './InteractiveStrategyChart.module.css';

type ChartBar={time:number;open:number;high:number;low:number;close:number;volume:number};
type ChartOverlay={id:string;label:string;kind:string;values:(number|null)[]};
type ChartPanel={id:string;key:string;label:string;series:ChartOverlay[];references:{label:string;value:number}[]};
type ChartBand={id:string;label:string;period:number;offsetBars:number;upper:(number|null)[];lower:(number|null)[]};
type ChartMarker={time:number;price:number;label:string};
export type InteractiveChartData={asset:string;timeframe:IndicatorTimeframe;availableTimeframes:IndicatorTimeframe[];bars:ChartBar[];overlays:ChartOverlay[];panels?:ChartPanel[];bands:ChartBand[];markers:ChartMarker[];latestDetails:{label:string;passed:boolean;detail:string}[];ignoredSettlementRules?:number;technicalOnly?:boolean;sourceByTf?:Partial<Record<IndicatorTimeframe,string>>;warnings?:string[];updatedAt?:number;warning?:string};

type Props={data:InteractiveChartData;strategy:StrategySpec;busy?:boolean;onEdit:(edit:ChartStrategyEdit)=>Promise<void>|void};
type PickMode='cursor'|'above'|'below'|'range';

function n(v:number){return v>=1000?v.toLocaleString(undefined,{maximumFractionDigits:2}):v.toLocaleString(undefined,{maximumFractionDigits:4})}
function sameTf(tf:IndicatorTimeframe|undefined,s:StrategySpec,current:IndicatorTimeframe){return(tf||s.window)===current}
function rulePriceLines(strategy:StrategySpec,current:IndicatorTimeframe){const out:{price:number;title:string}[]=[];for(const g of strategy.conditionGroups||[])for(const c of g.conditions){if(c.type!=='COMPARE')continue;const left=c.left,right=c.right;if(left.kind==='PRICE'&&right.kind==='CONSTANT'&&sameTf(left.timeframe,strategy,current)&&Number.isFinite(right.value))out.push({price:Number(right.value),title:c.label});else if(right.kind==='PRICE'&&left.kind==='CONSTANT'&&sameTf(right.timeframe,strategy,current)&&Number.isFinite(left.value))out.push({price:Number(left.value),title:c.label})}return out}

export default function InteractiveStrategyChart({data,strategy,busy,onEdit}:Props){
 const containerRef=useRef<HTMLDivElement|null>(null),chartRef=useRef<any>(null),modeRef=useRef<PickMode>('cursor'),rangeRef=useRef<number|null>(null),onEditRef=useRef(onEdit);
 const[mode,setMode]=useState<PickMode>('cursor'),[rangeAnchor,setRangeAnchor]=useState<number|null>(null),[hover,setHover]=useState<{time?:number;open?:number;high?:number;low?:number;close?:number}|null>(null),[applying,setApplying]=useState(false);
 const[rule,setRule]=useState<'rsi'|'ma'|'volume'|'range'>('rsi'),[rsiPeriod,setRsiPeriod]=useState(14),[rsiLow,setRsiLow]=useState(42),[rsiHigh,setRsiHigh]=useState(60),[maKind,setMaKind]=useState<'EMA'|'SMA'>('EMA'),[maFast,setMaFast]=useState(20),[maSlow,setMaSlow]=useState(50),[maDirection,setMaDirection]=useState<'above'|'below'>('above'),[volPeriod,setVolPeriod]=useState(20),[volMultiplier,setVolMultiplier]=useState(1),[rangePeriod,setRangePeriod]=useState(20),[rangeLow,setRangeLow]=useState(0),[rangeHigh,setRangeHigh]=useState(25);
 useEffect(()=>{modeRef.current=mode},[mode]);useEffect(()=>{onEditRef.current=onEdit},[onEdit]);
 const activeRules=useMemo(()=>strategy.conditionGroups?.flatMap((g,gi)=>g.conditions.map((c,ci)=>({groupIndex:gi,conditionIndex:ci,label:c.label,type:c.type})))||[],[strategy]);
 async function apply(edit:ChartStrategyEdit){if(applying||busy)return;setApplying(true);try{await onEditRef.current(edit)}finally{setApplying(false)}}
 function choose(next:PickMode){rangeRef.current=null;setRangeAnchor(null);setMode(next)}
 async function applyBuilder(){if(rule==='rsi')await apply({type:'rsiBand',period:rsiPeriod,low:rsiLow,high:rsiHigh,timeframe:data.timeframe});else if(rule==='ma')await apply({type:'maRelation',kind:maKind,fast:maFast,slow:maSlow,direction:maDirection,timeframe:data.timeframe});else if(rule==='volume')await apply({type:'volumeSma',period:volPeriod,multiplier:volMultiplier,timeframe:data.timeframe});else await apply({type:'rangePosition',period:rangePeriod,lowPct:rangeLow,highPct:rangeHigh,timeframe:data.timeframe})}

 useEffect(()=>{let disposed=false,resize:any;const el=containerRef.current;if(!el||!data.bars?.length)return; (async()=>{
  const lw=await import('lightweight-charts');if(disposed||!containerRef.current)return;
  const height=Math.min(860,Math.max(500,410+(data.panels?.length||0)*120));
  const chart=lw.createChart(containerRef.current,{width:containerRef.current.clientWidth,height,layout:{background:{type:lw.ColorType.Solid,color:'#070d08'},textColor:'#8d998f',panes:{separatorColor:'#172019',separatorHoverColor:'#263a2a',enableResize:true}},grid:{vertLines:{color:'#101812'},horzLines:{color:'#101812'}},rightPriceScale:{borderColor:'#1c281f'},timeScale:{borderColor:'#1c281f',timeVisible:true,secondsVisible:false,rightOffset:4,barSpacing:8},crosshair:{mode:lw.CrosshairMode.Normal,vertLine:{labelBackgroundColor:'#283b2a'},horzLine:{labelBackgroundColor:'#283b2a'}},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true}} as any);chartRef.current=chart;
  const candles=chart.addSeries(lw.CandlestickSeries,{upColor:'#83d77b',downColor:'#c86f72',wickUpColor:'#83d77b',wickDownColor:'#c86f72',borderVisible:false,priceLineVisible:true,lastValueVisible:true} as any,0);
  candles.setData(data.bars.map(b=>({time:b.time as any,open:b.open,high:b.high,low:b.low,close:b.close})));
  for(const [idx,o] of (data.overlays||[]).entries()){const line=chart.addSeries(lw.LineSeries,{title:o.label,lineWidth:idx===0?2:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:true} as any,0);line.setData(o.values.map((v,i)=>typeof v==='number'&&Number.isFinite(v)?{time:data.bars[i]?.time as any,value:v}:null).filter(Boolean) as any)}
  for(const band of data.bands||[]){for(const [edge,vals] of [['High',band.upper],['Low',band.lower]] as const){const line=chart.addSeries(lw.LineSeries,{title:`${band.label} ${edge}`,lineWidth:1,lineStyle:lw.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false} as any,0);line.setData(vals.map((v,i)=>typeof v==='number'&&Number.isFinite(v)?{time:data.bars[i]?.time as any,value:v}:null).filter(Boolean) as any)}}
  for(const r of rulePriceLines(strategy,data.timeframe))candles.createPriceLine({price:r.price,title:r.title,lineWidth:1,lineStyle:lw.LineStyle.Dashed,axisLabelVisible:true} as any);
  if(data.markers?.length)lw.createSeriesMarkers(candles,data.markers.slice(-40).map((m,i)=>({time:m.time as any,position:'aboveBar',shape:'circle',color:'#c9ff61',text:i>=Math.max(0,data.markers.length-8)?'setup':'',size:1})) as any,{autoScale:false} as any);
  (data.panels||[]).forEach((panel,pi)=>{const paneIndex=pi+1;let first:any=null;panel.series.forEach((s,si)=>{const useHistogram=panel.key==='VOLUME'&&s.kind==='VOLUME';const series=chart.addSeries(useHistogram?lw.HistogramSeries:lw.LineSeries,useHistogram?{title:s.label,priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:true}:{title:s.label,lineWidth:si===0?2:1,priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:true} as any,paneIndex);series.setData(s.values.map((v,i)=>typeof v==='number'&&Number.isFinite(v)?{time:data.bars[i]?.time as any,value:v}:null).filter(Boolean) as any);if(!first)first=series});if(first)for(const ref of panel.references||[])first.createPriceLine({price:ref.value,title:ref.label,lineWidth:1,lineStyle:lw.LineStyle.Dotted,axisLabelVisible:true} as any)});
  const panes=chart.panes();if(panes[0])panes[0].setHeight(Math.max(320,Math.round(height*.57)));for(let i=1;i<panes.length;i++)panes[i].setHeight(Math.max(90,Math.round((height-(panes[0]?.getHeight?.()||320))/Math.max(1,panes.length-1))));
  chart.timeScale().fitContent();
  chart.subscribeCrosshairMove((p:any)=>{const bar=p.seriesData?.get(candles);if(!bar||!p.time){setHover(null);return}setHover({time:Number(p.time),open:Number(bar.open),high:Number(bar.high),low:Number(bar.low),close:Number(bar.close)})});
  chart.subscribeClick((p:any)=>{if(!p.point||modeRef.current==='cursor'||applying||busy)return;const price=candles.coordinateToPrice(p.point.y);if(typeof price!=='number'||!Number.isFinite(price))return;const rounded=Number(price.toFixed(2));if(modeRef.current==='above'){void apply({type:'priceThreshold',direction:'above',value:rounded,timeframe:data.timeframe});choose('cursor')}else if(modeRef.current==='below'){void apply({type:'priceThreshold',direction:'below',value:rounded,timeframe:data.timeframe});choose('cursor')}else{if(rangeRef.current===null){rangeRef.current=rounded;setRangeAnchor(rounded);candles.createPriceLine({price:rounded,title:'Range anchor',lineWidth:1,lineStyle:lw.LineStyle.Dashed,axisLabelVisible:true} as any)}else{const first=rangeRef.current;rangeRef.current=null;setRangeAnchor(null);void apply({type:'priceRange',low:Math.min(first,rounded),high:Math.max(first,rounded),timeframe:data.timeframe});choose('cursor')}}});
  resize=new ResizeObserver(()=>{if(containerRef.current)chart.applyOptions({width:containerRef.current.clientWidth})});resize.observe(containerRef.current);
 })();return()=>{disposed=true;try{resize?.disconnect()}catch{}try{chartRef.current?.remove()}catch{}chartRef.current=null}},[data,strategy]);

 const disabled=!!busy||applying;
 return <div className={styles.shell}>
  <div className={styles.toolbar}>
   <button className={mode==='cursor'?styles.active:''} onClick={()=>choose('cursor')} disabled={disabled}>Crosshair</button>
   <button className={mode==='above'?styles.active:''} onClick={()=>choose('above')} disabled={disabled}>Price ≥ click</button>
   <button className={mode==='below'?styles.active:''} onClick={()=>choose('below')} disabled={disabled}>Price ≤ click</button>
   <button className={mode==='range'?styles.active:''} onClick={()=>choose('range')} disabled={disabled}>Price range</button>
   <button onClick={()=>chartRef.current?.timeScale().fitContent()} disabled={disabled}>Fit</button>
   <span className={styles.spacer}/><span className={styles.status}>{applying?'Applying deterministic chart edit…':`${data.asset} · ${data.timeframe} · ${data.sourceByTf?.[data.timeframe]||'DreamDEX'}`}</span>
  </div>
  <div className={styles.chartBox} ref={containerRef}>{hover&&<div className={styles.hoverCard}><b>{hover.time?new Date(hover.time*1000).toLocaleString():''}</b><span>O {n(hover.open||0)}</span><span>H {n(hover.high||0)}</span><span>L {n(hover.low||0)}</span><span>C {n(hover.close||0)}</span></div>}</div>
  {mode!=='cursor'&&<div className={styles.modeHint}>{mode==='range'?<><strong>Tap two price levels.</strong> {rangeAnchor!==null?<span className={styles.rangeValue}>First level: {n(rangeAnchor)}. Tap the second level.</span>:'The first tap sets one edge; the second sets the other.'}</>:<><strong>Tap the chart at the price you want.</strong> DreamForge will rewrite that price rule deterministically.</>}</div>}
  <div className={styles.controls}>
   <div className={styles.builder}>
    <div className={`${styles.field} ${styles.wide}`}><label>Chart rule</label><select value={rule} onChange={e=>setRule(e.target.value as any)}><option value="rsi">RSI band</option><option value="ma">Moving-average relation</option><option value="volume">Volume vs SMA</option><option value="range">Position in prior range</option></select></div>
    {rule==='rsi'&&<><div className={styles.field}><label>Period</label><input type="number" min="1" value={rsiPeriod} onChange={e=>setRsiPeriod(Number(e.target.value))}/></div><div className={styles.field}><label>Low</label><input type="number" min="0" max="100" value={rsiLow} onChange={e=>setRsiLow(Number(e.target.value))}/></div><div className={styles.field}><label>High</label><input type="number" min="0" max="100" value={rsiHigh} onChange={e=>setRsiHigh(Number(e.target.value))}/></div></>}
    {rule==='ma'&&<><div className={styles.field}><label>Type</label><select value={maKind} onChange={e=>setMaKind(e.target.value as any)}><option>EMA</option><option>SMA</option></select></div><div className={styles.field}><label>Fast</label><input type="number" min="1" value={maFast} onChange={e=>setMaFast(Number(e.target.value))}/></div><div className={styles.field}><label>Relation</label><select value={maDirection} onChange={e=>setMaDirection(e.target.value as any)}><option value="above">Above</option><option value="below">Below</option></select></div><div className={styles.field}><label>Slow</label><input type="number" min="1" value={maSlow} onChange={e=>setMaSlow(Number(e.target.value))}/></div></>}
    {rule==='volume'&&<><div className={styles.field}><label>Multiplier</label><input type="number" min=".01" step=".1" value={volMultiplier} onChange={e=>setVolMultiplier(Number(e.target.value))}/></div><div className={styles.field}><label>SMA period</label><input type="number" min="1" value={volPeriod} onChange={e=>setVolPeriod(Number(e.target.value))}/></div></>}
    {rule==='range'&&<><div className={styles.field}><label>Prior bars</label><input type="number" min="2" value={rangePeriod} onChange={e=>setRangePeriod(Number(e.target.value))}/></div><div className={styles.field}><label>Low %</label><input type="number" min="0" max="100" value={rangeLow} onChange={e=>setRangeLow(Number(e.target.value))}/></div><div className={styles.field}><label>High %</label><input type="number" min="0" max="100" value={rangeHigh} onChange={e=>setRangeHigh(Number(e.target.value))}/></div></>}
    <button onClick={applyBuilder} disabled={disabled}>Apply to strategy</button>
   </div>
   <div className={styles.rules}>{activeRules.map(r=><span className={styles.ruleChip} key={`${r.groupIndex}-${r.conditionIndex}`}><b>{r.label}</b><button title="Remove rule" onClick={()=>apply({type:'removeCondition',groupIndex:r.groupIndex,conditionIndex:r.conditionIndex})} disabled={disabled}>×</button></span>)}</div>
   <div><button className={styles.danger} onClick={()=>apply({type:'clearTechnical'})} disabled={disabled}>Reset technical chart rules</button></div>
  </div>
  <div className={styles.foot}><span>Pan, pinch/zoom, resize indicator panes, inspect the crosshair, or edit rules directly from the chart. Chart edits update the deterministic strategy — they are not drawings only.</span><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Charts powered by TradingView Lightweight Charts™</a></div>
 </div>
}
