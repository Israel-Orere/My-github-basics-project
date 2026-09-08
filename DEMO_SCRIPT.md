# DreamForge — 2–3 Minute Demo Video Script

Target length: **2:30–2:50**. Record the live app, not slides. Use your own voice. Keep the cursor visible and zoom the browser to make the UI readable.

## Before recording

- Open the production app in a fresh browser tab.
- Have the GitHub repo open in a second tab.
- Connect a funded Somnia Shannon wallet only if you plan to show a testnet trade.
- Use the default DreamForge strategy prompt below.
- Prefer a **7D backtest** during the recording for speed.
- If live conditions do not qualify, show the blocker explanation; that demonstrates the fail-closed safety model.

## 0:00–0:20 — Problem + one-line pitch

**Say:**

“DreamForge turns a plain-English trading idea into deterministic DreamDEX Event Contract rules. Instead of asking users to trust an opaque AI agent with money, the AI only helps interpret intent; deterministic code controls the strategy, backtest, risk limits and execution.”

**Show:**
- DreamForge home page.
- Briefly point at the ‘Describe it. Refine it. See it. Then compile it.’ flow.

## 0:20–0:55 — Natural-language strategy → explicit rules

Paste or use the prefilled prompt:

> Trade BTC 15-minute UP contracts only when the current price is inside the highest high and lowest low of the previous 20 completed 15-minute candles, RSI(14) is between 42 and 60, EMA20 is above EMA50, and volume is above its 20-period SMA. Only pay 58 cents or less. Risk $8 initially, $8 after wins, $3 after losses, and stop after losing $25 or 12 trades.

**Say:**

“I can describe a fairly complex BTC 15-minute setup in normal language. DreamForge restates the exact conditions, shows assumptions and questions, and refuses to unlock execution if the interpretation is ambiguous.”

**Show:**
- The interpreted entry rules.
- Confidence / assumptions / open questions.

## 0:55–1:25 — Interactive chart + chart-to-strategy editing

**Say:**

“The chart is not a static image. It uses TradingView Lightweight Charts with live DreamDEX underlying data. The indicators in my strategy appear on the price chart or in their own panes, and I can modify the deterministic strategy directly from chart controls.”

**Show:**
- Pan/zoom/crosshair.
- RSI pane.
- EMA20 and EMA50.
- Rolling range / volume pane if visible.
- Change the RSI band from the chart controls, or add a price threshold with ‘Price ≥ click’ / ‘Price ≤ click’.
- Point to the active rule chips after the edit.

**Say:**

“That edit rewrites the strategy specification — it is not just a drawing.”

## 1:25–1:55 — Confirm + historical Event Contract replay

Click **Confirm strategy**, then **7D**, then **Run backtest**.

**Say:**

“Once I confirm, DreamForge locks the exact deterministic specification. The backtester scans finalized DreamDEX Event Contracts, evaluates my signal at completed-data boundaries, and only assumes an entry if the binary-contract price actually touched my configured cap after the signal.”

**Show:**
- Return, P&L, win rate, trades, drawdown.
- ‘Indicators & Rules Replayed’.
- ‘Historical Rule Activity’.
- Trade log if the result has trades.

## 1:55–2:30 — Live readiness + testnet execution safety

Click **Activate live strategy**.

**Say:**

“Live mode automatically picks the DreamDEX contract matching the strategy and continuously checks the confirmed signal. Before any write it rechecks the on-chain market status, executable Event Contract price, session risk budget and wallet approval.”

**Show:**
- Live contract selection.
- Live readiness gates.
- The exact blocker button/message if the setup is not currently valid.

**Say:**

“If RSI, price, the selected contract or my wallet is not ready, DreamForge tells me exactly why and keeps trading locked. If every gate passes, the wallet still has to approve the transaction.”

### Optional: show a real Shannon testnet fill

If you want the strongest possible demo, switch to a deliberately permissive **testnet-only demonstration strategy** so a live signal is likely to qualify, connect your Shannon wallet, and show the wallet approval + resulting Somnia explorer transaction. Do not waste recording time waiting for the stricter default strategy to become true.

If you cannot obtain a live fill during recording, do **not** fake one. Show the readiness gates and explain the fail-closed behavior.

## 2:30–2:50 — Technical close

Switch briefly to the GitHub README.

**Say:**

“DreamForge is built with Next.js, TypeScript, the Somnia Markets SDK, viem and TradingView Lightweight Charts on Shannon testnet. The repository includes deterministic engine tests, real DreamDEX history tests, a backtest smoke test, and my SDK/documentation feedback. DreamForge makes advanced Event Contract strategies accessible without hiding the rules that control funds.”

End on the live app or repository URL.

---

## Recording checklist

- Keep the video **under 3:00**.
- Use your own voice.
- Show the real live app, not screenshots.
- Make sure browser zoom makes text readable.
- Do not spend more than ~20 seconds on the problem statement.
- Prioritize: conversational strategy → chart edit → backtest → live readiness.
- Upload to YouTube as **Public** or **Unlisted**, or another host that judges can open without login.
- Test the video link in an incognito window.

## DoraHacks title / description for the video

**Title:** `DreamForge — Conversational Strategy Builder for DreamDEX Event Contracts | Somnia Hackathon Demo`

**Description:**

`DreamForge turns plain-English trading ideas into deterministic DreamDEX Event Contract strategies on Somnia. This demo shows conversational strategy design, an interactive chart that edits the strategy, historical Event Contract replay, transparent risk controls and wallet-authorized Shannon testnet execution.`
