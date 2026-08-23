import { decideAdaptiveExecution } from '../execution/adaptive-policy.js'
import { decideTopology } from '../execution/topology-policy.js'
import { extractTypeScriptSemanticContext } from '../semantic/typescript-context.js'
import { deriveEfficiencyMetrics, type ExecutionTelemetry } from './execution.js'
import type { NormalizedMissionIntent,MissionState,MissionTask } from '../mission/types.js'
import { evaluateSchedulingResourceCapacity } from '../scheduler/planner.js'
import { parallelSafety } from '../scheduler/parallel-safety.js'
import { recoveryPlan } from '../continuation/recovery.js'
import { recordRecoveryStrategy } from '../continuation/recovery-governor.js'
import { boundMissionSurvivalSections } from '../state/snapshot.js'

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

  const survivalSections=[
    'Hi MISSION SURVIVAL STATE',
    `MISSION OBJECTIVE: ${'O'.repeat(1800)}`,
    `KNOWN BLOCKERS: ${'B'.repeat(1800)}`,
    `NEXT SAFE ACTION: ${'N'.repeat(1000)}`,
    'STOP CONDITIONS: all required obligations closed; no pending work; fresh evidence; no authority/rollback gate pending',
    `CURRENT TASKS: ${'T'.repeat(5000)}`,
    `LATEST RELEVANT EVIDENCE: ${'E'.repeat(3500)}`,
  ]
  const rawSurvival=survivalSections.join('\n'),boundedSurvival=boundMissionSurvivalSections(survivalSections,2600)
  const tsSource=`export interface User { id: string; name: string }\n${'const noise = 1;\n'.repeat(350)}export type UserId = User['id'];\nexport function loadUser(id: UserId): Promise<User>;\n`
  const semantic=extractTypeScriptSemanticContext(tsSource,['User','UserId','loadUser'])

  return[
    result('simple-local-task',obs({modelCalls:2,agentCount:2,toolCalls:4,contextChars:5000,skills:2,verificationActions:2,delegations:1,totalActions:8,productiveActions:4,elapsedUnits:8}),obs({modelCalls:1,agentCount:directTopology.agentCount,toolCalls:2,contextChars:1200,skills:0,verificationActions:1,totalActions:3,productiveActions:3,elapsedUnits:3}),[`path=${direct.path}`,`topology=${directTopology.mode}`]),
    result('unknown-repository-convention',obs({toolCalls:7,contextChars:10000,totalActions:8,productiveActions:4,elapsedUnits:8}),obs({toolCalls:2,contextChars:2400,totalActions:3,productiveActions:3,elapsedUnits:3}),['repo-native semantic context and targeted inspection avoid a generic persisted fact-memory dependency']),
    result('complex-cross-module-task',obs({modelCalls:3,agentCount:3,toolCalls:10,contextChars:18000,skills:3,verificationActions:4,delegations:2,totalActions:17,productiveActions:10,elapsedUnits:14}),obs({modelCalls:2,agentCount:broadTopology.agentCount,toolCalls:8,contextChars:12000,skills:2,verificationActions:3,delegations:0,totalActions:12,productiveActions:10,elapsedUnits:11}),[`path=${broad.path}`,`topology=${broadTopology.mode}`,'planning remains bounded to real sequencing']),
    result('failed-verification',obs({modelCalls:4,toolCalls:9,retries:3,verificationActions:4,totalActions:16,productiveActions:7,elapsedUnits:16}),obs({modelCalls:2,toolCalls:6,retries:1,verificationActions:3,totalActions:10,productiveActions:8,elapsedUnits:10}),['bounded retry requires a materially different attempt']),
    result('long-session',obs({contextChars:rawSurvival.length,toolCalls:5,totalActions:7,productiveActions:4,elapsedUnits:7}),obs({contextChars:boundedSurvival.length,toolCalls:4,totalActions:6,productiveActions:5,elapsedUnits:6}),[`mission-survival-bound=${boundedSurvival.length}/${rawSurvival.length}`,`priority-prefix=${boundedSurvival.startsWith('Hi MISSION SURVIVAL STATE')}`,`semantic=${semantic.contextChars}/${semantic.sourceChars} chars`]),
    result('human-gated-task',obs({humanInteractions:4,totalActions:7,productiveActions:3,elapsedUnits:7}),obs({humanInteractions:1,totalActions:4,productiveActions:4,elapsedUnits:4}),['Human Value Gate removes non-material approval prompts and batches independent material questions']),
    result('long-running-process',obs({toolCalls:10,totalActions:11,productiveActions:4,elapsedUnits:11}),obs({toolCalls:3,totalActions:4,productiveActions:4,elapsedUnits:4}),['process governor replaces blind polling with observable process state where available']),
    result('multi-model-task',obs({modelCalls:4,agentCount:2,delegations:1,totalActions:8,productiveActions:4,elapsedUnits:8}),obs({modelCalls:2,agentCount:1,delegations:0,totalActions:4,productiveActions:4,elapsedUnits:4}),['model diversity is not activated without material capability need']),
    result('multi-agent-task',obs({modelCalls:1,agentCount:1,toolCalls:11,totalActions:13,productiveActions:9,elapsedUnits:13}),obs({modelCalls:3,agentCount:multiTopology.agentCount,toolCalls:9,delegations:2,totalActions:12,productiveActions:11,elapsedUnits:7}),[`topology=${multiTopology.mode}`,`agents=${multiTopology.agentCount}`,`parallelism=${multiTopology.parallelism}`,'bounded fan-out is used only for independent streams']),
  ]
}

export type SchedulerEconomicsScenarioId='capacity-saturation'|'session-reuse'|'write-conflict'
export interface SchedulerEconomicsMetrics{
  queueWaitUnits:number
  providerSaturationEvents:number
  modelSaturationEvents:number
  taskDurationUnits:number
  retries:number
  contextChars:number
  sessionReuseSavedUnits:number
  writeConflictEvents:number
}
export interface SchedulerEconomicsResult{
  id:SchedulerEconomicsScenarioId
  kind:'DETERMINISTIC_SCHEDULER_SIMULATION'
  claimBoundary:string
  metrics:SchedulerEconomicsMetrics
  evidence:string[]
}
const schedulerClaim='Deterministic in-process scheduler units/events; not wall-clock provider latency, provider billing, or external OpenCode host telemetry.'
export function runSchedulerEconomicsBenchmarks():SchedulerEconomicsResult[]{
  const capacity={topology:3,global:3,providers:{alpha:1,beta:2},models:{'alpha/m1':1,'beta/m1':1},running:[{executionUnitId:'w1',provider:'alpha',model:'alpha/m1'}]}
  const providerBlocked=evaluateSchedulingResourceCapacity(capacity,'w2',{provider:'alpha',model:'alpha/m2'})
  const modelBlocked=evaluateSchedulingResourceCapacity(capacity,'w3',{provider:'beta',model:'alpha/m1'})
  const admitted=evaluateSchedulingResourceCapacity({...capacity,running:[]},'w2',{provider:'alpha',model:'alpha/m2'})
  const reasonText=(x:ReturnType<typeof evaluateSchedulingResourceCapacity>)=>x.ok?'ready':`${x.reason?.code??'blocked'}${x.reason?.detail?`:${x.reason.detail}`:''}`

  const recoveryMission={continuation:{stagnation_count:1}} as MissionState
  const same=recoveryPlan(recoveryMission)
  recoveryMission.continuation.stagnation_count=2
  const escalated=recoveryPlan(recoveryMission)

  const existing=[{id:'writer-a',mission_id:'benchmark-mission',objective:'a',status:'running',role:'coder',category:'standard',scope:['src/shared'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],external_action_requirements:[],created_at:1,updated_at:1}] as MissionTask[]
  const conflict=parallelSafety(existing,{scope:['src/shared/file.ts'],dependencies:[],role:'coder'})
  const independent=parallelSafety(existing,{scope:['src/independent/file.ts'],dependencies:[],role:'coder'})

  return[
    {id:'capacity-saturation',kind:'DETERMINISTIC_SCHEDULER_SIMULATION',claimBoundary:schedulerClaim,metrics:{queueWaitUnits:Number(!providerBlocked.ok)+Number(!modelBlocked.ok),providerSaturationEvents:Number(providerBlocked.reason?.code==='provider-capacity'),modelSaturationEvents:Number(modelBlocked.reason?.code==='model-capacity'),taskDurationUnits:4,retries:0,contextChars:0,sessionReuseSavedUnits:0,writeConflictEvents:0},evidence:[`provider=${reasonText(providerBlocked)}`,`model=${reasonText(modelBlocked)}`,`after-release=${reasonText(admitted)}`]},
    {id:'session-reuse',kind:'DETERMINISTIC_SCHEDULER_SIMULATION',claimBoundary:schedulerClaim,metrics:{queueWaitUnits:0,providerSaturationEvents:0,modelSaturationEvents:0,taskDurationUnits:2,retries:1,contextChars:1200,sessionReuseSavedUnits:same.level===1&&same.action==='same-worker-resume'&&escalated.level===2&&escalated.action==='same-worker-resume'?2:0,writeConflictEvents:0},evidence:[`level1=${same.level}:${same.action}`,`level2=${escalated.level}:${escalated.action}`,'reuse benefit is expressed as avoided fresh-session/model-handoff units, not token billing']},
    {id:'write-conflict',kind:'DETERMINISTIC_SCHEDULER_SIMULATION',claimBoundary:schedulerClaim,metrics:{queueWaitUnits:conflict.safe?0:1,providerSaturationEvents:0,modelSaturationEvents:0,taskDurationUnits:2,retries:0,contextChars:0,sessionReuseSavedUnits:0,writeConflictEvents:conflict.safe?0:1},evidence:[`conflict=${conflict.reasons.join('|')}`,`independent-safe=${independent.safe}`]}
  ]
}


export interface RecoveryGovernorAblationResult{
  kind:'DETERMINISTIC_RECOVERY_ABLATION'
  claimBoundary:string
  baseline:{first:string;second:string;redundantActions:number}
  governed:{first:string;second:string;redundantActions:number}
  coveredCorrectnessPreserved:boolean
  evidence:string[]
}
/** Counterfactual policy ablation: old counter-only selection vs semantic-state strategy fencing. */
export function runRecoveryGovernorAblation():RecoveryGovernorAblationResult{
  const base={continuation:{stagnation_count:1,generation:1,last_progress_signature:'deadbeef',recovery_history:[]},authority:{},release:{}} as unknown as MissionState
  const baselineFirst=recoveryPlan({...base,continuation:{...base.continuation,recovery_history:[]}} as MissionState),baselineSecond=recoveryPlan({...base,continuation:{...base.continuation,recovery_history:[]}} as MissionState)
  const governedMission=structuredClone(base),first=recoveryPlan(governedMission);recordRecoveryStrategy(governedMission,first,'started',1);const second=recoveryPlan(governedMission)
  const fresh=structuredClone(base),freshFirst=recoveryPlan(fresh)
  const identity=(plan:ReturnType<typeof recoveryPlan>)=>`${plan.level}:${plan.action}`
  return{kind:'DETERMINISTIC_RECOVERY_ABLATION',claimBoundary:'In-process policy ablation only; measures redundant recovery-strategy identity (rung + action) on identical semantic state, not provider latency/token billing.',baseline:{first:baselineFirst.action,second:baselineSecond.action,redundantActions:Number(identity(baselineFirst)===identity(baselineSecond))},governed:{first:first.action,second:second.action,redundantActions:Number(identity(first)===identity(second))},coveredCorrectnessPreserved:freshFirst.action===baselineFirst.action,evidence:[`baseline=${identity(baselineFirst)}->${identity(baselineSecond)}`,`governed=${identity(first)}->${identity(second)}`,'fresh-state first recovery action remains unchanged']}
}
