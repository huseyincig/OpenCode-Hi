import type { MissionGate, MissionState } from '../mission/types.js'
import { verificationClaimsSatisfied,reviewClaimsSatisfied } from '../verification/policy.js'
import { explorationClearanceFreshness } from '../execution/exploration-clearance.js'
function upsert(m:MissionState,id:string,kind:MissionGate['kind'],summary:string,status:MissionGate['status'],reason?:string):void{const now=Date.now();const existing=m.execution.gates.find(g=>g.id===id);if(existing){existing.kind=kind;existing.summary=summary;existing.status=status;existing.reason=reason;existing.updated_at=now}else m.execution.gates.push({id,kind,summary,status,reason,updated_at:now})}
export interface MissionGateClaims{verification:ReturnType<typeof verificationClaimsSatisfied>;review:ReturnType<typeof reviewClaimsSatisfied>}
export function syncMissionGates(m:MissionState,projectRoot?:string,claims?:MissionGateClaims):MissionGate[]{
  m.execution.gates??=[]
  const semanticPending=m.identity.semantic_assessment?.status!=='assessed'
  upsert(m,'gate-semantic-assessment','precondition','Natural-language intent must be normalized into the host-agnostic Hi semantic contract before execution',semanticPending?'blocked':'closed',semanticPending?'semantic-assessment-pending':undefined)
  const authorityOpen=m.execution.obligations.some(o=>o.kind==='authority'&&o.status!=='closed')||Boolean(m.authority.authority?.pending||m.authority.authority?.executing)
  upsert(m,'gate-authority','user-authority','Privileged external effect requires exact authority and confirmed completion',authorityOpen?(m.authority.authority?.approved?'ready':'blocked'):'closed',authorityOpen?'authority-open':undefined)
  const verificationObligations=m.execution.obligations.filter(o=>o.kind==='verification'),verifyOpen=verificationObligations.some(o=>o.status!=='closed'),verify=claims?.verification??verificationClaimsSatisfied(m,projectRoot)
  upsert(m,'gate-verification','verification','Required verification evidence must be fresh and policy-complete',verificationObligations.length?(verify.ok?(verifyOpen?'ready':'closed'):'open'):'closed',verificationObligations.length&&!verify.ok?verify.missing.join(','):undefined)
  const implementationOpen=m.execution.obligations.some(o=>o.kind==='implementation'&&o.status==='open'),ambiguity=m.identity.intent.ambiguity==='contract-critical'&&implementationOpen
  upsert(m,'gate-contract-ambiguity','precondition','Contract-critical ambiguity must be resolved from repo/evidence before implementation',ambiguity?'blocked':'closed',ambiguity?'contract-critical-ambiguity':undefined)
  const existingClearance=m.execution.gates.find(g=>g.id==='gate-exploration-clearance')
  if(!implementationOpen)upsert(m,'gate-exploration-clearance','precondition','Previously admitted repository exploration must remain fresh before implementation','closed')
  else if(projectRoot){const clearance=explorationClearanceFreshness(projectRoot,m),stale=clearance.required&&!clearance.current,scope=clearance.source_scope.slice(0,8).join(',')||'unknown-scope';upsert(m,'gate-exploration-clearance','precondition','Previously admitted repository exploration must remain fresh before implementation',stale?'blocked':'closed',stale?`exploration-clearance-${clearance.reason}:${scope}`:undefined)}
  else if(!existingClearance)upsert(m,'gate-exploration-clearance','precondition','Previously admitted repository exploration must remain fresh before implementation','closed')
  const reviewRequired=m.execution.verification_policy.requireReview,reviewObligations=m.execution.obligations.filter(o=>o.kind==='review'),reviewOpen=reviewObligations.some(o=>o.status!=='closed'),review=claims?.review??reviewClaimsSatisfied(m,projectRoot);upsert(m,'gate-reviewer','reviewer','Required independent review must be completed',reviewRequired?(review.ok?(reviewOpen?'ready':'closed'):'open'):'closed',reviewRequired&&!review.ok?`review-claims:${review.missing.join(',')}`:undefined)
  const prereq=m.execution.tasks.filter(t=>t.dependencies.some(id=>m.execution.tasks.find(x=>x.id===id)?.status!=='completed')&&!['completed','failed','cancelled'].includes(t.status));upsert(m,'gate-prerequisites','prerequisite-task','Task prerequisites must complete before dependent worker dispatch',prereq.length?'open':'closed',prereq.length?`waiting:${prereq.map(t=>t.id).join(',')}`:undefined)
  const rollbackOpen=(m.vcs.temporary_mutations??[]).some(x=>x.status==='active'||x.status==='failed');upsert(m,'gate-temporary-rollback','rollback','Temporary execution mutations must be deterministically rolled back',rollbackOpen?'blocked':'closed',rollbackOpen?'temporary-mutation-open':undefined)
  return m.execution.gates
}
