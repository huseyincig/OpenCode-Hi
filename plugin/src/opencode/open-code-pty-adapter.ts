import { createHash,randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { OpenCodeClient } from './types.js'
import { createOpencodeClient as createOpenCodeV2Client } from '@opencode-ai/sdk/v2/client'
import { isProcessContract,processCommandIdentity,type ProcessContract } from '../contracts/process.js'
import { ProcessSpawnPermissionError,type ProcessExecutor,type ProcessExit,type ProcessHandle,type ProcessOutput,type ProcessOutputWindow,type ProcessSpawnRequest,type ProcessReconcileResult } from '../runtime/process/executor.js'
export { ProcessSpawnPermissionError } from '../runtime/process/executor.js'
import { evaluateProcessSpawnAuthority,processCommandLine } from '../runtime/process/authority.js'

interface NativePtyInfo{id:string;title:string;command:string;args:string[];cwd:string;status:'running'|'exited';pid:number;exitCode?:number}
interface ProcessSocket{readyState:number;send(data:string):void;close(code?:number,reason?:string):void;addEventListener(type:'open'|'message'|'close'|'error',listener:(event:any)=>void,options?:{once?:boolean}):void}
export type ProcessSocketFactory=(url:string)=>ProcessSocket
export type ProcessSignal=(pid:number,signal:'SIGTERM'|'SIGINT'|'SIGKILL')=>void
export type ProcessGroupResolver=(pid:number)=>number|undefined
interface RuntimeProcessState{
  contract:ProcessContract
  ptyID:string
  socket?:ProcessSocket
  buffer:string
  availableStart:number
  availableEnd:number
  cursorKnown:boolean
  beforeMetaChars:number
  timeoutTimer?:ReturnType<typeof setTimeout>
  timeoutRequested:boolean
  killRequested?:'SIGTERM'|'SIGINT'
  killEscalated:boolean
  exitPromise:Promise<ProcessExit>
  resolveExit:(value:ProcessExit)=>void
  rejectExit:(error:unknown)=>void
  exitSettled:boolean
  reconnects:number
}

function nativeData<T>(value:any):T{const first=value&&typeof value==='object'&&'data'in value?value.data:value;return(first&&typeof first==='object'&&'data'in first?first.data:first) as T}
function nativeError(value:any):unknown{return value&&typeof value==='object'&&'error'in value&&value.error?value.error:undefined}
function nativeErrorText(value:unknown):string{if(value instanceof Error&&value.message.trim())return value.message.trim();if(value&&typeof value==='object'){const v=value as any;for(const item of [v?.data?.message,v?.message,v?.name])if(typeof item==='string'&&item.trim())return item.trim()}return String(value)}
function assertNativeAccepted(value:any,operation:string):void{const rejected=nativeError(value);if(rejected===undefined)return;const error=new Error(`OpenCode PTY ${operation} rejected: ${nativeErrorText(rejected)}`);(error as any).cause=rejected;throw error}
function cloneContract(value:ProcessContract):ProcessContract{return structuredClone(value)}
function processID():string{return`proc_${createHash('sha256').update(randomUUID()).digest('hex').slice(0,24)}`}
function wsUrl(serverUrl:URL,ptyID:string,directory:string,ticket:string,cursor:number):string{const url=new URL(`/api/pty/${encodeURIComponent(ptyID)}/connect`,serverUrl);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('location[directory]',directory);url.searchParams.set('cursor',String(cursor));url.searchParams.set('ticket',ticket);return url.toString()}
async function bytes(value:unknown):Promise<Uint8Array|undefined>{if(value instanceof ArrayBuffer)return new Uint8Array(value);if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);if(typeof Blob!=='undefined'&&value instanceof Blob)return new Uint8Array(await value.arrayBuffer());return undefined}

const POSIX_PTY_BARRIER_SCRIPT='stty -echo || exit 125; printf %s "$1"; shift; IFS= read -r _ || exit 125; stty echo || exit 125; exec "$@"'
function launchPlan(request:ProcessSpawnRequest):{command:string;args:string[];release?:string;readyMarker?:string}{
  if(process.platform==='win32')return{command:request.command,args:[...(request.args??[])]}
  const markerDigest=createHash('sha256').update(`${request.cwd}\0${processCommandLine(request)}`).digest('hex').slice(0,16),readyMarker=`~HI:${markerDigest}~`
  return{command:'/usr/bin/env',args:['sh','-c',POSIX_PTY_BARRIER_SCRIPT,'hi-opencode-pty-barrier',readyMarker,request.command,...(request.args??[])],release:'\n',readyMarker}
}
function nativeLaunchMarker(info:Pick<NativePtyInfo,'command'|'args'>):string|undefined{
  const args=info.args??[],marker=args[4]
  return info.command==='/usr/bin/env'&&args[0]==='sh'&&args[1]==='-c'&&args[2]===POSIX_PTY_BARRIER_SCRIPT&&args[3]==='hi-opencode-pty-barrier'&&typeof marker==='string'&&/^~HI:[a-f0-9]{16}~$/.test(marker)?marker:undefined
}
export function linuxProcessGroup(pid:number):number|undefined{
  if(process.platform!=='linux'||!Number.isInteger(pid)||pid<=0)return undefined
  try{const raw=readFileSync(`/proc/${pid}/stat`,'utf8'),end=raw.lastIndexOf(')');if(end<0)return undefined;const fields=raw.slice(end+2).trim().split(/\s+/);const pgrp=Number(fields[2]);return Number.isInteger(pgrp)&&pgrp>0?pgrp:undefined}catch{return undefined}
}

export class OpenCodePtyAdapter implements ProcessExecutor{
  readonly #states=new Map<string,RuntimeProcessState>()
  #v2Client:any
  constructor(
    readonly client:OpenCodeClient,
    readonly serverUrl:URL,
    readonly directory:string,
    readonly projectRoot:string,
    readonly getHostConfig:()=>Record<string,unknown>,
    readonly socketFactory:ProcessSocketFactory=(url)=>new WebSocket(url) as unknown as ProcessSocket,
    readonly signalProcess:ProcessSignal=(pid,signal)=>process.kill(pid,signal),
    readonly maxBufferedChars=256*1024,
    readonly maxReadChars=64*1024,
    readonly resolveProcessGroup:ProcessGroupResolver=linuxProcessGroup,
    readonly terminationGraceMs=2000,
    readonly terminationVerifyMs=2000,
  ){}
  #edge():any{return this.client as any}
  #pty():any{const injected=this.#edge()?.v2?.pty;if(injected)return injected;if(!this.#v2Client&&this.serverUrl)this.#v2Client=createOpenCodeV2Client({baseUrl:this.serverUrl.toString(),directory:this.directory});const pty=this.#v2Client?.v2?.pty??this.#v2Client?.pty;if(!pty||typeof pty.create!=='function'||typeof pty.get!=='function'||typeof pty.remove!=='function'||typeof pty.connectToken!=='function')throw new Error('OpenCode canonical v2 PTY API unavailable');return pty}
  #location(){return{directory:this.directory}}
  async health():Promise<{available:boolean;detail:string}>{try{const pty=this.#pty(),raw=await pty.list({location:this.#location()});assertNativeAccepted(raw,'list');const items=nativeData<unknown>(raw);if(!Array.isArray(items))throw new Error('OpenCode PTY list returned invalid data');return{available:true,detail:'OpenCode canonical v2 PTY list observed'}}catch(error){return{available:false,detail:String(error)}}}
  #state(id:string):RuntimeProcessState{const state=this.#states.get(id);if(!state)throw new Error(`Hi ProcessExecutor process not found: ${id}`);return state}
  #signalTarget(state:RuntimeProcessState):number{
    const expected=state.contract.process_group_id,observed=this.resolveProcessGroup(state.contract.pid)
    if(expected!==undefined){if(observed!==expected)throw new Error(`Refusing process-group signal for ${state.contract.process_id}: expected ${expected}, observed ${String(observed)}`);return expected===state.contract.pid?-expected:state.contract.pid}
    return state.contract.pid
  }
  #append(state:RuntimeProcessState,text:string,beforeMeta=false):void{
    if(!text)return
    if(beforeMeta){state.beforeMetaChars+=text.length;state.buffer=(state.buffer+text).slice(-this.maxBufferedChars);return}
    const end=state.availableEnd+text.length;state.buffer=(state.buffer+text).slice(-this.maxBufferedChars);state.availableEnd=end;state.availableStart=Math.max(0,end-state.buffer.length)
  }
  #hideLaunchMarker(state:RuntimeProcessState,marker:string):boolean{
    const index=state.buffer.indexOf(marker);if(index<0)return false
    const cut=index+marker.length;state.buffer=state.buffer.slice(cut);state.availableStart+=cut;return true
  }
  #settleExit(state:RuntimeProcessState):void{if(state.exitSettled)return;state.exitSettled=true;if(state.timeoutTimer)clearTimeout(state.timeoutTimer);state.resolveExit({contract:cloneContract(state.contract)})}
  #failExit(state:RuntimeProcessState,error:unknown):void{if(state.exitSettled)return;state.exitSettled=true;if(state.timeoutTimer)clearTimeout(state.timeoutTimer);state.rejectExit(error)}
  #applyInfo(state:RuntimeProcessState,info:NativePtyInfo):void{
    if(info.pid!==state.contract.pid)throw new Error(`OpenCode PTY PID identity changed for ${state.contract.process_id}: expected ${state.contract.pid}, observed ${info.pid}`)
    if(info.status!=='exited'||state.contract.status!=='RUNNING')return
    const now=Date.now();state.contract.ended_at=now;state.contract.cleanup_state='CLEANUP_PENDING'
    if(state.timeoutRequested){state.contract.status='TIMED_OUT';state.contract.termination_reason='timeout-policy';state.contract.timeout_at=state.contract.timeout_at??now}
    else if(state.killRequested){state.contract.status='TERMINATED';state.contract.termination_reason=`signal:${state.killRequested}${state.killEscalated?'->SIGKILL':''}`}
    else{state.contract.status='EXITED';state.contract.exit_code=Number.isInteger(info.exitCode)?info.exitCode:0}
    const candidate=structuredClone(state.contract);if(!isProcessContract(candidate))throw new Error(`OpenCode PTY produced invalid Hi ProcessContract state for ${state.contract.process_id}`)
    this.#settleExit(state)
  }
  async #nativeInfo(state:RuntimeProcessState):Promise<NativePtyInfo>{const raw=await this.#pty().get({ptyID:state.ptyID,location:this.#location()});assertNativeAccepted(raw,`get:${state.ptyID}`);const info=nativeData<NativePtyInfo>(raw);if(!info||typeof info.id!=='string')throw new Error(`OpenCode PTY get returned invalid data for ${state.ptyID}`);return info}
  async #refresh(state:RuntimeProcessState):Promise<void>{this.#applyInfo(state,await this.#nativeInfo(state))}
  async #ticket(state:RuntimeProcessState):Promise<string>{const raw=await this.#pty().connectToken({ptyID:state.ptyID,location:this.#location()},{headers:{'x-opencode-ticket':'1'}});assertNativeAccepted(raw,`connect-token:${state.ptyID}`);const token=nativeData<{ticket:string;expires_in:number}>(raw);if(!token?.ticket)throw new Error(`OpenCode PTY connect token unavailable for ${state.ptyID}`);return token.ticket}
  async #onFrame(state:RuntimeProcessState,data:unknown):Promise<void>{
    const raw=await bytes(data)
    if(raw?.length&&raw[0]===0){try{const meta=JSON.parse(new TextDecoder().decode(raw.slice(1)));if(!Number.isSafeInteger(meta?.cursor)||meta.cursor<0)throw new Error('invalid cursor');state.availableEnd=meta.cursor;state.availableStart=Math.max(0,meta.cursor-state.buffer.length);state.cursorKnown=true;return}catch(error){this.#failExit(state,new Error(`Invalid OpenCode PTY cursor frame: ${String(error)}`));return}}
    if(typeof data==='string'){this.#append(state,data,!state.cursorKnown);return}
    if(raw){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);this.#append(state,text,!state.cursorKnown)}catch{}}
  }
  async #connect(state:RuntimeProcessState,cursor:number,readyMarker?:string):Promise<void>{
    const ticket=await this.#ticket(state),socket=this.socketFactory(wsUrl(this.serverUrl,state.ptyID,this.directory,ticket,cursor));state.socket=socket;state.cursorKnown=false;state.beforeMetaChars=0
    await new Promise<void>((resolve,reject)=>{
      let opened=false,settled=false
      const finish=(error?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve()}
      const ready=()=>{if(opened&&state.cursorKnown&&(!readyMarker||state.buffer.includes(readyMarker)))finish()}
      const timer=setTimeout(()=>finish(new Error(`OpenCode PTY websocket initial cursor timeout for ${state.ptyID}`)),5000)
      socket.addEventListener('message',(event)=>{void this.#onFrame(state,event.data).then(ready,error=>finish(error))})
      socket.addEventListener('open',()=>{opened=true;ready()},{once:true})
      socket.addEventListener('error',()=>{if(!settled)finish(new Error(`OpenCode PTY websocket failed for ${state.ptyID}`))},{once:true})
      socket.addEventListener('close',()=>{if(!settled)finish(new Error(`OpenCode PTY websocket closed before initial cursor for ${state.ptyID}`));void this.#onSocketClose(state)},{once:true})
    })
  }
  async #onSocketClose(state:RuntimeProcessState):Promise<void>{
    try{await this.#refresh(state);if(state.contract.status!=='RUNNING')return;if(state.reconnects>=1){this.#failExit(state,new Error(`OpenCode PTY transport lost while process ${state.contract.process_id} remains running`));return}state.reconnects++;await this.#connect(state,state.availableEnd)}catch(error){try{await this.#refresh(state);if(state.contract.status!=='RUNNING')return}catch{}this.#failExit(state,error)}
  }
  async #waitForExitWithin(state:RuntimeProcessState,windowMs:number):Promise<boolean>{
    if(state.contract.status!=='RUNNING')return true
    const bounded=Math.max(10,Math.min(30_000,Math.floor(windowMs)))
    let timer:ReturnType<typeof setTimeout>|undefined
    try{return await Promise.race([state.exitPromise.then(()=>true),new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),bounded)})])}finally{if(timer)clearTimeout(timer)}
  }
  async #terminateAndObserve(state:RuntimeProcessState,signal:'SIGTERM'|'SIGINT',mode:'kill'|'timeout'):Promise<void>{
    if(state.contract.status!=='RUNNING')return
    let info=await this.#nativeInfo(state);if(info.pid!==state.contract.pid)throw new Error(`Refusing stale PID ${mode} signal for ${state.contract.process_id}`);if(info.status==='exited'){this.#applyInfo(state,info);return}
    let target=this.#signalTarget(state);this.signalProcess(target,signal);if(mode==='timeout')state.timeoutRequested=true;else state.killRequested=signal
    if(await this.#waitForExitWithin(state,this.terminationGraceMs))return
    info=await this.#nativeInfo(state);if(info.pid!==state.contract.pid)throw new Error(`Refusing stale PID escalation for ${state.contract.process_id}`);if(info.status==='exited'){this.#applyInfo(state,info);return}
    target=this.#signalTarget(state);this.signalProcess(target,'SIGKILL');state.killEscalated=true
    if(await this.#waitForExitWithin(state,this.terminationVerifyMs))return
    await this.#refresh(state);if(state.contract.status==='RUNNING')throw new Error(`OpenCode PTY termination was not observed after bounded escalation for ${state.contract.process_id}`)
  }
  async #requestTimeout(state:RuntimeProcessState):Promise<void>{
    try{await this.#terminateAndObserve(state,'SIGTERM','timeout')}catch(error){this.#failExit(state,error)}
  }
  async spawn(request:ProcessSpawnRequest):Promise<ProcessHandle>{
    const auth=evaluateProcessSpawnAuthority(request,this.projectRoot,this.getHostConfig());if(auth.decision!=='ALLOW')throw new ProcessSpawnPermissionError(auth.decision,auth.reason)
    if(!request.command.trim()||!request.cwd.trim()||!request.authority_ref.trim())throw new Error('Hi ProcessExecutor requires command, cwd and authority_ref')
    if(request.timeout_ms!==undefined&&(!Number.isFinite(request.timeout_ms)||request.timeout_ms<50||request.timeout_ms>24*60*60*1000))throw new Error('Hi ProcessExecutor timeout_ms must be between 50ms and 24h')
    const launch=launchPlan(request),raw=await this.#pty().create({location:this.#location(),command:launch.command,args:launch.args,cwd:request.cwd,title:request.title,env:request.env});assertNativeAccepted(raw,'create');const info=nativeData<NativePtyInfo>(raw)
    if(!info||info.status!=='running'||!Number.isInteger(info.pid)||info.pid<=0||typeof info.id!=='string')throw new Error('OpenCode PTY create did not return a running PID-bound session')
    const started=Date.now(),processGroup=this.resolveProcessGroup(info.pid),contract:ProcessContract={process_id:processID(),mission_id:request.mission_id,task_id:request.task_id,worker_id:request.worker_id,host:'opencode',command_identity:processCommandIdentity({host:'opencode',command:processCommandLine({command:info.command,args:info.args}),cwd:info.cwd}),cwd:info.cwd,pid:info.pid,...(processGroup?{process_group_id:processGroup}:{}),status:'RUNNING',started_at:started,...(request.timeout_ms?{timeout_at:started+request.timeout_ms}:{}),output_artifact_refs:[],...(request.service_origins?.length?{service_origins:[...request.service_origins]}:{}),authority_ref:request.authority_ref,cleanup_state:'ACTIVE'}
    if(!isProcessContract(contract)){try{await this.#pty().remove({ptyID:info.id,location:this.#location()})}catch{}throw new Error('Hi ProcessExecutor created invalid ProcessContract')}
    let resolveExit!:(value:ProcessExit)=>void,rejectExit!:(error:unknown)=>void;const exitPromise=new Promise<ProcessExit>((resolve,reject)=>{resolveExit=resolve;rejectExit=reject})
    const state:RuntimeProcessState={contract,ptyID:info.id,buffer:'',availableStart:0,availableEnd:0,cursorKnown:false,beforeMetaChars:0,timeoutRequested:false,killEscalated:false,exitPromise,resolveExit,rejectExit,exitSettled:false,reconnects:0};this.#states.set(contract.process_id,state)
    try{await this.#connect(state,0,launch.readyMarker);if(launch.readyMarker&&!this.#hideLaunchMarker(state,launch.readyMarker))throw new Error(`OpenCode PTY launch marker missing for ${state.ptyID}`);if(launch.release&&state.contract.status==='RUNNING'){if(!state.socket||state.socket.readyState!==1)throw new Error(`OpenCode PTY websocket unavailable at launch release for ${state.ptyID}`);state.socket.send(launch.release)}}catch(error){try{await this.#refresh(state)}catch{}if(state.contract.status==='RUNNING'){try{await this.#pty().remove({ptyID:state.ptyID,location:this.#location()})}catch{}this.#states.delete(contract.process_id);throw error}}
    if(request.timeout_ms)state.timeoutTimer=setTimeout(()=>{void this.#requestTimeout(state)},request.timeout_ms)
    return{contract:cloneContract(state.contract),host_process_id:state.ptyID}
  }
  async write(processId:string,input:string):Promise<void>{const state=this.#state(processId);await this.#refresh(state);if(state.contract.status!=='RUNNING')throw new Error(`Cannot write to terminal process ${processId}`);if(typeof input!=='string'||input.length>64*1024)throw new Error('Process input exceeds 64KiB bound');if(!state.socket||state.socket.readyState!==1)await this.#connect(state,state.availableEnd);state.socket?.send(input)}
  async read(processId:string,window:ProcessOutputWindow={}):Promise<ProcessOutput>{const state=this.#state(processId);await this.#refresh(state);const requested=Number.isSafeInteger(window.cursor)?Math.max(0,window.cursor as number):state.availableStart,max=Math.max(1,Math.min(this.maxReadChars,Number.isFinite(window.max_chars)?Math.floor(window.max_chars as number):8192)),start=Math.min(state.availableEnd,Math.max(state.availableStart,requested)),offset=start-state.availableStart,text=state.buffer.slice(offset,offset+max),end=start+text.length;return{text,start_cursor:start,end_cursor:end,available_start_cursor:state.availableStart,available_end_cursor:state.availableEnd,truncated:requested<state.availableStart||end<state.availableEnd,status:state.contract.status}}
  async observe(processId:string):Promise<ProcessContract>{const state=this.#state(processId);await this.#refresh(state);return cloneContract(state.contract)}
  async wait(processId:string):Promise<ProcessExit>{const state=this.#state(processId);await this.#refresh(state);if(state.contract.status!=='RUNNING')return{contract:cloneContract(state.contract)};return state.exitPromise}
  async kill(processId:string,signal:'SIGTERM'|'SIGINT'='SIGTERM'):Promise<ProcessExit>{const state=this.#state(processId);await this.#refresh(state);if(state.contract.status!=='RUNNING')return{contract:cloneContract(state.contract)};await this.#terminateAndObserve(state,signal,'kill');return{contract:cloneContract(state.contract)}}
  async cleanup(processId:string):Promise<void>{const state=this.#state(processId);await this.#refresh(state);if(state.contract.status==='RUNNING')throw new Error(`Refusing cleanup of running process ${processId}; kill/exit must occur first`);const raw=await this.#pty().remove({ptyID:state.ptyID,location:this.#location()});assertNativeAccepted(raw,`remove:${state.ptyID}`);state.socket?.close(1000,'Hi cleanup');state.contract.cleanup_state='CLEANED';if(!isProcessContract(state.contract))throw new Error(`Invalid cleanup state for ${processId}`);this.#states.delete(processId)}

  async reconcile(contract:ProcessContract):Promise<ProcessReconcileResult>{
    const persisted=structuredClone(contract)
    if(!isProcessContract(persisted)||persisted.host!=='opencode')throw new Error('Hi ProcessExecutor reconcile requires a valid OpenCode ProcessContract')
    const owned=this.#states.get(persisted.process_id)
    if(owned&&(owned.contract.mission_id!==persisted.mission_id||owned.contract.task_id!==persisted.task_id||owned.contract.worker_id!==persisted.worker_id))throw new Error(`PTY process_id ${persisted.process_id} is already owned by another process identity`)
    const raw=await this.#pty().list({location:this.#location()});assertNativeAccepted(raw,'list');const items=nativeData<NativePtyInfo[]>(raw)??[];if(!Array.isArray(items))throw new Error('OpenCode PTY list returned invalid data during reconcile')
    const samePid=Array.isArray(items)?items.filter(info=>info&&info.pid===persisted.pid):[]
    const exact=samePid.find(info=>info.cwd===persisted.cwd&&processCommandIdentity({host:'opencode',command:processCommandLine({command:info.command,args:info.args}),cwd:info.cwd})===persisted.command_identity)
    if(!exact){
      if(persisted.status!=='RUNNING'&&samePid.length===0){persisted.cleanup_state='CLEANED';return{disposition:'TERMINAL',contract:persisted}}
      persisted.status='ORPHANED';persisted.cleanup_state='QUARANTINED';persisted.termination_reason=samePid.length?'restart-owner-identity-mismatch':'restart-owner-missing';delete persisted.exit_code
      return{disposition:'ORPHANED',contract:persisted}
    }
    if(persisted.status!=='RUNNING'&&exact.status==='running'){
      persisted.status='ORPHANED';persisted.cleanup_state='QUARANTINED';persisted.termination_reason='restart-terminal-contract-host-running';delete persisted.exit_code
      return{disposition:'ORPHANED',contract:persisted}
    }
    if(persisted.process_group_id!==undefined){const observedGroup=this.resolveProcessGroup(persisted.pid);if(observedGroup!==persisted.process_group_id){persisted.status='ORPHANED';persisted.cleanup_state='QUARANTINED';persisted.termination_reason='restart-process-group-identity-mismatch';delete persisted.exit_code;return{disposition:'ORPHANED',contract:persisted}}}
    let resolveExit!:(value:ProcessExit)=>void,rejectExit!:(error:unknown)=>void
    const exitPromise=new Promise<ProcessExit>((resolve,reject)=>{resolveExit=resolve;rejectExit=reject})
    const state:RuntimeProcessState={contract:persisted,ptyID:exact.id,buffer:'',availableStart:0,availableEnd:0,cursorKnown:false,beforeMetaChars:0,timeoutRequested:false,killEscalated:false,exitPromise,resolveExit,rejectExit,exitSettled:false,reconnects:0}
    this.#states.set(persisted.process_id,state)
    if(exact.status==='exited'){
      if(persisted.status==='RUNNING'){persisted.status='EXITED';persisted.ended_at=Date.now();persisted.exit_code=Number.isInteger(exact.exitCode)?exact.exitCode:0;persisted.cleanup_state='CLEANUP_PENDING'}
      state.contract=persisted;this.#settleExit(state);return{disposition:'TERMINAL',contract:cloneContract(persisted)}
    }
    await this.#connect(state,0)
    const launchMarker=nativeLaunchMarker(exact);if(launchMarker)this.#hideLaunchMarker(state,launchMarker)
    return{disposition:'ADOPTED',contract:cloneContract(persisted)}
  }

  snapshot(processId:string):ProcessContract{return cloneContract(this.#state(processId).contract)}
  list():ProcessContract[]{return[...this.#states.values()].map(state=>cloneContract(state.contract))}
}
