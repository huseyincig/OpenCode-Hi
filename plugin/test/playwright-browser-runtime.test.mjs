import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {PlaywrightBrowserAdapter} from '../dist/opencode/playwright-browser-adapter.js'
import {ContextArtifactStore} from '../dist/runtime/context/artifact-store.js'
import {isBrowserObservationContract} from '../dist/contracts/browser-observation.js'
import {durableArtifactBinaryPath} from '../dist/runtime/storage/ownership.js'
import {HI_BROWSER_EXECUTION_TOOL_IDS} from '../dist/runtime/browser/executor.js'
import {promptToolOverrides} from '../dist/runtime/routing/execution-profile.js'
import {createToolBeforeHook} from '../dist/hooks/tool-before.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function fakePlaywright(){
  const launches=[],sessions=[]
  const chromium={launch:async options=>{launches.push(options);const page={
    _url:'about:blank',_viewport:{width:1280,height:720},events:new Map(),lastFill:undefined,lastKey:undefined,closed:false,
    url(){return this._url},viewportSize(){return this._viewport},async setViewportSize(value){this._viewport={...value}},setDefaultTimeout(){},on(name,fn){this.events.set(name,fn)},
    async goto(url){this._url=url},
    waitForTimeout:async()=>{},
    keyboard:{press:async key=>{page.lastKey=key}},
    screenshot:async()=>new Uint8Array([137,80,78,71,1,2,3]),
    locator(selector){if(selector==='body')return{evaluate:async()=>({body:'Ready\nName',items:[{i:1,tag:'button',text:'Ready'},{i:2,tag:'input',text:'Name'}]})};return{click:async()=>{},fill:async value=>{page.lastFill=value}}},
  };const browserContext={routes:[],async route(pattern,handler){this.routes.push({pattern,handler})},newPage:async()=>page};const browser={newContext:async()=>browserContext,close:async()=>{page.closed=true}};sessions.push({browser,page,context:browserContext});return browser}}
  return{module:{chromium},launches,sessions}
}
const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const ctx=(id,owner=`owner:${id}:1`,origins=['http://127.0.0.1:4173'])=>({task_id:id,execution_owner_ref:owner,executor_version:'hi-playwright-test',allowed_origins:origins})

test('Playwright adapter is local-scope, task-isolated and emits bounded observations',async()=>{
  const pw=fakePlaywright(),adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module})
  assert.equal((await adapter.health()).available,true)
  const a=await adapter.open(ctx('t1'),'http://127.0.0.1:4173/')
  const b=await adapter.open(ctx('t2',undefined,['http://localhost:4174']),'http://localhost:4174/')
  assert.equal(a.result,'OBSERVED');assert.equal(b.result,'OBSERVED');assert.ok(isBrowserObservationContract(a));assert.match(a.dom_summary,/@e1 <button> Ready/)
  assert.equal(pw.sessions.length,2)
  await adapter.click(ctx('t1'),{value:'@e1'});await adapter.type(ctx('t1'),{value:'@e2'},'hello');const key=await adapter.key(ctx('t1'),{key:'ArrowRight'})
  assert.equal(key.action,'key');assert.equal(key.result,'OBSERVED');assert.equal(pw.sessions[0].page.lastKey,'ArrowRight');assert.equal(pw.sessions[0].page.lastFill,'hello');assert.equal(pw.sessions[1].page.lastFill,undefined)
  await assert.rejects(()=>adapter.navigate(ctx('t1'),'https://example.com/'),/outside supported local scope/)
  await assert.rejects(()=>adapter.navigate(ctx('t1'),'http://127.0.0.1:4174/'),/outside the task plan/)
  await adapter.close(ctx('t1'));assert.equal(pw.sessions[0].page.closed,true);assert.equal(pw.sessions[1].page.closed,false)
  await adapter.dispose();assert.equal(pw.sessions[1].page.closed,true)
})



test('browser session state cannot cross execution-owner identity for the same Task',async()=>{
  const pw=fakePlaywright(),adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module})
  const first=ctx('t-owner','m:w:child-a:g1'),second=ctx('t-owner','m:w:child-b:g2')
  await adapter.open(first,'http://127.0.0.1:4173/')
  await adapter.type(first,{value:'@e2'},'first-owner')
  assert.equal(pw.sessions.length,1);assert.equal(pw.sessions[0].page.lastFill,'first-owner')
  await assert.rejects(()=>adapter.inspect(second),/not owned by the current execution identity/)
  await adapter.open(second,'http://127.0.0.1:4173/')
  assert.equal(pw.sessions.length,2);assert.equal(pw.sessions[0].page.closed,true,'stale browser owner must be closed before replacement')
  assert.equal(pw.sessions[1].page.lastFill,undefined,'new execution owner must not inherit stale DOM/auth/input state')
  await assert.rejects(()=>adapter.inspect(first),/not owned by the current execution identity/)
  await adapter.close(second)
})



test('browser snapshot refreshes client-side route state and fails closed on external SPA redirect',async()=>{
  const pw=fakePlaywright(),adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module}),c=ctx('t-spa')
  await adapter.open(c,'http://127.0.0.1:4173/')
  pw.sessions[0].page._url='http://127.0.0.1:4173/client-route?step=2'
  const routed=await adapter.inspect(c);assert.equal(routed.result,'OBSERVED');assert.equal(routed.url,'http://127.0.0.1:4173/client-route?step=2')
  pw.sessions[0].page._url='http://127.0.0.1:4174/escaped'
  const escaped=await adapter.inspect(c);assert.equal(escaped.result,'FAILED');assert.match(escaped.network_errors.join(' '),/outside the task plan/)
  await adapter.dispose()
})

test('screenshot bytes are retained by the existing canonical artifact owner before observation succeeds',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-browser-artifact-')),store=new ContextArtifactStore(root),pw=fakePlaywright()
  try{
    const adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module,persist_screenshot:(bytes,c)=>{const a=store.addBinary('browser-screenshot',`screenshot ${c.task_id}`,bytes,{extension:'png',mediaType:'image/png',producer:'hi-browser-executor',consumerRefs:[`task:${c.task_id}`]});return`hi-artifact:${a.artifact_id}`}})
    await adapter.open(ctx('task_screen',undefined,['http://127.0.0.1:3000']),'http://127.0.0.1:3000/')
    const shot=await adapter.screenshot(ctx('task_screen',undefined,['http://127.0.0.1:3000']))
    assert.equal(shot.result,'OBSERVED');assert.ok(isBrowserObservationContract(shot));assert.match(shot.screenshot_artifact_ref,/^hi-artifact:a_[a-f0-9]{24}$/)
    const id=shot.screenshot_artifact_ref.slice('hi-artifact:'.length),manifest=store.get(id);assert.ok(manifest);const meta=JSON.parse(manifest.content)
    const binary=durableArtifactBinaryPath(root,'browser-screenshot',id,'png');assert.equal(existsSync(binary),true);assert.equal(readFileSync(binary).length,7);assert.equal(meta.byte_size,7);assert.match(meta.byte_sha256,/^[a-f0-9]{64}$/)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('browser execution custom tools are default-off and only active visual workers may pass the child guard',async()=>{
  const off=promptToolOverrides(['read']);for(const id of HI_BROWSER_EXECUTION_TOOL_IDS)assert.equal(off[id],false,id)
  const on=promptToolOverrides(['read',...HI_BROWSER_EXECUTION_TOOL_IDS]);for(const id of HI_BROWSER_EXECUTION_TOOL_IDS)assert.equal(on[id],undefined,id)
  const store=new MissionStore(process.cwd()),m=store.start('parent-browser','visual test')
  store.applyInitialSemanticAssessment('parent-browser',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-review'],requested_external_actions:[],likely_verification:['visual-evidence'],likely_targets:[],intent_signals:['intent.browser'],suppressed_intent_signals:[]})
  m.execution.tasks.push({id:'t_visual',mission_id:m.identity.mission_id,objective:'visual',status:'running',role:'visual-qa',category:'visual',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],external_action_requirements:[],worker_id:'w_visual',created_at:Date.now(),updated_at:Date.now()})
  const visual={id:'w_visual',task_id:'t_visual',role:'visual-qa',category:'visual',session_id:'child-visual',parent_session_id:'parent-browser',parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:['hi-browser-testing'],loaded_methodologies:['hi-browser-testing'],methodologies:['hi-browser-testing'],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation}
  m.execution.workers.push(visual);const bg=new BackgroundRegistry();bg.set(visual);const hook=createToolBeforeHook(store,bg,process.cwd())
  await hook({sessionID:'child-visual',tool:'hi_browser_inspect'},{args:{task_id:'t_visual'}})
  await assert.rejects(()=>hook({sessionID:'child-visual',tool:'hi_status'},{args:{}}),/control-plane tool/)
  visual.status='ready';m.execution.tasks[0].status='waiting'
  await hook({sessionID:'child-visual',tool:'hi_browser_inspect'},{args:{task_id:'t_visual'}})
  visual.restart_reconcile_pending=true;await assert.rejects(()=>hook({sessionID:'child-visual',tool:'hi_browser_inspect'},{args:{task_id:'t_visual'}}),/browser execution guard/)
  visual.restart_reconcile_pending=false;visual.generation_at_spawn=m.continuation.generation+1;assert.equal(await hook({sessionID:'child-visual',tool:'hi_browser_inspect'},{args:{task_id:'t_visual'}}),undefined)
  visual.generation_at_spawn=m.continuation.generation;visual.status='completed';m.execution.tasks[0].status='completed';await assert.rejects(()=>hook({sessionID:'child-visual',tool:'hi_browser_inspect'},{args:{task_id:'t_visual'}}),/browser execution guard/)
  visual.status='busy';m.execution.tasks[0].status='running';visual.role='coder';await assert.rejects(()=>hook({sessionID:'child-visual',tool:'hi_browser_inspect'},{args:{task_id:'t_visual'}}),/browser execution guard/)
})


test('TaskRuntime admits browser methodology only when runtime health resource is present and exposes bounded browser tools to visual-qa',async()=>{
  const created=[],prompts=[],client={session:{create:async req=>{created.push(req);return{data:{id:'child-browser'}}},promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:true}),diff:async()=>({data:[]})}}
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>({agent:PACKAGED_HI_AGENTS}),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']))
  const store=new MissionStore(process.cwd()),m=store.start('browser-ready','verify local browser')
  store.applyInitialSemanticAssessment('browser-ready',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-review'],requested_external_actions:[],likely_verification:['visual-evidence'],likely_targets:['src/view.tsx'],intent_signals:['intent.browser'],suppressed_intent_signals:[]})
  m.methodology.methodology_needs.push({name:'hi-browser-testing',signal:'intent.browser',trigger_source:'task-intent',producer:'intent',reason:'browser acceptance',created_at:Date.now()})
  const out=await runtime.start(m,{objective:'verify local browser',role:'visual-qa',category:'visual',scope:['src/view.tsx'],browserAllowedOrigins:['http://127.0.0.1:4173']})
  assert.equal(out.readiness,'READY');assert.deepEqual(out.methodologies,['hi-browser-testing']);assert.equal(created.length,1);assert.equal(prompts.length,1)
  for(const id of HI_BROWSER_EXECUTION_TOOL_IDS)assert.equal(prompts[0].body.tools[id],undefined,id)
  assert.equal(prompts[0].body.tools.hi_status,false);assert.equal(prompts[0].body.tools.edit,false)
})


test('browser observations capture bounded console and network failures without promoting them to PASS evidence',async()=>{
  const pw=fakePlaywright(),adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module})
  await adapter.open(ctx('t-observe'),'http://127.0.0.1:4173/');const page=pw.sessions[0].page
  page.events.get('console')({type:()=> 'error',text:()=> 'console-boom'})
  page.events.get('requestfailed')({method:()=> 'GET',url:()=> 'http://127.0.0.1:4173/missing',failure:()=>({errorText:'net::ERR_FAILED'})})
  const observed=await adapter.inspect(ctx('t-observe'));assert.equal(observed.result,'OBSERVED');assert.deepEqual(observed.console_errors,['console-boom']);assert.match(observed.network_errors[0],/GET .*missing.*ERR_FAILED/)
  assert.equal('outcome' in observed,false);assert.equal('evidence_id' in observed,false)
  await adapter.close(ctx('t-observe'))
})

test('browser navigation timeout and browser crash become explicit FAILED observations',async()=>{
  const timeoutModule={chromium:{launch:async()=>({newContext:async()=>({route:async()=>{},newPage:async()=>({setDefaultTimeout(){},on(){},goto:async()=>{throw new Error('Timeout 15000ms exceeded')},locator:()=>({evaluate:async()=>({body:'',items:[]})})})}),close:async()=>{}})}}
  const timed=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>timeoutModule}),timeoutResult=await timed.open(ctx('t-timeout'),'http://127.0.0.1:4173/')
  assert.equal(timeoutResult.result,'FAILED');assert.match(timeoutResult.network_errors.join(' '),/Timeout 15000ms exceeded/);await timed.dispose()
  const pw=fakePlaywright(),crashed=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module});await crashed.open(ctx('t-crash'),'http://127.0.0.1:4173/')
  pw.sessions[0].page.locator=()=>({evaluate:async()=>{throw new Error('Target page, context or browser has been closed')}})
  const crashResult=await crashed.inspect(ctx('t-crash'));assert.equal(crashResult.result,'FAILED');assert.match(crashResult.network_errors.join(' '),/browser has been closed/);await crashed.dispose()
})

test('browser wait bounds fail closed instead of permitting unbounded visual execution',async()=>{
  const pw=fakePlaywright(),adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module});await adapter.open(ctx('t-wait'),'http://127.0.0.1:4173/')
  await assert.rejects(()=>adapter.wait(ctx('t-wait'),{milliseconds:-1}),/0\.\.30000ms/);await assert.rejects(()=>adapter.wait(ctx('t-wait'),{milliseconds:30001}),/0\.\.30000ms/);await adapter.close(ctx('t-wait'))
})


test('bounded browser keyboard primitive admits game/navigation keys and rejects arbitrary chords',async()=>{
  const pw=fakePlaywright(),adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module});const c=ctx('t-key')
  await adapter.open(c,'http://127.0.0.1:4173/');const left=await adapter.key(c,{key:'ArrowLeft'});const restart=await adapter.key(c,{key:'R'});assert.equal(left.action,'key');assert.equal(restart.result,'OBSERVED');assert.equal(pw.sessions[0].page.lastKey,'R');await assert.rejects(()=>adapter.key(c,{key:'Control+L'}),/bounded navigation\/action key/);await adapter.close(c)
})


test('bounded viewport primitive records exact responsive dimensions and carries them into screenshots',async()=>{
  const pw=fakePlaywright(),adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module,persist_screenshot:()=>`hi-artifact:a_${'a'.repeat(24)}`}),c=ctx('t-viewport')
  await adapter.open(c,'http://127.0.0.1:4173/')
  const mobile=await adapter.viewport(c,{width:390,height:844})
  assert.equal(mobile.action,'viewport');assert.deepEqual(mobile.viewport,{width:390,height:844});assert.equal(isBrowserObservationContract(mobile),true)
  const shot=await adapter.screenshot(c);assert.deepEqual(shot.viewport,{width:390,height:844});assert.equal(isBrowserObservationContract(shot),true)
  await assert.rejects(()=>adapter.viewport(c,{width:200,height:844}),/240\.\.3840/)
  await assert.rejects(()=>adapter.viewport(c,{width:390,height:2200}),/240\.\.2160/)
  await adapter.close(c)
})
