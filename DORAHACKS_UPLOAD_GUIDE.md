# DreamForge — DoraHacks Upload Guide

Hackathon: Somnia × DreamDEX Event Contracts Hackathon
Submission page: https://dorahacks.io/hackathon/event-contracts/buidl
Deadline: 8 September 2026, 23:59 UTC

This file is the shortest path from the finished DreamForge build to a completed DoraHacks BUIDL submission.

## 1. Create / select the BUIDL

Open the submission page, sign in, choose **Submit BUIDL**, then create a new BUIDL if DreamForge is not already in your DoraHacks profile.

### Project name

DreamForge

### Vision / tagline

Turn a plain-English trading idea into deterministic DreamDEX Event Contract rules, inspect it on a live chart, backtest the exact rules, then execute only when every safety gate passes.

### Category

Crypto / Web3

### Suggested subcategories / tags

AI Agents, DeFi, Trading, Prediction Markets, Analytics, Developer Tools

### L1 / ecosystem

Somnia

### Is this an AI Agent?

Yes. AI assists strategy interpretation, while deterministic code governs indicator evaluation, backtesting, risk controls and execution.

### GitHub repository

https://github.com/Israel-Orere/My-github-basics-project

### Project website / live demo

https://my-github-basics-project.vercel.app

### Demo video

Paste the final public or unlisted 2–3 minute video URL after recording it with `DEMO_SCRIPT.md`.

### Social links

Use your preferred public X / LinkedIn / GitHub profile links. Do not add any private contact details to the public project description.

## 2. Problem field

Sophisticated Event Contract strategies are difficult for non-programmers to create, inspect and test. Pure AI trading agents introduce another risk: a user may not know exactly what the model interpreted or what logic will control funds.

## 3. Short project description

DreamForge is a conversational strategy operating system for DreamDEX Event Contracts on Somnia. Users describe and refine a trading strategy in natural language, inspect the resulting deterministic rules on an interactive market chart, edit rules directly from chart controls, backtest the exact confirmed specification against finalized DreamDEX Event Contracts, and activate a live watcher for wallet-authorized testnet execution. AI helps interpret intent; deterministic code controls indicators, risk and execution.

## 4. Detailed description

DreamForge separates AI interpretation from deterministic execution. A user describes a trading strategy in plain English; DreamForge restates the rules, surfaces assumptions and ambiguity, and supports multi-turn refinements. Supported strategies are converted into an explicit deterministic specification rather than sending free-form model output directly to execution.

The strategy is mapped onto an interactive TradingView Lightweight Chart using DreamDEX underlying-market data. Users can inspect candlesticks and indicator panes, pan and zoom, and modify supported deterministic rules directly from chart controls.

After confirmation, DreamForge replays the exact strategy against historical finalized DreamDEX Event Contracts. It evaluates the technical signal at completed-data boundaries and checks post-signal binary-contract price history before assuming an entry. Results include P&L, return, win rate, max drawdown, trades, the exact rules replayed and per-rule historical activity.

For live use on Somnia Shannon, DreamForge discovers the matching DreamDEX Event Contract, rechecks the confirmed signal, verifies on-chain market status, validates the executable Event Contract price against the user's cap, enforces session max-loss and max-trade limits, and requires wallet approval for every write. If a trade is blocked, DreamForge explains the specific condition that is not ready.

## 5. DreamDEX / Somnia integration field

DreamForge uses `@somnia-chain/markets-sdk` for live and finalized Event Contract discovery, market-specific binary-contract history, on-chain market verification and wallet-authorized order execution. DreamDEX spot data drives technical indicators, while on-chain Event Contract state is treated as authoritative before every write. The deployed demo runs on Somnia Shannon testnet (chain ID 50312).

## 6. Innovation / why it is different

DreamForge combines conversational strategy creation with deterministic, inspectable execution semantics; an interactive chart that rewrites the actual strategy rather than merely drawing annotations; Event-Contract-aware backtesting that checks post-signal binary pricing rather than assuming fills; and fail-closed live execution with transparent blocker explanations.

## 7. Technical implementation

- Next.js 15
- React 19
- TypeScript
- `@somnia-chain/markets-sdk`
- viem
- TradingView Lightweight Charts
- Somnia Shannon testnet
- Vercel
- Deterministic indicator/condition evaluation engine
- CI coverage for strategy evaluation, local compilation, chart edits, live readiness, DreamDEX data, chart data, Event Contract history, historical backtesting and production build

## 8. Team

Solo builder: Israel Orere

DreamForge was built end-to-end as a full-stack Event Contract product spanning natural-language strategy design, deterministic indicator evaluation, charting, historical replay, risk controls and Somnia Shannon execution.

## 9. How judges should test

1. Open the live app.
2. Submit the default BTC 15-minute strategy.
3. Inspect the deterministic interpretation and live chart.
4. Modify RSI or a price/range rule using the chart controls.
5. Confirm the strategy.
6. Select 7D and run the backtest.
7. Inspect the exact rules replayed and historical rule activity.
8. Activate the strategy and inspect live readiness.
9. Connect a Shannon wallet only if you want to test a wallet-authorized on-chain write.

## 10. SDK / documentation feedback

Submit or reference:

https://github.com/Israel-Orere/My-github-basics-project/blob/main/FEEDBACK.md

## 11. Demo video

Use `DEMO_SCRIPT.md`. Target 2:30–2:50. Record the real production app, not slides.

Recommended upload title:

**DreamForge — Conversational Strategy Builder for DreamDEX Event Contracts | Somnia Hackathon Demo**

Recommended video description:

DreamForge turns plain-English trading ideas into deterministic DreamDEX Event Contract strategies on Somnia. This demo shows conversational strategy design, an interactive chart that edits the strategy, historical Event Contract replay, transparent risk controls and wallet-authorized Shannon testnet execution.

Upload the video to YouTube as **Public** or **Unlisted** (or another host judges can open without login), then test the link in an incognito/private window.

## 12. Final submission check

- Working production/testnet app opens without authentication
- GitHub repository is public
- README is clear
- Demo video is 2–3 minutes and opens without login
- Video URL is pasted into the DoraHacks form
- Feedback report is linked
- DreamDEX / Somnia integration is clearly described
- All team/contact fields required by DoraHacks are filled with your own current details
- Every link is tested in a private/incognito browser
- Final BUIDL is submitted before 23:59 UTC on 8 September 2026
