# DreamDEX SDK & Documentation Feedback

This report summarizes the practical feedback from building **DreamForge**, a conversational strategy builder, historical backtester and wallet-authorized execution interface for DreamDEX Event Contracts on Somnia Shannon.

## What worked well

1. **The Event Contracts surface is genuinely composable.** `@somnia-chain/markets-sdk` exposes enough market discovery, on-chain reads, fills/candles and trading primitives to build a real product rather than a mock UI.
2. **The separation between unified market actions and lower-level client/trader reads is useful.** DreamForge could stay high-level for product flows while dropping to `exchange.client.*` for exact historical/on-chain verification.
3. **The Event Contracts docs now document the important lifecycle details.** In particular, the guidance to gate writes on on-chain market status and to key state by `marketId` rather than recycled pool addresses matches what a production bot needs.
4. **Finalized-market history is rich enough for serious replay.** Historical market rows, settlement state and pool-scoped candles make it possible to build a backtester that checks whether a binary-contract price was actually available after a strategy signal.
5. **The Shannon testnet is practical for development.** It allows the complete read → signal → quote → wallet-approval → on-chain execution path to be tested without mainnet capital.

## Friction we hit while building

### 1. It is easy to mix up spot-history and Event Contract history surfaces

DreamForge needs both:
- underlying BTC/ETH candles for indicators, and
- binary-contract candles for entry-price replay.

Those come from different surfaces and have different semantics. A prominent architecture diagram or one-page table showing **spot REST vs Event Contract SDK vs on-chain truth** would reduce integration mistakes.

### 2. Historical pool reuse is subtle

A pool address can serve many successive Event Contract markets. Calling a candle/history method with only the pool is therefore not enough to identify one market window. We had to explicitly scope every history request to the market's own `tradingStart`/`expiry` window and keep application state keyed by `marketId`.

The docs now mention this, but it is important enough to surface in every history example, not only in a gotchas page.

### 3. Indexer state and on-chain state can disagree briefly

For live execution, the indexer can still show a market as tradable after the chain has moved it forward. DreamForge therefore rechecks `getMarketOnchain()` before every write and treats the on-chain status as authoritative.

A typed SDK helper such as `assertBinaryMarketTrading(marketId)` or a safe `placeBinaryOrder` path that performs the status check automatically would make this harder to get wrong.

### 4. Price / quantity normalization is a high-risk source of errors

Event Contract prices are probability-like human values but the contracts ultimately operate on integer units and market constraints. A first-party pair of helpers for converting human probability/size to valid on-chain tick/lot values would reduce `InvalidPrice`-style failures and inconsistent app-side conversion logic.

### 5. Backtesting examples would be valuable

The SDK exposes enough data to build a correct historical replay, but there is no single end-to-end example that demonstrates:

1. enumerate finalized markets for an asset/cadence;
2. evaluate an external/technical signal at completed-data boundaries;
3. fetch only the selected market's post-signal binary-price history;
4. determine whether a price cap was actually touched before expiry;
5. compare the eventual settlement outcome.

A canonical backtesting recipe would save builders significant time and prevent overly optimistic demos that assume fills or use future information.

### 6. Testnet collateral/faucet guidance should be linked from every Event Contract quickstart

For a new builder, the most common first-run question is not an SDK type question but “what do I need in my wallet to make the first test trade?”. A compact checklist covering STT gas, the Event Contract collateral token, faucet call and chain ID would help.

## Documentation improvements we would prioritize

1. Add a **data-surface matrix**: underlying spot candles, live binary markets, finalized binary markets, pool candles/fills, on-chain status, settlement resolution.
2. Put the **pool-reuse warning next to every pool-history snippet**.
3. Add a **complete Event Contract backtest recipe**.
4. Add first-party **human probability ↔ valid tick** and **human size ↔ valid lot** helpers/examples.
5. Add a **safe live-order recipe** that shows: refresh market → on-chain status → quote → cap check → send → verify fill.
6. Add a compact **Shannon first-trade checklist** to the Event Contracts landing page.

## API / SDK behavior we relied on

DreamForge uses the SDK and DreamDEX surfaces for:

- live binary market discovery;
- finalized binary market enumeration;
- market-specific Event Contract candle history;
- on-chain market-status verification;
- market resolution / settlement context;
- executable quote discovery;
- wallet-authorized Event Contract order placement;
- underlying spot candles for technical indicators.

## Overall

The SDK is capable enough to support a production-style Event Contract application. The biggest opportunity is not adding more primitives; it is making the **correct composition of existing primitives** more obvious — especially the boundaries between indexer state, on-chain truth, underlying spot data and recycled Event Contract pool history.
