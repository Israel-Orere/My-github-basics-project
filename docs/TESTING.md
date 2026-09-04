# Verification checklist

- `npm install`
- `npm run typecheck`
- `npm run build`
- Strategy compiler renders the interpreted rule summary.
- Backtest supports 7D / 30D / 90D / all available history / custom dates.
- Historical results come only from finalized DreamDEX markets and observed candles.
- Live signal uses finalized winning outcomes.
- Live execution rechecks signal and on-chain status before wallet interaction.
- Stake quoting uses DreamDEX tick/lot-aware `quoteBinaryStake`.
- Browser wallet signs through an SDK `Trader` created with the injected wallet client.
- Successful write exposes its Shannon transaction hash.
