# Interactive Strategy Builder

DreamForge's strategy authoring flow should be conversational rather than one-shot.

## Intended flow

1. User describes a strategy in natural language.
2. DreamForge returns its interpretation before compilation, including explicit assumptions and questions.
3. The user can refine the interpretation through further messages.
4. A live strategy preview updates after each turn.
5. Once the user confirms the interpretation, DreamForge compiles the deterministic strategy specification.

## Live chart preview

The preview should visualize the market context and every deterministic condition that can be represented visually. Examples include:

- current/previous candle OHLC range
- previous high/low boundaries
- moving averages
- Bollinger bands
- VWAP
- entry-price threshold
- RSI / stochastic / MACD panels where relevant
- trade-window shading
- prior contract-settlement markers
- candidate entry markers when all conditions align

The preview is explanatory, not a profitability claim. Until compilation is confirmed, chart overlays are derived from the current draft interpretation and should be labelled as a draft.

## Safety / determinism

DreamForge must not silently convert ambiguity into executable trading intent. Material ambiguity must remain visible as a question. Live activation stays disabled until:

- the user confirms the interpretation,
- the deterministic compiler succeeds,
- required market data is available,
- execution guards pass.
