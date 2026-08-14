export const TEAM_CONTRACT_STATUSES=['active','shutdown'] as const
export type TeamContractStatus=typeof TEAM_CONTRACT_STATUSES[number]

export interface TeamContract{
  team_id:string
  mission_id:string
  generation:number
  member_task_refs:string[]
  member_role_refs:string[]
  capacity:number
  status:TeamContractStatus
  created_at:number
  shutdown_at?:number
}

const KEYS=new Set(['team_id','mission_id','generation','member_task_refs','member_role_refs','capacity','status','created_at','shutdown_at'])
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function finite(v:unknown):v is number{return typeof v==='number'&&Number.isFinite(v)}
function strings(v:unknown):v is string[]{return Array.isArray(v)&&v.every(x=>typeof x==='string'&&Boolean(x))}

export function isTeamContract(v:unknown):v is TeamContract{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k)))return false
  if(typeof v.team_id!=='string'||!/^team_[a-z0-9_]+$/.test(v.team_id)||typeof v.mission_id!=='string'||!v.mission_id)return false
  if(!finite(v.generation)||(v.generation as number)<1||!strings(v.member_task_refs)||!strings(v.member_role_refs))return false
  if(v.member_task_refs.length!==v.member_role_refs.length||v.member_task_refs.length<2)return false
  if(new Set(v.member_task_refs).size!==v.member_task_refs.length)return false
  if(!finite(v.capacity)||(v.capacity as number)<2||(v.capacity as number)<v.member_task_refs.length)return false
  if(!TEAM_CONTRACT_STATUSES.includes(v.status as TeamContractStatus)||!finite(v.created_at)||(v.created_at as number)<=0)return false
  if(v.status==='active'&&v.shutdown_at!==undefined)return false
  if(v.status==='shutdown'&&(!finite(v.shutdown_at)||(v.shutdown_at as number)<(v.created_at as number)))return false
  return true
}
