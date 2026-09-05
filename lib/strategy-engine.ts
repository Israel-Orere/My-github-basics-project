import type {ConditionGroup,IndicatorTimeframe,StrategyCondition,StrategySpec,ValueExpr} from './types';

export type SpotBar={time:number;open:number;high:number;low:number;close:number;volume:number};
export type BarsByTimeframe=Partial<Record<IndicatorTimeframe,SpotBar[]>>;
export type ConditionResult={label:string;passed:boolean;detail:string};

const tfSec:Record<IndicatorTimeframe,number>={"1m":60,"5m":300,"15m":900,"1h":3600,"4h":14400};
const key=(e:ValueExpr)=>JSON.stringify({...e,multiplier:undefined,addend:undefined,offsetBars:undefined});
const finite=(n:number)=>Number.isFinite(n);
function sma(src:number[],period:number){const out=Array(src.length).fill(NaN);let sum=0,valid=0;for(let i=0;i<src.length;i++){const v=src[i];if(finite(v)){sum+=v;valid++}if(i>=period){const old=src[i-period];if(finite(old)){sum-=old;valid--}}if(i>=period-1&&valid===period)out[i]=sum/period}return out}
function ema(src:number[],period:number){const out=Array(src.length).fill(NaN);if(period<1)return out;const k=2/(period+1),seed:number[]=[];let prev=NaN;for(let i=0;i<src.length;i++){const v=src[i];if(!finite(v))continue;if(!finite(prev)){seed.push(v);if(seed.length===period){prev=seed.reduce((a,b)=>a+b,0)/period;out[i]=prev}}else{prev=v*k+prev*(1-k);out[i]=prev}}return out}
function rsi(src:number[],period:number){const out=Array(src.length).fill(NaN);if(src.length<=period)return out;let gain=0,loss=0;for(let i=1;i<=period;i++){const d=src[i]-src[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0)}let avgG=gain/period,avgL=loss/period;out[period]=avgL===0?100:100-(100/(1+avgG/avgL));for(let i=period+1;i<src.length;i++){const d=src[i]-src[i-1];avgG=(avgG*(period-1)+Math.max(d,0))/period;avgL=(avgL*(period-1)+Math.max(-d,0))/period;out[i]=avgL===0?100:100-(100/(1+avgG/avgL))}return out}
function atr(bars:SpotBar[],period:number){const tr=bars.map((b,i)=>i===0?b.high-b.low:Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close)));const out=Array(bars.length).fill(NaN);if(tr.length<period)return out;let v=tr.slice(0,period).reduce((a,b)=>a+b,0)/period;out[period-1]=v;for(let i=period;i<tr.length;i++){v=(v*(period-1)+tr[i])/period;out[i]=v}return out}
function roc(src:number[],period:number){return src.map((v,i)=>i>=period&&finite(src[i-period])&&src[i-period]!==0?((v/src[i-period])-1)*100:NaN)}
function rollingStd(src:number[],period:number){const out=Array(src.length).fill(NaN);for(let i=period-1;i<src.length;i++){const w=src.slice(i-period+1,i+1);if(w.some(v=>!finite(v)))continue;const mean=w.reduce((a,b)=>a+b,0)/period;out[i]=Math.sqrt(w.reduce((a,b)=>a+(b-mean)**2,0)/period)}return out}
function stochastic(bars:SpotBar[],period:number,smoothK:number,smoothD:number){const raw=Array(bars.length).fill(NaN);for(let i=period-1;i<bars.length;i++){let hi=-Infinity,lo=Infinity;for(let j=i-period+1;j<=i;j++){hi=Math.max(hi,bars[j].high);lo=Math.min(lo,bars[j].low)}raw[i]=hi===lo?50:((bars[i].close-lo)/(hi-lo))*100}const k=sma(raw,Math.max(1,smoothK)),d=sma(k,Math.max(1,smoothD));return{k,d}}
function vwap(bars:SpotBar[],period:number){const pv=bars.map(b=>((b.high+b.low+b.close)/3)*b.volume),vol=bars.map(b=>b.volume),out=Array(bars.length).fill(NaN);let ps=0,vs=0;for(let i=0;i<bars.length;i++){ps+=pv[i];vs+=vol[i];if(i>=period){ps-=pv[i-period];vs-=vol[i-period]}if(i>=period-1&&vs>0)out[i]=ps/vs}return out}
function obv(bars:SpotBar[]){const out=Array(bars.length).fill(0);for(let i=1;i<bars.length;i++)out[i]=out[i-1]+(bars[i].close>bars[i-1].close?bars[i].volume:bars[i].close<bars[i-1].close?-bars[i].volume:0);return out}
function op(a:number,operator:string,b:number){if(!finite(a)||!finite(b))return false;if(operator==='GT')return a>b;if(operator==='GTE')return a>=b;if(operator==='LT')return a<b;if(operator==='LTE')return a<=b;return Math.abs(a-b)<1e-9}
function applyNegate(v:boolean,negate?:boolean){return negate?!v:v}

function expressions(c:StrategyCondition):ValueExpr[]{if(c.type==='COMPARE'||c.type==='CROSS')return[c.left,c.right];if(c.type==='TREND')return[c.expr];return[]}
export function requiredTimeframes(s:StrategySpec):IndicatorTimeframe[]{const set=new Set<IndicatorTimeframe>();for(const g of s.conditionGroups||[])for(const c of g.conditions)for(const e of expressions(c))if(e.kind!=='CONSTANT')set.add(e.timeframe||s.window);return [...set]}
export function indicatorWarmup(s:StrategySpec){let n=60;for(const g of s.conditionGroups||[])for(const c of g.conditions)for(const e of expressions(c)){const p=e.period||0,sp=e.sourcePeriod||0,slow=e.slowPeriod||0,sig=e.signalPeriod||0,sk=e.smoothK||0,sd=e.smoothD||0,off=e.offsetBars||0;n=Math.max(n,p+sp+slow+sig+sk+sd+off+15)}return Math.min(1500,n)}
export function evaluationStepSeconds(s:StrategySpec){const tfs=requiredTimeframes(s).map(timeframeSeconds),hasClock=(s.conditionGroups||[]).some(g=>g.conditions.some(c=>c.type==='TIME_WINDOW'));const contract=s.window==='15m'?900:3600;return Math.max(60,Math.min(contract,hasClock?60:Math.min(...(tfs.length?tfs:[contract]))))}

export function createStrategyEvaluator(strategy:StrategySpec,barsByTf:BarsByTimeframe){
 const seriesCache=new Map<string,number[]>(),clockCache=new Map<string,{minute:number;day:number}>();
 function barsFor(e:ValueExpr){return barsByTf[e.timeframe||strategy.window]||[]}
 function sourceSeries(e:ValueExpr,bars:SpotBar[]){const closes=bars.map(b=>b.close);if(e.source==='RSI')return rsi(closes,e.sourcePeriod||14);if(e.source==='VOLUME')return bars.map(b=>b.volume);return closes}
 function series(e:ValueExpr):number[]{
  if(e.kind==='CONSTANT')return[];const k=key(e),cached=seriesCache.get(k);if(cached)return cached;const bars=barsFor(e),closes=bars.map(b=>b.close);let out:number[];
  if(e.kind==='PRICE')out=closes;else if(e.kind==='OPEN')out=bars.map(b=>b.open);else if(e.kind==='HIGH')out=bars.map(b=>b.high);else if(e.kind==='LOW')out=bars.map(b=>b.low);else if(e.kind==='VOLUME')out=bars.map(b=>b.volume);
  else if(e.kind==='RSI')out=rsi(closes,e.period||14);
  else if(e.kind==='SMA'||e.kind==='EMA'){const src=sourceSeries(e,bars);out=e.kind==='SMA'?sma(src,e.period||20):ema(src,e.period||20)}
  else if(e.kind==='MACD'||e.kind==='MACD_SIGNAL'){const fast=ema(closes,e.fastPeriod||12),slow=ema(closes,e.slowPeriod||26),m=closes.map((_,i)=>finite(fast[i])&&finite(slow[i])?fast[i]-slow[i]:NaN);out=e.kind==='MACD'?m:ema(m,e.signalPeriod||9)}
  else if(e.kind==='ATR')out=atr(bars,e.period||14);
  else if(e.kind==='ROC')out=roc(closes,e.period||1);
  else if(e.kind==='STOCH_K'||e.kind==='STOCH_D'){const st=stochastic(bars,e.period||14,e.smoothK||3,e.smoothD||3);out=e.kind==='STOCH_K'?st.k:st.d}
  else if(e.kind==='BB_MIDDLE'||e.kind==='BB_UPPER'||e.kind==='BB_LOWER'){const period=e.period||20,mid=sma(closes,period),sd=rollingStd(closes,period),mult=e.stdDev??2;out=mid.map((v,i)=>e.kind==='BB_MIDDLE'?v:e.kind==='BB_UPPER'?v+mult*sd[i]:v-mult*sd[i])}
  else if(e.kind==='VWAP')out=vwap(bars,e.period||20);else out=obv(bars);
  seriesCache.set(k,out);return out;
 }
 function indexBefore(e:ValueExpr,time:number){const bars=barsFor(e),step=tfSec[e.timeframe||strategy.window];let lo=0,hi=bars.length-1,ans=-1;while(lo<=hi){const mid=(lo+hi)>>1;if(bars[mid].time+step<=time){ans=mid;lo=mid+1}else hi=mid-1}return ans}
 function val(e:ValueExpr,time:number,back=0){if(e.kind==='CONSTANT')return (e.value??NaN)*(e.multiplier??1)+(e.addend??0);const i=indexBefore(e,time)-(e.offsetBars||0)-back;if(i<0)return NaN;const raw=series(e)[i];return finite(raw)?raw*(e.multiplier??1)+(e.addend??0):NaN}
 function localClock(time:number,timezone:string){const minuteKey=Math.floor(time/60),k=`${timezone}:${minuteKey}`,cached=clockCache.get(k);if(cached)return cached;try{const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time*1000));const get=(t:string)=>parts.find(p=>p.type===t)?.value||'';const days:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6},v={minute:Number(get('hour'))*60+Number(get('minute')),day:days[get('weekday')]};clockCache.set(k,v);return v}catch{return{minute:-1,day:-1}}}
 function evaluateCondition(c:StrategyCondition,time:number,priorSettlements:('UP'|'DOWN')[]):ConditionResult{
  if(c.type==='SETTLEMENT_STREAK'){const recent=priorSettlements.slice(-c.length),raw=recent.length===c.length&&recent.every(x=>x===c.side),passed=applyNegate(raw,c.negate);return{label:c.label,passed,detail:passed?`Settlement rule satisfied.`:`Need ${c.negate?'a break in ':''}${c.length} consecutive ${c.side} settlements.`}}
  if(c.type==='TIME_WINDOW'){const local=localClock(time,c.timezone),inDay=!c.daysOfWeek?.length||c.daysOfWeek.includes(local.day),inTime=c.startMinute<=c.endMinute?local.minute>=c.startMinute&&local.minute<c.endMinute:local.minute>=c.startMinute||local.minute<c.endMinute,raw=local.minute>=0&&inDay&&inTime,passed=applyNegate(raw,c.negate);return{label:c.label,passed,detail:local.minute<0?`Invalid timezone ${c.timezone}.`:`${c.timezone} ${String(Math.floor(local.minute/60)).padStart(2,'0')}:${String(local.minute%60).padStart(2,'0')}`}}
  if(c.type==='TREND'){let raw=true;const vals:number[]=[];for(let i=0;i<c.bars;i++)vals.push(val(c.expr,time,i));if(vals.some(v=>!finite(v)))raw=false;else for(let i=0;i<vals.length-1;i++){if(c.direction==='RISING'&&!(vals[i]>vals[i+1]))raw=false;if(c.direction==='FALLING'&&!(vals[i]<vals[i+1]))raw=false}const passed=applyNegate(raw,c.negate);return{label:c.label,passed,detail:`${c.direction.toLowerCase()} over ${c.bars} completed bars; latest ${finite(vals[0])?vals[0].toFixed(4):'n/a'}`}}
  if(c.type==='COMPARE'){const count=Math.max(1,c.bars||1),checks:number[]=[];let raw=true;for(let i=0;i<count;i++){const left=val(c.left,time,i),right=val(c.right,time,i);checks.push(left,right);if(!op(left,c.operator,right))raw=false}const passed=applyNegate(raw,c.negate),left=checks[0],right=checks[1];return{label:c.label,passed,detail:`${finite(left)?left.toFixed(4):'n/a'} ${c.operator} ${finite(right)?right.toFixed(4):'n/a'}${count>1?` for ${count} bars`:''}`}}
  const within=Math.max(1,c.withinBars||1);let raw=false,lastLeft=NaN,lastRight=NaN;for(let i=0;i<within;i++){const l=val(c.left,time,i),r=val(c.right,time,i),lp=val(c.left,time,i+1),rp=val(c.right,time,i+1);if(i===0){lastLeft=l;lastRight=r}if(c.direction==='ABOVE'?finite(lp)&&finite(rp)&&lp<=rp&&l>r:finite(lp)&&finite(rp)&&lp>=rp&&l<r){raw=true;break}}const passed=applyNegate(raw,c.negate);return{label:c.label,passed,detail:`${c.direction} cross${within>1?` within ${within} bars`:''}: ${finite(lastLeft)?lastLeft.toFixed(4):'n/a'} vs ${finite(lastRight)?lastRight.toFixed(4):'n/a'}`};
 }
 function evaluate(time:number,priorSettlements:('UP'|'DOWN')[]){const groups=(strategy.conditionGroups?.length?strategy.conditionGroups:[{logic:'ALL',conditions:strategy.trigger.streakLength?[{type:'SETTLEMENT_STREAK',side:strategy.trigger.streakSide||strategy.side,length:strategy.trigger.streakLength,label:'Settlement streak'} as StrategyCondition]:[]}]) as ConditionGroup[];const grouped=groups.map(g=>g.conditions.map(c=>evaluateCondition(c,time,priorSettlements))),groupPass=grouped.map((r,i)=>({group:i+1,passed:r.every(x=>x.passed)})),passed=groupPass.some(g=>g.passed);return{passed,details:grouped.flat(),groups:groupPass}}
 return{evaluate};
}

export function timeframeSeconds(tf:IndicatorTimeframe){return tfSec[tf]}
