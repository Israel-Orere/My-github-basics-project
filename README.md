# DreamForge

**Turn a trading idea into deterministic DreamDEX Event Contract rules, inspect it on a live chart, backtest the exact rules, then execute only when every safety gate passes.**

DreamForge is a conversational strategy builder for **DreamDEX Event Contracts on Somnia**. A user can describe a trading strategy in plain English, refine it over multiple turns, see the rules mapped onto an interactive market chart, confirm a deterministic specification, replay that specification against historical DreamDEX Event Contracts, and then activate a live watcher for wallet-authorized testnet execution.

> **Describe → Refine → Visualize → Confirm → Backtest → Activate → Verify → Trade**

## Live demo

- App: https://my-github-basics-project.vercel.app
- Network: **Somnia Shannon testnet (chain ID 50312)**
- Repository: https://github.com/Israel-Orere/My-github-basics-project
- Demo video: add the final 2–3 minute public video link here before DoraHacks submission
- Hackathon: Somnia × DreamDEX Event Contracts Hackathon

## Why DreamForge

Most trading automation tools force users to choose between two bad extremes: write code themselves, or trust an opaque AI interpretation. DreamForge separates **AI interpretation** from **deterministic execution**.

The AI layer helps the user express and refine intent. The execution layer only accepts an explicit strategy specification made of supported indicators, comparisons, crosses, rolling ranges, time windows, settlement streaks, sizing rules and hard risk limits. If DreamForge cannot prove the interpretation is deterministic, backtesting and trading stay locked.

## Core product flow

1. **Describe a strategy in natural language** — e.g. BTC 15m UP, rolling-range filter, RSI band, EMA relation, volume confirmation, entry-price cap and risk limits.
2. **Refine it conversationally** — later turns modify only the rules the user changes.
3. **Inspect it visually** — TradingView Lightweight Charts renders live DreamDEX spot candles, price overlays, indicator panes, rolling ranges and setup markers.
4. **Edit from the chart** — add price thresholds/ranges, RSI bands, moving-average relationships, volume-vs-SMA rules or prior-range position rules directly from chart controls.
5. **Confirm the strategy** — a final deterministic compile locks the exact specification.
6. **Backtest the exact confirmed rules** — DreamForge scans historical finalized DreamDEX Event Contracts and replays both the technical signal and post-signal event-contract price availability.
7. **Activate live monitoring** — the app watches the confirmed strategy and explains exactly what is blocking a trade when conditions are not met.
8. **Wallet-authorized execution** — before a write, DreamForge rechecks the signal, selected market, on-chain status, executable price, session risk budget and wallet approval.

## What is implemented

### Conversational strategy compiler
- Multi-turn strategy drafting and refinement
- Explicit interpretation summary, assumptions, open questions and confidence
- Agent compiler with a deterministic local compiler fallback
- Confirmation locked when material ambiguity remains

### Deterministic strategy engine
Supported indicator/value primitives include:
- Price / Open / High / Low / Volume
- RSI
- SMA / EMA (price, RSI or volume source)
- MACD / MACD signal
- ATR
- ROC
- Stochastic K / D
- Bollinger Bands
- VWAP
- OBV
- Highest High / Lowest Low
- Range Width / Range Position

Supported condition types include comparisons, crosses, trends, settlement streaks and time windows. Boolean logic is normalized into deterministic groups before evaluation.

### Interactive strategy chart
- TradingView Lightweight Charts
- Candlesticks with pan, zoom, pinch and crosshair
- EMA/SMA/VWAP/Bollinger/range overlays
- Separate RSI, volume, MACD, Stochastic, ATR, ROC, OBV and range panes
- Setup markers on matching candles
- Click-to-add price thresholds and price ranges
- Rule controls for RSI, moving averages, volume and rolling-range position
- Removable active-rule chips
- Chart edits update the deterministic strategy — they are not cosmetic drawings

### Historical backtesting
- Replays finalized DreamDEX Event Contracts
- Evaluates the confirmed strategy through each contract at completed-data boundaries
- Loads post-signal binary-contract candle history before assuming an entry
- Applies the user’s event-contract price cap
- Applies sizing transitions and session max-loss / max-trade limits
- Reports return, P&L, win rate, max drawdown, trade count, exact rules replayed and per-rule historical activity
- Includes warnings for small samples and missing historical fills

### Live safety and execution
- Somnia Shannon testnet support
- Live DreamDEX market discovery
- Auto-selects the live contract matching the strategy asset/timeframe
- On-chain market-status recheck before every write
- Event-contract price-cap check
- Signal revalidation immediately before execution
- Session max-loss / max-trades enforcement
- Wallet approval required for every transaction
- IOC orders count as trades only when a positive fill is verified
- Live button explains the exact blocker instead of silently remaining disabled

## DreamDEX integration

DreamForge uses `@somnia-chain/markets-sdk` and the DreamDEX data surfaces for Event Contract discovery, historical market replay, binary-contract candles, on-chain status checks and execution. The app keys rolling markets by `marketId`/symbol rather than recycled pool addresses, and treats on-chain status as authoritative before any write.

The chart’s underlying spot candles use the DreamDEX REST feed first and the DreamDEX indexer as a fallback. Event Contract history itself is read through the market SDK with market-window scoping.

## Tech stack

- Next.js 15
- React 19
- TypeScript
- `@somnia-chain/markets-sdk`
- viem
- TradingView Lightweight Charts
- Vercel
- Somnia Shannon testnet

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run test:strategy
npm run test:local-compiler
npm run test:chart-edit
npm run test:live-readiness
npm run test:dreamdex
npm run test:chart-data
npm run test:event-history
npm run test:backtest
npm run build
```

CI runs the full suite on every pull request. The backtest smoke test uses real DreamDEX history and enforces a serverless latency budget.

## Demo strategy

Try:

> Trade BTC 15-minute UP contracts only when the current price is inside the highest high and lowest low of the previous 20 completed 15-minute candles, RSI(14) is between 42 and 60, EMA20 is above EMA50, and volume is above its 20-period SMA. Only pay 58 cents or less. Risk $8 initially, $8 after wins, $3 after losses, and stop after losing $25 or 12 trades.

Then refine it with:

> Change RSI to 45–58 and use the previous 30 completed candles instead. Everything else stays the same.

## Safety model

DreamForge is intentionally fail-closed:

- unsupported or ambiguous strategy language blocks confirmation;
- a confirmed strategy is rechecked against live completed data before execution;
- the current market must match the strategy asset and cadence;
- the market must still be Trading on-chain;
- the executable event-contract price must remain within the configured cap;
- session max-loss and max-trade limits are enforced;
- no private key is stored by the app;
- every write requires the connected wallet.

## Hackathon submission artifacts

- `SUBMISSION.md` — DoraHacks copy/paste submission text and judge-facing positioning
- `DEMO_SCRIPT.md` — 2–3 minute recording script and shot list
- `FEEDBACK.md` — DreamDEX SDK/documentation feedback from building DreamForge

## Current limitations / next steps

- The natural-language compiler intentionally supports a finite deterministic indicator vocabulary; unsupported indicators remain blocked rather than approximated.
- The live agent currently uses explicit wallet-authorized execution rather than unattended custody or owner-key automation.
- Historical replay models recorded event-contract fills/candles and does not model wallet latency, gas, queue priority or unrecorded liquidity.
- Strategy version history and richer visual rule composition are natural next steps.

## Hackathon fit

DreamForge combines a **consumer trading interface, AI-assisted strategy design, analytics/backtesting and live DreamDEX Event Contract execution** in one product. It is designed to make sophisticated on-chain event-contract strategies accessible without hiding the rules that ultimately control money.
