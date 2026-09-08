import {compileStrategyWithAgent} from './strategy-agent';
import {compileStrategyDeterministically} from './deterministic-strategy-parser';
import {repairLocalStrategy} from './local-strategy-repair';
import type {StrategySpec} from './types';

function normalizeForLocalCompiler(prompt:string){
  return prompt
    .replace(/\b(1|5|15)\s*[- ]?\s*minutes?\b/gi,'$1m')
    .replace(/\b(1|4)\s*[- ]?\s*hours?\b/gi,'$1h')
    .replace(/\bprevious\s+(\d+)\s+completed\s+(?:1m|5m|15m|1h|4h)\s+(candles?|bars?)\b/gi,'previous $1 completed $2');
}

export async function compileStrategyResilient(prompt:string):Promise<StrategySpec>{
  const result=await compileStrategyWithAgent(prompt);
  if(result.compiler!=='deterministic-fallback')return result;

  const normalized=normalizeForLocalCompiler(prompt);
  const local=repairLocalStrategy(normalized,compileStrategyDeterministically(normalized));
  const note='The AI gateway is currently unavailable, so DreamForge used its local deterministic compiler for supported rules instead of dropping your indicators.';
  const interpretation=local.interpretation?{
    ...local.interpretation,
    assumptions:[note,...local.interpretation.assumptions]
  }:undefined;
  return {...local,interpretation};
}
