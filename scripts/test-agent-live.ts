import assert from 'node:assert/strict';

const base=process.env.DREAMFORGE_URL;
const expectedSha=process.env.EXPECTED_SHA;
assert.ok(base,'DREAMFORGE_URL is required');

const demoPrompt=`Trade BTC 15-minute UP contracts only when the current price is inside the highest high and lowest low of the previous 20 completed 15-minute candles, RSI(14) is between 42 and 60, EMA20 is above EMA50, and volume is above its 20-period SMA. Only pay 58 cents or less. Risk $8 initially, $8 after wins, $3 after losses, and stop after losing $25 or 12 trades.`;

const advancedOrPrompt=`Trade BTC 15-minute UP contracts. Enter only when either of these setups occurs:
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

async function compile(prompt:string){
 const response=await fetch(`${base!.replace(/\/$/,'')}/api/compile`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt})});
 const raw=await response.text();assert.ok(response.ok,`production compile failed: ${response.status} ${raw.slice(0,1000)}`);return JSON.parse(raw);
}

async function main(){
 await waitForRelease();

 // This is the judge-facing demo strategy. It must stay fully usable even if the
 // external AI gateway is unavailable, because DreamForge has a deterministic local compiler.
 const body=await compile(demoPrompt);
 assert.ok(body.compiler==='agent'||body.compiler==='deterministic-local',`demo strategy must use a safe compiler, got ${body.compiler}`);
 assert.equal(body.interpretation?.needsClarification,false,`demo strategy should compile without questions: ${(body.interpretation?.questions||[]).join(' | ')}`);
 assert.equal(body.asset,'BTC');assert.equal(body.window,'15m');assert.equal(body.side,'UP');assert.ok(Math.abs(body.trigger.maxEntryPrice-.58)<1e-9,'58-cent ceiling must be preserved');
 assert.equal(body.sizing.baseUsd,8);assert.equal(body.sizing.afterWinUsd,8);assert.equal(body.sizing.afterLossUsd,3);assert.equal(body.risk.maxLossUsd,25);assert.equal(body.risk.maxTrades,12);
 const groups:any[]=body.conditionGroups||[];const conditions=groups.flatMap(g=>g.conditions||[]);const exprs=conditions.flatMap((c:any)=>c.type==='TREND'?[c.expr]:c.type==='COMPARE'||c.type==='CROSS'?[c.left,c.right]:[]);const has=(kind:string)=>exprs.some((e:any)=>e?.kind===kind);
 assert.ok(has('RSI'),'RSI rules must survive production compilation');
 assert.ok(exprs.filter((e:any)=>e?.kind==='EMA').some((e:any)=>e.period===20),'EMA20 must survive production compilation');
 assert.ok(exprs.filter((e:any)=>e?.kind==='EMA').some((e:any)=>e.period===50),'EMA50 must survive production compilation');
 assert.ok(has('VOLUME')&&exprs.some((e:any)=>e?.kind==='SMA'&&e.source==='VOLUME'&&e.period===20),'volume > SMA20(volume) must survive production compilation');
 assert.ok(has('HIGHEST_HIGH')&&has('LOWEST_LOW'),'previous 20-bar range boundaries must survive production compilation');

 // Advanced OR logic is intentionally agent-only today. If the gateway is healthy,
 // prove it compiles. If it is not, prove DreamForge fails closed instead of changing boolean logic.
 const advanced=await compile(advancedOrPrompt);
 if(advanced.compiler==='agent'&&!advanced.interpretation?.needsClarification){
  const advancedGroups:any[]=advanced.conditionGroups||[];
  assert.ok(advancedGroups.length>=2,'AI compiler must preserve OR as at least two deterministic branches');
  console.log(`production smoke passed: demo compiler=${body.compiler}; advanced AI OR=${advancedGroups.length} branches`);
 }else{
  assert.ok(advanced.interpretation?.needsClarification===true,'advanced OR fallback must stay locked when AI compiler is unavailable');
  const q=(advanced.interpretation?.questions||[]).join(' ').toLowerCase();
  assert.ok(q.includes('or')||q.includes('branch'),'advanced OR fallback should explain that branching cannot be guessed');
  console.log(`production smoke passed: demo compiler=${body.compiler}; advanced OR safely locked via ${advanced.compiler}`);
 }
}
main().catch(e=>{console.error(e);process.exit(1)});
