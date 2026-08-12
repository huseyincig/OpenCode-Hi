import type { MissionGate, MissionState } from '../mission/types.js'
import { verificationSatisfied } from '../verification/policy.js'
function upsert(m:MissionState,id:string,kind:MissionGate['kind'],summary:string,status:MissionGate['status'],reason?:string):void{const now=Date.now();const existing=m.gates.find(g=>g.id===id);if(existing){existing.kind=kind;existing.summary=summary;existing.status=status;existing.reason=reason;existing.updated_at=now}else m.gates.push({id,kind,summary,status,reason,updated_at:now})}
export function syncMissionGates(m:MissionState):MissionGate[]{
  m.gates??=[]
  const authorityOpen=m.obligations.some(o=>o.kind==='authority'&&o.status!=='closed')||Boolean(m.authority?.pending||m.authority?.executing)
  upsert(m,'gate-authority','user-authority','Privileged external effect requires exact authority and confirmed completion',authorityOpen?(m.authority?.approved?'ready':'blocked'):'closed',authorityOpen?'authority-open':undefined)
  const verifyOpen=m.obligations.some(o=>o.kind==='verification'&&o.status!=='closed');const verify=verificationSatisfied(m)
  upsert(m,'gate-verification','verification','Required verification evidence must be fresh and policy-complete',verifyOpen?(verify.ok?'ready':'open'):'closed',verifyOpen&&!verify.ok?verify.missing.join(','):undefined)
  const ambiguity=m.intent.ambiguity==='contract-critical'&&m.obligations.some(o=>o.kind==='implementation'&&o.status==='open')
  upsert(m,'gate-contract-ambiguity','precondition','Contract-critical ambiguity must be resolved from repo/evidence before implementation',ambiguity?'blocked':'closed',ambiguity?'contract-critical-ambiguity':undefined)
  const reviewOpen=m.obligations.some(o=>o.kind==='review'&&o.status!=='closed'),independentReviewOpen=m.verification_policy.requireReview&&reviewOpen;upsert(m,'gate-reviewer','reviewer','Required independent review must be completed',independentReviewOpen?'open':'closed',independentReviewOpen?'review-obligation-open':undefined)
  const prereq=m.tasks.filter(t=>t.dependencies.some(id=>m.tasks.find(x=>x.id===id)?.status!=='completed')&&!['completed','failed','cancelled'].includes(t.status));upsert(m,'gate-prerequisites','prerequisite-task','Task prerequisites must complete before dependent worker dispatch',prereq.length?'open':'closed',prereq.length?`waiting:${prereq.map(t=>t.id).join(',')}`:undefined)
  const rollbackOpen=(m.temporary_mutations??[]).some(x=>x.status==='active'||x.status==='failed');upsert(m,'gate-temporary-rollback','rollback','Temporary execution mutations must be deterministically rolled back',rollbackOpen?'blocked':'closed',rollbackOpen?'temporary-mutation-open':undefined)
  return m.gates
}
