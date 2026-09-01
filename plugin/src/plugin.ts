import type { Plugin } from '@opencode-ai/plugin'
import { resolveNativeProjectRoot } from './runtime/intent/repo-context.js'
import { acquireHiRuntimeInstance } from './opencode/instance-guard.js'
import { runtimeInstanceLockPath } from './runtime/storage/locations.js'
import { createHostPort } from './opencode/host-port.js'
import { createOpenCodeHooks } from './opencode/open-code-hooks.js'
import { createOpenCodeChildSessionPort } from './opencode/child-session-port.js'
import { createOwnedCapabilityObserver } from './opencode/capabilities.js'
import { OpenCodePtyAdapter } from './opencode/open-code-pty-adapter.js'
import { OpenCodeWorkspaceAdapter } from './opencode/open-code-workspace-adapter.js'
import { createHiRuntime } from './runtime/application/plugin-runtime.js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type {ProjectMemoryProvider,ProjectMemoryProviderRecord,ProjectMemoryProjection,ProjectMemoryRecallRequest} from './contracts/project-memory.js'

export const HiPlugin:Plugin=async(ctx)=>{
  const packageRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
  const packagedSkillsDir=resolve(packageRoot,'skills')
  const projectRoot=resolveNativeProjectRoot(process.cwd(),{project:ctx.project,directory:ctx.directory,worktree:ctx.worktree})
  const instanceLease=acquireHiRuntimeInstance(String(projectRoot),ctx.client as object,{lockPath:runtimeInstanceLockPath(projectRoot)})
  try{
    const host=createHostPort(ctx)
    const childSession=createOpenCodeChildSessionPort(ctx.client,{serverUrl:ctx.serverUrl?.toString?.(),directory:ctx.directory})
    let runtime:any
    const processExecutor=new OpenCodePtyAdapter(ctx.client,ctx.serverUrl,ctx.directory,projectRoot,()=>runtime?.state?.hostConfig??{})
    const workspaceExecutor=new OpenCodeWorkspaceAdapter(ctx.client,ctx.serverUrl,ctx.directory)
    const ownedCapabilities=createOwnedCapabilityObserver(ctx.client,host.capabilities.contracts,processExecutor,workspaceExecutor)
    runtime=await createHiRuntime({packageRoot,packagedSkillsDir,projectRoot,workingDirectory:ctx.directory,nativeContext:{project:ctx.project,directory:ctx.directory,worktree:ctx.worktree},host,childSession,processExecutor,workspaceExecutor,ownedCapabilities,instanceLease})
    return createOpenCodeHooks({state:runtime.state,host,services:runtime.services,projectRoot,workingDirectory:ctx.directory,packagedSkillsDir:runtime.packagedSkillsDir,projectAuthority:runtime.projectAuthority,toolSurface:runtime.toolSurface,eventController:runtime.eventController,instanceLease}) as any
  }catch(error){instanceLease.release();throw error}
}
export default HiPlugin
