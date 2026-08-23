import { normalizeBoundedProjectPath } from './common.js'
import type { WorkerResultStatus } from './worker-result.js'

export const TASK_OUTCOME_MEMORY_STATUS=['DONE','FIX_REQUIRED','NEEDS_CONTEXT','BLOCKED','FAILED'] as const
export const TASK_OUTCOME_MEMORY_FAILURE_FINDINGS=['ci-build','unknown-root-cause'] as const
export interface TaskOutcomeMemoryRecord {
  schema:1
  type:'hi-task-outcome-memory'
  fingerprint:string
  source_state_hash:string
  scope:string[]
  outcome:WorkerResultStatus
  attempt:number
  generation:number
  result_digest:string
  issue_classes:string[]
  failure_finding?:'ci-build'|'unknown-root-cause'
  recorded_at:number
}

const KEYS=new Set(['schema','type','fingerprint','source_state_hash','scope','outcome','attempt','generation','result_digest','issue_classes','failure_finding','recorded_at'])
const STATUS=new Set<string>(TASK_OUTCOME_MEMORY_STATUS),FINDINGS=new Set<string>(TASK_OUTCOME_MEMORY_FAILURE_FINDINGS)
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function sha(v:unknown):v is string{return typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v)}
function strings(v:unknown):v is string[]{return Array.isArray(v)&&v.every(x=>typeof x==='string')}
export function isTaskOutcomeMemoryRecord(v:unknown):v is TaskOutcomeMemoryRecord{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k))||v.schema!==1||v.type!=='hi-task-outcome-memory'||!sha(v.fingerprint)||!sha(v.source_state_hash)||!sha(v.result_digest))return false
  if(!strings(v.scope)||!v.scope.length||v.scope.length>100||!v.scope.every(x=>normalizeBoundedProjectPath(x)===x))return false
  if(typeof v.outcome!=='string'||!STATUS.has(v.outcome)||!Number.isInteger(v.attempt)||Number(v.attempt)<1||!Number.isInteger(v.generation)||Number(v.generation)<1)return false
  if(!strings(v.issue_classes)||v.issue_classes.length>12||!v.issue_classes.every(x=>/^[a-z][a-z0-9-]{1,79}$/.test(x)))return false
  if(v.failure_finding!==undefined&&(typeof v.failure_finding!=='string'||!FINDINGS.has(v.failure_finding)))return false
  return typeof v.recorded_at==='number'&&Number.isFinite(v.recorded_at)&&v.recorded_at>0
}
