import type { ExecutionMode, MissionState, NormalizedMissionIntent } from '../mission/types.js'
import { resolveExecutionMode } from '../routing/execution-mode.js'
export type TopologyMode='adaptive'|'single-agent'|'multi-agent'
export interface TopologyPolicyConfig{mode:TopologyMode;maxAgents:number;parallelism:number}
export interface TopologyDecision{mode:'single-agent'|'multi-agent';executionMode:ExecutionMode;agentCount:number;parallelism:number;reason:string[]}
export const DEFAULT_TOPOLOGY_POLICY:TopologyPolicyConfig={mode:'adaptive',maxAgents:4,parallelism:2}
export function decideTopology(intent:NormalizedMissionIntent,config:TopologyPolicyConfig=DEFAULT_TOPOLOGY_POLICY,m?:MissionState):TopologyDecision{
  if(m?.execution_mode==='team')return{mode:'multi-agent',executionMode:'team',agentCount:Math.max(2,m.topology?.agentCount??2),parallelism:Math.max(1,m.topology?.parallelism??2),reason:['existing bounded Team Mode remains authoritative']}
  if(config.maxAgents<=1)return{mode:'single-agent',executionMode:'single',agentCount:1,parallelism:1,reason:['maxAgents=1 is an executable topology ceiling']}
  if(config.mode==='single-agent')return{mode:'single-agent',executionMode:'single',agentCount:1,parallelism:1,reason:['explicit user/project single-agent override']}
  if(config.mode==='multi-agent')return{mode:'multi-agent',executionMode:'parallel',agentCount:Math.max(2,Math.min(config.maxAgents,2)),parallelism:Math.max(1,Math.min(config.parallelism,2)),reason:['explicit user/project multi-agent override']}
  const base=resolveExecutionMode(intent)
  const benefit=base.mode==='parallel'
  if(!benefit)return{mode:'single-agent',executionMode:'single',agentCount:1,parallelism:1,reason:['adaptive policy found no material fan-out benefit',...base.reason]}
  const count=Math.max(2,Math.min(config.maxAgents,intent.scope==='multi-stream'?3:2))
  return{mode:'multi-agent',executionMode:'parallel',agentCount:count,parallelism:Math.min(count,Math.max(1,config.parallelism)),reason:['independent work/review streams justify bounded fan-out',...base.reason]}
}
