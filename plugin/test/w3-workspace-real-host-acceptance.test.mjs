import test from 'node:test'
import assert from 'node:assert/strict'
import {openCodeHostCapabilityContracts,hostCapabilityByID} from '../dist/contracts/host-capability.js'
import {OPENCODE_REFERENCE_CAPABILITIES,resolveHostCapability} from '../dist/runtime/host/capability-manifest.js'

const all={childSessions:true,asyncPrompt:true,syncPrompt:true,abort:true,providerInventory:true,appLog:true,sessionStatus:true,childSessionList:true,sessionTodo:true,sessionDiff:true,sessionFork:true,sessionSummarize:true,sessionRevert:true,sessionUnrevert:true}

test('W3 workspace capability is promoted only as real-host accepted Hi-owned isolation',()=>{
  const capability=hostCapabilityByID(openCodeHostCapabilityContracts(all),'workspace-isolation-binding')
  assert.equal(capability?.status,'SUPPORTED')
  assert.equal(capability?.verification_level,'REAL_HOST_ACCEPTANCE')
  assert.match(capability?.native_primitive??'',/workspace.*session|session.*workspace/i)
  assert.match(capability?.adapter_entrypoint??'',/WorkspaceRuntime.*OpenCodeWorkspaceAdapter.*ChildExecutionCoordinator/)
  assert.equal(resolveHostCapability(OPENCODE_REFERENCE_CAPABILITIES,'workspace_isolation'),'NATIVE')
  assert.match(capability?.required_permissions.join(' ')??'',/never widens external_directory/i)
})
