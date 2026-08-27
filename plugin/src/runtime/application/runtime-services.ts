import type {HiConfig} from '../../config/schema.js'
import type {AvailableModel} from '../routing/model-resolver.js'
import type {RuntimeSignalSink} from '../events/event-sink.js'
import type {NativeProjectContext} from '../intent/repo-context.js'
import type {ChildSessionPort,HostAssistantResult} from '../host/port.js'
import type {HostCapabilityContract} from '../../contracts/host-capability.js'
import type {ProcessExecutor} from '../process/executor.js'
import type {WorkspaceExecutor} from '../workspace/executor.js'
import type {BrowserExecutor,BrowserExecutionContext} from '../browser/executor.js'
import {OperationalToolProvisioner} from '../tools/provisioning.js'
import type {OperationalToolProvisioningReceipt} from '../../contracts/operational-tool.js'
import {relative} from 'node:path'
import {rmSync} from 'node:fs'
import {MissionStore} from '../mission/mission-store.js'
import {BackgroundRegistry} from '../background/registry.js'
import {RuntimePersistence} from '../state/persistence.js'
import {createConcurrencyPolicySource} from '../scheduler/concurrency.js'
import {TaskRuntime} from '../task/task-runtime.js'
import {appendLedger} from '../ledger/ledger.js'
import {createRuntimeScopedStores} from './runtime-scoped-stores.js'
import {ProcessRuntime} from '../process/runtime.js'
import {WorkspaceRuntime} from '../workspace/runtime.js'
import {ChatHumanDecisionTransport} from '../human-decision/transport.js'
import {LocalPreviewManager} from '../browser/local-preview.js'

export interface RuntimeServicePorts{
  nativeContext:NativeProjectContext
  childSession:ChildSessionPort
  readAssistantResult?:(sessionID:string,limit?:number)=>Promise<HostAssistantResult>
  hostCapabilities:readonly HostCapabilityContract[]
  process:ProcessExecutor
  workspace:WorkspaceExecutor
  createBrowser:(persist:(bytes:Uint8Array,context:BrowserExecutionContext)=>string)=>BrowserExecutor
  bootstrapBrowser?:()=>Promise<{available:boolean;attempted?:boolean;cachePath?:string;version?:string;executablePath?:string;reason?:string}>
  browserTool?:{implementationId:string;version?:string;cachePath:string;discover:()=>string|undefined}
  onBrowserAvailability?:(available:boolean)=>void
}

export function createRuntimeServices(input:{ports:RuntimeServicePorts;projectRoot:string;packageRoot:string;getConfig:()=>HiConfig;getModels:()=>AvailableModel[];getHostConfig:()=>Record<string,unknown>}){
  const {ports,projectRoot,packageRoot,getConfig,getModels,getHostConfig}=input
  const store=new MissionStore(projectRoot,ports.nativeContext,()=>getConfig().primaryMode,()=>({mode:getConfig().execution.topology,maxAgents:getConfig().execution.maxAgents,parallelism:getConfig().execution.parallelism}))
  const background=new BackgroundRegistry()
  const humanDecisionTransport=new ChatHumanDecisionTransport()
  const scopedStores=createRuntimeScopedStores(projectRoot,packageRoot)
  const persistence=new RuntimePersistence(projectRoot)
  const restored=persistence.load()
  if(persistence.lastLoadReport.error)throw new Error(`OpenCode-Hi runtime state is invalid and was not discarded: ${persistence.lastLoadReport.error}. Reconcile or remove the invalid runtime-state file explicitly before restarting Hi.`)
  store.restore(restored,persistence.lastLoadReport.uncleanShutdown===true)
  for(const m of store.all())for(const w of m.execution.workers)if(!['completed','failed','cancelled'].includes(w.status))background.set(w)
  persistence.markRunning(store.all())
  const scheduler=createConcurrencyPolicySource(()=>({global:getConfig().parallel.enabled?getConfig().parallel.max:1,providers:getConfig().parallel.providers,models:getConfig().parallel.models}))
  const eventSink:RuntimeSignalSink=ev=>{const m=store.all().find(x=>x.identity.mission_id===ev.mission_id);if(m)appendLedger(m,`event.${ev.type}`,{task_id:ev.task_id,worker_id:ev.worker_id,payload:ev.payload})}
  const browserExecutor=ports.createBrowser((bytes,c)=>{const a=scopedStores.contextArtifacts.addBinary('browser-screenshot',`Browser screenshot for ${c.task_id}`,bytes,{extension:'png',mediaType:'image/png',producer:'hi-browser-executor',consumerRefs:[`task:${c.task_id}`]});return`hi-artifact:${a.artifact_id}`})
  let browserAvailable=false,browserBootstrapStatus:{available:boolean;attempted?:boolean;cachePath?:string;version?:string;executablePath?:string;reason?:string}|undefined,browserToolReceipt:OperationalToolProvisioningReceipt|undefined
  const setBrowserAvailable=(value:boolean)=>{browserAvailable=value;ports.onBrowserAvailability?.(value)}
  const operationalTools=new OperationalToolProvisioner(projectRoot)
  if(ports.browserTool)operationalTools.register({definition:{capability:'browser-execution',implementation_id:ports.browserTool.implementationId,dependency_class:'operational-tool',version:ports.browserTool.version,provision_scope:'project-local',smoke:'browser-executor-health'},discover:()=>{const executable=ports.browserTool?.discover();if(!executable)return undefined;const rel=relative(operationalTools.toolRoot,executable),managed=rel===''||(!rel.startsWith('..')&&!rel.startsWith('/')&&!rel.startsWith('\\'));return{executable_path:executable,source:managed?'project-local-cache':'host',scope:managed?'project-local':'existing',version:ports.browserTool?.version}},provision:async()=>{if(!ports.bootstrapBrowser)throw new Error('Playwright browser bootstrap adapter unavailable');browserBootstrapStatus=await ports.bootstrapBrowser();if(!browserBootstrapStatus.available||!browserBootstrapStatus.executablePath)throw new Error(browserBootstrapStatus.reason??'Playwright Chromium bootstrap did not resolve an executable');return{executable_path:browserBootstrapStatus.executablePath,scope:'project-local',version:browserBootstrapStatus.version}},smoke:async()=>{const health=await browserExecutor.health();return{ok:health.available,detail:health.available?'Playwright browser executor health passed':(health.reason??'browser executor unavailable'),version:ports.browserTool?.version}},cleanup:async()=>{rmSync(ports.browserTool!.cachePath,{recursive:true,force:true})}})
  const ensureBrowserAvailable=async()=>{
    if(ports.browserTool)try{browserToolReceipt=await operationalTools.ensure('browser-execution',{authority:{source:'task-requirement',ref:'semantic:browser-execution'}});const available=browserToolReceipt.smoke.ok===true;setBrowserAvailable(available);return{available,attempted:browserToolReceipt.status==='provisioned',reason:available?undefined:(browserToolReceipt.smoke.detail??'browser operational-tool smoke failed'),implementationId:browserToolReceipt.implementation_id,status:browserToolReceipt.status,scope:browserToolReceipt.scope,receiptPath:browserToolReceipt.receipt_path}}catch(error){setBrowserAvailable(false);return{available:false,attempted:browserBootstrapStatus?.attempted,reason:String(error),implementationId:ports.browserTool.implementationId,receiptPath:browserToolReceipt?.receipt_path}}
    if(browserAvailable)return{available:true,attempted:false}
    if(ports.bootstrapBrowser)browserBootstrapStatus=await ports.bootstrapBrowser();const health=await browserExecutor.health();setBrowserAvailable(health.available);return{available:health.available,attempted:browserBootstrapStatus?.attempted,reason:health.available?undefined:(browserBootstrapStatus?.reason??health.reason)}
  }
  const getBrowserBootstrapStatus=()=>browserBootstrapStatus?{...browserBootstrapStatus}:undefined
  const getBrowserToolReceipt=()=>browserToolReceipt?structuredClone(browserToolReceipt):operationalTools.last('browser-execution')
  const workspaceRuntime=new WorkspaceRuntime(ports.workspace,projectRoot)
  const previewManager=new LocalPreviewManager(ports.nativeContext.directory??projectRoot)
  const processRuntime=new ProcessRuntime(ports.process,projectRoot,getHostConfig)
  const tasks=new TaskRuntime(ports.childSession,background,scheduler,projectRoot,packageRoot,getConfig,getModels,getHostConfig,eventSink,ports.hostCapabilities,scopedStores,workspaceRuntime,()=>browserAvailable?new Set(['host-capability:browser-execution']):new Set(),browserExecutor,ensureBrowserAvailable,ports.readAssistantResult,previewManager,()=>store.all(),processRuntime)
  for(const m of store.all())for(const w of m.execution.workers)if(w.session_id&&w.status==='ready')background.set(w)
  return{store,background,humanDecisionTransport,persistence,scheduler,eventSink,tasks,processExecutor:ports.process,processRuntime,workspaceExecutor:ports.workspace,workspaceRuntime,browserExecutor,setBrowserAvailable,ensureBrowserAvailable,getBrowserBootstrapStatus,getBrowserToolReceipt,operationalTools,previewManager,scopedStores}
}
