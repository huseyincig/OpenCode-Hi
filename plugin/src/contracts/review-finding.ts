import { WORKER_EVIDENCE_KINDS,type WorkerEvidenceKind } from './evidence-kinds.js'

export type ReviewFindingSeverity='info'|'low'|'medium'|'high'|'critical'
export type ReviewFindingCausality='introduced'|'worsened'|'pre-existing'|'unknown'
export type ReviewFindingConfidence='low'|'medium'|'high'
export type ReviewFindingDisposition='open'|'resolved'|'rejected'|'parked'

export interface ReviewFinding {
  id:string
  reviewer_role:string
  subject:string
  severity:ReviewFindingSeverity
  causality:ReviewFindingCausality
  scope:string[]
  evidence_refs:WorkerEvidenceKind[]
  confidence:ReviewFindingConfidence
  disposition:ReviewFindingDisposition
  blocking:boolean
}

const ID=/^rf-[a-z0-9][a-z0-9-]{0,79}$/
const ROLE=/^[a-z][a-z0-9-]{1,63}$/
const EVIDENCE=new Set<string>(WORKER_EVIDENCE_KINDS)
const SEVERITY=new Set(['info','low','medium','high','critical'])
const CAUSALITY=new Set(['introduced','worsened','pre-existing','unknown'])
const CONFIDENCE=new Set(['low','medium','high'])
const DISPOSITION=new Set(['open','resolved','rejected','parked'])
const KEYS=new Set(['id','reviewer_role','subject','severity','causality','scope','evidence_refs','confidence','disposition','blocking'])
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function strings(v:unknown):v is string[]{return Array.isArray(v)&&v.every(x=>typeof x==='string')}

export function isReviewFindingContract(v:unknown):v is ReviewFinding{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k)))return false
  if(typeof v.id!=='string'||!ID.test(v.id)||typeof v.reviewer_role!=='string'||!ROLE.test(v.reviewer_role)||typeof v.subject!=='string'||!v.subject.trim()||v.subject.length>1200)return false
  if(typeof v.severity!=='string'||!SEVERITY.has(v.severity)||typeof v.causality!=='string'||!CAUSALITY.has(v.causality)||typeof v.confidence!=='string'||!CONFIDENCE.has(v.confidence)||typeof v.disposition!=='string'||!DISPOSITION.has(v.disposition)||typeof v.blocking!=='boolean')return false
  if(!strings(v.scope)||v.scope.length>50||!strings(v.evidence_refs)||v.evidence_refs.length>20||!v.evidence_refs.every(x=>EVIDENCE.has(x)))return false
  if(v.blocking&&v.evidence_refs.length===0)return false
  return true
}

export function reviewFindingNeedsCorrection(f:ReviewFinding):boolean{return f.disposition==='open'&&f.blocking&&(f.causality==='introduced'||f.causality==='worsened')}
export function reviewFindingMarker(f:ReviewFinding):string{return`review-finding:${f.id}:${f.severity}:${f.causality}`}
