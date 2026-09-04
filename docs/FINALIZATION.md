# DreamForge finalized flow

1. Describe a strategy in plain English.
2. Review the interpreted market, trigger, price, sizing and risk rules.
3. Backtest against finalized DreamDEX Event Contracts for 7D, 30D, 90D, all available history, or a custom date range.
4. Review return, P&L, win rate, drawdown, equity curve and individual replayed trades.
5. Activate the strategy for live Shannon monitoring.
6. DreamForge verifies recent finalized outcomes, the selected live contract, price and risk state.
7. Immediately before a write, DreamForge rechecks the signal and canonical on-chain market state, sizes a stake using the DreamDEX tick/lot-aware quote helper, and asks the connected wallet to approve the transaction.
8. Confirmed orders surface a Shannon explorer transaction link.

Historical replay uses finalized DreamDEX outcomes and 1-minute binary-market candles. It simulates a fill only when an observed candle reaches the strategy's maximum entry price and charges the trade at that maximum price. This is conservative on entry price but does not model queue position or transaction latency.

Live adaptive sizing and session loss/trade limits are reconciled against on-chain settlements for DreamForge trades recorded in the user's browser before each new order.
