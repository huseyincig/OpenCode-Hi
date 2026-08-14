import { createHash } from 'node:crypto'
import type { MissionState,WorkerState } from '../mission/types.js'
import type { ProcessContract } from '../../contracts/process.js'
import type { ProcessExecutor,ProcessOutput,ProcessSpawnRequest } from './executor.js'
import { ProcessSpawnPermissionError } from '../../opencode/open-code-pty-adapter.js'
import { evaluateProcessSpawnAuthority,type ProcessPermissionRequest } from './authority.js'
import { appendLedger } from '../ledger/ledger.js'
import { addEvidence } from '../evidence/evidence-runtime.js'
import { actionContract,beginAuthorizedAction,completeAuthorizedAction,isAuthorized,requireAuthority } from '../safety/authority.js'
import { externalActionType } from '../safety/command-classifier.js'

export type NativePermissionPrompter=(request:ProcessPermissionRequest)=>Promise<void>
export interface ProcessStartInput{worker_id:string;command:string;args?:string[];cwd:string;env?:Record<string,string>;title?:string;timeout_ms?:number;ask?:NativePermissionPrompter}

function replaceProcess(m:MissionState,contract:ProcessContract):void{
  const index=m.execution.processes.findIndex(p=>p.process_id===contract.process_id)
  if(index<0)m.execution.processes.push(structuredClone(contract));else m.execution.processes[index]=structuredClone(contract)
}
function workerFor(m:MissionState,id:string):WorkerState{
  const worker=m.execution.workers.find(w=>w.id===id);if(!worker)throw new Error(`Hi process owner worker not found: ${id}`)
  const task=m.execution.tasks.find(t=>t.id===worker.task_id);if(!task)throw new Error(`Hi process owner task not found: ${worker.task_id}`)
  if(worker.parent_mission_id!==m.identity.mission_id)throw new Error('Hi process worker mission identity mismatch')
  return worker
}
function hash(text:string):string{return createHash('sha256').update(text).digest('hex')}

export class ProcessRuntime{
  constructor(readonly executor:ProcessExecutor,readonly projectRoot:string,readonly getHostConfig:()=>Record<string,unknown>){}
  private contract(m:MissionState,id:string):ProcessContract{const item=m.execution.processes.find(p=>p.process_id===id);if(!item)throw new Error(`Hi process not found in mission: ${id}`);return item}
  async spawn(m:MissionState,input:ProcessStartInput):Promise<ProcessContract>{
    if(m.identity.status!=='active'||m.continuation.user_interrupted)throw new Error('Mission is stopped; process spawn is forbidden')
    const worker=workerFor(m,input.worker_id),task=m.execution.tasks.find(t=>t.id===worker.task_id)!
    if(['completed','failed','cancelled'].includes(worker.status)||['completed','failed','cancelled','blocked'].includes(task.status))throw new Error('Process owner task/worker is terminal')
    const ordinaryAuthority=`native-permission:${worker.id}:bash`
    const actionType=externalActionType([input.command,...input.args??[]].join(' '))
    let authorityRef=ordinaryAuthority
    if(actionType){
      if(!m.identity.intent.requestedExternalActions.includes(actionType))throw new Error(`Hi process external action ${actionType} was not requested by the mission`)
      const exact=actionContract([input.command,...input.args??[]].join(' '),input.cwd);authorityRef=exact.hash
      if(!isAuthorized(m,[input.command,...input.args??[]].join(' '),input.cwd))requireAuthority(m,[input.command,...input.args??[]].join(' '),input.cwd)
    }
    let request:ProcessSpawnRequest={mission_id:m.identity.mission_id,task_id:task.id,worker_id:worker.id,role:worker.role,command:input.command,args:input.args,cwd:input.cwd,env:input.env,title:input.title,timeout_ms:input.timeout_ms,authority_ref:authorityRef,...(actionType?{external_action:{action_type:actionType,target:[input.command,...input.args??[]].join(' '),requested_explicitly:true,required_authority_ref:authorityRef,executor:'hi-process-executor'}}:{})}
    for(let attempts=0;attempts<3;attempts++){
      const auth=evaluateProcessSpawnAuthority(request,this.projectRoot,this.getHostConfig())
      if(auth.decision==='DENY')throw new ProcessSpawnPermissionError('DENY',auth.reason)
      if(auth.decision==='ASK'){
        if(!auth.permission_request||!input.ask)throw new ProcessSpawnPermissionError('ASK',auth.reason)
        await input.ask(auth.permission_request)
        request={...request,native_permission_grants:[...(request.native_permission_grants??[]),{permission:auth.permission_request.permission,pattern:auth.permission_request.pattern}]}
        continue
      }
      let privilegedStarted=false
      if(actionType){beginAuthorizedAction(m,[input.command,...input.args??[]].join(' '),input.cwd);privilegedStarted=true}
      try{
        const handle=await this.executor.spawn(request);replaceProcess(m,handle.contract);appendLedger(m,'process.spawned',{task_id:task.id,worker_id:worker.id,payload:{process_id:handle.contract.process_id,pid:handle.contract.pid,host:handle.contract.host,timeout_at:handle.contract.timeout_at}});return structuredClone(handle.contract)
      }catch(error){if(privilegedStarted)completeAuthorizedAction(m,[input.command,...input.args??[]].join(' '),input.cwd,'unknown',String(error));throw error}
    }
    throw new Error('Hi process native permission resolution exceeded bounded attempts')
  }
  async write(m:MissionState,id:string,input:string):Promise<void>{this.contract(m,id);await this.executor.write(id,input);appendLedger(m,'process.stdin',{payload:{process_id:id,chars:input.length}})}
  async read(m:MissionState,id:string,cursor?:number,maxChars?:number):Promise<ProcessOutput>{const current=this.contract(m,id),out=await this.executor.read(id,{cursor,max_chars:maxChars});const source=`process:${id}:${out.start_cursor}-${out.end_cursor}`,stateHash=hash(out.text);addEvidence(m,{kind:'diagnostic-evidence',summary:`Bounded process output observed (${out.text.length} chars${out.truncated?', truncated':''})`,scope:m.execution.tasks.find(t=>t.id===current.task_id)?.scope??[],source,source_state_hash:stateHash,task_id:current.task_id,outcome:'pending',reason:'process-output-observation'});appendLedger(m,'process.output-observed',{task_id:current.task_id,worker_id:current.worker_id,payload:{process_id:id,start_cursor:out.start_cursor,end_cursor:out.end_cursor,available_start:out.available_start_cursor,available_end:out.available_end_cursor,truncated:out.truncated,state_hash:stateHash}});return out}
  private noteExit(m:MissionState,contract:ProcessContract):void{replaceProcess(m,contract);appendLedger(m,'process.exited',{task_id:contract.task_id,worker_id:contract.worker_id,payload:{process_id:contract.process_id,status:contract.status,exit_code:contract.exit_code,cleanup_state:contract.cleanup_state}})}
  async wait(m:MissionState,id:string):Promise<ProcessContract>{const before=this.contract(m,id);try{const result=await this.executor.wait(id);this.noteExit(m,result.contract);const action=m.authority.authority?.executing;if(action?.hash===result.contract.authority_ref){completeAuthorizedAction(m,action.action.match(/(?:^|\n)command=([^\n]*)/)?.[1]??'',result.contract.cwd,result.contract.status==='EXITED'&&result.contract.exit_code===0?'success':'failure',`process ${result.contract.status}${result.contract.exit_code!==undefined?` exit=${result.contract.exit_code}`:''}`)}return structuredClone(result.contract)}catch(error){if(m.authority.authority?.executing?.hash===before.authority_ref){const command=m.authority.authority.executing.action.match(/(?:^|\n)command=([^\n]*)/)?.[1]??'';if(command)completeAuthorizedAction(m,command,before.cwd,'unknown',String(error))}throw error}}
  async kill(m:MissionState,id:string,signal:'SIGTERM'|'SIGINT'='SIGTERM'):Promise<ProcessContract>{const before=this.contract(m,id),result=await this.executor.kill(id,signal);this.noteExit(m,result.contract);if(m.identity.status==='active'&&m.authority.authority?.executing?.hash===before.authority_ref){const command=m.authority.authority.executing.action.match(/(?:^|\n)command=([^\n]*)/)?.[1]??'';if(command)completeAuthorizedAction(m,command,before.cwd,'failure',`process terminated by ${signal}`)}return structuredClone(result.contract)}
  async cleanup(m:MissionState,id:string):Promise<void>{const current=this.contract(m,id);await this.executor.cleanup(id);replaceProcess(m,{...current,cleanup_state:'CLEANED'});appendLedger(m,'process.cleaned',{task_id:current.task_id,worker_id:current.worker_id,payload:{process_id:id}})}
  list(m:MissionState):ProcessContract[]{return m.execution.processes.map(item=>structuredClone(item))}
  async stopMission(m:MissionState):Promise<number>{let stopped=0;for(const process of [...m.execution.processes]){if(process.status==='RUNNING'){try{await this.kill(m,process.process_id,'SIGTERM');stopped++}catch(error){const latest=m.execution.processes.find(p=>p.process_id===process.process_id);if(latest){latest.status='ORPHANED';latest.cleanup_state='QUARANTINED';latest.termination_reason='stop-termination-unverified'}m.execution.blockers=[...new Set([...m.execution.blockers,`process-orphan:${process.process_id}`])];appendLedger(m,'process.stop-failed',{task_id:process.task_id,worker_id:process.worker_id,payload:{process_id:process.process_id,error:String(error)}});continue}}const latest=m.execution.processes.find(p=>p.process_id===process.process_id);if(latest&&latest.status!=='RUNNING'&&latest.status!=='ORPHANED'&&latest.cleanup_state!=='CLEANED'){try{await this.cleanup(m,process.process_id)}catch(error){m.execution.blockers=[...new Set([...m.execution.blockers,`process-cleanup:${process.process_id}`])];appendLedger(m,'process.cleanup-failed',{task_id:process.task_id,worker_id:process.worker_id,payload:{process_id:process.process_id,error:String(error)}})}}}return stopped}
  async reconcileRestored(missions:MissionState[]):Promise<void>{for(const m of missions)for(const stored of [...m.execution.processes]){if(stored.cleanup_state==='CLEANED')continue;try{const result=await this.executor.reconcile(stored);replaceProcess(m,result.contract);appendLedger(m,'process.restart-reconciled',{task_id:stored.task_id,worker_id:stored.worker_id,payload:{process_id:stored.process_id,disposition:result.disposition,status:result.contract.status,cleanup_state:result.contract.cleanup_state}});if(result.disposition==='ORPHANED')m.execution.blockers=[...new Set([...m.execution.blockers,`process-orphan:${stored.process_id}`])]}catch(error){const orphan={...stored,status:'ORPHANED' as const,cleanup_state:'QUARANTINED' as const,termination_reason:'restart-reconcile-error'};delete orphan.exit_code;replaceProcess(m,orphan);m.execution.blockers=[...new Set([...m.execution.blockers,`process-orphan:${stored.process_id}`])];appendLedger(m,'process.restart-reconcile-failed',{task_id:stored.task_id,worker_id:stored.worker_id,payload:{process_id:stored.process_id,error:String(error)}})}}}
}
