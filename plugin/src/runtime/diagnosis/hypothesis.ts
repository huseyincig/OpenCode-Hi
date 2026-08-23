import { createHash } from 'node:crypto'
import type { EvidenceItem } from '../../contracts/evidence.js'
import type { MissionState } from '../mission/types.js'

export const DIAGNOSTIC_HYPOTHESIS_OUTCOMES=['SUPPORTED','FALSIFIED','INCONCLUSIVE'] as const
export type DiagnosticHypothesisOutcome=typeof DIAGNOSTIC_HYPOTHESIS_OUTCOMES[number]
export interface DiagnosticHypothesisAssessment{
  id:string
  hypothesis:string
  falsifier:string
  outcome:DiagnosticHypothesisOutcome
  evidence_refs:string[]
  admissible_evidence_refs:string[]
  rejected_evidence_refs:Array<{id:string;reason:string}>
  supported:boolean
}

function clip(value:string,max=1000):string{return value.trim().replace(/\s+/g,' ').slice(0,max)}
function normPath(value:string):string{return value.trim().replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/+$/,'')}
function overlaps(a:string,b:string):boolean{const x=normPath(a),y=normPath(b);return Boolean(x&&y&&(x===y||x.startsWith(`${y}/`)||y.startsWith(`${x}/`)))}
function relevant(m:MissionState,e:EvidenceItem):boolean{
  if(e.obligation_ids?.includes('o-analysis'))return true
  const targets=(m.identity.intent.likelyTargets??[]).map(normPath).filter(Boolean),scope=(e.scope??[]).map(normPath).filter(Boolean)
  if(!targets.length)return scope.length>0||Boolean(e.task_id)||Boolean(e.source_state_hash)
  if(scope.some(file=>targets.some(target=>overlaps(file,target))))return true
  return scope.length===0&&e.trusted_source_class==='host-tool-observation'&&Boolean(e.source_state_hash)&&m.identity.intent.likelyVerification.includes(e.kind)
}
function evidenceReason(m:MissionState,e:EvidenceItem|undefined):string|undefined{
  if(!e)return'unknown-evidence-ref'
  if(e.invalidated_at)return'stale-evidence'
  if(e.outcome==='pending'||e.outcome==='environment-issue'||e.outcome===undefined)return'non-terminal-diagnostic-observation'
  if(!['passed','failed'].includes(e.outcome))return'unsupported-evidence-outcome'
  if(!relevant(m,e))return'evidence-outside-diagnosis-scope'
  return undefined
}
export function diagnosticHypothesisID(m:MissionState,hypothesis:string,falsifier:string):string{
  return `dh_${createHash('sha256').update([m.identity.mission_id,String(m.continuation.generation),clip(hypothesis),clip(falsifier)].join('\0')).digest('hex').slice(0,20)}`
}
export function assessDiagnosticHypothesis(m:MissionState,input:{hypothesis:string;falsifier:string;outcome:DiagnosticHypothesisOutcome;evidence_refs:string[]}):DiagnosticHypothesisAssessment{
  const hypothesis=clip(input.hypothesis),falsifier=clip(input.falsifier),refs=[...new Set(input.evidence_refs.map(x=>String(x).trim()).filter(Boolean))].slice(0,20)
  if(!hypothesis||!falsifier)throw new Error('diagnostic hypothesis and falsifier are required')
  if(!DIAGNOSTIC_HYPOTHESIS_OUTCOMES.includes(input.outcome))throw new Error('invalid diagnostic hypothesis outcome')
  const admissible:string[]=[],rejected:Array<{id:string;reason:string}>=[]
  for(const id of refs){const evidence=m.execution.evidence.items.find(item=>item.id===id),reason=evidenceReason(m,evidence);if(reason)rejected.push({id,reason});else admissible.push(id)}
  return{id:diagnosticHypothesisID(m,hypothesis,falsifier),hypothesis,falsifier,outcome:input.outcome,evidence_refs:refs,admissible_evidence_refs:admissible,rejected_evidence_refs:rejected,supported:input.outcome==='SUPPORTED'&&admissible.length>0&&rejected.length===0}
}
