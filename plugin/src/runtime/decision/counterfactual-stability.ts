import type { NormalizedMissionIntent,VerificationPolicy } from '../mission/types.js'
import { decideAdaptiveExecution,type ExecutionPath } from '../execution/adaptive-policy.js'
import { decideTopology,type TopologyPolicyConfig } from '../execution/topology-policy.js'
import { minimumTeamFor } from '../routing/minimum-team.js'
import { resolveCategory } from '../routing/category.js'

export type DecisionStabilityAxis='execution-path'|'topology'|'team'|'model-class'
export type DecisionPerturbationDimension='risk'|'ambiguity'|'scope'|'dependency-class'
export interface CounterfactualDecisionStability{
  advisory_only:true
  probability_claim:false
  sample_count:number
  unchanged_count:number
  stability_ratio:number
  band:'ROBUST'|'MIXED'|'FRAGILE'
  fragile_dimensions:DecisionPerturbationDimension[]
  changed_axes:Record<DecisionStabilityAxis,number>
  samples:Array<{dimension:DecisionPerturbationDimension;from:string;to:string;changed_axes:DecisionStabilityAxis[]}>
}

interface Signature{executionPath:ExecutionPath;topology:string;team:string;modelClass:string}
const round=(n:number)=>Number(n.toFixed(6))
function signature(intent:NormalizedMissionIntent,verification:VerificationPolicy,primaryMode:'auto'|'manager'|'working-manager',topologyPolicy:TopologyPolicyConfig):Signature{
  const executionPath=decideAdaptiveExecution(intent).path,topology=decideTopology(intent,topologyPolicy),team=minimumTeamFor(intent,verification,primaryMode)
  return{executionPath,topology:`${topology.mode}:${topology.executionMode}:${topology.agentCount}:${topology.parallelism}`,team:`${team.primary}:${team.direct}:${team.roles.join(',')}`,modelClass:resolveCategory(intent)}
}
function changed(a:Signature,b:Signature):DecisionStabilityAxis[]{const out:DecisionStabilityAxis[]=[];if(a.executionPath!==b.executionPath)out.push('execution-path');if(a.topology!==b.topology)out.push('topology');if(a.team!==b.team)out.push('team');if(a.modelClass!==b.modelClass)out.push('model-class');return out}
function add<T>(out:Array<{dimension:DecisionPerturbationDimension;from:string;to:string;intent:NormalizedMissionIntent}>,dimension:DecisionPerturbationDimension,base:T,to:T,intent:NormalizedMissionIntent):void{if(base!==to)out.push({dimension,from:String(base),to:String(to),intent})}
function perturbations(intent:NormalizedMissionIntent):Array<{dimension:DecisionPerturbationDimension;from:string;to:string;intent:NormalizedMissionIntent}>{
  const out:Array<{dimension:DecisionPerturbationDimension;from:string;to:string;intent:NormalizedMissionIntent}>=[]
  const risks:NormalizedMissionIntent['risk'][]=['low','medium','high','authority-boundary'],ri=risks.indexOf(intent.risk);for(const i of [ri-1,ri+1])if(i>=0&&i<risks.length){const next=risks[i];if(intent.requestedExternalActions.length&&next!=='authority-boundary')continue;add(out,'risk',intent.risk,next,{...intent,risk:next})}
  const ambiguities:NormalizedMissionIntent['ambiguity'][]=['none','resolvable','contract-critical'],ai=ambiguities.indexOf(intent.ambiguity);for(const i of [ai-1,ai+1])if(i>=0&&i<ambiguities.length)add(out,'ambiguity',intent.ambiguity,ambiguities[i],{...intent,ambiguity:ambiguities[i]})
  const scopes:NormalizedMissionIntent['scope'][]=['local','multi-file','repo-wide','multi-stream','external'],si=scopes.indexOf(intent.scope);for(const i of [si-1,si+1])if(i>=0&&i<scopes.length){const next=scopes[i];if(intent.requestedExternalActions.length&&next!=='external')continue;add(out,'scope',intent.scope,next,{...intent,scope:next})}
  const deps:NormalizedMissionIntent['dependencyClass'][]=['independent','independent-multi','sequential','unknown','external-gated'],di=deps.indexOf(intent.dependencyClass);for(const i of [di-1,di+1])if(i>=0&&i<deps.length)add(out,'dependency-class',intent.dependencyClass,deps[i],{...intent,dependencyClass:deps[i]})
  return out.slice(0,8)
}
export function counterfactualDecisionStability(input:{intent:NormalizedMissionIntent;verification:VerificationPolicy;primaryMode?:'auto'|'manager'|'working-manager';topology:TopologyPolicyConfig}):CounterfactualDecisionStability{
  const primary=input.primaryMode??'auto',base=signature(input.intent,input.verification,primary,input.topology),samples=perturbations(input.intent).map(item=>({...item,changed_axes:changed(base,signature(item.intent,input.verification,primary,input.topology))})),counts:Record<DecisionStabilityAxis,number>={'execution-path':0,topology:0,team:0,'model-class':0}
  for(const sample of samples)for(const axis of sample.changed_axes)counts[axis]++
  const unchanged=samples.filter(x=>x.changed_axes.length===0).length,ratio=samples.length?unchanged/samples.length:1,fragile=[...new Set(samples.filter(x=>x.changed_axes.length>0).map(x=>x.dimension))]
  return{advisory_only:true,probability_claim:false,sample_count:samples.length,unchanged_count:unchanged,stability_ratio:round(ratio),band:ratio>=.75?'ROBUST':ratio>=.4?'MIXED':'FRAGILE',fragile_dimensions:fragile,changed_axes:counts,samples:samples.map(({dimension,from,to,changed_axes})=>({dimension,from,to,changed_axes}))}
}
