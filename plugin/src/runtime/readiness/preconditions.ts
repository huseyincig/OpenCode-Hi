import type { MissionState } from '../mission/types.js'
import { syncMissionGates } from '../gates/gates.js'

export type ReadinessStatus='ready'|'waiting'|'blocked'|'not-applicable'
export interface ReadinessItem{id:string;status:ReadinessStatus;reason:string}
export function evaluatePreconditions(m:MissionState,projectRoot?:string):{ready:boolean;items:ReadinessItem[]}{const gates=syncMissionGates(m,projectRoot);const items=gates.map(g=>({id:g.id,status:(g.status==='closed'?'not-applicable':g.status==='ready'?'ready':g.status==='blocked'?'blocked':'waiting') as ReadinessStatus,reason:g.reason??g.summary}));return{ready:!items.some(x=>x.status==='blocked'),items}}

export type TaskPreconditionDecision='READY'|'WAIT'|'RESOLVE'|'USER_ACTION_REQUIRED'
export interface TaskPreconditionItem{id:string;decision:TaskPreconditionDecision;reason:string}
export interface TaskPreconditionInput{
  role:string
  implementation:boolean
  dependencies:{unknown:string[];failed:string[];incomplete:string[]}
  modelAvailable:boolean
  native:{childSession:boolean;prompt:boolean}
  hostConfig?:Record<string,unknown>
  methodologyResourceFailures?:string[]
  contractCriticalAmbiguity?:boolean
  authorityRequired?:boolean
}
export interface TaskPreconditionResult{decision:TaskPreconditionDecision;items:TaskPreconditionItem[]}

function toolDecision(permission:any,name:string):'allow'|'ask'|'deny'|'unknown'{
  if(!permission||typeof permission!=='object')return'unknown'
  const raw=permission[name]
  if(typeof raw==='string')return raw==='deny'?'deny':raw==='ask'?'ask':raw==='allow'?'allow':'unknown'
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    const star=(raw as any)['*']
    if(typeof star==='string')return star==='deny'?'deny':star==='ask'?'ask':star==='allow'?'allow':'unknown'
    if(Object.values(raw).some(x=>x==='allow'))return'allow'
    if(Object.values(raw).some(x=>x==='ask'))return'ask'
    if(Object.values(raw).length&&Object.values(raw).every(x=>x==='deny'))return'deny'
  }
  return'unknown'
}
function roleDefinition(hostConfig:Record<string,unknown>|undefined,role:string):any{
  const agents=(hostConfig as any)?.agent
  return agents&&typeof agents==='object'&&!Array.isArray(agents)?agents[role]:undefined
}
function rank(d:TaskPreconditionDecision):number{return d==='USER_ACTION_REQUIRED'?4:d==='RESOLVE'?3:d==='WAIT'?2:1}
export function evaluateTaskPreconditions(input:TaskPreconditionInput):TaskPreconditionResult{
  const items:TaskPreconditionItem[]=[]
  const add=(id:string,decision:TaskPreconditionDecision,reason:string)=>items.push({id,decision,reason})
  if(!input.native.childSession)add('native-child-session','RESOLVE','OpenCode session.create is unavailable; do not spawn a worker that cannot start')
  if(!input.native.prompt)add('native-child-prompt','RESOLVE','OpenCode child prompt API is unavailable; do not spawn a worker that cannot execute')
  if(!input.modelAvailable)add('runtime-model','RESOLVE','No permitted/available runtime model satisfies this task')
  if(input.dependencies.unknown.length)add('dependency-unknown','RESOLVE',`Unknown task dependencies: ${input.dependencies.unknown.join(',')}`)
  if(input.dependencies.failed.length)add('dependency-terminal','RESOLVE',`Unavailable task dependencies: ${input.dependencies.failed.join(',')}`)
  if(input.dependencies.incomplete.length)add('dependency-wait','WAIT',`Waiting for prerequisite task(s): ${input.dependencies.incomplete.join(',')}`)
  if(input.contractCriticalAmbiguity&&input.implementation)add('contract-ambiguity','RESOLVE','Contract-critical ambiguity must be resolved by evidence/exploration before implementation starts')
  if(input.authorityRequired)add('user-authority','USER_ACTION_REQUIRED','Required user authority must be resolved before this task starts')
  if(input.methodologyResourceFailures?.length)add('methodology-resource','RESOLVE',`Required methodology host/resource capability is unavailable: ${input.methodologyResourceFailures.join(', ')}`)

  const def=roleDefinition(input.hostConfig,input.role)
  // When the live config exposes an agent table, an Hi specialist must exist there as a native subagent.
  if((input.hostConfig as any)?.agent&&def===undefined)add('agent-definition','RESOLVE',`Native OpenCode agent definition for ${input.role} is unavailable`)
  if(def&&typeof def==='object'){
    if(def.mode!==undefined&&String(def.mode)!=='subagent')add('agent-mode','RESOLVE',`${input.role} must be registered as an OpenCode subagent`)
    const permission=def.permission
    if(toolDecision(permission,'read')==='deny')add('tool-read','RESOLVE',`${input.role} cannot access required read capability under effective OpenCode permissions`)
    if(input.implementation&&toolDecision(permission,'edit')==='deny')add('tool-edit','RESOLVE',`${input.role} cannot implement because effective OpenCode edit permission is denied`)
    if(toolDecision(permission,'task')==='allow')add('recursive-delegation','RESOLVE',`${input.role} may recursively delegate via task; Hi specialist recursion must remain disabled`)
  }
  if(!items.length)add('task-preflight','READY','All deterministic task preconditions are satisfied')
  const decision=items.reduce<TaskPreconditionDecision>((best,x)=>rank(x.decision)>rank(best)?x.decision:best,'READY')
  return{decision,items}
}

export class TaskPreconditionError extends Error{
  constructor(readonly result:TaskPreconditionResult){super(`${result.decision}: ${result.items.filter(x=>x.decision===result.decision).map(x=>x.reason).join('; ')}`);this.name='TaskPreconditionError'}
}
