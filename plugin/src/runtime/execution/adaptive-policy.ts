import type { MissionState, NormalizedMissionIntent, Risk } from '../mission/types.js'

export type ExecutionPath='DIRECT'|'EVIDENCE'|'PLANNED'|'ESCALATED'
export type ExecutionDepth='minimal'|'bounded'|'coordinated'|'escalated'
export type ContextDepth='local'|'targeted'|'dependency-aware'|'broad'
export type IsolationDepth='current-workspace'|'worktree'|'strong'|'restricted'
export interface AdaptiveExecutionDecision{
  path:ExecutionPath
  role:{mode:'single-role'|'multi-role';reason:string}
  skills:{max:number;defaultZero:true;reason:string}
  capability:{model:'host-default'|'adaptive'|'stronger-if-needed';tools:'minimum-sufficient';reason:string}
  executionDepth:ExecutionDepth
  contextDepth:ContextDepth
  isolationDepth:IsolationDepth
  reasons:string[]
}

function riskRank(risk:Risk):number{return risk==='low'?0:risk==='medium'?1:risk==='high'?2:3}
export function decideAdaptiveExecution(intent:NormalizedMissionIntent,m?:MissionState):AdaptiveExecutionDecision{
  const reasons:string[]=[]
  const coordination=intent.scope==='repo-wide'||intent.scope==='multi-stream'||intent.dependencyClass==='sequential'
  const materialUncertainty=intent.ambiguity!=='none'||intent.requiredCapabilities.includes('source-verification')
  const escalated=riskRank(intent.risk)>=2||Boolean(m&&m.stagnation_count>=2)||Boolean(m?.blockers.length)
  let path:ExecutionPath
  if(escalated){path='ESCALATED';reasons.push('risk/failure evidence justifies escalation')}
  else if(coordination){path='PLANNED';reasons.push('real sequencing or cross-surface coordination is required')}
  else if(materialUncertainty){path='EVIDENCE';reasons.push('decision-changing uncertainty requires bounded evidence')}
  else{path='DIRECT';reasons.push('clear reversible scope supports direct execution')}
  const executionDepth:ExecutionDepth=path==='DIRECT'?'minimal':path==='PLANNED'?'coordinated':path==='ESCALATED'?'escalated':'bounded'
  const contextDepth:ContextDepth=intent.scope==='local'?'local':intent.scope==='multi-file'?'targeted':intent.scope==='repo-wide'?'broad':'dependency-aware'
  const isolationDepth:IsolationDepth=intent.risk==='authority-boundary'?'restricted':intent.risk==='high'?'worktree':'current-workspace'
  const multiRole=path==='PLANNED'||path==='ESCALATED'
  return{path,role:{mode:multiRole?'multi-role':'single-role',reason:multiRole?'coordination may require distinct logical roles':'one logical role is sufficient initially'},skills:{max:path==='ESCALATED'?3:path==='PLANNED'?2:1,defaultZero:true,reason:'skills activate only when methodology is necessary'},capability:{model:path==='ESCALATED'?'stronger-if-needed':'adaptive',tools:'minimum-sufficient',reason:'use the cheapest sufficient trajectory; capability availability alone is not activation'},executionDepth,contextDepth,isolationDepth,reasons}
}
