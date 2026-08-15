import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import { PACKAGED_HI_AGENTS } from '../dist/generated/agent-config.js'
import { effectiveExecutionSurface,promptToolOverrides } from '../dist/runtime/routing/execution-profile.js'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'

function client(created=[],prompts=[]){let n=0;return{session:{
  create:async req=>{const id=`child-${++n}`;created.push({id,req});return{data:{id}}},
  promptAsync:async req=>{prompts.push(req);return{data:{}}},
  abort:async()=>({data:{}}),diff:async()=>({data:[]}),
}}}
const host={agent:PACKAGED_HI_AGENTS}
function assess(store,sid,overrides={}){
  return store.applyInitialSemanticAssessment(sid,{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[],...overrides})
}

test('execution surface mirrors native agent permissions and maps edit permission to actual write tools',()=>{
  const coder=effectiveExecutionSurface(host,'coder',true)
  assert.equal(coder.permissions.source,'effective-opencode-agent')
  assert.equal(coder.permissions.mode,'subagent')
  for(const id of ['read','glob','grep','bash','edit','write','apply_patch'])assert.ok(coder.tools.includes(id),id)
  for(const id of ['task','question','webfetch','websearch'])assert.ok(!coder.tools.includes(id),id)
  const qa=effectiveExecutionSurface(host,'qa-reviewer',true)
  for(const id of ['edit','write','apply_patch','task','question','webfetch','websearch'])assert.ok(!qa.tools.includes(id),id)
  assert.ok(qa.tools.includes('read'))
})

test('deny-by-default skill map keeps native skill tool available when exact Hi methodologies are explicitly allowed',()=>{
  const visual=effectiveExecutionSurface(host,'visual-qa',true)
  assert.equal(visual.permissions.decisions.skill,'allow')
  assert.ok(visual.tools.includes('skill'))
  assert.equal(visual.permissions.decisions.bash,'ask')
  assert.equal(visual.permissions.decisions.edit,'deny')
})

test('zero-skill task gets a complete bounded execution profile and per-message tool minimization',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(c,new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('s','fix the README typo')
  assess(store,'s',{likely_targets:['README.md']})
  const out=await runtime.start(m,{objective:'fix the README typo',role:'coder',category:'quick',scope:['README.md']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id),profile=task.execution_profile
  assert.equal(profile.role,'coder');assert.equal(profile.category,'quick')
  assert.equal(profile.task.objective,'fix the README typo');assert.deepEqual(profile.task.scope,['README.md'])
  assert.deepEqual(profile.task.dependencies,[]);assert.ok(Array.isArray(profile.task.required_evidence))
  assert.deepEqual(profile.methodologies,[])
  assert.ok(profile.tools.includes('edit'));assert.ok(profile.tools.includes('write'));assert.ok(!profile.tools.includes('skill'));assert.ok(!profile.tools.includes('task'))
  assert.equal(profile.permission_profile.native.source,'effective-opencode-agent')
  assert.equal(profile.permission_profile.native.decisions.edit,'allow')
  assert.equal(profile.permission_profile.native.decisions.task,'deny')
  assert.equal(prompts.length,1)
  const tools=prompts[0].body.tools
  assert.equal(tools.skill,false);assert.equal(tools.task,false);assert.equal(tools.webfetch,false);assert.equal(tools.websearch,false)
  assert.equal(tools.hi_direct_progress,false);assert.equal(tools.hi_task_start,false);assert.equal(tools.hi_task_cancel,false);assert.equal(tools.hi_team_create,false)
  assert.equal(tools.edit,undefined);assert.equal(tools.write,undefined)
})

test('same-session corrective resume preserves the original execution tool surface and does not spawn a new child',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(c,new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('s','fix parser bug')
  assess(store,'s',{task_kind:'bug-fix',likely_targets:['src/parser.ts'],likely_verification:['targeted-tests']})
  const first=await runtime.start(m,{objective:'fix parser bug',role:'coder',category:'standard',scope:['src/parser.ts']})
  runtime.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'one correction remains',changed_files:['src/parser.ts'],evidence:[],open_issues:['fix:x'],needs_context:[]})
  m.execution.workers.find(w=>w.id===first.worker_id).selected_methodologies=['hi-test-driven-development'];m.execution.workers.find(w=>w.id===first.worker_id).loaded_methodologies=['hi-test-driven-development']
  const second=await runtime.start(m,{objective:'fix parser bug',role:'coder',category:'standard',scope:['src/parser.ts']})
  assert.equal(second.worker_id,first.worker_id);assert.equal(second.session_id,first.session_id);assert.equal(created.length,1);assert.equal(prompts.length,2)
  const resumeTools=prompts[1].body.tools
  assert.equal(resumeTools.task,false);assert.equal(resumeTools.hi_direct_progress,false);assert.equal(resumeTools.hi_task_start,false)
  assert.equal(resumeTools.edit,undefined);assert.equal(resumeTools.write,undefined)
  assert.match(JSON.stringify(prompts[1]),/METHODOLOGY EXIT REQUIREMENTS: hi-test-driven-development: task-success, no-open-issues, targeted-test-evidence/)
})

test('child workers cannot invoke any Hi control-plane custom tool, including completion and cancellation surfaces',async()=>{
  const store=new MissionStore(process.cwd()),m=store.start('parent','implement')
  m.execution.tasks.push({id:'t',objective:'x',status:'running',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w',created_at:Date.now(),updated_at:Date.now()})
  const worker={id:'w',task_id:'t',role:'coder',category:'standard',session_id:'child',parent_session_id:'parent',parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation}
  m.execution.workers.push(worker)
  const bg=new BackgroundRegistry();bg.set(worker)
  const hook=createToolBeforeHook(store,bg,()=>resolveHiConfig({}),process.cwd())
  for(const tool of ['hi_direct_progress','hi_task_cancel','hi_ledger','hi_status','hi_context_artifact_add']){
    await assert.rejects(()=>hook({sessionID:'child',tool},{args:{}}),/child workers cannot invoke Hi control-plane tool/)
  }
})

test('prompt tool overrides only disable tools; they never turn a denied native permission into allow',()=>{
  const overrides=promptToolOverrides(['read','grep'])
  assert.equal(overrides.read,undefined);assert.equal(overrides.grep,undefined)
  assert.equal(overrides.edit,false);assert.equal(overrides.write,false);assert.equal(overrides.apply_patch,false)
  assert.equal(overrides.task,false);assert.equal(overrides.hi_task_start,false)
  assert.ok(!Object.values(overrides).includes(true))
})
