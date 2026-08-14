import type { OpenCodeClient } from '../../opencode/types.js'
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import type { MissionState,WorkerState } from '../mission/types.js'
import type { BackgroundRegistry } from '../background/registry.js'
import { createChildSession,sendPromptAsync,abortSession,type OpenCodeLifecycleEndpoint } from '../../opencode/client-adapter.js'
import { NativeOpenCodeAdapter } from '../../opencode/native-adapter.js'
import { redactProviderContext } from '../privacy/boundary.js'
import { appendLedger } from '../ledger/ledger.js'
import { reconcileModelExecutionIdentity } from '../../contracts/model.js'

function normFile(value:string):string{return value.trim().replace(/\\/g,'/').replace(/^\.\//,'')}
function nativeDiffMap(raw:any):Record<string,string>{
  const items=Array.isArray(raw)?raw:Array.isArray(raw?.data)?raw.data:[];const out:Record<string,string>={}
  for(const item of items){const file=typeof item?.file==='string'?normFile(item.file):'';if(!file)continue;const signature=createHash('sha256').update(JSON.stringify({file,additions:item?.additions??null,deletions:item?.deletions??null,status:item?.status??null,before:item?.before??null,after:item?.after??null,patch:item?.patch??null})).digest('hex');out[file]=signature}
  return out
}

export function diffDelta(before:Record<string,string>|undefined,after:Record<string,string>):string[]{const b=before??{};return Object.keys(after).filter(file=>b[file]!==after[file])}
export { normFile }

export interface ChildWorkspaceBinding{workspaceID:string;directory:string}
function samePath(a:string,b:string):boolean{try{return realpathSync(resolve(a))===realpathSync(resolve(b))}catch{return resolve(a)===resolve(b)}}

export class ChildExecutionCoordinator{
  constructor(private readonly client:OpenCodeClient,private readonly lifecycle:OpenCodeLifecycleEndpoint={},private readonly registry?:BackgroundRegistry){}

  resolveCallbackWorker(sessionID:string):WorkerState|undefined{return this.registry?.list().find(w=>w.session_id===sessionID)}
  async create(parentSessionID:string,title:string,role:string,model?:string,variant?:string,workspace?:ChildWorkspaceBinding):Promise<{id?:string;workspaceID?:string;directory?:string}>{const child=await createChildSession(this.client,parentSessionID,title,role,model,variant,workspace?.workspaceID,this.lifecycle);if(workspace){if(child?.workspaceID!==workspace.workspaceID||typeof child?.directory!=='string'||!samePath(child.directory,workspace.directory)){if(child?.id)try{await abortSession(this.client,String(child.id),this.lifecycle)}catch{};throw new Error(`OpenCode child workspace binding mismatch: expected ${workspace.workspaceID} @ ${workspace.directory}, observed ${String(child?.workspaceID)} @ ${String(child?.directory)}`)}}return child}
  async createForTask(parentSessionID:string,title:string,role:string,model?:string,variant?:string,forkFromSession?:string,workspace?:ChildWorkspaceBinding):Promise<{child:{id?:string;workspaceID?:string;directory?:string};fork:{requested:boolean;nativeAvailable:boolean;used:false;reason?:string}}>{const native=new NativeOpenCodeAdapter(this.client),requested=Boolean(forkFromSession),nativeAvailable=requested&&native.has('fork');const child=await this.create(parentSessionID,title,role,model,variant,workspace);return{child,fork:{requested,nativeAvailable,used:false,reason:requested?'native fork cannot set specialist agent; created isolated child instead':undefined}}}
  async sendProviderPrompt(sessionID:string,text:string,role?:string,model?:string,variant?:string,tools?:Record<string,boolean>):Promise<unknown>{const safe=redactProviderContext(text);return sendPromptAsync(this.client,sessionID,safe.providerText,role,model,variant,tools)}
  recordModelProjection(worker:WorkerState,model?:string,variant?:string):void{worker.projected_model=model??'host-default';worker.projected_model_variant=variant;worker.updated_at=Date.now()}
  async abortNativeSession(m:MissionState,sessionID:string,reason:string,workerID?:string,taskID?:string):Promise<boolean>{const transport=await abortSession(this.client,sessionID,this.lifecycle);appendLedger(m,'worker.session-abort',{task_id:taskID,worker_id:workerID,payload:{session_id:sessionID,reason,transport}});return transport!=='unavailable'}
  async captureNativeDiff(worker:WorkerState,phase:'baseline'|'final'):Promise<Record<string,string>|undefined>{
    if(!worker.session_id)return undefined;const native=new NativeOpenCodeAdapter(this.client);if(!native.has('diff'))return undefined
    try{const map=nativeDiffMap(await native.diff(worker.session_id));if(phase==='baseline')worker.native_diff_baseline=map;else worker.native_diff_final=map;return map}catch{return undefined}
  }
  noteEffectiveModel(m:MissionState,workerID:string,observed?:{model?:string;variant?:string;source?:string}):{ok:boolean;expected?:string;observed?:string;reason:string}{
    const worker=m.execution.workers.find(w=>w.id===workerID);if(!worker)return{ok:false,reason:'worker-not-found'}
    const task=m.execution.tasks.find(t=>t.id===worker.task_id),expected=worker.model,expectedVariant=worker.model_variant,taskID=task?.id??worker.task_id
    const clearModelMarkers=()=>{m.execution.blockers=m.execution.blockers.filter(b=>!b.startsWith(`model-projection-mismatch:${taskID}:`)&&!b.startsWith(`model-effective-unverified:${taskID}:`)&&!b.startsWith(`model-effective-mismatch:${taskID}:`)&&!b.startsWith(`model-variant-unverified:${taskID}:`)&&!b.startsWith(`model-variant-mismatch:${taskID}:`))}
    const requested=(worker.requested_model||worker.requested_model_variant)?{model:worker.requested_model,variant:worker.requested_model_variant,source:'task-override'}:undefined
    const selected=(worker.model||worker.model_variant)?{model:worker.model,variant:worker.model_variant,source:'runtime-resolver/current-worker-selection'}:undefined
    const projected=(worker.projected_model||worker.projected_model_variant)?{model:worker.projected_model,variant:worker.projected_model_variant,source:'opencode-child-or-prompt'}:undefined
    const identity=reconcileModelExecutionIdentity({requested,selected,projected,observed:observed?{model:observed.model,variant:observed.variant,source:observed.source??'assistant-message-metadata'}:undefined})
    worker.effective_model=identity.effective?.model;worker.effective_model_variant=identity.effective?.variant;worker.effective_model_source=identity.effective?.source??observed?.source??'assistant-message-metadata';worker.effective_model_observed_at=Date.now();worker.effective_model_verified=identity.modelVerified;worker.effective_model_variant_verified=identity.variantVerified
    if(identity.status==='host-default-or-unconstrained'){clearModelMarkers();appendLedger(m,'model.effective.observed',{task_id:task?.id,worker_id:worker.id,payload:{requested:worker.requested_model,selected:expected??'host-default',projected:worker.projected_model??'host-default/unrecorded',observed:observed?.model??'host-default/unreported',expected_variant:expectedVariant,projected_variant:worker.projected_model_variant,variant:observed?.variant,source:worker.effective_model_source}});return{ok:true,expected,observed:observed?.model,reason:'host-default-or-unconstrained'}}
    if(identity.status==='projection-mismatch'){const marker=`model-projection-mismatch:${taskID}:${expected??'unknown'}->${worker.projected_model??'unrecorded'}`;clearModelMarkers();m.execution.blockers.push(marker);appendLedger(m,'model.projection.mismatch',{task_id:task?.id,worker_id:worker.id,payload:{requested:worker.requested_model,selected:expected,projected:worker.projected_model,selected_variant:expectedVariant,projected_variant:worker.projected_model_variant}});return{ok:false,expected,observed:observed?.model,reason:marker}}
    if(identity.status==='model-unverified'){const marker=`model-effective-unverified:${taskID}:${expected}`;if(!m.execution.blockers.includes(marker))m.execution.blockers.push(marker);appendLedger(m,'model.effective.unverified',{task_id:task?.id,worker_id:worker.id,payload:{requested:worker.requested_model,selected:expected,projected:worker.projected_model,expected_variant:expectedVariant,source:worker.effective_model_source}});return{ok:false,expected,reason:marker}}
    if(identity.status==='model-mismatch'){const marker=`model-effective-mismatch:${taskID}:${expected}->${observed?.model}`;clearModelMarkers();m.execution.blockers.push(marker);appendLedger(m,'model.effective.mismatch',{task_id:task?.id,worker_id:worker.id,payload:{requested:worker.requested_model,selected:expected,projected:worker.projected_model,observed:observed?.model,expected_variant:expectedVariant,variant:observed?.variant,source:worker.effective_model_source}});return{ok:false,expected,observed:observed?.model,reason:marker}}
    if(identity.status==='variant-unverified'){const marker=`model-variant-unverified:${taskID}:${expectedVariant}`;clearModelMarkers();m.execution.blockers.push(marker);appendLedger(m,'model.variant.unverified',{task_id:task?.id,worker_id:worker.id,payload:{model:expected,projected:worker.projected_model,expected_variant:expectedVariant,projected_variant:worker.projected_model_variant,source:worker.effective_model_source}});return{ok:false,expected,observed:observed?.model,reason:marker}}
    if(identity.status==='variant-mismatch'){const marker=`model-variant-mismatch:${taskID}:${expectedVariant}->${observed?.variant}`;clearModelMarkers();m.execution.blockers.push(marker);appendLedger(m,'model.variant.mismatch',{task_id:task?.id,worker_id:worker.id,payload:{model:expected,projected:worker.projected_model,expected_variant:expectedVariant,projected_variant:worker.projected_model_variant,observed_variant:observed?.variant,source:worker.effective_model_source}});return{ok:false,expected,observed:observed?.model,reason:marker}}
    clearModelMarkers();appendLedger(m,'model.effective.verified',{task_id:task?.id,worker_id:worker.id,payload:{requested:worker.requested_model,selected:expected,projected:worker.projected_model,observed:observed?.model,expected_variant:expectedVariant,projected_variant:worker.projected_model_variant,variant:observed?.variant,variant_verified:identity.variantVerified,source:worker.effective_model_source}});return{ok:true,expected,observed:observed?.model,reason:expectedVariant?'effective-model-and-variant-match-runtime-selection':'effective-model-matches-runtime-selection'}
  }
}
