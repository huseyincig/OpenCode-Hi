import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync} from 'node:child_process'
import HiPlugin from '../dist/plugin.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {registerTemporaryMutation} from '../dist/runtime/mutations/temporary-mutations.js'
import {syncMissionGates} from '../dist/runtime/gates/gates.js'
import {parseWorkerResult} from '../dist/runtime/task/result-parser.js'
import {assessPluginMission} from './helpers/semantic.mjs'
import {opencodeChildPort} from './helpers/host-port.mjs'

function client(){return {app:{log:async()=>{}},provider:{list:async()=>({data:{connected:[],all:[]}})},session:{status:async()=>({data:{}}),children:async()=>({data:[]}),diff:async()=>({data:[]}),todo:async()=>({data:[]}),revert:async()=>({data:{}}),unrevert:async()=>({data:{}})}}}

test('a read is review input only; direct review completion requires explicit parent progress evidence',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-review-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s'},{message:{role:'user'},parts:[{type:'text',text:'Review src/a.ts for correctness'}]}); await assessPluginMission(hooks,'s',{task_kind:'review',required_capabilities:['review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
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
    await hooks['chat.message']({sessionID:'s-rb'},{message:{role:'user'},parts:[{type:'text',text:'Fix a local bug'}]}); await assessPluginMission(hooks,'s-rb',{task_kind:'bug-fix',required_capabilities:['implementation'],likely_verification:['targeted-tests']})
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
  const rt=new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:4,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  const issue={status:'FIX_REQUIRED',summary:'shared issue',changed_files:[],evidence:[],open_issues:['shared:blocker'],needs_context:[]}
  m.execution.tasks.push({id:'t1',objective:'t1',status:'waiting',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],result:issue,worker_id:'w1',created_at:1,updated_at:1})
  m.execution.tasks.push({id:'t2',objective:'t2',status:'waiting',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],result:{status:'FIX_REQUIRED',summary:'second task still owns concern',changed_files:[],evidence:[],open_issues:['shared:blocker'],needs_context:[]},worker_id:'w2',created_at:1,updated_at:1})
  m.execution.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:'s',parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'w1',status:'ready',generation_at_spawn:m.continuation.generation})
  m.execution.workers.push({id:'w2',task_id:'t2',role:'coder',category:'standard',parent_session_id:'s',parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'w2',status:'ready',generation_at_spawn:m.continuation.generation})
  m.execution.blockers=['shared:blocker']
  rt.applyResult(m,'w1',{status:'DONE',summary:'fixed',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  assert.ok(m.execution.blockers.includes('shared:blocker'))
})

test('DONE worker open issues remain provenance and do not become mission blockers',()=>{
  const m=new MissionStore().start('s-done-info','finish bounded work')
  const task={id:'t-done',objective:'done',status:'running',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w-done',created_at:1,updated_at:1}
  const worker={id:'w-done',task_id:'t-done',role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'done',status:'busy',generation_at_spawn:m.continuation.generation}
  m.execution.tasks.push(task);m.execution.workers.push(worker)
  const rt=new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  rt.applyResult(m,'w-done',{status:'DONE',summary:'implementation done; parent verification remains',changed_files:[],evidence:[],open_issues:['parent verification still required'],needs_context:[]})
  assert.equal(task.result.status,'DONE');assert.deepEqual(task.result.open_issues,['parent verification still required']);assert.equal(m.execution.blockers.includes('parent verification still required'),false)
})

import {mkdirSync,writeFileSync,statSync} from 'node:fs'
import {dirname} from 'node:path'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'

test('noncanonical external-effect commands are rejected before native permission patterns can be bypassed',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-command-boundary-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-cmd'},{message:{role:'user'},parts:[{type:'text',text:'Prepare a release push'}]}); await assessPluginMission(hooks,'s-cmd',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',required_capabilities:['verification'],requested_external_actions:['git-push']})
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

test('parent direct progress cannot close unresolved repository analysis with prose',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-analysis-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-analysis'},{message:{role:'user'},parts:[{type:'text',text:'Fix the parser bug and verify it'}]});await assessPluginMission(hooks,'s-analysis',{task_kind:'bug-fix',scope:'local',ambiguity:'resolvable',dependency_class:'independent',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/parser.ts']})
    const empty=String(await hooks.tool.hi_direct_progress.execute({summary:'   ',obligation_id:'o-analysis'},{sessionID:'s-analysis'}));assert.match(empty,/non-empty bounded summary/)
    const wrong=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Root cause known.',obligation_id:'o-analysis:Root cause understood'},{sessionID:'s-analysis'}));assert.equal(wrong.reason,'unknown-obligation-id');assert.deepEqual(wrong.candidate_ids,['o-analysis','o-implementation'])
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Root cause isolated to the parser branch condition.',obligation_id:'o-analysis'},{sessionID:'s-analysis'}));assert.equal(result.status,'EVIDENCE_REQUIRED');assert.equal(result.reason,'repository-exploration-clearance-required');assert.equal(result.retry_same_call,false);assert.equal(result.ambiguity,'resolvable')
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:'s-analysis'}));const obligations=Object.fromEntries(ledger.obligations.map(o=>[o.id,o.status]));assert.equal(obligations['o-analysis'],'open');assert.equal(obligations['o-implementation'],'open');assert.equal(obligations['o-verification'],'open');assert.ok(ledger.events.some(e=>e.type==='analysis.direct-progress-rejected'&&e.payload?.reason==='repository-exploration-clearance-required'));assert.equal(ledger.events.some(e=>e.type==='analysis.direct-progress'),false)
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('parent direct progress may close analysis after repository ambiguity is already resolved',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-analysis-resolved-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-analysis-resolved'},{message:{role:'user'},parts:[{type:'text',text:'Fix the parser bug and verify it'}]});await assessPluginMission(hooks,'s-analysis-resolved',{task_kind:'bug-fix',scope:'local',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/parser.ts']})
    const mission=JSON.parse(await hooks.tool.hi_ledger.execute({limit:50},{sessionID:'s-analysis-resolved'}));assert.equal(mission.obligations.some(o=>o.id==='o-analysis'),false,'resolved local bug fix does not manufacture analysis ownership')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('direct progress on o-verification returns EVIDENCE_REQUIRED and cannot close verification with prose',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-verification-owned-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-verification-owned'},{message:{role:'user'},parts:[{type:'text',text:'Verify the focused behavior'}]});await assessPluginMission(hooks,'s-verification-owned',{task_kind:'review',required_capabilities:['review','verification'],likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'I checked it manually and it is fine.',obligation_id:'o-verification'},{sessionID:'s-verification-owned'}))
    assert.equal(result.status,'EVIDENCE_REQUIRED');assert.equal(result.reason,'verification-is-evidence-owned');assert.equal(result.obligation_id,'o-verification');assert.equal(result.retry_same_call,false);assert.ok(result.missing_kinds.includes('review-evidence'))
    const beforeFence=JSON.parse(await hooks.tool.hi_ledger.execute({limit:120},{sessionID:'s-verification-owned'}));assert.equal(beforeFence.stagnation_count,0)
    const fenced=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'I checked it manually and it is fine.',obligation_id:'o-verification'},{sessionID:'s-verification-owned'}));assert.equal(fenced.status,'STAGNATION_FENCED');assert.equal(fenced.reason,'repeated-verification-direct-progress-no-gain');assert.equal(fenced.retry_same_call,false)
    const afterFence=JSON.parse(await hooks.tool.hi_ledger.execute({limit:140},{sessionID:'s-verification-owned'}));assert.equal(afterFence.stagnation_count,1);const rejectionEvents=afterFence.events.filter(e=>e.type==='verification.direct-progress-rejected');assert.equal(rejectionEvents.length,2);assert.equal(new Set(rejectionEvents.map(e=>e.payload?.progress_signature)).size,1)
    const third=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'I checked it manually and it is fine.',obligation_id:'o-verification'},{sessionID:'s-verification-owned'}));assert.equal(third.status,'STAGNATION_FENCED');const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:160},{sessionID:'s-verification-owned'}));assert.equal(ledger.stagnation_count,1);assert.equal(ledger.events.filter(e=>e.type==='verification.direct-progress-rejected').length,2);const verify=ledger.obligations.find(o=>o.id==='o-verification');assert.equal(verify.status,'open')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('review-evidence-only verification handle collapses to direct review after fresh review input',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-review-alias-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-review-alias'},{message:{role:'user'},parts:[{type:'text',text:'Review src/a.ts read-only for correctness'}]});await assessPluginMission(hooks,'s-review-alias',{task_kind:'review',scope:'local',risk:'low',required_capabilities:['review','verification'],likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
    const beforeReview=JSON.parse(await hooks.tool.hi_readiness.execute({},{sessionID:'s-review-alias'}));assert.equal(beforeReview.items.find(x=>x.id==='gate-reviewer')?.status,'not-applicable');assert.equal(beforeReview.items.find(x=>x.id==='gate-verification')?.status,'waiting')
    await hooks['tool.execute.after']({sessionID:'s-review-alias',tool:'read',args:{filePath:'src/a.ts'}},'const x = 1')
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Reviewed src/a.ts; no correctness findings.',obligation_id:'o-verification'},{sessionID:'s-review-alias'}))
    assert.equal(result.status,'RECORDED');assert.equal(result.completion_ready,true);assert.equal(result.mission_status,'completed');assert.equal(result.next,'STOP');assert.deepEqual(result.remaining_obligations,[])
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:120},{sessionID:'s-review-alias'}));assert.equal(ledger.status,'completed');assert.ok(ledger.obligations.every(o=>o.status==='closed'));assert.ok(ledger.events.some(e=>e.type==='review.direct-progress'));assert.ok(ledger.events.some(e=>e.type==='verification.pass'&&e.payload?.kind==='review-evidence'));assert.ok(ledger.events.some(e=>e.type==='mission.completed'))
    const redundant=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Already complete.',obligation_id:'o-review'},{sessionID:'s-review-alias'}));assert.equal(redundant.status,'ALREADY_COMPLETED');assert.equal(redundant.completion_ready,true);assert.equal(redundant.mission_status,'completed');assert.equal(redundant.next,'STOP')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('completed mission ignores late host progress events while a new user message starts a fresh mission',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-terminal-host-event-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    const sid='s-terminal-host-event'
    await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Review src/a.ts read-only for correctness'}]});await assessPluginMission(hooks,sid,{task_kind:'review',scope:'local',risk:'low',required_capabilities:['review','verification'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
    await hooks['tool.execute.after']({sessionID:sid,tool:'read',args:{filePath:'src/a.ts'}},'const x = 1')
    const done=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Reviewed src/a.ts; no correctness findings.',obligation_id:'o-verification'},{sessionID:sid}));assert.equal(done.next,'STOP')
    const terminal=JSON.parse(await hooks.tool.hi_ledger.execute({limit:200},{sessionID:sid}));const terminalEventCount=terminal.events.length,terminalMissionID=terminal.mission_id
    await hooks.event({event:{type:'session.diff',properties:{sessionID:sid,diff:[{file:'src/a.ts',before:'const x = 1',after:'const x = 2'}]}}})
    await hooks.event({event:{type:'session.idle',properties:{sessionID:sid}}})
    const afterLate=JSON.parse(await hooks.tool.hi_ledger.execute({limit:200},{sessionID:sid}));assert.equal(afterLate.status,'completed');assert.equal(afterLate.mission_id,terminalMissionID);assert.equal(afterLate.events.length,terminalEventCount);assert.ok(afterLate.obligations.every(o=>o.status==='closed'));assert.equal(afterLate.evidence.fresh,true);assert.ok(!afterLate.events.some(e=>e.type==='file.changed'&&e.at>terminal.events.at?.(-1)?.at))
    await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Now update src/a.ts to use x = 2'}]})
    const fresh=JSON.parse(await hooks.tool.hi_ledger.execute({limit:200},{sessionID:sid}));assert.notEqual(fresh.mission_id,terminalMissionID);assert.equal(fresh.status,'active')
    await assessPluginMission(hooks,sid,{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation'],likely_verification:[],likely_targets:['src/a.ts']})
    await hooks.event({event:{type:'session.diff',properties:{sessionID:sid,diff:[{file:'src/a.ts',before:'const x = 1',after:'const x = 2'}]}}})
    const active=JSON.parse(await hooks.tool.hi_ledger.execute({limit:200},{sessionID:sid}));assert.ok(active.events.some(e=>e.type==='file.changed'));assert.equal(active.status,'active')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('explicit technical verifier never aliases to direct review even after fresh review input',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-review-explicit-verifier-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-review-explicit'},{message:{role:'user'},parts:[{type:'text',text:'Review src/a.ts read-only and run `node --test test/a.test.mjs`.'}]});await assessPluginMission(hooks,'s-review-explicit',{task_kind:'review',scope:'local',risk:'low',required_capabilities:['review','verification'],likely_verification:['targeted-tests','typecheck'],likely_targets:['src/a.ts']})
    await hooks['tool.execute.after']({sessionID:'s-review-explicit',tool:'read',args:{filePath:'src/a.ts'}},'const x = 1')
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'The read looks correct.',obligation_id:'o-verification'},{sessionID:'s-review-explicit'}))
    assert.equal(result.status,'EVIDENCE_REQUIRED');assert.deepEqual(result.required_kinds,['targeted-tests']);assert.deepEqual(result.missing_kinds,['targeted-tests'])
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('fresh verification cannot bypass unresolved repository analysis clearance',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-analysis-after-verify-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-analysis-after-verify'},{message:{role:'user'},parts:[{type:'text',text:'Fix the parser bug and run the focused test'}]});await assessPluginMission(hooks,'s-analysis-after-verify',{task_kind:'bug-fix',scope:'local',risk:'low',ambiguity:'resolvable',dependency_class:'independent',required_capabilities:['repository-analysis','implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/parser.ts']})
    await hooks['tool.execute.after']({sessionID:'s-analysis-after-verify',tool:'bash',args:{command:'bun test test/parser.test.ts'}},{stdout:'3 pass\n0 fail',metadata:{exit:0}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Root cause is proven by the focused regression test.',obligation_id:'o-analysis'},{sessionID:'s-analysis-after-verify'}))
    assert.equal(result.status,'EVIDENCE_REQUIRED');assert.equal(result.reason,'repository-exploration-clearance-required');assert.equal(result.retry_same_call,false)
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:'s-analysis-after-verify'}));const obligations=Object.fromEntries(ledger.obligations.map(o=>[o.id,o.status]));assert.equal(obligations['o-analysis'],'open');assert.equal(obligations['o-implementation'],'open');assert.equal(obligations['o-verification'],'closed')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('parent direct progress cannot close implementation from an unrelated changed file',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-owned-'))
  try{
    const c=client();c.session.diff=async()=>({data:[{file:'docs/unrelated.md'}]})
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-owned'},{message:{role:'user'},parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]}); await assessPluginMission(hooks,'s-owned',{likely_targets:['src/a.ts']})
    await hooks['tool.execute.before']({sessionID:'s-owned',tool:'write'},{args:{filePath:'docs/unrelated.md'}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'done'},{sessionID:'s-owned'}))
    assert.equal(result.status,'BLOCKED');assert.deepEqual(result.collateral,['docs/unrelated.md'])
    assert.match(String(await hooks.tool.hi_status.execute({},{sessionID:'s-owned'})),/2 obligation open/)
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('parent direct progress closes multi-target implementation only after every user-grounded required target is covered',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-required-targets-'))
  try{
    const c=client();c.session.diff=async()=>({data:[{file:'src/a.ts'},{file:'src/b.ts'}]})
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    const sid='s-required-targets'
    await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Change src/a.ts and src/b.ts. Both are required. Run node --test test/a.test.ts.'}]})
    await assessPluginMission(hooks,sid,{task_kind:'implementation',scope:'multi-file',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/a.ts','src/b.ts']})
    await hooks['tool.execute.before']({sessionID:sid,tool:'edit'},{args:{filePath:'src/a.ts'}})
    await hooks['tool.execute.before']({sessionID:sid,tool:'edit'},{args:{filePath:'src/b.ts'}})
    await hooks['tool.execute.after']({sessionID:sid,tool:'bash',args:{command:'node --test test/a.test.ts'}},{stdout:'1 pass\n0 fail',metadata:{exit:0}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Both required implementation targets are changed.',obligation_id:'o-implementation'},{sessionID:sid}))
    assert.equal(result.status,'RECORDED');assert.equal(result.completion_ready,true);assert.equal(result.mission_status,'completed');assert.equal(result.next,'STOP');assert.deepEqual(new Set(result.changed_files),new Set(['src/a.ts','src/b.ts']))
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:120},{sessionID:sid}))
    assert.equal(ledger.status,'completed');assert.ok(ledger.obligations.every(o=>o.status==='closed'));assert.ok(!ledger.events.some(e=>e.type==='implementation.required-targets-uncovered'))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('parent direct progress uses the OpenCode working directory as local evidence root even when the parent worktree ignores it',async()=>{
  const worktree=mkdtempSync(join(tmpdir(),'hi-direct-worktree-root-')),directory=join(worktree,'.agent-work','local-project')
  try{
    mkdirSync(directory,{recursive:true});writeFileSync(join(worktree,'.gitignore'),'.agent-work/\n')
    for(const args of [['init','-q'],['config','user.name','Hi Test'],['config','user.email','hi@example.invalid'],['add','.gitignore'],['commit','-qm','baseline']]){const r=spawnSync('git',['-C',worktree,...args],{encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??''))}
    const c=client();delete c.session.diff
    const hooks=await HiPlugin({directory,worktree,project:{vcs:'git'},client:c});await hooks.config({})
    const sid='s-working-root';await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Create index.html only'}]});await assessPluginMission(hooks,sid,{task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],likely_targets:['index.html'],likely_verification:[]})
    writeFileSync(join(directory,'index.html'),'<!doctype html><canvas></canvas>\n');await hooks['tool.execute.before']({sessionID:sid,tool:'write'},{args:{filePath:join(directory,'index.html')}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Created the requested single-file HTML.',obligation_id:'o-implementation'},{sessionID:sid}))
    assert.equal(result.status,'RECORDED',JSON.stringify(result));assert.deepEqual(result.changed_files,['index.html'])
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid}));assert.ok(ledger.events.some(e=>e.type==='implementation.current-diff-reconciled'&&['working-directory-current-files','git-status-plus-ignored-working-files'].includes(e.payload?.source)))
    await hooks.dispose?.()
  }finally{rmSync(worktree,{recursive:true,force:true})}
})

test('parent direct progress preserves file-aware writes inside an ignored local project even when native session diff is empty',async()=>{
  const repo=mkdtempSync(join(tmpdir(),'hi-direct-ignored-native-diff-')),directory=join(repo,'test-lab','runtime','scenario','workspace')
  try{
    mkdirSync(directory,{recursive:true});writeFileSync(join(repo,'.gitignore'),'test-lab/runtime/*\n')
    for(const args of [['init','-q'],['config','user.name','Hi Test'],['config','user.email','hi@example.invalid'],['add','.gitignore'],['commit','-qm','baseline']]){const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??''))}
    const c=client();c.session.diff=async()=>({data:[]})
    const hooks=await HiPlugin({directory,worktree:directory,project:{vcs:'git'},client:c});await hooks.config({})
    const sid='s-ignored-native-diff';await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Create app.py and README.md'}]});await assessPluginMission(hooks,sid,{task_kind:'implementation',scope:'multi-file',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],likely_targets:['app.py','README.md'],likely_verification:[]})
    for(const [file,body] of [['app.py','print("ok")\n'],['README.md','# app\n']]){writeFileSync(join(directory,file),body);await hooks['tool.execute.before']({sessionID:sid,tool:'write'},{args:{filePath:join(directory,file)}})}
    const status=spawnSync('git',['-C',directory,'status','--porcelain=v1','--untracked-files=all'],{encoding:'utf8'});assert.equal(status.status,0);assert.equal(status.stdout,'','ignored local project must be invisible to ordinary Git status')
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Created both requested ignored-local files.',obligation_id:'o-implementation'},{sessionID:sid}))
    assert.equal(result.status,'RECORDED',JSON.stringify(result));assert.deepEqual(new Set(result.changed_files),new Set(['app.py','README.md']))
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:120},{sessionID:sid}));assert.ok(ledger.events.some(e=>e.type==='implementation.current-diff-reconciled'&&e.payload?.source==='git-status-plus-ignored-working-files'))
    await hooks.dispose?.()
  }finally{rmSync(repo,{recursive:true,force:true})}
})

test('parent direct progress normalizes native absolute project paths before ownership comparison',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-absolute-path-'))
  try{
    const absolute=join(root,'src','a.ts'),c=client();c.session.diff=async()=>({data:[{file:absolute}]})
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-absolute'},{message:{role:'user'},parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]});await assessPluginMission(hooks,'s-absolute',{likely_targets:['src/a.ts']})
    await hooks['tool.execute.before']({sessionID:'s-absolute',tool:'write'},{args:{filePath:absolute}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'done'},{sessionID:'s-absolute'}))
    assert.equal(result.status,'RECORDED');assert.deepEqual(result.changed_files,['src/a.ts'])
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:'s-absolute'}))
    assert.ok(!ledger.events.some(e=>e.type==='implementation.direct-progress-blocked'))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('parent direct ownership reconciles a reverted historical file through read-only Git when native session diff is unavailable',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-git-fallback-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});mkdirSync(join(root,'docs'),{recursive:true})
    writeFileSync(join(root,'src','a.ts'),'before\n');writeFileSync(join(root,'docs','temp.md'),'before\n')
    for(const args of [['init','-q'],['config','user.name','Hi Test'],['config','user.email','hi@example.invalid'],['add','-A'],['commit','-qm','baseline']]){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??''))}
    const c=client();delete c.session.diff
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-git-fallback'},{message:{role:'user'},parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]});await assessPluginMission(hooks,'s-git-fallback',{likely_targets:['src/a.ts']})
    writeFileSync(join(root,'src','a.ts'),'after\n');await hooks['tool.execute.before']({sessionID:'s-git-fallback',tool:'write'},{args:{filePath:'src/a.ts'}})
    writeFileSync(join(root,'docs','temp.md'),'temporary\n');await hooks['tool.execute.before']({sessionID:'s-git-fallback',tool:'write'},{args:{filePath:'docs/temp.md'}})
    writeFileSync(join(root,'docs','temp.md'),'before\n');await hooks['tool.execute.before']({sessionID:'s-git-fallback',tool:'write'},{args:{filePath:'docs/temp.md'}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'final owned change only'},{sessionID:'s-git-fallback'}))
    assert.equal(result.status,'RECORDED');assert.deepEqual(result.changed_files,['src/a.ts'])
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:'s-git-fallback'}))
    assert.ok(ledger.events.some(e=>e.type==='implementation.current-diff-reconciled'&&e.payload?.source==='git-status-fallback'))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('parent direct progress stays blocked when every observed mutation was reverted',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-fully-reverted-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'before\n')
    for(const args of [['init','-q'],['config','user.name','Hi Test'],['config','user.email','hi@example.invalid'],['add','-A'],['commit','-qm','baseline']]){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??''))}
    const c=client();delete c.session.diff
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-fully-reverted'},{message:{role:'user'},parts:[{type:'text',text:'Update src/a.ts'}]});await assessPluginMission(hooks,'s-fully-reverted',{likely_targets:['src/a.ts']})
    writeFileSync(join(root,'src','a.ts'),'after\n');await hooks['tool.execute.before']({sessionID:'s-fully-reverted',tool:'write'},{args:{filePath:'src/a.ts'}})
    writeFileSync(join(root,'src','a.ts'),'before\n');await hooks['tool.execute.before']({sessionID:'s-fully-reverted',tool:'write'},{args:{filePath:'src/a.ts'}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'nothing remains'},{sessionID:'s-fully-reverted'}))
    assert.equal(result.status,'BLOCKED');assert.equal(result.reason,'no-current-owned-diff')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('bounded DIRECT bugfix completes from current owned diff plus fresh post-mutation required verification without progress ceremony',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-evidence-completion-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});mkdirSync(join(root,'test'),{recursive:true})
    writeFileSync(join(root,'src','a.ts'),'export const value = 1\n');writeFileSync(join(root,'test','a.test.ts'),'// fixed regression fixture\n')
    for(const args of [['init','-q'],['config','user.name','Hi Test'],['config','user.email','hi@example.invalid'],['add','-A'],['commit','-qm','baseline']]){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??''))}
    const c=client();delete c.session.diff
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    const sid='s-direct-evidence-completion'
    await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Fix src/a.ts. Run `bun test test/a.test.ts` and stop when it passes.'}]})
    await assessPluginMission(hooks,sid,{task_kind:'bug-fix',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests','typecheck'],likely_targets:['src/a.ts'],intent_signals:[]})
    const before=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid}));assert.ok(!before.obligations.some(o=>o.id==='o-analysis'));assert.deepEqual(before.obligations.filter(o=>o.kind==='verification').map(o=>o.summary),['targeted-tests'])
    writeFileSync(join(root,'src','a.ts'),'export const value = 2\n');await hooks['tool.execute.before']({sessionID:sid,tool:'edit'},{args:{filePath:'src/a.ts'}})
    await hooks['tool.execute.after']({sessionID:sid,tool:'bash',args:{command:'bun test test/a.test.ts'}},{stdout:'1 pass\n0 fail',metadata:{exit:0}})
    const after=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid}));assert.equal(after.status,'completed');assert.ok(after.obligations.every(o=>o.status==='closed'));assert.ok(after.events.some(e=>e.type==='implementation.direct-evidence-reconciled'&&e.payload?.source==='current-git-diff+fresh-required-verification'));assert.ok(after.events.some(e=>e.type==='mission.completed'));assert.ok(!after.events.some(e=>e.type==='implementation.direct-progress'))
    const redundant=JSON.parse(await hooks.tool.hi_direct_progress.execute({input:{obligation_id:'o-verification',summary:'already done'}},{sessionID:sid}));assert.equal(redundant.status,'ALREADY_COMPLETED');assert.equal(redundant.completion_ready,true);assert.deepEqual(redundant.remaining_obligations,[])
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('DIRECT evidence reconciliation cannot substitute an automatically related sibling test for the required implementation target',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-evidence-required-target-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'export const value = 1\n');writeFileSync(join(root,'src','a.test.ts'),'// baseline test\n')
    for(const args of [['init','-q'],['config','user.name','Hi Test'],['config','user.email','hi@example.invalid'],['add','-A'],['commit','-qm','baseline']]){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??''))}
    const c=client();delete c.session.diff
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({});const sid='s-direct-evidence-required-target'
    await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Update src/a.ts and run node --test src/a.test.ts.'}]});await assessPluginMission(hooks,sid,{task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
    writeFileSync(join(root,'src','a.test.ts'),'// changed test only\n');await hooks['tool.execute.before']({sessionID:sid,tool:'edit'},{args:{filePath:'src/a.test.ts'}})
    await hooks['tool.execute.after']({sessionID:sid,tool:'bash',args:{command:'node --test src/a.test.ts'}},{stdout:'1 pass\n0 fail',metadata:{exit:0}})
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:140},{sessionID:sid}));assert.equal(ledger.status,'active');assert.ok(ledger.obligations.some(o=>o.kind==='implementation'&&o.status==='open'));assert.ok(ledger.obligations.some(o=>o.kind==='verification'&&o.status==='closed'));assert.ok(!ledger.events.some(e=>e.type==='implementation.direct-evidence-reconciled'));assert.ok(ledger.events.some(e=>e.type==='implementation.required-targets-uncovered'&&e.payload?.owner==='parent-direct-evidence'&&e.payload?.missing?.includes('src/a.ts')))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('DIRECT evidence reconciliation does not complete when required verification predates the mutation',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-evidence-ordering-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});mkdirSync(join(root,'test'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'before\n');writeFileSync(join(root,'test','a.test.ts'),'// fixture\n')
    for(const args of [['init','-q'],['config','user.name','Hi Test'],['config','user.email','hi@example.invalid'],['add','-A'],['commit','-qm','baseline']]){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??''))}
    const c=client();delete c.session.diff
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({});const sid='s-direct-evidence-ordering'
    await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Fix src/a.ts. Run `bun test test/a.test.ts`.'}]});await assessPluginMission(hooks,sid,{task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
    await hooks['tool.execute.after']({sessionID:sid,tool:'bash',args:{command:'bun test test/a.test.ts'}},{stdout:'1 pass',metadata:{exit:0}})
    writeFileSync(join(root,'src','a.ts'),'after\n');await hooks['tool.execute.before']({sessionID:sid,tool:'edit'},{args:{filePath:'src/a.ts'}})
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid}));assert.notEqual(ledger.status,'completed');assert.ok(ledger.obligations.some(o=>o.kind==='implementation'&&o.status==='open'));assert.ok(ledger.obligations.some(o=>o.kind==='verification'&&o.status==='open'));assert.ok(!ledger.events.some(e=>e.type==='implementation.direct-evidence-reconciled'))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('read-only manager cannot close implementation through hi_direct_progress even if mutation evidence is observed',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-manager-authority-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({hi:{primaryMode:'manager'}})
    await hooks['chat.message']({sessionID:'s-manager-direct',agent:'manager'},{message:{role:'user'},parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]});await assessPluginMission(hooks,'s-manager-direct',{likely_targets:['src/a.ts']})
    await assert.rejects(()=>hooks['tool.execute.before']({sessionID:'s-manager-direct',tool:'write'},{args:{filePath:'src/a.ts'}}),/direct mutation authority guard/)
    const result=String(await hooks.tool.hi_direct_progress.execute({summary:'done'},{sessionID:'s-manager-direct'}))
    assert.match(result,/primary role manager lacks canonical repository write authority/)
    assert.match(String(await hooks.tool.hi_status.execute({},{sessionID:'s-manager-direct'})),/[1-9] obligation open/)
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:'s-manager-direct'}))
    assert.ok(!ledger.events.some(e=>e.type==='implementation.direct-progress'))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('automatically related sibling test is allowed scope but cannot substitute for the required implementation target',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-related-'))
  const c=client();c.session.diff=async()=>({data:[{file:'src/a.test.ts'}]})
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-related'},{message:{role:'user'},parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]}); await assessPluginMission(hooks,'s-related',{likely_targets:['src/a.ts']})
    await hooks['tool.execute.before']({sessionID:'s-related',tool:'write'},{args:{filePath:'src/a.test.ts'}})
    const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'implemented with focused test'},{sessionID:'s-related'}))
    assert.equal(result.status,'BLOCKED');assert.equal(result.reason,'required-targets-uncovered');assert.deepEqual(result.missing_targets,['src/a.ts']);assert.deepEqual(result.changed_files,['src/a.test.ts'])
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:'s-related'}));assert.ok(!ledger.events.some(e=>e.type==='implementation.direct-progress-blocked'&&e.payload?.reason==='changed-files-outside-requested-scope'));assert.ok(ledger.events.some(e=>e.type==='implementation.required-targets-uncovered'))
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('parent direct ownership ignores an observed file that native current diff proves was reverted',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-reverted-'))
  const c=client();c.session.diff=async()=>({data:[{file:'src/a.ts'}]})
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-reverted'},{message:{role:'user'},parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]}); await assessPluginMission(hooks,'s-reverted',{likely_targets:['src/a.ts']})
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
  for(const command of mutators){const m=new MissionStore().start(command,'Update src/a.ts');addEvidence(m,{kind:'changed-surface-sanity',summary:'old proof',source:'test',pass:true,outcome:'passed'});assert.equal(m.execution.evidence.fresh,true);observeToolBefore(m,'bash',{command});assert.equal(m.execution.evidence.fresh,false,command)}
  const readOnly=new MissionStore().start('read-only','Update src/a.ts');addEvidence(readOnly,{kind:'changed-surface-sanity',summary:'old proof',source:'test',pass:true,outcome:'passed'});observeToolBefore(readOnly,'bash',{command:'git status --porcelain'});assert.equal(readOnly.execution.evidence.fresh,true)
})

test('path-unknown bash mutation cannot be used as direct implementation ownership proof',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-unknown-surface-'))
  try{
    writeFileSync(join(root,'.gitignore'),'.opencode/\n')
    for(const args of [['init','-q'],['config','user.name','Hi Test'],['config','user.email','hi@example.invalid'],['add','.gitignore'],['commit','-qm','baseline']]){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??''))}
    const hooks=await HiPlugin({directory:root,worktree:root,project:{vcs:'git'},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-unknown'},{message:{role:'user'},parts:[{type:'text',text:'Update src/a.ts to add a greeting'}]}); await assessPluginMission(hooks,'s-unknown',{likely_targets:['src/a.ts']})
    await hooks['tool.execute.before']({sessionID:'s-unknown',tool:'bash'},{args:{command:'printf x > src/a.ts'}})
    const result=String(await hooks.tool.hi_direct_progress.execute({summary:'done'},{sessionID:'s-unknown'}))
    assert.match(result,/no current Git changed surface exists/)
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('direct progress accepts native nested input shape and a semantic label when exactly one review obligation is open',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-direct-native-shape-'))
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config({})
    await hooks['chat.message']({sessionID:'s'},{message:{role:'user'},parts:[{type:'text',text:'Review src/a.ts for correctness'}]}); await assessPluginMission(hooks,'s',{task_kind:'review',required_capabilities:['review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
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
    await hooks['chat.message']({sessionID:'s-independent'},{message:{role:'user'},parts:[{type:'text',text:'Perform an independent review of src/a.ts for correctness'}]}); await assessPluginMission(hooks,'s-independent',{task_kind:'review',required_capabilities:['review','independent-review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
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

test('explicit JSON WorkerResult fence wins over an earlier diff fence and drops invalid proof shape',()=>{
  const text='Implementation complete. Diff:\n\n```diff\n--- src/alpha.js\n+++ src/alpha.js\n@@\n export function double(n){\n-  return n*3\n+  return n*2\n }\n```\n\nVerification deferred to parent.\n\n```json\n{\n  "status":"DONE",\n  "summary":"Changed alpha minimally.",\n  "changed_files":["src/alpha.js"],\n  "scope_expansions":[],\n  "evidence":{"kind":"implementation-complete","detail":"not a canonical evidence array"},\n  "open_issues":["Parent verification required."],\n  "needs_context":null,\n  "context_gap":"none",\n  "failure_finding":"none"\n}\n```'
  const result=parseWorkerResult(text)
  assert.equal(result.status,'DONE');assert.equal(result.summary,'Changed alpha minimally.');assert.deepEqual(result.changed_files,['src/alpha.js'])
  assert.deepEqual(result.evidence,[],'schema-invalid evidence object must not be promoted to proof');assert.deepEqual(result.needs_context,[]);assert.deepEqual(result.open_issues,['Parent verification required.'])
})

test('real-host labeled WorkerResult fallback recovers state without promoting narrative evidence to proof',()=>{
  const text='WorkerResult:\n\n- **status**: DONE\n- **summary**: Fixed src/alpha.js with the smallest production change.\n- **changed_files**: `["src/alpha.js"]`\n- **scope_expansions**: `[]`\n- **evidence**:\n  - kind: `targeted-tests`, outcome: omitted because parent verification remains open\n  - kind: `code-change`, summary: observed via read after edit\n- **open_issues**: Test execution requires parent/control-plane verification.\n- **needs_context**: none\n- **context_gap**: none\n- **failure_finding**: none'
  const result=parseWorkerResult(text)
  assert.equal(result.status,'DONE');assert.equal(result.summary,'Fixed src/alpha.js with the smallest production change.');assert.deepEqual(result.changed_files,['src/alpha.js']);assert.deepEqual(result.scope_expansions,[])
  assert.deepEqual(result.evidence,[],'narrative markdown evidence must never become canonical proof')
  assert.deepEqual(result.open_issues,['Test execution requires parent/control-plane verification.']);assert.deepEqual(result.needs_context,[]);assert.equal(result.context_gap,'none');assert.equal(result.failure_finding,'none')
})

test('labeled WorkerResult fallback requires the explicit WorkerResult marker and does not accept free-text PASS prose',()=>{
  assert.equal(parseWorkerResult('- **status**: DONE\n- **summary**: looks fine').status,'FAILED')
  assert.equal(parseWorkerResult('Review looks good; PASS overall').status,'FAILED')
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
    await hooks['chat.message']({sessionID:'s-bash-review'},{message:{role:'user'},parts:[{type:'text',text:'Run pwd once and report the current directory. Do not modify files.'}]}); await assessPluginMission(hooks,'s-bash-review',{task_kind:'review',required_capabilities:['review'],likely_verification:['review-evidence']})
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
    await hooks['chat.message']({sessionID:'s-skill-review'},{message:{role:'user'},parts:[{type:'text',text:'Load the hi-test-strategy skill and summarize it. Do not modify files.'}]}); await assessPluginMission(hooks,'s-skill-review',{task_kind:'review',required_capabilities:['review'],likely_verification:['review-evidence'],intent_signals:['intent.test-strategy']})
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
  const c=client();c.session.diff=async()=>({data:[{file:'src/a.ts'}]})
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    await hooks['chat.message']({sessionID:'s-parent-method'},{message:{role:'user'},parts:[{type:'text',text:'Refactor src/a.ts without changing behavior'}]}); await assessPluginMission(hooks,'s-parent-method',{likely_targets:['src/a.ts'],likely_verification:['targeted-tests'],intent_signals:['intent.refactor']})
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


test('worker evidence compatibility normalizes refs/description aliases without bypassing canonical evidence validation',()=>{
  const result=parseWorkerResult(JSON.stringify({status:'DONE',summary:'visual pass',changed_files:[],evidence:[{kind:'visual-evidence',outcome:'passed',description:'browser state verified',refs:['ev_a','ev_a','ev_b']}],open_issues:[],needs_context:[]}))
  assert.equal(result.status,'DONE');assert.equal(result.evidence.length,1);assert.equal(result.evidence[0].summary,'browser state verified');assert.deepEqual(result.evidence[0].evidence_refs,['ev_a','ev_b']);assert.equal(result.evidence[0].outcome,'passed')
})


test('direct progress recovers current Git changed surface after mutating shell when file event attribution is delayed',async()=>{
  const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {spawnSync}=await import('node:child_process');const HiPlugin=(await import('../dist/plugin.js')).default
  const root=mkdtempSync(join(tmpdir(),'hi-shell-surface-'));mkdirSync(join(root,'.opencode'),{recursive:true});writeFileSync(join(root,'.gitignore'),'.opencode/\n')
  for(const args of [['init','-q'],['config','user.name','Hi Test'],['config','user.email','hi@example.invalid'],['add','.gitignore'],['commit','-qm','baseline']]){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??''))}
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{diff:async()=>({data:[]}),create:async()=>({data:{id:'child'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:true})}}
  try{const hooks=await HiPlugin({directory:root,worktree:root,project:{vcs:'git'},client});await hooks.config({});const sid='shell-surface';await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text:'Create index.html only'}]});const {assessPluginMission}=await import('./helpers/semantic.mjs');await assessPluginMission(hooks,sid,{task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],likely_targets:['index.html'],likely_verification:[]});await hooks['tool.execute.before']({sessionID:sid,tool:'bash'},{args:{command:"cat > index.html <<'EOF'\n<html></html>\nEOF"}});writeFileSync(join(root,'index.html'),'<html></html>\n');const result=JSON.parse(await hooks.tool.hi_direct_progress.execute({summary:'Created index.html',obligation_id:'o-implementation'},{sessionID:sid}));assert.equal(result.status,'RECORDED',JSON.stringify(result));assert.deepEqual(result.changed_files,['index.html']);const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid}));assert.ok(ledger.events.some(e=>e.type==='implementation.changed-surface-recovered'&&e.payload?.files?.includes('index.html')));await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})
