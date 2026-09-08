import {compileStrategy} from './compiler';
import type {IndicatorTimeframe,StrategyCondition,StrategySpec,ValueExpr} from './types';

const constant=(value:number):ValueExpr=>({kind:'CONSTANT',value});
const price=(timeframe?:IndicatorTimeframe,offsetBars=0):ValueExpr=>({kind:'PRICE',timeframe,offsetBars});
const num=(v:string|undefined,fallback:number)=>{const n=Number(v);return Number.isFinite(n)?n:fallback};
const last=<T extends RegExpMatchArray>(rows:T[])=>rows.length?rows[rows.length-1]:undefined;
function matches(text:string,re:RegExp){const flags=re.flags.includes('g')?re.flags:`${re.flags}g`;return [...text.matchAll(new RegExp(re.source,flags))]}
function lastMatch(text:string,re:RegExp){return last(matches(text,re))}
function tfFrom(n?:string,u?:string):IndicatorTimeframe|undefined{if(!n)return undefined;const x=Number(n);if(/hour|hr|h/i.test(u||''))return x===4?'4h':'1h';if(x===1)return'1m';if(x===5)return'5m';if(x===15)return'15m';return undefined}
function tfPrefix(){return String.raw`(?:on\s+(?:the\s+)?(?:(\d+)\s*[- ]?\s*(minute|minutes|min|m|hour|hours|hr|h)\s+(?:chart|timeframe)|(?:the\s+)?(1m|5m|15m|1h|4h))[,\s:]*)?`}
function tfFromMatch(m:RegExpMatchArray|undefined,a=1,b=2,c=3){if(!m)return undefined;return (m[c] as IndicatorTimeframe|undefined)||tfFrom(m[a],m[b])}
function dedupe(conditions:StrategyCondition[]){const seen=new Set<string>();return conditions.filter(c=>{const k=JSON.stringify(c);if(seen.has(k))return false;seen.add(k);return true})}
function explicitCap(text:string){const patterns=[
 /(?:only\s+)?(?:buy|pay|enter|trade|take|accept)(?:\s+(?:up|down))?(?:\s+(?:at|for))?\s*\$?(0?\.\d+|\d{1,2}(?:\.\d+)?)\s*(?:c|¢|cents?)\s*(?:or\s+less|or\s+lower|maximum|max)?/i,
 /\b(\d{1,2}(?:\.\d+)?)\s*(?:c|¢|cents?)\s+or\s+(?:less|lower|below)\b/i,
 /(?:max(?:imum)?(?:\s+entry)?(?:\s+price)?|at\s+most|no\s+more\s+than|under|below|less\s+than)\s*\$?(0?\.\d+|\d{1,2}(?:\.\d+)?)\s*(?:c|¢|cents?)?/i,
 ];
 let found:RegExpMatchArray|undefined;for(const p of patterns){const m=lastMatch(text,p);if(m&&(!found||Number(m.index)>=Number(found.index)))found=m}if(!found)return undefined;const v=Number(found[1]);return Math.min(.99,Math.max(.01,v<1?v:v/100))
}
function moneyLast(text:string,patterns:RegExp[]){let found:RegExpMatchArray|undefined;for(const p of patterns){const m=lastMatch(text,p);if(m&&(!found||Number(m.index)>=Number(found.index)))found=m}return found?Number(found[1]):undefined}
function hasExplicitWindow(text:string){return /\b(?:15\s*(?:m|min|minute)|1\s*(?:h|hr|hour))\b/i.test(text)}
function daysFromText(text:string){if(/monday\s+(?:through|to|-)\s+friday/i.test(text)||/weekdays?/i.test(text))return[1,2,3,4,5];return undefined}
function parseTimeWindow(text:string):StrategyCondition|undefined{const m=lastMatch(text,/(?:only\s+trade|trade|between|from)?[^.\n]{0,80}?\b(?:between|from)\s+(\d{1,2}):(\d{2})\s*(?:and|to|-)\s*(\d{1,2}):(\d{2})\s+([A-Za-z_]+\/[A-Za-z_]+|UTC)\b/i);if(!m)return undefined;const start=Number(m[1])*60+Number(m[2]),end=Number(m[3])*60+Number(m[4]);return{type:'TIME_WINDOW',timezone:m[5],startMinute:start,endMinute:end,daysOfWeek:daysFromText(text),label:`Trade only ${m[1].padStart(2,'0')}:${m[2]}–${m[3].padStart(2,'0')}:${m[4]} ${m[5]}${daysFromText(text)?' on weekdays':''}`}}

export function compileStrategyDeterministically(prompt:string):StrategySpec{
 const text=prompt.replace(/\r/g,' '),lower=text.toLowerCase(),base=compileStrategy(text),conditions:StrategyCondition[]=[],assumptions:string[]=[],questions:string[]=[];
 const assetMention=/\bbtc\b|bitcoin/i.test(text)?'BTC':/\beth\b|ethereum/i.test(text)?'ETH':undefined;
 const sideMention=/\b(?:buy|trade|enter|take|stake|contracts?)\b[^.\n]{0,35}\bdown\b/i.test(text)||/\bdown\s+contracts?\b/i.test(text)?'DOWN':/\b(?:buy|trade|enter|take|stake|contracts?)\b[^.\n]{0,35}\bup\b/i.test(text)||/\bup\s+contracts?\b/i.test(text)?'UP':undefined;
 const asset=(assetMention||base.asset) as 'BTC'|'ETH',side=(sideMention||base.side) as 'UP'|'DOWN',window=base.window;
 if(!assetMention)questions.push('Specify BTC or ETH so DreamForge does not guess the traded underlying.');
 if(!sideMention)questions.push('Specify whether DreamForge should buy UP or DOWN contracts.');
 if(!hasExplicitWindow(text))questions.push('Specify the DreamDEX contract window: 15m or 1h.');

 const streak=lastMatch(text,/(?:previous|last|wait\s+for)?\s*(\d+)\s+(?:consecutive\s+)?(up|down)\s+(?:settlements?|contracts?|outcomes?|markets?)/i)||lastMatch(text,/(\d+)\s+consecutive\s+(up|down)/i);
 const streakLength=streak?Number(streak[1]):0,streakSide=(streak?.[2]?.toUpperCase() as 'UP'|'DOWN'|undefined)||side;
 if(streakLength)conditions.push({type:'SETTLEMENT_STREAK',side:streakSide,length:streakLength,label:`Wait for ${streakLength} consecutive ${streakSide} settlements`});

 const rsiBetween=lastMatch(text,/rsi\s*(?:\(\s*(\d+)\s*\)|\s*(\d+))?[^.\n]{0,32}?\bbetween\s*(-?\d+(?:\.\d+)?)\s*(?:and|to|-)\s*(-?\d+(?:\.\d+)?)/i);
 if(rsiBetween){const period=num(rsiBetween[1]||rsiBetween[2],14),lo=Number(rsiBetween[3]),hi=Number(rsiBetween[4]),expr:ValueExpr={kind:'RSI',period,timeframe:window};conditions.push({type:'COMPARE',left:expr,operator:'GTE',right:constant(Math.min(lo,hi)),label:`RSI(${period}) ≥ ${Math.min(lo,hi)}`},{type:'COMPARE',left:expr,operator:'LTE',right:constant(Math.max(lo,hi)),label:`RSI(${period}) ≤ ${Math.max(lo,hi)}`})}
 else {
  const rsiCmp=lastMatch(text,/rsi\s*(?:\(\s*(\d+)\s*\)|\s*(\d+))?\s*(?:is|must\s+be)?\s*(above|over|greater\s+than|>=|>|below|under|less\s+than|<=|<)\s*(-?\d+(?:\.\d+)?)/i);
  if(rsiCmp){const period=num(rsiCmp[1]||rsiCmp[2],14),op=/below|under|less|<(?!=)/i.test(rsiCmp[3])?'LT':/<=/.test(rsiCmp[3])?'LTE':/>=/.test(rsiCmp[3])?'GTE':'GT';conditions.push({type:'COMPARE',left:{kind:'RSI',period,timeframe:window},operator:op,right:constant(Number(rsiCmp[4])),label:`RSI(${period}) ${op} ${rsiCmp[4]}`})}
 }

 const maCmp=lastMatch(text,/(ema|sma)\s*\(?\s*(\d+)\s*\)?\s*(?:is|must\s+be)?\s*(above|over|greater\s+than|>|>=|below|under|less\s+than|<|<=)\s*(ema|sma)\s*\(?\s*(\d+)\s*\)?/i);
 if(maCmp){const k1=maCmp[1].toUpperCase() as 'EMA'|'SMA',k2=maCmp[4].toUpperCase() as 'EMA'|'SMA',rel=maCmp[3],op=/below|under|less|<(?!=)/i.test(rel)?'LT':/<=/.test(rel)?'LTE':/>=/.test(rel)?'GTE':'GT';conditions.push({type:'COMPARE',left:{kind:k1,period:Number(maCmp[2]),source:'PRICE',timeframe:window},operator:op,right:{kind:k2,period:Number(maCmp[5]),source:'PRICE',timeframe:window},label:`${k1}${maCmp[2]} ${op} ${k2}${maCmp[5]}`})}

 const vol=lastMatch(text,/(?:current\s+)?(?:[\w-]+\s+)?volume\s*(?:is|must\s+be)?\s*(?:above|over|greater\s+than|>)\s*(?:(\d+(?:\.\d+)?)\s*(?:x|times)\s*)?(?:its\s+)?(?:(\d+)\s*[- ]?period\s+)?(?:sma|simple\s+moving\s+average)(?:\s*\(?\s*(\d+)\s*\)?)?/i);
 if(vol){const multiplier=num(vol[1],1),period=num(vol[2]||vol[3],20);conditions.push({type:'COMPARE',left:{kind:'VOLUME',timeframe:window},operator:'GT',right:{kind:'SMA',period,source:'VOLUME',timeframe:window,multiplier},label:`Volume > ${multiplier===1?'':`${multiplier}× `}SMA(${period}) of volume`})}

 const range=lastMatch(text,/(?:inside|within)[^.\n]{0,70}?(?:highest\s+high[^.\n]{0,30}lowest\s+low|high\s*[-/]\s*low\s+range|range)[^.\n]{0,35}?previous\s+(\d+)\s+(?:completed\s+)?(?:bars?|candles?)/i)||lastMatch(text,/(?:inside|within)\s+(?:the\s+)?previous\s+(\d+)\s*[- ]bar\s+(?:high\s*[-/]\s*low\s+)?range/i);
 if(range){const period=Number(range[1]),hi:ValueExpr={kind:'HIGHEST_HIGH',period,timeframe:window,offsetBars:1},lo:ValueExpr={kind:'LOWEST_LOW',period,timeframe:window,offsetBars:1};conditions.push({type:'COMPARE',left:price(window),operator:'LTE',right:hi,label:`Price ≤ previous ${period}-bar highest high`},{type:'COMPARE',left:price(window),operator:'GTE',right:lo,label:`Price ≥ previous ${period}-bar lowest low`});
  const lowerPct=lastMatch(text,/(?:bottom|lower)\s+(\d+(?:\.\d+)?)\s*%\s+(?:of\s+)?(?:that|the)?\s*range/i),upperPct=lastMatch(text,/(?:top|upper)\s+(\d+(?:\.\d+)?)\s*%\s+(?:of\s+)?(?:that|the)?\s*range/i),rp:ValueExpr={kind:'RANGE_POSITION',period,timeframe:window,offsetBars:1};
  if(lowerPct){const p=Number(lowerPct[1]);conditions.push({type:'COMPARE',left:rp,operator:'GTE',right:constant(0),label:`Range position ≥ 0%`},{type:'COMPARE',left:rp,operator:'LTE',right:constant(p),label:`Range position ≤ ${p}%`})}
  if(upperPct){const p=Number(upperPct[1]);conditions.push({type:'COMPARE',left:rp,operator:'GTE',right:constant(100-p),label:`Range position ≥ ${100-p}%`},{type:'COMPARE',left:rp,operator:'LTE',right:constant(100),label:`Range position ≤ 100%`})}
 }

 const trend=lastMatch(text,/(ema|sma)\s*\(?\s*(\d+)\s*\)?\s*(?:must\s+have\s+been|has\s+been|must\s+be|is)?\s*(rising|falling)\s+(?:for\s+)?(?:the\s+)?(?:last\s+)?(\d+)\s+(?:completed\s+)?(?:bars?|candles?)/i);
 if(trend){const kind=trend[1].toUpperCase() as 'EMA'|'SMA',period=Number(trend[2]);conditions.push({type:'TREND',expr:{kind,period,source:'PRICE',timeframe:window},direction:trend[3].toLowerCase()==='falling'?'FALLING':'RISING',bars:Number(trend[4]),label:`${kind}${period} ${trend[3].toLowerCase()} for ${trend[4]} bars`})}

 const vwapCross=lastMatch(text,/(?:price|close)[^.\n]{0,24}?(?:crossed|crosses|cross)\s+(above|below)\s+vwap(?:\s*\(?\s*(\d+)\s*\)?)?[^.\n]{0,40}?(?:within\s+(?:the\s+)?last\s+(\d+)\s+(?:completed\s+)?bars?)?/i);
 if(vwapCross){const period=num(vwapCross[2],20),within=num(vwapCross[3],1);conditions.push({type:'CROSS',left:price(window),direction:vwapCross[1].toLowerCase()==='below'?'BELOW':'ABOVE',right:{kind:'VWAP',period,timeframe:window},withinBars:within,label:`Price crossed ${vwapCross[1].toLowerCase()} VWAP(${period})${within>1?` within ${within} bars`:''}`})}

 const previousHL=lastMatch(text,/(?:latest\s+completed\s+)?(?:(\d+)\s*[- ]?(minute|minutes|min|m|hour|hours|hr|h)\s+)?(?:price|close)\s*(?:is|must\s+be)?\s*(above|over|>|below|under|<)\s+(?:the\s+)?previous\s+(?:completed\s+)?(?:(\d+)\s*[- ]?(minute|minutes|min|m|hour|hours|hr|h)\s+)?(high|low|close)/i);
 if(previousHL){const tf=tfFrom(previousHL[1]||previousHL[4],previousHL[2]||previousHL[5])||window,kind=previousHL[6].toUpperCase() as 'HIGH'|'LOW'|'PRICE',op=/below|under|</i.test(previousHL[3])?'LT':'GT';conditions.push({type:'COMPARE',left:price(tf),operator:op,right:{kind:kind==='PRICE'?'PRICE':kind,timeframe:tf,offsetBars:1},label:`${tf} close ${op} previous ${previousHL[6].toLowerCase()}`})}

 const atr=lastMatch(text,new RegExp(`${tfPrefix()}ATR\\s*\\(?\\s*(\\d+)\\s*\\)?\\s*(?:is|must\\s+be)?\\s*(above|over|greater\\s+than|>|below|under|less\\s+than|<)\\s*(-?\\d+(?:\\.\\d+)?)`,'i'));
 if(atr){const tf=tfFromMatch(atr)||window,period=Number(atr[4]),op=/below|under|less|</i.test(atr[5])?'LT':'GT';conditions.push({type:'COMPARE',left:{kind:'ATR',period,timeframe:tf},operator:op,right:constant(Number(atr[6])),label:`ATR(${period}) ${op} ${atr[6]} on ${tf}`})}

 const bbCross=lastMatch(text,new RegExp(`${tfPrefix()}(?:price|close)\\s*(?:crossed|crosses|cross)\\s+(above|below)\\s+(?:the\\s+)?(upper|lower|middle)\\s+bollinger(?:\\s+band)?[^.\\n]{0,40}?(?:period\\s*)?(\\d+)?[^.\\n]{0,30}?(\\d+(?:\\.\\d+)?)?\\s*(?:standard\\s+deviations?|std(?:dev)?)?`,'i'));
 if(bbCross){const tf=tfFromMatch(bbCross)||window,edge=bbCross[5].toLowerCase(),period=num(bbCross[6],20),std=num(bbCross[7],2),kind=(edge==='upper'?'BB_UPPER':edge==='lower'?'BB_LOWER':'BB_MIDDLE') as ValueExpr['kind'];conditions.push({type:'CROSS',left:price(tf),direction:bbCross[4].toLowerCase()==='below'?'BELOW':'ABOVE',right:{kind,period,stdDev:std,timeframe:tf},label:`Price crossed ${bbCross[4].toLowerCase()} ${edge} Bollinger(${period}, ${std}) on ${tf}`})}

 const macdCross=lastMatch(text,new RegExp(`${tfPrefix()}MACD(?:\\s*\\(\\s*(\\d+)\\s*[,/]\\s*(\\d+)(?:\\s*[,/]\\s*(\\d+))?\\s*\\))?\\s*(?:crossed|crosses|cross)\\s+(above|below)\\s+(?:its\\s+)?signal`,'i'));
 if(macdCross){const tf=tfFromMatch(macdCross)||window,fast=num(macdCross[4],12),slow=num(macdCross[5],26),signal=num(macdCross[6],9);conditions.push({type:'CROSS',left:{kind:'MACD',fastPeriod:fast,slowPeriod:slow,timeframe:tf},direction:macdCross[7].toLowerCase()==='below'?'BELOW':'ABOVE',right:{kind:'MACD_SIGNAL',fastPeriod:fast,slowPeriod:slow,signalPeriod:signal,timeframe:tf},label:`MACD(${fast},${slow},${signal}) crossed ${macdCross[7].toLowerCase()} signal on ${tf}`})}

 const tw=parseTimeWindow(text);if(tw)conditions.push(tw);

 const maxEntryPrice=explicitCap(text)??.99;if(explicitCap(text)===undefined)assumptions.push('No event-contract entry ceiling was stated; local compiler uses 99¢ and will still re-check executable price before a trade.');
 const baseUsd=moneyLast(text,[/(?:risk|start(?:\s+with)?|initial(?:ly)?|stake|position(?:\s+size)?)[^$\d]{0,12}\$\s*(\d+(?:\.\d+)?)/i,/(?:risk|start(?:\s+with)?|initial(?:ly)?|stake|position(?:\s+size)?)[^\d]{0,8}(\d+(?:\.\d+)?)\s*(?:usd|dollars?)/i])??5;
 const afterWinUsd=moneyLast(text,[/(?:after\s+(?:a\s+)?win|after\s+wins|stay\s+at)[^$\d]{0,15}\$?\s*(\d+(?:\.\d+)?)/i])??baseUsd;
 const afterLossUsd=moneyLast(text,[/(?:after\s+(?:a\s+)?loss|after\s+losses|reduce\s+to)[^$\d]{0,15}\$?\s*(\d+(?:\.\d+)?)/i])??2;
 const maxLossUsd=moneyLast(text,[/(?:stop|quit|halt)[^.\n]{0,40}?(?:los(?:e|ing)|loss)[^$\d]{0,8}\$?\s*(\d+(?:\.\d+)?)/i])??15;
 const mt=lastMatch(text,/(?:max(?:imum)?|stop\s+after|no\s+more\s+than|after)\s*(\d+)\s*trades?/i),dh=lastMatch(text,/(?:for|over|within|after)\s*(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)\b/i),maxTrades=mt?Number(mt[1]):24,durationHours=dh?Number(dh[1]):6;
 if(!/(?:risk|start|stake|position\s+size)[^.\n]{0,20}(?:\$|usd|dollars?)/i.test(text))assumptions.push('No initial stake was stated; local compiler uses $5.');
 if(!/(?:after\s+(?:a\s+)?loss|after\s+losses|reduce\s+to)/i.test(text))assumptions.push('No after-loss size was stated; local compiler uses $2.');
 if(!/(?:stop|quit|halt)[^.\n]{0,40}?(?:los(?:e|ing)|loss)/i.test(text))assumptions.push('No max-loss stop was stated; local compiler uses $15.');
 if(!mt)assumptions.push('No trade-count stop was stated; local compiler uses 24 trades.');
 if(!dh)assumptions.push('No risk-session duration was stated; local compiler uses 6 hours.');

 if(/\bor\b/i.test(text)&&/\b(?:setup|condition|either|branch|\(a\)|\(b\))\b/i.test(text))questions.push('This strategy contains branching OR logic. While the AI compiler is unavailable, restate it as one AND-only setup or wait for the agent compiler so DreamForge does not change your boolean logic.');
 const keywordChecks:[RegExp,RegExp,string][]=[
  [/\brsi\b/i,/\brsi\b/i,'RSI'],[/\bema\b/i,/\bema\b/i,'EMA'],[/\bsma\b|moving average/i,/\bsma\b|moving average/i,'moving average'],[/\bvolume\b/i,/\bvolume\b/i,'volume'],[/\batr\b/i,/\batr\b/i,'ATR'],[/bollinger/i,/bollinger/i,'Bollinger'],[/\bvwap\b/i,/\bvwap\b/i,'VWAP'],[/\bmacd\b/i,/\bmacd\b/i,'MACD'],[/stoch/i,/stoch/i,'stochastic'],[/\broc\b/i,/\broc\b/i,'ROC'],[/\bobv\b/i,/\bobv\b/i,'OBV'],[/range|highest high|lowest low/i,/range|highest high|lowest low/i,'rolling range']
 ];
 const condText=conditions.map(c=>JSON.stringify(c)).join(' ').toLowerCase();for(const [present,,name] of keywordChecks){if(present.test(text)&&!condText.includes(name.toLowerCase().replace('moving average','sma').replace('rolling range','range'))){if(name==='stochastic'||name==='ROC'||name==='OBV')questions.push(`${name} is mentioned but the local compiler could not safely infer its exact comparison. State the indicator, period and comparison explicitly.`)}}
 const unsupported=[['ADX',/\badx\b/i],['Supertrend',/\bsupertrend\b/i],['Ichimoku',/\bichimoku\b/i],['Fibonacci',/\bfibonacci\b|\bfib\b/i],['order-book imbalance',/order\s*book\s*imbalance/i],['open interest',/\bopen interest\b/i],['funding rate',/\bfunding rate\b/i]] as const;for(const [name,re] of unsupported)if(re.test(text))questions.push(`${name} is not yet a deterministic DreamForge primitive.`);

 const cleaned=dedupe(conditions),needsClarification=questions.length>0;
 if(!cleaned.length)questions.push('No deterministic entry condition was recognized. State at least one supported indicator, price/range rule, time filter, or settlement rule.');
 const finalNeeds=questions.length>0;
 return{
  name:`${asset} Local Rule Set`,asset,window,side,
  trigger:{streakSide,streakLength,maxEntryPrice},
  conditionGroups:[{logic:'ALL',conditions:cleaned}],
  sizing:{baseUsd,afterWinUsd,afterLossUsd},risk:{maxLossUsd,maxTrades,durationHours},compiler:'deterministic-local' as any,
  interpretation:{summary:finalNeeds?'DreamForge parsed the parts it can prove locally, but one or more details still need your answer.':`DreamForge locally compiled ${cleaned.length} deterministic condition${cleaned.length===1?'':'s'} for this ${asset} ${window} ${side} strategy without relying on the AI gateway.`,entry:cleaned.map(c=>c.label),execution:[`Buy ${side} only at ${Math.round(maxEntryPrice*100)}¢ or less after every compiled condition passes.`],sizing:[`Start at $${baseUsd}; after a win use $${afterWinUsd}; after a loss use $${afterLossUsd}.`],risk:[`Stop at -$${maxLossUsd}, ${maxTrades} trades, or ${durationHours} hours.`],assumptions,questions,confidence:finalNeeds?.55:.9,needsClarification:finalNeeds}
 };
}
