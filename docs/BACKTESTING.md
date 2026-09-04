# Backtesting

DreamForge does not generate synthetic historical results.

The backtest endpoint pages finalized DreamDEX binary markets for the strategy asset and cadence, filters them to the requested date range, and uses each market's indexed winning outcome (falling back to the authoritative on-chain state when necessary). Historical prices come from DreamDEX pool OHLCV buckets built from actual fills. Because binary pools are recycled, DreamForge batches each pool's history and then isolates every market by that market's own tradingStart-to-expiry window.

For a limit-style rule such as `UP <= 0.65`, a replayed trade is created only if the observed market bucket reaches that price. The replay charges entry at the user's maximum price rather than the bucket low, avoiding a favorable-fill assumption. Queue position and transaction latency are not modeled and are disclosed in the result warnings.

Strategy max-trades and max-loss controls reset on the configured strategy session duration. Adaptive stake sizing follows the strategy's after-win and after-loss sizes.
