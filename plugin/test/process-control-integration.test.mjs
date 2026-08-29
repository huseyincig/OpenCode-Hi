import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createHiToolSurface} from '../dist/runtime/application/hi-tool-surface.js'
import {RuntimeEventController} from '../dist/runtime/application/runtime-event-controller.js'
import {detectOpenCodeCapabilities} from '../dist/opencode/capabilities.js'
import {normalizeOpenCodeEvent} from '../dist/opencode/event-adapter.js'
import {openHumanDecision} from '../dist/runtime/human-decision/runtime.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {renderSemanticAssessmentGate} from '../dist/runtime/intent/semantic-assessment-gate.js'
import {HI_CONTROL_TOOL_IDS,HI_PROCESS_EXECUTION_TOOL_IDS,promptToolOverrides} from '../dist/runtime/routing/execution-profile.js'

const INITIAL={material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]}
function assessed(store,id='parent') {const m=store.start(id,'opaque');store.applyInitialSemanticAssessment(id,INITIAL);return m}
function state(){return{config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},configResolution:undefined,openCodeVersion:'1.18.20'}}
function scoped(){return{contextArtifacts:{}}}

test('parent surface exposes bounded process controls while child exposure is explicit task-level execution policy',()=>{
  const store=new MissionStore(),calls=[]
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async()=>{calls.push('spawn');return{}},read:async()=>({}),write:async()=>{},wait:async()=>({}),kill:async()=>({}),cleanup:async()=>{}}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:scoped()})
  const ids=[...HI_PROCESS_EXECUTION_TOOL_IDS]
  for(const id of ids){assert.ok(id in toolSurface,id);assert.ok(!HI_CONTROL_TOOL_IDS.includes(id),`${id} must not be classified as parent-only control-plane`)}
  const normalChild=promptToolOverrides(['read','bash']);for(const id of ids)assert.equal(normalChild[id],false,id)
  const processChild=promptToolOverrides(['read','bash',...ids]);for(const id of ids)assert.equal(processChild[id],undefined,id)
})

function attachParentProcessOwner(m,workerID='w1'){
  const taskID=`t_${workerID}`
  m.execution.tasks.push({id:taskID,mission_id:m.identity.mission_id,objective:'owned process',status:'running',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],execution_profile:{role:'coder',category:'standard',task:{objective:'owned process',scope:[],dependencies:[],required_evidence:[]},tools:['bash',...HI_PROCESS_EXECUTION_TOOL_IDS],process_lifecycle:true,fallback_models:[],methodologies:[],permission_profile:{skill_tool_enabled:false,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny'},verification_policy:{requiredKinds:[],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false},max_context_chars:1000,max_handoff_chars:1000,max_result_chars:1000,max_artifacts:2},gate_ids:[],external_action_requirements:[],created_at:Date.now(),updated_at:Date.now(),worker_id:workerID})
  m.execution.workers.push({id:workerID,task_id:taskID,role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:`f_${workerID}`,status:'busy',generation_at_spawn:m.continuation.generation})
}

function processOwnedChildFixture(){
  const store=new MissionStore(),m=store.start('process-parent','opaque process mission');store.applyInitialSemanticAssessment('process-parent',{...INITIAL,required_capabilities:['implementation','interactive-process']})
  const task={id:'t_process',mission_id:m.identity.mission_id,objective:'run app server',status:'running',role:'coder',category:'standard',scope:['app.py'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],execution_profile:{role:'coder',category:'standard',task:{objective:'run app server',scope:['app.py'],dependencies:[],required_evidence:[]},tools:['bash',...HI_PROCESS_EXECUTION_TOOL_IDS],process_lifecycle:true,fallback_models:[],methodologies:[],permission_profile:{skill_tool_enabled:false,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny'},verification_policy:{requiredKinds:[],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false},max_context_chars:1000,max_handoff_chars:1000,max_result_chars:1000,max_artifacts:2},gate_ids:[],external_action_requirements:[],created_at:Date.now(),updated_at:Date.now(),worker_id:'w_process'}
  const worker={id:'w_process',task_id:task.id,role:'coder',category:'standard',session_id:'process-child',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f_process',status:'busy',generation_at_spawn:m.continuation.generation}
  m.execution.tasks.push(task);m.execution.workers.push(worker)
  return{store,m,task,worker}
}

test('model-facing process tools distinguish persistent services from hard-deadline bounded jobs',async()=>{
  const {store,m,task,worker}=processOwnedChildFixture();let waits=0
  const persistent={process_id:'proc-persistent',mission_id:m.identity.mission_id,task_id:task.id,worker_id:worker.id,role:'coder',host:'opencode',command_identity:'a'.repeat(64),cwd:'/repo',authority_ref:'native',pid:42,process_group_id:42,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],cleanup_state:'ACTIVE'}
  m.execution.processes.push(persistent)
  const processRuntime={list:mission=>mission.execution.processes,stopMission:async()=>0,spawn:async()=>({}),read:async()=>({}),write:async()=>{},observe:async()=>persistent,wait:async()=>{waits++;return persistent},kill:async()=>({}),cleanup:async()=>{}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  assert.match(toolSurface.hi_process_spawn.description,/timeout_ms is an optional HARD wall-clock termination deadline/i)
  assert.match(toolSurface.hi_process_spawn.description,/omit timeout_ms for a server\/watcher\/service/i)
  assert.match(toolSurface.hi_process_wait.description,/Do NOT call this on a server\/watcher\/service/i)
  const blocked=JSON.parse(await toolSurface.hi_process_wait.execute({id:persistent.process_id},{sessionID:worker.session_id}))
  assert.equal(blocked.status,'BLOCKED');assert.equal(blocked.reason,'persistent-process-still-running');assert.equal(blocked.retry_wait,false);assert.deepEqual(blocked.next_tools,['hi_process_read','hi_process_kill','hi_process_cleanup']);assert.equal(waits,0)
  persistent.timeout_at=Date.now()+1000
  await toolSurface.hi_process_wait.execute({id:persistent.process_id},{sessionID:worker.session_id});assert.equal(waits,1,'explicit hard-deadline process remains eligible for event-driven terminal wait')
})

test('model-facing process wait reobserves native terminal truth before persistent-service classification',async()=>{
  const {store,m,task,worker}=processOwnedChildFixture();let waits=0,observes=0
  const stale={process_id:'proc-short',mission_id:m.identity.mission_id,task_id:task.id,worker_id:worker.id,host:'opencode',command_identity:'c'.repeat(64),cwd:'/repo',authority_ref:'native',pid:43,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],cleanup_state:'ACTIVE'};m.execution.processes.push(stale)
  const terminal={...stale,status:'EXITED',ended_at:Date.now(),exit_code:0,cleanup_state:'CLEANUP_PENDING'}
  const processRuntime={list:mission=>mission.execution.processes,stopMission:async()=>0,observe:async(_m,id)=>{assert.equal(id,stale.process_id);observes++;Object.assign(stale,terminal);return terminal},wait:async()=>{waits++;return terminal},spawn:async()=>({}),read:async()=>({}),write:async()=>{},kill:async()=>({}),cleanup:async()=>{}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const out=JSON.parse(await toolSurface.hi_process_wait.execute({id:stale.process_id},{sessionID:worker.session_id}))
  assert.equal(observes,1);assert.equal(waits,0);assert.equal(out.status,'EXITED');assert.equal(out.exit_code,0);assert.notEqual(out.reason,'persistent-process-still-running')
})

test('child process tool surface resolves parent mission and enforces exact worker ownership',async()=>{
  const {store,m,task,worker}=processOwnedChildFixture(),calls=[]
  const processRuntime={list:mission=>mission.execution.processes,stopMission:async()=>0,spawn:async(_m,input)=>{calls.push(['spawn',input.worker_id]);const p={process_id:'proc-own',mission_id:m.identity.mission_id,task_id:task.id,worker_id:worker.id,role:'coder',host:'opencode',command_identity:'x',cwd:'/repo',authority_ref:'native',pid:42,process_group_id:42,status:'RUNNING',started_at:Date.now(),cleanup_state:'ACTIVE'};m.execution.processes.push(p);return p},read:async()=>({text:'ok',start_cursor:0,end_cursor:2,available_start_cursor:0,available_end_cursor:2,truncated:false}),write:async()=>{},observe:async(_m,id)=>m.execution.processes.find(p=>p.process_id===id),wait:async()=>({}),kill:async()=>({}),cleanup:async()=>{}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const spawned=JSON.parse(await toolSurface.hi_process_spawn.execute({worker_id:worker.id,command:'python',args_json:'["app.py"]',cwd:'/repo'},{sessionID:worker.session_id,directory:'/repo',ask:async()=>{}}))
  assert.equal(spawned.process_id,'proc-own');assert.deepEqual(calls,[['spawn',worker.id]])
  assert.match(String(await toolSurface.hi_process_spawn.execute({worker_id:'w_other',command:'python',args_json:'["app.py"]'},{sessionID:worker.session_id,directory:'/repo'})),/cannot spawn for worker/i)
  m.execution.processes.push({...m.execution.processes[0],process_id:'proc-other',worker_id:'w_other',task_id:'t_other'})
  assert.match(String(await toolSurface.hi_process_read.execute({id:'proc-other'},{sessionID:worker.session_id})),/outside its own task/i)
  const rows=JSON.parse(await toolSurface.hi_process_list.execute({},{sessionID:worker.session_id}));assert.deepEqual(rows.map(x=>x.process_id),['proc-own'])
})

test('semantic user STOP stops mission before process cleanup then workers reconcile',async()=>{
  const store=new MissionStore(),m=assessed(store,'stop-parent'),order=[]
  store.beginFollowupSemanticAssessment('stop-parent','opaque stop')
  const processRuntime={list:()=>[],spawn:async()=>({}),read:async()=>({}),write:async()=>{},wait:async()=>({}),kill:async()=>({}),cleanup:async()=>{},stopMission:async mission=>{assert.equal(mission.identity.status,'stopped');order.push('process');return 1}}
  const tasks={cancelAll:async()=>{order.push('tasks');return 2}}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:scoped()})
  const tool=toolSurface.hi_intent_assess
  const assessment={...INITIAL,message_kind:'stop',material:true}
  const result=JSON.parse(await tool.execute({revision:m.identity.semantic_assessment.revision,assessment_json:JSON.stringify(assessment)},{sessionID:'stop-parent'}))
  assert.equal(m.identity.status,'stopped');assert.equal(m.continuation.user_interrupted,true);assert.deepEqual(order,['process','tasks']);assert.equal(result.reconciled_workers,2)
})

test('parent session deletion stops mission and process runtime before worker cancellation',async()=>{
  const store=new MissionStore(),m=assessed(store,'deleted-parent'),order=[]
  const processRuntime={stopMission:async mission=>{assert.equal(mission.identity.status,'stopped');order.push('process');return 1}}
  const services={store,background:{},persistence:{save:()=>{order.push('save')}},tasks:{resolveChildCallback:()=>undefined,cancelAll:async()=>{order.push('tasks');return 1}},processRuntime,eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:state(),host:{refreshRuntimeInventory:async()=>{},log:async()=>{},client:{}},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.deleted',properties:{info:{id:'deleted-parent'}}}))
  assert.equal(m.identity.status,'stopped');assert.deepEqual(order.slice(0,2),['process','tasks']);assert.equal(order.at(-1),'save')
})



test('stopped mission drops only the ephemeral child callback index when native session deletion is confirmed',async()=>{
  const store=new MissionStore(),m=assessed(store,'stopped-child-delete-parent'),forgot=[]
  const child={id:'w-stopped-delete',task_id:'t-stopped-delete',role:'coder',category:'standard',session_id:'child-stopped-delete',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f-stopped-delete',status:'busy',generation_at_spawn:m.continuation.generation}
  const task={id:'t-stopped-delete',objective:'bounded work',role:'coder',category:'standard',scope:['src/a.ts'],dependencies:[],requiredEvidence:[],obligation_ids:[],constraints:[],status:'running',worker_id:child.id,created_at:Date.now(),updated_at:Date.now()}
  m.execution.tasks.push(task);m.execution.workers.push(child);m.identity.status='stopped';m.continuation.user_interrupted=true
  const tasks={resolveChildCallback:sid=>sid===child.session_id?child:undefined,childCallbackDisposition:()=> 'accept',forgetChildCallback:sid=>{forgot.push(sid);return true}}
  const services={store,background:{},persistence:{save:()=>{}},tasks,processRuntime:{},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:state(),host:{refreshRuntimeInventory:async()=>{},log:async()=>{},client:{}},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.deleted',properties:{info:{id:child.session_id}}}))
  assert.deepEqual(forgot,[child.session_id],'confirmed host deletion must drop the dead process-local callback index')
  assert.equal(child.status,'busy','late deletion after STOP must not rewrite canonical Worker outcome')
  assert.equal(task.status,'running','late deletion after STOP must not rewrite canonical Task outcome')
  assert.equal(m.identity.status,'stopped')
})

test('parent idle preserves an existing canonical operational HumanDecision instead of reclassifying it as Authority',async()=>{
  const store=new MissionStore(),m=assessed(store,'human-idle-preserve')
  m.execution.obligations=[];m.execution.evidence.fresh=true
  const original=openHumanDecision(m,{semantic_type:'operational_action',reason_code:'provider-repair',summary:'repair provider',response_schema:{kind:'external-action'}}),saves=[]
  const services={store,background:{},persistence:{save:()=>saves.push('save')},tasks:{resolveChildCallback:()=>undefined},processRuntime:{},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:state(),host:{refreshRuntimeInventory:async()=>{},log:async()=>{},client:{}},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.idle',properties:{sessionID:'human-idle-preserve'}}))
  assert.equal(m.authority.human_decision.decision_id,original.decision_id);assert.equal(m.authority.human_decision.semantic_type,'operational_action');assert.equal(m.authority.human_decision.reason_code,'provider-repair');assert.equal(m.authority.human_decision.authority_ref,undefined)
  assert.ok(saves.length>=1)
})

test('semantic gate separates capability IDs from methodology intent signals',()=>{
  const store=new MissionStore(),m=store.start('m12-process-gate','start a development server and keep it running')
  const gate=renderSemanticAssessmentGate(m);assert.match(gate,/interactive-process=persistent/);assert.match(gate,/capability-named signals reject/)
})

test('parent process execution is blocked even when it names an existing worker',async()=>{
  const store=new MissionStore(),m=assessed(store,'m12-bounded'),calls=[]
  m.execution.tasks.push({id:'t1',mission_id:m.identity.mission_id,objective:'bounded command',status:'running',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],execution_profile:{role:'coder',category:'standard',task:{objective:'bounded command',scope:[],dependencies:[],required_evidence:[]},tools:['bash'],fallback_models:[],methodologies:[],permission_profile:{skill_tool_enabled:false,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny'},verification_policy:{requiredKinds:[],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false},max_context_chars:1000,max_handoff_chars:1000,max_result_chars:1000,max_artifacts:2},gate_ids:[],external_action_requirements:[],created_at:Date.now(),updated_at:Date.now(),worker_id:'w1'})
  m.execution.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation})
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async()=>{calls.push('spawn');return{}}}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const before={tasks:m.execution.tasks.length,workers:m.execution.workers.length,processes:m.execution.processes.length}
  const out=JSON.parse(await toolSurface.hi_process_spawn.execute({worker_id:'w1',command:'npm',args_json:'["test"]'},{sessionID:m.identity.session_id,directory:'/repo'}))
  assert.equal(out.status,'BLOCKED');assert.equal(out.reason,'process-execution-child-owner-required');assert.equal(out.required_owner,'exact-process-lifecycle-task-worker');assert.equal(out.next_tool,'hi_task_start');assert.equal(out.retry_same_call,false);assert.match(out.instruction,/Parent sessions.*cannot proxy process execution/i);assert.deepEqual(calls,[])
  assert.deepEqual({tasks:m.execution.tasks.length,workers:m.execution.workers.length,processes:m.execution.processes.length},before,'blocked spawn must not fabricate ownership or process state')
})

test('admitted child still fails closed when live native PTY capability is unavailable',async()=>{
  const {store,worker}=processOwnedChildFixture(),calls=[]
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async()=>{calls.push('spawn');return{}}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:scoped()})
  const out=String(await toolSurface.hi_process_spawn.execute({worker_id:worker.id,command:'node',args_json:'["server.js"]'},{sessionID:worker.session_id,directory:'/repo'}))
  assert.match(out,/native process lifecycle is unavailable/i);assert.deepEqual(calls,[])
})

test('admitted child plus observed native PTY capability reaches the existing ProcessRuntime owner',async()=>{
  const {store,worker}=processOwnedChildFixture(),calls=[]
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async(_m,input)=>{calls.push(input);return{process_id:'proc_1',status:'RUNNING'}}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const out=JSON.parse(await toolSurface.hi_process_spawn.execute({worker_id:worker.id,command:'node',args_json:'["server.js"]',cwd:'/repo'},{sessionID:worker.session_id,directory:'/repo',ask:async()=>{throw new Error('unexpected ask')}}))
  assert.equal(out.process_id,'proc_1');assert.equal(calls.length,1);assert.equal(calls[0].command,'node')
})

test('parent cannot proxy process execution through the sole existing process-lifecycle owner',async()=>{
  const store=new MissionStore(),m=store.start('m12-parent-owner-reuse','opaque persistent process');store.applyInitialSemanticAssessment('m12-parent-owner-reuse',{...INITIAL,required_capabilities:['implementation','interactive-process']});const calls=[];attachParentProcessOwner(m)
  const task=m.execution.tasks.find(t=>t.worker_id==='w1'),worker=m.execution.workers.find(w=>w.id==='w1');task.status='waiting';task.result={status:'FIX_REQUIRED',summary:'structured result correction pending',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:[]};worker.status='ready'
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async(_m,input)=>{calls.push(input);return{process_id:'proc_reused',status:'RUNNING'}}}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const out=JSON.parse(await toolSurface.hi_process_spawn.execute({command:'bash',args_json:'["-c","curl -s http://127.0.0.1:5000/notes"]',cwd:'/repo'},{sessionID:m.identity.session_id,directory:'/repo'}))
  assert.equal(out.status,'BLOCKED');assert.equal(out.reason,'process-execution-child-owner-required');assert.equal(out.retry_same_call,false);assert.match(out.resume_existing_with,/hi_task_start/);assert.match(out.await_existing_with,/hi_task_await/);assert.deepEqual(calls,[]);assert.ok(!m.execution.ledger.some(e=>e.type==='process.owner-resolved'))
})

test('parent process execution is child-bound regardless of how many process owners exist',async()=>{
  const store=new MissionStore(),m=store.start('m12-parent-owner-ambiguous','two process owners');store.applyInitialSemanticAssessment('m12-parent-owner-ambiguous',{...INITIAL,required_capabilities:['implementation','interactive-process']});const calls=[];attachParentProcessOwner(m,'w1');attachParentProcessOwner(m,'w2')
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async(_m,input)=>{calls.push(input);return{process_id:'should-not-spawn',status:'RUNNING'}}}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const out=JSON.parse(await toolSurface.hi_process_spawn.execute({command:'node',args_json:'["server.js"]',cwd:'/repo'},{sessionID:m.identity.session_id,directory:'/repo'}))
  assert.equal(out.status,'BLOCKED');assert.equal(out.reason,'process-execution-child-owner-required');assert.deepEqual(calls,[])
})

test('parent process read/list stay blocked while the exact lifecycle owner is nonterminal',async()=>{
  const store=new MissionStore(),m=store.start('m12-parent-process-reads','owned process');store.applyInitialSemanticAssessment('m12-parent-process-reads',{...INITIAL,required_capabilities:['implementation','interactive-process']});attachParentProcessOwner(m)
  const process={process_id:'proc-active-owner',mission_id:m.identity.mission_id,task_id:'t_w1',worker_id:'w1',host:'opencode',command_identity:'a'.repeat(64),cwd:'/repo',authority_ref:'native',pid:77,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],cleanup_state:'ACTIVE'};m.execution.processes.push(process)
  const processRuntime={list:mission=>mission.execution.processes,stopMission:async()=>0,read:async()=>{throw new Error('parent must not read active owner')}}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const read=JSON.parse(await toolSurface.hi_process_read.execute({id:process.process_id},{sessionID:m.identity.session_id})),list=JSON.parse(await toolSurface.hi_process_list.execute({},{sessionID:m.identity.session_id}))
  assert.equal(read.reason,'process-execution-child-owner-required');assert.deepEqual(list,[],'active child-owned processes must not transfer parent custody')
})

test('terminal lifecycle owner transfers only retained process custody to parent while spawn write and wait stay child-only',async()=>{
  const store=new MissionStore(),m=store.start('m12-parent-retained-custody','retained persistent process');store.applyInitialSemanticAssessment('m12-parent-retained-custody',{...INITIAL,required_capabilities:['implementation','interactive-process']});attachParentProcessOwner(m)
  const task=m.execution.tasks.find(t=>t.id==='t_w1'),worker=m.execution.workers.find(w=>w.id==='w1');task.status='completed';task.result={status:'DONE',summary:'service ready',changed_files:[],evidence:[],open_issues:[],needs_context:[]};worker.status='completed';worker.completed_at=Date.now()
  const process={process_id:'proc-retained',mission_id:m.identity.mission_id,task_id:task.id,worker_id:worker.id,host:'opencode',command_identity:'b'.repeat(64),cwd:'/repo',authority_ref:'native',pid:78,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],cleanup_state:'ACTIVE'};m.execution.processes.push(process)
  const calls=[]
  const processRuntime={
    list:mission=>mission.execution.processes,stopMission:async()=>0,
    read:async(_m,id)=>{calls.push(['read',id]);return{text:'ready',start_cursor:0,end_cursor:5,available_start_cursor:0,available_end_cursor:5,truncated:false,status:'RUNNING'}},
    kill:async(_m,id,signal)=>{calls.push(['kill',id,signal]);Object.assign(process,{status:'TERMINATED',ended_at:Date.now(),termination_reason:'signal',cleanup_state:'CLEANUP_PENDING'});return structuredClone(process)},
    cleanup:async(_m,id)=>{calls.push(['cleanup',id]);process.cleanup_state='CLEANED'},
    spawn:async()=>{calls.push(['spawn']);throw new Error('parent spawn forbidden')},write:async()=>{calls.push(['write']);throw new Error('parent write forbidden')},wait:async()=>{calls.push(['wait']);throw new Error('parent wait forbidden')},
  }
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const listed=JSON.parse(await toolSurface.hi_process_list.execute({},{sessionID:m.identity.session_id}));assert.deepEqual(listed.map(x=>x.process_id),[process.process_id])
  const read=JSON.parse(await toolSurface.hi_process_read.execute({id:process.process_id},{sessionID:m.identity.session_id}));assert.equal(read.text,'ready')
  const spawn=JSON.parse(await toolSurface.hi_process_spawn.execute({command:'python3',args_json:'["app.py"]'},{sessionID:m.identity.session_id,directory:'/repo'}));assert.equal(spawn.reason,'process-execution-child-owner-required')
  const write=JSON.parse(String(await toolSurface.hi_process_write.execute({id:process.process_id,input:'x'},{sessionID:m.identity.session_id})).replace(/^Process write failed: Error: /,''));assert.equal(write.reason,'process-execution-child-owner-required')
  const wait=JSON.parse(String(await toolSurface.hi_process_wait.execute({id:process.process_id},{sessionID:m.identity.session_id})).replace(/^Process wait failed: Error: /,''));assert.equal(wait.reason,'process-execution-child-owner-required')
  const killed=JSON.parse(await toolSurface.hi_process_kill.execute({id:process.process_id},{sessionID:m.identity.session_id}));assert.equal(killed.status,'TERMINATED')
  assert.equal(await toolSurface.hi_process_cleanup.execute({id:process.process_id},{sessionID:m.identity.session_id}),'OK');assert.equal(process.cleanup_state,'CLEANED')
  assert.deepEqual(calls,[['read',process.process_id],['kill',process.process_id,'SIGTERM'],['cleanup',process.process_id]])
  assert.ok(m.execution.ledger.some(e=>e.type==='process.parent-custody'&&e.payload?.action==='read'&&e.payload?.process_id===process.process_id))
  assert.ok(m.execution.ledger.some(e=>e.type==='process.parent-custody'&&e.payload?.action==='kill'&&e.payload?.process_id===process.process_id))
  assert.ok(m.execution.ledger.some(e=>e.type==='process.parent-custody'&&e.payload?.action==='cleanup'&&e.payload?.process_id===process.process_id))
})

test('parent retained-process custody fails closed for unknown or non-lifecycle owner identities',async()=>{
  const store=new MissionStore(),m=assessed(store,'m12-parent-retained-foreign'),processRuntime={list:mission=>mission.execution.processes,stopMission:async()=>0,read:async()=>{throw new Error('must not reach runtime')}}
  m.execution.processes.push({process_id:'proc-orphan-contract',mission_id:m.identity.mission_id,task_id:'t-missing',worker_id:'w-missing',host:'opencode',command_identity:'c'.repeat(64),cwd:'/repo',authority_ref:'native',pid:79,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],cleanup_state:'ACTIVE'})
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  assert.match(String(await toolSurface.hi_process_read.execute({id:'proc-orphan-contract'},{sessionID:m.identity.session_id})),/retained process owner identity is incomplete/i)
  assert.match(String(await toolSurface.hi_process_read.execute({id:'proc-unknown'},{sessionID:m.identity.session_id})),/process not found in mission/i)
})

test('process spawn rejects shell-like command strings before capability or runtime execution',async()=>{
  const {store,worker}=processOwnedChildFixture(),calls=[];let probes=0
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async()=>{calls.push('spawn');return{process_id:'never'}}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped(),refreshOwnedHostCapability:async()=>{probes++;return{available:true}}})
  for(const command of ['python3 app.py','/usr/bin/python3 app.py','bash -c "python3 app.py"']){
    const out=JSON.parse(await toolSurface.hi_process_spawn.execute({worker_id:worker.id,command,cwd:'/repo'},{sessionID:worker.session_id,directory:'/repo'}))
    assert.equal(out.status,'BLOCKED',command);assert.equal(out.reason,'process-command-argv-required',command);assert.equal(out.retry_same_spawn,false,command);assert.deepEqual(out.example,{command:'python3',args_json:'["app.py"]'},command)
  }
  assert.equal(probes,0);assert.deepEqual(calls,[])
})

test('process spawn preserves explicit executable plus argv and explicit shell argv forms',async()=>{
  const {store,worker}=processOwnedChildFixture(),calls=[]
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async(_m,input)=>{calls.push(input);return{process_id:`proc_${calls.length}`,status:'RUNNING'}}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const direct=JSON.parse(await toolSurface.hi_process_spawn.execute({worker_id:worker.id,command:'python3',args_json:'["app.py"]',cwd:'/repo'},{sessionID:worker.session_id,directory:'/repo',ask:async()=>{}}))
  const shell=JSON.parse(await toolSurface.hi_process_spawn.execute({worker_id:worker.id,command:'bash',args_json:'["-c","printf ok"]',cwd:'/repo'},{sessionID:worker.session_id,directory:'/repo',ask:async()=>{}}))
  assert.equal(direct.process_id,'proc_1');assert.equal(shell.process_id,'proc_2');assert.deepEqual(calls.map(x=>[x.command,x.args]),[['python3',['app.py']],['bash',['-c','printf ok']]])
})

test('child process spawn reobserves a stale SUPPORTED PTY capability and fails closed before native spawn',async()=>{
  const {store,m,worker}=processOwnedChildFixture(),calls=[],capabilities=detectOpenCodeCapabilities({}, {processLifecycle:true});let probes=0
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async()=>{calls.push('spawn');return{process_id:'should-not-spawn',status:'RUNNING'}}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities,native:{},getModels:()=>[],scopedStores:scoped(),refreshOwnedHostCapability:async id=>{assert.equal(id,'process-lifecycle');probes++;capabilities.contracts.splice(0,capabilities.contracts.length,...detectOpenCodeCapabilities({}).contracts);return{available:false,detail:'OpenCode canonical v2 PTY list unavailable'}}})
  const out=JSON.parse(await toolSurface.hi_process_spawn.execute({worker_id:worker.id,command:'node',args_json:'["server.js"]',cwd:'/repo'},{sessionID:worker.session_id,directory:'/repo'}))
  assert.equal(probes,1);assert.deepEqual(calls,[]);assert.equal(out.status,'BLOCKED');assert.equal(out.reason,'process-support-capability-unavailable');assert.equal(out.scope,'task-local-resource');assert.equal(out.mission_blocking,false);assert.equal(out.retry_same_spawn,false);assert.equal(m.execution.blockers.includes('capability-unavailable:process-lifecycle'),false);assert.ok(m.execution.ledger.some(e=>e.type==='capability.optional-unavailable'&&e.task_id==='t_process'&&e.payload?.mission_blocking===false));assert.match(out.detail,/PTY list unavailable|process lifecycle is unavailable/i)
})

test('obligation-owning process task still fails closed as a mission capability blocker when PTY is unavailable',async()=>{
  const {store,m,task,worker}=processOwnedChildFixture(),calls=[],capabilities=detectOpenCodeCapabilities({}, {processLifecycle:true});let probes=0
  task.requiredEvidence=['targeted-tests'];task.execution_profile.task.required_evidence=['targeted-tests']
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async()=>{calls.push('spawn');return{process_id:'should-not-spawn',status:'RUNNING'}}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities,native:{},getModels:()=>[],scopedStores:scoped(),refreshOwnedHostCapability:async()=>{probes++;capabilities.contracts.splice(0,capabilities.contracts.length,...detectOpenCodeCapabilities({}).contracts);return{available:false,detail:'OpenCode canonical v2 PTY list unavailable'}}})
  const out=JSON.parse(await toolSurface.hi_process_spawn.execute({worker_id:worker.id,command:'node',args_json:'[\"server.js\"]',cwd:'/repo'},{sessionID:worker.session_id,directory:'/repo'}))
  assert.equal(probes,1);assert.deepEqual(calls,[]);assert.equal(out.status,'USER_ACTION_REQUIRED');assert.equal(out.blocker,'capability-unavailable:process-lifecycle');assert.ok(m.execution.blockers.includes(out.blocker));assert.ok(m.execution.ledger.some(e=>e.type==='capability.unavailable'&&e.task_id===task.id&&e.payload?.capability==='process-lifecycle'))
})

test('child process spawn reobserves stale UNSUPPORTED PTY recovery and clears the old capability blocker',async()=>{
  const {store,m,worker}=processOwnedChildFixture(),calls=[],capabilities=detectOpenCodeCapabilities({});let probes=0
  m.execution.blockers.push('capability-unavailable:process-lifecycle')
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async(_m,input)=>{calls.push(input);return{process_id:'proc_recovered',status:'RUNNING'}}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities,native:{},getModels:()=>[],scopedStores:scoped(),refreshOwnedHostCapability:async id=>{assert.equal(id,'process-lifecycle');probes++;capabilities.contracts.splice(0,capabilities.contracts.length,...detectOpenCodeCapabilities({}, {processLifecycle:true}).contracts);return{available:true,detail:'OpenCode canonical v2 PTY list observed'}}})
  const out=JSON.parse(await toolSurface.hi_process_spawn.execute({worker_id:worker.id,command:'node',args_json:'["server.js"]',cwd:'/repo'},{sessionID:worker.session_id,directory:'/repo'}))
  assert.equal(probes,1);assert.equal(out.process_id,'proc_recovered');assert.equal(calls.length,1);assert.ok(!m.execution.blockers.includes('capability-unavailable:process-lifecycle'))
})

test('native-revert registration missing session-revert capability is terminal and deduped',async()=>{
  const store=new MissionStore(),m=assessed(store,'no-session-revert'),processRuntime={list:()=>[],stopMission:async()=>0}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:scoped()})
  const first=JSON.parse(await toolSurface.hi_temporary_mutation_register.execute({kind:'experiment',description:'temporary edit',native_revert:true},{sessionID:m.identity.session_id}))
  const second=JSON.parse(await toolSurface.hi_temporary_mutation_register.execute({kind:'experiment',description:'temporary edit',native_revert:true},{sessionID:m.identity.session_id}))
  assert.equal(first.status,'USER_ACTION_REQUIRED');assert.equal(first.blocker,'capability-unavailable:session-revert');assert.deepEqual(second,first)
  assert.equal(m.execution.blockers.filter(x=>x==='capability-unavailable:session-revert').length,1);assert.equal(m.execution.ledger.filter(e=>e.type==='capability.unavailable'&&e.payload?.capability==='session-revert').length,1)
  const decision=(await import('../dist/runtime/continuation/evaluator.js')).evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'capability-unavailable')
})


test('OpenCode compaction resets context-sensitive parent stagnation while preserving semantic recovery history',async()=>{
  const store=new MissionStore(),m=assessed(store,'compact-parent'),saves=[]
  const signature=m.continuation.last_progress_signature,obligationCount=m.execution.obligations.length
  m.authority.pending_permissions=2;m.authority.pending_permission_ids=['p1','p2'];m.continuation.stagnation_count=3
  m.continuation.recovery_history=[{fingerprint:'rg1:deadbeef',level:1,action:'same-worker-resume',progress_signature:signature,generation:m.continuation.generation,attempted_at:1,outcome:'started'}]
  m.continuation.pending_nudge={id:'n1',reason:'stagnation-level-1',instruction:'old recovery instruction',created_at:1,generation:m.continuation.generation}
  const services={store,background:{},persistence:{save:()=>saves.push('save')},tasks:{resolveChildCallback:()=>undefined},processRuntime:{},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:state(),host:{refreshRuntimeInventory:async()=>{},log:async()=>{},getModels:()=>[]},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.compacted',properties:{sessionID:'compact-parent'}}))
  assert.equal(m.continuation.stagnation_count,0);assert.equal(m.continuation.recovery_history.length,1);assert.equal(m.continuation.pending_nudge,undefined)
  assert.equal(m.continuation.last_progress_signature,signature);assert.equal(m.authority.pending_permissions,2);assert.deepEqual(m.authority.pending_permission_ids,['p1','p2']);assert.equal(m.execution.obligations.length,obligationCount)
  const event=m.execution.ledger.findLast(e=>e.type==='session.compacted');assert.equal(event.payload.recovery_history_preserved,1);assert.equal(event.payload.semantic_progress_preserved,true);assert.ok(saves.length)
})

test('child compaction preserves semantic recovery replay history plus non-stagnation nudge and mission truth',async()=>{
  const store=new MissionStore(),m=assessed(store,'compact-child-parent'),signature=m.continuation.last_progress_signature,saves=[]
  const child={id:'w-compact',task_id:'t-compact',role:'coder',category:'standard',session_id:'child-compact',parent_session_id:'compact-child-parent',parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation}
  m.execution.workers.push(child);m.continuation.stagnation_count=2;m.continuation.recovery_history=[{fingerprint:'rg1:cafebabe',level:2,action:'same-worker-resume',progress_signature:signature,generation:m.continuation.generation,attempted_at:2,outcome:'started'}]
  m.continuation.pending_nudge={id:'n2',reason:'verification-pending',instruction:'keep verification nudge',created_at:2,generation:m.continuation.generation};m.execution.evidence.fresh=true
  const services={store,background:{},persistence:{save:()=>saves.push('save')},tasks:{resolveChildCallback:sid=>sid==='child-compact'?child:undefined,childCallbackDisposition:()=> 'current'},processRuntime:{},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:state(),host:{refreshRuntimeInventory:async()=>{},log:async()=>{},getModels:()=>[]},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.compacted',properties:{sessionID:'child-compact'}}))
  assert.equal(m.continuation.stagnation_count,0);assert.equal(m.continuation.recovery_history.length,1);assert.equal(m.continuation.pending_nudge.reason,'verification-pending')
  assert.equal(m.continuation.last_progress_signature,signature);assert.equal(m.execution.evidence.fresh,true);assert.equal(child.status,'busy')
  const event=m.execution.ledger.findLast(e=>e.type==='session.compacted');assert.equal(event.worker_id,'w-compact');assert.equal(event.payload.session_id,'child-compact');assert.equal(event.payload.stagnation_nudge_cleared,false);assert.ok(saves.length)
})


test('browser cleanup runs when child idle assistant settlement throws before terminal reconciliation',async()=>{
  const store=new MissionStore(),m=assessed(store,'browser-idle-error-parent'),order=[]
  const child={id:'w-browser-error',task_id:'t-browser-error',role:'visual-qa',category:'visual',session_id:'child-browser-error',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:['hi-browser-testing'],loaded_methodologies:['hi-browser-testing'],methodologies:[],fingerprint:'f-browser-error',status:'busy',generation_at_spawn:m.continuation.generation}
  const task={id:'t-browser-error',objective:'inspect local UI',role:'visual-qa',category:'visual',scope:['src/view.tsx'],dependencies:[],requiredEvidence:[],obligation_ids:[],constraints:[],status:'running',worker_id:child.id,created_at:Date.now(),updated_at:Date.now(),execution_profile:{browser_allowed_origins:['http://127.0.0.1:4173']}}
  m.execution.tasks.push(task);m.execution.workers.push(child)
  const tasks={
    resolveChildCallback:sid=>sid===child.session_id?child:undefined,
    childCallbackDisposition:()=> 'current',
    admitTerminalEvent:async()=>({decision:'ACCEPT',reason:'host-session-idle-confirmed',hostStatus:'idle'}),
    cleanupBrowserForTask:async()=>{order.push('browser');return true},
    settleHostIdleAssistantResult:async()=>{throw new Error('assistant settlement boom')},
    fail:()=>{order.push('fail');child.status='failed';task.status='failed'},
    cleanupWorkspaceForTask:async()=>{order.push('workspace');return true},
    pendingExecutionWorkers:()=>[],
  }
  const services={store,background:{},persistence:{save:()=>order.push('save')},tasks,processRuntime:{},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}}
  const st=state();st.config.executionPolicy='manual'
  const controller=new RuntimeEventController({state:st,host:{refreshRuntimeInventory:async()=>{},log:async()=>{},readAssistantResult:async()=>({text:'irrelevant'})},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.idle',properties:{sessionID:child.session_id}}))
  assert.deepEqual(order.slice(0,3),['browser','fail','workspace'])
})


test('parent idle with exact native busy records verified inflight and does not open destructive stall recovery',async()=>{
  const store=new MissionStore(),m=assessed(store,'busy-liveness-parent')
  m.execution.tasks.push({id:'t-live',mission_id:m.identity.mission_id,objective:'verify visual',status:'running',role:'visual-qa',category:'visual',scope:['index.html'],constraints:[],dependencies:[],requiredEvidence:['visual-evidence'],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w-live',external_action_requirements:[],created_at:Date.now(),updated_at:Date.now()})
  m.execution.workers.push({id:'w-live',task_id:'t-live',role:'visual-qa',category:'visual',session_id:'child-live',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'p/a',fallbacks:[],selected_methodologies:['hi-visual-qa'],loaded_methodologies:['hi-visual-qa'],methodologies:[],fingerprint:'live',status:'busy',attempt:1,generation_at_spawn:m.continuation.generation,updated_at:Date.now()})
  let recoveries=0,saves=0
  const active={state:'ACTIVE',inflight:'YES',last_durable_progress_at:Date.now()-180_000,no_progress_ms:180_000,no_progress_window_ms:120_000,destructive_recovery_allowed:false,reasons:['host-session-busy:w-live']}
  const services={store,background:{},persistence:{save:()=>saves++},tasks:{resolveChildCallback:()=>undefined,assessLiveness:async()=>active,reconcileRestoredChildren:async()=>0,recoverStalledExecution:async()=>{recoveries++;return{disposition:'RECOVERED',reason:'must-not-run'}}},processRuntime:{livenessObservations:()=>({})},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:state(),host:{refreshRuntimeInventory:async()=>{},log:async()=>{},client:{}},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.idle',properties:{sessionID:'busy-liveness-parent'}}))
  assert.equal(recoveries,0);assert.ok(saves>=1)
  assert.ok(m.execution.ledger.some(e=>e.type==='runtime.liveness-assessment'&&e.payload?.state==='ACTIVE'&&e.payload?.inflight==='YES'))
  assert.equal(m.execution.ledger.some(e=>e.type==='runtime.liveness-recovery'),false)
})


test('visual process spawn fails closed before native spawn when declared service origin is outside the immutable browser plan',async()=>{
  const {store,m,task,worker}=processOwnedChildFixture(),calls=[]
  task.role='visual-qa';task.category='visual';worker.role='visual-qa';worker.category='visual'
  task.requiredEvidence=['visual-check'];task.execution_profile.role='visual-qa';task.execution_profile.category='visual';task.execution_profile.browser_backend='bounded-playwright';task.execution_profile.browser_required_origins=['http://127.0.0.1:5000'];task.execution_profile.browser_allowed_origins=['http://127.0.0.1:5000'];task.execution_profile.verification_policy.requiredKinds=['visual-check']
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async(_m,input)=>{calls.push(input);return{process_id:'should-not-spawn',status:'RUNNING'}}}
  const tasks={resolveChildCallback:sid=>sid===worker.session_id?worker:undefined}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const out=JSON.parse(await toolSurface.hi_process_spawn.execute({command:'python3',args_json:'["app.py","--port","8765"]',cwd:'/repo',service_origins:'http://127.0.0.1:8765'},{sessionID:worker.session_id,directory:'/repo',ask:async()=>{throw new Error('unexpected native permission ask')}}))
  assert.equal(out.status,'BLOCKED');assert.equal(out.reason,'process-service-origin-outside-browser-plan');assert.equal(out.retry_same_spawn,false);assert.deepEqual(out.required_browser_origins,['http://127.0.0.1:5000']);assert.deepEqual(out.declared_service_origins,['http://127.0.0.1:8765']);assert.deepEqual(calls,[],'incompatible service origin must be rejected before ProcessRuntime/native spawn')
  assert.ok(m.execution.ledger.some(e=>e.type==='process.service-origin-plan-rejected'&&e.task_id===task.id&&e.worker_id===worker.id))
})
