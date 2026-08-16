import type { AuthorityStateContract } from './authority.js'
import type { ContextReferenceContract } from './context-reference.js'
import type { EvidenceItem } from './evidence.js'
import type { ExternalActionType } from './external-action.js'
import type { TaskContractStatus } from './task.js'
import type { WorkerContractStatus } from './worker.js'
import type { WorkerResult } from './worker-result.js'

/** Host-neutral capability semantics. Host adapters resolve these contracts. */
export type CapabilityImplementation='NATIVE'|'HYBRID'|'HI_OWNED'|'UNAVAILABLE'

export interface CapabilityRequirement {
  capability:string
  required:boolean
  reason:string
}

export interface CapabilityResolution {
  capability:string
  implementation:CapabilityImplementation
  available:boolean
  semanticLoss:string[]
  reason:string[]
}

/**
 * Boundary implemented by OpenCode, another host, or a Hi-owned fallback.
 * Core code depends on capability semantics, never a host client/session API.
 */
export interface CapabilityPort<Request=unknown,Result=unknown> {
  readonly capability:string
  resolve(requirement:CapabilityRequirement):CapabilityResolution|Promise<CapabilityResolution>
  execute(request:Request):Promise<Result>
}

export type WorkDependencyKind='requires'

export interface DependencyEdge {
  from:string
  to:string
  kind:WorkDependencyKind
}

export interface WorkNode {
  id:string
  missionId:string
  objective:string
  status:TaskContractStatus
  scope:string[]
  constraints:string[]
  dependencies:string[]
  requiredEvidence:string[]
  obligationIds:string[]
  contextReferences:ContextReferenceContract[]
  externalActionRequirements:ExternalActionType[]
  gateIds:string[]
  createdAt:number
  updatedAt:number
}

export interface ExecutionResourceSelection {
  role:string
  category:string
  requestedModel?:string
  requestedModelVariant?:string
  selectedModel?:string
  selectedModelVariant?:string
  projectedModel?:string
  projectedModelVariant?:string
  effectiveModel?:string
  effectiveModelVariant?:string
  effectiveModelVerified?:boolean
  effectiveModelVariantVerified?:boolean
  effectiveModelSource?:string
  fallbacks:string[]
  modelSelectionReason:string[]
}

export interface ExecutionAttempt {
  executionUnitId:string
  ordinal:number
  workerId?:string
  status:WorkerContractStatus|'unassigned'
  startedAt?:number
  updatedAt:number
  completedAt?:number
  sessionId?:string
  forkedFromSessionId?:string
  generation:number
  recoveryAttempt:number
  lastFailureKind?:string
  fallbackHistory:Array<{from?:string;to:string;variant?:string;reason:string;phase:'dispatch'|'runtime';at:number}>
}

export interface ExecutionUnit {
  id:string
  missionId:string
  workNodeId:string
  objective:string
  role:string
  category:string
  dependencies:string[]
  scope:string[]
  constraints:string[]
  requiredEvidence:string[]
  obligationIds:string[]
  contextReferences:ContextReferenceContract[]
  resourceSelection?:ExecutionResourceSelection
  attempt?:ExecutionAttempt
  workerFingerprint?:string
  writeSet:string[]
  nativeStateHash?:string
  result?:WorkerResult
}

export interface ProgressObservation {
  missionId:string
  generation:number
  iteration:number
  signature:string
  stagnationCount:number
  continuationBudget:number
  continuationActive:boolean
  reason?:string
  observedAt:number
}

export interface WorkGraph {
  missionId:string
  objective:string
  missionStatus:string
  requiredCapabilities:string[]
  risk:string
  executionMode:string
  topology:{mode:string;parallelism:number;reason:string[]}
  nodes:WorkNode[]
  edges:DependencyEdge[]
  executionUnits:ExecutionUnit[]
  evidence:{fresh:boolean;lastMutationAt?:number;items:EvidenceItem[]}
  authority:{pendingPermissions:number;pendingPermissionIds:string[];state?:AuthorityStateContract}
  blockers:string[]
  progress:ProgressObservation
}


export interface WorkGraphValidation {ok:boolean;reasons:string[]}

/** Mechanical graph invariants. Semantic policy belongs to planner/scheduler layers. */
export function validateWorkGraph(graph:WorkGraph):WorkGraphValidation{
  const reasons:string[]=[]
  const nodeIDs=graph.nodes.map(node=>node.id),unitIDs=graph.executionUnits.map(unit=>unit.id)
  if(new Set(nodeIDs).size!==nodeIDs.length)reasons.push('duplicate-work-node')
  if(new Set(unitIDs).size!==unitIDs.length)reasons.push('duplicate-execution-unit')
  const known=new Set(nodeIDs),unitsByNode=new Map<string,ExecutionUnit[]>()
  for(const unit of graph.executionUnits){
    const list=unitsByNode.get(unit.workNodeId)??[];list.push(unit);unitsByNode.set(unit.workNodeId,list)
    if(unit.missionId!==graph.missionId)reasons.push(`unit-mission-mismatch:${unit.id}`)
    if(!known.has(unit.workNodeId))reasons.push(`unit-unknown-node:${unit.id}`)
  }
  const edgeKeys=new Set(graph.edges.map(edge=>`${edge.from}\0${edge.to}\0${edge.kind}`))
  if(edgeKeys.size!==graph.edges.length)reasons.push('duplicate-dependency-edge')
  for(const edge of graph.edges){
    if(edge.from===edge.to)reasons.push(`self-dependency:${edge.to}`)
    if(!known.has(edge.from)||!known.has(edge.to))reasons.push(`edge-unknown-node:${edge.from}->${edge.to}`)
  }
  for(const node of graph.nodes){
    if(node.missionId!==graph.missionId)reasons.push(`node-mission-mismatch:${node.id}`)
    if(new Set(node.dependencies).size!==node.dependencies.length)reasons.push(`duplicate-node-dependency:${node.id}`)
    for(const dep of node.dependencies){
      if(dep===node.id)reasons.push(`self-dependency:${node.id}`)
      if(!known.has(dep))reasons.push(`unknown-node-dependency:${node.id}:${dep}`)
      if(!edgeKeys.has(`${dep}\0${node.id}\0requires`))reasons.push(`missing-edge:${dep}->${node.id}`)
    }
    const units=unitsByNode.get(node.id)??[]
    if(units.length!==1)reasons.push(`execution-unit-cardinality:${node.id}:${units.length}`)
    const unit=units[0]
    if(unit){
      if(JSON.stringify(unit.dependencies)!==JSON.stringify(node.dependencies))reasons.push(`unit-dependency-drift:${unit.id}`)
      if(unit.attempt&&unit.attempt.executionUnitId!==unit.id)reasons.push(`attempt-unit-mismatch:${unit.id}`)
    }
  }
  for(const edge of graph.edges){const target=graph.nodes.find(node=>node.id===edge.to);if(target&&!target.dependencies.includes(edge.from))reasons.push(`orphan-edge:${edge.from}->${edge.to}`)}
  return{ok:reasons.length===0,reasons:[...new Set(reasons)]}
}

export function isCapabilityResolution(value:unknown):value is CapabilityResolution{
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  const item=value as Record<string,unknown>
  return typeof item.capability==='string'&&item.capability.length>0
    &&['NATIVE','HYBRID','HI_OWNED','UNAVAILABLE'].includes(String(item.implementation))
    &&typeof item.available==='boolean'
    &&Array.isArray(item.semanticLoss)&&item.semanticLoss.every(x=>typeof x==='string')
    &&Array.isArray(item.reason)&&item.reason.every(x=>typeof x==='string')
    &&(item.implementation!=='UNAVAILABLE'||item.available===false)
}
