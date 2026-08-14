import type { ExternalActionType } from './external-action.js'

export interface ExactAuthorityActionContract{
  authority_id:string
  action_type:ExternalActionType
  target:{cwd:string;command:string}
  action:string
  hash:string
  requested_by:'mission-parent'
  required_reason:'privileged-external-effect'
  one_shot:true
}
export interface PendingAuthorityState{hash:string;action:string;created_at:number}
export interface ApprovedAuthorityState{hash:string;approved_at:number}
export interface ExecutingAuthorityState{hash:string;action:string;started_at:number}
export interface AuthorityStateContract{
  pending?:PendingAuthorityState
  approved?:ApprovedAuthorityState
  executing?:ExecutingAuthorityState
  completed_hashes?:string[]
}

const STATE_KEYS=new Set(['pending','approved','executing','completed_hashes'])
const PENDING_KEYS=new Set(['hash','action','created_at']),APPROVED_KEYS=new Set(['hash','approved_at']),EXECUTING_KEYS=new Set(['hash','action','started_at'])
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function hash(v:unknown):v is string{return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)}
function finitePositive(v:unknown):v is number{return typeof v==='number'&&Number.isFinite(v)&&v>0}
function action(v:unknown):v is string{return typeof v==='string'&&/^cwd=[^\n]*\ncommand=\S[\s\S]*$/.test(v)}
function pending(v:unknown):v is PendingAuthorityState{return record(v)&&Object.keys(v).every(k=>PENDING_KEYS.has(k))&&hash(v.hash)&&action(v.action)&&finitePositive(v.created_at)}
function approved(v:unknown):v is ApprovedAuthorityState{return record(v)&&Object.keys(v).every(k=>APPROVED_KEYS.has(k))&&hash(v.hash)&&finitePositive(v.approved_at)}
function executing(v:unknown):v is ExecutingAuthorityState{return record(v)&&Object.keys(v).every(k=>EXECUTING_KEYS.has(k))&&hash(v.hash)&&action(v.action)&&finitePositive(v.started_at)}
export function isAuthorityStateContract(v:unknown):v is AuthorityStateContract{
  if(!record(v)||!Object.keys(v).every(k=>STATE_KEYS.has(k)))return false
  if(v.pending!==undefined&&!pending(v.pending))return false
  if(v.approved!==undefined&&!approved(v.approved))return false
  if(v.executing!==undefined&&!executing(v.executing))return false
  if([v.pending,v.approved,v.executing].filter(x=>x!==undefined).length>1)return false
  if(v.completed_hashes!==undefined&&(!Array.isArray(v.completed_hashes)||v.completed_hashes.length>64||!v.completed_hashes.every(hash)||new Set(v.completed_hashes).size!==v.completed_hashes.length))return false
  return true
}
