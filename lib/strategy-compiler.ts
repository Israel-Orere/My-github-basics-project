import {compileStrategyWithAgent} from './strategy-agent';
import {compileStrategyDeterministically} from './deterministic-strategy-parser';
import type {StrategySpec} from './types';

export async function compileStrategyResilient(prompt:string):Promise<StrategySpec>{
  const result=await compileStrategyWithAgent(prompt);
  if(result.compiler!=='deterministic-fallback')return result;

  const local=compileStrategyDeterministically(prompt);
  const note='The AI gateway is currently unavailable, so DreamForge used its local deterministic compiler for supported rules instead of dropping your indicators.';
  const interpretation=local.interpretation?{
    ...local.interpretation,
    assumptions:[note,...local.interpretation.assumptions]
  }:undefined;
  return {...local,interpretation};
}
