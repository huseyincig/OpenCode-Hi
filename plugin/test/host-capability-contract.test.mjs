import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,mkdtempSync,rmSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {tmpdir} from 'node:os'
import {openCodeHostCapabilityContracts,hostCapabilityByID} from '../dist/contracts/host-capability.js'
import {detectOpenCodeCapabilities} from '../dist/opencode/capabilities.js'
import {runDoctor} from '../dist/doctor/checks.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'

const all={childSessions:true,asyncPrompt:true,syncPrompt:true,abort:true,providerInventory:true,appLog:true,sessionStatus:true,childSessionList:true,sessionTodo:true,sessionDiff:true,sessionFork:true,sessionSummarize:true,sessionRevert:true,sessionUnrevert:true}

test('host capability registry separates primitive presence from product capability truth',()=>{
  const items=openCodeHostCapabilityContracts(all)
  assert.equal(hostCapabilityByID(items,'worker-runtime')?.status,'SUPPORTED')
  assert.equal(hostCapabilityByID(items,'worker-runtime')?.verification_level,'OBSERVED')
  assert.equal(hostCapabilityByID(items,'process-lifecycle')?.status,'SUPPORTED')
  assert.equal(hostCapabilityByID(items,'process-lifecycle')?.verification_level,'REAL_HOST_ACCEPTANCE')
  assert.equal(hostCapabilityByID(items,'process-lifecycle')?.semantic_loss.length,0)
  assert.match(hostCapabilityByID(items,'process-lifecycle')?.native_primitive??'',/v2 PTY|WebSocket/i)
  const workspace=hostCapabilityByID(items,'workspace-isolation-binding')
  assert.equal(workspace?.status,'UNSUPPORTED')
  assert.equal(workspace?.native_primitive,undefined)
  assert.equal(workspace?.adapter_entrypoint,undefined)
  assert.match(workspace?.forbidden_fake_behavior??'',/workspaceID|alternate workspace/i)
  const browser=hostCapabilityByID(items,'browser-execution')
  assert.equal(browser?.status,'UNSUPPORTED')
  assert.match(browser?.forbidden_fake_behavior??'',/MCP\/tool discovery|browser executor/i)
})

test('prompt and worker capabilities fail closed when required native ownership primitives are absent',()=>{
  const noPrompt=openCodeHostCapabilityContracts({...all,asyncPrompt:false,syncPrompt:false})
  assert.equal(hostCapabilityByID(noPrompt,'session-prompt')?.status,'UNSUPPORTED')
  assert.equal(hostCapabilityByID(noPrompt,'worker-runtime')?.status,'UNSUPPORTED')
  const syncOnly=openCodeHostCapabilityContracts({...all,asyncPrompt:false,syncPrompt:true})
  assert.equal(hostCapabilityByID(syncOnly,'session-prompt')?.status,'DEGRADED')
  assert.match(hostCapabilityByID(syncOnly,'session-prompt')?.semantic_loss.join(' ')??'',/async/i)
})

test('every host capability contract points at a real controlled acceptance source',()=>{
  const testDir=dirname(fileURLToPath(import.meta.url))
  for(const item of openCodeHostCapabilityContracts(all)){
    assert.ok(item.acceptance_ref,`${item.id}: acceptance_ref missing`)
    assert.ok(existsSync(join(testDir,item.acceptance_ref)),`${item.id}: missing ${item.acceptance_ref}`)
    if(item.status==='UNSUPPORTED'){
      assert.equal(item.native_primitive,undefined,`${item.id}: unsupported capability carries native primitive`)
      assert.equal(item.adapter_entrypoint,undefined,`${item.id}: unsupported capability carries adapter entrypoint`)
    }
  }
})

test('OpenCode detector projects boolean observations into capability contracts without upgrading verification',()=>{
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{create:async()=>({}),promptAsync:async()=>({}),prompt:async()=>({}),abort:async()=>({}),status:async()=>({}),children:async()=>({data:[]}),todo:async()=>({data:[]}),diff:async()=>({data:[]}),fork:async()=>({}),summarize:async()=>({}),revert:async()=>({}),unrevert:async()=>({})}}
  const detected=detectOpenCodeCapabilities(client)
  assert.ok(detected.contracts.length>=16)
  assert.equal(hostCapabilityByID(detected.contracts,'worker-runtime')?.status,'SUPPORTED')
  assert.ok(detected.contracts.filter(x=>x.id!=='process-lifecycle').every(x=>x.verification_level==='OBSERVED'))
  assert.equal(hostCapabilityByID(detected.contracts,'process-lifecycle')?.verification_level,'REAL_HOST_ACCEPTANCE')
  assert.equal(hostCapabilityByID(detected.contracts,'workspace-isolation-binding')?.status,'UNSUPPORTED')
})

test('doctor reports supported process lifecycle and unsupported workspace/browser boundaries',()=>{
  const d=mkdtempSync(join(tmpdir(),'hi-host-cap-'))
  try{
    const capabilities=detectOpenCodeCapabilities({session:{create:async()=>({}),promptAsync:async()=>({}),abort:async()=>({})}})
    const checks=runDoctor(DEFAULT_HI_CONFIG,new MissionStore(),d,{capabilities})
    const process=checks.find(x=>x.id==='process-lifecycle'),workspace=checks.find(x=>x.id==='workspace-isolation-binding'),browser=checks.find(x=>x.id==='browser-execution'),registry=checks.find(x=>x.id==='host-capability-contracts')
    assert.equal(registry?.status,'pass')
    assert.equal(process?.status,'pass')
    assert.match(process?.detail??'',/status=SUPPORTED/)
    assert.match(process?.detail??'',/verification=REAL_HOST_ACCEPTANCE/)
    assert.match(workspace?.detail??'',/status=UNSUPPORTED/)
    assert.match(workspace?.detail??'',/verification=OBSERVED/)
    assert.match(browser?.detail??'',/status=UNSUPPORTED/)
    assert.match(browser?.detail??'',/verification=OBSERVED/)
  }finally{rmSync(d,{recursive:true,force:true})}
})
