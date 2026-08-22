import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTextCompleteHook} from '../dist/hooks/text-complete.js'
import {buildMissionRuntimeProjection} from '../dist/runtime/context/mission-runtime-projection.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function visualMission(id){
  const store=new MissionStore(process.cwd())
  const m=startAssessedMission(store,id,'Build and visually verify one local HTML game.',{
    task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',
    required_capabilities:['implementation','verification','visual-qa'],likely_verification:['visual-check'],likely_targets:['index.html']
  })
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation)
  implementation.status='closed';implementation.closedAt=Date.now()
  return{store,m}
}

test('real-world admission withholds parent terminal prose while canonical verification is open',async()=>{
  const {store,m}=visualMission('rw-text-withhold')
  const out={text:'Teslimat hazır. Visual check PASS.'}
  await createTextCompleteHook(store,undefined,process.cwd())({sessionID:m.identity.session_id,messageID:'msg-final',partID:'p-final'},out)
  assert.equal(out.text,'')
  const event=m.execution.ledger.find(e=>e.type==='assistant.text-withheld')
  assert.ok(event);assert.equal(event.payload.decision,'VERIFY');assert.ok(event.payload.missing_evidence.includes('visual-check'))
})

test('real-world admission keeps user-action-required text visible',async()=>{
  const {store,m}=visualMission('rw-user-action')
  m.authority.human_decision={decision_id:'d1',semantic_type:'operational_action',reason_code:'browser-user-action',summary:'Browser login required',status:'OPEN',response_schema:{kind:'external-action'},created_at:Date.now()}
  const out={text:'Tarayıcı doğrulaması için kullanıcı işlemi gerekiyor.'}
  await createTextCompleteHook(store,undefined,process.cwd())({sessionID:m.identity.session_id,messageID:'msg-action',partID:'p-action'},out)
  assert.equal(out.text,'Tarayıcı doğrulaması için kullanıcı işlemi gerekiyor.')
})

test('visual verification projects canonical visual-qa delegation instead of arbitrary bash verification',()=>{
  const {m}=visualMission('rw-visual-route')
  const runtime=buildMissionRuntimeProjection(m,undefined,process.cwd())
  assert.match(runtime.next_action,/call hi_task_start with role=visual-qa, category=visual/)
  assert.match(runtime.next_action,/use Hi browser tools/)
  assert.match(runtime.next_action,/do not substitute unclassified bash or prose claims/)
  assert.doesNotMatch(runtime.next_action,/redundant-verifier-child/)
})

test('assessed implementation mission blocks ceremonial hi_role_models discovery',async()=>{
  const {createToolBeforeHook}=await import('../dist/hooks/tool-before.js')
  const {store,m}=visualMission('rw-role-model-economy')
  const before=createToolBeforeHook(store)
  await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'hi_role_models'},{args:{action:'list'}}),/user configuration surface, not a runtime discovery step/)
})

test('semantic gate still admits hi_role_models for explicit pre-assessment configuration flow',async()=>{
  const {createToolBeforeHook}=await import('../dist/hooks/tool-before.js')
  const store=new MissionStore(process.cwd()),m=store.start('rw-role-config','Configure my Hi child-role models')
  const before=createToolBeforeHook(store)
  await assert.doesNotReject(()=>before({sessionID:m.identity.session_id,tool:'hi_role_models'},{args:{action:'list'}}))
})

test('local mission projects working-directory-first observation boundary without redefining worktree ownership',async()=>{
  const {createSystemTransformHook}=await import('../dist/hooks/system-transform.js')
  const {mkdtempSync,mkdirSync,rmSync}=await import('node:fs')
  const {tmpdir}=await import('node:os')
  const {join}=await import('node:path')
  const worktree=mkdtempSync(join(tmpdir(),'hi-rw-worktree-')),directory=join(worktree,'nested-project');mkdirSync(directory)
  try{
    const store=new MissionStore(worktree),m=startAssessedMission(store,'rw-local-boundary','Change one local HTML file.',{task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],likely_targets:['index.html'],likely_verification:['changed-surface-sanity']})
    const out={system:[]}
    await createSystemTransformHook(store,undefined,worktree,directory)({sessionID:m.identity.session_id},out)
    assert.equal(out.system.length,1)
    assert.match(out.system[0],/Hi LOCAL OBSERVATION BOUNDARY/)
    assert.match(out.system[0],/primary evidence surface/)
    assert.match(out.system[0],/Do not inspect the parent\/worktree root .* merely for orientation/)
  }finally{rmSync(worktree,{recursive:true,force:true})}
})

test('implementation obligation precedes visual verification in canonical control order',async()=>{
  const store=new MissionStore(process.cwd())
  const m=startAssessedMission(store,'rw-order','Build and visually verify one local HTML game.',{task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification','visual-qa'],likely_verification:['visual-check'],likely_targets:['index.html']})
  const {projectControlDecision:decisionFn}=await import('../dist/runtime/completion/control-projection.js')
  const before=decisionFn(m,process.cwd())
  assert.equal(before.action,'CONTINUE')
  const impl=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(impl);impl.status='closed';impl.closedAt=Date.now()
  const after=decisionFn(m,process.cwd())
  assert.equal(after.action,'VERIFY')
})

test('FIX_REQUIRED reconciliation precedes verification rerun',async()=>{
  const {createTask,createWorker}=await import('../dist/runtime/worker/worker-runtime.js')
  const {projectControlDecision}=await import('../dist/runtime/completion/control-projection.js')
  const {store,m}=visualMission('rw-reconcile-order')
  const task=createTask(m,{objective:'fix visual defect',role:'coder',category:'quick',scope:['index.html']})
  const worker=createWorker(m,task,'host-default');worker.status='ready';task.status='waiting';task.result={status:'FIX_REQUIRED',summary:'button overlap remains',changed_files:['index.html'],evidence:[],open_issues:['button overlap'],needs_context:[]}
  assert.equal(projectControlDecision(m,process.cwd()).action,'RECONCILE')
})

test('nested local visual project does not invent unsupported build/check ceremony',async()=>{
  const {mkdtempSync,mkdirSync,rmSync}=await import('node:fs')
  const {tmpdir}=await import('node:os')
  const {join}=await import('node:path')
  const root=mkdtempSync(join(tmpdir(),'hi-rw-verify-root-')),directory=join(root,'game');mkdirSync(join(directory,'.opencode'),{recursive:true})
  try{
    const store=new MissionStore(root,{directory,worktree:root,project:{name:'host-repo',vcs:'git'}})
    const m=store.start('rw-local-verify','Build one HTML canvas game and test it.')
    store.applyInitialSemanticAssessment(m.identity.session_id,{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification','visual-qa'],requested_external_actions:[],likely_verification:['visual-check','changed-surface-sanity','build'],user_verification:[],verification_ceiling:false,likely_targets:['index.html'],intent_signals:[],suppressed_intent_signals:[]})
    assert.deepEqual(m.execution.verification_policy.requiredKinds,['visual-check'])
    const verify=m.execution.obligations.find(o=>o.kind==='verification');assert.deepEqual(verify.requiredEvidence,['visual-check'])
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('parent browser execution is rejected at admission and redirected to visual child ownership',async()=>{
  const {createToolBeforeHook}=await import('../dist/hooks/tool-before.js')
  const {store,m}=visualMission('rw-parent-browser-owner'),before=createToolBeforeHook(store)
  await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'hi_browser_preview_open'},{args:{task_id:'none',path:'index.html'}}),/parent cannot invoke.*start the required visual-qa task/i)
})


test('visual verifier cannot start before implementation predecessor closes',async()=>{
  const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const HiPlugin=(await import('../dist/plugin.js')).default
  const root=mkdtempSync(join(tmpdir(),'hi-rw-visual-order-')),client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:'child-visual-order'}}),promptAsync:async()=>({data:{}}),diff:async()=>({data:[]}),abort:async()=>({data:true})}}
  try{const hooks=await HiPlugin({directory:root,worktree:root,project:{},client});await hooks.config({});await hooks['chat.message']({sessionID:'rw-visual-order',message:{role:'user',parts:[{type:'text',text:'Build index.html and visually verify it'}]}},{parts:[]});const {assessPluginMission}=await import('./helpers/semantic.mjs');await assessPluginMission(hooks,'rw-visual-order',{task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','visual-qa'],likely_verification:['visual-check'],likely_targets:['index.html']});const out=JSON.parse(await hooks.tool.hi_task_start.execute({input:{role:'visual-qa',objective:'verify index.html',scope:'index.html'}},{sessionID:'rw-visual-order'}));assert.equal(out.status,'BLOCKED');assert.equal(out.reason,'canonical-predecessor-obligation-open');assert.deepEqual(out.predecessor_obligations,[{id:'o-implementation',kind:'implementation'}]);assert.equal(out.control.action,'CONTINUE');await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})

test('read-only visual child blocks mutating bash before evidence invalidation',async()=>{
  const {createToolBeforeHook}=await import('../dist/hooks/tool-before.js');const {BackgroundRegistry}=await import('../dist/runtime/background/registry.js');const {store,m}=visualMission('rw-readonly-child');const implementation=m.execution.obligations.find(o=>o.kind==='implementation');implementation.status='closed';implementation.closedAt=Date.now();const task={id:'t-visual-ro',mission_id:m.identity.mission_id,objective:'verify',status:'running',role:'visual-qa',category:'visual',scope:['index.html'],constraints:[],dependencies:[],requiredEvidence:['visual-check'],obligation_ids:['o-verification'],context_artifacts:[],gate_ids:[],external_action_requirements:[],worker_id:'w-visual-ro',created_at:Date.now(),updated_at:Date.now()};const worker={id:'w-visual-ro',task_id:task.id,role:'visual-qa',category:'visual',session_id:'child-visual-ro',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:['hi-visual-qa'],loaded_methodologies:['hi-visual-qa'],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation};m.execution.tasks.push(task);m.execution.workers.push(worker);const bg=new BackgroundRegistry();bg.set(worker);const before=createToolBeforeHook(store,bg,process.cwd(),process.cwd());const mutationAt=m.execution.evidence.last_mutation_at;await assert.rejects(()=>before({sessionID:'child-visual-ro',tool:'bash'},{args:{command:"cat > /tmp/result.json <<'EOF'\n{}\nEOF"}}),/read-only role guard/);assert.equal(m.execution.evidence.last_mutation_at,mutationAt);assert.ok(m.execution.ledger.some(e=>e.type==='worker.read-only-mutation-blocked'))
})


test('low-risk local direct mission blocks native todo ceremony and keeps canonical obligations as the only completion owner',async()=>{
  const {createToolBeforeHook}=await import('../dist/hooks/tool-before.js')
  const {store,m}=visualMission('rw-todo-economy'),before=createToolBeforeHook(store)
  await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'todowrite'},{args:{todos:[{content:'implement',status:'in_progress',priority:'high'}]}}),/native todos are unnecessary.*canonical obligations/i)
  assert.equal(m.execution.native_todos_incomplete,0)
  assert.ok(m.execution.ledger.some(e=>e.type==='tool.economy-blocked'&&e.payload?.tool==='todowrite'))
})


test('generic test/verify wording does not activate TDD methodology without explicit test-first intent',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('rw-no-false-tdd','Implement the local HTML game, then test and verify it.')
  store.applyInitialSemanticAssessment('rw-no-false-tdd',{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['changed-surface-sanity'],user_verification:[],verification_ceiling:false,likely_targets:['index.html'],intent_signals:['intent.tdd'],suppressed_intent_signals:[]})
  assert.ok(!m.methodology.methodology_needs.some(x=>x.name==='hi-test-driven-development'))
  const assessed=m.execution.ledger.find(e=>e.type==='semantic.assessed');assert.ok(assessed?.payload?.runtime_suppressed_intent_signals?.includes('intent.tdd'))
})

test('explicit test-first request retains TDD methodology activation',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('rw-explicit-tdd','Write a failing test first, then implement the behavior using TDD.')
  store.applyInitialSemanticAssessment('rw-explicit-tdd',{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],user_verification:[],verification_ceiling:false,likely_targets:['src/a.ts'],intent_signals:['intent.tdd'],suppressed_intent_signals:[]})
  assert.ok(m.methodology.methodology_needs.some(x=>x.name==='hi-test-driven-development'))
})


test('parent cannot consume visual-only methodology need that belongs to visual-qa child',async()=>{
  const {createToolBeforeHook}=await import('../dist/hooks/tool-before.js');const {store,m}=visualMission('rw-parent-visual-methodology'),before=createToolBeforeHook(store)
  assert.ok(m.methodology.methodology_needs.some(x=>x.name==='hi-visual-qa'))
  await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'skill'},{args:{name:'hi-visual-qa'}}),/not compatible with parent role.*compatible child role/i)
  assert.ok(m.methodology.methodology_needs.some(x=>x.name==='hi-visual-qa'))
  assert.deepEqual(m.methodology.parent_loaded_methodologies,[])
})


test('non-canonical model-invented task_id is treated as creation label while canonical unknown id remains fail-closed',async()=>{
  const {mkdtempSync,mkdirSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const HiPlugin=(await import('../dist/plugin.js')).default
  const root=mkdtempSync(join(tmpdir(),'hi-task-id-normalize-'));mkdirSync(join(root,'.opencode'),{recursive:true})
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{diff:async()=>({data:[]}),create:async()=>({data:{id:'child-task-id'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:true})}}
  try{const hooks=await HiPlugin({directory:root,worktree:root,project:{},client});await hooks.config({});const sid='rw-task-id-normalize';await hooks['chat.message']({sessionID:sid,message:{role:'user',parts:[{type:'text',text:'Build index.html and visually verify it'}]}},{parts:[]});const {assessPluginMission}=await import('./helpers/semantic.mjs');await assessPluginMission(hooks,sid,{task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','visual-qa'],likely_verification:['visual-check'],likely_targets:['index.html']});const created=JSON.parse(await hooks.tool.hi_task_start.execute({input:{task_id:'visual-qa-verification',objective:'verify index.html',role:'visual-qa',scope:'index.html'}},{sessionID:sid}));assert.equal(created.status,'BLOCKED');assert.equal(created.reason,'canonical-predecessor-obligation-open');const unknown=String(await hooks.tool.hi_task_start.execute({task_id:'t_deadbeef_deadbeef'},{sessionID:sid}));assert.match(unknown,/Unknown Hi task/i);await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})

test('playwright and hi browser backend aliases normalize to bounded-playwright',async()=>{
  const {readFile}=await import('node:fs/promises');const src=await readFile(new URL('../src/runtime/application/hi-tool-surface.ts',import.meta.url),'utf8');assert.match(src,/==='playwright'\|\|String\(rawArgs\.browser_backend\)==='hi'\?'bounded-playwright'/)
})


test('non-empty invalid child role is rejected instead of silently falling back to coder',async()=>{
  const {mkdtempSync,mkdirSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const HiPlugin=(await import('../dist/plugin.js')).default
  const root=mkdtempSync(join(tmpdir(),'hi-invalid-role-'));mkdirSync(join(root,'.opencode'),{recursive:true})
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[{id:'p/code',provider:'p',writeCapable:true},{id:'p/vision',provider:'p',visionCapable:true,writeCapable:true}]})},session:{diff:async()=>({data:[]}),create:async()=>({data:{id:'should-not-create'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:true})}}
  try{const hooks=await HiPlugin({directory:root,worktree:root,project:{},client});await hooks.config({});const sid='rw-invalid-role';await hooks['chat.message']({sessionID:sid,message:{role:'user',parts:[{type:'text',text:'Build index.html and verify it visually'}]}},{parts:[]});const {assessPluginMission}=await import('./helpers/semantic.mjs');await assessPluginMission(hooks,sid,{task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','visual-qa'],likely_verification:['visual-check'],likely_targets:['index.html']});const out=String(await hooks.tool.hi_task_start.execute({input:{role:'verifier',objective:'verify index.html',scope:'index.html'}},{sessionID:sid}));assert.match(out,/Unsupported Hi child role 'verifier'/);const list=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:sid}));assert.deepEqual(list,[]);await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})
