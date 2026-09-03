# DreamForge architecture

## Principle
Natural language may propose a strategy; it never directly moves money. The compiler emits a bounded Strategy object. Deterministic validation, market-state verification and risk guards control execution.

## Pipeline
1. User describes a strategy.
2. Compiler converts intent into an inspectable Strategy specification.
3. User edits/approves the specification.
4. Backtester replays the same deterministic rules.
5. Agent discovers the successor Event Contract by marketId/symbol.
6. Agent reads the live on-chain market record and proceeds only when status = Trading.
7. Agent reads the real order-book touch and evaluates strategy conditions.
8. execution-guard enforces max loss, max trades and allocated capital.
9. An authorized operator/session key submits the order; owner funds remain owner-scoped.
10. Agent observes settlement, redeems winners, updates state and discovers the next window.

## DreamDEX invariants
- Event Contracts use @somnia-chain/markets-sdk >= 0.25.0.
- The HTTP API does not expose Event Contract endpoints.
- Indexer state can lag, so writes must be gated against getMarketOnchain().
- Pools are recycled; persistent state is keyed by marketId/symbol, never pool address.
- Prices are Up probabilities; Down is complementary.
- Live execution fails closed when configuration or authorization is incomplete.

## Hackathon differentiation
DreamForge is not one trading bot. It is a strategy creation and execution layer: Idea -> Compile -> Backtest -> Deploy -> Prove. The next product layer is forkable strategy publishing and an arena where standardized strategies can be compared under identical market windows and starting capital.
