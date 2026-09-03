import { SomniaMarkets, isBinaryMarket } from '@somnia-chain/markets-sdk';
import { defineChain } from 'viem';
import type { MarketSnapshot } from './types';

const addresses = {
  collateral: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E' as `0x${string}`,
  testUsdc: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E' as `0x${string}`,
  binaryModule: '0x3ecC694Cef705358864a646142ac17A90E29e388' as `0x${string}`,
  marketsCore: '0x2802504314685D89bF6C992CA5a8e7cC78bc0294' as `0x${string}`,
  binarySettlement: '0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23' as `0x${string}`,
  collateralRouter: '0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C' as `0x${string}`,
  oracleHub: '0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b' as `0x${string}`,
  marketCreator: '0x5Ce69567dB39C8fBAd7e048bEfdbcCdfE67B44e6' as `0x${string}`,
};
const chain = defineChain({id:50312,name:'Somnia Shannon',nativeCurrency:{name:'Somnia Test Token',symbol:'STT',decimals:18},rpcUrls:{default:{http:['https://api.infra.testnet.somnia.network'],webSocket:['wss://api.infra.testnet.somnia.network/ws']}}});
export function createReadExchange(){return new SomniaMarkets({indexerUrl:process.env.DREAMDEX_INDEXER_URL||'https://dev.smk.somnia.host/v1/graphql',chain,wsRpcUrl:process.env.DREAMDEX_WS_RPC_URL||'wss://api.infra.testnet.somnia.network/ws',addresses});}
export async function getLiveMarkets():Promise<MarketSnapshot[]>{const exchange=createReadExchange();try{const markets=Object.values(await exchange.loadMarkets(true));const rows:MarketSnapshot[]=[];for(const market of markets){if(!market.active||!isBinaryMarket(market.info))continue;const onchain=await exchange.client.getMarketOnchain(market.info.marketId as `0x${string}`);if(onchain.status!==1)continue;const up=market.outcomes?.[0];if(!up)continue;const book=await exchange.fetchOrderBook(up.symbol,5);const bid=book.bids[0]?.[0],ask=book.asks[0]?.[0];if(bid===undefined&&ask===undefined)continue;const p=bid!==undefined&&ask!==undefined?(bid+ask)/2:(ask??bid)!;const label=market.symbol??up.symbol;const u=label.toUpperCase();rows.push({id:market.info.marketId,symbol:label,asset:u.includes('ETH')?'ETH':'BTC',window:u.includes('15')?'15m':'1h',upPrice:p,downPrice:1-p,status:'TRADING'});}return rows;}finally{await Promise.resolve(exchange.close()).catch(()=>undefined);}}
