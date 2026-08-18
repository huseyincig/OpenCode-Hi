import type { HiMethodologySignalName } from '../../generated/methodology-policy.js'
import { HI_METHODOLOGY_SIGNAL_CATALOG } from '../../generated/methodology-policy.js'
import type { NormalizedMissionIntent, Risk } from '../mission/types.js'
import type { RepoContext } from './repo-context.js'
import { normalizeBoundedProjectPath } from '../../contracts/common.js'

export type SemanticMessageKind='mission'|'amendment'|'constraint'|'verification'|'stop'|'resume'|'non-material'
export const SEMANTIC_CAPABILITIES=['implementation','repository-analysis','review','verification','independent-review','security-review','visual-qa','design-exploration','multi-stream-delegation','source-verification','qa-review','dependency-change'] as const
export type SemanticCapability=typeof SEMANTIC_CAPABILITIES[number]
export const SEMANTIC_EXTERNAL_ACTIONS=['git-push','release-create','package-publish','deploy'] as const
export type SemanticExternalAction=typeof SEMANTIC_EXTERNAL_ACTIONS[number]
export const SEMANTIC_VERIFICATION_KINDS=['targeted-tests','typecheck','lint','build','changed-surface-sanity','visual-check','review-evidence'] as const
export type SemanticVerificationKind=typeof SEMANTIC_VERIFICATION_KINDS[number]
export interface SemanticIntentAssessment{
  material:boolean
  message_kind:SemanticMessageKind
  task_kind:'implementation'|'bug-fix'|'review'|'performance'|'release-readiness'
  scope:'local'|'multi-file'|'repo-wide'|'external'|'multi-stream'
  risk:Risk
  ambiguity:'none'|'resolvable'|'contract-critical'
  dependency_class:'independent'|'sequential'|'external-gated'|'unknown'|'independent-multi'
  required_capabilities:SemanticCapability[]
  requested_external_actions:SemanticExternalAction[]
  likely_verification:SemanticVerificationKind[]
  user_verification:SemanticVerificationKind[]
  verification_ceiling:boolean
  likely_targets:string[]
  intent_signals:HiMethodologySignalName[]
  suppressed_intent_signals:HiMethodologySignalName[]
}

const PATH=/((?:[\w@.-]+\/[\w@./-]+|[\w@.-]+\.(?:tsx|jsx|json|scss|html|yaml|toml|sql|ts|js|py|go|rs|php|md|css|yml)))(?![\w.-])/gi
const HTTP_TARGET=/^https?:\/\/[^\s]+$/i
const TECHNICAL_VERIFIER_PATTERNS:ReadonlyArray<[SemanticVerificationKind,RegExp]>=[
  ['targeted-tests',/\b(?:(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?test(?:\b|:))|node\s+--test\b|(?:python(?:3)?\s+-m\s+)?pytest\b|vitest\b|jest\b|go\s+test\b|cargo\s+test\b|dotnet\s+test\b|mvnw?\s+[^`\n;]*\btest\b|(?:gradle|\.\/gradlew)\s+[^`\n;]*\btest\b)/i],
  ['typecheck',/\b(?:(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?(?:typecheck|type-check|check:types?)(?:\b|:))|(?:npx\s+)?tsc\b|(?:python(?:3)?\s+-m\s+)?(?:mypy|pyright)\b)/i],
  ['lint',/\b(?:(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?lint(?:\b|:))|(?:npx\s+)?eslint\b|(?:python(?:3)?\s+-m\s+)?ruff(?:\s+check)?\b)/i],
  ['build',/\b(?:(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?build(?:\b|:))|cargo\s+check\b|go\s+build\b|dotnet\s+build\b)/i],
  ['changed-surface-sanity',/\b(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?check(?:\b|:))/i],
]
export function technicalTargets(text:string):string[]{return[...text.matchAll(PATH)].map(m=>m[1]).filter(Boolean).slice(0,12)}
export function technicalVerificationKinds(text:string):SemanticVerificationKind[]{return TECHNICAL_VERIFIER_PATTERNS.filter(([,pattern])=>pattern.test(text)).map(([kind])=>kind)}
export function semanticTargets(value:unknown,max=20):string[]{
  const out:string[]=[]
  for(const raw of stringList(value,max)){
    if(HTTP_TARGET.test(raw)){out.push(raw);continue}
    const exact=normalizeBoundedProjectPath(raw)
    if(exact&&technicalTargets(raw).some(x=>x===raw||x===exact)){out.push(exact);continue}
    for(const candidate of technicalTargets(raw)){const path=normalizeBoundedProjectPath(candidate);if(path)out.push(path)}
  }
  return[...new Set(out)].slice(0,max)
}
export function provisionalIntent(text:string,repo?:RepoContext):NormalizedMissionIntent{
  const objective=text.trim().replace(/\s+/g,' '),targets=technicalTargets(text),explicitVerification=technicalVerificationKinds(text)
  const avoid=['unnecessary-agents','unnecessary-skills','full-chat-child-context','unrequested-external-effects']
  if(repo?.ecosystems.length)avoid.push(`ignore-repo-ecosystem:${repo.ecosystems.join('+')}`)
  return{objective,likelyTargets:targets.length?targets:undefined,taskKind:'unclassified',scope:'local',risk:'medium',ambiguity:'resolvable',dependencyClass:'unknown',requiredCapabilities:[],requestedExternalActions:[],likelyVerification:explicitVerification,avoid}
}
function stringList(value:unknown,max=40):string[]{return Array.isArray(value)?[...new Set(value.filter(x=>typeof x==='string').map(x=>String(x).trim()).filter(Boolean))].slice(0,max):[]}
function enumList<T extends readonly string[]>(value:unknown,allowed:T,max=40):T[number][]{const items=stringList(value,max),set=new Set<string>(allowed),unknown=items.filter(x=>!set.has(x));if(unknown.length)throw new Error(`unsupported semantic enum value(s): ${unknown.join(', ')}`);return items as T[number][]}
function intentSignalList(value:unknown):HiMethodologySignalName[]{
  const items=stringList(value,40),invalid=items.filter(name=>{
    const spec=(HI_METHODOLOGY_SIGNAL_CATALOG as Record<string,{producers:readonly string[]}>)[name]
    return !name.startsWith('intent.')||!spec?.producers.includes('intent')
  })
  if(invalid.length)throw new Error(`unsupported semantic intent signal(s): ${invalid.join(', ')}`)
  return items as HiMethodologySignalName[]
}
export function parseSemanticIntentAssessment(raw:unknown):SemanticIntentAssessment{
  const x=typeof raw==='string'?JSON.parse(raw):raw
  if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('semantic assessment must be a JSON object')
  const v=x as Record<string,unknown>
  const taskKinds=['implementation','bug-fix','review','performance','release-readiness'] as const
  const scopes=['local','multi-file','repo-wide','external','multi-stream'] as const
  const risks=['low','medium','high','authority-boundary'] as const
  const ambiguities=['none','resolvable','contract-critical'] as const
  const dependencies=['independent','sequential','external-gated','unknown','independent-multi'] as const
  const take=<T extends readonly string[]>(name:string,allowed:T):T[number]=>{const value=String(v[name]??'');if(!(allowed as readonly string[]).includes(value))throw new Error(`${name} must be one of ${allowed.join(', ')}`);return value as T[number]}
  if(typeof v.material!=='boolean')throw new Error('material must be boolean')
  const messageKinds=['mission','amendment','constraint','verification','stop','resume','non-material'] as const
  const messageKind=take('message_kind',messageKinds)
  if(messageKind==='non-material'&&v.material!==false)throw new Error('non-material message must set material=false')
  if(messageKind!=='non-material'&&v.material!==true)throw new Error('material message kind must set material=true')
  const risk=take('risk',risks),externalActions=enumList(v.requested_external_actions,SEMANTIC_EXTERNAL_ACTIONS,8)
  if(externalActions.length&&risk!=='authority-boundary')throw new Error('requested_external_actions require risk=authority-boundary')
  if(v.verification_ceiling!==undefined&&typeof v.verification_ceiling!=='boolean')throw new Error('verification_ceiling must be boolean')
  const inferredVerification=enumList(v.likely_verification,SEMANTIC_VERIFICATION_KINDS,12),userVerification=enumList(v.user_verification,SEMANTIC_VERIFICATION_KINDS,12),verificationCeiling=v.verification_ceiling===true
  if(verificationCeiling&&!userVerification.length)throw new Error('verification_ceiling requires at least one explicit user_verification kind')
  const effectiveVerification=verificationCeiling?userVerification:[...new Set([...userVerification,...inferredVerification])]
  const assessment:SemanticIntentAssessment={
    material:v.material,message_kind:messageKind,
    task_kind:take('task_kind',taskKinds),scope:take('scope',scopes),risk,ambiguity:take('ambiguity',ambiguities),dependency_class:take('dependency_class',dependencies),
    required_capabilities:enumList(v.required_capabilities,SEMANTIC_CAPABILITIES),requested_external_actions:externalActions,likely_verification:effectiveVerification,user_verification:userVerification,verification_ceiling:verificationCeiling,likely_targets:semanticTargets(v.likely_targets,20),
    intent_signals:intentSignalList(v.intent_signals),suppressed_intent_signals:intentSignalList(v.suppressed_intent_signals),
  }
  const boundedSingleTargetBugFix=assessment.task_kind==='bug-fix'&&assessment.scope==='multi-file'&&assessment.risk==='low'&&assessment.ambiguity==='none'&&assessment.dependency_class==='sequential'&&assessment.likely_targets.length===1&&assessment.likely_verification.length>0&&!assessment.required_capabilities.some(cap=>['multi-stream-delegation','source-verification','dependency-change','design-exploration'].includes(cap))
  if(boundedSingleTargetBugFix)throw new Error('semantic assessment is incoherent: sequential multi-file bug-fix requires multiple material ordered work units; one implementation target plus verification/read-only files is not a sequential multi-file dependency')
  return assessment
}
export function assessedIntent(current:NormalizedMissionIntent,assessment:SemanticIntentAssessment):NormalizedMissionIntent{
  return{...current,likelyTargets:assessment.likely_targets.length?assessment.likely_targets:current.likelyTargets,taskKind:assessment.task_kind,scope:assessment.scope,risk:assessment.risk,ambiguity:assessment.ambiguity,dependencyClass:assessment.dependency_class,requiredCapabilities:[...assessment.required_capabilities],requestedExternalActions:[...assessment.requested_external_actions],likelyVerification:[...assessment.likely_verification]}
}
