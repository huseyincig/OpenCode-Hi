import test from 'node:test'
import assert from 'node:assert/strict'
import { replanVerificationForChangedSurface } from '../dist/runtime/verification/policy.js'
import { runDoctor } from '../dist/doctor/checks.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { acquireHiRuntimeInstance } from '../dist/opencode/instance-guard.js'

function repo(){return {ecosystems:['node'],likelyVerification:['npm test','npm run typecheck','npm run build'],characteristics:[]}}

test('dependency graph changes create explicit security/review obligation and capability',()=>{
  const store=new MissionStore(); const m=store.start('s-dep','opaque parser change')
  store.applyInitialSemanticAssessment('s-dep',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/parser.ts'],intent_signals:[],suppressed_intent_signals:[]})
  const task={id:'t1',objective:'fix parser',scope:['src/parser.ts'],dependencies:[],role:'coder',category:'standard',status:'running',obligation_ids:[],required_evidence:[],constraints:[],created_at:1,updated_at:1}
  m.execution.tasks.push(task)
  const r=replanVerificationForChangedSurface(m,task,['src/parser.ts','plugin/package-lock.json'],repo())
  assert.equal(r.changed,true)
  assert.equal(r.reason,'dependency-changed-surface')
  assert.equal(m.identity.risk,'high')
  assert.ok(m.identity.intent.requiredCapabilities.includes('dependency-change'))
  assert.ok(m.identity.intent.requiredCapabilities.includes('security-review'))
  assert.ok(m.execution.obligations.some(o=>o.kind==='review'&&o.status==='open'&&/Dependency graph changed/.test(o.summary)))
})

test('doctor reports primary-model drift separately when fallback is still available',()=>{
  const cfg=resolveHiConfig({routing:{roleModels:{coder:['p/missing','p/live']}}})
  const store=new MissionStore()
  const checks=runDoctor(cfg,store,process.cwd(),{models:[{id:'p/live',provider:'p',capabilities:['text']}],hostConfig:{}})
  const valid=checks.find(x=>x.id==='model-mapping-validity')
  const drift=checks.find(x=>x.id==='model-primary-drift')
  assert.equal(valid?.status,'pass')
  assert.equal(drift?.status,'warn')
  assert.match(drift?.detail??'',/primary=p\/missing/)
  assert.match(drift?.detail??'',/fallback=p\/live/)
})

test('runtime instance guard prevents duplicate hooks per project but permits distinct projects and reacquire',()=>{
  const a=acquireHiRuntimeInstance('/tmp/hi-project-a')
  assert.throws(()=>acquireHiRuntimeInstance('/tmp/hi-project-a'),/Duplicate OpenCode-Hi runtime/)
  const b=acquireHiRuntimeInstance('/tmp/hi-project-b')
  b.release();a.release()
  const c=acquireHiRuntimeInstance('/tmp/hi-project-a')
  c.release()
})
