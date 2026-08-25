import {existsSync,mkdirSync,readFileSync,renameSync,rmSync,statSync,writeFileSync} from 'node:fs'
import {dirname,extname,join,resolve} from 'node:path'
import {OPERATIONAL_TOOL_RECEIPT_SCHEMA,assertOperationalToolDefinition,type OperationalToolAuthority,type OperationalToolDefinition,type OperationalToolDiscoverySource,type OperationalToolProvisioningReceipt,type OperationalToolResolutionScope,type OperationalToolSmokeReceipt} from '../../contracts/operational-tool.js'
import {projectOperationalToolLockPath,projectOperationalToolReceiptPath,projectOperationalToolRoot} from '../storage/ownership.js'

export interface OperationalToolDiscovery{executable_path:string;source:Exclude<OperationalToolDiscoverySource,'provisioned'>;scope:OperationalToolResolutionScope;version?:string}
export interface OperationalToolProvisioned{executable_path:string;scope:'project-local'|'ephemeral';version?:string}
export interface OperationalToolContext{project_root:string;tool_root:string;implementation_root:string}
export interface OperationalToolAdapter{
  definition:OperationalToolDefinition
  discover:(context:OperationalToolContext)=>Promise<OperationalToolDiscovery|undefined>|OperationalToolDiscovery|undefined
  provision?:(context:OperationalToolContext)=>Promise<OperationalToolProvisioned>
  smoke:(executablePath:string,context:OperationalToolContext)=>Promise<Omit<OperationalToolSmokeReceipt,'checked_at'>>
  cleanup?:(provisioned:OperationalToolProvisioned,context:OperationalToolContext)=>Promise<void>|void
}
export interface OperationalToolEnsureInput{authority?:OperationalToolAuthority}

const LOCK_TIMEOUT_MS=2_000,STALE_LOCK_MS=5*60_000
const sleep=(ms:number)=>new Promise<void>(resolveSleep=>setTimeout(resolveSleep,ms))
function errorCode(error:unknown):string|undefined{return typeof error==='object'&&error!==null&&'code' in error?String((error as {code?:unknown}).code):undefined}
function processAlive(pid:number):boolean{if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true}catch(error){return errorCode(error)==='EPERM'}}
function bounded(value:string,max=1000):string{return value.length<=max?value:value.slice(0,max)}
function inside(root:string,path:string):boolean{const r=resolve(root),p=resolve(path);return p===r||p.startsWith(`${r}/`)||p.startsWith(`${r}\\`)}

export function discoverOperationalToolOnPath(executable:string,options:{env?:Record<string,string|undefined>;platform?:string;exists?:(path:string)=>boolean;pathJoin?:(left:string,right:string)=>string;pathDelimiter?:string}={}):string|undefined{
  const name=executable.trim();if(!name)return undefined
  const platform=options.platform??process.platform,env=options.env??process.env,exists=options.exists??existsSync,pathJoin=options.pathJoin??((left,right)=>join(left,right)),split=options.pathDelimiter??(platform==='win32'?';':':')
  const absolute=platform==='win32'?/^(?:[A-Za-z]:[\\/]|\\\\)/.test(name):name.startsWith('/')
  if(absolute)return exists(name)?name:undefined
  const entries=(env.PATH??'').split(split).filter(Boolean),explicit=platform==='win32'&&extname(name).length>0,extensions=platform==='win32'?(explicit?['']:(env.PATHEXT??'.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)):['']
  for(const entry of entries)for(const extension of extensions){const candidate=pathJoin(entry,`${name}${extension}`);if(exists(candidate))return candidate}
  return undefined
}

export class OperationalToolProvisioner{
  readonly projectRoot:string
  readonly toolRoot:string
  readonly #byCapability=new Map<string,OperationalToolAdapter[]>()
  readonly #inflight=new Map<string,Promise<OperationalToolProvisioningReceipt>>()
  readonly #last=new Map<string,OperationalToolProvisioningReceipt>()
  constructor(projectRoot:string,adapters:readonly OperationalToolAdapter[]=[]){
    this.projectRoot=resolve(projectRoot)
    this.toolRoot=projectOperationalToolRoot(this.projectRoot)
    for(const adapter of adapters)this.register(adapter)
  }
  register(adapter:OperationalToolAdapter):void{
    assertOperationalToolDefinition(adapter.definition)
    const definition=adapter.definition
    if(definition.provision_scope==='none'&&adapter.provision)throw new Error(`Operational tool ${definition.implementation_id} cannot provision with scope=none`)
    const rows=this.#byCapability.get(definition.capability)??[]
    if(rows.some(item=>item.definition.implementation_id===definition.implementation_id))throw new Error(`Duplicate operational tool implementation: ${definition.capability}/${definition.implementation_id}`)
    rows.push(adapter)
    this.#byCapability.set(definition.capability,rows)
  }
  last(capability:string):OperationalToolProvisioningReceipt|undefined{
    const item=this.#last.get(capability)
    return item?structuredClone(item):undefined
  }
  async ensure(capability:string,input:OperationalToolEnsureInput={}):Promise<OperationalToolProvisioningReceipt>{
    const key=capability.trim()
    if(!key)throw new Error('Operational tool capability is required')
    const current=this.#inflight.get(key)
    if(current)return structuredClone(await current)
    const run=this.#ensure(key,input)
    this.#inflight.set(key,run)
    try{const receipt=await run;this.#last.set(key,receipt);return structuredClone(receipt)}finally{this.#inflight.delete(key)}
  }
  async #ensure(capability:string,input:OperationalToolEnsureInput):Promise<OperationalToolProvisioningReceipt>{
    const adapters=this.#byCapability.get(capability)??[]
    if(!adapters.length)throw new Error(`No code-owned operational tool implementation is registered for capability: ${capability}`)
    const failures:string[]=[]
    for(const adapter of adapters){
      const context=this.#context(adapter.definition)
      const discovered=await adapter.discover(context)
      if(discovered){
        const smoke=await this.#smoke(adapter,discovered.executable_path,context)
        if(smoke.ok)return this.#persist(adapter.definition,{status:discovered.scope==='project-local'?'cached':'existing',scope:discovered.scope,source:discovered.source,path:discovered.executable_path,version:discovered.version,smoke,authority:input.authority})
        failures.push(`${adapter.definition.implementation_id}: discovered implementation failed smoke: ${smoke.detail??'unknown'}`)
      }
      if(!adapter.provision||adapter.definition.provision_scope==='none')continue
      if(!input.authority){failures.push(`${adapter.definition.implementation_id}: provisioning requires authority context`);continue}
      if(adapter.definition.provision_scope!=='project-local'&&adapter.definition.provision_scope!=='ephemeral')throw new Error(`Global/system operational tool provisioning is forbidden: ${adapter.definition.implementation_id}`)
      const release=await this.#acquireLock(adapter.definition)
      try{
        const afterLock=await adapter.discover(context)
        if(afterLock){
          const smoke=await this.#smoke(adapter,afterLock.executable_path,context)
          if(smoke.ok)return this.#persist(adapter.definition,{status:afterLock.scope==='project-local'?'cached':'existing',scope:afterLock.scope,source:afterLock.source,path:afterLock.executable_path,version:afterLock.version,smoke,authority:input.authority})
        }
        let provisioned:OperationalToolProvisioned|undefined
        try{
          provisioned=await adapter.provision(context)
          if(provisioned.scope!==adapter.definition.provision_scope)throw new Error(`Provisioner scope mismatch: expected ${adapter.definition.provision_scope}, received ${provisioned.scope}`)
          if(provisioned.scope==='project-local'&&!inside(context.implementation_root,provisioned.executable_path))throw new Error('Project-local operational tool escaped its owned implementation root')
          const smoke=await this.#smoke(adapter,provisioned.executable_path,context)
          if(!smoke.ok){
            if(adapter.cleanup)await adapter.cleanup(provisioned,context)
            failures.push(`${adapter.definition.implementation_id}: provisioned implementation failed smoke: ${smoke.detail??'unknown'}`)
            continue
          }
          return this.#persist(adapter.definition,{status:'provisioned',scope:provisioned.scope,source:'provisioned',path:provisioned.executable_path,version:provisioned.version,smoke,authority:input.authority})
        }catch(error){
          if(provisioned&&adapter.cleanup)try{await adapter.cleanup(provisioned,context)}catch{}
          failures.push(`${adapter.definition.implementation_id}: ${bounded(String(error))}`)
        }
      }finally{release()}
    }
    throw new Error(`Operational tool capability unavailable: ${capability}. ${failures.join(' | ')||'no implementation resolved'}`)
  }
  #context(definition:OperationalToolDefinition):OperationalToolContext{
    return{project_root:this.projectRoot,tool_root:this.toolRoot,implementation_root:resolve(this.toolRoot,definition.capability,definition.implementation_id)}
  }
  async #smoke(adapter:OperationalToolAdapter,path:string,context:OperationalToolContext):Promise<OperationalToolSmokeReceipt>{
    if(!existsSync(path))return{ok:false,checked_at:Date.now(),detail:'resolved executable path does not exist'}
    try{const result=await adapter.smoke(path,context);return{...result,checked_at:Date.now(),detail:result.detail?bounded(result.detail):undefined}}catch(error){return{ok:false,checked_at:Date.now(),detail:bounded(String(error))}}
  }
  #persist(definition:OperationalToolDefinition,input:{status:'existing'|'cached'|'provisioned';scope:OperationalToolResolutionScope;source:OperationalToolDiscoverySource;path:string;version?:string;smoke:OperationalToolSmokeReceipt;authority?:OperationalToolAuthority}):OperationalToolProvisioningReceipt{
    const receiptPath=projectOperationalToolReceiptPath(this.projectRoot,definition.capability,definition.implementation_id)
    const receipt:OperationalToolProvisioningReceipt={schema:OPERATIONAL_TOOL_RECEIPT_SCHEMA,capability:definition.capability,implementation_id:definition.implementation_id,dependency_class:'operational-tool',status:input.status,scope:input.scope,discovery_source:input.source,executable_path:resolve(input.path),requested_version:definition.version,resolved_version:input.version??input.smoke.version,project_tool_root:this.toolRoot,authority:input.authority,smoke:input.smoke,receipt_path:receiptPath,observed_at:Date.now()}
    mkdirSync(dirname(receiptPath),{recursive:true})
    const tmp=`${receiptPath}.${process.pid}.${Date.now()}.tmp`
    writeFileSync(tmp,JSON.stringify(receipt,null,2)+'\n')
    renameSync(tmp,receiptPath)
    return receipt
  }
  async #acquireLock(definition:OperationalToolDefinition):Promise<()=>void>{
    const lock=projectOperationalToolLockPath(this.projectRoot,definition.capability,definition.implementation_id),deadline=Date.now()+LOCK_TIMEOUT_MS
    mkdirSync(dirname(lock),{recursive:true})
    while(Date.now()<=deadline){
      try{
        mkdirSync(lock)
        writeFileSync(`${lock}/owner.json`,JSON.stringify({schema:1,pid:process.pid,created_at:Date.now()}))
        return()=>rmSync(lock,{recursive:true,force:true})
      }catch(error){
        if(errorCode(error)!=='EEXIST')throw error
        let stale=false
        try{
          const raw=JSON.parse(readFileSync(`${lock}/owner.json`,'utf8')) as {pid?:unknown}
          stale=!processAlive(Number(raw.pid))
        }catch{
          try{stale=Date.now()-statSync(lock).mtimeMs>STALE_LOCK_MS}catch{stale=true}
        }
        if(stale){rmSync(lock,{recursive:true,force:true});continue}
        await sleep(25)
      }
    }
    throw new Error(`Timed out waiting for operational tool provision lock: ${definition.capability}/${definition.implementation_id}`)
  }
}
