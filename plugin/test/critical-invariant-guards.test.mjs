import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { primaryRoleCanDirectImplementation } from '../dist/runtime/roles/catalog.js'
import { addEvidence, markMutation, normalizeProjectPath } from '../dist/runtime/evidence/evidence-runtime.js'
import { verificationSatisfied, verificationEnvelopeFor } from '../dist/runtime/verification/policy.js'
import { evaluateIdle } from '../dist/runtime/continuation/evaluator.js'
import { actionContract, isAuthorized } from '../dist/runtime/safety/authority.js'
import { resolveHostCapability } from '../dist/runtime/host/capability-manifest.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import { DEFAULT_HI_CONFIG } from '../dist/config/defaults.js'
import { resolveModel } from '../dist/runtime/routing/model-resolver.js'
import { evaluateProcessSpawnAuthority } from '../dist/runtime/process/authority.js'
import { ProjectAuthorityStore, applyProjectAuthorityPermissions } from '../dist/runtime/safety/project-authority.js'
import { STORAGE_OWNERSHIP_CATALOG, assertStorageOwnershipCatalog } from '../dist/contracts/storage-ownership.js'
import { RuntimePersistence } from '../dist/runtime/state/persistence.js'
import { startAssessedMission } from './helpers/semantic.mjs'

test('manager remains denied direct repository write authority',()=>{
  assert.equal(primaryRoleCanDirectImplementation('manager'),false)
  assert.equal(primaryRoleCanDirectImplementation('working-manager'),true)
})

test('invalidated pre-mutation evidence cannot satisfy freshness',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'q2-fresh','fix',{likely_verification:['targeted-tests']})
  addEvidence(m,{kind:'targeted-tests',summary:'old pass',source:'bash',pass:true,outcome:'passed'})
  assert.equal(m.execution.evidence.fresh,true)
  markMutation(m,['src/a.ts'],'q2')
  assert.equal(m.execution.evidence.fresh,false)
  assert.deepEqual(verificationSatisfied(m),{ok:false,missing:['fresh-evidence']})
})

test('explicit user stop dominates idle continuation',()=>{
  const store=new MissionStore(),m=store.start('q2-stop','fix')
  m.identity.semantic_assessment.status='assessed';m.continuation.user_interrupted=true
  const d=evaluateIdle(m,Date.now()+1000)
  assert.equal(d.decision,'STOP');assert.equal(d.reason_code,'user-stop')
})

test('authority approval is bound to the exact action hash',()=>{
  const store=new MissionStore(),m=store.start('q2-auth','push')
  const approved=actionContract('git push','/repo/a')
  m.authority.authority={approved:{hash:approved.hash,approved_at:Date.now()},completed_hashes:[]}
  assert.equal(isAuthorized(m,'git push','/repo/a'),true)
  assert.equal(isAuthorized(m,'git push','/repo/b'),false)
  assert.equal(isAuthorized(m,'npm publish','/repo/a'),false)
})

test('open independent-review obligation cannot be represented as independently reviewed',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'q2-review','review',{task_kind:'review',risk:'high',required_capabilities:['review','independent-review'],likely_verification:['review-evidence']})
  m.execution.evidence.fresh=true
  const env=verificationEnvelopeFor(m)
  assert.equal(env.independent_review,false)
  assert.ok(verificationSatisfied(m).missing.includes('review-obligation'))
})

test('child session cannot invoke Hi control-plane tools',async()=>{
  const store=new MissionStore(),m=store.start('q2-parent','implement')
  m.execution.tasks.push({id:'t',mission_id:m.identity.mission_id,objective:'x',status:'running',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],external_action_requirements:[],worker_id:'w',created_at:Date.now(),updated_at:Date.now()})
  const worker={id:'w',task_id:'t',role:'coder',category:'standard',session_id:'q2-child',parent_session_id:'q2-parent',parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation}
  m.execution.workers.push(worker)
  const bg=new BackgroundRegistry();bg.set(worker)
  const hook=createToolBeforeHook(store,bg,()=>resolveHiConfig({}),process.cwd())
  await assert.rejects(()=>hook({sessionID:'q2-child',tool:'hi_status'},{args:{}}),/child workers cannot invoke Hi control-plane tool/)
})

test('changed-file ownership path normalization binds absolute project paths to relative scope',()=>{
  const root=mkdtempSync(join(tmpdir(),'q2-normalize-'))
  try{
    assert.equal(normalizeProjectPath(join(root,'src','a.ts'),root),'src/a.ts')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('absent host capability is UNSUPPORTED, never optimistic support',()=>{
  assert.equal(resolveHostCapability({host:'mock',capabilities:{}},'workspace_isolation'),'UNSUPPORTED')
})


test('completion cannot pass without required evidence',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'q2-completion','verify',{likely_verification:['targeted-tests']})
  const result=verificationSatisfied(m)
  assert.equal(result.ok,false)
  assert.ok(result.missing.includes('targeted-tests'))
})

test('explicit native bash deny cannot become allow',()=>{
  const result=evaluateProcessSpawnAuthority({mission_id:'m',task_id:'t',worker_id:'w',role:'coder',command:'echo',args:['ok'],cwd:'/repo',authority_ref:'a'},'/repo',{agent:{coder:{permission:{bash:'deny'}}}})
  assert.equal(result.decision,'DENY')
})

test('project authority merge cannot widen a native top-level deny',()=>{
  const root=mkdtempSync(join(tmpdir(),'q2-authority-monotonic-'))
  try{
    const store=new ProjectAuthorityStore(root);store.grant('git-push')
    const config={permission:{bash:'deny'}}
    applyProjectAuthorityPermissions(config,store)
    assert.equal(config.permission.bash,'deny')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('canonical storage owner uniqueness rejects duplicate scope/data-class ownership',()=>{
  assert.throws(()=>assertStorageOwnershipCatalog([...STORAGE_OWNERSHIP_CATALOG,STORAGE_OWNERSHIP_CATALOG[0]]),/Duplicate canonical storage owner/)
})

test('restart persistence rejects unsupported schema instead of loading it',()=>{
  const root=mkdtempSync(join(tmpdir(),'q2-schema-'))
  try{
    const persistence=new RuntimePersistence(root);persistence.save([])
    const raw=JSON.parse(readFileSync(persistence.path,'utf8'));raw.schema=9;writeFileSync(persistence.path,JSON.stringify(raw))
    assert.deepEqual(persistence.load(),[])
    assert.match(persistence.lastLoadReport.error??'',/unsupported runtime-state schema 9/)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('routing maxFallbacks has an executable effect',()=>{
  const config=structuredClone(DEFAULT_HI_CONFIG);config.routing.maxFallbacks=0
  const models=[
    {id:'p/a',provider:'p',writeCapable:true,quality:8,cost:1,tags:['balanced']},
    {id:'p/b',provider:'p',writeCapable:true,quality:7,cost:1,tags:['balanced']},
    {id:'p/c',provider:'p',writeCapable:true,quality:6,cost:1,tags:['balanced']},
  ]
  const result=resolveModel('standard',models,config)
  assert.equal(result.fallbacks.length,0)
})

test('absolute path confinement rejects paths outside the project root',()=>{
  const root=mkdtempSync(join(tmpdir(),'q2-confine-'))
  try{assert.equal(normalizeProjectPath(join(root,'..','escape.ts'),root),'')}finally{rmSync(root,{recursive:true,force:true})}
})
