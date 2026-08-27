import type { Category, NormalizedMissionIntent } from '../mission/types.js'

export interface CapabilityDecision { role: string; category: Category; capabilities: string[]; reason: string[] }
export interface ProfileSettingsLite { specialistThreshold:'low'|'medium'|'high'; reviewThreshold:'low'|'medium'|'high' }

function categoryFor(intent:NormalizedMissionIntent,preferred?:Category):Category{
  if(preferred)return preferred
  if(intent.risk==='high'||intent.risk==='authority-boundary')return'critical'
  if(intent.scope==='repo-wide')return'deep'
  if(intent.scope==='local'&&intent.risk==='low')return'quick'
  return'standard'
}

/**
 * Canonical child ownership is semantic/capability-derived. Execution category/profile
 * can tune effort, but may not substitute another child role for the semantic owner.
 */
export function routeCapabilities(intent:NormalizedMissionIntent,_profile:ProfileSettingsLite={specialistThreshold:'medium',reviewThreshold:'medium'}):CapabilityDecision{
  const caps=[...new Set(intent.requiredCapabilities)],has=(name:string)=>caps.includes(name),implementation=intent.taskKind==='implementation'||intent.taskKind==='bug-fix'||has('implementation')

  const visual=has('visual-qa')||has('visual-review')
  if(has('security-review')&&intent.taskKind==='review')return{role:'security-reviewer',category:'critical',capabilities:caps,reason:['structured security-review capability dominates this review task; canonical security-review owner']}
  if(visual&&intent.taskKind==='review')return{role:'visual-qa',category:'visual',capabilities:caps,reason:['structured visual-qa capability dominates this review task; canonical visual-qa owner']}
  if(has('external-research')&&!implementation)return{role:'researcher',category:categoryFor(intent,intent.scope==='external'?'deep':undefined),capabilities:caps,reason:['canonical external/reference research owner']}
  if(has('documentation')&&!has('implementation')&&intent.taskKind!=='bug-fix')return{role:'technical-writer',category:categoryFor(intent),capabilities:caps,reason:['canonical documentation authoring owner']}
  if(has('test-authoring')&&!has('implementation')&&intent.taskKind!=='bug-fix')return{role:'test-engineer',category:categoryFor(intent),capabilities:caps,reason:['canonical test-authoring owner']}

  if(intent.taskKind==='analysis'||(!implementation&&(has('repository-analysis')||has('repository-exploration'))))return{role:'repository-explorer',category:intent.scope==='repo-wide'?'deep':'standard',capabilities:caps,reason:['canonical repository analysis/exploration owner']}
  if(intent.taskKind==='diagnosis')return{role:'repository-explorer',category:intent.scope==='repo-wide'?'deep':'standard',capabilities:caps,reason:['canonical repository diagnosis owner']}
  if(intent.taskKind==='bug-fix'&&intent.scope!=='local')return{role:'repository-explorer',category:intent.scope==='repo-wide'?'deep':'standard',capabilities:caps,reason:['broad bug-fix starts with canonical repository diagnosis owner; implementation obligation remains coder-owned']}
  if(has('design-exploration'))return{role:'architect',category:categoryFor(intent,intent.risk==='high'?'critical':'deep'),capabilities:caps,reason:['canonical architecture/design owner']}
  if((intent.taskKind==='review'||has('review')||has('qa-review')||has('independent-review'))&&!implementation)return{role:'qa-reviewer',category:categoryFor(intent,intent.risk==='high'?'critical':'standard'),capabilities:caps,reason:['canonical independent QA/review owner']}
  if(intent.taskKind==='performance'&&intent.scope==='repo-wide')return{role:'architect',category:'deep',capabilities:caps,reason:['repo-wide performance analysis requires system-context owner']}
  if(intent.scope==='repo-wide'&&!implementation)return{role:'repository-explorer',category:categoryFor(intent,'deep'),capabilities:caps,reason:['canonical repo-wide context owner']}
  if(intent.taskKind==='release-readiness')return{role:'qa-reviewer',category:'critical',capabilities:caps,reason:['release-readiness child work is independent verification/review']}
  if(implementation||intent.taskKind==='performance')return{role:'coder',category:categoryFor(intent),capabilities:caps,reason:['canonical production implementation/refactor/bug-fix owner']}

  throw new Error(`Unsupported task semantics: no canonical role owner for taskKind=${intent.taskKind}; capabilities=${caps.join(',')||'none'}`)
}
