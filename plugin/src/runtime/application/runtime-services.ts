import type {HiConfig} from '../../config/schema.js'
import type {AvailableModel} from '../routing/model-resolver.js'
import type {RuntimeSignalSink} from '../events/event-sink.js'
import type {NativeProjectContext} from '../intent/repo-context.js'
import type {ChildSessionPort,HostAssistantResult} from '../host/port.js'
import type {HostCapabilityContract} from '../../contracts/host-capability.js'
import type {ProcessExecutor} from '../process/executor.js'
import type {WorkspaceExecutor} from '../workspace/executor.js'
import type {BrowserExecutor,BrowserExecutionContext} from '../browser/executor.js'
import {MissionStore} from '../mission/mission-store.js'
import {BackgroundRegistry} from '../background/registry.js'
import {RuntimePersistence} from '../state/persistence.js'
import {ConcurrencyScheduler} from '../scheduler/concurrency.js'
import {TaskRuntime} from '../task/task-runtime.js'
import {appendLedger} from '../ledger/ledger.js'
import {createRuntimeScopedStores} from './runtime-scoped-stores.js'
import {ProcessRuntime} from '../process/runtime.js'
import {WorkspaceRuntime} from '../workspace/runtime.js'
import {ChatHumanDecisionTransport} from '../human-decision/transport.js'

export interface RuntimeServicePorts{
  nativeContext:NativeProjectContext
  childSession:ChildSessionPort
  readAssistantResult?:(sessionID:string,limit?:number)=>Promise<HostAssistantResult>
  hostCapabilities:readonly HostCapabilityContract[]
  process:ProcessExecutor
  workspace:WorkspaceExecutor
  createBrowser:(persist:(bytes:Uint8Array,context:BrowserExecutionContext)=>string)=>BrowserExecutor
  bootstrapBrowser?:()=>Promise<{available:boolean;attempted?:boolean;cachePath?:string;version?:string;executablePath?:string;reason?:string}>
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
  const scheduler=new ConcurrencyScheduler(()=>({global:getConfig().parallel.enabled?getConfig().parallel.max:1,providers:getConfig().parallel.providers,models:getConfig().parallel.models}))
  const eventSink:RuntimeSignalSink=ev=>{const m=store.all().find(x=>x.identity.mission_id===ev.mission_id);if(m)appendLedger(m,`event.${ev.type}`,{task_id:ev.task_id,worker_id:ev.worker_id,payload:ev.payload})}
  const browserExecutor=ports.createBrowser((bytes,c)=>{const a=scopedStores.contextArtifacts.addBinary('browser-screenshot',`Browser screenshot for ${c.task_id}`,bytes,{extension:'png',mediaType:'image/png',producer:'hi-browser-executor',consumerRefs:[`task:${c.task_id}`]});return`hi-artifact:${a.artifact_id}`})
  let browserAvailable=false,browserBootstrapStatus:{available:boolean;attempted?:boolean;cachePath?:string;version?:string;executablePath?:string;reason?:string}|undefined
  const setBrowserAvailable=(value:boolean)=>{browserAvailable=value;ports.onBrowserAvailability?.(value)}
  const ensureBrowserAvailable=async()=>{if(browserAvailable)return{available:true,attempted:false};if(ports.bootstrapBrowser)browserBootstrapStatus=await ports.bootstrapBrowser();const health=await browserExecutor.health();setBrowserAvailable(health.available);return{available:health.available,attempted:browserBootstrapStatus?.attempted,reason:health.available?undefined:(browserBootstrapStatus?.reason??health.reason)}}
  const getBrowserBootstrapStatus=()=>browserBootstrapStatus?{...browserBootstrapStatus}:undefined
  const workspaceRuntime=new WorkspaceRuntime(ports.workspace,projectRoot)
  const tasks=new TaskRuntime(ports.childSession,background,scheduler,projectRoot,packageRoot,getConfig,getModels,getHostConfig,eventSink,ports.hostCapabilities,scopedStores,workspaceRuntime,()=>browserAvailable?new Set(['host-capability:browser-execution']):new Set(),browserExecutor,ensureBrowserAvailable,ports.readAssistantResult)
  for(const m of store.all())for(const w of m.execution.workers)if(w.session_id&&w.status==='ready')background.set(w)
  const processRuntime=new ProcessRuntime(ports.process,projectRoot,getHostConfig)
  return{store,background,humanDecisionTransport,persistence,scheduler,eventSink,tasks,processExecutor:ports.process,processRuntime,workspaceExecutor:ports.workspace,workspaceRuntime,browserExecutor,setBrowserAvailable,ensureBrowserAvailable,getBrowserBootstrapStatus,scopedStores}
}
