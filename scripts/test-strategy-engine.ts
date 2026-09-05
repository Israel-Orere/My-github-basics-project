import assert from 'node:assert/strict';
import {createStrategyEvaluator,indicatorWarmup,requiredTimeframes} from '../lib/strategy-engine';
import type {StrategySpec} from '../lib/types';

const bars=Array.from({length:8},(_,i)=>({time:i*60,open:100+i,high:101+i,low:99+i,close:100+i,volume:1}));
const base:StrategySpec={name:'test',asset:'BTC',window:'15m',side:'UP',trigger:{maxEntryPrice:.65,streakLength:0},conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'PRICE',timeframe:'1m'},operator:'GT',right:{kind:'SMA',timeframe:'1m',period:3,source:'PRICE'},label:'Price above SMA'}]}],sizing:{baseUsd:5,afterWinUsd:5,afterLossUsd:2},risk:{maxLossUsd:15,maxTrades:10,durationHours:6}};
const eval1=createStrategyEvaluator(base,{'1m':bars});
assert.equal(eval1.evaluate(8*60,[]).passed,true,'increasing price should finish above its 3-period SMA');
assert.deepEqual(requiredTimeframes(base),['1m']);
assert.ok(indicatorWarmup(base)>=60);

const streak:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'SETTLEMENT_STREAK',side:'UP',length:2,label:'Two UP results'}]}]};
const eval2=createStrategyEvaluator(streak,{});
assert.equal(eval2.evaluate(1_000,['UP','UP']).passed,true);
assert.equal(eval2.evaluate(1_000,['DOWN','UP']).passed,false);

const orGroups:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'CONSTANT',value:1},operator:'GT',right:{kind:'CONSTANT',value:2},label:'false branch'}]},{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'CONSTANT',value:3},operator:'GT',right:{kind:'CONSTANT',value:2},label:'true branch'}]}]};
assert.equal(createStrategyEvaluator(orGroups,{}).evaluate(1_000,[]).passed,true,'condition groups should OR together');

const completedOnly:StrategySpec={...base,conditionGroups:[{logic:'ALL',conditions:[{type:'COMPARE',left:{kind:'PRICE',timeframe:'1m'},operator:'GT',right:{kind:'CONSTANT',value:105.5},label:'completed candle only'}]}]};
const eval3=createStrategyEvaluator(completedOnly,{'1m':bars});
assert.equal(eval3.evaluate(7*60+30,[]).passed,true,'bar at t=360 is complete by t=450');
assert.equal(eval3.evaluate(6*60+30,[]).passed,false,'bar at t=360 must not be read before it closes');

console.log('strategy-engine tests passed');
