import type { ExecutionPolicyMode } from './schema.js'
import type { NormalizedMissionIntent } from '../runtime/mission/types.js'

export type ExecutionProfileName='minimal'|'balanced'|'thorough'

export function executionProfileFor(mode:ExecutionPolicyMode,intent:NormalizedMissionIntent):ExecutionProfileName{
  if(mode==='minimal'||mode==='balanced'||mode==='thorough')return mode
  if(mode==='manual')return'balanced'
  if(intent.risk==='high'||intent.risk==='authority-boundary')return'thorough'
  if(intent.risk==='low'&&intent.scope==='local'&&intent.ambiguity==='none')return'minimal'
  return'balanced'
}

export function automaticContinuationEnabled(mode:ExecutionPolicyMode):boolean{return mode!=='manual'}
export function adaptiveIdleEvaluatorEnabled(mode:ExecutionPolicyMode):boolean{return mode==='adaptive'}
