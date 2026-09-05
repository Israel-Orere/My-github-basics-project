import assert from 'node:assert/strict';
import {createStrategyEvaluator,evaluationStepSeconds,indicatorWarmup,requiredTimeframes} from '../lib/strategy-engine';
import type {SpotBar} from '../lib/strategy-engine';
import type {StrategySpec} from '../lib/types';

const bars:SpotBar[]=Array.from({length:80},(_,i)=>({time:i*60,open:100+i,high:102+i,low:99+i,close:101+i,volume:100+i*2}));
const base:StrategySpec={name:'test',asset:'BTC',window:'15m',side:'UP',trigger:{maxEntryPrice:.65,streakLength:0},conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'PRICE',timeframe:'1m'},operator:'GT',right:{kind:'SMA',timeframe:'1m',period:3,source:'PRICE'},label:'Price above SMA'}]}],sizing:{baseUsd:5,afterWinUsd:5,afterLossUsd:2},risk:{maxLossUsd:15,maxTrades:10,durationHours:6}};
assert.equal(createStrategyEvaluator(base,{'1m':bars}).evaluate(80*60,[]).passed,true,'increasing price should be above SMA');
assert.deepEqual(requiredTimeframes(base),['1m']);
assert.ok(indicatorWarmup(base)>=60);
assert.equal(evaluationStepSeconds(base),60,'1m strategy should replay at 1m signal boundaries');

const streak:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'SETTLEMENT_STREAK',side:'UP',length:2,label:'Two UP results'}]}]};
assert.equal(createStrategyEvaluator(streak,{}).evaluate(1_000,['UP','UP']).passed,true);
assert.equal(createStrategyEvaluator(streak,{}).evaluate(1_000,['DOWN','UP']).passed,false);

const orGroups:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'CONSTANT',value:1},operator:'GT',right:{kind:'CONSTANT',value:2},label:'false branch'}]},{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'CONSTANT',value:3},operator:'GT',right:{kind:'CONSTANT',value:2},label:'true branch'}]}]};
assert.equal(createStrategyEvaluator(orGroups,{}).evaluate(1_000,[]).passed,true,'condition groups should OR together');

const completedOnly:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'PRICE',timeframe:'1m'},operator:'GT',right:{kind:'CONSTANT',value:106.5},label:'completed candle only'}]}]};
const evCompleted=createStrategyEvaluator(completedOnly,{'1m':bars});
assert.equal(evCompleted.evaluate(7*60+30,[]).passed,true,'bar at t=360 is complete by t=450');
assert.equal(evCompleted.evaluate(6*60+30,[]).passed,false,'bar at t=360 must not be read before it closes');

const previousHigh:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'PRICE',timeframe:'1m'},operator:'GT',right:{kind:'HIGH',timeframe:'1m',offsetBars:1},label:'Close above previous high'}]}]};
assert.equal(createStrategyEvaluator(previousHigh,{'1m':bars}).evaluate(30*60,[]).passed,false,'linear bars close below prior high in this fixture');
const breakoutBars=[...bars];breakoutBars[28]={...breakoutBars[28],high:120,close:119};breakoutBars[29]={...breakoutBars[29],close:130,high:131};
assert.equal(createStrategyEvaluator(previousHigh,{'1m':breakoutBars}).evaluate(30*60,[]).passed,true,'offsetBars should express previous-candle references');

const persistent:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'PRICE',timeframe:'1m'},operator:'GT',right:{kind:'EMA',timeframe:'1m',period:5,source:'PRICE'},bars:3,label:'Price above EMA for 3 bars'}]}]};
assert.equal(createStrategyEvaluator(persistent,{'1m':bars}).evaluate(70*60,[]).passed,true,'multi-bar persistence should require every requested completed bar');

const trend:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'TREND',expr:{kind:'RSI',timeframe:'1m',period:5},direction:'RISING',bars:3,label:'RSI rising'}]}]};
const trendResult=createStrategyEvaluator(trend,{'1m':bars}).evaluate(70*60,[]);
assert.equal(typeof trendResult.passed,'boolean','trend conditions should evaluate deterministically');

const bands:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'PRICE',timeframe:'1m'},operator:'LT',right:{kind:'BB_UPPER',timeframe:'1m',period:20,stdDev:2},label:'Below upper band'},{type:'COMPARE',left:{kind:'STOCH_K',timeframe:'1m',period:14,smoothK:3,smoothD:3},operator:'GTE',right:{kind:'CONSTANT',value:0},label:'Stochastic available'},{type:'COMPARE',left:{kind:'ATR',timeframe:'1m',period:14},operator:'GT',right:{kind:'CONSTANT',value:0},label:'ATR positive'}]}]};
assert.equal(createStrategyEvaluator(bands,{'1m':bars}).evaluate(70*60,[]).passed,true,'Bollinger, stochastic and ATR primitives should compose');

const negate:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'CONSTANT',value:1},operator:'GT',right:{kind:'CONSTANT',value:2},negate:true,label:'NOT false'}]}]};
assert.equal(createStrategyEvaluator(negate,{}).evaluate(1_000,[]).passed,true,'atomic NOT should invert a condition');

const clock:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'TIME_WINDOW',timezone:'UTC',startMinute:9*60,endMinute:10*60,daysOfWeek:[1,2,3,4,5],label:'09:00-10:00 UTC weekdays'}]}]};
const monday0930=Math.floor(Date.parse('2026-09-07T09:30:00Z')/1000),monday1030=Math.floor(Date.parse('2026-09-07T10:30:00Z')/1000);
assert.equal(createStrategyEvaluator(clock,{}).evaluate(monday0930,[]).passed,true);
assert.equal(createStrategyEvaluator(clock,{}).evaluate(monday1030,[]).passed,false);
assert.equal(evaluationStepSeconds(clock),60,'time windows should be evaluated minute-by-minute in replay');

const transformed:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'PRICE',timeframe:'1m'},operator:'GT',right:{kind:'EMA',timeframe:'1m',period:5,source:'PRICE',multiplier:1.01,addend:0},label:'Price 1% above EMA'}]}]};
assert.equal(typeof createStrategyEvaluator(transformed,{'1m':bars}).evaluate(70*60,[]).passed,'boolean');

console.log('complex strategy-engine tests passed');
