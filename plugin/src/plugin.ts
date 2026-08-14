import type { Plugin } from '@opencode-ai/plugin'
import { DEFAULT_HI_CONFIG } from './config/defaults.js'
import { resolveNativeProjectRoot } from './runtime/intent/repo-context.js'
import { ProjectAuthorityStore } from './runtime/safety/project-authority.js'
import { acquireHiRuntimeInstance } from './opencode/instance-guard.js'
import { createHostPort } from './opencode/host-port.js'
import { createRuntimeServices } from './runtime/application/runtime-services.js'
import { createHiToolSurface, type PluginRuntimeState } from './runtime/application/hi-tool-surface.js'
import { RuntimeEventController } from './runtime/application/runtime-event-controller.js'
import { createOpenCodeHooks } from './opencode/open-code-hooks.js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HiPlugin:Plugin=async(ctx)=>{
  const packageRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
  const packagedSkillsDir=resolve(packageRoot,'skills')
  const projectRoot=resolveNativeProjectRoot(process.cwd(),{project:ctx.project,directory:ctx.directory,worktree:ctx.worktree})
  const state:PluginRuntimeState={config:DEFAULT_HI_CONFIG,hostConfig:{}}
  const host=createHostPort(ctx)
  const projectAuthority=new ProjectAuthorityStore(projectRoot)
  const services=createRuntimeServices({ctx,projectRoot,packageRoot,getConfig:()=>state.config,getModels:host.getModels,getHostConfig:()=>state.hostConfig})
  const pendingNativePermissions=new Map<string,string[]>()
  const eventController=new RuntimeEventController({state,host,services,projectAuthority,pendingNativePermissions,projectRoot})
  const {toolSurface,reconfigure}=createHiToolSurface({state,store:services.store,tasks:services.tasks,teams:services.teams,projectRoot,capabilities:host.capabilities,native:host.native,getModels:host.getModels,scopedStores:services.scopedStores})
  void host.log('info','OpenCode-Hi plugin initialized',{directory:ctx.directory,models:host.getModels().length,restored:services.store.all().length,uncleanShutdown:services.persistence.lastLoadReport.uncleanShutdown===true,capabilities:host.capabilities})
  // Acquire only after initialization succeeds so a failed init cannot leave a stale process-global lease.
  const instanceLease=acquireHiRuntimeInstance(String(projectRoot))
  return createOpenCodeHooks({state,host,services,projectRoot,packagedSkillsDir,projectAuthority,toolSurface,reconfigureToolSurface:reconfigure,eventController,instanceLease}) as any
}

export default HiPlugin
