import type { HiConfig } from '../../config/schema.js'
import type { AvailableModel } from '../routing/model-resolver.js'
import type { RuntimeSignalSink } from '../events/event-sink.js'
import { MissionStore } from '../mission/mission-store.js'
import { BackgroundRegistry } from '../background/registry.js'
import { RuntimePersistence } from '../state/persistence.js'
import { ConcurrencyScheduler } from '../scheduler/concurrency.js'
import { TaskRuntime } from '../task/task-runtime.js'
import { TeamRuntime } from '../team/team-runtime.js'
import { ExperimentalOpenCodeAdapter } from '../../opencode/experimental-adapter.js'
import { appendLedger } from '../ledger/ledger.js'

export function createRuntimeServices(input:{ctx:any;projectRoot:string;packageRoot:string;getConfig:()=>HiConfig;getModels:()=>AvailableModel[];getHostConfig:()=>Record<string,unknown>}){
  const {ctx,projectRoot,packageRoot,getConfig,getModels,getHostConfig}=input
  const store=new MissionStore(projectRoot,{project:ctx.project,directory:ctx.directory,worktree:ctx.worktree},()=>getConfig().primaryMode,()=>({mode:getConfig().execution.topology,maxAgents:getConfig().execution.maxAgents,parallelism:getConfig().execution.parallelism}))
  const background=new BackgroundRegistry()
  const persistence=new RuntimePersistence(projectRoot)
  const restored=persistence.load()
  if(persistence.lastLoadReport.error)throw new Error(`OpenCode-Hi runtime state is invalid and was not discarded: ${persistence.lastLoadReport.error}. Reconcile or remove the invalid runtime-state file explicitly before restarting Hi.`)
  store.restore(restored,persistence.lastLoadReport.uncleanShutdown===true)
  for(const m of store.all())for(const w of m.execution.workers)if(!['completed','failed','cancelled'].includes(w.status))background.set(w)
  persistence.markRunning(store.all())
  const scheduler=new ConcurrencyScheduler(()=>({global:getConfig().parallel.enabled?getConfig().parallel.max:1,providers:getConfig().parallel.providers,models:getConfig().parallel.models}))
  const eventSink:RuntimeSignalSink=ev=>{const m=store.all().find(x=>x.identity.mission_id===ev.mission_id);if(m)appendLedger(m,`event.${ev.type}`,{task_id:ev.task_id,worker_id:ev.worker_id,payload:ev.payload})}
  const tasks=new TaskRuntime(ctx.client,background,scheduler,projectRoot,packageRoot,getConfig,getModels,getHostConfig,eventSink,{serverUrl:ctx.serverUrl?.toString?.(),directory:ctx.directory})
  for(const m of store.all())for(const w of m.execution.workers)if(w.session_id&&w.status==='ready')background.set(w)
  const experimental=new ExperimentalOpenCodeAdapter(store,background)
  const teams=new TeamRuntime(tasks,()=>getConfig().teamMode.enabled,()=>({maxMembers:getConfig().teamMode.maxMembers,maxWallMs:getConfig().teamMode.maxWallMinutes*60*1000}))
  return {store,background,persistence,scheduler,eventSink,tasks,experimental,teams}
}
