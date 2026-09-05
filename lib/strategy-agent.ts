import {generateObject} from 'ai';
import {z} from 'zod';
import {compileStrategy} from './compiler';
import type {StrategySpec} from './types';

const Timeframe=z.enum(['1m','5m','15m','1h','4h']);
const ValueExpr=z.object({
 kind:z.enum(['CONSTANT','PRICE','RSI','SMA','EMA','MACD','MACD_SIGNAL']),
 timeframe:Timeframe.optional(),
 value:z.number().optional(),
 period:z.number().int().min(1).max(500).optional(),
 source:z.enum(['PRICE','RSI']).optional(),
 sourcePeriod:z.number().int().min(1).max(500).optional(),
 fastPeriod:z.number().int().min(1).max(500).optional(),
 slowPeriod:z.number().int().min(2).max(500).optional(),
 signalPeriod:z.number().int().min(1).max(500).optional(),
});
const Condition=z.discriminatedUnion('type',[
 z.object({type:z.literal('COMPARE'),left:ValueExpr,operator:z.enum(['GT','GTE','LT','LTE','EQ']),right:ValueExpr,label:z.string()}),
 z.object({type:z.literal('CROSS'),left:ValueExpr,direction:z.enum(['ABOVE','BELOW']),right:ValueExpr,label:z.string()}),
 z.object({type:z.literal('SETTLEMENT_STREAK'),side:z.enum(['UP','DOWN']),length:z.number().int().min(1).max(12),label:z.string()}),
]);
const AgentStrategy=z.object({
 name:z.string(),
 asset:z.enum(['BTC','ETH']),
 window:z.enum(['15m','1h']),
 side:z.enum(['UP','DOWN']),
 trigger:z.object({streakSide:z.enum(['UP','DOWN']).optional(),streakLength:z.number().int().min(0).max(12).optional(),maxEntryPrice:z.number().gt(0).lte(1)}),
 conditionGroups:z.array(z.object({logic:z.literal('ALL'),conditions:z.array(Condition).max(12)})).min(1).max(8),
 sizing:z.object({baseUsd:z.number().positive().max(1000),afterWinUsd:z.number().positive().max(1000),afterLossUsd:z.number().positive().max(1000)}),
 risk:z.object({maxLossUsd:z.number().positive().max(100000),maxTrades:z.number().int().positive().max(500),durationHours:z.number().positive().max(720)}),
 interpretation:z.object({
  summary:z.string(),entry:z.array(z.string()),execution:z.array(z.string()),sizing:z.array(z.string()),risk:z.array(z.string()),assumptions:z.array(z.string()),questions:z.array(z.string()),confidence:z.number().min(0).max(1),needsClarification:z.boolean()
 }),
});

const SYSTEM=`You are DreamForge's strategy compiler. Convert a user's natural-language event-contract trading idea into a deterministic strategy specification.

The strategy trades DreamDEX BTC or ETH binary event contracts (UP/DOWN) with 15m or 1h contract windows. Technical indicators are calculated from the underlying WBTC/USDso or WETH/USDso spot market, never from the binary contract probability.

Supported deterministic signal primitives:
- PRICE
- RSI(period)
- SMA(period), source PRICE or RSI
- EMA(period), source PRICE or RSI
- MACD(fast, slow) and MACD_SIGNAL(fast, slow, signal)
- comparisons (>, >=, <, <=, =)
- cross ABOVE / BELOW
- previous finalized event-contract settlement streaks.

conditionGroups are OR'ed together. Conditions inside each group are AND'ed together. Convert arbitrary boolean expressions into this OR-of-ANDs form.

CONSTANT expressions must use value. PRICE uses timeframe. RSI uses period + timeframe. SMA/EMA use period + timeframe + source; when source=RSI also set sourcePeriod. MACD/MACD_SIGNAL use fastPeriod, slowPeriod, signalPeriod and timeframe.

The binary contract entry-price ceiling belongs in trigger.maxEntryPrice, not in conditionGroups. If the user gives no ceiling, use 0.99 and list that as an assumption. If stake/risk values are omitted, use conservative defaults: $5 base stake, $5 after win, $2 after loss, $15 max loss, 24 max trades, 6 hour risk session, and disclose each inferred default in assumptions. Infer UP for clearly bullish signals and DOWN for clearly bearish signals. If direction or another material fact cannot be inferred safely, set needsClarification=true and put precise questions in questions; do not pretend certainty.

For simple settlement-streak strategies, include SETTLEMENT_STREAK and also populate trigger.streakSide/streakLength for compatibility. For indicator strategies with no streak, set streakLength=0.

The interpretation is user-facing. Explain exactly what will be measured, when an entry qualifies, what order DreamForge will attempt, sizing, risk stops, assumptions, and ambiguities. confidence reflects confidence in the interpretation, not expected strategy profitability. Never invent performance.`;

function fallback(prompt:string):StrategySpec{
 const s=compileStrategy(prompt);
 const lower=prompt.toLowerCase();
 const advanced=/\brsi\b|\bema\b|\bsma\b|moving average|\bmacd\b|\bcross(?:es|ing)?\b/.test(lower);
 return {...s,conditionGroups:[{logic:'ALL',conditions:s.trigger.streakLength?[{type:'SETTLEMENT_STREAK',side:s.trigger.streakSide||s.side,length:s.trigger.streakLength,label:`Previous ${s.trigger.streakLength} contracts settled ${s.trigger.streakSide||s.side}`}]:[]}],compiler:'deterministic-fallback',interpretation:{summary:advanced?'This strategy needs the AI compiler to translate its indicator logic safely.':`${s.asset} ${s.window} ${s.side} event-contract strategy.`,entry:s.trigger.streakLength?[`Wait for ${s.trigger.streakLength} consecutive ${s.trigger.streakSide} settlements.`]:[],execution:[`Buy ${s.side} only at ${Math.round((s.trigger.maxEntryPrice||.99)*100)}¢ or less.`],sizing:[`Start at $${s.sizing.baseUsd}; after win $${s.sizing.afterWinUsd}; after loss $${s.sizing.afterLossUsd}.`],risk:[`Stop at -$${s.risk.maxLossUsd} or ${s.risk.maxTrades} trades within ${s.risk.durationHours}h.`],assumptions:[],questions:advanced?['AI strategy interpretation is temporarily unavailable. Please retry before backtesting or activating this indicator strategy.']:[],confidence:advanced?0:.7,needsClarification:advanced}};
}

export async function compileStrategyWithAgent(prompt:string):Promise<StrategySpec>{
 try{
  const {object}=await generateObject({model:process.env.STRATEGY_AGENT_MODEL||'openai/gpt-5.6-sol',schema:AgentStrategy,system:SYSTEM,prompt:`Compile this DreamForge strategy exactly and conservatively:\n\n${prompt}`});
  return {...object,compiler:'agent'} as StrategySpec;
 }catch(e){
  console.error('strategy-agent fallback',e);
  return fallback(prompt);
 }
}
