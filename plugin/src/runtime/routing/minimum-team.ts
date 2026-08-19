import type { NormalizedMissionIntent, VerificationPolicy, PrimaryMode } from '../mission/types.js'

export interface MinimumTeamDecision { primary:PrimaryMode; direct:boolean; roles:string[]; reason:string[] }

export function minimumTeamFor(intent:NormalizedMissionIntent, verification?:VerificationPolicy, primaryMode:'auto'|PrimaryMode='auto'):MinimumTeamDecision{
  const caps=new Set(intent.requiredCapabilities)
  const reviewRequired=verification?.requireReview===true||intent.risk==='high'
  const localImplementation=intent.scope==='local'&&intent.risk==='low'&&intent.taskKind==='implementation'&&!caps.has('visual-qa')&&!caps.has('design-exploration')
  const localReview=intent.scope==='local'&&intent.risk==='low'&&intent.taskKind==='review'&&!reviewRequired
  const localDiagnosis=intent.scope==='local'&&intent.risk==='low'&&intent.taskKind==='diagnosis'
  if(localImplementation||localReview||localDiagnosis){const primary=primaryMode==='auto'?'working-manager':primaryMode;const reason=localReview?'local low-risk review is directly evidentiary':localDiagnosis?'local low-risk diagnosis is directly evidentiary':'local low-risk change is directly executable';return{primary,direct:primary==='working-manager',roles:[],reason:[reason,'minimum-team:0-child',primaryMode==='auto'?'primary:auto-working-manager':`primary:forced-${primary}`]}}
  const roles:string[]=[]
  const implementation=!['diagnosis','review','release-readiness'].includes(intent.taskKind)
  if(intent.scope==='repo-wide'&&caps.has('design-exploration'))roles.push('architect')
  if((intent.taskKind==='bug-fix'||intent.taskKind==='diagnosis')&&intent.scope!=='local')roles.push('repository-explorer')
  if(implementation)roles.push('coder')
  if(caps.has('visual-qa'))roles.push('visual-qa')
  if(caps.has('security-review')&&reviewRequired)roles.push('security-reviewer')
  else if(intent.taskKind==='review'&&reviewRequired)roles.push('qa-reviewer')
  const unique=[...new Set(roles)]
  const primary:PrimaryMode=primaryMode==='auto'?'working-manager':primaryMode
  return{primary,direct:false,roles:unique,reason:[`minimum-team:${unique.length}-child`,reviewRequired?'independent-review-required':'deterministic-evidence-preferred',primaryMode==='auto'?'primary:auto-working-manager':`primary:forced-${primary}`]}
}
