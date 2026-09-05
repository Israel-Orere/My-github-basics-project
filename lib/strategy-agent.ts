import {generateObject} from 'ai';
import {z} from 'zod';
import {compileStrategy} from './compiler';
import type {StrategyCondition,StrategySpec,ValueExpr} from './types';

const Timeframe=z.enum(['1m','5m','15m','1h','4h']);
const ValueExprSchema=z.object({
 kind:z.enum(['CONSTANT','PRICE','OPEN','HIGH','LOW','VOLUME','RSI','SMA','EMA','MACD','MACD_SIGNAL','ATR','ROC','STOCH_K','STOCH_D','BB_UPPER','BB_MIDDLE','BB_LOWER','VWAP','OBV']),
 timeframe:Timeframe.optional(),value:z.number().optional(),period:z.number().int().min(1).max(1000).optional(),source:z.enum(['PRICE','RSI','VOLUME']).optional(),sourcePeriod:z.number().int().min(1).max(1000).optional(),fastPeriod:z.number().int().min(1).max(1000).optional(),slowPeriod:z.number().int().min(2).max(1000).optional(),signalPeriod:z.number().int().min(1).max(1000).optional(),stdDev:z.number().positive().max(10).optional(),smoothK:z.number().int().min(1).max(100).optional(),smoothD:z.number().int().min(1).max(100).optional(),offsetBars:z.number().int().min(0).max(100).optional(),multiplier:z.number().min(-1000).max(1000).optional(),addend:z.number().min(-1e9).max(1e9).optional(),
});
const Condition=z.discriminatedUnion('type',[
 z.object({type:z.literal('COMPARE'),left:ValueExprSchema,operator:z.enum(['GT','GTE','LT','LTE','EQ']),right:ValueExprSchema,bars:z.number().int().min(1).max(50).optional(),negate:z.boolean().optional(),label:z.string()}),
 z.object({type:z.literal('CROSS'),left:ValueExprSchema,direction:z.enum(['ABOVE','BELOW']),right:ValueExprSchema,withinBars:z.number().int().min(1).max(20).optional(),negate:z.boolean().optional(),label:z.string()}),
 z.object({type:z.literal('TREND'),expr:ValueExprSchema,direction:z.enum(['RISING','FALLING']),bars:z.number().int().min(2).max(50),negate:z.boolean().optional(),label:z.string()}),
 z.object({type:z.literal('SETTLEMENT_STREAK'),side:z.enum(['UP','DOWN']),length:z.number().int().min(1).max(24),negate:z.boolean().optional(),label:z.string()}),
 z.object({type:z.literal('TIME_WINDOW'),timezone:z.string(),startMinute:z.number().int().min(0).max(1439),endMinute:z.number().int().min(0).max(1440),daysOfWeek:z.array(z.number().int().min(0).max(6)).max(7).optional(),negate:z.boolean().optional(),label:z.string()}),
]);
const AgentStrategy=z.object({
 name:z.string(),asset:z.enum(['BTC','ETH']),window:z.enum(['15m','1h']),side:z.enum(['UP','DOWN']),
 trigger:z.object({streakSide:z.enum(['UP','DOWN']).optional(),streakLength:z.number().int().min(0).max(24).optional(),maxEntryPrice:z.number().gt(0).lte(1)}),
 conditionGroups:z.array(z.object({logic:z.literal('ALL'),conditions:z.array(Condition).max(30)})).min(1).max(24),
 sizing:z.object({baseUsd:z.number().positive().max(1000),afterWinUsd:z.number().positive().max(1000),afterLossUsd:z.number().positive().max(1000)}),
 risk:z.object({maxLossUsd:z.number().positive().max(100000),maxTrades:z.number().int().positive().max(1000),durationHours:z.number().positive().max(720)}),
 interpretation:z.object({summary:z.string(),entry:z.array(z.string()),execution:z.array(z.string()),sizing:z.array(z.string()),risk:z.array(z.string()),assumptions:z.array(z.string()),questions:z.array(z.string()),confidence:z.number().min(0).max(1),needsClarification:z.boolean()}),
});

const SYSTEM=`You are DreamForge's strategy compiler. Your job is to understand a user's event-contract trading strategy exactly, convert it into a deterministic specification, and expose any ambiguity instead of guessing material trading intent.

DreamForge trades DreamDEX BTC or ETH binary UP/DOWN contracts with 15m or 1h contract windows. Indicator signals come from the underlying WBTC/USDso or WETH/USDso spot market. Binary probability is used only for the event-contract entry-price ceiling and execution.

SUPPORTED VALUE EXPRESSIONS
- OHLCV: PRICE (close), OPEN, HIGH, LOW, VOLUME
- RSI(period)
- SMA/EMA(period) of PRICE, RSI or VOLUME
- MACD(fast,slow) and MACD_SIGNAL(fast,slow,signal)
- ATR(period), ROC(period)
- stochastic %K/%D via STOCH_K/STOCH_D(period,smoothK,smoothD)
- Bollinger BB_UPPER/BB_MIDDLE/BB_LOWER(period,stdDev)
- rolling VWAP(period), OBV
- CONSTANT
Every non-constant expression may specify timeframe, offsetBars (0=current completed bar, 1=previous completed bar), multiplier and addend. Use multiplier/addend to express rules such as price > EMA*1.02 or fastEMA > slowEMA+5.

SUPPORTED CONDITIONS
- COMPARE two expressions. bars=N means it must remain true for N completed bars.
- CROSS ABOVE/BELOW. withinBars=N means the cross may have happened within the last N completed bars.
- TREND: an expression RISING/FALLING for N bars.
- SETTLEMENT_STREAK for prior finalized DreamDEX contracts.
- TIME_WINDOW with IANA timezone, local start/end minutes and optional daysOfWeek (Sun=0..Sat=6).
- Any atomic condition can be negate=true.

BOOLEAN LOGIC
conditionGroups are OR'ed. Conditions within a group are AND'ed. Convert arbitrary user boolean logic into this OR-of-ANDs form. Example: (A OR B) AND C becomes two groups: [A,C] and [B,C]. NOT A becomes A with negate=true. Do not drop repeated conditions when expanding boolean logic.

INTERPRETATION RULES
- Preserve every explicit number, timeframe, direction, indicator parameter, ordering rule, and AND/OR/NOT relationship.
- “previous high/low/close” means offsetBars=1. “two bars ago” means offsetBars=2.
- A price stated as 55 cents for an UP/DOWN contract means trigger.maxEntryPrice=0.55.
- If the user says “moving average” but does not specify SMA vs EMA and it materially matters, ask. If they clearly say EMA/SMA, do not ask.
- Widely conventional defaults may be used only when the user omitted parameters: RSI 14; MACD 12/26/9; Bollinger 20/2; stochastic 14/3/3; ATR 14. Every inferred default must be listed in assumptions.
- If indicator timeframe is omitted, default to the event-contract window and disclose it.
- If a time-of-day rule lacks timezone, ask rather than guess.
- If the trade direction cannot be safely inferred, ask rather than guess.
- If stake/risk are omitted, conservative defaults are $5 base, $5 after win, $2 after loss, $15 max loss, 24 max trades, 6h risk session; disclose each inferred default.
- If no event-contract entry ceiling is given, use 0.99 and disclose that assumption.
- For settlement streaks, also populate trigger.streakSide/streakLength. Otherwise streakLength=0.
- Never invent performance, market data, or unsupported indicators.

The interpretation is user-facing and should explain exactly what will be measured, when entry qualifies, how boolean branches work, what DreamForge will buy, sizing, risk, assumptions and questions. confidence is confidence in interpretation, never expected profitability.`;

const unsupported:[RegExp,string][]=[[/\badx\b/i,'ADX'],[/\bsupertrend\b/i,'Supertrend'],[/\bichimoku\b/i,'Ichimoku'],[/\bfibonacci\b|\bfib\b/i,'Fibonacci levels'],[/order\s*book\s*imbalance/i,'order-book imbalance'],[/\bopen interest\b/i,'open interest'],[/\bfunding rate\b/i,'funding rate']];
function unsupportedConcepts(prompt:string){return unsupported.filter(([r])=>r.test(prompt)).map(([,n])=>n)}
function expressionProblems(e:ValueExpr,path:string){const out:string[]=[];if(e.kind==='CONSTANT'&&!Number.isFinite(e.value))out.push(`${path}: CONSTANT needs a numeric value`);if(['SMA','EMA','ATR','ROC','STOCH_K','STOCH_D','BB_UPPER','BB_MIDDLE','BB_LOWER','VWAP'].includes(e.kind)&&!(e.period&&e.period>0))out.push(`${path}: ${e.kind} needs period`);if(e.kind==='RSI'&&!(e.period&&e.period>0))out.push(`${path}: RSI needs period`);if((e.kind==='SMA'||e.kind==='EMA')&&e.source==='RSI'&&!(e.sourcePeriod&&e.sourcePeriod>0))out.push(`${path}: ${e.kind} of RSI needs sourcePeriod`);if((e.kind==='MACD'||e.kind==='MACD_SIGNAL')&&(!(e.fastPeriod&&e.slowPeriod)||e.fastPeriod>=e.slowPeriod!))out.push(`${path}: MACD needs fastPeriod < slowPeriod`);if(e.kind==='MACD_SIGNAL'&&!(e.signalPeriod&&e.signalPeriod>0))out.push(`${path}: MACD_SIGNAL needs signalPeriod`);return out}
function semanticProblems(s:z.infer<typeof AgentStrategy>){const out:string[]=[];s.conditionGroups.forEach((g,gi)=>{if(!g.conditions.length)out.push(`group ${gi+1} has no conditions`);g.conditions.forEach((c:StrategyCondition,ci)=>{if(c.type==='COMPARE'||c.type==='CROSS'){out.push(...expressionProblems(c.left,`group ${gi+1} condition ${ci+1} left`),...expressionProblems(c.right,`group ${gi+1} condition ${ci+1} right`))}else if(c.type==='TREND')out.push(...expressionProblems(c.expr,`group ${gi+1} condition ${ci+1}`));else if(c.type==='TIME_WINDOW'){try{new Intl.DateTimeFormat('en-US',{timeZone:c.timezone}).format(new Date())}catch{out.push(`group ${gi+1} condition ${ci+1}: invalid IANA timezone ${c.timezone}`)}}})});return [...new Set(out)]}
async function compileOnce(prompt:string,repair?:string[]){const suffix=repair?.length?`\n\nYour previous draft had these deterministic validation problems. Repair all of them without changing user intent:\n- ${repair.join('\n- ')}`:'';const {object}=await generateObject({model:process.env.STRATEGY_AGENT_MODEL||'openai/gpt-5.6-sol',schema:AgentStrategy,system:SYSTEM,prompt:`Compile this DreamForge strategy exactly and conservatively:\n\n${prompt}${suffix}`});return object}

function fallback(prompt:string):StrategySpec{
 const s=compileStrategy(prompt),lower=prompt.toLowerCase(),advanced=/\brsi\b|\bema\b|\bsma\b|moving average|\bmacd\b|\batr\b|stoch|bollinger|\bvwap\b|\bobv\b|\broc\b|\bcross(?:es|ing)?\b|previous (high|low|close)|\bvolume\b/.test(lower);
 return {...s,conditionGroups:[{logic:'ALL',conditions:s.trigger.streakLength?[{type:'SETTLEMENT_STREAK',side:s.trigger.streakSide||s.side,length:s.trigger.streakLength,label:`Previous ${s.trigger.streakLength} contracts settled ${s.trigger.streakSide||s.side}`}]:[]}],compiler:'deterministic-fallback',interpretation:{summary:advanced?'This strategy needs the agent compiler before DreamForge can backtest it safely.':`${s.asset} ${s.window} ${s.side} event-contract strategy.`,entry:s.trigger.streakLength?[`Wait for ${s.trigger.streakLength} consecutive ${s.trigger.streakSide} settlements.`]:[],execution:[`Buy ${s.side} only at ${Math.round((s.trigger.maxEntryPrice||.99)*100)}¢ or less.`],sizing:[`Start at $${s.sizing.baseUsd}; after win $${s.sizing.afterWinUsd}; after loss $${s.sizing.afterLossUsd}.`],risk:[`Stop at -$${s.risk.maxLossUsd} or ${s.risk.maxTrades} trades within ${s.risk.durationHours}h.`],assumptions:[],questions:advanced?['The AI strategy compiler is temporarily unavailable. Retry before backtesting or activating this complex strategy.']:[],confidence:advanced?0:.7,needsClarification:advanced}};
}

export async function compileStrategyWithAgent(prompt:string):Promise<StrategySpec>{
 try{
  let object=await compileOnce(prompt);let problems=semanticProblems(object);if(problems.length){object=await compileOnce(prompt,problems);problems=semanticProblems(object)}
  const missing=unsupportedConcepts(prompt);const interpretation={...object.interpretation,questions:[...object.interpretation.questions,...problems.map(p=>`DreamForge could not deterministically compile: ${p}.`),...missing.map(x=>`${x} is not yet a deterministic DreamForge primitive. Remove it or restate that part using supported price/indicator logic.`)]};interpretation.needsClarification=interpretation.needsClarification||problems.length>0||missing.length>0;if(problems.length||missing.length)interpretation.confidence=Math.min(interpretation.confidence,.55);
  return {...object,interpretation,compiler:'agent'} as StrategySpec;
 }catch(e){console.error('strategy-agent fallback',e);return fallback(prompt)}
}
