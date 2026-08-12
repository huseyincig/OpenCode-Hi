import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {collectRepoContext} from '../dist/runtime/intent/repo-context.js'
import {replanVerificationForChangedSurface,verificationSatisfied} from '../dist/runtime/verification/policy.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'

function repo(){const root=mkdtempSync(join(tmpdir(),'hi-replan-'));writeFileSync(join(root,'package.json'),JSON.stringify({scripts:{test:'vitest run',typecheck:'tsc --noEmit',build:'vite build'}}));mkdirSync(join(root,'src','auth'),{recursive:true});writeFileSync(join(root,'src/auth/token.ts'),'x');writeFileSync(join(root,'src/other.ts'),'x');writeFileSync(join(root,'src/extra.ts'),'x');return root}
function runtime(root){return new TaskRuntime({},new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),root,root,()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))}

test('unexpected multi-file changed surface strengthens a local verification contract with one static check',()=>{
  const root=repo(),s=new MissionStore(),m=s.start('p','fix the bug in src/other.ts and test it')
  m.risk='low';m.intent.risk='low';m.verification_policy={requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const t=createTask(m,{objective:'fix token',role:'coder',category:'quick',scope:['src/other.ts'],requiredEvidence:['targeted-tests']})
  const r=replanVerificationForChangedSurface(m,t,['src/other.ts','src/extra.ts'],collectRepoContext(root))
  assert.equal(r.scopeExpanded,true)
  assert.deepEqual(r.addedKinds,['typecheck'])
  assert.deepEqual(m.verification_policy.requiredKinds,['targeted-tests','typecheck'])
})

test('sensitive changed surface escalates risk and requires static plus build evidence',()=>{
  const root=repo(),s=new MissionStore(),m=s.start('p','fix the bug in src/other.ts and test it')
  m.risk='low';m.intent.risk='low';m.verification_policy={requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const v=m.obligations.find(o=>o.kind==='verification'); if(v)v.requiredEvidence=['targeted-tests']
  const t=createTask(m,{objective:'fix',role:'coder',category:'quick',scope:['src/other.ts'],requiredEvidence:['targeted-tests'],obligationIds:v?[v.id]:[]})
  const r=replanVerificationForChangedSurface(m,t,['src/other.ts','src/auth/token.ts'],collectRepoContext(root))
  assert.equal(r.riskEscalated,true)
  assert.equal(m.risk,'high')
  assert.equal(m.intent.risk,'high')
  assert.equal(m.verification_policy.requireReview,true)
  assert.ok(m.obligations.some(o=>o.kind==='review'&&o.status==='open'))
  assert.deepEqual(m.verification_policy.requiredKinds,['targeted-tests','typecheck','build'])
  assert.deepEqual(v?.requiredEvidence,['targeted-tests','typecheck','build'])
})

test('worker DONE with broader changed_files cannot close verification under the stale narrow plan',()=>{
  const root=repo(),s=new MissionStore(),m=s.start('p','fix the bug in src/other.ts and test it')
  m.risk='low';m.intent.risk='low';m.verification_policy={requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const v=m.obligations.find(o=>o.kind==='verification'); if(v)v.requiredEvidence=['targeted-tests']
  const t=createTask(m,{objective:'fix',role:'coder',category:'quick',scope:['src/other.ts'],requiredEvidence:['targeted-tests'],obligationIds:v?[v.id]:[]})
  const w=createWorker(m,t,'host-default',[],[],[]);w.status='busy';w.started_at=Date.now()-10
  runtime(root).applyResult(m,w.id,{status:'DONE',summary:'fixed plus auth helper',changed_files:['src/other.ts','src/auth/token.ts'],evidence:[{kind:'targeted-tests',summary:'old narrow tests pass',scope:['src/other.ts'],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(v?.status,'open')
  assert.ok(m.verification_policy.requiredKinds.includes('typecheck'))
  assert.ok(m.verification_policy.requiredKinds.includes('build'))
  assert.equal(verificationSatisfied(m,v?.id).ok,false)
  assert.ok(m.ledger.some(e=>e.type==='verification.replanned'))
})

test('follow-up reviewer defaults to actual changed surface and replanned required evidence',async()=>{
  const root=repo(),s=new MissionStore(root),m=s.start('p','fix the bug in src/other.ts and test it')
  m.changed_files=['src/other.ts','src/auth/token.ts']
  m.verification_policy.requiredKinds=['targeted-tests','typecheck','build']
  const prompts=[];let seq=0
  const client={session:{create:async()=>({data:{id:`child-${++seq}`}}),promptAsync:async(x)=>{prompts.push(x);return{data:{}}},abort:async()=>({data:{}})}}
  const rt=new TaskRuntime(client,new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),root,root,()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  const out=await rt.start(m,{objective:'review actual changed surface',role:'qa-reviewer',category:'standard'})
  const t=m.tasks.find(x=>x.id===out.task_id)
  assert.deepEqual(t?.scope,['src/other.ts','src/auth/token.ts'])
  assert.deepEqual(t?.requiredEvidence,['targeted-tests','typecheck','build'])
  assert.match(prompts[0].body.parts[0].text,/src\/auth\/token\.ts/)
})
