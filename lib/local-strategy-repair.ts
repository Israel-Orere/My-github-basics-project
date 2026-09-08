import type {StrategySpec} from './types';

function money(text:string,patterns:RegExp[]){let best:RegExpMatchArray|undefined;for(const re of patterns){const flags=re.flags.includes('g')?re.flags:`${re.flags}g`;for(const m of text.matchAll(new RegExp(re.source,flags)))if(!best||Number(m.index)>=Number(best.index))best=m}return best?Number(best[1]):undefined}

export function repairLocalStrategy(prompt:string,strategy:StrategySpec):StrategySpec{
  const base=money(prompt,[
    /(?:risk|start(?:\s+with)?|stake|position(?:\s+size)?)[^$\d]{0,12}\$\s*(\d+(?:\.\d+)?)/i,
    /\$\s*(\d+(?:\.\d+)?)\s*(?:initially|to\s+start|at\s+first)/i,
  ]);
  const afterWin=money(prompt,[
    /\$\s*(\d+(?:\.\d+)?)\s*(?:after\s+(?:a\s+)?win|after\s+wins)/i,
    /(?:after\s+(?:a\s+)?win|after\s+wins|stay\s+at)[^$\d]{0,18}\$\s*(\d+(?:\.\d+)?)/i,
  ]);
  const afterLoss=money(prompt,[
    /\$\s*(\d+(?:\.\d+)?)\s*(?:after\s+(?:a\s+)?loss|after\s+losses)/i,
    /(?:after\s+(?:a\s+)?loss|after\s+losses|reduce\s+to)[^$\d]{0,18}\$\s*(\d+(?:\.\d+)?)/i,
  ]);
  const maxLoss=money(prompt,[/(?:stop|quit|halt)[^.\n]{0,45}?(?:los(?:e|ing)|loss)[^$\d]{0,10}\$\s*(\d+(?:\.\d+)?)/i]);
  const sizing={
    baseUsd:base??strategy.sizing.baseUsd,
    afterWinUsd:afterWin??(base??strategy.sizing.afterWinUsd),
    afterLossUsd:afterLoss??strategy.sizing.afterLossUsd,
  };
  const risk={...strategy.risk,maxLossUsd:maxLoss??strategy.risk.maxLossUsd};
  if(!strategy.interpretation)return{...strategy,sizing,risk};
  const assumptions=strategy.interpretation.assumptions.filter(a=>{
    if(base!==undefined&&/initial stake/i.test(a))return false;
    if(afterLoss!==undefined&&/after-loss size/i.test(a))return false;
    if(maxLoss!==undefined&&/max-loss stop/i.test(a))return false;
    return true;
  });
  return{...strategy,sizing,risk,interpretation:{...strategy.interpretation,assumptions,sizing:[`Start at $${sizing.baseUsd}; after a win use $${sizing.afterWinUsd}; after a loss use $${sizing.afterLossUsd}.`],risk:[`Stop at -$${risk.maxLossUsd}, ${risk.maxTrades} trades, or ${risk.durationHours} hours.`]}};
}
