import assert from 'node:assert/strict';
import {POST} from '../app/api/backtest/route';
import type {StrategySpec} from '../lib/types';

const strategy:StrategySpec={
  name:'Backtest smoke',asset:'BTC',window:'15m',side:'UP',
  trigger:{streakSide:'UP',streakLength:2,maxEntryPrice:.58},
  conditionGroups:[{logic:'ALL',conditions:[
    {type:'SETTLEMENT_STREAK',side:'UP',length:2,label:'2 consecutive UP settlements'},
    {type:'COMPARE',left:{kind:'RSI',period:14,timeframe:'15m'},operator:'GTE',right:{kind:'CONSTANT',value:42},label:'RSI(14) >= 42'},
    {type:'COMPARE',left:{kind:'RSI',period:14,timeframe:'15m'},operator:'LTE',right:{kind:'CONSTANT',value:60},label:'RSI(14) <= 60'},
    {type:'COMPARE',left:{kind:'EMA',period:20,source:'PRICE',timeframe:'15m'},operator:'GT',right:{kind:'EMA',period:50,source:'PRICE',timeframe:'15m'},label:'EMA20 > EMA50'},
    {type:'COMPARE',left:{kind:'VOLUME',timeframe:'15m'},operator:'GT',right:{kind:'SMA',period:20,source:'VOLUME',timeframe:'15m'},label:'Volume > SMA20(volume)'}
  ]}],
  sizing:{baseUsd:8,afterWinUsd:8,afterLossUsd:3},
  risk:{maxLossUsd:25,maxTrades:12,durationHours:6},
  compiler:'deterministic-local',
  interpretation:{summary:'CI backtest smoke',entry:[],execution:[],sizing:[],risk:[],assumptions:[],questions:[],confidence:.95,needsClarification:false}
};

async function main(){
  const to=Math.floor(Date.now()/1000)-900;
  const from=to-7*86400;
  const req=new Request('http://localhost/api/backtest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({strategy,from,to,startingCapital:100})});
  const started=Date.now();
  const res=await POST(req);
  const raw=await res.text();
  assert.ok(res.ok,`backtest route failed: ${res.status} ${raw.slice(0,1500)}`);
  const body=JSON.parse(raw);
  assert.equal(body.source,'dreamdex-agent-replay');
  assert.ok(Number.isFinite(body.markets),'markets count missing');
  assert.ok(Array.isArray(body.ruleStats),'ruleStats missing');
  console.log(`backtest route smoke passed in ${((Date.now()-started)/1000).toFixed(1)}s: ${body.markets} markets, ${body.candidateMarkets} candidates, ${body.trades} trades`);
}
main().catch(e=>{console.error(e);process.exit(1)});
