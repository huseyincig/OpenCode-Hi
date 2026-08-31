import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { parseSemanticIntentAssessment, technicalVerificationKinds } from '../dist/runtime/intent/semantic-assessment.js'
import { assessChangedFileOwnership } from '../dist/runtime/task/diff-ownership.js'
import { addEvidence } from '../dist/runtime/evidence/evidence-runtime.js'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'
import { renderSemanticAssessmentGate } from '../dist/runtime/intent/semantic-assessment-gate.js'
import { buildMissionRuntimeProjection } from '../dist/runtime/context/mission-runtime-projection.js'
import { startAssessedMission } from './helpers/semantic.mjs'

const assessment={
  material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',
  required_capabilities:['implementation','verification'],requested_external_actions:[],likely_verification:['targeted-tests'],
  user_verification:[],verification_ceiling:false,
  likely_targets:['ripgrep preview truncation code in packages/core'],intent_signals:[],suppressed_intent_signals:[],
}

test('normalizes semantic target prose before exact changed-file ownership',()=>{
  const parsed=parseSemanticIntentAssessment(assessment)
  assert.deepEqual(parsed.likely_targets,['packages/core'])
  const ownership=assessChangedFileOwnership(parsed.likely_targets,['packages/core/src/ripgrep.ts'],[],'control-plane')
  assert.deepEqual(ownership.collateral,[])
})

test('parent DIRECT path blocks a broader verifier outside the required contract',async()=>{
  const store=new MissionStore(process.cwd())
  store.start('phase2-frugal-parent','Fix packages/core/src/ripgrep.ts and run the targeted test')
  store.applyInitialSemanticAssessment('phase2-frugal-parent',parseSemanticIntentAssessment(assessment))
  const before=createToolBeforeHook(store,undefined,process.cwd())
  await before({sessionID:'phase2-frugal-parent',tool:'bash'},{args:{command:'bun test test/ripgrep.test.ts'}})
  await assert.rejects(()=>before({sessionID:'phase2-frugal-parent',tool:'bash'},{args:{command:'bun typecheck',timeout:180000}}),/outside the required parent verification contract/)
  const mission=store.get('phase2-frugal-parent')
  assert.ok(mission.execution.ledger.some(e=>e.type==='verification.unrequired-command-blocked'&&e.payload?.kind==='typecheck'))
})


test('parent EVIDENCE path also blocks an unrequired broader verifier',async()=>{
  const store=new MissionStore(process.cwd())
  const mission=store.start('phase2-frugal-evidence','Fix packages/core/src/ripgrep.ts and run only the targeted test')
  store.applyInitialSemanticAssessment('phase2-frugal-evidence',parseSemanticIntentAssessment({...assessment,risk:'medium',ambiguity:'resolvable'}))
  mission.execution.adaptive_execution.path='EVIDENCE'
  const before=createToolBeforeHook(store,undefined,process.cwd())
  await assert.rejects(()=>before({sessionID:'phase2-frugal-evidence',tool:'bash'},{args:{command:'bun typecheck',timeout:180000}}),/outside the required parent verification contract/)
  assert.ok(mission.execution.ledger.some(e=>e.type==='verification.unrequired-command-blocked'&&e.payload?.kind==='typecheck'))
})


test('completed parent blocks a redundant verifier before native bash',async()=>{
  const store=new MissionStore(process.cwd()),mission=store.start('phase2-terminal-verifier','fix src/a.ts')
  store.applyInitialSemanticAssessment('phase2-terminal-verifier',parseSemanticIntentAssessment({...assessment,likely_targets:['src/a.ts']}));mission.vcs.changed_files=['src/a.ts'];addEvidence(mission,{kind:'targeted-tests',summary:'canonical terminal verifier proof',scope:['src/a.ts'],source:'test',obligation_ids:['o-verification'],pass:true,outcome:'passed'});for(const o of mission.execution.obligations){o.status='closed';o.closedAt=Date.now()}assert.equal(store.complete('phase2-terminal-verifier'),true)
  const before=createToolBeforeHook(store,undefined,process.cwd())
  await assert.rejects(()=>before({sessionID:'phase2-terminal-verifier',tool:'bash'},{args:{command:'bun typecheck'}}),/mission already completed.*additional verifier 'typecheck' is not admitted/i)
})

test('keeps stronger verification admissible for changed-surface-sanity',async()=>{
  const store=new MissionStore(process.cwd())
  const mission=store.start('phase2-frugal-sanity','Make one bounded local change')
  store.applyInitialSemanticAssessment('phase2-frugal-sanity',parseSemanticIntentAssessment({...assessment,likely_verification:['changed-surface-sanity']}))
  const before=createToolBeforeHook(store,undefined,process.cwd())
  await before({sessionID:'phase2-frugal-sanity',tool:'bash'},{args:{command:'bun typecheck',timeout:180000}})
  assert.ok(!mission.execution.ledger.some(e=>e.type==='verification.unrequired-command-blocked'))
})

test('does not apply DIRECT verifier admission to high-risk work',async()=>{
  const store=new MissionStore(process.cwd())
  const mission=store.start('phase2-frugal-high','Fix a security-sensitive local bug')
  store.applyInitialSemanticAssessment('phase2-frugal-high',parseSemanticIntentAssessment({...assessment,risk:'high'}))
  const before=createToolBeforeHook(store,undefined,process.cwd())
  await before({sessionID:'phase2-frugal-high',tool:'bash'},{args:{command:'bun typecheck',timeout:180000}})
  assert.ok(!mission.execution.ledger.some(e=>e.type==='verification.unrequired-command-blocked'))
})


test('semantic gate does not invent independent review for deterministic low-risk work',()=>{
  const store=new MissionStore(process.cwd())
  const mission=store.start('phase2-review-prior','Fix src/a.ts and stop after the targeted test passes')
  const gate=renderSemanticAssessmentGate(mission)
  assert.match(gate,/independent-review=explicit\/risk/)
})


test('semantic gate exposes model-facing primitive types and request-unit container shapes',()=>{
  const store=new MissionStore(process.cwd())
  const mission=store.start('phase11-semantic-shape','Fix README.md typo and verify the changed line')
  const gate=renderSemanticAssessmentGate(mission)
  assert.match(gate,/material=true\|false/)
  assert.match(gate,/capability_request_units=\{\}/)
})

test('follow-up semantic gate distinguishes resume from amendment to avoid duplicate continuation work',()=>{
  const store=new MissionStore(process.cwd())
  const mission=startAssessedMission(store,'semantic-resume-gate')
  store.beginFollowupSemanticAssessment('semantic-resume-gate','Continue from the exact current point without restarting')
  const gate=renderSemanticAssessmentGate(mission)
  assert.match(gate,/resume=continue the existing unfinished contract/)
  assert.match(gate,/amendment=add\/change an implementation outcome/)
  assert.match(gate,/requires C to include implementation/)
  assert.match(gate,/Continuation\/reconnect\/handoff wording alone is resume, not amendment/)
})

test('runtime projection separates exact obligation IDs from summaries',()=>{
  const store=new MissionStore(process.cwd())
  store.start('phase2-obligation-id','Fix packages/core/src/ripgrep.ts')
  const mission=store.applyInitialSemanticAssessment('phase2-obligation-id',parseSemanticIntentAssessment({...assessment,likely_targets:['packages/core/src/ripgrep.ts']}))
  const projected=buildMissionRuntimeProjection(mission)
  assert.ok(!projected.obligations.some(item=>item.startsWith('id=o-analysis;')))
  assert.ok(projected.obligations.includes('id=o-implementation; summary=Requested change completed'))
})


test('repository-analysis capability alone does not manufacture a root-cause obligation',()=>{
  const store=new MissionStore(process.cwd())
  store.start('phase2-repo-read-only-analysis','Fix src/a.ts and run `bun test test/a.test.ts`')
  const mission=store.applyInitialSemanticAssessment('phase2-repo-read-only-analysis',parseSemanticIntentAssessment({...assessment,risk:'medium',ambiguity:'none',required_capabilities:['repository-analysis','implementation','verification'],likely_targets:['src/a.ts']}))
  assert.ok(!mission.execution.obligations.some(o=>o.kind==='analysis'))
})

test('explicit debugging signal still creates a root-cause obligation',()=>{
  const store=new MissionStore(process.cwd())
  store.start('phase2-real-debug','Debug and fix src/a.ts')
  const mission=store.applyInitialSemanticAssessment('phase2-real-debug',parseSemanticIntentAssessment({...assessment,risk:'high',ambiguity:'none',required_capabilities:['repository-analysis','implementation','verification'],intent_signals:['intent.debugging'],likely_targets:['src/a.ts']}))
  assert.ok(mission.execution.obligations.some(o=>o.kind==='analysis'))
})

test('exact user verification ceiling discards inferred broader verifier requirements',async()=>{
  const parsed=parseSemanticIntentAssessment({...assessment,likely_verification:['targeted-tests','typecheck'],user_verification:['targeted-tests'],verification_ceiling:true})
  assert.deepEqual(parsed.likely_verification,['targeted-tests'])
  assert.deepEqual(parsed.user_verification,['targeted-tests'])
  assert.equal(parsed.verification_ceiling,true)
  const store=new MissionStore(process.cwd())
  store.start('phase2-exact-verification','Fix src/a.ts, run the targeted test, and stop when it passes')
  const mission=store.applyInitialSemanticAssessment('phase2-exact-verification',parsed)
  assert.deepEqual(mission.identity.intent.likelyVerification,['targeted-tests'])
  const before=createToolBeforeHook(store,undefined,process.cwd())
  await assert.rejects(()=>before({sessionID:'phase2-exact-verification',tool:'bash'},{args:{command:'bun typecheck',timeout:180000}}),/outside the required parent verification contract/)
})

test('exact verification ceiling requires an explicit user verifier',()=>{
  assert.throws(()=>parseSemanticIntentAssessment({...assessment,verification_ceiling:true,user_verification:[]}),/verification_ceiling requires at least one explicit user_verification kind/)
})

test('technical verifier extraction is syntax-driven and bounded',()=>{
  assert.deepEqual(technicalVerificationKinds('Run `bun test test/ripgrep.test.ts` from packages/core and stop when it passes.'),['targeted-tests'])
  assert.deepEqual(technicalVerificationKinds('Use bun typecheck and bun test test/a.test.ts'),['targeted-tests','typecheck'])
  assert.deepEqual(technicalVerificationKinds('Please verify this carefully without naming a command'),[])
})

test('initial local contract keeps explicit user verifier ahead of inferred broader checks',()=>{
  const store=new MissionStore(process.cwd())
  const mission=store.start('phase2-explicit-user-verifier','Fix src/a.ts. Run `bun test test/a.test.ts` and stop when it passes.')
  assert.deepEqual(mission.identity.intent.likelyVerification,['targeted-tests'])
  store.applyInitialSemanticAssessment('phase2-explicit-user-verifier',parseSemanticIntentAssessment({...assessment,likely_verification:['targeted-tests','typecheck'],user_verification:[],verification_ceiling:false,likely_targets:['src/a.ts']}))
  assert.deepEqual(mission.identity.intent.likelyVerification,['targeted-tests'])
  assert.deepEqual(mission.execution.verification_policy.requiredKinds,['targeted-tests'])
  const assessed=mission.execution.ledger.find(e=>e.type==='semantic.assessed')
  assert.deepEqual(assessed?.payload?.technical_user_verification,['targeted-tests'])
  assert.equal(assessed?.payload?.technical_verification_ceiling_applied,true)
})

test('high-risk initial assessment may widen beyond an explicit user verifier',()=>{
  const store=new MissionStore(process.cwd())
  const mission=store.start('phase2-explicit-high','Fix src/auth/token.ts. Run `bun test test/auth.test.ts`.')
  store.applyInitialSemanticAssessment('phase2-explicit-high',parseSemanticIntentAssessment({...assessment,risk:'high',likely_verification:['targeted-tests','typecheck'],user_verification:[],verification_ceiling:false,likely_targets:['src/auth/token.ts']}))
  assert.deepEqual(mission.identity.intent.likelyVerification,['targeted-tests','typecheck'])
})


test('adaptive verification does not promote inferred code tests for bounded read-only review',()=>{
  const store=new MissionStore(process.cwd())
  const mission=store.start('review-economy','Review note.md read-only and report whether it contains alpha and beta.')
  store.applyInitialSemanticAssessment('review-economy',parseSemanticIntentAssessment({...assessment,task_kind:'review',scope:'local',risk:'low',required_capabilities:['review','verification'],likely_verification:['targeted-tests'],user_verification:[],verification_ceiling:false,likely_targets:['note.md']}))
  assert.deepEqual(mission.identity.intent.likelyVerification,['review-evidence'])
  assert.deepEqual(mission.execution.verification_policy.requiredKinds,['review-evidence'])
  assert.deepEqual(mission.execution.obligations.find(o=>o.id==='o-review')?.requiredEvidence,['review-evidence'])
  assert.deepEqual(mission.execution.obligations.find(o=>o.id==='o-verification')?.requiredEvidence,['review-evidence'])
})


test('bounded multi-file visual work keeps only repo-available technical verification plus visual proof',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-multifile-visual-capability-'))
  try{
    mkdirSync(join(root,'.opencode'))
    writeFileSync(join(root,'opencode.json'),'{}')
    const store=new MissionStore(root)
    const mission=store.start('multi-file-visual-capability','Build a small visual app and exercise its behavior without naming a test runner.')
    store.applyInitialSemanticAssessment('multi-file-visual-capability',parseSemanticIntentAssessment({...assessment,task_kind:'implementation',scope:'multi-file',risk:'low',required_capabilities:['implementation','verification','visual-qa'],likely_verification:['targeted-tests','changed-surface-sanity','visual-check'],user_verification:[],verification_ceiling:false,likely_targets:['app.py','templates/index.html'],verification_cases:[{id:'vc_visual-smoke',subject:'rendered visual state',required_browser_actions:['inspect']}]}))
    assert.deepEqual(mission.identity.intent.likelyVerification,['visual-check'])
    assert.deepEqual(mission.execution.verification_policy.requiredKinds,['visual-check'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('adaptive verification preserves exact user verifier and high-risk or visual widening',()=>{
  const explicitStore=new MissionStore(process.cwd())
  const explicit=explicitStore.start('review-explicit','Review note.md read-only. Run `node --test test/note.test.mjs` and report the result.')
  explicitStore.applyInitialSemanticAssessment('review-explicit',parseSemanticIntentAssessment({...assessment,task_kind:'review',scope:'local',risk:'low',required_capabilities:['review','verification'],likely_verification:['targeted-tests','typecheck'],user_verification:[],verification_ceiling:false,likely_targets:['note.md']}))
  assert.deepEqual(explicit.identity.intent.likelyVerification,['targeted-tests'])

  const highStore=new MissionStore(process.cwd())
  const high=highStore.start('review-high','Security review src/auth.ts read-only.')
  highStore.applyInitialSemanticAssessment('review-high',parseSemanticIntentAssessment({...assessment,task_kind:'review',scope:'local',risk:'high',required_capabilities:['review','security-review','independent-review'],likely_verification:['targeted-tests','typecheck','review-evidence'],user_verification:[],verification_ceiling:false,likely_targets:['src/auth.ts']}))
  assert.deepEqual(high.identity.intent.likelyVerification,['targeted-tests','typecheck','review-evidence'])

  const visualStore=new MissionStore(process.cwd())
  const visual=visualStore.start('review-visual','Visually review page.html without modifying it.')
  visualStore.applyInitialSemanticAssessment('review-visual',parseSemanticIntentAssessment({...assessment,task_kind:'review',scope:'local',risk:'low',required_capabilities:['review','visual-qa'],likely_verification:['visual-check'],user_verification:[],verification_ceiling:false,likely_targets:['page.html'],verification_cases:[{id:'vc_visual-smoke',subject:'rendered visual state',required_browser_actions:['inspect']}]}))
  assert.deepEqual(visual.identity.intent.likelyVerification,['review-evidence','visual-check'])
})


test('adaptive verification applies the same minimum-sufficient and explicit-user rules to follow-ups',()=>{
  const store=new MissionStore(process.cwd())
  const mission=store.start('review-followup','Review note.md read-only and report whether it contains alpha and beta.')
  store.applyInitialSemanticAssessment('review-followup',parseSemanticIntentAssessment({...assessment,task_kind:'review',scope:'local',risk:'low',required_capabilities:['review','verification'],likely_verification:['targeted-tests'],user_verification:[],verification_ceiling:false,likely_targets:['note.md']}))
  assert.deepEqual(mission.execution.obligations.find(o=>o.kind==='verification')?.requiredEvidence,['review-evidence'])

  store.beginFollowupSemanticAssessment('review-followup','Please re-check the same read-only review carefully.')
  store.applyFollowupSemanticAssessment('review-followup',parseSemanticIntentAssessment({...assessment,message_kind:'verification',task_kind:'review',scope:'local',risk:'low',required_capabilities:['review','verification'],likely_verification:['targeted-tests'],user_verification:[],verification_ceiling:false,likely_targets:['note.md']}))
  assert.deepEqual(mission.execution.obligations.find(o=>o.kind==='verification')?.requiredEvidence,['review-evidence'])

  store.beginFollowupSemanticAssessment('review-followup','Run `node --test test/note.test.mjs` as the requested verifier.')
  store.applyFollowupSemanticAssessment('review-followup',parseSemanticIntentAssessment({...assessment,message_kind:'verification',task_kind:'review',scope:'local',risk:'low',required_capabilities:['review','verification'],likely_verification:['targeted-tests','typecheck'],user_verification:[],verification_ceiling:false,likely_targets:['note.md']}))
  assert.deepEqual(mission.execution.obligations.find(o=>o.kind==='verification')?.requiredEvidence,['targeted-tests'])
  assert.deepEqual(mission.execution.verification_policy.requiredKinds,['targeted-tests'])
})


test('semantic target keeps plain-text project files instead of falling back to slash-shaped prose',()=>{
  const store=new MissionStore(process.cwd())
  const mission=store.start('review-txt-target','Review note.txt read-only. Use the Hi semantic/evidence flow.')
  store.applyInitialSemanticAssessment('review-txt-target',parseSemanticIntentAssessment({...assessment,task_kind:'review',scope:'local',risk:'low',required_capabilities:['review','verification'],likely_verification:['targeted-tests'],user_verification:[],verification_ceiling:false,likely_targets:['note.txt']}))
  assert.deepEqual(mission.identity.intent.likelyTargets,['note.txt'])
  assert.deepEqual(mission.identity.intent.likelyVerification,['review-evidence'])
})


test('bounded implementation drops model-inferred lint when repository exposes only tests',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-verifier-capability-'))
  try{
    writeFileSync(join(root,'package.json'),JSON.stringify({scripts:{test:'node --test'}}))
    mkdirSync(join(root,'src'));writeFileSync(join(root,'src','a.js'),'export const a=1\n')
    const store=new MissionStore(root),mission=store.start('repo-capability-filter','Fix src/a.js without naming a verifier')
    store.applyInitialSemanticAssessment('repo-capability-filter',parseSemanticIntentAssessment({...assessment,task_kind:'implementation',scope:'local',risk:'medium',likely_targets:['src/a.js'],likely_verification:['targeted-tests','lint'],user_verification:[],verification_ceiling:false}))
    assert.deepEqual(mission.identity.intent.likelyVerification,['targeted-tests'])
    assert.deepEqual(mission.execution.verification_policy.requiredKinds,['targeted-tests'])
    assert.deepEqual(mission.execution.obligations.find(o=>o.kind==='verification')?.requiredEvidence,['targeted-tests'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('explicit user lint remains authoritative even when repository has no lint route',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-explicit-lint-'))
  try{
    writeFileSync(join(root,'package.json'),JSON.stringify({scripts:{test:'node --test'}}))
    mkdirSync(join(root,'src'));writeFileSync(join(root,'src','a.js'),'export const a=1\n')
    const store=new MissionStore(root),mission=store.start('explicit-lint','Fix src/a.js. Run `npm run lint` and stop when it passes.')
    store.applyInitialSemanticAssessment('explicit-lint',parseSemanticIntentAssessment({...assessment,task_kind:'implementation',scope:'local',risk:'medium',likely_targets:['src/a.js'],likely_verification:['targeted-tests','lint'],user_verification:[],verification_ceiling:false}))
    assert.deepEqual(mission.identity.intent.likelyVerification,['lint'])
    assert.equal(mission.execution.ledger.find(e=>e.type==='semantic.assessed')?.payload?.technical_verification_ceiling_applied,true)
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('repo-wide route-less operational sandbox drops unsupported model-inferred code verifiers but keeps minimum Git sanity',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-operational-sandbox-verifier-'))
  try{
    writeFileSync(join(root,'opencode.json'),'{}')
    const store=new MissionStore(root),mission=store.start('operational-sandbox','Install the plugin from Git, run setup/config/doctor, verify registration, routing, inventory and restart state.')
    store.applyInitialSemanticAssessment('operational-sandbox',parseSemanticIntentAssessment({...assessment,task_kind:'implementation',scope:'repo-wide',risk:'medium',likely_targets:['opencode.json'],likely_verification:['typecheck','lint','build','changed-surface-sanity'],user_verification:[],verification_ceiling:false}))
    assert.deepEqual(mission.identity.intent.likelyVerification,[])
    assert.deepEqual(mission.execution.verification_policy.requiredKinds,['changed-surface-sanity'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('repo-wide route-less operational sandbox preserves an explicit user verifier',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-operational-explicit-verifier-'))
  try{
    writeFileSync(join(root,'opencode.json'),'{}')
    const store=new MissionStore(root),mission=store.start('operational-explicit','Install the plugin and run npm run lint when done.')
    store.applyInitialSemanticAssessment('operational-explicit',parseSemanticIntentAssessment({...assessment,task_kind:'implementation',scope:'repo-wide',risk:'medium',likely_targets:['opencode.json'],likely_verification:['typecheck','lint','build'],user_verification:[],verification_ceiling:false}))
    assert.deepEqual(mission.identity.intent.likelyVerification,['lint'])
  }finally{rmSync(root,{recursive:true,force:true})}
})
