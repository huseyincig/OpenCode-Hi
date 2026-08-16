import {spawnSync} from 'node:child_process'
import {realpathSync} from 'node:fs'
import {resolve} from 'node:path'
import type {OpenCodeClient} from './types.js'
import {createOpencodeClient as createOpenCodeV2Client} from '@opencode-ai/sdk/v2/client'
import type {WorkspaceLeaseContract} from '../contracts/workspace.js'
import type {WorkspaceExecutor,WorkspaceProvisionRequest,WorkspaceProvisioned,WorkspaceReconcileResult} from '../runtime/workspace/executor.js'

interface NativeWorkspace{id:string;type:string;name?:string;branch?:string|null;directory?:string|null;projectID?:string}
export interface GitWorkspaceInspection{head:string;common_dir:string;worktrees:string[]}
export type GitWorkspaceInspector=(directory:string)=>GitWorkspaceInspection
function nativeData<T>(value:any):T{const first=value&&typeof value==='object'&&'data'in value?value.data:value;return(first&&typeof first==='object'&&'data'in first?first.data:first) as T}
function git(directory:string,args:string[]):string{const r=spawnSync('git',['-C',directory,...args],{encoding:'utf8'});if(r.status!==0)throw new Error(`Git workspace inspection failed: ${String(r.stderr??r.stdout??'unknown error')}`);return String(r.stdout??'').trim()}
function canonicalExisting(path:string):string{return realpathSync(resolve(path))}
function defaultInspect(directory:string):GitWorkspaceInspection{
  const root=canonicalExisting(directory),head=git(root,['rev-parse','HEAD']),rawCommon=git(root,['rev-parse','--path-format=absolute','--git-common-dir']),common_dir=canonicalExisting(rawCommon),raw=git(root,['worktree','list','--porcelain','-z']),worktrees=raw.split('\0').filter(x=>x.startsWith('worktree ')).map(x=>canonicalExisting(x.slice('worktree '.length)))
  return{head,common_dir,worktrees}
}
function gitPathKey(path:string):string{
  if(process.platform!=='win32')return path
  let value=path.replaceAll('/','\\'),prefix='\\\\?\\',unc='\\\\?\\UNC\\'
  if(value.toLowerCase().startsWith(unc.toLowerCase()))value='\\\\'+value.slice(unc.length)
  else if(value.startsWith(prefix))value=value.slice(prefix.length)
  if(value.length>3)value=value.replace(/\\+$/,'')
  return value.toLowerCase()
}
function sameGitPath(a:string,b:string):boolean{return gitPathKey(a)===gitPathKey(b)}
function sameRepository(primary:GitWorkspaceInspection,workspace:GitWorkspaceInspection):boolean{return sameGitPath(primary.common_dir,workspace.common_dir)}

export class OpenCodeWorkspaceAdapter implements WorkspaceExecutor{
  #v2Client:any
  constructor(readonly client:OpenCodeClient,readonly serverUrl:URL,readonly directory:string,readonly inspector:GitWorkspaceInspector=defaultInspect){}
  #edge():any{return this.client as any}
  #workspace():any{
    const injected=this.#edge()?.v2?.experimental?.workspace??this.#edge()?.experimental?.workspace;if(injected)return injected
    if(!this.#v2Client&&this.serverUrl)this.#v2Client=createOpenCodeV2Client({baseUrl:this.serverUrl.toString(),directory:this.directory})
    const api=this.#v2Client?.experimental?.workspace
    if(!api||typeof api.create!=='function'||typeof api.list!=='function'||typeof api.remove!=='function')throw new Error('OpenCode experimental workspace API unavailable')
    return api
  }
  async health():Promise<{available:boolean;detail:string}>{try{await this.#workspace().list({directory:this.directory});return{available:true,detail:'OpenCode experimental workspace list observed'}}catch(error){return{available:false,detail:String(error)}}}
  async sourceBaseline(repositoryRoot:string):Promise<string>{const observed=this.inspector(repositoryRoot).head;if(!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(observed))throw new Error('Git source baseline is not an exact object id');return observed}
  #validate(native:NativeWorkspace,request:{repository_root:string;source_baseline:string;expected_path?:string;expected_id?:string;require_baseline?:boolean}):WorkspaceProvisioned{
    if(!native||typeof native.id!=='string'||!native.id.trim()||native.type!=='worktree'||typeof native.directory!=='string'||!native.directory.trim())throw new Error('OpenCode workspace response is not a bounded worktree identity')
    if(request.expected_id&&native.id!==request.expected_id)throw new Error(`OpenCode workspace identity mismatch: expected ${request.expected_id}, observed ${native.id}`)
    const primaryPath=canonicalExisting(request.repository_root),workspacePath=canonicalExisting(native.directory)
    if(primaryPath===workspacePath)throw new Error('Refusing workspace lease that resolves to the primary repository path')
    if(request.expected_path&&workspacePath!==canonicalExisting(request.expected_path))throw new Error(`OpenCode workspace path mismatch: expected ${request.expected_path}, observed ${workspacePath}`)
    const primary=this.inspector(primaryPath),workspace=this.inspector(workspacePath)
    if(request.require_baseline&&primary.head!==request.source_baseline)throw new Error(`Primary source baseline drifted before workspace binding: expected ${request.source_baseline}, observed ${primary.head}`)
    if(request.require_baseline&&workspace.head!==request.source_baseline)throw new Error(`Workspace source baseline mismatch: expected ${request.source_baseline}, observed ${workspace.head}`)
    if(!sameRepository(primary,workspace))throw new Error('OpenCode workspace is not registered to the same Git common repository')
    if(!primary.worktrees.some(path=>sameGitPath(path,workspacePath)))throw new Error('OpenCode workspace path is not present in the primary Git worktree registry')
    if(!workspace.worktrees.some(path=>sameGitPath(path,workspacePath)))throw new Error('Workspace Git view does not contain its own canonical worktree path')
    return{host_workspace_id:native.id,workspace_path:workspacePath,...(native.branch?{branch:String(native.branch)}:{})}
  }
  async #listNative():Promise<NativeWorkspace[]>{const raw=await this.#workspace().list({directory:this.directory}),items=nativeData<NativeWorkspace[]>(raw)??[];return Array.isArray(items)?items:[]}
  async #recoverLostCreate(beforeIDs:Set<string>,request:WorkspaceProvisionRequest,cause:unknown):Promise<WorkspaceProvisioned>{
    const after=await this.#listNative(),newItems=after.filter(x=>x?.id&&!beforeIDs.has(x.id)),valid:WorkspaceProvisioned[]=[]
    for(const item of newItems)try{valid.push(this.#validate(item,{...request,require_baseline:true}))}catch{}
    if(valid.length===1)return valid[0]
    throw new Error(`OpenCode workspace create failed and lost-ack reconciliation was ${valid.length?'ambiguous':'unproven'}: ${String(cause)}`)
  }
  async provision(request:WorkspaceProvisionRequest):Promise<WorkspaceProvisioned>{
    const before=this.inspector(request.repository_root);if(before.head!==request.source_baseline)throw new Error('Source baseline changed before OpenCode workspace provisioning')
    const beforeIDs=new Set((await this.#listNative()).map(x=>x?.id).filter((x):x is string=>typeof x==='string'&&Boolean(x)))
    let raw:any
    try{raw=await this.#workspace().create({directory:this.directory,type:'worktree'})}catch(createError){return this.#recoverLostCreate(beforeIDs,request,createError)}
    const native=nativeData<NativeWorkspace>(raw)
    if(!native||typeof native.id!=='string'||native.type!=='worktree'||typeof native.directory!=='string')return this.#recoverLostCreate(beforeIDs,request,raw?.error??'invalid create response')
    try{return this.#validate(native,{...request,require_baseline:true})}catch(error){if(native?.id)try{await this.#workspace().remove({id:native.id,directory:this.directory})}catch{};throw error}
  }
  async reconcile(lease:WorkspaceLeaseContract):Promise<WorkspaceReconcileResult>{
    const raw=await this.#workspace().list({directory:this.directory}),items=nativeData<NativeWorkspace[]>(raw)??[],native=Array.isArray(items)?items.find(x=>x?.id===lease.host_workspace_id):undefined
    if(!native){const primary=this.inspector(lease.repository_root),target=resolve(lease.workspace_path);const stillRegistered=primary.worktrees.some(x=>sameGitPath(resolve(x),target));if(!stillRegistered&&(lease.status==='CLOSED'||lease.cleanup_state==='CLEANUP_PENDING'||lease.cleanup_state==='CLEANED'))return{disposition:'CLOSED',lease:{...lease,status:'CLOSED',cleanup_state:'CLEANED'}};return{disposition:'ORPHANED',lease:{...lease,status:'ORPHANED',cleanup_state:'QUARANTINED'}}}
    try{this.#validate(native,{repository_root:lease.repository_root,source_baseline:lease.source_baseline,expected_path:lease.workspace_path,expected_id:lease.host_workspace_id,require_baseline:false});return{disposition:'ADOPTED',lease:{...lease,status:'ACTIVE',cleanup_state:'ACTIVE'}}}catch{return{disposition:'ORPHANED',lease:{...lease,status:'ORPHANED',cleanup_state:'QUARANTINED'}}}
  }
  async cleanup(lease:WorkspaceLeaseContract):Promise<void>{
    if(!lease.host_workspace_id)throw new Error('Workspace cleanup requires host_workspace_id')
    const primary=this.inspector(lease.repository_root),target=canonicalExisting(lease.workspace_path);if(target===canonicalExisting(lease.repository_root))throw new Error('Refusing cleanup of primary repository path')
    if(!primary.worktrees.some(path=>sameGitPath(path,target)))throw new Error('Refusing workspace cleanup for path outside the registered Git worktree set')
    await this.#workspace().remove({id:lease.host_workspace_id,directory:this.directory})
    const raw=await this.#workspace().list({directory:this.directory}),items=nativeData<NativeWorkspace[]>(raw)??[];if(Array.isArray(items)&&items.some(x=>x?.id===lease.host_workspace_id))throw new Error('OpenCode workspace still exists after cleanup');const after=this.inspector(lease.repository_root);if(after.worktrees.some(x=>sameGitPath(resolve(x),target)))throw new Error('Git worktree registry still contains workspace after cleanup')
  }
}
