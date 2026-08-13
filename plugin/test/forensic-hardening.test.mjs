import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import HiPlugin from '../dist/plugin.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {registerTemporaryMutation} from '../dist/runtime/mutations/temporary-mutations.js'
import {syncMissionGates} from '../dist/runtime/gates/gates.js'
import {parseWorkerResult} from '../dist/runtime/task/result-parser.js'
import {assessPluginMission} from './helpers/semantic.mjs'

function client(){return {app:{log:async()=>{}},provider:{list:async()=>({data:{connected:[],all:[]}})},session:{status:async()=>({data:{}}),children:async()=>({data:[]}),diff:async()=>({data:[]}),todo:async()=>({data:[]}),revert:async()=>({data:{}}),unrevert:async()=>({data:{}})}}}

test('a read is review input only; direct review completion requires explicit parent progress evidence',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-review-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s',message:{role:'user',parts:[{type:'text',text:'Review src/a.ts for correctness'}]}},{parts:[]}); await assessPluginMission(hooks,'s',{task_kind:'review',required_capabilities:['review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
    await hooks['tool.execute.after']({sessionID:'s',tool:'read',args:{filePath:'src/a.ts'}},'const x = 1')
    const beforeStatus=String(await hooks.tool.hi_status.execute({},{sessionID:'s'}))
    assert.match(beforeStatus,/2 obligation open|2 obligations open|2 obligation/)
    const before=JSON.parse(await hooks.tool.hi_ledger.execute({limit:80},{sessionID:'s'}))
    assert.ok(before.events.some(e=>e.type==='verification.pass'&&e.payload?.kind==='review-input'))
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Reviewed src/a.ts; no findings.'},{sessionID:'s'}))
    assert.equal(result.status,'RECORDED')
    const afterStatus=String(await hooks.tool.hi_status.execute({},{sessionID:'s'}))
    assert.match(afterStatus,/0 obligation open|0 obligations open|completed/)
    const after=JSON.parse(await hooks.tool.hi_ledger.execute({limit:80},{sessionID:'s'}))
    assert.ok(after.events.some(e=>e.type==='review.direct-progress'))
    assert.ok(after.events.some(e=>e.type==='verification.pass'&&e.payload?.kind==='review-evidence'))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('command rollback with unknown exit cannot close rollback gate',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-rollback-exit-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-rb',message:{role:'user',parts:[{type:'text',text:'Fix a local bug'}]}},{parts:[]}); await assessPluginMission(hooks,'s-rb',{task_kind:'bug-fix',required_capabilities:['implementation'],likely_verification:['targeted-tests']})
    await hooks.tool.hi_temporary_mutation_register.execute({kind:'env',description:'temporary',rollback_command:'git restore foo'},{sessionID:'s-rb'})
    await hooks['tool.execute.after']({sessionID:'s-rb',tool:'bash',args:{command:'git restore foo'}},{stdout:''})
    const readiness=JSON.parse(await hooks.tool.hi_readiness.execute({},{sessionID:'s-rb'}))
    assert.equal(readiness.items.find(g=>g.id==='gate-temporary-rollback')?.status,'blocked')
    await hooks['tool.execute.after']({sessionID:'s-rb',tool:'bash',args:{command:'git restore foo'}},{stdout:'restored',metadata:{exit:0}})
    const after=JSON.parse(await hooks.tool.hi_readiness.execute({},{sessionID:'s-rb'}))
    assert.equal(after.items.find(g=>g.id==='gate-temporary-rollback')?.status,'not-applicable')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('resolving one task issue does not clear the same blocker still owned by another task',()=>{
  const m=new MissionStore().start('s','fix two things')
  const rt=new TaskRuntime({},new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:4,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  const issue={status:'FIX_REQUIRED',summary:'shared issue',changed_files:[],evidence:[],open_issues:['shared:blocker'],needs_context:[]}
  m.tasks.push({id:'t1',objective:'t1',status:'waiting',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],result:issue,worker_id:'w1',created_at:1,updated_at:1})
  m.tasks.push({id:'t2',objective:'t2',status:'completed',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],result:{status:'DONE',summary:'done with concern',changed_files:[],evidence:[],open_issues:['shared:blocker'],needs_context:[]},worker_id:'w2',created_at:1,updated_at:1})
  m.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:'s',parent_mission_id:m.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'w1',status:'ready',generation_at_spawn:m.generation})
  m.workers.push({id:'w2',task_id:'t2',role:'coder',category:'standard',parent_session_id:'s',parent_mission_id:m.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'w2',status:'completed',generation_at_spawn:m.generation})
  m.blockers=['shared:blocker']
  rt.applyResult(m,'w1',{status:'DONE',summary:'fixed',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  assert.ok(m.blockers.includes('shared:blocker'))
})

import {mkdirSync,writeFileSync,statSync} from 'node:fs'
import {dirname} from 'node:path'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'

test('noncanonical external-effect commands are rejected before native permission patterns can be bypassed',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-command-boundary-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-cmd',message:{role:'user',parts:[{type:'text',text:'Prepare a release push'}]}},{parts:[]}); await assessPluginMission(hooks,'s-cmd',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',required_capabilities:['verification'],requested_external_actions:['git-push']})
    await assert.rejects(()=>hooks['tool.execute.before']({sessionID:'s-cmd',tool:'bash'},{args:{command:'git -C /tmp/repo push origin main'}}),/canonical command form/)
    await assert.rejects(()=>hooks['tool.execute.before']({sessionID:'s-cmd',tool:'bash'},{args:{command:'cd /tmp/repo && git push origin main'}}),/canonical command form/)
    await assert.rejects(()=>hooks['tool.execute.before']({sessionID:'s-cmd',tool:'bash'},{args:{command:'npm --registry=https:\/\/registry.npmjs.org publish'}}),/canonical command form/)
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('invalid persisted runtime state fails plugin initialization closed instead of silently forgetting safety state',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-invalid-state-'))
  const persistence=new RuntimePersistence(root)
  try{
    mkdirSync(dirname(persistence.path),{recursive:true});writeFileSync(persistence.path,'{"schema":99,"missions":[]}\n','utf8')
    await assert.rejects(()=>HiPlugin({directory:root,worktree:root,project:{},client:client()}),/runtime state is invalid and was not discarded/)
  }finally{rmSync(root,{recursive:true,force:true});rmSync(dirname(persistence.path),{recursive:true,force:true})}
})

test('runtime state is persisted with private file permissions on POSIX',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-private-state-')),persistence=new RuntimePersistence(root)
  try{
    persistence.save([new MissionStore(root).start('s-private','private mission')],false)
    if(process.platform!=='win32')assert.equal(statSync(persistence.path).mode&0o777,0o600)
  }finally{rmSync(root,{recursive:true,force:true});rmSync(dirname(persistence.path),{recursive:true,force:true})}
})

test('parent direct progress cannot close implementation from an unrelated changed file',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-owned-'))
  try{
    const c=client();c.session.diff=async()=>({data:[{file:'docs/unrelated.md'}]})
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-owned',message:{role:'user',parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]}},{parts:[]}); await assessPluginMission(hooks,'s-owned',{likely_targets:['src/a.ts']})
    await hooks['tool.execute.before']({sessionID:'s-owned',tool:'write'},{args:{filePath:'docs/unrelated.md'}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'done'},{sessionID:'s-owned'}))
    assert.equal(result.status,'BLOCKED');assert.deepEqual(result.collateral,['docs/unrelated.md'])
    assert.match(String(await hooks.tool.hi_status.execute({},{sessionID:'s-owned'})),/2 obligation open/)
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('parent direct ownership accepts an automatically related sibling test file',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-related-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-related',message:{role:'user',parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]}},{parts:[]}); await assessPluginMission(hooks,'s-related',{likely_targets:['src/a.ts']})
    await hooks['tool.execute.before']({sessionID:'s-related',tool:'write'},{args:{filePath:'src/a.test.ts'}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'implemented with focused test'},{sessionID:'s-related'}))
    assert.equal(result.status,'RECORDED')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('parent direct ownership ignores an observed file that native current diff proves was reverted',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-reverted-'))
  const c=client();c.session.diff=async()=>({data:[{file:'src/a.ts'}]})
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-reverted',message:{role:'user',parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]}},{parts:[]}); await assessPluginMission(hooks,'s-reverted',{likely_targets:['src/a.ts']})
    await hooks['tool.execute.before']({sessionID:'s-reverted',tool:'write'},{args:{filePath:'src/a.ts'}})
    await hooks['tool.execute.before']({sessionID:'s-reverted',tool:'write'},{args:{filePath:'docs/temp.md'}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'final owned change only'},{sessionID:'s-reverted'}))
    assert.equal(result.status,'RECORDED');assert.deepEqual(result.changed_files,['src/a.ts'])
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

import {addEvidence,observeToolBefore} from '../dist/runtime/evidence/evidence-runtime.js'

test('bash mutation variants invalidate prior fresh evidence while read-only git status does not',()=>{
  const mutators=['printf x > src/a.ts',`node -e "require('fs').writeFileSync('src/a.ts','x')"`,'git apply fix.patch','chmod 600 src/a.ts','patch -p1 < fix.patch','echo x > src/a.ts']
  for(const command of mutators){const m=new MissionStore().start(command,'Update src/a.ts');addEvidence(m,{kind:'changed-surface-sanity',summary:'old proof',source:'test',pass:true,outcome:'passed'});assert.equal(m.evidence.fresh,true);observeToolBefore(m,'bash',{command});assert.equal(m.evidence.fresh,false,command)}
  const readOnly=new MissionStore().start('read-only','Update src/a.ts');addEvidence(readOnly,{kind:'changed-surface-sanity',summary:'old proof',source:'test',pass:true,outcome:'passed'});observeToolBefore(readOnly,'bash',{command:'git status --porcelain'});assert.equal(readOnly.evidence.fresh,true)
})

test('path-unknown bash mutation cannot be used as direct implementation ownership proof',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-unknown-surface-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-unknown',message:{role:'user',parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]}},{parts:[]}); await assessPluginMission(hooks,'s-unknown',{likely_targets:['src/a.ts']})
    await hooks['tool.execute.before']({sessionID:'s-unknown',tool:'bash'},{args:{command:'printf x > src/a.ts'}})
    const result=String(await hooks.tool.hi_direct_progress.execute({summary:'done'},{sessionID:'s-unknown'}))
    assert.match(result,/changed-file surface is unknown/)
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('direct progress accepts native nested input shape and a semantic label when exactly one review obligation is open',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-native-shape-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s',message:{role:'user',parts:[{type:'text',text:'Review src/a.ts for correctness'}]}},{parts:[]}); await assessPluginMission(hooks,'s',{task_kind:'review',required_capabilities:['review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
    await hooks['tool.execute.after']({sessionID:'s',tool:'read',args:{filePath:'src/a.ts'}},'const x = 1')
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({input:{summary:'Review complete; no findings.',obligation_id:'review-evidence'}},{sessionID:'s'}))
    assert.equal(result.status,'RECORDED')
    const status=String(await hooks.tool.hi_status.execute({},{sessionID:'s'}))
    assert.match(status,/0 obligation open|0 obligations open|completed/)
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('direct progress cannot close a review obligation that requires an independent reviewer',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-independent-review-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-independent',message:{role:'user',parts:[{type:'text',text:'Perform an independent review of src/a.ts for correctness'}]}},{parts:[]}); await assessPluginMission(hooks,'s-independent',{task_kind:'review',required_capabilities:['review','independent-review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
    await hooks['tool.execute.after']({sessionID:'s-independent',tool:'read',args:{filePath:'src/a.ts'}},'const x = 1')
    const result=String(await hooks.tool.hi_direct_progress.execute({input:{summary:'Parent review complete.',obligation_id:'review-evidence'}},{sessionID:'s-independent'}))
    assert.match(result,/independent reviewer required/)
    assert.match(String(await hooks.tool.hi_status.execute({},{sessionID:'s-independent'})),/[1-9] obligation open/)
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('worker result normalizes real-host success alias with bounded structured evidence',()=>{
  const result=parseWorkerResult(JSON.stringify({status:'success',summary:'Reviewed target read-only.',changed_files:[],scope_expansions:[],evidence:[{kind:'review-evidence',summary:'Scoped review completed',pass:true,outcome:'passed'},{kind:'changed-surface-sanity',summary:'No mutation observed',pass:true,outcome:'passed'}],open_issues:[],needs_context:[]}))
  assert.equal(result.status,'DONE')
  assert.equal(result.evidence.length,2)
  assert.ok(result.evidence.some(e=>e.kind==='review-evidence'&&e.outcome==='passed'))
})

test('worker result rejects arbitrary prose or object evidence as proof',()=>{
  const a=parseWorkerResult(JSON.stringify({status:'success',summary:'done',changed_files:[],evidence:{schema_value:'x',read_only_confirmed:true},open_issues:[],needs_context:[]}))
  const b=parseWorkerResult(JSON.stringify({status:'success',summary:'done',changed_files:[],evidence:['schema value x','no files modified'],open_issues:[],needs_context:[]}))
  assert.equal(a.status,'DONE');assert.equal(b.status,'DONE')
  assert.deepEqual(a.evidence,[]);assert.deepEqual(b.evidence,[])
})
test('non-mutating bash can provide review input for a read-only review mission',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-review-bash-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()}); await hooks.config({})
    await hooks['chat.message']({sessionID:'s-bash-review',message:{role:'user',parts:[{type:'text',text:'Run pwd once and report the current directory. Do not modify files.'}]}},{parts:[]}); await assessPluginMission(hooks,'s-bash-review',{task_kind:'review',required_capabilities:['review'],likely_verification:['review-evidence']})
    await hooks['tool.execute.after']({sessionID:'s-bash-review',tool:'bash',args:{command:'pwd'}},{stdout:root,metadata:{exit:0}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Reported current directory from read-only pwd output.'},{sessionID:'s-bash-review'}))
    assert.equal(result.status,'RECORDED')
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:80},{sessionID:'s-bash-review'}))
    assert.ok(ledger.events.some(e=>e.type==='verification.pass'&&e.payload?.kind==='review-input'))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('native skill content can provide review input for a read-only review mission',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-review-skill-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()}); await hooks.config({})
    await hooks['chat.message']({sessionID:'s-skill-review',message:{role:'user',parts:[{type:'text',text:'Load the hi-test-strategy skill and summarize it. Do not modify files.'}]}},{parts:[]}); await assessPluginMission(hooks,'s-skill-review',{task_kind:'review',required_capabilities:['review'],likely_verification:['review-evidence'],intent_signals:['intent.test-strategy']})
    await hooks['tool.execute.after']({sessionID:'s-skill-review',tool:'skill',args:{name:'hi-test-strategy'}},'<skill_content name="hi-test-strategy">methodology</skill_content>')
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Summarized the loaded native skill methodology.'},{sessionID:'s-skill-review'}))
    assert.equal(result.status,'RECORDED')
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:80},{sessionID:'s-skill-review'}))
    assert.ok(ledger.events.some(e=>e.type==='verification.pass'&&e.payload?.kind==='review-input'))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('parent direct methodology remains active until mission-scope fresh verification satisfies its exit contract',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-parent-methodology-exit-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-parent-method',message:{role:'user',parts:[{type:'text',text:'Refactor src/a.ts without changing behavior'}]}},{parts:[]}); await assessPluginMission(hooks,'s-parent-method',{likely_targets:['src/a.ts'],likely_verification:['targeted-tests'],intent_signals:['intent.refactor']})
    await hooks['tool.execute.before']({sessionID:'s-parent-method',tool:'skill',args:{name:'hi-safe-refactoring'}},{args:{name:'hi-safe-refactoring'}})
    await hooks['tool.execute.after']({sessionID:'s-parent-method',tool:'skill',args:{name:'hi-safe-refactoring'}},'loaded methodology')
    await hooks['tool.execute.before']({sessionID:'s-parent-method',tool:'edit',args:{filePath:'src/a.ts'}},{args:{filePath:'src/a.ts'}})
    await hooks['tool.execute.after']({sessionID:'s-parent-method',tool:'edit',args:{filePath:'src/a.ts'}},'edited')
    const before=JSON.parse(await hooks.tool.hi_ledger.execute({limit:120},{sessionID:'s-parent-method'}))
    assert.ok(before.events.some(e=>e.type==='methodology.activated'&&e.payload?.name==='hi-safe-refactoring'))
    assert.ok(!before.events.some(e=>e.type==='methodology.resolved'&&e.payload?.name==='hi-safe-refactoring'))
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Behavior-preserving refactor completed.'},{sessionID:'s-parent-method'}))
    assert.equal(result.status,'RECORDED')
    const afterProgress=JSON.parse(await hooks.tool.hi_ledger.execute({limit:160},{sessionID:'s-parent-method'}))
    assert.ok(!afterProgress.events.some(e=>e.type==='methodology.resolved'&&e.payload?.name==='hi-safe-refactoring'))
    await hooks['tool.execute.after']({sessionID:'s-parent-method',tool:'bash',args:{command:'npm test -- src/a.test.ts'}},{stdout:'1 passed',metadata:{exit:0}})
    const afterVerification=JSON.parse(await hooks.tool.hi_ledger.execute({limit:200},{sessionID:'s-parent-method'}))
    assert.ok(afterVerification.events.some(e=>e.type==='methodology.resolved'&&e.payload?.name==='hi-safe-refactoring'))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})
