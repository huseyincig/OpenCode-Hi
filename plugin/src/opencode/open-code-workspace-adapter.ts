import {spawnSync} from 'node:child_process'
import {realpathSync,statSync} from 'node:fs'
import {resolve} from 'node:path'
import type {OpenCodeClient} from './types.js'
import {createOpencodeClient as createOpenCodeV2Client} from '@opencode-ai/sdk/v2/client'
import type {WorkspaceLeaseContract} from '../contracts/workspace.js'
import type {WorkspaceExecutor,WorkspaceProvisionRequest,WorkspaceProvisioned,WorkspaceReintegrateRequest,WorkspaceReintegrated,WorkspaceReconcileResult} from '../runtime/workspace/executor.js'

interface NativeWorkspace{id:string;type:string;name?:string;branch?:string|null;directory?:string|null;projectID?:string}
interface WorkspaceCreationBaseline{ids:Set<string>;paths:string[]}
export interface GitWorkspaceInspection{head:string;common_dir:string;worktrees:string[]}
export type GitWorkspaceInspector=(directory:string)=>GitWorkspaceInspection
function nativeData<T>(value:any):T{const first=value&&typeof value==='object'&&'data'in value?value.data:value;return(first&&typeof first==='object'&&'data'in first?first.data:first) as T}
export function openCodeExperimentalWorkspacesEnabled(env:Record<string,string|undefined>=process.env):boolean{
  const direct=env.OPENCODE_EXPERIMENTAL_WORKSPACES,value=(direct===undefined?env.OPENCODE_EXPERIMENTAL:direct)?.toLowerCase()
  return value==='true'||value==='1'
}
function git(directory:string,args:string[]):string{const safe=canonicalExisting(directory),r=spawnSync('git',['-c',`safe.directory=${safe}`,'-C',safe,...args],{encoding:'utf8'});if(r.status!==0)throw new Error(`Git workspace inspection failed: ${String(r.stderr??r.stdout??'unknown error')}`);return String(r.stdout??'').trim()}
function canonicalExisting(path:string):string{return realpathSync(resolve(path))}
function defaultInspect(directory:string):GitWorkspaceInspection{
  const root=canonicalExisting(directory),head=git(root,['rev-parse','HEAD']),rawCommon=git(root,['rev-parse','--path-format=absolute','--git-common-dir']),common_dir=canonicalExisting(rawCommon),raw=git(root,['worktree','list','--porcelain','-z']),worktrees=raw.split('\0').filter(x=>x.startsWith('worktree ')).map(x=>canonicalExisting(x.slice('worktree '.length)))
  return{head,common_dir,worktrees}
}
function relativeGitPaths(directory:string):string[]{
  const tracked=git(directory,['diff','--name-only','HEAD','--']).split(/\r?\n/),untracked=git(directory,['ls-files','--others','--exclude-standard','--']).split(/\r?\n/)
  return[...new Set([...tracked,...untracked].map(x=>x.trim().replaceAll('\\','/').replace(/^\.\//,'')).filter(Boolean))].sort()
}
function ownsScope(scope:string[],path:string):boolean{const p=path.replaceAll('\\','/').replace(/^\.\//,'').replace(/\/+$/,''),items=scope.map(x=>x.replaceAll('\\','/').replace(/^\.\//,'').replace(/\/+$/,'')).filter(Boolean);return items.some(x=>p===x||p.startsWith(`${x}/`))}
function sameStringSet(a:string[],b:string[]):boolean{return a.length===b.length&&a.every((x,i)=>x===b[i])}
function gitPathKey(path:string):string{
  if(process.platform!=='win32')return path
  let value=path.replaceAll('/','\\'),prefix='\\\\?\\',unc='\\\\?\\UNC\\'
  if(value.toLowerCase().startsWith(unc.toLowerCase()))value='\\\\'+value.slice(unc.length)
  else if(value.startsWith(prefix))value=value.slice(prefix.length)
  if(value.length>3)value=value.replace(/\\+$/,'')
  return value.toLowerCase()
}
const statIdentity=statSync as unknown as (path:string,options:{bigint:true})=>{dev:bigint;ino:bigint}
// Windows may expose the same NTFS directory through a long name or an 8.3 alias; compare existing paths by exact filesystem identity after canonical string comparison.
function sameGitPath(a:string,b:string):boolean{if(gitPathKey(a)===gitPathKey(b))return true;if(process.platform!=='win32')return false;try{const left=statIdentity(a,{bigint:true}),right=statIdentity(b,{bigint:true});return left.ino!==0n&&right.ino!==0n&&left.dev===right.dev&&left.ino===right.ino}catch{return false}}
function sameRepository(primary:GitWorkspaceInspection,workspace:GitWorkspaceInspection):boolean{return sameGitPath(primary.common_dir,workspace.common_dir)}

export class OpenCodeWorkspaceAdapter implements WorkspaceExecutor{
  #v2Client:any
  constructor(readonly client:OpenCodeClient,readonly serverUrl:URL,readonly directory:string,readonly inspector:GitWorkspaceInspector=defaultInspect){}
  #edge():any{return this.client as any}
  #v2Workspace():any{
    if(!this.#v2Client&&this.serverUrl)this.#v2Client=createOpenCodeV2Client({baseUrl:this.serverUrl.toString(),directory:this.directory})
    return this.#v2Client?.experimental?.workspace
  }
  #workspace():any{
    const injected=this.#edge()?.v2?.experimental?.workspace??this.#edge()?.experimental?.workspace;if(injected)return injected
    const api=this.#v2Workspace()
    if(!api||typeof api.create!=='function'||typeof api.list!=='function'||typeof api.remove!=='function')throw new Error('OpenCode experimental workspace API unavailable')
    return api
  }
  #workspaceWarp():any{
    const injected=this.#edge()?.v2?.experimental?.workspace??this.#edge()?.experimental?.workspace;if(typeof injected?.warp==='function')return injected
    const api=this.#v2Workspace();if(!api||typeof api.warp!=='function')throw new Error('OpenCode native workspace warp/copyChanges API unavailable')
    return api
  }
  async health():Promise<{available:boolean;detail:string}>{if(!openCodeExperimentalWorkspacesEnabled())return{available:false,detail:'OpenCode experimental workspace support is disabled; set OPENCODE_EXPERIMENTAL_WORKSPACES=true before starting OpenCode'};try{await this.#workspace().list({directory:this.directory});return{available:true,detail:'OpenCode experimental workspace list observed with workspace support enabled'}}catch(error){return{available:false,detail:String(error)}}}
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
  #creationBaseline(items:NativeWorkspace[]):WorkspaceCreationBaseline{const ids=new Set<string>(),paths:string[]=[];for(const item of items){if(typeof item?.id==='string'&&item.id)ids.add(item.id);if(typeof item?.directory==='string'&&item.directory)try{const path=canonicalExisting(item.directory);if(!paths.some(existing=>sameGitPath(existing,path)))paths.push(path)}catch{}}return{ids,paths}}
  #aliasesCreationPath(native:NativeWorkspace,before:WorkspaceCreationBaseline):boolean{if(typeof native?.directory!=='string'||!native.directory)return false;try{const path=canonicalExisting(native.directory);return before.paths.some(existing=>sameGitPath(existing,path))}catch{return false}}
  async #recoverLostCreate(before:WorkspaceCreationBaseline,request:WorkspaceProvisionRequest,cause:unknown):Promise<WorkspaceProvisioned>{
    const after=await this.#listNative(),newItems=after.filter(x=>x?.id&&!before.ids.has(x.id)&&!this.#aliasesCreationPath(x,before)),valid:WorkspaceProvisioned[]=[]
    for(const item of newItems)try{valid.push(this.#validate(item,{...request,require_baseline:true}))}catch{}
    if(valid.length===1)return valid[0]
    throw new Error(`OpenCode workspace create failed and lost-ack reconciliation was ${valid.length?'ambiguous':'unproven'}: ${String(cause)}`)
  }
  async provision(request:WorkspaceProvisionRequest):Promise<WorkspaceProvisioned>{
    if(!openCodeExperimentalWorkspacesEnabled())throw new Error('OpenCode experimental workspace support is disabled; set OPENCODE_EXPERIMENTAL_WORKSPACES=true before starting OpenCode')
    const before=this.inspector(request.repository_root);if(before.head!==request.source_baseline)throw new Error('Source baseline changed before OpenCode workspace provisioning')
    const creationBaseline=this.#creationBaseline(await this.#listNative())
    let raw:any
    try{raw=await this.#workspace().create({directory:this.directory,type:'worktree'})}catch(createError){return this.#recoverLostCreate(creationBaseline,request,createError)}
    const native=nativeData<NativeWorkspace>(raw)
    if(!native||typeof native.id!=='string'||native.type!=='worktree'||typeof native.directory!=='string')return this.#recoverLostCreate(creationBaseline,request,raw?.error??'invalid create response')
    if(creationBaseline.ids.has(native.id))throw new Error(`OpenCode workspace create returned pre-existing workspace identity ${native.id}`)
    if(this.#aliasesCreationPath(native,creationBaseline))throw new Error(`OpenCode workspace create returned pre-existing workspace path ${native.directory}`)
    try{return this.#validate(native,{...request,require_baseline:true})}catch(error){if(native?.id&&!creationBaseline.ids.has(native.id)&&!this.#aliasesCreationPath(native,creationBaseline))try{await this.#workspace().remove({id:native.id,directory:this.directory})}catch{};throw error}
  }
  async reintegrate(request:WorkspaceReintegrateRequest):Promise<WorkspaceReintegrated>{
    const {lease}=request
    if(lease.status!=='ACTIVE'||lease.cleanup_state!=='ACTIVE'||!lease.host_workspace_id)throw new Error('Workspace reintegration requires one active exact lease')
    const primary=this.inspector(lease.repository_root),workspace=this.inspector(lease.workspace_path)
    if(primary.head!==lease.source_baseline)throw new Error(`Primary source baseline drifted before workspace reintegration: expected ${lease.source_baseline}, observed ${primary.head}`)
    if(workspace.head!==lease.source_baseline)throw new Error(`Workspace source baseline drifted before reintegration: expected ${lease.source_baseline}, observed ${workspace.head}`)
    if(!sameRepository(primary,workspace))throw new Error('Workspace reintegration source is not the same Git common repository')
    const actual=relativeGitPaths(lease.workspace_path),expected=[...new Set(request.expected_changed_files.map(x=>x.trim().replaceAll('\\','/').replace(/^\.\//,'')).filter(Boolean))].sort()
    if(!actual.length)throw new Error('Workspace reintegration has no actual changed files to apply')
    if(!sameStringSet(actual,expected))throw new Error(`Workspace reintegration changed-file mismatch: expected ${expected.join(',')||'none'}, observed ${actual.join(',')||'none'}`)
    const outside=actual.filter(file=>!ownsScope(request.task_scope,file));if(outside.length)throw new Error(`Workspace reintegration refuses out-of-scope changes: ${outside.join(',')}`)
    const primaryBefore=relativeGitPaths(lease.repository_root),conflicts=actual.filter(file=>primaryBefore.includes(file));if(conflicts.length)throw new Error(`Workspace reintegration refuses user/current primary changes on isolated task scope: ${conflicts.join(',')}`)
    const api=this.#workspaceWarp()
    let raw:any
    try{raw=await api.warp({directory:this.directory,id:null,sessionID:request.session_id,copyChanges:true})}catch(error){throw new Error(`OpenCode workspace reintegration failed before ownership could be verified: ${String(error)}`)}
    if(raw?.error)throw new Error(`OpenCode workspace reintegration rejected: ${String(raw.error?.message??raw.error)}`)
    const primaryAfter=relativeGitPaths(lease.repository_root),newPaths=primaryAfter.filter(file=>!primaryBefore.includes(file));const missing=actual.filter(file=>!primaryAfter.includes(file)),unexpected=newPaths.filter(file=>!actual.includes(file))
    if(missing.length||unexpected.length)throw new Error(`Workspace reintegration post-apply mismatch: missing=${missing.join(',')||'none'} unexpected=${unexpected.join(',')||'none'}`)
    return{applied_files:actual}
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
    const current=(await this.#listNative()).find(item=>item?.id===lease.host_workspace_id);if(!current)throw new Error(`OpenCode workspace identity ${lease.host_workspace_id} is missing before cleanup`)
    this.#validate(current,{repository_root:lease.repository_root,source_baseline:lease.source_baseline,expected_path:lease.workspace_path,expected_id:lease.host_workspace_id,require_baseline:false})
    await this.#workspace().remove({id:lease.host_workspace_id,directory:this.directory})
    const raw=await this.#workspace().list({directory:this.directory}),items=nativeData<NativeWorkspace[]>(raw)??[];if(Array.isArray(items)&&items.some(x=>x?.id===lease.host_workspace_id))throw new Error('OpenCode workspace still exists after cleanup');const after=this.inspector(lease.repository_root);if(after.worktrees.some(x=>sameGitPath(resolve(x),target)))throw new Error('Git worktree registry still contains workspace after cleanup')
  }
}
