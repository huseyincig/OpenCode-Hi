import test from 'node:test'
import assert from 'node:assert/strict'
import {BrowserCliAdapter} from '../dist/opencode/browser-cli-adapter.js'
import {isBrowserObservationContract} from '../dist/contracts/browser-observation.js'
import {openCodeHostCapabilityContracts,hostCapabilityByID} from '../dist/contracts/host-capability.js'

const all={childSessions:true,asyncPrompt:true,syncPrompt:true,abort:true,providerInventory:true,appLog:true,sessionStatus:true,childSessionList:true,sessionTodo:true,sessionDiff:true,sessionFork:true,sessionSummarize:true,sessionRevert:true,sessionUnrevert:true}
function harness(outputs=[]){
  const calls=[]
  const runner={run:async(argv,options)=>{calls.push({argv:[...argv],options});return outputs.shift()??{exit_code:0,stdout:'ok',stderr:''}}}
  const adapter=new BrowserCliAdapter({runner,cwd:'/repo',session_id:'hi-browser-task-1',allowed_origins:['https://example.test']})
  return{adapter,calls}
}
const ctx={task_id:'task_browser',executor_version:'browser-cli-test'}

test('B2 adapter uses argv plus exact session env and bounded allowed origin',async()=>{
  const h=harness([{exit_code:0,stdout:'opened',stderr:''}])
  const o=await h.adapter.open(ctx,'https://example.test/page')
  assert.equal(o.result,'OBSERVED');assert.ok(isBrowserObservationContract(o))
  assert.deepEqual(h.calls[0].argv,['agent-browser','open','https://example.test/page'])
  assert.equal(h.calls[0].options.env.AGENT_BROWSER_SESSION,'hi-browser-task-1')
  await assert.rejects(()=>h.adapter.navigate(ctx,'https://evil.test/'),/outside configured scope/)
  assert.equal(h.calls.length,1)
})

test('B2 click/type accept only observed-style element refs and never construct a shell string',async()=>{
  const h=harness([{exit_code:0,stdout:'opened',stderr:''},{exit_code:0,stdout:'clicked',stderr:''},{exit_code:0,stdout:'typed',stderr:''}])
  await h.adapter.open(ctx,'https://example.test/')
  await h.adapter.click(ctx,{value:'@e12'})
  await h.adapter.type(ctx,{value:'@e12'},'hello; rm -rf /')
  assert.deepEqual(h.calls[1].argv,['agent-browser','click','@e12'])
  assert.deepEqual(h.calls[2].argv,['agent-browser','type','@e12','hello; rm -rf /'])
  await assert.rejects(()=>h.adapter.click(ctx,{value:'button;rm'}),/@eN/)
})

test('B2 inspect is bounded to whole snapshot and does not invent selector support',async()=>{
  const h=harness([{exit_code:0,stdout:'opened',stderr:''},{exit_code:0,stdout:'button @e1',stderr:''}])
  await h.adapter.open(ctx,'https://example.test/')
  const o=await h.adapter.inspect(ctx)
  assert.equal(o.action,'inspect');assert.match(o.dom_summary,/button @e1/)
  await assert.rejects(()=>h.adapter.inspect(ctx,{selector:'#secret'}),/does not claim selector-scoped/)
})

test('B2 screenshot cannot succeed without canonical artifact binding',async()=>{
  const h=harness([{exit_code:0,stdout:'opened',stderr:''},{exit_code:0,stdout:'raw screenshot bytes/path',stderr:''},{exit_code:0,stdout:'raw screenshot bytes/path',stderr:''}])
  await h.adapter.open(ctx,'https://example.test/')
  const failed=await h.adapter.screenshot(ctx)
  assert.equal(failed.result,'FAILED');assert.equal(failed.screenshot_artifact_ref,undefined);assert.ok(isBrowserObservationContract(failed))
  const ok=await h.adapter.screenshot({...ctx,screenshot_artifact_ref:'hi-artifact:a_1234567890abcdef12345678'})
  assert.equal(ok.result,'OBSERVED');assert.equal(ok.screenshot_artifact_ref,'hi-artifact:a_1234567890abcdef12345678');assert.ok(isBrowserObservationContract(ok))
})

test('B2 wait is bounded and close clears active session state',async()=>{
  const h=harness([{exit_code:0,stdout:'opened',stderr:''},{exit_code:0,stdout:'',stderr:''},{exit_code:0,stdout:'',stderr:''}])
  await h.adapter.open(ctx,'https://example.test/')
  const w=await h.adapter.wait(ctx,{milliseconds:25});assert.equal(w.result,'OBSERVED')
  const c=await h.adapter.close(ctx);assert.equal(c.action,'close');assert.equal(c.result,'OBSERVED');assert.ok(isBrowserObservationContract(c))
  await assert.rejects(()=>h.adapter.inspect(ctx),/no active URL/)
  await assert.rejects(()=>h.adapter.wait(ctx,{milliseconds:30001}),/no active URL|0\.\.30000ms/)
})

test('B2 command failure creates FAILED observation and health does not fake availability',async()=>{
  const h=harness([{exit_code:127,stdout:'',stderr:'not found'},{exit_code:2,stdout:'',stderr:'navigation failed'}])
  assert.deepEqual(await h.adapter.health(),{available:false,reason:'not found'})
  const o=await h.adapter.open(ctx,'https://example.test/')
  assert.equal(o.result,'FAILED');assert.deepEqual(o.network_errors,['navigation failed']);assert.ok(isBrowserObservationContract(o))
})

test('B2 controlled adapter contract remains distinct from the later B3 real-host capability promotion',()=>{
  const cap=hostCapabilityByID(openCodeHostCapabilityContracts(all),'browser-execution')
  assert.equal(cap?.status,'SUPPORTED');assert.equal(cap?.verification_level,'REAL_HOST_ACCEPTANCE')
  assert.match(cap?.adapter_entrypoint??'',/PlaywrightBrowserAdapter/)
})
