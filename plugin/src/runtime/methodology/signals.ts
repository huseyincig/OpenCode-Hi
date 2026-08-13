import type { NormalizedMissionIntent } from '../mission/types.js'
import type { HiMethodologySignalName } from '../../generated/methodology-policy.js'

export interface HiMethodologySignal {
  name: HiMethodologySignalName
  reason: string
}

function add(out:HiMethodologySignal[],name:HiMethodologySignalName,reason:string):void{
  if(!out.some(item=>item.name===name))out.push({name,reason})
}

function normPath(value:string):string{return value.trim().replace(/\\/g,'/').replace(/^\.\//,'').toLowerCase()}
function hasPath(files:string[],pattern:RegExp):boolean{return files.some(file=>pattern.test(normPath(file)))}

export function changedSurfaceMethodologySignals(files:string[]):HiMethodologySignal[]{
  const actual=[...new Set(files.map(normPath).filter(Boolean))],out:HiMethodologySignal[]=[]
  if(!actual.length)return out
  if(hasPath(actual,/(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|requirements(?:-[^/]*)?\.txt|pyproject\.toml|poetry\.lock|cargo\.toml|cargo\.lock|go\.mod|go\.sum)$/i))add(out,'surface.dependency','Dependency manifest or lock surface changed.')
  if(hasPath(actual,/(^|\/)(migrations?|schema|database|db)(\/|\.|$)|\.sql$/i))add(out,'surface.migration','Persistent schema, migration, or database surface changed.')
  if(hasPath(actual,/(^|\/)(auth|security|permissions?|oauth|sessions?|credentials?|secrets?)(\/|\.|$)/i))add(out,'surface.security','Security, authority, credential, or trust-boundary surface changed.')
  if(hasPath(actual,/(^|\/)(api|contracts?|schemas?|protocols?)(\/|\.|$)|(^|\/)(openapi|swagger)(\.|\/)|\.(proto|graphql|gql)$/i))add(out,'surface.contract','API/schema/protocol contract surface changed.')
  const uiComponent=/(^|\/)(app|pages?|views?|components?|ui|frontend|web)(\/.*)?\.(tsx|jsx|vue|svelte|html)$/i
  if(hasPath(actual,/(\.css|\.scss|\.sass|\.less)$/i)||hasPath(actual,uiComponent))add(out,'surface.ui-visual','Rendered UI or styling surface changed.')
  if(hasPath(actual,uiComponent))add(out,'surface.ui-markup','User-interface markup/component surface changed.')
  return out
}

export function workerResultMethodologySignals(input:{status:string;needsContext?:string[];contextGap?:'scope'|'iterative'|'none';failureFinding?:'ci-build'|'unknown-root-cause'|'none'}):HiMethodologySignal[]{
  const out:HiMethodologySignal[]=[]
  if(input.status==='NEEDS_CONTEXT'&&(input.needsContext?.length??0)>0){
    add(out,'context.iterative-gap','Worker reported a concrete bounded missing-context requirement.')
    if(input.contextGap==='scope')add(out,'context.scope-gap','Worker explicitly classified the bounded context gap as repository scope/ownership/location related.')
  }
  if(input.failureFinding==='ci-build')add(out,'failure.ci-build','Worker explicitly reported a CI/build failure finding from bounded execution evidence.')
  if(['FIX_REQUIRED','FAILED'].includes(input.status)&&input.failureFinding==='unknown-root-cause')add(out,'failure.unknown-root-cause','Worker explicitly reported that the bounded failure remains without a proven root cause.')
  return out
}

export function verificationMethodologySignals(input:{changed:boolean;scopeExpanded:boolean;riskEscalated:boolean;requireReview:boolean;changedFiles:string[]}):HiMethodologySignal[]{
  const out:HiMethodologySignal[]=[]
  if(!input.changed)return out
  add(out,'verification.strategy','Changed-surface reconciliation materially changed the verification requirement.')
  if(input.scopeExpanded)add(out,'verification.regression','Changed surface expanded beyond the original task scope.')
  if(input.requireReview)add(out,'verification.review','Changed surface requires independent review evidence.')
  if(input.riskEscalated)add(out,'risk.security','Changed surface escalated the mission into security-sensitive risk.')
  const surface=changedSurfaceMethodologySignals(input.changedFiles)
  if(surface.some(item=>item.name==='surface.ui-visual'))add(out,'verification.visual','Changed surface includes rendered UI that requires visual verification.')
  return out
}

export function architectureMethodologySignals(intent:NormalizedMissionIntent):HiMethodologySignal[]{
  const out:HiMethodologySignal[]=[]
  if(intent.ambiguity==='contract-critical')add(out,'architecture.contract-ambiguity','Structured mission state contains unresolved contract-critical ambiguity.')
  if(intent.dependencyClass==='sequential'||intent.dependencyClass==='independent-multi'||intent.scope==='multi-stream')add(out,'architecture.dependency-structure','Structured mission state requires material dependency or multi-stream coordination.')
  return out
}
