import assert from 'node:assert/strict';
import {liveReadiness,matchingStrategyMarket} from '../lib/live-readiness';
import type {MarketSnapshot,StrategySpec} from '../lib/types';

const strategy:StrategySpec={name:'Readiness test',asset:'BTC',window:'15m',side:'UP',trigger:{maxEntryPrice:.58},conditionGroups:[],sizing:{baseUsd:8,afterWinUsd:8,afterLossUsd:3},risk:{maxLossUsd:25,maxTrades:12,durationHours:6},compiler:'deterministic-local'};
const eth:MarketSnapshot={id:'eth',symbol:'ETH',asset:'ETH',window:'15m',upPrice:.5,downPrice:.5,status:'TRADING'};
const btc:MarketSnapshot={id:'btc',symbol:'BTC',asset:'BTC',window:'15m',upPrice:.61,downPrice:.39,status:'TRADING'};

assert.equal(matchingStrategyMarket([eth,btc],strategy,eth)?.id,'btc');
let r=liveReadiness({strategy,needsReview:false,activated:true,venueLive:true,selected:btc,signal:{ready:false,reason:'no',details:[{label:'RSI(14) <= 60',passed:false,detail:'63.2 <= 60 is false'}]},wallet:'0xabc'});
assert.equal(r.code,'price');
assert.match(r.buttonLabel,/58¢/);

const cheap={...btc,upPrice:.55};
r=liveReadiness({strategy,needsReview:false,activated:true,venueLive:true,selected:cheap,signal:{ready:false,reason:'no',details:[{label:'RSI(14) <= 60',passed:false,detail:'63.2 <= 60 is false'}]},wallet:'0xabc'});
assert.equal(r.code,'signal');
assert.match(r.buttonLabel,/RSI/);
assert.match(r.detail,/63.2/);

r=liveReadiness({strategy,needsReview:false,activated:true,venueLive:true,selected:cheap,signal:{ready:true,reason:'ready'},wallet:''});
assert.equal(r.code,'wallet');
assert.equal(r.buttonLabel,'Connect wallet to trade');

r=liveReadiness({strategy,needsReview:false,activated:true,venueLive:true,selected:cheap,signal:{ready:true,reason:'ready'},wallet:'0xabc'});
assert.equal(r.ready,true);
assert.equal(r.buttonLabel,'Trade now');
console.log('Live readiness labels passed');
