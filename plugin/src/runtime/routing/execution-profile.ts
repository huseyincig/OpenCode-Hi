export type NativePermissionDecision='allow'|'ask'|'deny'|'unknown'

function isRecord(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function decision(raw:unknown):NativePermissionDecision{
  if(raw==='allow'||raw==='ask'||raw==='deny')return raw
  if(isRecord(raw)){
    const star=raw['*'];if(star==='allow'||star==='ask'||star==='deny')return star
    const values=Object.values(raw)
    if(values.some(v=>v==='allow'))return'allow'
    if(values.some(v=>v==='ask'))return'ask'
    if(values.length&&values.every(v=>v==='deny'))return'deny'
  }
  return'unknown'
}

const TOOL_KEYS=['read','glob','grep','list','lsp','bash','edit','skill','todowrite','webfetch','websearch','question','task','external_directory'] as const
const PERMISSION_TO_TOOLS:Record<string,string[]>={read:['read'],glob:['glob'],grep:['grep'],list:['list'],lsp:['lsp'],bash:['bash'],edit:['edit','write','apply_patch'],skill:['skill'],todowrite:['todowrite','todoread'],webfetch:['webfetch'],websearch:['websearch'],question:['question'],task:['task']}

export interface NativePermissionSnapshot{mode?:string;decisions:Record<string,NativePermissionDecision>;source:'effective-opencode-agent'|'hhc-default-invariants'}
export interface EffectiveExecutionSurface{tools:string[];permissions:NativePermissionSnapshot}

export function effectiveExecutionSurface(hostConfig:Record<string,unknown>,role:string,skillToolEnabled:boolean):EffectiveExecutionSurface{
  const agents=isRecord(hostConfig.agent)?hostConfig.agent:{}
  const def=isRecord(agents[role])?agents[role] as Record<string,unknown>:undefined
  const permission=def&&isRecord(def.permission)?def.permission:{}
  const globalTools=isRecord(hostConfig.tools)?hostConfig.tools:{}
  const roleTools=def&&isRecord(def.tools)?def.tools:{}
  const decisions:Record<string,NativePermissionDecision>={}
  for(const key of TOOL_KEYS)decisions[key]=decision(permission[key])
  // HHC owns orchestration policy, while OpenCode owns enforcement. Persist both the
  // observed effective decisions and the invariants HHC depends on.
  decisions.task='deny'
  const tools:string[]=[]
  for(const key of TOOL_KEYS){
    if(key==='task')continue
    if(key==='skill'&&!skillToolEnabled)continue
    if(globalTools[key]===false||roleTools[key]===false)continue
    if(decisions[key]==='deny')continue
    if(['external_directory'].includes(key))continue
    tools.push(...(PERMISSION_TO_TOOLS[key]??[key]))
  }
  return{tools:[...new Set(tools)].sort(),permissions:{mode:def?.mode?String(def.mode):undefined,decisions,source:def?'effective-opencode-agent':'hhc-default-invariants'}}
}

export const HHC_CONTROL_TOOL_IDS=['hhc_doctor','hhc_status','hhc_metrics','hhc_ledger','hhc_readiness','hhc_context_artifact_add','hhc_context_artifacts','hhc_temporary_mutation_register','hhc_temporary_mutation_revert','hhc_direct_progress','hhc_task_start','hhc_task_await','hhc_task_peek','hhc_task_list','hhc_task_cancel','hhc_team_create','hhc_team_message','hhc_team_inbox','hhc_team_message_ack','hhc_team_member_add','hhc_team_member_remove','hhc_team_status','hhc_team_board','hhc_team_shutdown'] as const
export const KNOWN_BUILTIN_TOOL_IDS=['bash','edit','write','apply_patch','read','grep','glob','list','lsp','skill','todowrite','todoread','webfetch','websearch','question','task'] as const
export function promptToolOverrides(allowed:string[],hhcToolNames:string[]=[...HHC_CONTROL_TOOL_IDS]):Record<string,boolean>{const keep=new Set(allowed);const out:Record<string,boolean>={};for(const id of KNOWN_BUILTIN_TOOL_IDS)if(!keep.has(id))out[id]=false;for(const id of hhcToolNames)out[id]=false;return out}
