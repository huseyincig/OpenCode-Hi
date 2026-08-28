import test from 'node:test'
import {readFileSync} from 'node:fs'
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
  assert.equal(visual.permissions.decisions.bash,'unknown')
  assert.equal(visual.permissions.decisions.edit,'deny')
})

test('child bash inherits host-global native ASK/DENY instead of shadowing it with a Hi role rule',()=>{
  for(const value of ['ask','deny']){
    const inherited=effectiveExecutionSurface({permission:{bash:{'*':value}},agent:PACKAGED_HI_AGENTS},'coder',false)
    assert.equal(inherited.permissions.decisions.bash,value)
    assert.equal(inherited.tools.includes('bash'),value!=='deny')
  }
  assert.equal(Object.hasOwn(PACKAGED_HI_AGENTS.coder.permission,'bash'),false,'canonical child must not own bash permission')
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
  assert.ok(profile.tools.includes('edit'));assert.ok(profile.tools.includes('write'));assert.ok(profile.tools.includes('bash'),'inherited native bash remains OpenCode-owned rather than being hidden by Hi');assert.ok(!profile.tools.includes('skill'));assert.ok(!profile.tools.includes('task'))
  assert.equal(profile.permission_profile.native.source,'effective-opencode-agent')
  assert.equal(profile.permission_profile.native.decisions.edit,'allow')
  assert.equal(profile.permission_profile.native.decisions.bash,'unknown','raw packaged child profile intentionally leaves bash to OpenCode inheritance')
  assert.equal(profile.permission_profile.native.decisions.task,'deny')
  assert.equal(prompts.length,1)
  const tools=prompts[0].body.tools
  assert.equal(tools.skill,false);assert.equal(tools.task,false);assert.equal(tools.bash,undefined);assert.equal(tools.webfetch,false);assert.equal(tools.websearch,false)
  assert.equal(tools.hi_direct_progress,false);assert.equal(tools.hi_task_start,false);assert.equal(tools.hi_task_cancel,false);assert.equal(tools.hi_team_create,undefined)
  assert.equal(tools.edit,undefined);assert.equal(tools.write,undefined)
  assert.doesNotMatch(JSON.stringify(prompts[0]),/host ask-gated tools remain available under OpenCode native permission control: bash/i)
})




test('repository explorer handoff projects clearance result contract without polluting task verification evidence',async()=>{
  for(const [suffix,ambiguity,critical] of [['resolvable','resolvable',false],['critical','contract-critical',true]]){
    const created=[],prompts=[],c=client(created,prompts)
    const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
    const store=new MissionStore(process.cwd()),sid=`explorer-clearance-handoff-${suffix}`,m=store.start(sid,'resolve repository ambiguity')
    assess(store,sid,{task_kind:'bug-fix',scope:'local',ambiguity,required_capabilities:['repository-analysis','implementation'],likely_targets:['src/a.ts'],likely_verification:[]})
    const analysis=m.execution.obligations.find(o=>o.kind==='analysis');assert.ok(analysis)
    const out=await runtime.start(m,{objective:'inspect src/a.ts',role:'repository-explorer',scope:['src/a.ts'],obligationIds:[analysis.id]})
    const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.ok(task);assert.equal(task.requiredEvidence.includes('source-provenance-evidence'),false);assert.equal(task.requiredEvidence.includes('decision-evidence'),false);assert.equal(task.execution_profile.task.required_evidence.includes('source-provenance-evidence'),false)
    const handoff=String(prompts[0]?.body?.parts?.[0]?.text??'');assert.match(handoff,/EXPLORATION CLEARANCE RESULT CONTRACT/);assert.match(handoff,/source-provenance-evidence/);assert.match(handoff,/HI_SOURCE_READ_RECEIPT evidence_ref/);assert.match(handoff,/evidence_refs/)
    if(critical)assert.match(handoff,/CONTRACT-CRITICAL EXPLORATION/);else assert.doesNotMatch(handoff,/CONTRACT-CRITICAL EXPLORATION/)
  }
})

test('repository explorer with no mission ambiguity gets no clearance result contract',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('explorer-no-clearance-handoff','inspect known repository surface')
  assess(store,'explorer-no-clearance-handoff',{task_kind:'bug-fix',scope:'local',ambiguity:'none',required_capabilities:['repository-analysis','implementation'],likely_targets:['src/a.ts'],likely_verification:[]})
  const out=await runtime.start(m,{objective:'inspect src/a.ts',role:'repository-explorer',scope:['src/a.ts']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.ok(task);assert.equal(task.requiredEvidence.includes('source-provenance-evidence'),false);assert.equal(task.requiredEvidence.includes('decision-evidence'),false)
  const handoff=String(prompts[0]?.body?.parts?.[0]?.text??'');assert.doesNotMatch(handoff,/EXPLORATION CLEARANCE RESULT CONTRACT/)
})

test('noncanonical required evidence is rejected before obligation reconciliation can discard it',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('closed-task-evidence','inspect one file before implementation')
  assess(store,'closed-task-evidence',{task_kind:'bug-fix',scope:'multi-file',required_capabilities:['repository-analysis','implementation'],likely_targets:['index.html']})
  const analysis=m.execution.obligations.find(o=>o.kind==='analysis');assert.ok(analysis);assert.deepEqual(analysis.requiredEvidence,[])
  await assert.rejects(()=>runtime.start(m,{objective:'inspect index.html',role:'repository-explorer',scope:['index.html'],requiredEvidence:['Root cause understood'],obligationIds:[analysis.id]}),/Unsupported Hi required evidence kind.*Root cause understood/)
  assert.equal(m.execution.tasks.length,0);assert.equal(m.execution.workers.length,0);assert.equal(created.length,0);assert.equal(prompts.length,0)
})

test('review evidence is fenced from non-reviewer analysis and implementation handoffs without weakening explorer clearance',async()=>{
  for(const [suffix,role,kind] of [['analysis','repository-explorer','analysis'],['implementation','coder','implementation']]){
    const created=[],prompts=[],c=client(created,prompts)
    const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
    const store=new MissionStore(process.cwd()),sid=`empty-owned-${suffix}`,m=store.start(sid,'repair dashboard fixture')
    assess(store,sid,{task_kind:'bug-fix',scope:'multi-file',ambiguity:'resolvable',required_capabilities:['repository-analysis','implementation','verification'],likely_targets:['index.html'],likely_verification:['review-evidence']})
    const obligation=m.execution.obligations.find(o=>o.kind===kind);assert.ok(obligation);assert.deepEqual(obligation.requiredEvidence,[])
    const out=await runtime.start(m,{objective:`bounded ${suffix}`,role,scope:['index.html'],requiredEvidence:['review-evidence'],obligationIds:[obligation.id]})
    const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.ok(task);assert.deepEqual(task.obligation_ids,[obligation.id]);assert.deepEqual(task.requiredEvidence,[]);assert.deepEqual(task.execution_profile.task.required_evidence,[])
    const handoff=String(prompts[0]?.body?.parts?.[0]?.text??'');assert.match(handoff,/Task evidence contract: none/i);assert.doesNotMatch(handoff,/Verification contract: review-evidence/i)
    assert.ok(m.execution.ledger.some(e=>e.type==='task.evidence-owner-reconciled'&&e.payload?.requested_evidence?.includes('review-evidence')&&e.payload?.removed_evidence?.includes('review-evidence')&&Array.isArray(e.payload?.authoritative_evidence)&&e.payload.authoritative_evidence.length===0))
    if(role==='repository-explorer')assert.match(PACKAGED_HI_AGENTS['repository-explorer'].prompt,/source-provenance-evidence/,'explorer clearance remains a role/runtime contract rather than mission verifier inheritance')
  }
})


test('distinct visual verification owner keeps mission visual evidence off analysis and implementation task handoffs',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:1,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('distinct-visual-owner','repair dashboard then visually verify it')
  assess(store,'distinct-visual-owner',{task_kind:'bug-fix',scope:'multi-file',ambiguity:'resolvable',required_capabilities:['repository-analysis','implementation','verification','visual-qa'],likely_targets:['index.html'],likely_verification:['visual-check']})
  const analysis=m.execution.obligations.find(o=>o.kind==='analysis'),implementation=m.execution.obligations.find(o=>o.kind==='implementation'),verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(analysis&&implementation&&verification);assert.deepEqual(verification.requiredEvidence,['visual-check'])
  const explorer=await runtime.start(m,{objective:'inspect dashboard',role:'repository-explorer',scope:['index.html'],obligationIds:[analysis.id]})
  const coder=await runtime.start(m,{objective:'repair dashboard',role:'coder',scope:['index.html'],obligationIds:[implementation.id]})
  const explorerTask=m.execution.tasks.find(t=>t.id===explorer.task_id),coderTask=m.execution.tasks.find(t=>t.id===coder.task_id);assert.ok(explorerTask&&coderTask)
  assert.deepEqual(explorerTask.requiredEvidence,[]);assert.deepEqual(coderTask.requiredEvidence,[]);assert.deepEqual(verification.requiredEvidence,['visual-check'],'the distinct visual verification owner keeps its canonical mission evidence contract')
  assert.ok(m.execution.ledger.some(e=>e.type==='task.evidence-owner-reconciled'&&e.payload?.policy==='distinct-verification-owner-wins'&&e.payload?.role==='repository-explorer'&&e.payload?.verification_owner==='visual-qa'&&e.payload?.removed_evidence?.includes('visual-check')))
  assert.ok(m.execution.ledger.some(e=>e.type==='task.evidence-owner-reconciled'&&e.payload?.policy==='distinct-verification-owner-wins'&&e.payload?.role==='coder'&&e.payload?.verification_owner==='visual-qa'&&e.payload?.removed_evidence?.includes('visual-check')))
  const explorerHandoff=String(prompts[0]?.body?.parts?.[0]?.text??'');assert.match(explorerHandoff,/Task evidence contract: none/i);assert.doesNotMatch(explorerHandoff,/Verification contract: visual-check/i)
})

test('model task evidence cannot widen beyond canonical mission verification admission',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('model-evidence-widening','repair static dashboard and visually verify it')
  assess(store,'model-evidence-widening',{task_kind:'bug-fix',scope:'multi-file',ambiguity:'resolvable',required_capabilities:['repository-analysis','implementation','verification','visual-qa'],likely_targets:['index.html'],likely_verification:['visual-check']})
  const analysis=m.execution.obligations.find(o=>o.kind==='analysis'),implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(analysis&&implementation);assert.deepEqual(m.execution.verification_policy.requiredKinds,['visual-check'])
  const explorer=await runtime.start(m,{objective:'inspect static dashboard',role:'repository-explorer',scope:['index.html'],requiredEvidence:['build'],obligationIds:[analysis.id]})
  const coder=await runtime.start(m,{objective:'repair static dashboard',role:'coder',scope:['index.html'],requiredEvidence:['build','visual-check'],obligationIds:[implementation.id]})
  const explorerTask=m.execution.tasks.find(t=>t.id===explorer.task_id),coderTask=m.execution.tasks.find(t=>t.id===coder.task_id);assert.ok(explorerTask&&coderTask)
  assert.deepEqual(explorerTask.requiredEvidence,[]);assert.deepEqual(coderTask.requiredEvidence,[])
  assert.ok(m.execution.ledger.some(e=>e.type==='task.evidence-contract-reconciled'&&e.payload?.policy==='mission-verification-admission-wins'&&e.payload?.role==='repository-explorer'&&e.payload?.removed_evidence?.includes('build')))
  assert.ok(m.execution.ledger.some(e=>e.type==='task.evidence-contract-reconciled'&&e.payload?.policy==='mission-verification-admission-wins'&&e.payload?.role==='coder'&&e.payload?.removed_evidence?.includes('build')))
  assert.ok(m.execution.ledger.some(e=>e.type==='task.evidence-owner-reconciled'&&e.payload?.policy==='distinct-verification-owner-wins'&&e.payload?.role==='coder'&&e.payload?.removed_evidence?.includes('visual-check')))
  assert.match(String(prompts[0]?.body?.parts?.[0]?.text??''),/Task evidence contract: none/i);assert.doesNotMatch(String(prompts[0]?.body?.parts?.[0]?.text??''),/Verification contract: build/i)
})

test('task evidence admission preserves stronger proof already allowed by the mission contract',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('stronger-task-proof','make a bounded local change')
  assess(store,'stronger-task-proof',{task_kind:'implementation',scope:'local',ambiguity:'none',required_capabilities:['implementation','verification'],likely_targets:['src/a.ts'],likely_verification:['changed-surface-sanity']})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation);assert.deepEqual(m.execution.verification_policy.requiredKinds,['changed-surface-sanity'])
  const out=await runtime.start(m,{objective:'change src/a.ts and use a stronger targeted verifier',role:'coder',scope:['src/a.ts'],requiredEvidence:['targeted-tests'],obligationIds:[implementation.id]})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.ok(task);assert.deepEqual(task.requiredEvidence,['targeted-tests']);assert.match(String(prompts[0]?.body?.parts?.[0]?.text??''),/Verification contract: targeted-tests/i)
  assert.equal(m.execution.ledger.some(e=>e.type==='task.evidence-contract-reconciled'&&e.payload?.policy==='mission-verification-admission-wins'&&e.payload?.role==='coder'),false)
})

test('nonvisual implementation keeps mission technical verifier evidence when verification has no distinct child owner',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('nonvisual-verifier-owner','fix parser and test it')
  assess(store,'nonvisual-verifier-owner',{task_kind:'bug-fix',scope:'local',required_capabilities:['implementation','verification'],likely_targets:['src/parser.ts'],likely_verification:['targeted-tests']})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation)
  const out=await runtime.start(m,{objective:'fix parser',role:'coder',scope:['src/parser.ts'],obligationIds:[implementation.id]})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.ok(task);assert.deepEqual(task.requiredEvidence,['targeted-tests']);assert.match(String(prompts[0]?.body?.parts?.[0]?.text??''),/Verification contract: targeted-tests/i)
  assert.equal(m.execution.ledger.some(e=>e.type==='task.evidence-owner-reconciled'&&e.payload?.policy==='distinct-verification-owner-wins'&&e.payload?.role==='coder'),false)
})

test('verification-only coder task loses repository mutation surface and tool guard fails closed',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('verification-only-coder','implementation done; run exact verification only')
  assess(store,'verification-only-coder',{likely_targets:['src/app.ts'],likely_verification:['targeted-tests']})
  const implementation=m.execution.obligations.find(o=>o.id==='o-implementation'),verification=m.execution.obligations.find(o=>o.id==='o-verification');implementation.status='closed';implementation.closedAt=Date.now()
  const out=await runtime.start(m,{objective:'run targeted verifier only',role:'coder',category:'quick',scope:['src/app.ts'],requiredEvidence:['targeted-tests'],obligationIds:[verification.id]})
  const task=m.execution.tasks.find(t=>t.id===out.task_id),worker=m.execution.workers.find(w=>w.id===out.worker_id),profile=task.execution_profile
  assert.deepEqual(task.obligation_ids,[verification.id]);assert.deepEqual(task.requiredEvidence,['targeted-tests'])
  assert.equal(profile.permission_profile.native.decisions.edit,'deny')
  for(const id of ['edit','write','apply_patch'])assert.ok(!profile.tools.includes(id),id)
  assert.equal(prompts[0].body.tools.edit,false);assert.equal(prompts[0].body.tools.write,false);assert.equal(prompts[0].body.tools.apply_patch,false)
  assert.ok(profile.tools.includes('bash'),'non-mutating admitted verifier execution remains available')
  const bg=new BackgroundRegistry();bg.set(worker);const hook=createToolBeforeHook(store,bg,process.cwd(),process.cwd())
  await assert.rejects(()=>hook({sessionID:worker.session_id,tool:'edit'},{args:{filePath:'src/app.ts'}}),/verification ownership guard/)
  await hook({sessionID:worker.session_id,tool:'bash'},{args:{command:'node --test test/app.test.mjs'}})
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.verification-only-mutation-blocked'&&e.task_id===task.id))
})


test('exact review obligation overrides semantic evidence aliases and does not inherit unrelated mission visual verification',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('review-owned-evidence','review dependency change while visual verification is separately owned')
  assess(store,'review-owned-evidence',{required_capabilities:['implementation','security-review','visual-qa'],likely_targets:['requirements.txt'],likely_verification:['visual-check']})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');implementation.status='closed';implementation.closedAt=Date.now()
  m.execution.verification_policy.requiredKinds=['visual-check'];m.execution.verification_policy.requireReview=true
  const review={id:'o-dependency-review-test',kind:'review',summary:'Dependency graph changed',status:'open',requiredEvidence:['review-evidence']};m.execution.obligations.push(review)
  const out=await runtime.start(m,{objective:'review Flask dependency',role:'security-reviewer',category:'review',scope:['requirements.txt'],requiredEvidence:['visual-check'],obligationIds:[review.id]})
  const task=m.execution.tasks.find(t=>t.id===out.task_id),text=JSON.stringify(prompts[0])
  assert.deepEqual(task.requiredEvidence,['review-evidence']);assert.deepEqual(task.obligation_ids,[review.id])
  assert.match(text,/REQUIRED EVIDENCE: review-evidence/);assert.match(text,/Verification contract: review-evidence/i);assert.doesNotMatch(text,/Verification contract: visual-check/i)
  assert.ok(m.execution.ledger.some(e=>e.type==='task.evidence-contract-reconciled'&&e.task_id===undefined&&e.payload?.requested_evidence?.includes('visual-check')&&e.payload?.authoritative_evidence?.includes('review-evidence')))
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
  assert.match(JSON.stringify(prompts[0]),new RegExp(`hi_process_spawn with worker_id=${out.worker_id}`));assert.match(JSON.stringify(prompts[0]),/parent cannot proxy hi_process_\* calls/i);assert.match(JSON.stringify(prompts[0]),/command=.*python3.*args_json/i);assert.match(JSON.stringify(prompts[0]),/never embed arguments inside command/i);assert.match(JSON.stringify(prompts[0]),/OMIT timeout_ms so the service is not killed by a hard wall-clock deadline/i);assert.match(JSON.stringify(prompts[0]),/hi_process_wait is only for a process that is expected to terminate naturally/i);assert.match(JSON.stringify(prompts[0]),/Never inflate timeout_ms and replay the same healthy persistent command/i);assert.match(JSON.stringify(prompts[0]),/Do not use shell '&', nohup, setsid, disown, pkill, killall/i)
})

test('process lifecycle cannot be widened from mission or task defaults without both semantic and task-level admission',async()=>{
  const c=client([],[]),runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('process-no-task','run bounded command');assess(store,'process-no-task',{required_capabilities:['implementation','interactive-process'],likely_targets:['app.py']})
  const plain=await runtime.start(m,{objective:'inspect app',role:'coder',scope:['app.py']});const profile=m.execution.tasks.find(t=>t.id===plain.task_id).execution_profile
  assert.equal(profile.process_lifecycle,undefined);for(const id of HI_PROCESS_EXECUTION_TOOL_IDS)assert.ok(!profile.tools.includes(id),id)
  const store2=new MissionStore(process.cwd()),m2=store2.start('process-task-optin','bounded task');assess(store2,'process-task-optin',{required_capabilities:['implementation'],likely_targets:['app.py']})
  const owned=await runtime.start(m2,{objective:'run app',role:'coder',scope:['app.py'],processLifecycle:true});assert.equal(m2.execution.tasks.find(t=>t.id===owned.task_id).execution_profile.process_lifecycle,true)
})

test('process-lifecycle corrective resume projects only exact owned ProcessContracts and requires reobservation before spawn',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('process-resume-context','run app and verify it')
  assess(store,'process-resume-context',{required_capabilities:['implementation'],likely_targets:['app.py']})
  const first=await runtime.start(m,{objective:'run app server',role:'coder',category:'standard',scope:['app.py'],processLifecycle:true})
  const task=m.execution.tasks.find(t=>t.id===first.task_id),worker=m.execution.workers.find(w=>w.id===first.worker_id)
  m.execution.processes.push({process_id:'proc_owned',mission_id:m.identity.mission_id,task_id:task.id,worker_id:worker.id,host:'opencode',command_identity:'a'.repeat(64),cwd:process.cwd(),pid:4312,process_group_id:4312,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],authority_ref:'native-permission:test:bash',cleanup_state:'ACTIVE'})
  m.execution.processes.push({process_id:'proc_other',mission_id:m.identity.mission_id,task_id:'other-task',worker_id:'other-worker',host:'opencode',command_identity:'b'.repeat(64),cwd:'/tmp/other',pid:4313,process_group_id:4313,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],authority_ref:'native-permission:other:bash',cleanup_state:'ACTIVE'})
  runtime.applyResult(m,first.worker_id,{status:'NEEDS_CONTEXT',summary:'permission denied',changed_files:[],evidence:[],open_issues:['permission-denied:x'],needs_context:['use an allowed different path']})
  await runtime.resume(m,first.task_id)
  const text=JSON.stringify(prompts[1])
  assert.match(text,/CURRENT OWNED RUNTIME PROCESSES: proc_owned status=RUNNING cleanup=ACTIVE pid=4312/)
  assert.match(text,/reobserve your own process with hi_process_list\/hi_process_read before deciding whether another spawn is required/i)
  assert.match(text,/Do not spawn a duplicate merely because the previous WorkerResult omitted process state/i)
  assert.doesNotMatch(text,/proc_other|\/tmp\/other/)
})

test('non-process corrective resume does not leak unrelated ProcessContracts',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('plain-resume-context','fix parser')
  assess(store,'plain-resume-context',{task_kind:'bug-fix',likely_targets:['src/parser.ts']})
  const first=await runtime.start(m,{objective:'fix parser',role:'coder',scope:['src/parser.ts']})
  m.execution.processes.push({process_id:'proc_unrelated',mission_id:m.identity.mission_id,task_id:'other-task',worker_id:'other-worker',host:'opencode',command_identity:'c'.repeat(64),cwd:'/tmp/unrelated',pid:5001,process_group_id:5001,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],authority_ref:'native-permission:other:bash',cleanup_state:'ACTIVE'})
  runtime.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'fix remains',changed_files:[],evidence:[],open_issues:['fix:x'],needs_context:[]})
  await runtime.resume(m,first.task_id)
  const text=JSON.stringify(prompts[1]);assert.doesNotMatch(text,/CURRENT OWNED RUNTIME PROCESSES|proc_unrelated|\/tmp\/unrelated/)
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

test('exact task resume preserves stored role identity when later mission routing moves to visual-qa',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('resume-role-drift','fix backend then visually verify it')
  assess(store,'resume-role-drift',{task_kind:'bug-fix',required_capabilities:['implementation'],likely_targets:['src/server.ts'],likely_verification:[]})
  const first=await runtime.start(m,{objective:'fix backend',role:'coder',category:'quick',scope:['src/server.ts'],requiredEvidence:[]})
  runtime.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'return the structured result envelope',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['structured result required']})
  const task=m.execution.tasks.find(t=>t.id===first.task_id),worker=m.execution.workers.find(w=>w.id===first.worker_id);assert.equal(task.role,'coder');assert.equal(worker.role,'coder')
  m.identity.intent.requiredCapabilities=[...new Set([...m.identity.intent.requiredCapabilities,'visual-qa'])]
  const verification=m.execution.obligations.find(o=>o.kind==='verification');if(verification&&!task.obligation_ids.includes(verification.id))task.obligation_ids.push(verification.id)
  const resumed=await runtime.resume(m,task.id)
  assert.equal(resumed.task_id,task.id);assert.equal(resumed.worker_id,worker.id);assert.equal(resumed.session_id,first.session_id);assert.equal(task.role,'coder');assert.equal(worker.role,'coder');assert.equal(created.length,1);assert.equal(prompts.length,2)
})

test('exact task resume rejects an explicit role change instead of reclassifying the existing owner',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('resume-explicit-role-drift','fix backend')
  assess(store,'resume-explicit-role-drift',{task_kind:'bug-fix',required_capabilities:['implementation'],likely_targets:['src/server.ts'],likely_verification:[]})
  const first=await runtime.start(m,{objective:'fix backend',role:'coder',category:'quick',scope:['src/server.ts'],requiredEvidence:[]})
  runtime.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'correction remains',changed_files:[],evidence:[],open_issues:['fix:x'],needs_context:[]})
  await assert.rejects(()=>runtime.start(m,{resumeTaskId:first.task_id,role:'visual-qa'}),new RegExp(`Exact resume role drift for task ${first.task_id}`))
  const task=m.execution.tasks.find(t=>t.id===first.task_id),worker=m.execution.workers.find(w=>w.id===first.worker_id);assert.equal(task.role,'coder');assert.equal(worker.role,'coder');assert.equal(worker.status,'ready');assert.equal(created.length,1);assert.equal(prompts.length,1)
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


test('process lifecycle start contract requires explicit resource objective and keeps command execution child-owned',()=>{
  const source=readFileSync(new URL('../src/runtime/application/hi-tool-surface.ts',import.meta.url),'utf8')
  assert.match(source,/NEW lifecycle-support task.*MUST provide an explicit bounded objective/i)
  assert.match(source,/never inherits the Mission objective/i)
  assert.match(source,/command\/args\/env\/title are NOT hi_task_start fields/i)
  assert.match(source,/admitted child calls hi_process_spawn itself/i)
})

test('process lifecycle handoff separates resource ownership from mission-wide verification by default',()=>{
  const source=readFileSync(new URL('../src/runtime/task/queued-worker-dispatcher.ts',import.meta.url),'utf8')
  assert.match(source,/lifecycle-support task with no required_evidence\/obligation ownership must not run mission-wide test\/build\/review suites/i)
  assert.match(source,/parent or a separately admitted verification owner/i)
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
  await assert.rejects(()=>hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:`node -e "const {execSync}=require('child_process'); execSync('PORT=3100 node src/server.js &')"`}}),/native background shell jobs/i)
  await hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:`node -e "console.log('PORT=3100 node src/server.js &')"`}})
  await hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:'echo "a & b" && echo done'}})
  await hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:"# Check if script tags are escaped in the HTML (should appear as &lt;script&gt;)\ncurl -s http://localhost:5000/ | grep -o '&lt;script&gt;' | head -3"}})
  await hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:'echo ok &>flask.log'}})
  assert.equal(m.execution.ledger.filter(e=>e.type==='process.native-background-blocked').length,3)
  assert.deepEqual(m.execution.ledger.filter(e=>e.type==='process.native-background-blocked').map(e=>e.payload.owner),['parent','parent','parent'])
})

test('resource-only process-support child cannot mutate repository even when neutral owner role is coder',async()=>{
  const {createToolBeforeHook}=await import('../dist/hooks/tool-before.js')
  const store=new MissionStore(process.cwd()),m=store.start('process-resource-mutation-guard','run a local server')
  assess(store,'process-resource-mutation-guard',{required_capabilities:['implementation'],likely_targets:['app.py']})
  const bg=new BackgroundRegistry(),worker={id:'w_resource_process',task_id:'t_resource_process',role:'coder',category:'standard',session_id:'child-resource-process',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation}
  const task={id:worker.task_id,mission_id:m.identity.mission_id,objective:'run server',status:'running',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],execution_profile:{role:'coder',category:'standard',task:{objective:'run server',scope:[],dependencies:[],required_evidence:[]},tools:['bash','edit',...HI_PROCESS_EXECUTION_TOOL_IDS],process_lifecycle:true,fallback_models:[],methodologies:[],permission_profile:{skill_tool_enabled:false,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny',native:{decisions:{bash:'allow',edit:'allow'},source:'hi-default-invariants'}},verification_policy:{requiredKinds:[],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false},max_context_chars:1000,max_handoff_chars:1000,max_result_chars:1000,max_artifacts:2},gate_ids:[],external_action_requirements:[],created_at:Date.now(),updated_at:Date.now(),worker_id:worker.id}
  m.execution.tasks.push(task);m.execution.workers.push(worker);bg.set(worker)
  const hook=createToolBeforeHook(store,bg,process.cwd(),process.cwd())
  await assert.rejects(()=>hook({sessionID:worker.session_id,tool:'edit'},{args:{filePath:'app.py',oldString:'a',newString:'b'}}),/process-support ownership guard.*cannot mutate repository/i)
  await assert.rejects(()=>hook({sessionID:worker.session_id,tool:'bash'},{args:{command:'printf x > app.py'}}),/process-support ownership guard.*cannot mutate repository/i)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.process-support-mutation-blocked'&&e.task_id===task.id))
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

test('satisfied exact obligation owner cannot be explicitly resumed',async()=>{
  const created=[],prompts=[],c=client(created,prompts)
  const runtime=new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>host)
  const store=new MissionStore(process.cwd()),m=store.start('satisfied-owner-resume','fix parser');assess(store,'satisfied-owner-resume',{task_kind:'bug-fix',likely_targets:['src/parser.ts'],likely_verification:[]})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation)
  const first=await runtime.start(m,{objective:'fix parser',role:'coder',category:'quick',scope:['src/parser.ts'],requiredEvidence:[],obligationIds:[implementation.id]})
  runtime.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'one correction remains',changed_files:[],evidence:[],open_issues:['fix:x'],needs_context:[]})
  implementation.status='closed';implementation.closedAt=Date.now()
  await assert.rejects(()=>runtime.resume(m,first.task_id),/owns no open obligations/)
  assert.equal(created.length,1);assert.equal(prompts.length,1)
})
