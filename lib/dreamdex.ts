import { SomniaMarkets } from '@somnia-chain/markets-sdk';
import { defineChain } from 'viem';
import type { MarketSnapshot } from './types';
import { loadVerifiedBinaryMarkets } from './dreamdex-live';

const SHANNON = defineChain({
  id: 50312,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://api.infra.testnet.somnia.network'],
      webSocket: ['wss://api.infra.testnet.somnia.network/ws'],
    },
  },
});

const ADDRESSES = {
  collateral: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',
  testUsdc: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',
  binaryModule: '0x3ecC694Cef705358864a646142ac17A90E29e388',
  marketsCore: '0x2802504314685D89bF6C992CA5a8e7cC78bc0294',
  marketCreator: '0x5Ce69567dB39C8fBAd7e048bEfdbcCdfE67B44e6',
  clobFactory: '0xb2BE8EE02F96379DB75f01802384593EBa9bfF04',
  binaryPoolImpl: '0x82A1FcdaA2daC2fC7D5f9909D43E68021eE966FD',
  binarySettlement: '0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23',
  collateralRouter: '0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C',
  marketCreatorFactory: '0xE6bEE93cE87c9E6e62aCb621caa7832EE47b4F6B',
  oracleHub: '0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b',
} as const;

export function createReadOnlyDreamDex() {
  return new SomniaMarkets({
    indexerUrl: process.env.DREAMDEX_INDEXER_URL ?? 'https://dev.smk.somnia.host/v1/graphql',
    chain: SHANNON,
    wsRpcUrl: process.env.SOMNIA_WS_RPC_URL ?? 'wss://api.infra.testnet.somnia.network/ws',
    addresses: ADDRESSES,
  });
}

export async function getLiveMarkets(): Promise<MarketSnapshot[]> {
  const exchange = createReadOnlyDreamDex();
  try {
    return await loadVerifiedBinaryMarkets(exchange);
  } finally {
    await Promise.resolve(exchange.close()).catch(() => undefined);
  }
}
