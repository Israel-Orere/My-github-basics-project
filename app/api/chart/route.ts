import {NextResponse} from 'next/server';
import {createReadExchange} from '@/lib/dreamdex';
import {fetchSpotBars} from '@/lib/spot-history';
import {createStrategyEvaluator,indicatorWarmup,requiredTimeframes,timeframeSeconds,type SpotBar} from '@/lib/strategy-engine';
import type {IndicatorTimeframe,StrategyCondition,StrategySpec,ValueExpr} from '@/lib/types';

const TIMEFRAMES:IndicatorTimeframe[]=['1m','5m','15m','1h','4h'];
const finite=(n:number)=>Number.isFinite(n);
function expressions(c:StrategyCondition):ValueExpr[]{if(c.type==='COMPARE'||c.type==='CROSS')return[c.left,c.right];if(c.type==='TREND')return[c.expr];return[]}
function allExpressions(s:StrategySpec){const out:ValueExpr[]=[];for(const g of s.conditionGroups||[])for(const c of g.conditions)out.push(...expressions(c));return out}
function sameTf(e:ValueExpr,s:StrategySpec,tf:IndicatorTimeframe){return (e.timeframe||s.window)===tf}
function sma(src:number[],period:number){const out=Array(src.length).fill(NaN);let sum=0;for(let i=0;i<src.length;i++){sum+=src[i];if(i>=period)sum-=src[i-period];if(i>=period-1)out[i]=sum/period}return out}
function ema(src:number[],period:number){const out=Array(src.length).fill(NaN);if(period<1)return out;const k=2/(period+1);let seed=0,prev=NaN;for(let i=0;i<src.length;i++){if(i<period){seed+=src[i];if(i===period-1){prev=seed/period;out[i]=prev}}else{prev=src[i]*k+prev*(1-k);out[i]=prev}}return out}
function rollingStd(src:number[],period:number){const out=Array(src.length).fill(NaN);for(let i=period-1;i<src.length;i++){const w=src.slice(i-period+1,i+1),m=w.reduce((a,b)=>a+b,0)/period;out[i]=Math.sqrt(w.reduce((a,b)=>a+(b-m)**2,0)/period)}return out}
function rollingMax(src:number[],period:number){const out=Array(src.length).fill(NaN);for(let i=period-1;i<src.length;i++){let v=-Infinity;for(let j=i-period+1;j<=i;j++)v=Math.max(v,src[j]);out[i]=v}return out}
function rollingMin(src:number[],period:number){const out=Array(src.length).fill(NaN);for(let i=period-1;i<src.length;i++){let v=Infinity;for(let j=i-period+1;j<=i;j++)v=Math.min(v,src[j]);out[i]=v}return out}
function vwap(bars:SpotBar[],period:number){const out=Array(bars.length).fill(NaN);let ps=0,vs=0;for(let i=0;i<bars.length;i++){const p=(bars[i].high+bars[i].low+bars[i].close)/3,v=bars[i].volume;ps+=p*v;vs+=v;if(i>=period){const old=bars[i-period],op=(old.high+old.low+old.close)/3;ps-=op*old.volume;vs-=old.volume}if(i>=period-1&&vs>0)out[i]=ps/vs}return out}
function shift(src:number[],offset=0){return src.map((_,i)=>i-offset>=0?src[i-offset]:NaN)}
function rawSeries(e:ValueExpr,bars:SpotBar[]){const closes=bars.map(b=>b.close),period=e.period||20;let out:number[];
 if(e.kind==='PRICE')out=closes;else if(e.kind==='OPEN')out=bars.map(b=>b.open);else if(e.kind==='HIGH')out=bars.map(b=>b.high);else if(e.kind==='LOW')out=bars.map(b=>b.low);
 else if(e.kind==='SMA'&&(!e.source||e.source==='PRICE'))out=sma(closes,period);else if(e.kind==='EMA'&&(!e.source||e.source==='PRICE'))out=ema(closes,period);
 else if(e.kind==='VWAP')out=vwap(bars,period);else if(e.kind==='BB_MIDDLE'||e.kind==='BB_UPPER'||e.kind==='BB_LOWER'){const mid=sma(closes,period),sd=rollingStd(closes,period),m=e.stdDev??2;out=mid.map((v,i)=>e.kind==='BB_MIDDLE'?v:e.kind==='BB_UPPER'?v+m*sd[i]:v-m*sd[i])}
 else if(e.kind==='HIGHEST_HIGH')out=rollingMax(bars.map(b=>b.high),period);else if(e.kind==='LOWEST_LOW')out=rollingMin(bars.map(b=>b.low),period);else return null;
 return shift(out,e.offsetBars||0).map(v=>finite(v)?v*(e.multiplier??1)+(e.addend??0):NaN);
}
function exprLabel(e:ValueExpr){const tf=e.timeframe?` ${e.timeframe}`:'';const off=e.offsetBars?` · ${e.offsetBars} bar${e.offsetBars===1?'':'s'} back`:'';if(e.kind==='PRICE')return`Price${tf}${off}`;if(e.kind==='OPEN'||e.kind==='HIGH'||e.kind==='LOW')return`${e.kind[0]}${e.kind.slice(1).toLowerCase()}${tf}${off}`;if(e.kind==='SMA'||e.kind==='EMA'||e.kind==='VWAP')return`${e.kind}(${e.period||20})${tf}${off}`;if(e.kind.startsWith('BB_'))return`${e.kind.replace('BB_','BB ')}(${e.period||20})${tf}${off}`;if(e.kind==='HIGHEST_HIGH')return`Highest high(${e.period||20})${tf}${off}`;if(e.kind==='LOWEST_LOW')return`Lowest low(${e.period||20})${tf}${off}`;return e.kind}
function technicalOnly(s:StrategySpec){const groups=(s.conditionGroups||[]).map(g=>({...g,conditions:g.conditions.filter(c=>c.type!=='SETTLEMENT_STREAK')})).filter(g=>g.conditions.length);return{...s,conditionGroups:groups}}
function rangeKeys(s:StrategySpec,tf:IndicatorTimeframe){const out=new Map<string,{period:number;offsetBars:number}>();for(const e of allExpressions(s)){if(!sameTf(e,s,tf))continue;if(!['HIGHEST_HIGH','LOWEST_LOW','RANGE_WIDTH','RANGE_POSITION'].includes(e.kind))continue;const period=e.period||20,offsetBars=e.offsetBars||0,k=`${period}:${offsetBars}`;out.set(k,{period,offsetBars})}return [...out.values()]}
function toNullable(a:number[]){return a.map(v=>finite(v)?Number(v.toFixed(8)):null)}

export const maxDuration=45;
export async function POST(req:Request){let exchange:any;try{
 const body=await req.json() as {strategy?:StrategySpec;timeframe?:IndicatorTimeframe;limit?:number};const s=body.strategy;if(!s?.asset||!s?.window)throw new Error('A strategy draft is required.');
 const requested=TIMEFRAMES.includes(body.timeframe as IndicatorTimeframe)?body.timeframe:undefined,required=requiredTimeframes(s),available=[...new Set<IndicatorTimeframe>([...(required.length?required:[s.window]),s.window])].sort((a,b)=>timeframeSeconds(a)-timeframeSeconds(b)),tf=requested||available[0],limit=Math.max(40,Math.min(120,Number(body.limit)||72)),now=Math.floor(Date.now()/1000),displayStep=timeframeSeconds(tf),from=now-displayStep*limit;
 exchange=createReadExchange();const warmup=indicatorWarmup(s),barsByTf:Partial<Record<IndicatorTimeframe,SpotBar[]>>={};
 const needed=[...new Set<IndicatorTimeframe>([...required,tf])];await Promise.all(needed.map(async t=>{const span=Math.max(displayStep*limit,timeframeSeconds(t)*limit);barsByTf[t]=await fetchSpotBars(exchange,s.asset,t,now-span,now,warmup)}));
 const completed=(barsByTf[tf]||[]).filter(b=>b.time+displayStep<=now),display=completed.slice(-limit);if(!display.length)return NextResponse.json({asset:s.asset,timeframe:tf,availableTimeframes:available,bars:[],overlays:[],bands:[],markers:[],latestDetails:[],warning:'No completed spot candles are available for this view yet.'});
 const exprs=allExpressions(s).filter(e=>sameTf(e,s,tf)),seen=new Set<string>(),overlays:{id:string;label:string;kind:string;values:(number|null)[]}[]=[];
 for(const e of exprs){if(overlays.length>=7)break;const k=JSON.stringify(e);if(seen.has(k))continue;const values=rawSeries(e,completed);if(!values)continue;seen.add(k);overlays.push({id:`ov-${overlays.length+1}`,label:exprLabel(e),kind:e.kind,values:toNullable(values.slice(-display.length))})}
 const bands=rangeKeys(s,tf).slice(0,3).map((r,i)=>{const hi=shift(rollingMax(completed.map(b=>b.high),r.period),r.offsetBars),lo=shift(rollingMin(completed.map(b=>b.low),r.period),r.offsetBars);return{id:`range-${i+1}`,label:`${r.offsetBars?'Previous ':''}${r.period}-bar range`,period:r.period,offsetBars:r.offsetBars,upper:toNullable(hi.slice(-display.length)),lower:toNullable(lo.slice(-display.length))}});
 const technical=technicalOnly(s),ignoredSettlementRules=(s.conditionGroups||[]).reduce((n,g)=>n+g.conditions.filter(c=>c.type==='SETTLEMENT_STREAK').length,0),hasTechnical=!!technical.conditionGroups?.length;let markers:{time:number;price:number;label:string}[]=[],latestDetails:{label:string;passed:boolean;detail:string}[]=[];
 if(hasTechnical){const evaluator=createStrategyEvaluator(technical,barsByTf);markers=display.map(b=>{const r=evaluator.evaluate(b.time+displayStep,[]);return r.passed?{time:b.time,price:b.close,label:'Technical setup matched'}:null}).filter(Boolean).slice(-24) as {time:number;price:number;label:string}[];latestDetails=evaluator.evaluate(display[display.length-1].time+displayStep,[]).details.slice(0,12)}
 return NextResponse.json({asset:s.asset,timeframe:tf,availableTimeframes:available,bars:display.map(b=>({...b,open:Number(b.open.toFixed(8)),high:Number(b.high.toFixed(8)),low:Number(b.low.toFixed(8)),close:Number(b.close.toFixed(8)),volume:Number(b.volume.toFixed(4))})),overlays,bands,markers,latestDetails,ignoredSettlementRules,technicalOnly:ignoredSettlementRules>0,updatedAt:Date.now()});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not load the live strategy chart.'},{status:500})}finally{try{await Promise.resolve(exchange?.close?.())}catch{}}}
