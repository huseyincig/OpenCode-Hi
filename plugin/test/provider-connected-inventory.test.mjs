import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import HiPlugin from '../dist/plugin.js'
import { createHostPort } from '../dist/opencode/host-port.js'
import { resolveModel } from '../dist/runtime/routing/model-resolver.js'
import { resolveHiConfig } from '../dist/config/resolver.js'

function clientWithProviderShape(raw){
  return {
    app:{log:async()=>({})},
    provider:{list:async()=>({data:raw})},
    session:{
      create:async()=>({data:{id:'child'}}),
      promptAsync:async()=>({data:{}}),
      abort:async()=>({data:{}}),
      messages:async()=>({data:[]}),
      status:async()=>({data:{}}),
      children:async()=>({data:[]}),
      diff:async()=>({data:[]}),
      todo:async()=>({data:[]}),
      revert:async()=>({data:{}}),
      unrevert:async()=>({data:{}}),
    },
  }
}

test('provider lifecycle refresh wakes durable queued work after inventory becomes available',()=>{
  const source=readFileSync(new URL('../src/runtime/application/runtime-event-controller.ts',import.meta.url),'utf8')
  assert.match(source,/refreshRuntimeInventory=async\(reason:string\)=>\{await host\.refreshRuntimeInventory\(reason\);tasks\.wakeQueued\(\);await host\.log/)
})

test('runtime inventory exposes only models from OpenCode connected providers when connected set is present',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-connected-provider-'))
  const raw={
    connected:['opencode-go'],
    all:[
      {id:'zhipuai',models:[{id:'px-unavailable'}]},
      {id:'opencode-go',models:[{id:'deepseek-v4-flash',capabilities:{input:{image:false}}}]},
    ],
  }
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  const doctor=String(await hooks.tool.hi_doctor.execute({},{}))
  assert.match(doctor,/model-inventory: 1 effective runtime model\(s\)/)
  assert.match(doctor,/opencode-go\/deepseek-v4-flash/)
  assert.doesNotMatch(doctor,/zhipuai\/px-unavailable/)
  assert.equal(existsSync(join(root,'.opencode','hi','policy','routing.json')),false,'runtime inventory refresh must not persist inferred role preferences')
  await hooks.dispose?.()
  rmSync(root,{recursive:true,force:true})
})

test('runtime inventory preserves host shapes that do not expose a connected-provider set',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-legacy-shape-'))
  const raw={all:[{id:'p',models:[{id:'m'}]}]}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  const doctor=String(await hooks.tool.hi_doctor.execute({},{}))
  assert.match(doctor,/model-inventory: 1 effective runtime model\(s\)/)
  assert.match(doctor,/p\/m/)
  await hooks.dispose?.()
  rmSync(root,{recursive:true,force:true})
})


test('successful refresh to zero connected models clears stale inventory',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-zero-refresh-'))
  let raw={connected:['p'],all:[{id:'p',models:[{id:'m'}]}]}
  const client=clientWithProviderShape(raw)
  client.provider.list=async()=>({data:raw})
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
  await hooks.config({})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  let doctor=String(await hooks.tool.hi_doctor.execute({},{}))
  assert.match(doctor,/model-inventory: 1 effective runtime model\(s\)/)
  raw={connected:[],all:[{id:'p',models:[{id:'m'}]}]}
  await hooks.event({event:{type:'installation.updated',properties:{}}})
  doctor=String(await hooks.tool.hi_doctor.execute({},{}))
  assert.match(doctor,/model-inventory: 0 effective runtime model\(s\)/)
  assert.doesNotMatch(doctor,/p\/m/)
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})


test('runtime initial recommendation never shadows an existing host-level user role mapping',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-user-routing-'))
  const raw={connected:['p'],all:[{id:'p',models:[{id:'user-model'},{id:'other-model'}]}]}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({hi:{routing:{roleModels:{coder:['p/user-model']}}}})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  assert.equal(existsSync(join(root,'.opencode','hi','policy','routing.json')),false)
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})


test('chat-facing hi_role_models lists only effective connected models and persists explicit child-role choices',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-role-model-chat-'))
  const raw={connected:['p'],all:[{id:'p',models:[{id:'code'},{id:'vision',capabilities:{input:{image:true}}}]},{id:'offline',models:[{id:'nope'}]}]}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  const listed=JSON.parse(String(await hooks.tool.hi_role_models.execute({action:'list'},{})))
  assert.equal(listed.status,'OK');assert.deepEqual(listed.models.map(x=>x.id),['p/code','p/vision']);assert.equal(listed.roles.coder,null);assert.deepEqual(listed.role_models.coder,[]);assert.equal(existsSync(join(root,'.opencode','hi','policy','routing.json')),false)
  const setCoder=JSON.parse(String(await hooks.tool.hi_role_models.execute({action:'set',role:'coder',models:'p/vision,p/code'},{})))
  assert.equal(setCoder.status,'APPLIED');assert.deepEqual(setCoder.role_models.coder,['p/vision','p/code'])
  const blockedVisual=JSON.parse(String(await hooks.tool.hi_role_models.execute({action:'set',role:'visual-qa',models:'p/code'},{})))
  assert.equal(blockedVisual.status,'BLOCKED');assert.match(blockedVisual.reason,/vision/i)
  const setVisual=JSON.parse(String(await hooks.tool.hi_role_models.execute({action:'set',role:'visual-qa',models:'p/vision'},{})))
  assert.equal(setVisual.status,'APPLIED');assert.deepEqual(setVisual.role_models['visual-qa'],['p/vision'])
  const routing=JSON.parse(readFileSync(join(root,'.opencode','hi','policy','routing.json'),'utf8'))
  assert.deepEqual(routing.routing.roleModels.coder,['p/vision','p/code']);assert.deepEqual(routing.routing.roleModels['visual-qa'],['p/vision'])
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})


test('compatibility hi_role_models mutations are state-equivalent to canonical hi_settings role mutations',async()=>{
  const roots=[mkdtempSync(join(tmpdir(),'hi-role-compat-a-')),mkdtempSync(join(tmpdir(),'hi-role-compat-b-'))]
  const raw={connected:['p'],all:[{id:'p',models:[{id:'code'},{id:'fallback'}]}]}
  const normalized=root=>{const doc=JSON.parse(readFileSync(join(root,'.opencode','hi','policy','routing.json'),'utf8'));delete doc.applied_at;return doc}
  const a=await HiPlugin({directory:roots[0],worktree:roots[0],project:{},client:clientWithProviderShape(raw)}),b=await HiPlugin({directory:roots[1],worktree:roots[1],project:{},client:clientWithProviderShape(raw)})
  try{
    await a.config({});await b.config({});await a.event({event:{type:'server.connected',properties:{}}});await b.event({event:{type:'server.connected',properties:{}}})
    const compatSet=JSON.parse(String(await a.tool.hi_role_models.execute({action:'set',role:'coder',models:'p/code,p/fallback'},{})))
    const canonicalSet=JSON.parse(String(await b.tool.hi_settings.execute({action:'set-role-model',role:'coder',models:'p/code,p/fallback'},{})))
    assert.equal(compatSet.status,'APPLIED');assert.equal(canonicalSet.status,'APPLIED');assert.deepEqual(compatSet.role_models,canonicalSet.role_models);assert.deepEqual(normalized(roots[0]),normalized(roots[1]))
    const compatClear=JSON.parse(String(await a.tool.hi_role_models.execute({action:'clear',role:'coder'},{})))
    const canonicalClear=JSON.parse(String(await b.tool.hi_settings.execute({action:'clear-role-model',role:'coder'},{})))
    assert.equal(compatClear.status,'APPLIED');assert.equal(canonicalClear.status,'APPLIED');assert.deepEqual(compatClear.role_models,canonicalClear.role_models);assert.deepEqual(normalized(roots[0]),normalized(roots[1]))
  }finally{await a.dispose?.();await b.dispose?.();for(const root of roots)rmSync(root,{recursive:true,force:true})}
})

test('hi_settings applies one validated settings transaction and hot-reloads work mode plus role mappings',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-settings-runtime-'))
  const raw={connected:['p'],all:[{id:'p',models:[{id:'code'},{id:'fallback'},{id:'vision',capabilities:{input:{image:true}}},{id:'text',capabilities:{input:{image:false}}}]}]}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({});await hooks.event({event:{type:'server.connected',properties:{}}})
  const shown=JSON.parse(String(await hooks.tool.hi_settings.execute({action:'show'},{})));assert.equal(shown.status,'OK');assert.equal(shown.work_mode,'adaptive');assert.equal(shown.onboarding.pending,true);assert.equal(shown.onboarding.default_models,'automatic');assert.deepEqual(shown.models.available.map(x=>x.id),['p/code','p/fallback','p/vision','p/text'])
  const blocked=JSON.parse(String(await hooks.tool.hi_settings.execute({action:'apply',settings_json:JSON.stringify({work_mode:'multi',max_agents:3,parallelism:2,roles:{coder:['p/code','p/fallback'],'visual-qa':['p/text']}})},{})))
  assert.equal(blocked.status,'BLOCKED');assert.match(blocked.reason,/vision/);assert.equal(existsSync(join(root,'.opencode','hi','policy','routing.json')),false,'failed settings transaction must not persist a partial work-mode or coder change')
  const applied=JSON.parse(String(await hooks.tool.hi_settings.execute({action:'apply',settings_json:JSON.stringify({work_mode:'multi',max_agents:3,parallelism:2,roles:{coder:['p/code','p/fallback'],'visual-qa':['p/vision']}})},{})))
  assert.equal(applied.status,'APPLIED');assert.equal(applied.work_mode,'multi');assert.equal(applied.execution.maxAgents,3);assert.deepEqual(applied.role_models.coder,['p/code','p/fallback']);assert.deepEqual(applied.role_models['visual-qa'],['p/vision']);assert.equal(applied.restart_required,false)
  const after=JSON.parse(String(await hooks.tool.hi_settings.execute({action:'show'},{})));assert.equal(after.work_mode,'multi');assert.equal(after.onboarding.pending,false);assert.deepEqual(after.models.roles.coder,['p/code','p/fallback'])
  const reset=JSON.parse(String(await hooks.tool.hi_settings.execute({action:'reset'},{})));assert.equal(reset.status,'APPLIED');assert.equal(reset.work_mode,'adaptive');assert.deepEqual(reset.allowed_models,[]);assert.deepEqual(reset.role_models,{})
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})

test('OpenCode-style nested settings args preserve mutating actions on unified and compatibility surfaces',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-settings-nested-args-'))
  const raw={connected:['p'],all:[{id:'p',models:[{id:'code'},{id:'fallback'}]}]}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({});await hooks.event({event:{type:'server.connected',properties:{}}})
  const nested=JSON.parse(String(await hooks.tool.hi_settings.execute({input:{action:'set',role:'review',models:'p/code'}},{})));assert.equal(nested.status,'APPLIED');assert.deepEqual(nested.role_models['qa-reviewer'],['p/code'],'natural-language review alias must persist the canonical qa-reviewer role')
  const nestedCompat=JSON.parse(String(await hooks.tool.hi_role_models.execute({input:{action:'set',role:'architect',models:'p/fallback'}},{})));assert.equal(nestedCompat.status,'APPLIED');assert.deepEqual(nestedCompat.role_models.architect,['p/fallback'])
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})

test('hi_settings refreshes live inventory on open so newly connected providers appear without restarting Hi',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-settings-refresh-'))
  let raw={connected:['p'],all:[{id:'p',models:[{id:'one'}]}]}
  const client=clientWithProviderShape(raw);client.provider.list=async()=>({data:raw})
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
  await hooks.config({});await hooks.event({event:{type:'server.connected',properties:{}}})
  let shown=JSON.parse(String(await hooks.tool.hi_settings.execute({action:'show'},{})));assert.deepEqual(shown.models.available.map(x=>x.id),['p/one'])
  raw={connected:['p','q'],all:[{id:'p',models:[{id:'one'}]},{id:'q',models:[{id:'new'}]}]}
  shown=JSON.parse(String(await hooks.tool.hi_settings.execute({action:'show'},{})));assert.deepEqual(shown.models.available.map(x=>x.id),['p/one','q/new'])
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})

test('runtime inventory prefers OpenCode directory-scoped available models over connected provider catalog models',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-v2-available-'))
  const raw={connected:['p'],all:[{id:'p',models:[{id:'active'},{id:'disabled'}]}]}
  const client=clientWithProviderShape(raw),priorFetch=globalThis.fetch
  globalThis.fetch=async(request)=>{
    const url=new URL(typeof request==='string'?request:request.url);assert.equal(url.pathname,'/api/model')
    return new Response(JSON.stringify({location:{directory:root},data:[{id:'active',providerID:'p',family:'code',name:'Active',api:{id:'active',type:'native',settings:{}},capabilities:{tools:true,input:['text','image'],output:['text']},request:{headers:{},body:{}},variants:[{id:'high',headers:{},body:{}}],time:{released:Date.now()},cost:[{input:1,output:2,cache:{read:0,write:0}}],status:'active',enabled:true,limit:{context:1000,output:100}}]}),{status:200,headers:{'content-type':'application/json'}})
  }
  try{
    const host=createHostPort({directory:root,worktree:root,project:{},serverUrl:new URL('http://opencode.test'),client,experimental_workspace:{register(){}},$:()=>{}})
    assert.equal(await host.refreshRuntimeInventory('test'),1)
    assert.deepEqual(host.getModels().map(x=>x.id),['p/active'])
    assert.equal(host.getModels()[0]?.visionCapable,true);assert.deepEqual(host.getModels()[0]?.variants,['high'])
  }finally{globalThis.fetch=priorFetch;rmSync(root,{recursive:true,force:true})}
})


test('directory-scoped inventory supplements connected providers missing from the scoped surface without resurrecting scoped-filtered models',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-v2-missing-connected-provider-'))
  const raw={connected:['p','opencode-go'],all:[
    {id:'p',models:[{id:'active'},{id:'disabled'}]},
    {id:'opencode-go',models:[{id:'ox-alpha-free',status:'active',capabilities:{input:{image:true}},variants:{low:{},high:{}}}]},
    {id:'offline',models:[{id:'nope'}]},
  ]}
  const client=clientWithProviderShape(raw),priorFetch=globalThis.fetch
  globalThis.fetch=async(request)=>{
    const url=new URL(typeof request==='string'?request:request.url);assert.equal(url.pathname,'/api/model')
    return new Response(JSON.stringify({location:{directory:root},data:[{id:'active',providerID:'p',family:'code',name:'Active',api:{id:'active',type:'native',settings:{}},capabilities:{tools:true,input:['text'],output:['text']},request:{headers:{},body:{}},variants:[],time:{released:Date.now()},cost:[],status:'active',enabled:true,limit:{context:1000,output:100}}]}),{status:200,headers:{'content-type':'application/json'}})
  }
  try{
    const host=createHostPort({directory:root,worktree:root,project:{},serverUrl:new URL('http://opencode.test'),client,experimental_workspace:{register(){}},$:()=>{}})
    assert.equal(await host.refreshRuntimeInventory('test-missing-provider'),2)
    assert.deepEqual(host.getModels().map(x=>x.id),['p/active','opencode-go/ox-alpha-free'])
    assert.equal(host.getModels()[1]?.visionCapable,true);assert.deepEqual(host.getModels()[1]?.variants,['low','high'])
    assert.ok(!host.getModels().some(x=>x.id==='p/disabled'),'scoped p inventory remains authoritative for provider p')
    assert.ok(!host.getModels().some(x=>x.id==='offline/nope'),'unconnected provider never enters effective inventory')
  }finally{globalThis.fetch=priorFetch;rmSync(root,{recursive:true,force:true})}
})

test('explicit connected-provider set removes scoped models from providers OpenCode says are disconnected',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-v2-connected-intersection-'))
  const raw={connected:['opencode-go'],all:[{id:'opencode-go',models:[{id:'ox-alpha-free',capabilities:{input:{image:true}}}]}]}
  const client=clientWithProviderShape(raw),priorFetch=globalThis.fetch
  globalThis.fetch=async(request)=>{
    const url=new URL(typeof request==='string'?request:request.url);assert.equal(url.pathname,'/api/model')
    return new Response(JSON.stringify({location:{directory:root},data:[{id:'scoped-free',providerID:'opencode',family:'free',name:'Scoped Free',api:{id:'scoped-free',type:'native',settings:{}},capabilities:{tools:true,input:['text'],output:['text']},request:{headers:{},body:{}},variants:[],time:{released:Date.now()},cost:[],status:'active',enabled:true,limit:{context:1000,output:100}}]}),{status:200,headers:{'content-type':'application/json'}})
  }
  try{
    const host=createHostPort({directory:root,worktree:root,project:{},serverUrl:new URL('http://opencode.test'),client,experimental_workspace:{register(){}},$:()=>{}})
    assert.equal(await host.refreshRuntimeInventory('test-connected-intersection'),1)
    assert.deepEqual(host.getModels().map(x=>x.id),['opencode-go/ox-alpha-free'])
  }finally{globalThis.fetch=priorFetch;rmSync(root,{recursive:true,force:true})}
})

test('explicit empty connected-provider set removes all scoped models',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-v2-connected-empty-'))
  const raw={connected:[],all:[{id:'p',models:[{id:'catalog'}]}]}
  const client=clientWithProviderShape(raw),priorFetch=globalThis.fetch
  globalThis.fetch=async(request)=>{
    const url=new URL(typeof request==='string'?request:request.url);assert.equal(url.pathname,'/api/model')
    return new Response(JSON.stringify({location:{directory:root},data:[{id:'scoped',providerID:'p',family:'code',name:'Scoped',api:{id:'scoped',type:'native',settings:{}},capabilities:{tools:true,input:['text'],output:['text']},request:{headers:{},body:{}},variants:[],time:{released:Date.now()},cost:[],status:'active',enabled:true,limit:{context:1000,output:100}}]}),{status:200,headers:{'content-type':'application/json'}})
  }
  try{
    const host=createHostPort({directory:root,worktree:root,project:{},serverUrl:new URL('http://opencode.test'),client,experimental_workspace:{register(){}},$:()=>{}})
    assert.equal(await host.refreshRuntimeInventory('test-connected-empty'),0)
    assert.deepEqual(host.getModels(),[])
  }finally{globalThis.fetch=priorFetch;rmSync(root,{recursive:true,force:true})}
})

test('directory-scoped inventory remains usable when connected-provider supplement read fails',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-v2-supplement-failure-'))
  const client=clientWithProviderShape({connected:['p'],all:[]}),priorFetch=globalThis.fetch
  client.provider.list=async()=>{throw new Error('provider registry temporarily unavailable')}
  globalThis.fetch=async(request)=>{
    const url=new URL(typeof request==='string'?request:request.url);assert.equal(url.pathname,'/api/model')
    return new Response(JSON.stringify({location:{directory:root},data:[{id:'active',providerID:'p',family:'code',name:'Active',api:{id:'active',type:'native',settings:{}},capabilities:{tools:true,input:['text'],output:['text']},request:{headers:{},body:{}},variants:[],time:{released:Date.now()},cost:[],status:'active',enabled:true,limit:{context:1000,output:100}}]}),{status:200,headers:{'content-type':'application/json'}})
  }
  try{
    const host=createHostPort({directory:root,worktree:root,project:{},serverUrl:new URL('http://opencode.test'),client,experimental_workspace:{register(){}},$:()=>{}})
    assert.equal(await host.refreshRuntimeInventory('test-supplement-failure'),1)
    assert.deepEqual(host.getModels().map(x=>x.id),['p/active'])
  }finally{globalThis.fetch=priorFetch;rmSync(root,{recursive:true,force:true})}
})

test('directory-scoped empty list still admits models from explicitly connected providers',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-v2-empty-connected-'))
  const raw={connected:['p'],all:[{id:'p',models:[{id:'catalog-only'}]},{id:'offline',models:[{id:'nope'}]}]}
  const client=clientWithProviderShape(raw),priorFetch=globalThis.fetch
  globalThis.fetch=async(request)=>{
    const url=new URL(typeof request==='string'?request:request.url);assert.equal(url.pathname,'/api/model')
    return new Response(JSON.stringify({location:{directory:root},data:[]}),{status:200,headers:{'content-type':'application/json'}})
  }
  try{
    const host=createHostPort({directory:root,worktree:root,project:{},serverUrl:new URL('http://opencode.test'),client,experimental_workspace:{register(){}},$:()=>{}})
    assert.equal(await host.refreshRuntimeInventory('test-empty-connected'),1)
    assert.deepEqual(host.getModels().map(x=>x.id),['p/catalog-only'])
  }finally{globalThis.fetch=priorFetch;rmSync(root,{recursive:true,force:true})}
})

test('directory-scoped empty list does not widen from provider catalog without an explicit connected-provider set',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-v2-empty-unproven-'))
  const raw={all:[{id:'p',models:[{id:'catalog-only'}]}]}
  const client=clientWithProviderShape(raw),priorFetch=globalThis.fetch
  globalThis.fetch=async(request)=>{
    const url=new URL(typeof request==='string'?request:request.url);assert.equal(url.pathname,'/api/model')
    return new Response(JSON.stringify({location:{directory:root},data:[]}),{status:200,headers:{'content-type':'application/json'}})
  }
  try{
    const host=createHostPort({directory:root,worktree:root,project:{},serverUrl:new URL('http://opencode.test'),client,experimental_workspace:{register(){}},$:()=>{}})
    assert.equal(await host.refreshRuntimeInventory('test-empty-unproven'),0)
    assert.deepEqual(host.getModels(),[])
  }finally{globalThis.fetch=priorFetch;rmSync(root,{recursive:true,force:true})}
})


test('hi_settings strict allowed model pool keeps OpenCode inventory truth without inventing routing priority',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-settings-model-pool-'))
  const raw={connected:['p'],all:[{id:'p',models:[{id:'outside'},{id:'second'},{id:'first'},{id:'vision',capabilities:{input:{image:true}}}]}]}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({});await hooks.event({event:{type:'server.connected',properties:{}}})
  const applied=JSON.parse(String(await hooks.tool.hi_settings.execute({input:{action:'apply',settings_json:JSON.stringify({work_mode:'adaptive',allowed_models:['p/first','p/second','p/vision']})}},{})))
  assert.equal(applied.status,'APPLIED');assert.deepEqual(applied.allowed_models,['p/first','p/second','p/vision'])
  const shown=JSON.parse(String(await hooks.tool.hi_settings.execute({action:'show'},{})));assert.deepEqual(shown.models.available.map(x=>x.id),['p/outside','p/second','p/first','p/vision']);assert.deepEqual(shown.models.allowed,['p/first','p/second','p/vision'])
  const routing=JSON.parse(readFileSync(join(root,'.opencode','hi','policy','routing.json'),'utf8'));assert.deepEqual(routing.routing.allowedModels,['p/first','p/second','p/vision']);assert.deepEqual(routing.routing.roleModels,{})
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})


test('global model allowlist is membership authority while automatic selection remains capability-first',()=>{
  const cfg=resolveHiConfig({routing:{allowedModels:['p/second','p/first','p/vision']}})
  const available=[{id:'p/outside',provider:'p',writeCapable:true,tags:['coding']},{id:'p/second',provider:'p',writeCapable:true},{id:'p/first',provider:'p',writeCapable:true,tags:['coding']},{id:'p/vision',provider:'p',writeCapable:true,visionCapable:true,tags:['coding']}]
  const coder=resolveModel('standard',available,cfg,undefined,'coder');assert.equal(coder.primary,'p/first','allowlist order must not override capability-first automatic selection');assert.deepEqual(coder.fallbacks,[],'automatic recovery candidates must never become normal routing fallbacks');assert.deepEqual(coder.recoveryCandidates,['p/vision','p/second'],'recovery-only candidates follow capability ranking, not allowlist persistence order');assert.equal(coder.fallbackVariants['p/vision'],undefined);assert.equal(coder.fallbackVariants['p/second'],undefined);assert.ok(coder.rejected.some(x=>x.id==='p/outside'&&x.reason==='hi-model-not-allowed'))
  const visual=resolveModel('visual',available,cfg,undefined,'visual-qa');assert.equal(visual.primary,'p/vision');assert.ok(visual.rejected.some(x=>x.id==='p/first'&&/vision/.test(x.reason)))
})
