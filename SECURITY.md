# DreamForge security model

- Never commit owner or operator private keys.
- Production defaults to Shannon testnet until explicitly promoted.
- Every Event Contract write must re-read canonical on-chain market status and require Trading (1).
- Strategy inputs are schema validated; risk gates are deterministic and outside any language model.
- Automated execution should use a dedicated operator/session key where supported, never the owner's primary wallet key.
- Fail closed on stale market state, missing liquidity, missing signer, RPC errors, ambiguous strategy rules, or exhausted risk budget.
- Persist transaction hash, marketId, rule snapshot, and decision reason for every attempted write.
- Mainnet promotion requires explicit environment change and a separate security review.