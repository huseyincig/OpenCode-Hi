import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {parseSemanticIntentAssessment} from '../dist/runtime/intent/semantic-assessment.js'
import {renderSemanticAssessmentGate} from '../dist/runtime/intent/semantic-assessment-gate.js'
import {activeConstraintAtoms,applyConstraintAtomDrafts,constraintAtomMatchesPath} from '../dist/runtime/constraint/constraint-atoms.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const draft=(polarity='DENY',supersedes=[])=>({subject_kind:'path',subject:'package.json',predicate:'mutate',polarity,scope:'mission',supersedes})
function assessed(store,id='constraint-atoms'){
  const m=store.start(id,'modify src/a.ts')
  store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[],constraint_atoms:[]})
  return m
}
function runtime(){const client={session:{create:async()=>({data:{id:'child'}}),promptAsync:async()=>({data:{}}),diff:async()=>({data:[]})}};return new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:5,cost:1,tags:['coding']}],()=>({}))}

test('semantic assessment accepts only structured constraint atoms on constraint follow-ups',()=>{
  const parsed=parseSemanticIntentAssessment({material:true,message_kind:'constraint',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],user_verification:[],verification_ceiling:false,likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[],constraint_atoms:[draft()]})
  assert.equal(parsed.constraint_atoms.length,1)
  assert.throws(()=>parseSemanticIntentAssessment({...parsed,message_kind:'amendment'}),/constraint_atoms are allowed only/)
  assert.throws(()=>parseSemanticIntentAssessment({...parsed,constraint_atoms:[{...draft(),subject:'../outside'}]}),/invalid constraint_atoms/)
})

test('opposite atom does not silently win; explicit supersedes resolves the temporal decision',()=>{
  const first=applyConstraintAtomDrafts([], [draft()],2,'do not change package.json',100)
  assert.equal(first.added[0].status,'ACTIVE');assert.ok(constraintAtomMatchesPath(first.added[0],'package.json'))
  const conflict=applyConstraintAtomDrafts(first.atoms,[draft('ALLOW')],3,'you may change package.json',200)
  assert.equal(conflict.conflicts.length,1);assert.equal(conflict.added[0].status,'CONFLICTING');assert.equal(activeConstraintAtoms(conflict.atoms).length,1)
  const resolved=applyConstraintAtomDrafts(first.atoms,[draft('ALLOW',[first.added[0].id])],3,'you may now change package.json',200)
  assert.equal(resolved.superseded[0].status,'SUPERSEDED');assert.equal(resolved.added[0].status,'ACTIVE');assert.equal(activeConstraintAtoms(resolved.atoms)[0].polarity,'ALLOW')
})

test('unknown supersedes lineage fails closed instead of activating the incoming atom',()=>{
  const out=applyConstraintAtomDrafts([], [draft('ALLOW',['ca_00000000000000000000'])],4,'replace old decision',300)
  assert.equal(out.added[0].status,'CONFLICTING');assert.deepEqual(out.missing_supersedes[0].missing,['ca_00000000000000000000']);assert.equal(activeConstraintAtoms(out.atoms).length,0)
})

test('MissionStore rejects an unsuperseded reversal transactionally and keeps the semantic revision pending',()=>{
  const store=new MissionStore(),m=assessed(store,'constraint-store')
  store.beginFollowupSemanticAssessment('constraint-store','do not change package.json')
  store.applyFollowupSemanticAssessment('constraint-store',{material:true,message_kind:'constraint',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[],constraint_atoms:[draft()]})
  const first=activeConstraintAtoms(m.execution.constraint_atoms)[0];assert.equal(first.introduced_revision,2);assert.match(m.execution.constraints.join('\n'),new RegExp(first.id))
  store.beginFollowupSemanticAssessment('constraint-store','you may change package.json')
  const beforeAtoms=structuredClone(m.execution.constraint_atoms),beforeConstraints=[...m.execution.constraints],beforeObjective=m.identity.objective
  assert.throws(()=>store.applyFollowupSemanticAssessment('constraint-store',{material:true,message_kind:'constraint',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[],constraint_atoms:[draft('ALLOW')]}),new RegExp(`explicit supersedes.*${first.id}`))
  assert.equal(m.identity.semantic_assessment.status,'pending');assert.equal(m.identity.semantic_assessment.revision,3)
  assert.deepEqual(m.execution.constraint_atoms,beforeAtoms);assert.deepEqual(m.execution.constraints,beforeConstraints);assert.equal(m.identity.objective,beforeObjective)
  assert.equal(m.execution.blockers.some(x=>x.startsWith('constraint-conflict:')||x.startsWith('constraint-supersedes-missing:')),false)
})

test('semantic gate prioritizes pending-text-relevant active atoms without exceeding the bounded atom budget',()=>{
  const store=new MissionStore(),m=assessed(store,'constraint-gate-budget')
  let atoms=[]
  for(let i=0;i<12;i++)atoms=applyConstraintAtomDrafts(atoms,[{subject_kind:'path',subject:`src/file-${i}.ts`,predicate:'mutate',polarity:'DENY',scope:'mission',supersedes:[]}],i+2,`do not change src/file-${i}.ts`,100+i).atoms
  m.execution.constraint_atoms=atoms
  store.beginFollowupSemanticAssessment('constraint-gate-budget','you may now change src/file-0.ts')
  const gate=renderSemanticAssessmentGate(m),line=gate.split('\n').find(x=>x.startsWith('active_atoms='))??''
  assert.match(line,new RegExp(activeConstraintAtoms(atoms).find(x=>x.subject==='src/file-0.ts').id))
  assert.ok(line.split('|').length<=10)
})

test('write-capable task scope is fail-closed against active DENY mutate path atom',async()=>{
  const store=new MissionStore(),m=assessed(store,'constraint-preflight')
  const applied=applyConstraintAtomDrafts([], [draft()],2,'do not change package.json');m.execution.constraint_atoms=applied.atoms
  await assert.rejects(()=>runtime().start(m,{objective:'change package metadata',role:'coder',category:'quick',scope:['package.json'],model:'p/code'}),/active user mutation constraint/)
  assert.ok(m.execution.ledger.some(e=>e.type==='task.constraint-preflight-blocked'))
})


test('mutation-only constraint does not block read-only reviewer inspection of the same path',async()=>{
  const store=new MissionStore(),m=assessed(store,'constraint-readonly'),applied=applyConstraintAtomDrafts([], [draft()],2,'do not change package.json');m.execution.constraint_atoms=applied.atoms
  const out=await runtime().start(m,{objective:'inspect package metadata only',role:'qa-reviewer',category:'standard',scope:['package.json'],model:'p/code'})
  assert.ok(out.worker_id);assert.equal(m.execution.tasks.find(t=>t.id===out.task_id)?.scope[0],'package.json')
})

test('constraint atoms survive canonical runtime persistence and reload with lineage intact',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-constraint-persist-'));try{
    const store=new MissionStore(root),m=assessed(store,'constraint-persist'),first=applyConstraintAtomDrafts([], [draft()],2,'do not change package.json',100),second=applyConstraintAtomDrafts(first.atoms,[draft('ALLOW',[first.added[0].id])],3,'package.json may change',200);m.execution.constraint_atoms=second.atoms
    const persistence=new RuntimePersistence(root);persistence.save([m],true);const loaded=persistence.load();assert.equal(loaded.length,1);assert.equal(loaded[0].execution.constraint_atoms?.length,2);assert.equal(loaded[0].execution.constraint_atoms?.[0].status,'SUPERSEDED');assert.equal(loaded[0].execution.constraint_atoms?.[0].superseded_by,loaded[0].execution.constraint_atoms?.[1].id);assert.equal(loaded[0].execution.constraint_atoms?.[1].status,'ACTIVE')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('worker result that reports a prohibited mutation becomes FIX_REQUIRED and cannot complete',()=>{
  const store=new MissionStore(),m=assessed(store,'constraint-result'),rt=runtime(),applied=applyConstraintAtomDrafts([], [draft()],2,'do not change package.json');m.execution.constraint_atoms=applied.atoms
  const task=createTask(m,{objective:'existing bounded work',role:'coder',category:'quick',scope:['package.json']}),worker=createWorker(m,task,'p/code');worker.status='busy';worker.attempt=1;worker.generation_at_spawn=m.continuation.generation;task.status='running'
  rt.applyResult(m,worker.id,{status:'DONE',summary:'done',changed_files:['package.json'],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(task.result?.status,'FIX_REQUIRED');assert.ok(task.result?.open_issues.some(x=>x.startsWith(`constraint-violation:${applied.added[0].id}:package.json`)));assert.ok(m.execution.blockers.some(x=>x.startsWith('constraint-violation:')))
})
