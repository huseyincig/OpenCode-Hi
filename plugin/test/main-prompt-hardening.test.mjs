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


test('duplicate plugin initialization is fenced before shared runtime-state side effects',async()=>{
  const {mkdtempSync,readFileSync,rmSync}=await import('node:fs')
  const {tmpdir}=await import('node:os')
  const {join}=await import('node:path')
  const {default:HiPlugin}=await import('../dist/plugin.js')
  const {RuntimePersistence}=await import('../dist/runtime/state/persistence.js')
  const root=mkdtempSync(join(tmpdir(),'hi-instance-preinit-fence-'))
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:'unused'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]})}}
  let hooks
  try{
    hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
    const statePath=new RuntimePersistence(root).path,before=readFileSync(statePath,'utf8')
    await assert.rejects(()=>HiPlugin({directory:root,worktree:root,project:{},client}),/Duplicate OpenCode-Hi runtime/)
    const after=readFileSync(statePath,'utf8')
    assert.equal(after,before,'duplicate runtime must be rejected before persistence/reconciliation/bootstrap can mutate shared runtime state')
  }finally{await hooks?.dispose?.();rmSync(root,{recursive:true,force:true})}
})

test('failed plugin initialization releases the early runtime instance lease for a clean retry',async()=>{
  const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs')
  const {tmpdir}=await import('node:os')
  const {dirname,join}=await import('node:path')
  const {default:HiPlugin}=await import('../dist/plugin.js')
  const {RuntimePersistence}=await import('../dist/runtime/state/persistence.js')
  const root=mkdtempSync(join(tmpdir(),'hi-instance-init-failure-release-'))
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:'unused'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]})}}
  let hooks
  try{
    const persistence=new RuntimePersistence(root);mkdirSync(dirname(persistence.path),{recursive:true});writeFileSync(persistence.path,'{"schema":99,"missions":[]}\n')
    await assert.rejects(()=>HiPlugin({directory:root,worktree:root,project:{},client}),/runtime state is invalid and was not discarded/)
    rmSync(persistence.path,{force:true})
    hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
    assert.ok(hooks?.tool?.hi_status,'same owner/project must be able to retry after failed initialization')
  }finally{await hooks?.dispose?.();rmSync(root,{recursive:true,force:true})}
})

test('runtime instance guard prevents duplicate hooks per host context while permitting distinct OpenCode instance contexts and reacquire',()=>{
  const ownerA={},ownerB={}
  const a=acquireHiRuntimeInstance('/tmp/hi-project-a',ownerA)
  assert.throws(()=>acquireHiRuntimeInstance('/tmp/hi-project-a',ownerA),/Duplicate OpenCode-Hi runtime/)
  const distinctContext=acquireHiRuntimeInstance('/tmp/hi-project-a',ownerB)
  const otherProject=acquireHiRuntimeInstance('/tmp/hi-project-b',ownerA)
  distinctContext.release();otherProject.release();a.release()
  const c=acquireHiRuntimeInstance('/tmp/hi-project-a',ownerA)
  c.release()
})
