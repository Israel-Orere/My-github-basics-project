export type Asset='BTC'|'ETH';
export type Window='15m'|'1h';
export type Side='UP'|'DOWN';
export type IndicatorTimeframe='1m'|'5m'|'15m'|'1h'|'4h';
export type CompareOperator='GT'|'GTE'|'LT'|'LTE'|'EQ';
export type CrossDirection='ABOVE'|'BELOW';
export type SeriesSource='PRICE'|'RSI'|'VOLUME';

export type ValueExpr={
  kind:'CONSTANT'|'PRICE'|'OPEN'|'HIGH'|'LOW'|'VOLUME'|'RSI'|'SMA'|'EMA'|'MACD'|'MACD_SIGNAL'|'ATR'|'ROC'|'STOCH_K'|'STOCH_D'|'BB_UPPER'|'BB_MIDDLE'|'BB_LOWER'|'VWAP'|'OBV';
  timeframe?:IndicatorTimeframe;
  value?:number;
  period?:number;
  source?:SeriesSource;
  sourcePeriod?:number;
  fastPeriod?:number;
  slowPeriod?:number;
  signalPeriod?:number;
  stdDev?:number;
  smoothK?:number;
  smoothD?:number;
  offsetBars?:number;
  multiplier?:number;
  addend?:number;
};

export type StrategyCondition=
 |{type:'COMPARE';left:ValueExpr;operator:CompareOperator;right:ValueExpr;bars?:number;negate?:boolean;label:string}
 |{type:'CROSS';left:ValueExpr;direction:CrossDirection;right:ValueExpr;withinBars?:number;negate?:boolean;label:string}
 |{type:'TREND';expr:ValueExpr;direction:'RISING'|'FALLING';bars:number;negate?:boolean;label:string}
 |{type:'SETTLEMENT_STREAK';side:Side;length:number;negate?:boolean;label:string}
 |{type:'TIME_WINDOW';timezone:string;startMinute:number;endMinute:number;daysOfWeek?:number[];negate?:boolean;label:string};

// DreamForge stores boolean logic as disjunctive normal form:
// each group is AND; multiple groups are OR. Atomic conditions can be negated.
export type ConditionGroup={logic:'ALL';conditions:StrategyCondition[]};
export type StrategyInterpretation={
 summary:string;
 entry:string[];
 execution:string[];
 sizing:string[];
 risk:string[];
 assumptions:string[];
 questions:string[];
 confidence:number;
 needsClarification:boolean;
};

export type StrategySpec={
 name:string;
 asset:Asset;
 window:Window;
 side:Side;
 trigger:{streakSide?:Side;streakLength?:number;maxEntryPrice?:number};
 conditionGroups?:ConditionGroup[];
 sizing:{baseUsd:number;afterWinUsd:number;afterLossUsd:number};
 risk:{maxLossUsd:number;maxTrades:number;durationHours:number};
 interpretation?:StrategyInterpretation;
 compiler?:'agent'|'deterministic-fallback';
};

export type MarketSnapshot={id:string;symbol:string;asset:Asset;window:Window;upPrice:number;downPrice:number;status:'TRADING'|'LOCKED'|'UNKNOWN';closesAt?:string};
export type BacktestResult={trades:number;wins:number;losses:number;winRate:number;pnl:number;returnPct:number;maxDrawdown:number;endingCapital:number;warnings:string[];equity:number[]};