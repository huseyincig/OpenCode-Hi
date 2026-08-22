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
import {HI_CONTROL_TOOL_IDS,promptToolOverrides} from '../dist/runtime/routing/execution-profile.js'

const INITIAL={material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]}
function assessed(store,id='parent') {const m=store.start(id,'opaque');store.applyInitialSemanticAssessment(id,INITIAL);return m}
function state(){return{config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},configResolution:undefined,openCodeVersion:'1.18.20'}}
function scoped(){return{contextArtifacts:{}}}

test('P3 parent surface exposes bounded process controls and child overrides disable every process control',()=>{
  const store=new MissionStore(),calls=[]
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async()=>{calls.push('spawn');return{}},read:async()=>({}),write:async()=>{},wait:async()=>({}),kill:async()=>({}),cleanup:async()=>{}}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:scoped()})
  const ids=['hi_process_spawn','hi_process_read','hi_process_write','hi_process_wait','hi_process_kill','hi_process_cleanup','hi_process_list']
  for(const id of ids){assert.ok(id in toolSurface,id);assert.ok(HI_CONTROL_TOOL_IDS.includes(id),`${id} missing from control-plane deny list`)}
  const child=promptToolOverrides(['read','bash']);for(const id of ids)assert.equal(child[id],false,id)
})

test('P3 semantic user STOP stops mission before process cleanup then workers reconcile',async()=>{
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

test('P3 parent session deletion stops mission and process runtime before worker cancellation',async()=>{
  const store=new MissionStore(),m=assessed(store,'deleted-parent'),order=[]
  const processRuntime={stopMission:async mission=>{assert.equal(mission.identity.status,'stopped');order.push('process');return 1}}
  const services={store,background:{},persistence:{save:()=>{order.push('save')}},tasks:{resolveChildCallback:()=>undefined,cancelAll:async()=>{order.push('tasks');return 1}},processRuntime,eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:state(),host:{refreshRuntimeInventory:async()=>{},log:async()=>{},client:{}},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.deleted',properties:{info:{id:'deleted-parent'}}}))
  assert.equal(m.identity.status,'stopped');assert.deepEqual(order.slice(0,2),['process','tasks']);assert.equal(order.at(-1),'save')
})


test('PROMPT B parent idle preserves an existing canonical operational HumanDecision instead of reclassifying it as Authority',async()=>{
  const store=new MissionStore(),m=assessed(store,'human-idle-preserve')
  m.execution.obligations=[];m.execution.evidence.fresh=true
  const original=openHumanDecision(m,{semantic_type:'operational_action',reason_code:'provider-repair',summary:'repair provider',response_schema:{kind:'external-action'}}),saves=[]
  const services={store,background:{},persistence:{save:()=>saves.push('save')},tasks:{resolveChildCallback:()=>undefined},processRuntime:{},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:state(),host:{refreshRuntimeInventory:async()=>{},log:async()=>{},client:{}},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.idle',properties:{sessionID:'human-idle-preserve'}}))
  assert.equal(m.authority.human_decision.decision_id,original.decision_id);assert.equal(m.authority.human_decision.semantic_type,'operational_action');assert.equal(m.authority.human_decision.reason_code,'provider-repair');assert.equal(m.authority.human_decision.authority_ref,undefined)
  assert.ok(saves.length>=1)
})

test('M12 semantic gate separates capability IDs from methodology intent signals',()=>{
  const store=new MissionStore(),m=store.start('m12-process-gate','start a development server and keep it running')
  const gate=renderSemanticAssessmentGate(m);assert.match(gate,/interactive-process=persistent/);assert.match(gate,/capability-named signals reject/)
})

test('M12 bounded command mission cannot escalate into Hi PTY lifecycle without interactive-process capability',async()=>{
  const store=new MissionStore(),m=assessed(store,'m12-bounded'),calls=[]
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async()=>{calls.push('spawn');return{}}}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const out=String(await toolSurface.hi_process_spawn.execute({worker_id:'w1',command:'npm',args_json:'["test"]'},{sessionID:m.identity.session_id,directory:'/repo'}))
  assert.match(out,/persistent\/interactive process lifecycle was not selected/i);assert.deepEqual(calls,[])
})

test('M12 interactive-process intent still fails closed when live native PTY capability is unavailable',async()=>{
  const store=new MissionStore(),m=store.start('m12-no-pty','opaque persistent process');store.applyInitialSemanticAssessment('m12-no-pty',{...INITIAL,required_capabilities:['implementation','interactive-process']});const calls=[]
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async()=>{calls.push('spawn');return{}}}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:scoped()})
  const out=String(await toolSurface.hi_process_spawn.execute({worker_id:'w1',command:'node',args_json:'["server.js"]'},{sessionID:m.identity.session_id,directory:'/repo'}))
  assert.match(out,/native process lifecycle is unavailable/i);assert.deepEqual(calls,[])
})

test('M12 interactive-process plus observed native PTY capability admits the existing ProcessRuntime owner',async()=>{
  const store=new MissionStore(),m=store.start('m12-pty','opaque persistent process');store.applyInitialSemanticAssessment('m12-pty',{...INITIAL,required_capabilities:['implementation','interactive-process']});const calls=[]
  const processRuntime={list:()=>[],stopMission:async()=>0,spawn:async(_m,input)=>{calls.push(input);return{process_id:'proc_1',status:'RUNNING'}}}
  const {toolSurface}=createHiToolSurface({state:state(),store,tasks:{},processRuntime,projectRoot:'/repo',capabilities:detectOpenCodeCapabilities({}, {processLifecycle:true}),native:{},getModels:()=>[],scopedStores:scoped()})
  const out=JSON.parse(await toolSurface.hi_process_spawn.execute({worker_id:'w1',command:'node',args_json:'["server.js"]',cwd:'/repo'},{sessionID:m.identity.session_id,directory:'/repo',ask:async()=>{throw new Error('unexpected ask')}}))
  assert.equal(out.process_id,'proc_1');assert.equal(calls.length,1);assert.equal(calls[0].command,'node')
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


test('OpenCode compaction resets only context-sensitive parent recovery state',async()=>{
  const store=new MissionStore(),m=assessed(store,'compact-parent'),saves=[]
  const signature=m.continuation.last_progress_signature,obligationCount=m.execution.obligations.length
  m.authority.pending_permissions=2;m.authority.pending_permission_ids=['p1','p2'];m.continuation.stagnation_count=3
  m.continuation.recovery_history=[{fingerprint:'rg1:deadbeef',level:1,action:'same-worker-resume',progress_signature:signature,generation:m.continuation.generation,attempted_at:1,outcome:'started'}]
  m.continuation.pending_nudge={id:'n1',reason:'stagnation-level-1',instruction:'old recovery instruction',created_at:1,generation:m.continuation.generation}
  const services={store,background:{},persistence:{save:()=>saves.push('save')},tasks:{resolveChildCallback:()=>undefined},processRuntime:{},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:state(),host:{refreshRuntimeInventory:async()=>{},log:async()=>{},getModels:()=>[]},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.compacted',properties:{sessionID:'compact-parent'}}))
  assert.equal(m.continuation.stagnation_count,0);assert.deepEqual(m.continuation.recovery_history,[]);assert.equal(m.continuation.pending_nudge,undefined)
  assert.equal(m.continuation.last_progress_signature,signature);assert.equal(m.authority.pending_permissions,2);assert.deepEqual(m.authority.pending_permission_ids,['p1','p2']);assert.equal(m.execution.obligations.length,obligationCount)
  const event=m.execution.ledger.findLast(e=>e.type==='session.compacted');assert.equal(event.payload.recovery_history_cleared,1);assert.equal(event.payload.semantic_progress_preserved,true);assert.ok(saves.length)
})

test('child compaction invalidates stale recovery replay history but preserves non-stagnation nudge and mission truth',async()=>{
  const store=new MissionStore(),m=assessed(store,'compact-child-parent'),signature=m.continuation.last_progress_signature,saves=[]
  const child={id:'w-compact',task_id:'t-compact',role:'coder',category:'standard',session_id:'child-compact',parent_session_id:'compact-child-parent',parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation}
  m.execution.workers.push(child);m.continuation.stagnation_count=2;m.continuation.recovery_history=[{fingerprint:'rg1:cafebabe',level:2,action:'same-worker-resume',progress_signature:signature,generation:m.continuation.generation,attempted_at:2,outcome:'started'}]
  m.continuation.pending_nudge={id:'n2',reason:'verification-pending',instruction:'keep verification nudge',created_at:2,generation:m.continuation.generation};m.execution.evidence.fresh=true
  const services={store,background:{},persistence:{save:()=>saves.push('save')},tasks:{resolveChildCallback:sid=>sid==='child-compact'?child:undefined,childCallbackDisposition:()=> 'current'},processRuntime:{},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:state(),host:{refreshRuntimeInventory:async()=>{},log:async()=>{},getModels:()=>[]},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo'})
  await controller.handle(normalizeOpenCodeEvent({type:'session.compacted',properties:{sessionID:'child-compact'}}))
  assert.equal(m.continuation.stagnation_count,0);assert.deepEqual(m.continuation.recovery_history,[]);assert.equal(m.continuation.pending_nudge.reason,'verification-pending')
  assert.equal(m.continuation.last_progress_signature,signature);assert.equal(m.execution.evidence.fresh,true);assert.equal(child.status,'busy')
  const event=m.execution.ledger.findLast(e=>e.type==='session.compacted');assert.equal(event.worker_id,'w-compact');assert.equal(event.payload.session_id,'child-compact');assert.equal(event.payload.stagnation_nudge_cleared,false);assert.ok(saves.length)
})
