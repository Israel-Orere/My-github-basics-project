import assert from 'node:assert/strict';
import {createReadExchange} from '../lib/dreamdex';
import {fetchSpotBars} from '../lib/spot-history';

let exchange:any;
try{
 exchange=createReadExchange();
 const now=Math.floor(Date.now()/1000);
 const bars=await fetchSpotBars(exchange,'BTC','15m',now-24*3600,now,40);
 assert.ok(bars.length>=20,`expected real WBTC spot candles, received ${bars.length}`);
 assert.ok(bars.every(b=>Number.isFinite(b.close)&&b.close>0),'spot candles must contain positive finite closes');
 console.log(`DreamDEX spot integration passed with ${bars.length} BTC 15m bars; latest close ${bars[bars.length-1].close}`);
}finally{
 try{await Promise.resolve(exchange?.close?.())}catch{}
}
