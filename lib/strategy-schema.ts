import { z } from 'zod';
export const StrategySchema=z.object({asset:z.enum(['BTC','ETH']),window:z.enum(['15m','1h']),side:z.enum(['UP','DOWN']),streak:z.number().int().min(1).max(6),maxEntryPrice:z.number().gt(0).lt(1),stake:z.number().positive().max(1000),maxLoss:z.number().positive(),maxTrades:z.number().int().positive().max(500)});
export type StrategySpec=z.infer<typeof StrategySchema>;