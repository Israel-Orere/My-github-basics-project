import type { StrategySpec } from './types';

export type AgentState = {
  realisedPnl: number;
  trades: number;
  consecutiveLosses: number;
  allocatedCapital: number;
};

export type ExecutionDecision =
  | { allowed: true; size: number }
  | { allowed: false; reason: string };

/** Fail-closed guard: deterministic code, never an LLM, decides whether capital may move. */
export function guardExecution(strategy: StrategySpec, state: AgentState, requestedSize: number): ExecutionDecision {
  if (!Number.isFinite(requestedSize) || requestedSize <= 0) return { allowed: false, reason: 'Invalid position size' };
  if (state.trades >= strategy.risk.maxTrades) return { allowed: false, reason: 'Maximum trade count reached' };
  if (state.realisedPnl <= -Math.abs(strategy.risk.maxLossUsd)) return { allowed: false, reason: 'Maximum loss kill switch reached' };
  if (requestedSize > state.allocatedCapital) return { allowed: false, reason: 'Requested position exceeds allocated capital' };
  const remainingLossBudget = Math.max(0, Math.abs(strategy.risk.maxLossUsd) + state.realisedPnl);
  if (requestedSize > remainingLossBudget) return { allowed: false, reason: 'Position exceeds remaining loss budget' };
  return { allowed: true, size: requestedSize };
}
