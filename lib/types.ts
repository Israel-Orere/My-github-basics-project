export type Asset='BTC'|'ETH';
export type Window='15m'|'1h';
export type Side='UP'|'DOWN';
export type IndicatorTimeframe='1m'|'5m'|'15m'|'1h'|'4h';
export type CompareOperator='GT'|'GTE'|'LT'|'LTE'|'EQ';
export type CrossDirection='ABOVE'|'BELOW';

export type ValueExpr={
  kind:'CONSTANT'|'PRICE'|'RSI'|'SMA'|'EMA'|'MACD'|'MACD_SIGNAL';
  timeframe?:IndicatorTimeframe;
  value?:number;
  period?:number;
  source?:'PRICE'|'RSI';
  sourcePeriod?:number;
  fastPeriod?:number;
  slowPeriod?:number;
  signalPeriod?:number;
};

export type StrategyCondition=
 |{type:'COMPARE';left:ValueExpr;operator:CompareOperator;right:ValueExpr;label:string}
 |{type:'CROSS';left:ValueExpr;direction:CrossDirection;right:ValueExpr;label:string}
 |{type:'SETTLEMENT_STREAK';side:Side;length:number;label:string};

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