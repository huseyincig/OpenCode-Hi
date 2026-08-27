import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createConcurrencyPolicySource } from '../dist/runtime/scheduler/concurrency.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import { PACKAGED_HI_AGENTS } from '../dist/generated/agent-config.js'
import { effectiveExecutionSurface,HI_PROCESS_EXECUTION_TOOL_IDS,promptToolOverrides } from '../dist/runtime/routing/execution-profile.js'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function client(created=[],prompts=[]){let n=0;return{session:{
  create:async req=>{const id=`child-${++n}`;created.push({id,req});return{data:{id}}},
  promptAsync:async req=>{prompts.push(req);return{data:{}}},
  abort:async()=>({data:true}),diff:async()=>({data:[]}),
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
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('s','fix the README typo')
  assess(store,'s',{likely_targets:['README.md']})
  const out=await runtime.start(m,{objective:'fix the README typo',role:'coder',category:'quick',scope:['README.md']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id),profile=task.execution_profile
  assert.equal(profile.role,'coder');assert.equal(profile.category,'quick')
  assert.equal(profile.task.objective,'fix the README typo');assert.deepEqual(profile.task.scope,['README.md'])
  assert.deepEqual(profile.task.dependencies,[]);assert.ok(Array.isArray(profile.task.required_evidence))
  assert.deepEqual(profile.methodologies,[])
  assert.ok(profile.tools.includes('edit'));assert.ok(profile.tools.includes('write'));assert.ok(profile.tools.includes('bash'),'ask-gated bash remains OpenCode-owned rather than being hidden by Hi');assert.ok(!profile.tools.includes('skill'));assert.ok(!profile.tools.includes('task'))
  assert.equal(profile.permission_profile.native.source,'effective-opencode-agent')
  assert.equal(profile.permission_profile.native.decisions.edit,'allow')
  assert.equal(profile.permission_profile.native.decisions.task,'deny')
  assert.equal(prompts.length,1)
  const tools=prompts[0].body.tools
  assert.equal(tools.skill,false);assert.equal(tools.task,false);assert.equal(tools.bash,undefined);assert.equal(tools.webfetch,false);assert.equal(tools.websearch,false)
  assert.equal(tools.hi_direct_progress,false);assert.equal(tools.hi_task_start,false);assert.equal(tools.hi_task_cancel,false);assert.equal(tools.hi_team_create,undefined)
  assert.equal(tools.edit,undefined);assert.equal(tools.write,undefined)
  assert.match(JSON.stringify(prompts[0]),/host ask-gated tools remain available under OpenCode native permission control: bash/i)
  assert.match(JSON.stringify(prompts[0]),/Use them only when materially required/i)
})


test('process lifecycle is an exact task-level opt-in and survives child handoff',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('process-profile','run app and verify it')
  assess(store,'process-profile',{required_capabilities:['implementation'],likely_targets:['app.py']})
  const out=await runtime.start(m,{objective:'run app server',role:'coder',category:'standard',scope:['app.py'],processLifecycle:true})
  const task=m.execution.tasks.find(t=>t.id===out.task_id),profile=task.execution_profile
  assert.equal(profile.process_lifecycle,true);for(const id of HI_PROCESS_EXECUTION_TOOL_IDS)assert.ok(profile.tools.includes(id),id)
  const tools=prompts[0].body.tools;for(const id of HI_PROCESS_EXECUTION_TOOL_IDS)assert.equal(tools[id],undefined,id)
  assert.match(JSON.stringify(prompts[0]),new RegExp(`hi_process_spawn with worker_id=${out.worker_id}`));assert.match(JSON.stringify(prompts[0]),/OMIT timeout_ms so the service is not killed by a hard wall-clock deadline/i);assert.match(JSON.stringify(prompts[0]),/hi_process_wait is only for a process that is expected to terminate naturally/i);assert.match(JSON.stringify(prompts[0]),/Never inflate timeout_ms and replay the same healthy persistent command/i);assert.match(JSON.stringify(prompts[0]),/Do not use shell '&', nohup, setsid, disown, pkill, killall/i)
})

test('process lifecycle cannot be widened from mission or task defaults without both semantic and task-level admission',async()=>{
  const c=client([],[]),runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('process-no-task','run bounded command');assess(store,'process-no-task',{required_capabilities:['implementation','interactive-process'],likely_targets:['app.py']})
  const plain=await runtime.start(m,{objective:'inspect app',role:'coder',scope:['app.py']});const profile=m.execution.tasks.find(t=>t.id===plain.task_id).execution_profile
  assert.equal(profile.process_lifecycle,undefined);for(const id of HI_PROCESS_EXECUTION_TOOL_IDS)assert.ok(!profile.tools.includes(id),id)
  const store2=new MissionStore(process.cwd()),m2=store2.start('process-task-optin','bounded task');assess(store2,'process-task-optin',{required_capabilities:['implementation'],likely_targets:['app.py']})
  const owned=await runtime.start(m2,{objective:'run app',role:'coder',scope:['app.py'],processLifecycle:true});assert.equal(m2.execution.tasks.find(t=>t.id===owned.task_id).execution_profile.process_lifecycle,true)
})

test('same-session corrective resume preserves the original execution tool surface and does not spawn a new child',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('s','fix parser bug')
  assess(store,'s',{task_kind:'bug-fix',likely_targets:['src/parser.ts'],likely_verification:['targeted-tests']})
  const first=await runtime.start(m,{objective:'fix parser bug',role:'coder',category:'standard',scope:['src/parser.ts']})
  runtime.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'one correction remains',changed_files:['src/parser.ts'],evidence:[],open_issues:['fix:x'],needs_context:[]})
  m.execution.workers.find(w=>w.id===first.worker_id).selected_methodologies=['hi-test-driven-development'];m.execution.workers.find(w=>w.id===first.worker_id).loaded_methodologies=['hi-test-driven-development']
  m.execution.workers.find(w=>w.id===first.worker_id).fingerprint='intentionally-drifted-after-runtime-model-transition'
  const second=await runtime.resume(m,first.task_id)
  assert.equal(second.worker_id,first.worker_id);assert.equal(second.session_id,first.session_id);assert.equal(created.length,1);assert.equal(prompts.length,2)
  const resumeTools=prompts[1].body.tools
  assert.equal(resumeTools.task,false);assert.equal(resumeTools.hi_direct_progress,false);assert.equal(resumeTools.hi_task_start,false)
  assert.equal(resumeTools.edit,undefined);assert.equal(resumeTools.write,undefined)
  assert.match(JSON.stringify(prompts[1]),/METHODOLOGY EXIT REQUIREMENTS: hi-test-driven-development: task-success, no-open-issues, targeted-test-evidence/)
  let records=m.continuation.recovery_history?.filter(x=>x.action==='same-worker-resume'&&x.task_id===first.task_id&&x.worker_id===first.worker_id)??[]
  assert.equal(records.length,1);assert.equal(records[0].level,1);assert.equal(records[0].model,m.execution.workers.find(w=>w.id===first.worker_id).model)
  runtime.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'same correction still needed',changed_files:['src/parser.ts'],evidence:[],open_issues:['fix:x'],needs_context:[]})
  const third=await runtime.resume(m,first.task_id)
  assert.equal(third.worker_id,first.worker_id);assert.equal(third.session_id,first.session_id);assert.equal(created.length,1);assert.equal(prompts.length,3)
  records=m.continuation.recovery_history?.filter(x=>x.action==='same-worker-resume'&&x.task_id===first.task_id&&x.worker_id===first.worker_id)??[]
  assert.equal(records.length,2);assert.deepEqual(records.map(x=>x.level),[1,2]);assert.equal(records[0].progress_signature,records[1].progress_signature)
  assert.match(JSON.stringify(prompts[2]),/materially different corrective hypothesis or action/i)
})

test('new task cannot bypass an unresolved canonical obligation owner and must resume the exact task',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('reconcile-owner','fix one file then verify it');assess(store,'reconcile-owner',{task_kind:'bug-fix',likely_targets:['src/parser.ts'],likely_verification:['targeted-tests']})
  const first=await runtime.start(m,{objective:'fix parser',role:'coder',category:'quick',scope:['src/parser.ts'],requiredEvidence:['targeted-tests']});runtime.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'one correction remains',changed_files:['src/parser.ts'],evidence:[],open_issues:['fix:x'],needs_context:[]})
  const firstTask=m.execution.tasks.find(t=>t.id===first.task_id);const beforeTasks=m.execution.tasks.length,beforeWorkers=m.execution.workers.length
  await assert.rejects(()=>runtime.start(m,{objective:'replacement verifier',role:'coder',category:'quick',scope:['src/parser.ts'],requiredEvidence:['targeted-tests'],obligationIds:[...firstTask.obligation_ids]}),new RegExp(`Canonical task ${first.task_id} has unresolved FIX_REQUIRED`))
  assert.equal(m.execution.tasks.length,beforeTasks);assert.equal(m.execution.workers.length,beforeWorkers);assert.ok(m.execution.ledger.some(e=>e.type==='task.start.reconcile-required'&&e.task_id===first.task_id))
})

test('explicit cancellation retires unresolved ownership so a fresh replacement may own the same obligation',async()=>{
  const created=[],prompts=[],c=client(created,prompts);const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('cancel-replace','fix one file then verify it');assess(store,'cancel-replace',{task_kind:'bug-fix',likely_targets:['src/parser.ts'],likely_verification:['targeted-tests']})
  const first=await runtime.start(m,{objective:'fix parser',role:'coder',category:'quick',scope:['src/parser.ts'],requiredEvidence:['targeted-tests']});const firstTask=m.execution.tasks.find(t=>t.id===first.task_id)
  runtime.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'one correction remains',changed_files:['src/parser.ts'],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:[]});assert.ok(m.execution.blockers.includes('worker-result-contract-invalid'))
  assert.equal(await runtime.cancel(m,first.task_id),true);assert.equal(firstTask.status,'cancelled');assert.equal(m.execution.blockers.includes('worker-result-contract-invalid'),false)
  const replacement=await runtime.start(m,{objective:'replacement verifier',role:'coder',category:'quick',scope:['src/parser.ts'],requiredEvidence:['targeted-tests'],obligationIds:[...firstTask.obligation_ids]});assert.notEqual(replacement.task_id,first.task_id);assert.equal(m.execution.tasks.find(t=>t.id===replacement.task_id)?.status,'running')
})

test('parent can open chat role-model configuration before semantic mission assessment while other execution tools stay gated',async()=>{
  const store=new MissionStore(process.cwd());store.start('parent-config','Hi rol modellerini ayarla')
  const hook=createToolBeforeHook(store)
  await hook({sessionID:'parent-config',tool:'hi_settings'},{args:{action:'show'}})
  await hook({sessionID:'parent-config',tool:'hi_role_models'},{args:{action:'list'}})
  await assert.rejects(()=>hook({sessionID:'parent-config',tool:'hi_task_start'},{args:{objective:'x'}}),/semantic gate/)
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

test('child process admission is exact-task/same-worker and blocks native background bypass',async()=>{
  const store=new MissionStore(process.cwd()),m=store.start('process-hook-parent','process task');assess(store,'process-hook-parent',{required_capabilities:['implementation','interactive-process']})
  const task={id:'t_process_hook',mission_id:m.identity.mission_id,objective:'run service',status:'running',role:'coder',category:'standard',scope:['app.py'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],execution_profile:{role:'coder',category:'standard',task:{objective:'run service',scope:['app.py'],dependencies:[],required_evidence:[]},tools:['bash',...HI_PROCESS_EXECUTION_TOOL_IDS],process_lifecycle:true,fallback_models:[],methodologies:[],permission_profile:{skill_tool_enabled:false,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny'},verification_policy:{requiredKinds:[],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false},max_context_chars:1000,max_handoff_chars:1000,max_result_chars:1000,max_artifacts:2},gate_ids:[],external_action_requirements:[],created_at:Date.now(),updated_at:Date.now(),worker_id:'w_process_hook'}
  const worker={id:'w_process_hook',task_id:task.id,role:'coder',category:'standard',session_id:'child-process-hook',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'fp',status:'busy',generation_at_spawn:m.continuation.generation}
  m.execution.tasks.push(task);m.execution.workers.push(worker);m.execution.processes.push({process_id:'proc_hook',mission_id:m.identity.mission_id,task_id:task.id,worker_id:worker.id,role:'coder',host:'opencode',command_identity:'x',cwd:process.cwd(),authority_ref:'native',pid:99,process_group_id:99,status:'RUNNING',started_at:Date.now(),cleanup_state:'ACTIVE'})
  const bg=new BackgroundRegistry();bg.set(worker);const hook=createToolBeforeHook(store,bg,()=>resolveHiConfig({}),process.cwd())
  await hook({sessionID:worker.session_id,tool:'hi_process_spawn'},{args:{worker_id:worker.id,command:'node'}})
  await hook({sessionID:worker.session_id,tool:'hi_process_read'},{args:{id:'proc_hook'}})
  await hook({sessionID:worker.session_id,tool:'hi_process_spawn'},{args:{input:{worker_id:worker.id,command:'node'}}})
  await hook({sessionID:worker.session_id,tool:'hi_process_read'},{args:{input:{id:'proc_hook',cursor:0,max_chars:8000}}})
  await assert.rejects(()=>hook({sessionID:worker.session_id,tool:'hi_process_spawn'},{args:{worker_id:'other',command:'node'}}),/another worker/i)
  await assert.rejects(()=>hook({sessionID:worker.session_id,tool:'hi_process_read'},{args:{id:'foreign'}}),/outside its own task/i)
  await assert.rejects(()=>hook({sessionID:worker.session_id,tool:'hi_process_spawn'},{args:{input:{worker_id:'other',command:'node'}}}),/another worker/i)
  await assert.rejects(()=>hook({sessionID:worker.session_id,tool:'hi_process_read'},{args:{input:{id:'foreign'}}}),/outside its own task/i)
  await assert.rejects(()=>hook({sessionID:worker.session_id,tool:'bash'},{args:{command:'node server.js &'}}),/active child workers cannot create native background shell jobs/i)
  await hook({sessionID:worker.session_id,tool:'bash'},{args:{command:'echo "a & b" && echo done'}})
})



test('active parent cannot escape ProcessContract ownership through native background shell regardless of semantic capability',async()=>{
  const store=new MissionStore(process.cwd()),m=store.start('parent-background-guard','run app and verify it')
  assess(store,'parent-background-guard',{required_capabilities:['implementation'],likely_targets:['app.py']})
  const hook=createToolBeforeHook(store,undefined,()=>resolveHiConfig({}),process.cwd())
  await assert.rejects(()=>hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:'python3 app.py &'}}),/Create or resume the exact Task with process_lifecycle=true/i)
  await assert.rejects(()=>hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:'nohup python3 app.py > flask.log 2>&1 &'}}),/native background shell jobs/i)
  await hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:'echo "a & b" && echo done'}})
  await hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:"# Check if script tags are escaped in the HTML (should appear as &lt;script&gt;)\ncurl -s http://localhost:5000/ | grep -o '&lt;script&gt;' | head -3"}})
  await hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:'echo ok &>flask.log'}})
  assert.equal(m.execution.ledger.filter(e=>e.type==='process.native-background-blocked').length,2)
  assert.deepEqual(m.execution.ledger.filter(e=>e.type==='process.native-background-blocked').map(e=>e.payload.owner),['parent','parent'])
})

test('active child without process_lifecycle cannot create an unowned native background job',async()=>{
  const store=new MissionStore(process.cwd()),m=store.start('child-background-guard','inspect and run')
  assess(store,'child-background-guard',{required_capabilities:['implementation']})
  const task={id:'t_child_bg',mission_id:m.identity.mission_id,objective:'inspect',status:'running',role:'coder',category:'standard',scope:['app.py'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],execution_profile:{role:'coder',category:'standard',task:{objective:'inspect',scope:['app.py'],dependencies:[],required_evidence:[]},tools:['bash'],fallback_models:[],methodologies:[],permission_profile:{skill_tool_enabled:false,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny'},verification_policy:{requiredKinds:[],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false},max_context_chars:1000,max_handoff_chars:1000,max_result_chars:1000,max_artifacts:2},gate_ids:[],external_action_requirements:[],created_at:Date.now(),updated_at:Date.now(),worker_id:'w_child_bg'}
  const worker={id:'w_child_bg',task_id:task.id,role:'coder',category:'standard',session_id:'child-bg',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'fp-child-bg',status:'busy',generation_at_spawn:m.continuation.generation}
  m.execution.tasks.push(task);m.execution.workers.push(worker);const bg=new BackgroundRegistry();bg.set(worker)
  const hook=createToolBeforeHook(store,bg,()=>resolveHiConfig({}),process.cwd())
  await assert.rejects(()=>hook({sessionID:worker.session_id,tool:'bash'},{args:{command:'node server.js &'}}),/active child workers cannot create native background shell jobs/i)
  assert.equal(m.execution.ledger.at(-1).type,'process.native-background-blocked');assert.equal(m.execution.ledger.at(-1).worker_id,worker.id)
})

test('background shell ownership guard is scoped to active Hi missions only',async()=>{
  const store=new MissionStore(process.cwd()),hook=createToolBeforeHook(store,undefined,()=>resolveHiConfig({}),process.cwd())
  await hook({sessionID:'not-a-hi-mission',tool:'bash'},{args:{command:'echo ok &'}})
})
test('prompt tool overrides only disable tools; they never turn a denied native permission into allow',()=>{
  const overrides=promptToolOverrides(['read','grep'])
  assert.equal(overrides.read,undefined);assert.equal(overrides.grep,undefined)
  assert.equal(overrides.edit,false);assert.equal(overrides.write,false);assert.equal(overrides.apply_patch,false)
  assert.equal(overrides.task,false);assert.equal(overrides.hi_task_start,false)
  assert.ok(!Object.values(overrides).includes(true))
})
