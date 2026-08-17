import { HI_BROWSER_EXECUTION_TOOL_IDS } from '../browser/executor.js'
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

export const HI_ACCOUNTED_PERMISSION_KEYS=['read','glob','grep','list','lsp','bash','edit','skill','todowrite','webfetch','websearch','question','task','external_directory'] as const
const TOOL_KEYS=HI_ACCOUNTED_PERMISSION_KEYS
const PERMISSION_TO_TOOLS:Record<string,string[]>={read:['read'],glob:['glob'],grep:['grep'],list:['list'],lsp:['lsp'],bash:['bash'],edit:['edit','write','apply_patch'],skill:['skill'],todowrite:['todowrite','todoread'],webfetch:['webfetch'],websearch:['websearch'],question:['question'],task:['task']}

export function unaccountedExecutionPermissionKeys(hostConfig:Record<string,unknown>,role:string):string[]{
  const agents=isRecord(hostConfig.agent)?hostConfig.agent:{}
  const def=isRecord(agents[role])?agents[role] as Record<string,unknown>:undefined
  const permission=def&&isRecord(def.permission)?def.permission:{}
  const known=new Set<string>(HI_ACCOUNTED_PERMISSION_KEYS)
  return Object.keys(permission).filter(key=>!known.has(key)).sort()
}

export interface NativePermissionSnapshot{mode?:string;decisions:Record<string,NativePermissionDecision>;source:'effective-opencode-agent'|'hi-default-invariants'}
export interface EffectiveExecutionSurface{tools:string[];permissions:NativePermissionSnapshot}

export function effectiveExecutionSurface(hostConfig:Record<string,unknown>,role:string,skillToolEnabled:boolean):EffectiveExecutionSurface{
  const agents=isRecord(hostConfig.agent)?hostConfig.agent:{}
  const def=isRecord(agents[role])?agents[role] as Record<string,unknown>:undefined
  const permission=def&&isRecord(def.permission)?def.permission:{}
  const globalTools=isRecord(hostConfig.tools)?hostConfig.tools:{}
  const roleTools=def&&isRecord(def.tools)?def.tools:{}
  const decisions:Record<string,NativePermissionDecision>={}
  for(const key of TOOL_KEYS)decisions[key]=decision(permission[key])
  // Skill permissions are deny-by-default pattern maps. A wildcard deny plus one or
  // more explicit allowed methodologies means the native skill tool itself must stay
  // available so OpenCode can enforce the exact selected skill name at invocation.
  // Do not apply this to bash/read maps: their generic execution decision must remain
  // conservative because arbitrary commands/paths are not preselected by Hi.
  const skillPermission=permission['skill']
  if(skillToolEnabled&&isRecord(skillPermission)&&Object.entries(skillPermission).some(([name,value])=>name!=='*'&&value==='allow'))decisions.skill='allow'
  // Hi owns orchestration policy, while OpenCode owns enforcement. Persist both the
  // observed effective decisions and the invariants Hi depends on.
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
  return{tools:[...new Set(tools)].sort(),permissions:{mode:def?.mode?String(def.mode):undefined,decisions,source:def?'effective-opencode-agent':'hi-default-invariants'}}
}

export const HI_CONTROL_TOOL_IDS=['hi_doctor','hi_status','hi_metrics','hi_ledger','hi_readiness','hi_context_artifact_add','hi_context_artifacts','hi_temporary_mutation_register','hi_temporary_mutation_revert','hi_direct_progress','hi_task_start','hi_task_await','hi_task_peek','hi_task_list','hi_task_cancel','hi_process_spawn','hi_process_read','hi_process_write','hi_process_wait','hi_process_kill','hi_process_cleanup','hi_process_list'] as const
export const KNOWN_BUILTIN_TOOL_IDS=['bash','edit','write','apply_patch','read','grep','glob','list','lsp','skill','todowrite','todoread','webfetch','websearch','question','task'] as const
export function promptToolOverrides(allowed:string[],hiToolNames:string[]=[...HI_CONTROL_TOOL_IDS]):Record<string,boolean>{const keep=new Set(allowed);const out:Record<string,boolean>={};for(const id of KNOWN_BUILTIN_TOOL_IDS)if(!keep.has(id))out[id]=false;for(const id of hiToolNames)out[id]=false;for(const id of HI_BROWSER_EXECUTION_TOOL_IDS)if(!keep.has(id))out[id]=false;return out}
