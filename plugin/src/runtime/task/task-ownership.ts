import type {MissionState,MissionTask,TaskStatus} from '../mission/types.js'
import {appendLedger} from '../ledger/ledger.js'

const ACTIVE_WORKER_STATUSES=new Set(['created','queued','starting','busy'])
const UNRESOLVED_RESULT_STATUSES=new Set(['FIX_REQUIRED','NEEDS_CONTEXT','BLOCKED'])
const CONTROL_PENDING_TASK_STATUSES=new Set(['created','queued','running','waiting'])

/** Canonical obligation ownership is separate from the historical child attempt/result. */
export function taskOwnedObligationsClosed(m:MissionState,task:MissionTask):boolean{
  return task.obligation_ids.length>0&&task.obligation_ids.every(id=>m.execution.obligations.some(o=>o.id===id&&o.status==='closed'))
}

/** A settled unresolved attempt can lose control authority only after every owned obligation closed. */
export function taskHasSatisfiedSettledOwnership(m:MissionState,task:MissionTask):boolean{
  if(!taskOwnedObligationsClosed(m,task)||!task.result||!UNRESOLVED_RESULT_STATUSES.has(task.result.status))return false
  const worker=task.worker_id?m.execution.workers.find(w=>w.id===task.worker_id):m.execution.workers.find(w=>w.task_id===task.id)
  return !worker||!ACTIVE_WORKER_STATUSES.has(worker.status)
}

/** Scheduler/control projection only; raw durable Task/WorkerResult history is intentionally unchanged. */
export function taskControlStatus(m:MissionState,task:MissionTask):TaskStatus{
  return taskHasSatisfiedSettledOwnership(m,task)&&['waiting','blocked'].includes(task.status)?'completed':task.status
}
export function taskPendingForControl(m:MissionState,task:MissionTask):boolean{return CONTROL_PENDING_TASK_STATUSES.has(taskControlStatus(m,task))}
export function taskResultRequiresReconciliation(m:MissionState,task:MissionTask):boolean{return task.status!=='cancelled'&&!taskHasSatisfiedSettledOwnership(m,task)&&Boolean(task.result&&['FIX_REQUIRED','NEEDS_CONTEXT'].includes(task.result.status))}

/**
 * Retire only mission-level artifacts that belonged to a settled task whose canonical ownership
 * has already been satisfied elsewhere. The raw WorkerResult remains immutable historical truth.
 */
export function reconcileSatisfiedTaskArtifacts(m:MissionState,reason='canonical-obligation-closed'):string[]{
  const reconciled:string[]=[]
  for(const task of m.execution.tasks){
    if(!taskHasSatisfiedSettledOwnership(m,task))continue
    const issues=[...(task.result?.open_issues??[])]
    const stillOwned=new Set(m.execution.tasks.filter(other=>other.id!==task.id&&other.status!=='cancelled'&&!taskHasSatisfiedSettledOwnership(m,other)&&other.result?.status!=='DONE').flatMap(other=>other.result?.open_issues??[]))
    const retiredIssues=issues.filter(issue=>!stillOwned.has(issue)&&m.execution.blockers.includes(issue))
    if(retiredIssues.length)m.execution.blockers=m.execution.blockers.filter(blocker=>!retiredIssues.includes(blocker))
    const retiredNeeds=m.methodology.methodology_needs.filter(need=>need.task_id===task.id)
    if(retiredNeeds.length)m.methodology.methodology_needs=m.methodology.methodology_needs.filter(need=>need.task_id!==task.id)
    if(!retiredIssues.length&&!retiredNeeds.length)continue
    reconciled.push(task.id)
    appendLedger(m,'task.satisfied-ownership-reconciled',{task_id:task.id,worker_id:task.worker_id,payload:{reason,raw_task_status:task.status,raw_result_status:task.result?.status,closed_obligations:[...task.obligation_ids],retired_result_issues:retiredIssues.slice(0,30),retired_methodology_needs:[...new Set(retiredNeeds.map(need=>need.name))].slice(0,30)}})
  }
  return reconciled
}
