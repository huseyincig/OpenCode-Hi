import type {MissionState} from '../mission/types.js'

export const NON_PROGRESS_TOOL_NAMES=new Set(['hi_task_peek','hi_task_await','hi_task_list','hi_status','hi_ledger','hi_readiness','hi_settings','hi_role_models'])
const INERT_EVENT_TYPES=new Set([
  'worker.await-timeout','worker.native-status','runtime.decision','runtime.liveness-assessment',
  'runtime.liveness-recovery','session.compacted','parent.wake','parent.wake.deferred',
  'permission.duplicate-ignored','permission.stale-ask-ignored','worker.await-progress-observed',
  'process.output-repeat',
])

function eventGeneration(event:MissionState['execution']['ledger'][number]):number|undefined{const n=Number(event.payload?.generation);return Number.isInteger(n)?n:undefined}
export function durableProgressKey(event:MissionState['execution']['ledger'][number],currentGeneration?:number):string|undefined{
  const generation=eventGeneration(event);if(currentGeneration!==undefined&&generation!==undefined&&generation!==currentGeneration)return undefined
  const type=event.type
  if(INERT_EVENT_TYPES.has(type))return undefined
  if(type==='tool.operation-started'||type==='tool.operation-result'){
    const operation=String(event.payload?.operation_id??''),tool=String(event.payload?.tool??''),g=Number(event.payload?.generation)
    if(!operation||NON_PROGRESS_TOOL_NAMES.has(tool)||!Number.isInteger(g))return undefined
    return`${type}:${g}:${operation}`
  }
  if(type==='assistant.progress-observed'){
    const key=String(event.payload?.activity_key??'');return key?`${type}:${key}`:undefined
  }
  if(type==='process.output-observed'){
    const process=String(event.payload?.process_id??''),hash=String(event.payload?.state_hash??''),start=Number(event.payload?.start_cursor??0),end=Number(event.payload?.end_cursor??0)
    if(!process||!hash||end<=start)return undefined
    return`${type}:${process}:${hash}`
  }
  if(type==='file.changed')return`${type}:${event.id}`
  if(type==='evidence.observed'||type.startsWith('verification.')||type==='browser.observation-recorded')return`${type}:${event.id}`
  if(type==='process.spawned'||type==='process.exited')return`${type}:${String(event.payload?.process_id??event.id)}`
  if(type.startsWith('semantic.')){if(type.includes('rejected'))return undefined;return`${type}:${String(event.payload?.revision??event.id)}`}
  if(type==='task.created'||type==='task.scope-expanded')return`${type}:${event.task_id??event.id}`
  if(type.startsWith('worker.')){
    if(/(?:native-status|await-|duplicate-ignored|terminal-ignored|stale-|callback\.|error-deferred|terminal-event-deferred|unverified-host-status|skipped|precondition)/.test(type))return undefined
    if(/(?:created|queued|started|completed|resumed|recovered|constraint-rebased|semantic-resumed|runtime-fallback|stagnation-recovery|cancelled|failed)$/.test(type))return`${type}:${event.worker_id??event.id}:${generation??''}`
  }
  return undefined
}
