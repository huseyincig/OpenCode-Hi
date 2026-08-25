import {spawn} from 'node:child_process'
import {existsSync,readFileSync,writeFileSync,unlinkSync,mkdirSync} from 'node:fs'
import {dirname} from 'node:path'

function waitForLock(child,timeoutMs=1000){return new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('AUTHORITATIVE_LOCK_PROBE_TIMEOUT'))},timeoutMs);child.stdout.on('data',b=>{out+=String(b);if(out.includes('LOCKED\n')){clearTimeout(timer);resolve()}});child.once('exit',(code)=>{if(!out.includes('LOCKED\n')){clearTimeout(timer);reject(new Error(`AUTHORITATIVE_RUN_LOCKED:${code}`))}});child.once('error',e=>{clearTimeout(timer);reject(e)})})}
function probeFlock(path){return new Promise(resolve=>{const p=spawn('flock',['-n',path,'true'],{stdio:'ignore'});p.once('error',()=>resolve('UNKNOWN'));p.once('exit',code=>resolve(code===0?'FREE':'HELD'))})}
function readMeta(path){try{return JSON.parse(readFileSync(path+'.meta.json','utf8'))}catch{return undefined}}

export class AuthoritativeRunLock{
  #child
  constructor(path,{workloadId,runId,predecessorRunId}={}){this.path=path;this.workloadId=workloadId;this.runId=runId;this.predecessorRunId=predecessorRunId;this.holderPid=undefined}
  get owned(){return Boolean(this.#child&&this.holderPid)}
  async acquire(){mkdirSync(dirname(this.path),{recursive:true});const child=spawn('flock',['-n',this.path,'sh','-c','printf "LOCKED\\n"; cat >/dev/null'],{stdio:['pipe','pipe','pipe']});await waitForLock(child);this.#child=child;this.holderPid=child.pid;writeFileSync(this.path+'.meta.json',JSON.stringify({schema:1,workload_id:this.workloadId,run_id:this.runId,predecessor_run_id:this.predecessorRunId??null,holder_pid:this.holderPid,acquired_at:new Date().toISOString()},null,2)+'\n',{mode:0o600});return this}
  async release(){if(!this.#child)return;const c=this.#child;this.#child=undefined;this.holderPid=undefined;c.stdin.end();await new Promise(resolve=>{c.once('exit',resolve);setTimeout(()=>{try{c.kill('SIGTERM')}catch{}},500)});try{unlinkSync(this.path+'.meta.json')}catch{}}
}

export async function reconcileAuthoritativeRun({lockPath,workloadId,processProbe=pid=>{try{process.kill(pid,0);return true}catch{return false}},sessionProbe=async()=> 'unknown'}={}){
  if(!existsSync(dirname(lockPath)))return{disposition:'CLEAR'}
  const lockState=await probeFlock(lockPath),meta=readMeta(lockPath)
  if(lockState==='UNKNOWN')return{disposition:'AMBIGUOUS_BLOCKED',reason:'lock-state-unknown'}
  if(lockState==='FREE'){
    if(meta){const live=Number.isInteger(meta.holder_pid)&&processProbe(meta.holder_pid);if(live)return{disposition:'AMBIGUOUS_BLOCKED',reason:'metadata-owner-live-without-lock',run_id:meta.run_id};try{unlinkSync(lockPath+'.meta.json')}catch{};return{disposition:'STALE_RECONCILED',run_id:meta.run_id}}
    return{disposition:'CLEAR'}
  }
  if(!meta||meta.workload_id!==workloadId)return{disposition:'AMBIGUOUS_BLOCKED',reason:'held-lock-metadata-missing-or-mismatch'}
  const live=Number.isInteger(meta.holder_pid)&&processProbe(meta.holder_pid),session=await sessionProbe(meta)
  if(live&&(session==='busy'||session==='retry'||session==='idle'))return{disposition:'ADOPT_WAIT',run_id:meta.run_id,session_status:session,holder_pid:meta.holder_pid}
  return{disposition:'AMBIGUOUS_BLOCKED',reason:'held-lock-owner-unverified',run_id:meta.run_id,session_status:session}
}

export async function reconcileContinuation({lockPath,workloadId,processProbe,sessionProbe,runMetaProbe=async()=>({status:'absent'}),runtimeStateProbe=async()=>({status:'absent'}),receiptProbe=async()=>({status:'absent'})}={}){
  const [lock,runMeta,runtimeState,newestReceipt]=await Promise.all([
    reconcileAuthoritativeRun({lockPath,workloadId,processProbe,sessionProbe}),runMetaProbe(),runtimeStateProbe(),receiptProbe()
  ])
  const evidence={run_meta:runMeta,runtime_state:runtimeState,newest_receipt:newestReceipt}
  if([runMeta,runtimeState,newestReceipt].some(x=>x?.status==='ambiguous'||x?.status==='conflict'))return{disposition:'AMBIGUOUS_BLOCKED',reason:'continuation-evidence-conflict',evidence,lock}
  const ids=[runMeta?.run_id,runtimeState?.run_id,newestReceipt?.run_id].filter(Boolean)
  if(new Set(ids).size>1)return{disposition:'AMBIGUOUS_BLOCKED',reason:'continuation-run-id-mismatch',evidence,lock}
  if(lock.disposition==='ADOPT_WAIT'&&ids.length&&ids[0]!==lock.run_id)return{disposition:'AMBIGUOUS_BLOCKED',reason:'lock-runtime-run-id-mismatch',evidence,lock}
  if((lock.disposition==='CLEAR'||lock.disposition==='STALE_RECONCILED')&&runtimeState?.status==='live')return{disposition:'AMBIGUOUS_BLOCKED',reason:'live-runtime-without-authoritative-lock',evidence,lock}
  return{...lock,evidence}
}
