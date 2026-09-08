import type {MarketSnapshot,StrategySpec} from './types';

export type LiveSignal={
  ready:boolean;
  reason?:string;
  details?:{label:string;passed:boolean;detail:string}[];
};

export type ReadinessState={
  ready:boolean;
  code:'ready'|'review'|'inactive'|'venue'|'contract'|'price'|'signal'|'wallet';
  buttonLabel:string;
  detail:string;
};

function shorten(text:string,max=62){const clean=text.replace(/\s+/g,' ').trim();return clean.length<=max?clean:`${clean.slice(0,max-1)}…`}

export function matchingStrategyMarket(markets:MarketSnapshot[],strategy:StrategySpec,current:MarketSnapshot|null){
  const currentFresh=current?markets.find(m=>m.id===current.id):undefined;
  if(currentFresh&&currentFresh.asset===strategy.asset&&currentFresh.window===strategy.window)return currentFresh;
  return markets.find(m=>m.asset===strategy.asset&&m.window===strategy.window)??null;
}

export function liveReadiness(args:{
  strategy:StrategySpec;
  needsReview:boolean;
  activated:boolean;
  venueLive:boolean;
  selected:MarketSnapshot|null;
  signal:LiveSignal|null;
  wallet:string;
}):ReadinessState{
  const {strategy,needsReview,activated,venueLive,selected,signal,wallet}=args;
  if(needsReview)return{ready:false,code:'review',buttonLabel:'Resolve strategy questions first',detail:'DreamForge still has an unresolved interpretation question.'};
  if(!activated)return{ready:false,code:'inactive',buttonLabel:'Activate strategy first',detail:'Run a backtest and activate this confirmed strategy before live execution.'};
  if(!venueLive)return{ready:false,code:'venue',buttonLabel:'DreamDEX live feed unavailable',detail:'DreamForge cannot verify live DreamDEX markets right now, so trading remains locked.'};
  if(!selected||selected.asset!==strategy.asset||selected.window!==strategy.window)return{ready:false,code:'contract',buttonLabel:`Waiting for ${strategy.asset} ${strategy.window} contract`,detail:`No live ${strategy.asset} ${strategy.window} DreamDEX contract is currently selected.`};
  const cap=strategy.trigger.maxEntryPrice??1,price=strategy.side==='UP'?selected.upPrice:selected.downPrice;
  if(price>cap)return{ready:false,code:'price',buttonLabel:`Waiting for ${strategy.side} ≤ ${Math.round(cap*100)}¢`,detail:`Current ${strategy.side} contract price is ${Math.round(price*100)}¢, above your ${Math.round(cap*100)}¢ maximum.`};
  if(!signal)return{ready:false,code:'signal',buttonLabel:'Checking live strategy signal…',detail:'DreamForge is evaluating the latest completed market data against your confirmed rules.'};
  if(!signal.ready){
    const failed=signal.details?.find(d=>!d.passed);
    if(failed)return{ready:false,code:'signal',buttonLabel:shorten(`No live signal — ${failed.label}`),detail:`${failed.label}: ${failed.detail}`};
    return{ready:false,code:'signal',buttonLabel:'No live signal yet',detail:signal.reason||'The confirmed strategy conditions are not all true right now.'};
  }
  if(!wallet)return{ready:false,code:'wallet',buttonLabel:'Connect wallet to trade',detail:'Your strategy and live market conditions currently qualify. Connect your wallet to authorize execution.'};
  return{ready:true,code:'ready',buttonLabel:'Trade now',detail:'All live strategy, contract-price, venue and wallet checks currently pass.'};
}
