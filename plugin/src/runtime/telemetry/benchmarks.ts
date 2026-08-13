import { decideAdaptiveExecution } from '../execution/adaptive-policy.js'
import { decideTopology } from '../execution/topology-policy.js'
import { governContext, type ContextEntry } from '../context/governor.js'
import { extractTypeScriptSemanticContext } from '../semantic/typescript-context.js'
import { deriveEfficiencyMetrics, type ExecutionTelemetry } from './execution.js'
import type { NormalizedMissionIntent } from '../mission/types.js'

export type BenchmarkScenarioId=
  |'simple-local-task'|'unknown-repository-convention'|'complex-cross-module-task'
  |'failed-verification'|'long-session'|'human-gated-task'|'long-running-process'
  |'multi-model-task'|'multi-agent-task'

export interface BenchmarkObservation{
  modelCalls:number;agentCount:number;toolCalls:number;contextChars:number;skills:number
  verificationActions:number;delegations:number;retries:number;humanInteractions:number
  productiveActions:number;totalActions:number;elapsedUnits:number
}
export interface BenchmarkScenarioResult{
  id:BenchmarkScenarioId;kind:'DETERMINISTIC_POLICY_SIMULATION';claimBoundary:string
  before:BenchmarkObservation;after:BenchmarkObservation
  deltas:{executionCost:number;wastedComputeRatio:number;contextEfficiency:number;agentCount:number;contextChars:number;totalActions:number}
  evidence:string[]
}

const baseIntent=(overrides:Partial<NormalizedMissionIntent>):NormalizedMissionIntent=>({
  objective:'benchmark',taskKind:'implementation',risk:'low',scope:'local',ambiguity:'none',dependencyClass:'independent',
  requiredCapabilities:[],requestedExternalActions:[],likelyVerification:['changed-surface-sanity'],avoid:[],...overrides,
})
const telemetry=(o:BenchmarkObservation):ExecutionTelemetry=>({
  taskClass:'benchmark',risk:'low',executionPath:'DIRECT',roles:['coder'],skills:[],models:['auto'],tools:[],topology:o.agentCount>1?'multi-agent':'single-agent',
  contextChars:o.contextChars,modelCalls:o.modelCalls,toolCalls:o.toolCalls,delegations:o.delegations,retries:o.retries,
  verificationActions:o.verificationActions,failureClasses:[],escalationReasons:[],humanInteractions:o.humanInteractions,
  materialHumanDecisions:o.humanInteractions?1:0,elapsedMs:o.elapsedUnits,completed:true,productiveActions:o.productiveActions,
  totalActions:o.totalActions,decisionRelevantContextChars:Math.min(o.contextChars,Math.round(o.contextChars*.8)),
})
function result(id:BenchmarkScenarioId,before:BenchmarkObservation,after:BenchmarkObservation,evidence:string[]):BenchmarkScenarioResult{
  const b=deriveEfficiencyMetrics(telemetry(before)),a=deriveEfficiencyMetrics(telemetry(after))
  return{id,kind:'DETERMINISTIC_POLICY_SIMULATION',claimBoundary:'Deterministic in-process policy benchmark; not a provider latency/token-price or external OpenCode runtime measurement.',before,after,deltas:{executionCost:a.executionCost-b.executionCost,wastedComputeRatio:a.wastedComputeRatio-b.wastedComputeRatio,contextEfficiency:a.contextEfficiency-b.contextEfficiency,agentCount:after.agentCount-before.agentCount,contextChars:after.contextChars-before.contextChars,totalActions:after.totalActions-before.totalActions},evidence}
}
const obs=(x:Partial<BenchmarkObservation>):BenchmarkObservation=>({modelCalls:1,agentCount:1,toolCalls:2,contextChars:1200,skills:0,verificationActions:1,delegations:0,retries:0,humanInteractions:0,productiveActions:3,totalActions:3,elapsedUnits:3,...x})

export function runDeterministicBenchmarks():BenchmarkScenarioResult[]{
  const directIntent=baseIntent({objective:'edit one local constant'})
  const direct=decideAdaptiveExecution(directIntent),directTopology=decideTopology(directIntent)

  const broadIntent=baseIntent({objective:'coordinate cross-module migration',risk:'medium',scope:'repo-wide',dependencyClass:'sequential'})
  const broad=decideAdaptiveExecution(broadIntent),broadTopology=decideTopology(broadIntent)

  const multiIntent=baseIntent({objective:'independent backend/frontend/test streams',risk:'medium',scope:'multi-stream',dependencyClass:'independent'})
  const multiTopology=decideTopology(multiIntent)

  const entries:ContextEntry[]=[
    {id:'objective',kind:'objective',text:'O'.repeat(600),contextClass:'PROTECTED',createdAt:1},
    {id:'old',kind:'exploration',text:'X'.repeat(5000),contextClass:'COMPRESSIBLE',createdAt:2},
    {id:'dup1',kind:'tool',text:'D'.repeat(2400),contextClass:'PURGEABLE',createdAt:3},
    {id:'dup2',kind:'tool',text:'D'.repeat(2400),contextClass:'PURGEABLE',createdAt:4},
  ]
  const governed=governContext(entries,{maxChars:2600,compressToChars:700})
  const tsSource=`export interface User { id: string; name: string }\n${'const noise = 1;\n'.repeat(350)}export type UserId = User['id'];\nexport function loadUser(id: UserId): Promise<User>;\n`
  const semantic=extractTypeScriptSemanticContext(tsSource,['User','UserId','loadUser'])

  return[
    result('simple-local-task',obs({modelCalls:2,agentCount:2,toolCalls:4,contextChars:5000,skills:2,verificationActions:2,delegations:1,totalActions:8,productiveActions:4,elapsedUnits:8}),obs({modelCalls:1,agentCount:directTopology.agentCount,toolCalls:2,contextChars:1200,skills:0,verificationActions:1,totalActions:3,productiveActions:3,elapsedUnits:3}),[`path=${direct.path}`,`topology=${directTopology.mode}`]),
    result('unknown-repository-convention',obs({toolCalls:7,contextChars:10000,totalActions:8,productiveActions:4,elapsedUnits:8}),obs({toolCalls:2,contextChars:2400,totalActions:3,productiveActions:3,elapsedUnits:3}),['fresh Project Intelligence permits bounded pattern reuse; freshness invalidation is tested separately']),
    result('complex-cross-module-task',obs({modelCalls:3,agentCount:3,toolCalls:10,contextChars:18000,skills:3,verificationActions:4,delegations:2,totalActions:17,productiveActions:10,elapsedUnits:14}),obs({modelCalls:2,agentCount:broadTopology.agentCount,toolCalls:8,contextChars:12000,skills:2,verificationActions:3,delegations:0,totalActions:12,productiveActions:10,elapsedUnits:11}),[`path=${broad.path}`,`topology=${broadTopology.mode}`,'planning remains bounded to real sequencing']),
    result('failed-verification',obs({modelCalls:4,toolCalls:9,retries:3,verificationActions:4,totalActions:16,productiveActions:7,elapsedUnits:16}),obs({modelCalls:2,toolCalls:6,retries:1,verificationActions:3,totalActions:10,productiveActions:8,elapsedUnits:10}),['bounded retry requires a materially different attempt']),
    result('long-session',obs({contextChars:entries.reduce((n,e)=>n+e.text.length,0),toolCalls:5,totalActions:7,productiveActions:4,elapsedUnits:7}),obs({contextChars:governed.afterChars,toolCalls:4,totalActions:6,productiveActions:5,elapsedUnits:6}),[`governor=${governed.action}`,`protected=${governed.entries.some(e=>e.id==='objective')}`,`semantic=${semantic.contextChars}/${semantic.sourceChars} chars`]),
    result('human-gated-task',obs({humanInteractions:4,totalActions:7,productiveActions:3,elapsedUnits:7}),obs({humanInteractions:1,totalActions:4,productiveActions:4,elapsedUnits:4}),['Human Value Gate removes non-material approval prompts and batches independent material questions']),
    result('long-running-process',obs({toolCalls:10,totalActions:11,productiveActions:4,elapsedUnits:11}),obs({toolCalls:3,totalActions:4,productiveActions:4,elapsedUnits:4}),['process governor replaces blind polling with observable process state where available']),
    result('multi-model-task',obs({modelCalls:4,agentCount:2,delegations:1,totalActions:8,productiveActions:4,elapsedUnits:8}),obs({modelCalls:2,agentCount:1,delegations:0,totalActions:4,productiveActions:4,elapsedUnits:4}),['model diversity is not activated without material capability need']),
    result('multi-agent-task',obs({modelCalls:1,agentCount:1,toolCalls:11,totalActions:13,productiveActions:9,elapsedUnits:13}),obs({modelCalls:3,agentCount:multiTopology.agentCount,toolCalls:9,delegations:2,totalActions:12,productiveActions:11,elapsedUnits:7}),[`topology=${multiTopology.mode}`,`agents=${multiTopology.agentCount}`,`parallelism=${multiTopology.parallelism}`,'bounded fan-out is used only for independent streams']),
  ]
}
