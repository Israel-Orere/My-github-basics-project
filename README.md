# DreamForge

DreamForge is a strategy operating system for DreamDEX Event Contracts on Somnia. Users describe trading logic in plain English; DreamForge compiles it into transparent deterministic rules, backtests those rules, applies explicit risk limits, and prepares an autonomous agent to execute across rolling Event Contract markets.

> Build → Backtest → Deploy → Prove

## Hackathon MVP
- Natural-language strategy compiler
- Inspectable strategy specification
- Backtesting with drawdown and sample-size warnings
- DreamDEX market adapter boundary
- Agent lifecycle UI
- Max-loss/max-trades/position-size kill switches
- Safe demo mode by default

## Run
```bash
npm install
npm run dev
```

## Live integration
The official Event Contract surface is `@somnia-chain/markets-sdk` >= 0.25. Before every write, gate on the live on-chain market status because the indexer can lag. Key rolling markets by marketId/symbol rather than pool address. For hosted agents, use DreamDEX operator/session keys instead of exposing an owner key.

The included MVP deliberately fails closed for live execution until verified Shannon testnet configuration is supplied.
