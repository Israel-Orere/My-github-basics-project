import { SomniaMarkets, isBinaryMarket, SOMNIA_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk';
import { somniaShannon } from '@somnia-chain/markets-sdk/chains';
import type { MarketSnapshot } from './types';

export function createReadExchange(){
  return new SomniaMarkets({
    indexerUrl:process.env.DREAMDEX_INDEXER_URL||'https://dev.smk.somnia.host/v1/graphql',
    chain:somniaShannon,
    wsRpcUrl:process.env.DREAMDEX_WS_RPC_URL||'wss://api.infra.testnet.somnia.network/ws',
    addresses:SOMNIA_TESTNET_ADDRESSES
  });
}

export async function getLiveMarkets():Promise<MarketSnapshot[]>{
  const exchange=createReadExchange();
  try{
    const markets=Object.values(await exchange.loadMarkets(true));
    const rows:MarketSnapshot[]=[];
    for(const market of markets){
      if(!market.active||!isBinaryMarket(market.info))continue;
      const asset=String(market.info.asset).toUpperCase();
      const intervalSec=Number(market.info.intervalSec);
      if(asset!=='BTC'&&asset!=='ETH')continue;
      if(intervalSec!==900&&intervalSec!==3600)continue;
      const onchain=await exchange.client.getMarketOnchain(market.info.marketId as `0x${string}`);
      if(onchain.status!==1)continue;
      const up=market.outcomes?.[0];
      if(!up)continue;
      const book=await exchange.fetchOrderBook(up.symbol,5);
      const bid=book.bids[0]?.[0],ask=book.asks[0]?.[0];
      if(bid===undefined&&ask===undefined)continue;
      const p=bid!==undefined&&ask!==undefined?(bid+ask)/2:(ask??bid)!;
      rows.push({
        id:market.info.marketId,
        symbol:market.symbol??up.symbol,
        asset:asset as 'BTC'|'ETH',
        window:intervalSec===900?'15m':'1h',
        upPrice:p,
        downPrice:1-p,
        status:'TRADING',
        closesAt:new Date(Number(onchain.expiry)*1000).toISOString()
      });
    }
    return rows;
  }finally{
    await Promise.resolve(exchange.close()).catch(()=>undefined);
  }
}
