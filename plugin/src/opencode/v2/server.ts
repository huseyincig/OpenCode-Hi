import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {resolveNativeProjectRoot} from '../../runtime/intent/repo-context.js'
import {acquireHiRuntimeInstance} from '../instance-guard.js'
import {runtimeInstanceLockPath} from '../../runtime/storage/locations.js'
import {createHiRuntime} from '../../runtime/application/plugin-runtime.js'
import {createV2HostPort,createV2OwnedCapabilityObserver} from './host-port.js'
import {createV2ChildSessionPort} from './child-session-port.js'
import {V2UnavailableProcessExecutor,V2UnavailableWorkspaceExecutor} from './unavailable-executors.js'
import {registerV2Lifecycle} from './lifecycle.js'
import type {V2Context,V2RuntimeFacts} from './types.js'

export const HiV2Server={
  id:'opencode-hi',
  setup:async(ctx:V2Context)=>{
    const packageRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..')
    const packagedSkillsDir=resolve(packageRoot,'skills')
    const directory=ctx.location?.directory??process.cwd()
    const projectRoot=resolveNativeProjectRoot(directory,{project:ctx.location?.project,directory,worktree:ctx.location?.project?.canonical})
    const instanceLease=acquireHiRuntimeInstance(String(projectRoot),ctx as object,{lockPath:runtimeInstanceLockPath(projectRoot)})
    try{
      const facts:V2RuntimeFacts={status:new Map(),eventPumpAbort:new AbortController()}
      const host=createV2HostPort(ctx,facts)
      const childSession=createV2ChildSessionPort(ctx,facts)
      const processExecutor=new V2UnavailableProcessExecutor()
      const workspaceExecutor=new V2UnavailableWorkspaceExecutor()
      const ownedCapabilities=createV2OwnedCapabilityObserver(host.capabilities.contracts)
      const runtime=await createHiRuntime({packageRoot,packagedSkillsDir,projectRoot,workingDirectory:directory,nativeContext:{project:ctx.location?.project,directory,worktree:ctx.location?.project?.canonical},host,childSession,processExecutor,workspaceExecutor,ownedCapabilities,instanceLease})
      return await registerV2Lifecycle(ctx,runtime,facts)
    }catch(error){instanceLease.release();throw error}
  }
}
export default HiV2Server
