import {StrategySpec} from './types';
const money=(s:string,ps:RegExp[],f:number)=>{for(const p of ps){const m=s.match(p);if(m)return Number(m[1])}return f};
export function compileStrategy(prompt:string):StrategySpec{
 const s=prompt.toLowerCase();
 const asset=s.includes('eth')?'ETH':'BTC';
 const window=/\b1\s*(h|hr|hour)/.test(s)?'1h':'15m';
 const wantsDown=/(?:\bbuy\b|\btrade\b|\bstake\b).{0,24}\bdown\b/.test(s),wantsUp=/(?:\bbuy\b|\btrade\b|\bstake\b).{0,24}\bup\b/.test(s);
 const side:wants='UP' as any;
 const chosenSide:'UP'|'DOWN'=wantsDown&&!wantsUp?'DOWN':'UP';
 const streak=s.match(/(?:previous|last)\s+(\d+)\s+(?:contracts?|outcomes?|markets?).{0,35}\b(up|down)\b/)||s.match(/(\d+)\s+consecutive\s+(up|down)/);
 const cents=s.match(/(?:below|under|less than|costs?\s*(?:less than|under|below)?|at most|max(?:imum)?(?: price)?(?: of)?)\s*\$?(0?\.\d+|\d{1,2})\s*(?:c|¢|cents)?/);
 let maxEntryPrice=.65;if(cents){const v=Number(cents[1]);maxEntryPrice=v<1?v:v/100}
 const baseUsd=money(s,[/(?:buy|stake|position(?: size)?(?: of| =)?)[^$\d]{0,12}\$\s*(\d+(?:\.\d+)?)/,/(?:buy|stake|position(?: size)?(?: of| =)?)[^\d]{0,8}(\d+(?:\.\d+)?)\s*(?:usd|dollars?)/],5);
 const maxLossUsd=money(s,[/(?:stop|quit|halt).{0,35}(?:los(?:e|ing)|loss)[^$\d]{0,8}\$?\s*(\d+(?:\.\d+)?)/],15);
 const afterLoss=money(s,[/after (?:a )?loss.{0,20}\$?\s*(\d+(?:\.\d+)?)/,/reduce.{0,20}\$?\s*(\d+(?:\.\d+)?)/],baseUsd);
 const afterWin=money(s,[/after (?:a )?win.{0,20}\$?\s*(\d+(?:\.\d+)?)/],baseUsd);
 const maxTrades=Number(s.match(/(?:max(?:imum)?|stop after|no more than)\s*(\d+)\s*trades?/)?.[1]||24);
 const durationHours=Number(s.match(/(?:for|over|within)\s*(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)/)?.[1]||6);
 return{name:`${asset} ${streak?'Streak Rider':'Rule Runner'}`,asset,window,side:chosenSide,trigger:{streakSide:(streak?.[2]?.toUpperCase() as 'UP'|'DOWN')||chosenSide,streakLength:streak?Number(streak[1]):2,maxEntryPrice:Math.min(.99,Math.max(.01,maxEntryPrice))},sizing:{baseUsd,afterWinUsd:afterWin,afterLossUsd:afterLoss},risk:{maxLossUsd,maxTrades:Math.max(1,Math.min(500,maxTrades)),durationHours:Math.max(1,durationHours)}}
}
type wants='UP'|'DOWN';
