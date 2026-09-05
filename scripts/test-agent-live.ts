import assert from 'node:assert/strict';

const base=process.env.DREAMFORGE_URL;
const expectedSha=process.env.EXPECTED_SHA;
assert.ok(base,'DREAMFORGE_URL is required');
const prompt=`Trade BTC 15-minute UP contracts. Enter only when either of these setups occurs:
(A) on the 5-minute chart RSI(14) crosses above its 9-period EMA of RSI(14), the latest completed 1-minute close is above the previous completed 1-minute high, and ATR(14) on the 5-minute chart is above 50;
OR
(B) on the 15-minute chart price crosses above the upper Bollinger Band using period 20 and 2 standard deviations, and current 15-minute volume is more than 1.5 times its 20-period SMA.
For either setup, only trade Monday through Friday between 09:00 and 16:00 UTC and only buy UP at 58 cents or less. Stake $7. After a win stake $7, after a loss stake $3. Stop after losing $21, after 12 trades, or after 8 hours.`;

async function waitForRelease(){
 if(!expectedSha)return;
 let last='';
 for(let i=0;i<72;i++){
  try{const r=await fetch(`${base!.replace(/\/$/,'')}/api/health`,{cache:'no-store'});last=await r.text();if(r.ok){const h=JSON.parse(last);if(h.buildSha===expectedSha)return}}catch(e){last=e instanceof Error?e.message:String(e)}
  await new Promise(r=>setTimeout(r,5000));
 }
 throw new Error(`production never reported expected build ${expectedSha}: ${last.slice(0,500)}`);
}

async function main(){
 await waitForRelease();
 const response=await fetch(`${base!.replace(/\/$/,'')}/api/compile`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt})});
 const raw=await response.text();assert.ok(response.ok,`production compile failed: ${response.status} ${raw.slice(0,1000)}`);const body=JSON.parse(raw);
 assert.equal(body.compiler,'agent','deployed production must use the AI compiler, not fallback');
 assert.equal(body.interpretation?.needsClarification,false,`unambiguous strategy should compile without questions: ${(body.interpretation?.questions||[]).join(' | ')}`);
 assert.equal(body.asset,'BTC');assert.equal(body.window,'15m');assert.equal(body.side,'UP');assert.ok(Math.abs(body.trigger.maxEntryPrice-.58)<1e-9,'58-cent ceiling must be preserved');
 assert.equal(body.sizing.baseUsd,7);assert.equal(body.sizing.afterWinUsd,7);assert.equal(body.sizing.afterLossUsd,3);assert.equal(body.risk.maxLossUsd,21);assert.equal(body.risk.maxTrades,12);assert.equal(body.risk.durationHours,8);
 const groups:any[]=body.conditionGroups||[];assert.ok(groups.length>=2,'OR strategy must compile into at least two deterministic branches');const conditions=groups.flatMap(g=>g.conditions||[]);const exprs=conditions.flatMap((c:any)=>c.type==='TREND'?[c.expr]:c.type==='COMPARE'||c.type==='CROSS'?[c.left,c.right]:[]);const has=(kind:string)=>exprs.some((e:any)=>e?.kind===kind);
 assert.ok(conditions.some((c:any)=>c.type==='CROSS'&&[c.left?.kind,c.right?.kind].includes('RSI')&&[c.left?.kind,c.right?.kind].includes('EMA')),'RSI/EMA crossover must survive compilation');
 assert.ok(exprs.some((e:any)=>e?.kind==='HIGH'&&e.offsetBars===1),'previous 1m high must use offsetBars=1');assert.ok(has('ATR'),'ATR branch must survive compilation');assert.ok(has('BB_UPPER'),'Bollinger upper-band branch must survive compilation');assert.ok(has('VOLUME')&&exprs.some((e:any)=>e?.kind==='SMA'&&e.source==='VOLUME'&&Math.abs((e.multiplier??1)-1.5)<1e-9),'1.5x volume-SMA filter must survive compilation');
 assert.ok(groups.every(g=>(g.conditions||[]).some((c:any)=>c.type==='TIME_WINDOW'&&c.timezone==='UTC'&&c.startMinute===540&&c.endMinute===960)),'weekday UTC time filter must apply to every OR branch');
 console.log(`production complex-agent smoke passed: ${groups.length} branches, ${conditions.length} conditions`);
}
main().catch(e=>{console.error(e);process.exit(1)});
