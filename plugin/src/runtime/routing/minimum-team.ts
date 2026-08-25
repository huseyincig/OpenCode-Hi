import type { NormalizedMissionIntent, VerificationPolicy, PrimaryMode } from '../mission/types.js'

export interface MinimumTeamDecision { primary:PrimaryMode; direct:boolean; roles:string[]; reason:string[] }

export function minimumTeamFor(intent:NormalizedMissionIntent,verification?:VerificationPolicy,primaryMode:'auto'|PrimaryMode='auto'):MinimumTeamDecision{
  const caps=new Set(intent.requiredCapabilities),reviewRequired=verification?.requireReview===true||intent.risk==='high',primary:PrimaryMode=primaryMode==='auto'?'working-manager':primaryMode
  const specialistMutation=caps.has('documentation')||caps.has('test-authoring'),localImplementation=intent.scope==='local'&&intent.risk==='low'&&intent.taskKind==='implementation'&&!caps.has('visual-qa')&&!caps.has('design-exploration')&&!caps.has('external-research')&&!specialistMutation
  const localReview=intent.scope==='local'&&intent.risk==='low'&&intent.taskKind==='review'&&!reviewRequired&&!caps.has('visual-qa')&&!caps.has('security-review'),localDiagnosis=intent.scope==='local'&&intent.risk==='low'&&intent.taskKind==='diagnosis'
  if(localImplementation||localReview||localDiagnosis){
    const reason=localReview?'local low-risk review is directly evidentiary':localDiagnosis?'local low-risk diagnosis is directly evidentiary':'local low-risk change is directly executable'
    if(primary==='manager'&&localImplementation)return{primary,direct:false,roles:['coder'],reason:[reason,'minimum-team:1-child','read-only-manager-requires-coder','primary:forced-manager']}
    return{primary,direct:primary==='working-manager',roles:[],reason:[reason,'minimum-team:0-child',primaryMode==='auto'?'primary:auto-working-manager':`primary:forced-${primary}`]}
  }

  const roles:string[]=[]
  const productionImplementation=caps.has('implementation')||intent.taskKind==='bug-fix'||intent.taskKind==='performance'||(intent.taskKind==='implementation'&&!specialistMutation&&!caps.has('external-research'))
  if(caps.has('external-research'))roles.push('researcher')
  if(caps.has('design-exploration'))roles.push('architect')
  if((intent.taskKind==='diagnosis'||caps.has('repository-analysis'))&&intent.scope!=='local')roles.push('repository-explorer')
  if(productionImplementation)roles.push('coder')
  if(caps.has('documentation'))roles.push('technical-writer')
  if(caps.has('test-authoring'))roles.push('test-engineer')
  if(caps.has('visual-qa'))roles.push('visual-qa')
  if(caps.has('security-review')&&(reviewRequired||intent.taskKind==='review'))roles.push('security-reviewer')
  else if((intent.taskKind==='review'||caps.has('independent-review')||caps.has('qa-review'))&&reviewRequired)roles.push('qa-reviewer')
  const unique=[...new Set(roles)]
  return{primary,direct:false,roles:unique,reason:[`minimum-team:${unique.length}-child`,'roles-derived-from-semantic-obligations',reviewRequired?'independent-review-required':'deterministic-evidence-preferred',primaryMode==='auto'?'primary:auto-working-manager':`primary:forced-${primary}`]}
}
