export const EXTERNAL_ACTION_TYPES=['git-push','release-create','package-publish','deploy'] as const
export type ExternalActionType=typeof EXTERNAL_ACTION_TYPES[number]

export interface ExternalActionContract{
  action_type:ExternalActionType
  target:string
  requested_explicitly:boolean
  required_authority_ref:string
  executor:string
  result_evidence_ref?:string
}

const ACTIONS=new Set<string>(EXTERNAL_ACTION_TYPES)
const KEYS=new Set(['action_type','target','requested_explicitly','required_authority_ref','executor','result_evidence_ref'])
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function nonempty(v:unknown):v is string{return typeof v==='string'&&Boolean(v.trim())}
export function isExternalActionType(v:unknown):v is ExternalActionType{return typeof v==='string'&&ACTIONS.has(v)}
export function isExternalActionContract(v:unknown):v is ExternalActionContract{
  return record(v)&&Object.keys(v).every(k=>KEYS.has(k))&&isExternalActionType(v.action_type)&&nonempty(v.target)&&typeof v.requested_explicitly==='boolean'&&nonempty(v.required_authority_ref)&&nonempty(v.executor)&&(v.result_evidence_ref===undefined||nonempty(v.result_evidence_ref))
}

export function externalActionTypeFromTechnicalKind(kind:string):ExternalActionType|undefined{
  if(kind==='git-push')return'git-push'
  if(kind==='gh-release-create')return'release-create'
  if(kind==='package-publish')return'package-publish'
  if(['docker-push','kubectl-mutate','terraform-apply','vercel-deploy','netlify-deploy'].includes(kind))return'deploy'
  return undefined
}
