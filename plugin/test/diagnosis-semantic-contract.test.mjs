import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {parseSemanticIntentAssessment} from '../dist/runtime/intent/semantic-assessment.js'
import {decideSemanticExecution} from '../dist/runtime/decision/semantic-decision.js'
import {minimumTeamFor} from '../dist/runtime/routing/minimum-team.js'
import {verificationPolicyFor} from '../dist/runtime/verification/policy.js'
import {validateMissionEnvelope} from '../dist/runtime/mission/validators.js'
import {HiPlugin} from '../dist/plugin.js'
import {assessPluginMission} from './helpers/semantic.mjs'

const diagnosis={material:true,message_kind:'mission',task_kind:'diagnosis',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['repository-analysis','verification'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['packages/core/src/ripgrep.ts','diagnosis.json'],intent_signals:[],suppressed_intent_signals:[]}

function client(){return {app:{log:async()=>{}},provider:{list:async()=>({data:{connected:[],all:[]}})},session:{status:async()=>({data:{}}),children:async()=>({data:[]}),diff:async()=>({data:[]}),todo:async()=>({data:[]}),revert:async()=>({data:{}}),unrevert:async()=>({data:{}})}}}

test('diagnosis is a canonical structured semantic task kind',()=>{
  const parsed=parseSemanticIntentAssessment(diagnosis)
  assert.equal(parsed.task_kind,'diagnosis')
})

test('diagnosis creates analysis-only mission obligations and remains a valid durable envelope',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('diag','diagnose only')
  store.applyInitialSemanticAssessment('diag',diagnosis)
  assert.equal(m.identity.intent.taskKind,'diagnosis')
  assert.deepEqual(m.execution.obligations.map(o=>[o.id,o.kind]),[['o-analysis','analysis']])
  assert.equal(m.execution.verification_policy.requiredKinds.length,1,'reproduction preference may stay in intent without becoming a completion obligation')
  assert.equal(validateMissionEnvelope(m),true)
})

test('diagnosis is read-only and local low-risk diagnosis stays parent-direct',()=>{
  const store=new MissionStore(),m=store.start('diag-route','diagnose only');store.applyInitialSemanticAssessment('diag-route',diagnosis)
  const policy=verificationPolicyFor(m.identity.intent),team=minimumTeamFor(m.identity.intent,policy),d=decideSemanticExecution({intent:m.identity.intent,verification:policy,topology:{mode:'adaptive',maxAgents:4,parallelism:2}})
  assert.equal(team.direct,true);assert.deepEqual(team.roles,[])
  assert.equal(d.capabilities.workspaceIsolationCandidate,false)
  assert.equal(d.topology.mode,'single-agent')
})

test('diagnosis parent progress requires an evidence-bound falsifiable hypothesis and completes without implementation mutation',async()=>{
  const hooks=await HiPlugin({directory:process.cwd(),worktree:process.cwd(),project:{},client:client()});await hooks.config({})
  const sid='diag-direct';await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Investigate the root cause only; do not fix it.'}]})
  const assessed=await assessPluginMission(hooks,sid,diagnosis);assert.equal(assessed.task_kind,'diagnosis')
  const proseOnly=JSON.parse(await hooks.tool.hi_direct_progress.execute({obligation_id:'o-analysis',summary:'Root cause proven at the truncation expression and UTF-16 surrogate boundary.'},{sessionID:sid}));assert.equal(proseOnly.status,'EVIDENCE_REQUIRED');assert.equal(proseOnly.reason,'diagnosis-hypothesis-contract-required')
  await hooks['tool.execute.after']({sessionID:sid,tool:'bash',args:{command:'node --test packages/core/test/ripgrep.test.ts'}},{stdout:'1 pass\n0 fail',metadata:{exit:0}})
  const before=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid})),proof=before.evidence.items.find(e=>e.kind==='targeted-tests');assert.ok(proof?.id);assert.equal(proof.outcome,'passed')
  const out=JSON.parse(await hooks.tool.hi_direct_progress.execute({obligation_id:'o-analysis',summary:'Root cause supported at the truncation expression and UTF-16 surrogate boundary.',hypothesis:'The truncation expression splits a UTF-16 surrogate pair.',falsifier:'A focused reproduction crossing the surrogate boundary succeeds without splitting the pair.',diagnostic_outcome:'SUPPORTED',diagnostic_evidence_refs:proof.id},{sessionID:sid}))
  assert.equal(out.status,'RECORDED');assert.equal(out.completion_ready,true);assert.deepEqual(out.remaining_obligations,[])
  await hooks.event({event:{type:'session.idle',properties:{sessionID:sid}}})
  const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid}))
  assert.equal(ledger.status,'completed')
  assert.ok(ledger.events.some(e=>e.type==='diagnosis.hypothesis-assessed'&&e.payload?.outcome==='SUPPORTED'&&e.payload?.evidence_refs?.includes(proof.id)))
  assert.ok(!ledger.evidence.items.some(e=>e.source==='parent:direct-diagnosis'),'parent prose must not synthesize passed diagnostic evidence')
  assert.ok(!ledger.obligations.some(o=>o.kind==='implementation'||o.kind==='verification'))
  await hooks.dispose?.()
})



test('falsified diagnosis hypothesis is retained as evidence-bound history but cannot close analysis',async()=>{
  const hooks=await HiPlugin({directory:process.cwd(),worktree:process.cwd(),project:{},client:client()});await hooks.config({});const sid='diag-falsified'
  await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Investigate the root cause only.'}]});await assessPluginMission(hooks,sid,diagnosis)
  await hooks['tool.execute.after']({sessionID:sid,tool:'bash',args:{command:'node --test packages/core/test/ripgrep.test.ts'}},{stdout:'1 pass\n0 fail',metadata:{exit:0}})
  const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid})),proof=ledger.evidence.items.find(e=>e.kind==='targeted-tests');assert.ok(proof?.id)
  const out=JSON.parse(await hooks.tool.hi_direct_progress.execute({obligation_id:'o-analysis',summary:'The candidate cause was refuted.',hypothesis:'The regex branch alone causes the failure.',falsifier:'The focused case passes while that branch remains active.',diagnostic_outcome:'FALSIFIED',diagnostic_evidence_refs:proof.id},{sessionID:sid}))
  assert.equal(out.status,'EVIDENCE_REQUIRED');assert.equal(out.reason,'diagnosis-hypothesis-not-supported');assert.equal(out.outcome,'FALSIFIED');assert.deepEqual(out.remaining_obligations,[{id:'o-analysis',kind:'analysis'}])
  const after=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid}));assert.ok(after.events.some(e=>e.type==='diagnosis.hypothesis-assessed'&&e.payload?.outcome==='FALSIFIED'));assert.equal(after.obligations.find(o=>o.id==='o-analysis').status,'open')
  await hooks.dispose?.()
})

test('diagnosis owns root-cause semantics and suppresses redundant intent.debugging methodology activation',()=>{
  const store=new MissionStore(),m=store.start('diag-method','diagnose root cause only')
  store.applyInitialSemanticAssessment('diag-method',{...diagnosis,intent_signals:['intent.debugging']})
  assert.ok(!m.methodology.methodology_needs.some(n=>n.name==='hi-debugging-root-cause'))
  const assessed=m.execution.ledger.find(e=>e.type==='semantic.assessed')
  assert.deepEqual(assessed.payload.runtime_suppressed_intent_signals,['intent.debugging'])
})


test('MissionStore and durable envelope reject diagnosis plus implementation capability even if parser is bypassed',()=>{
  const store=new MissionStore(),m=store.start('diag-contradictory','diagnose and fix')
  assert.throws(()=>store.applyInitialSemanticAssessment('diag-contradictory',{...diagnosis,required_capabilities:['repository-analysis','implementation','verification']}),/diagnosis.*write capability.*implementation/)
  assert.equal(m.identity.semantic_assessment.status,'pending');assert.deepEqual(m.execution.obligations,[])

  const validStore=new MissionStore(),valid=validStore.start('diag-envelope','diagnose only');validStore.applyInitialSemanticAssessment('diag-envelope',diagnosis)
  valid.identity.intent.requiredCapabilities.push('implementation')
  assert.equal(validateMissionEnvelope(valid),false,'durable restore must fail closed on contradictory diagnosis/write state')
})

test('plugin semantic admission keeps the same revision pending after contradictory diagnosis and accepts corrected bug-fix',async()=>{
  const hooks=await HiPlugin({directory:process.cwd(),worktree:process.cwd(),project:{},client:client()});await hooks.config({});const sid='diag-corrective-admission'
  await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Find the root cause and fix src/a.ts, then run npm test.'}]})
  const invalid=JSON.parse(await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify({...diagnosis,scope:'multi-file',ambiguity:'resolvable',required_capabilities:['repository-analysis','implementation','verification'],likely_targets:['src/a.ts']})},{sessionID:sid}))
  assert.equal(invalid.status,'INVALID_ASSESSMENT');assert.match(invalid.error,/diagnosis.*write capability.*implementation/)
  const corrected=JSON.parse(await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify({...diagnosis,task_kind:'bug-fix',scope:'local',ambiguity:'resolvable',required_capabilities:['repository-analysis','implementation','verification'],likely_targets:['src/a.ts']})},{sessionID:sid}))
  assert.equal(corrected.status,'ASSESSED');assert.equal(corrected.task_kind,'bug-fix')
  const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:80},{sessionID:sid}));assert.ok(ledger.obligations.some(o=>o.kind==='analysis'));assert.ok(ledger.obligations.some(o=>o.kind==='implementation'));assert.ok(ledger.obligations.some(o=>o.kind==='verification'))
  await hooks.dispose?.()
})

test('ordinary bug-fix still requires implementation and verification',()=>{
  const store=new MissionStore(),m=store.start('bug','fix it');store.applyInitialSemanticAssessment('bug',{...diagnosis,task_kind:'bug-fix',required_capabilities:['implementation','verification'],likely_targets:['src/a.ts']})
  assert.ok(m.execution.obligations.some(o=>o.kind==='implementation'))
  assert.ok(m.execution.obligations.some(o=>o.kind==='verification'))
})


test('review is structurally read-only while mixed review plus remediation is admitted as bug-fix with specialist review retained',async()=>{
  const pureReview={...diagnosis,task_kind:'review',risk:'high',required_capabilities:['repository-analysis','security-review','verification'],likely_targets:['app.py','README.md']}
  const parsed=parseSemanticIntentAssessment(pureReview);assert.equal(parsed.task_kind,'review')
  assert.throws(()=>parseSemanticIntentAssessment({...pureReview,required_capabilities:[...pureReview.required_capabilities,'implementation']}),/review.*read-only.*write capability.*implementation/)
  assert.throws(()=>parseSemanticIntentAssessment({...pureReview,required_capabilities:[...pureReview.required_capabilities,'documentation']}),/review.*read-only.*write capability.*documentation/)
  const store=new MissionStore(),m=store.start('review-pure','Perform a security review only; report findings.');store.applyInitialSemanticAssessment('review-pure',pureReview)
  assert.ok(m.execution.obligations.some(o=>o.kind==='review'));assert.ok(!m.execution.obligations.some(o=>o.kind==='implementation'||o.kind==='documentation'));assert.equal(validateMissionEnvelope(m),true)
  m.identity.intent.requiredCapabilities.push('implementation');assert.equal(validateMissionEnvelope(m),false,'durable review/write contradiction must fail closed')

  const hooks=await HiPlugin({directory:process.cwd(),worktree:process.cwd(),project:{},client:client()});await hooks.config({});const sid='review-remediation-admission'
  await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Review the security problems, fix them, verify the fixes, and update README.md security notes.'}]})
  const invalid=JSON.parse(await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify({...pureReview,required_capabilities:[...pureReview.required_capabilities,'implementation','documentation']})},{sessionID:sid}))
  assert.equal(invalid.status,'INVALID_ASSESSMENT');assert.match(invalid.error,/review.*read-only.*write capability/)
  const corrected=JSON.parse(await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify({...pureReview,task_kind:'bug-fix',ambiguity:'resolvable',required_capabilities:['repository-analysis','implementation','security-review','verification','documentation']})},{sessionID:sid}))
  assert.equal(corrected.status,'ASSESSED');assert.equal(corrected.task_kind,'bug-fix')
  const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid}));const kinds=ledger.obligations.map(o=>o.kind)
  assert.ok(kinds.includes('implementation'));assert.ok(kinds.includes('documentation'));assert.ok(kinds.includes('verification'));assert.ok(kinds.includes('review'))
  await hooks.dispose?.()
})


test('release-readiness is read-only while requests to make the repository release-ready require a write task kind',async()=>{
  const readiness={...diagnosis,task_kind:'release-readiness',risk:'high',required_capabilities:['repository-analysis','verification','independent-review'],likely_targets:['package.json','README.md']}
  assert.equal(parseSemanticIntentAssessment(readiness).task_kind,'release-readiness')
  assert.throws(()=>parseSemanticIntentAssessment({...readiness,required_capabilities:[...readiness.required_capabilities,'implementation']}),/release-readiness.*read-only.*write capability.*implementation/)
  assert.throws(()=>parseSemanticIntentAssessment({...readiness,required_capabilities:[...readiness.required_capabilities,'test-authoring']}),/release-readiness.*read-only.*write capability.*test-authoring/)
  assert.throws(()=>parseSemanticIntentAssessment({...readiness,required_capabilities:[...readiness.required_capabilities,'documentation']}),/release-readiness.*read-only.*write capability.*documentation/)
  assert.doesNotThrow(()=>parseSemanticIntentAssessment({...readiness,scope:'external',risk:'authority-boundary',required_capabilities:[...readiness.required_capabilities,'implementation'],requested_external_actions:['git-push']}),'external release transaction semantics remain compatible with implementation capability')
  const store=new MissionStore(),m=store.start('release-readiness-pure','Inspect release readiness only.');store.applyInitialSemanticAssessment('release-readiness-pure',readiness)
  assert.ok(!m.execution.obligations.some(o=>['implementation','documentation','test-authoring'].includes(o.kind)));assert.equal(validateMissionEnvelope(m),true)
  m.identity.intent.requiredCapabilities.push('test-authoring');assert.equal(validateMissionEnvelope(m),false,'durable release-readiness/write contradiction must fail closed')

  const hooks=await HiPlugin({directory:process.cwd(),worktree:process.cwd(),project:{},client:client()});await hooks.config({});const sid='release-readiness-fix-admission'
  await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Make this workspace release-ready: fix package version/dependency drift, update the failing regression test, update docs if behavior changes, then verify locally. Do not publish.'}]})
  const invalid=JSON.parse(await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify({...readiness,required_capabilities:['repository-analysis','verification','test-authoring','documentation']})},{sessionID:sid}))
  assert.equal(invalid.status,'INVALID_ASSESSMENT');assert.match(invalid.error,/release-readiness.*read-only.*write capability/)
  const corrected=JSON.parse(await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify({...readiness,task_kind:'bug-fix',ambiguity:'resolvable',required_capabilities:['repository-analysis','implementation','verification','test-authoring','documentation','independent-review']})},{sessionID:sid}))
  assert.equal(corrected.status,'ASSESSED');assert.equal(corrected.task_kind,'bug-fix');const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid}));const kinds=ledger.obligations.map(o=>o.kind);assert.ok(kinds.includes('implementation'));assert.ok(kinds.includes('test-authoring'));assert.ok(kinds.includes('documentation'));assert.ok(kinds.includes('verification'));await hooks.dispose?.()
})
