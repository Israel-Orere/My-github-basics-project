import type {ConditionGroup,IndicatorTimeframe,StrategyCondition,StrategySpec,ValueExpr} from './types';

export type ChartStrategyEdit=
 |{type:'priceThreshold';direction:'above'|'below';value:number;timeframe?:IndicatorTimeframe}
 |{type:'priceRange';low:number;high:number;timeframe?:IndicatorTimeframe}
 |{type:'rsiBand';period:number;low:number;high:number;timeframe?:IndicatorTimeframe}
 |{type:'maRelation';kind:'EMA'|'SMA';fast:number;slow:number;direction:'above'|'below';timeframe?:IndicatorTimeframe}
 |{type:'volumeSma';period:number;multiplier:number;timeframe?:IndicatorTimeframe}
 |{type:'rangePosition';period:number;lowPct:number;highPct:number;timeframe?:IndicatorTimeframe}
 |{type:'removeCondition';groupIndex:number;conditionIndex:number}
 |{type:'clearTechnical'};

const constant=(value:number):ValueExpr=>({kind:'CONSTANT',value});
const finite=(n:number)=>Number.isFinite(n);
function exprs(c:StrategyCondition):ValueExpr[]{if(c.type==='COMPARE'||c.type==='CROSS')return[c.left,c.right];if(c.type==='TREND')return[c.expr];return[]}
function hasKind(c:StrategyCondition,kinds:string[]){return exprs(c).some(e=>kinds.includes(e.kind))}
function isMaPrice(e:ValueExpr){return(e.kind==='EMA'||e.kind==='SMA')&&(!e.source||e.source==='PRICE')}
function isPriceConstant(c:StrategyCondition){if(c.type!=='COMPARE')return false;return(c.left.kind==='PRICE'&&c.right.kind==='CONSTANT')||(c.right.kind==='PRICE'&&c.left.kind==='CONSTANT')}
function familyMatches(c:StrategyCondition,family:'price'|'rsi'|'ma'|'volume'|'range'){
 if(family==='price')return isPriceConstant(c);
 if(family==='rsi')return hasKind(c,['RSI'])||exprs(c).some(e=>(e.kind==='EMA'||e.kind==='SMA')&&e.source==='RSI');
 if(family==='ma')return c.type==='COMPARE'&&isMaPrice(c.left)&&isMaPrice(c.right);
 if(family==='volume')return hasKind(c,['VOLUME'])||exprs(c).some(e=>(e.kind==='EMA'||e.kind==='SMA')&&e.source==='VOLUME');
 return hasKind(c,['HIGHEST_HIGH','LOWEST_LOW','RANGE_WIDTH','RANGE_POSITION']);
}
function groups(s:StrategySpec){return(s.conditionGroups?.length?s.conditionGroups:[{logic:'ALL' as const,conditions:[]}]).map(g=>({logic:'ALL' as const,conditions:[...g.conditions]}));}
function replaceFamily(gs:ConditionGroup[],family:'price'|'rsi'|'ma'|'volume'|'range',next:StrategyCondition[]){return gs.map(g=>({logic:'ALL' as const,conditions:[...g.conditions.filter(c=>!familyMatches(c,family)),...next]}));}
function tf(edit:{timeframe?:IndicatorTimeframe},s:StrategySpec){return edit.timeframe||s.window;}
function pct(n:number){return Math.max(0,Math.min(100,n));}
function money(n:number){return Number(n.toFixed(2));}
function uniqueLabels(gs:ConditionGroup[]){return[...new Set(gs.flatMap(g=>g.conditions.map(c=>c.label)))];}
function refresh(s:StrategySpec,gs:ConditionGroup[],description:string):StrategySpec{
 const labels=uniqueLabels(gs),all=gs.flatMap(g=>g.conditions),signalCount=all.filter(c=>c.type!=='TIME_WINDOW').length,needsClarification=signalCount===0;
 const assumptions=(s.interpretation?.assumptions||[]).filter(x=>!/^Chart controls:/i.test(x));
 return{
  ...s,
  conditionGroups:gs,
  compiler:'deterministic-local',
  interpretation:{
   summary:needsClarification?'The chart controls cleared the technical setup. Add at least one deterministic signal rule before confirming.':description,
   entry:labels,
   execution:s.interpretation?.execution?.length?s.interpretation.execution:[`Buy ${s.side} only at ${Math.round((s.trigger.maxEntryPrice||.99)*100)}¢ or less after the compiled conditions pass.`],
   sizing:s.interpretation?.sizing?.length?s.interpretation.sizing:[`Start at $${s.sizing.baseUsd}; after a win use $${s.sizing.afterWinUsd}; after a loss use $${s.sizing.afterLossUsd}.`],
   risk:s.interpretation?.risk?.length?s.interpretation.risk:[`Stop at -$${s.risk.maxLossUsd}, ${s.risk.maxTrades} trades, or ${s.risk.durationHours} hours.`],
   assumptions:[`Chart controls: this edit was applied directly to the deterministic rule specification without AI inference.`,...assumptions],
   questions:needsClarification?['Add at least one price, indicator, range, or settlement condition before confirming this strategy.']:[],
   confidence:needsClarification?.55:1,
   needsClarification
  }
 };
}

export function applyChartStrategyEdit(strategy:StrategySpec,edit:ChartStrategyEdit){
 let gs=groups(strategy),description='Chart edit applied.';
 if(edit.type==='priceThreshold'){
  if(!finite(edit.value)||edit.value<=0)throw new Error('Choose a valid positive price level.');const timeframe=tf(edit,strategy),op=edit.direction==='above'?'GTE':'LTE',value=money(edit.value);gs=replaceFamily(gs,'price',[{type:'COMPARE',left:{kind:'PRICE',timeframe},operator:op,right:constant(value),label:`Price ${edit.direction==='above'?'≥':'≤'} ${value.toLocaleString()} on ${timeframe}`}]);description=`Chart control set the ${timeframe} price threshold to ${edit.direction} ${value.toLocaleString()}.`;
 }else if(edit.type==='priceRange'){
  if(!finite(edit.low)||!finite(edit.high))throw new Error('Choose two valid price levels.');const timeframe=tf(edit,strategy),low=money(Math.min(edit.low,edit.high)),high=money(Math.max(edit.low,edit.high));if(low<=0||low===high)throw new Error('The chart range needs two different positive prices.');gs=replaceFamily(gs,'price',[{type:'COMPARE',left:{kind:'PRICE',timeframe},operator:'GTE',right:constant(low),label:`Price ≥ ${low.toLocaleString()} on ${timeframe}`},{type:'COMPARE',left:{kind:'PRICE',timeframe},operator:'LTE',right:constant(high),label:`Price ≤ ${high.toLocaleString()} on ${timeframe}`}]);description=`Chart control set the ${timeframe} price range to ${low.toLocaleString()}–${high.toLocaleString()}.`;
 }else if(edit.type==='rsiBand'){
  const timeframe=tf(edit,strategy),period=Math.max(1,Math.round(edit.period)),low=pct(Math.min(edit.low,edit.high)),high=pct(Math.max(edit.low,edit.high));if(low===high)throw new Error('RSI lower and upper bounds must differ.');const rsi:ValueExpr={kind:'RSI',period,timeframe};gs=replaceFamily(gs,'rsi',[{type:'COMPARE',left:rsi,operator:'GTE',right:constant(low),label:`RSI(${period}) ≥ ${low} on ${timeframe}`},{type:'COMPARE',left:rsi,operator:'LTE',right:constant(high),label:`RSI(${period}) ≤ ${high} on ${timeframe}`}]);description=`Chart control set RSI(${period}) to ${low}–${high} on ${timeframe}.`;
 }else if(edit.type==='maRelation'){
  const timeframe=tf(edit,strategy),fast=Math.max(1,Math.round(edit.fast)),slow=Math.max(1,Math.round(edit.slow));if(fast===slow)throw new Error('Choose two different moving-average periods.');const operator=edit.direction==='above'?'GT':'LT';gs=replaceFamily(gs,'ma',[{type:'COMPARE',left:{kind:edit.kind,period:fast,source:'PRICE',timeframe},operator,right:{kind:edit.kind,period:slow,source:'PRICE',timeframe},label:`${edit.kind}${fast} ${edit.direction==='above'?'>':'<'} ${edit.kind}${slow} on ${timeframe}`}]);description=`Chart control set ${edit.kind}${fast} ${edit.direction} ${edit.kind}${slow} on ${timeframe}.`;
 }else if(edit.type==='volumeSma'){
  const timeframe=tf(edit,strategy),period=Math.max(1,Math.round(edit.period)),multiplier=Math.max(.01,Number(edit.multiplier));gs=replaceFamily(gs,'volume',[{type:'COMPARE',left:{kind:'VOLUME',timeframe},operator:'GT',right:{kind:'SMA',period,source:'VOLUME',timeframe,multiplier},label:`Volume > ${multiplier}× SMA(${period}) on ${timeframe}`}]);description=`Chart control set volume above ${multiplier}× its SMA(${period}) on ${timeframe}.`;
 }else if(edit.type==='rangePosition'){
  const timeframe=tf(edit,strategy),period=Math.max(2,Math.round(edit.period)),low=pct(Math.min(edit.lowPct,edit.highPct)),high=pct(Math.max(edit.lowPct,edit.highPct));if(low===high)throw new Error('Range-position lower and upper bounds must differ.');const pos:ValueExpr={kind:'RANGE_POSITION',period,timeframe,offsetBars:1};gs=replaceFamily(gs,'range',[{type:'COMPARE',left:{kind:'PRICE',timeframe},operator:'LTE',right:{kind:'HIGHEST_HIGH',period,timeframe,offsetBars:1},label:`Price ≤ previous ${period}-bar highest high`},{type:'COMPARE',left:{kind:'PRICE',timeframe},operator:'GTE',right:{kind:'LOWEST_LOW',period,timeframe,offsetBars:1},label:`Price ≥ previous ${period}-bar lowest low`},{type:'COMPARE',left:pos,operator:'GTE',right:constant(low),label:`Range position ≥ ${low}%`},{type:'COMPARE',left:pos,operator:'LTE',right:constant(high),label:`Range position ≤ ${high}%`}]);description=`Chart control set price inside ${low}–${high}% of the previous ${period}-bar range on ${timeframe}.`;
 }else if(edit.type==='removeCondition'){
  gs=gs.map((g,gi)=>({logic:'ALL' as const,conditions:g.conditions.filter((_,ci)=>!(gi===edit.groupIndex&&ci===edit.conditionIndex))})).filter((g,i,a)=>g.conditions.length>0||a.length===1);if(!gs.length)gs=[{logic:'ALL',conditions:[]}];description='Chart control removed the selected deterministic rule.';
 }else if(edit.type==='clearTechnical'){
  gs=gs.map(g=>({logic:'ALL' as const,conditions:g.conditions.filter(c=>c.type==='SETTLEMENT_STREAK'||c.type==='TIME_WINDOW')}));description='Chart controls cleared the technical indicator and underlying-price rules while preserving settlement/time filters, execution, sizing and risk.';
 }
 return refresh(strategy,gs,description);
}
