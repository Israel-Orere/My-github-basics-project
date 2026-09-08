import assert from 'node:assert/strict';
import {fetchRecentSpotBarsRest} from '../lib/spot-rest';

async function main(){
 const bars=await fetchRecentSpotBarsRest('BTC','15m',100);
 assert.ok(bars.length>=40,`strategy canvas expected at least 40 BTC 15m bars, received ${bars.length}`);
 const latest=bars[bars.length-1];
 assert.ok(latest.time>0&&latest.open>1_000&&latest.high>=latest.low&&latest.close>1_000,'strategy canvas candles must be normalized human-scale BTC OHLC data');
 assert.ok(bars.every((b,i)=>i===0||b.time>bars[i-1].time),'strategy canvas candles must be deduplicated and chronological');
 console.log(`strategy canvas live-data smoke passed: ${bars.length} BTC 15m bars, latest close ${latest.close}`);
}
main().catch(e=>{console.error(e);process.exit(1)});
