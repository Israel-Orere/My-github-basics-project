import { SomniaMarkets, isBinaryMarket } from '@somnia-chain/markets-sdk';
import type { MarketSnapshot } from './types';

/**
 * Read-only live adapter for DreamDEX Event Contracts.
 * Writes remain disabled until an explicitly funded/session-key execution path is configured.
 * Every market is gated against live on-chain status because the indexer may lag.
 */
export async function loadVerifiedBinaryMarkets(exchange: SomniaMarkets): Promise<MarketSnapshot[]> {
  const markets = Object.values(await exchange.loadMarkets(true));
  const rows: MarketSnapshot[] = [];

  for (const market of markets) {
    if (!market.active || !isBinaryMarket(market.info)) continue;
    const onchain = await exchange.client.getMarketOnchain(market.info.marketId as `0x${string}`);
    if (onchain.status !== 1) continue; // Trading

    const up = market.outcomes?.[0];
    const down = market.outcomes?.[1];
    if (!up || !down) continue;

    const book = await exchange.fetchOrderBook(up.symbol, 5);
    const bestBid = book.bids[0]?.[0];
    const bestAsk = book.asks[0]?.[0];
    if (bestBid === undefined && bestAsk === undefined) continue;

    // Midpoint is presentation-only. Execution must always use the actual book touch.
    const upPrice = bestBid !== undefined && bestAsk !== undefined
      ? (bestBid + bestAsk) / 2
      : (bestAsk ?? bestBid)!;

    const label = market.symbol ?? up.symbol;
    const upper = label.toUpperCase();
    const asset: 'BTC' | 'ETH' = upper.includes('ETH') ? 'ETH' : 'BTC';
    const window: '15m' | '1h' = upper.includes('15') ? '15m' : '1h';

    rows.push({
      id: market.info.marketId,
      symbol: label,
      asset,
      window,
      upPrice,
      downPrice: 1 - upPrice,
      status: 'TRADING',
    });
  }

  return rows;
}
