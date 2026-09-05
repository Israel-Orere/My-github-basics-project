import type {ConditionGroup,IndicatorTimeframe,StrategyCondition,StrategySpec,ValueExpr} from './types';

export type SpotBar={time:number;open:number;high:number;low:number;close:number;volume:number};
export type BarsByTimeframe=Partial<Record<IndicatorTimeframe,SpotBar[]>>;
export type ConditionResult={label:string;passed:boolean;detail:string};

const tfSec:Record<IndicatorTimeframe,number>={"1m":60,"5m":300,"15m":900,"1h":3600,"4h":14400};
const key=(e:ValueExpr)=>JSON.stringify(e);
function sma(src:number[],period:number){const out=Array(src.length).fill(NaN);let sum=0;for(let i=0;i<src.length;i++){sum+=src[i];if(i>=period)sum-=src[i-period];if(i>=period-1)out[i]=sum/period}return out}
function ema(src:number[],period:number){const out=Array(src.length).fill(NaN);if(!src.length)return out;const k=2/(period+1);let start=src.findIndex(Number.isFinite);if(start<0)return out;const seed:number[]=[];for(let i=start;i<src.length;i++){if(Number.isFinite(src[i]))seed.push(src[i]);if(seed.length===period){let prev=seed.reduce((a,b)=>a+b,0)/period;out[i]=prev;for(let j=i+1;j<src.length;j++){if(!Number.isFinite(src[j]))continue;prev=src[j]*k+prev*(1-k);out[j]=prev}break}}return out}
function rsi(src:number[],period:number){const out=Array(src.length).fill(NaN);if(src.length<=period)return out;let gain=0,loss=0;for(let i=1;i<=period;i++){const d=src[i]-src[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0)}let avgG=gain/period,avgL=loss/period;out[period]=avgL===0?100:100-(100/(1+avgG/avgL));for(let i=period+1;i<src.length;i++){const d=src[i]-src[i-1];avgG=(avgG*(period-1)+Math.max(d,0))/period;avgL=(avgL*(period-1)+Math.max(-d,0))/period;out[i]=avgL===0?100:100-(100/(1+avgG/avgL))}return out}
function finite(n:number){return Number.isFinite(n)}
function op(a:number,operator:string,b:number){if(!finite(a)||!finite(b))return false;if(operator==='GT')return a>b;if(operator==='GTE')return a>=b;if(operator==='LT')return a<b;if(operator==='LTE')return a<=b;return Math.abs(a-b)<1e-9}

export function requiredTimeframes(s:StrategySpec):IndicatorTimeframe[]{const set=new Set<IndicatorTimeframe>();for(const g of s.conditionGroups||[])for(const c of g.conditions){if(c.type==='SETTLEMENT_STREAK')continue;for(const e of [c.left,c.right])if(e.kind!=='CONSTANT')set.add(e.timeframe||s.window)}return [...set]}
export function indicatorWarmup(s:StrategySpec){let n=60;for(const g of s.conditionGroups||[])for(const c of g.conditions){if(c.type==='SETTLEMENT_STREAK')continue;for(const e of [c.left,c.right])n=Math.max(n,(e.period||0)+(e.sourcePeriod||0)+(e.slowPeriod||0)+(e.signalPeriod||0)+10)}return Math.min(1000,n)}

export function createStrategyEvaluator(strategy:StrategySpec,barsByTf:BarsByTimeframe){
 const seriesCache=new Map<string,number[]>();
 function barsFor(e:ValueExpr){return barsByTf[e.timeframe||strategy.window]||[]}
 function series(e:ValueExpr):number[]{
  if(e.kind==='CONSTANT')return[];const k=key(e);const cached=seriesCache.get(k);if(cached)return cached;const bars=barsFor(e),closes=bars.map(b=>b.close);let out:number[];
  if(e.kind==='PRICE')out=closes;
  else if(e.kind==='RSI')out=rsi(closes,e.period||14);
  else if(e.kind==='SMA'||e.kind==='EMA'){const source=e.source==='RSI'?rsi(closes,e.sourcePeriod||14):closes;out=e.kind==='SMA'?sma(source,e.period||20):ema(source,e.period||20)}
  else{const fast=ema(closes,e.fastPeriod||12),slow=ema(closes,e.slowPeriod||26),macd=closes.map((_,i)=>finite(fast[i])&&finite(slow[i])?fast[i]-slow[i]:NaN);out=e.kind==='MACD'?macd:ema(macd,e.signalPeriod||9)}
  seriesCache.set(k,out);return out;
 }
 function indexBefore(e:ValueExpr,time:number){const bars=barsFor(e),step=tfSec[e.timeframe||strategy.window];let lo=0,hi=bars.length-1,ans=-1;while(lo<=hi){const mid=(lo+hi)>>1;if(bars[mid].time+step<=time){ans=mid;lo=mid+1}else hi=mid-1}return ans}
 function val(e:ValueExpr,time:number,back=0){if(e.kind==='CONSTANT')return e.value??NaN;const i=indexBefore(e,time)-back;if(i<0)return NaN;return series(e)[i]}
 function evaluateCondition(c:StrategyCondition,time:number,priorSettlements:('UP'|'DOWN')[]):ConditionResult{
  if(c.type==='SETTLEMENT_STREAK'){const recent=priorSettlements.slice(-c.length),passed=recent.length===c.length&&recent.every(x=>x===c.side);return{label:c.label,passed,detail:passed?`Last ${c.length} settlements were ${c.side}.`:`Need ${c.length} consecutive ${c.side} settlements.`}}
  const left=val(c.left,time),right=val(c.right,time);
  if(c.type==='COMPARE'){const passed=op(left,c.operator,right);return{label:c.label,passed,detail:`${finite(left)?left.toFixed(4):'n/a'} ${c.operator} ${finite(right)?right.toFixed(4):'n/a'}`}}
  const l0=val(c.left,time,1),r0=val(c.right,time,1),passed=c.direction==='ABOVE'?finite(l0)&&finite(r0)&&l0<=r0&&left>right:finite(l0)&&finite(r0)&&l0>=r0&&left<right;
  return{label:c.label,passed,detail:`${c.direction} cross: ${finite(left)?left.toFixed(4):'n/a'} vs ${finite(right)?right.toFixed(4):'n/a'}`};
 }
 function evaluate(time:number,priorSettlements:('UP'|'DOWN')[]){const groups=(strategy.conditionGroups?.length?strategy.conditionGroups:[{logic:'ALL',conditions:strategy.trigger.streakLength?[{type:'SETTLEMENT_STREAK',side:strategy.trigger.streakSide||strategy.side,length:strategy.trigger.streakLength,label:'Settlement streak'} as StrategyCondition]:[]}]) as ConditionGroup[];const grouped=groups.map(g=>g.conditions.map(c=>evaluateCondition(c,time,priorSettlements))),passed=grouped.some(g=>g.every(r=>r.passed));return{passed,details:grouped.flat()}}
 return{evaluate};
}

export function timeframeSeconds(tf:IndicatorTimeframe){return tfSec[tf]}
