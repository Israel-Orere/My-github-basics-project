# DreamForge — Final DoraHacks Submission Pack

Hackathon: Somnia × DreamDEX Event Contracts Hackathon
Submission deadline: 8 September 2026, 23:59 UTC

## Required submission items

- Working prototype on testnet
- Public GitHub repository
- 2–3 minute demo video
- SDK/documentation feedback report
- Meaningful DreamDEX Event Contracts / API / SDK integration
- Optional presentation deck

## Project name

DreamForge

## Tagline

Turn a plain-English trading idea into deterministic DreamDEX Event Contract rules, inspect it on a live chart, backtest the exact rules, then execute only when every safety gate passes.

## Short description

DreamForge is a conversational strategy operating system for DreamDEX Event Contracts on Somnia. Users describe and refine a trading strategy in natural language, inspect the resulting deterministic rules on an interactive market chart, edit rules directly from chart controls, backtest the exact confirmed specification against finalized DreamDEX Event Contracts, and activate a live watcher for wallet-authorized testnet execution. AI helps interpret intent; deterministic code controls indicators, risk and execution.

## Problem

Sophisticated Event Contract strategies are difficult for non-programmers to create, inspect and test. Pure AI trading agents introduce another risk: a user may not know exactly what the model interpreted or what logic will control funds.

## Solution

DreamForge separates AI interpretation from deterministic execution. The conversational layer helps users express and refine intent; a deterministic engine converts supported intent into explicit rules; the live chart makes those rules visible and editable; the backtester replays the exact confirmed rules against historical DreamDEX Event Contracts; and live execution stays locked until the signal, market, event-contract price, risk budget and wallet all pass again.

## What makes DreamForge different

- Multi-turn plain-English strategy design
- Deterministic local compiler fallback when the AI gateway is unavailable
- Explicit assumptions, confidence and clarification gating
- Interactive TradingView Lightweight Charts interface
- Strategy rules can be edited directly from chart controls
- RSI, EMA/SMA, VWAP, Bollinger, MACD, Stochastic, ATR, ROC, OBV, volume and rolling-range support
- Event-contract-aware historical replay using finalized DreamDEX markets
- Post-signal binary-price-cap replay instead of assuming a fill
- Max-loss, max-trades and adaptive position-sizing controls
- Live market auto-selection and on-chain status rechecks
- Wallet-authorized execution only
- Exact live blocker explanations when a trade is not currently allowed

## DreamDEX / Somnia integration

DreamForge uses @somnia-chain/markets-sdk for live and finalized Event Contract discovery, market-specific binary-contract history, on-chain market verification and wallet-authorized order execution. It uses DreamDEX spot data for technical indicators and treats on-chain Event Contract status as authoritative before any write. The demo runs on Somnia Shannon testnet (chain ID 50312).

## Live links

Live app: https://my-github-basics-project.vercel.app
GitHub: https://github.com/Israel-Orere/My-github-basics-project
SDK/docs feedback: https://github.com/Israel-Orere/My-github-basics-project/blob/main/FEEDBACK.md
Demo video: ADD_PUBLIC_2_TO_3_MIN_VIDEO_URL

## Suggested tags

Somnia, DreamDEX, Event Contracts, AI Agents, DeFi, Trading, Prediction Markets, Analytics, Developer Tools

## Team

Solo builder: Israel Orere

## How judges should test

1. Open the live app.
2. Submit the default BTC 15m strategy.
3. Inspect the deterministic interpretation and live strategy chart.
4. Modify RSI or a price/range rule from the chart controls.
5. Confirm the strategy.
6. Run a 7D backtest.
7. Inspect exact rules replayed and historical rule activity.
8. Activate live monitoring and inspect the live readiness gates.
9. Connect a Shannon wallet only if testing an on-chain write.

## Judge-friendly strategy prompt

Trade BTC 15-minute UP contracts only when the current price is inside the highest high and lowest low of the previous 20 completed 15-minute candles, RSI(14) is between 42 and 60, EMA20 is above EMA50, and volume is above its 20-period SMA. Only pay 58 cents or less. Risk $8 initially, $8 after wins, $3 after losses, and stop after losing $25 or 12 trades.

Refinement:

Change RSI to 45–58 and use the previous 30 completed candles instead. Everything else stays the same.

## Judging-criteria alignment

Innovation & Originality (20%): combines conversational strategy design with deterministic semantics, chart-to-strategy editing and transparent live gating.

Technical Implementation (25%): real DreamDEX Event Contract integration, historical replay, on-chain verification, deterministic indicators, risk controls, CI and Shannon execution.

User Experience & Design (20%): one continuous describe → refine → visualize → confirm → backtest → activate flow with explicit ambiguity and blocker explanations.

Business & Ecosystem Impact (20%): lowers the barrier to sophisticated Event Contract strategies and creates a foundation for reusable strategies, strategy marketplaces and managed agent execution.

Presentation & Demo (15%): the 2–3 minute video should show natural-language strategy creation, chart editing, a 7D backtest, and live readiness.

## Final checklist

- [x] Production app deployed
- [x] Public GitHub repository
- [x] README with setup and architecture
- [x] DreamDEX SDK / docs feedback report
- [x] Deterministic strategy / chart / backtest / readiness tests
- [x] Production CI and deployed compiler smoke test
- [ ] Record the 2–3 minute live demo using DEMO_SCRIPT.md
- [ ] Upload the demo publicly or unlisted and paste the URL above
- [ ] Open live app, repo and video in incognito before submitting
- [ ] Submit at https://dorahacks.io/hackathon/event-contracts/buidl before 23:59 UTC
