import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,mkdtempSync,rmSync} from 'node:fs'
import {join,dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {tmpdir} from 'node:os'
import {openCodeHostCapabilityContracts,hostCapabilityByID,negotiateHostCapabilityContracts} from '../dist/contracts/host-capability.js'
import {detectOpenCodeCapabilities} from '../dist/opencode/capabilities.js'
import {runDoctor} from '../dist/doctor/checks.js'
import {HiPlugin} from '../dist/plugin.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'

const all={childSessions:true,asyncPrompt:true,syncPrompt:true,abort:true,providerInventory:true,appLog:true,sessionStatus:true,childSessionList:true,sessionTodo:true,sessionDiff:true,sessionFork:true,sessionSummarize:true,sessionRevert:true,sessionUnrevert:true}
const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const ownedObserved={processLifecycle:true,workspaceIsolation:true,browserExecution:true}

test('host capability registry separates primitive presence from product capability truth',()=>{
  const items=openCodeHostCapabilityContracts(all)
  assert.equal(hostCapabilityByID(items,'worker-runtime')?.status,'SUPPORTED')
  assert.equal(hostCapabilityByID(items,'worker-runtime')?.verification_level,'OBSERVED')
  assert.equal(hostCapabilityByID(items,'process-lifecycle')?.status,'UNSUPPORTED')
  assert.equal(hostCapabilityByID(items,'process-lifecycle')?.verification_level,'OBSERVED')
  assert.match(hostCapabilityByID(items,'process-lifecycle')?.semantic_loss.join(' ')??'',/not observed/)
  assert.match(hostCapabilityByID(items,'process-lifecycle')?.native_primitive??'',/v2 PTY|WebSocket/i)
  const workspace=hostCapabilityByID(items,'workspace-isolation-binding')
  assert.equal(workspace?.status,'UNSUPPORTED')
  assert.equal(workspace?.verification_level,'OBSERVED')
  assert.match(workspace?.native_primitive??'',/workspace.*session|session.*workspace/i)
  assert.match(workspace?.adapter_entrypoint??'',/WorkspaceRuntime|OpenCodeWorkspaceAdapter/)
  assert.match(workspace?.forbidden_fake_behavior??'',/mock client.*T3\/REAL_HOST_ACCEPTANCE/i)
  const browser=hostCapabilityByID(items,'browser-execution')
  assert.equal(browser?.status,'UNSUPPORTED')
  assert.equal(browser?.verification_level,'OBSERVED')
  assert.match(browser?.native_primitive??'',/BrowserExecutor adapter.*healthy/i)
  assert.match(browser?.adapter_entrypoint??'',/BrowserExecutor port.*OpenCode adapter.*ownership\/evidence/i)
  assert.equal(browser?.runtime_health_required,true)
  assert.match(browser?.forbidden_fake_behavior??'',/mock client.*T3\/REAL_HOST_ACCEPTANCE/i)
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
    const proof=item.acceptance_ref.startsWith('data/')?join(repoRoot,item.acceptance_ref):join(testDir,item.acceptance_ref)
    assert.ok(existsSync(proof),`${item.id}: missing ${item.acceptance_ref}`)
    if(item.status==='UNSUPPORTED'&&!['process-lifecycle','workspace-isolation-binding','browser-execution'].includes(item.id)){
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
  assert.ok(detected.contracts.filter(x=>!['process-lifecycle','workspace-isolation-binding','browser-execution'].includes(x.id)).every(x=>x.verification_level==='OBSERVED'))
  for(const id of ['process-lifecycle','workspace-isolation-binding','browser-execution']){assert.equal(hostCapabilityByID(detected.contracts,id)?.status,'UNSUPPORTED');assert.equal(hostCapabilityByID(detected.contracts,id)?.verification_level,'OBSERVED')}
  const observed=detectOpenCodeCapabilities(client,ownedObserved)
  for(const id of ['process-lifecycle','workspace-isolation-binding','browser-execution']){assert.equal(hostCapabilityByID(observed.contracts,id)?.status,'SUPPORTED');assert.equal(hostCapabilityByID(observed.contracts,id)?.verification_level,'OBSERVED')}
  assert.equal(observed.contracts.some(x=>x.verification_level==='REAL_HOST_ACCEPTANCE'),false)
})

test('plugin initialization never waits on same-server process/workspace health probes',async()=>{
  const d=mkdtempSync(join(tmpdir(),'hi-host-init-'))
  try{
    const client={app:{log:async()=>{}},session:{create:async()=>({data:{id:'child'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:true}),diff:async()=>({data:[]})}}
    const init=HiPlugin({directory:d,worktree:d,project:{},client,serverUrl:new URL('http://127.0.0.1:1')})
    const hooks=await Promise.race([init,new Promise((_,reject)=>setTimeout(()=>reject(new Error('plugin init waited on host health probe')),500))])
    assert.ok(hooks?.tool?.hi_doctor)
    await hooks.dispose?.()
  }finally{rmSync(d,{recursive:true,force:true})}
})

test('doctor reports only live-observed owned capabilities and never self-promotes T3',()=>{
  const d=mkdtempSync(join(tmpdir(),'hi-host-cap-'))
  try{
    const capabilities=detectOpenCodeCapabilities({session:{create:async()=>({}),promptAsync:async()=>({}),abort:async()=>({})}},ownedObserved)
    const checks=runDoctor(DEFAULT_HI_CONFIG,new MissionStore(),d,{capabilities,runtimeHostResources:new Set(['host-capability:browser-execution'])})
    const process=checks.find(x=>x.id==='process-lifecycle'),workspace=checks.find(x=>x.id==='workspace-isolation-binding'),browser=checks.find(x=>x.id==='browser-execution'),registry=checks.find(x=>x.id==='host-capability-contracts')
    assert.equal(registry?.status,'pass')
    assert.equal(process?.status,'pass')
    assert.match(process?.detail??'',/status=SUPPORTED/)
    assert.match(process?.detail??'',/verification=OBSERVED/g)
    assert.match(workspace?.detail??'',/status=SUPPORTED/)
    assert.match(workspace?.detail??'',/verification=OBSERVED/g)
    assert.equal(browser?.status,'pass')
    assert.match(browser?.detail??'',/status=SUPPORTED/)
    assert.match(browser?.detail??'',/verification=OBSERVED/g)
    assert.match(browser?.detail??'',/runtime-health-required=true/)
    assert.match(browser?.detail??'',/runtime-available=true/)
  }finally{rmSync(d,{recursive:true,force:true})}
})


test('capability negotiation prefers runtime truth over advertised/probe/version metadata without version routing',()=>{
  const base={id:'session-status',host_id:'opencode',verification_level:'OBSERVED',semantic_loss:[],required_permissions:[],acceptance_ref:'x',forbidden_fake_behavior:'x'}
  const out=negotiateHostCapabilityContracts([
    {source:'VERSION_METADATA',contract:{...base,status:'SUPPORTED',native_primitive:'version-implied'}},
    {source:'SAFE_FEATURE_PROBE',contract:{...base,status:'SUPPORTED',native_primitive:'probe'}},
    {source:'EXPLICIT_HOST_CAPABILITY',contract:{...base,status:'SUPPORTED',native_primitive:'advertised'}},
    {source:'RUNTIME_TRUTH',contract:{...base,status:'DEGRADED',fallback:'event-state',semantic_loss:['native status failed at runtime']}}
  ])
  assert.equal(out.length,1)
  assert.equal(out[0].status,'DEGRADED')
  assert.equal(out[0].discovery_source,'RUNTIME_TRUTH')
  assert.equal(out[0].fallback,'event-state')
})

test('current runtime capability detector labels method/health observations as runtime truth',()=>{
  const c=detectOpenCodeCapabilities({session:{create:async()=>({}),promptAsync:async()=>({}),abort:async()=>({})}})
  assert.ok(c.contracts.length>0)
  assert.ok(c.contracts.every(x=>x.discovery_source==='RUNTIME_TRUTH'))
})


test('degraded capability contracts always name fallback and semantic loss; unsupported never impersonates full support',()=>{
  const none={childSessions:false,asyncPrompt:false,syncPrompt:false,abort:false,providerInventory:false,appLog:false,sessionStatus:false,childSessionList:false,sessionTodo:false,sessionDiff:false,sessionFork:false,sessionSummarize:false,sessionRevert:false,sessionUnrevert:false}
  for(const item of openCodeHostCapabilityContracts(none)){
    if(item.status==='DEGRADED'){
      assert.equal(typeof item.fallback,'string',item.id)
      assert.ok(item.fallback.length>0,item.id)
      assert.ok(item.semantic_loss.length>0,item.id)
    }
    if(item.status==='UNSUPPORTED')assert.notEqual(item.status,'SUPPORTED')
  }
})
