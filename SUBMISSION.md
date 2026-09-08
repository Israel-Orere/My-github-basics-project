# DreamForge — DoraHacks Submission Copy

Use this page as the copy/paste source for the Somnia × DreamDEX Event Contracts Hackathon submission.

## Project name

**DreamForge**

## One-line vision / tagline

**Turn a plain-English trading idea into deterministic DreamDEX Event Contract rules, inspect it on a live chart, backtest the exact rules, then execute only when every safety gate passes.**

## Short description

DreamForge is a conversational strategy operating system for DreamDEX Event Contracts on Somnia. Users describe and refine a trading strategy in natural language, inspect the resulting deterministic rules on an interactive market chart, edit rules directly from chart controls, backtest the exact confirmed specification against finalized DreamDEX Event Contracts, and activate a live watcher for wallet-authorized testnet execution. AI helps interpret intent; deterministic code controls indicators, risk and execution.

## Long description

Most trading automation tools force users to either write code themselves or trust an opaque AI interpretation with real money. DreamForge takes a different approach: **AI can help understand the trader, but only deterministic code can decide whether a trade is allowed.**

A user starts by describing a strategy in plain English. DreamForge restates the interpretation, surfaces assumptions and unresolved questions, and supports multi-turn refinements. Once the user is satisfied, the strategy is represented as an inspectable deterministic specification made from supported indicators, comparisons, crosses, rolling ranges, settlement streaks, time windows, sizing rules and hard risk limits.

The strategy is then mapped to an interactive TradingView Lightweight Chart using live DreamDEX underlying-market data. Users can pan, zoom and inspect candles; see EMA/SMA/VWAP/Bollinger/range overlays and separate RSI/volume/MACD/Stochastic/ATR panes; and directly modify deterministic strategy rules from chart controls.

After confirmation, DreamForge backtests the exact specification against historical finalized DreamDEX Event Contracts. It evaluates signals at completed-data boundaries, then checks post-signal binary-contract price history before assuming an entry. The result includes P&L, return, win rate, max drawdown, exact rules replayed, per-rule historical activity and warnings for small samples or missing price history.

Finally, the user can activate the confirmed strategy on Somnia Shannon. DreamForge automatically selects the live Event Contract matching the strategy asset and cadence, rechecks every deterministic condition, verifies on-chain market status, checks the executable event-contract price against the user's cap, enforces session max-loss / max-trade limits, and requires wallet approval for every transaction. When a trade is not allowed, the UI explains the exact blocker instead of silently disabling execution.

DreamForge combines an AI-assisted consumer trading interface, analytics/backtesting and real DreamDEX Event Contract execution without hiding the rules that ultimately control money.

## Problem

Sophisticated Event Contract strategies are inaccessible to many users because they require coding, indicator implementation, historical replay and careful execution/risk handling. Pure AI trading agents introduce a second problem: the user often cannot see exactly what the model interpreted or what logic will control funds.

## Solution

DreamForge separates **interpretation from execution**:

- AI/conversational UX helps users express and refine a strategy.
- A deterministic strategy engine turns supported intent into explicit rules.
- An interactive chart makes those rules visible and editable.
- A historical replay tests the exact confirmed rules against DreamDEX Event Contract history.
- Live execution remains locked until the signal, market, event-contract price, risk budget and wallet all pass again.

## Key features

- Multi-turn natural-language strategy building
- Deterministic local compiler fallback when the AI gateway is unavailable
- Explicit assumptions, confidence and clarification gating
- Interactive TradingView Lightweight Chart
- RSI, EMA/SMA, VWAP, Bollinger, MACD, Stochastic, ATR, ROC, OBV, volume and rolling-range support
- Chart-based strategy editing
- Final deterministic confirmation gate
- Historical replay across finalized DreamDEX Event Contracts
- Post-signal binary price-cap replay
- P&L, win rate, drawdown and rule-activity diagnostics
- Somnia Shannon live market discovery
- Automatic strategy-matching contract selection
- On-chain market-state checks before writes
- Max-loss / max-trades / adaptive position sizing
- Wallet-authorized execution only
- Explicit live-trade blocker messages

## DreamDEX / Somnia integration

DreamForge uses `@somnia-chain/markets-sdk` for Event Contract discovery, finalized market history, binary-contract candles, on-chain market verification and order execution. It uses DreamDEX underlying spot market data for technical indicators, and treats the on-chain Event Contract status as authoritative before any write. The demo runs on **Somnia Shannon testnet (chain ID 50312)**.

## Innovation / originality

The novelty is the combination of:

1. conversational strategy design;
2. deterministic, inspectable execution semantics;
3. an interactive chart that actually rewrites the strategy rather than acting as a static visualization;
4. event-contract-aware backtesting that checks post-signal binary pricing rather than assuming an entry; and
5. live fail-closed execution with transparent blocker explanations.

The user gets the accessibility of AI without delegating financial control to opaque model output.

## Technical implementation

- Next.js 15 + React 19 + TypeScript
- `@somnia-chain/markets-sdk`
- viem
- TradingView Lightweight Charts
- Vercel
- Somnia Shannon testnet
- Deterministic indicator/condition evaluation engine
- CI tests for strategy evaluation, local compiler, chart edits, live readiness, DreamDEX data, chart data, Event Contract history, backtesting and production build

## User experience

The UX is organized around one continuous workflow: describe → refine → see → confirm → backtest → activate. The chart is interactive, strategy rules are visible, ambiguity is surfaced before confirmation, and the live execution section tells the user exactly which gate is blocking a trade.

## Business / ecosystem impact

DreamForge lowers the barrier to creating and safely testing sophisticated Event Contract strategies, potentially increasing both the number of users and the diversity of trading behavior on DreamDEX. It can evolve into a strategy marketplace, reusable strategy templates, managed session-key agents and shared analytics for event-contract traders.

## Public links

- **Live app:** https://my-github-basics-project.vercel.app
- **GitHub:** https://github.com/Israel-Orere/My-github-basics-project
- **Demo video:** `ADD_PUBLIC_2_TO_3_MIN_VIDEO_URL`
- **SDK/docs feedback:** https://github.com/Israel-Orere/My-github-basics-project/blob/main/FEEDBACK.md

## Suggested DoraHacks profile fields

- **Category:** Crypto / Web3
- **Sub-categories / tags:** AI Agents, DeFi, Trading, Prediction Markets, Developer Tools
- **AI Agent?** Yes — AI assists interpretation, while deterministic code governs execution
- **L1 / ecosystem:** Somnia
- **Project website:** https://my-github-basics-project.vercel.app
- **Source code:** https://github.com/Israel-Orere/My-github-basics-project

## Team description

**Solo builder.** DreamForge was designed and built as a full-stack Event Contract product spanning natural-language strategy design, deterministic indicator evaluation, charting, historical replay, risk controls and Somnia Shannon execution.

## How to test

1. Open the live app.
2. Submit the default complex BTC 15m strategy.
3. Inspect the deterministic interpretation and live strategy chart.
4. Modify RSI or a price/range rule from the chart controls.
5. Confirm the strategy.
6. Run a 7D or 30D backtest.
7. Inspect exact rules replayed and historical rule activity.
8. Activate the strategy and inspect live trade readiness.
9. Connect a Shannon wallet only if you want to test an on-chain write.

## Judge-friendly demo prompt

> Trade BTC 15-minute UP contracts only when the current price is inside the highest high and lowest low of the previous 20 completed 15-minute candles, RSI(14) is between 42 and 60, EMA20 is above EMA50, and volume is above its 20-period SMA. Only pay 58 cents or less. Risk $8 initially, $8 after wins, $3 after losses, and stop after losing $25 or 12 trades.

Then refine:

> Change RSI to 45–58 and use the previous 30 completed candles instead. Everything else stays the same.

## Submission checklist

- [x] Working prototype on Somnia Shannon testnet
- [x] Public GitHub repository
- [x] DreamDEX Event Contracts / SDK integration
- [x] SDK & documentation feedback report (`FEEDBACK.md`)
- [x] Judge-ready README and setup instructions
- [ ] Record and upload a **2–3 minute public demo video**
- [ ] Paste the public demo-video URL into DoraHacks and replace the placeholder above
- [ ] Re-open every submitted link in an incognito browser before final submission
