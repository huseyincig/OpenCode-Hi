import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { assertSafeGitMutation,recordPreexistingUserBaseline,recordStagingInspection,recordGitStatusInspection } from '../dist/runtime/safety/staging-safety.js'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'
import { createToolAfterHook } from '../dist/hooks/tool-after.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function mission(){const store=new MissionStore('.'),sid=`s-${Math.random()}`,m=startAssessedMission(store,sid,'opaque implementation');return{store,m}}

test('broad staging is blocked when pre-existing user-owned dirty files exist',()=>{
  const {m}=mission();recordPreexistingUserBaseline(m,{'notes/user.md':'baseline-user'});m.vcs.changed_files=['src/a.ts']
  assert.throws(()=>assertSafeGitMutation(m,'git add -A'),/broad git staging is blocked/i)
  assert.throws(()=>assertSafeGitMutation(m,'git add .'),/broad git staging is blocked/i)
  assert.doesNotThrow(()=>assertSafeGitMutation(m,'git add src/a.ts'))
})

test('commit requires a fresh staged-set proof and rejects user or unrelated staged files',()=>{
  const {m}=mission();recordPreexistingUserBaseline(m,{'notes/user.md':'baseline-user'});m.vcs.changed_files=['src/a.ts','src/a.test.ts']
  assert.throws(()=>assertSafeGitMutation(m,'git commit -m "fix"'),/inspect the exact staged set/i)
  recordStagingInspection(m,'git diff --cached --name-only',{stdout:'src/a.ts\nnotes/user.md\n'})
  assert.throws(()=>assertSafeGitMutation(m,'git commit -m "fix"'),/outside Hi-owned delta/i)
  recordStagingInspection(m,'git diff --cached --name-only',{stdout:'src/a.ts\nsrc/unrelated.ts\n'})
  assert.throws(()=>assertSafeGitMutation(m,'git commit -m "fix"'),/outside Hi-owned delta/i)
  recordStagingInspection(m,'git diff --cached --name-only',{stdout:'src/a.ts\nsrc/a.test.ts\n'})
  assert.doesNotThrow(()=>assertSafeGitMutation(m,'git commit -m "fix"'))
})

test('commit -a and direct pathspec commit cannot bypass ownership verification',()=>{
  const {m}=mission();recordPreexistingUserBaseline(m,{'notes/user.md':'baseline-user'});m.vcs.changed_files=['src/a.ts'];recordStagingInspection(m,'git diff --cached --name-only',{stdout:'src/a.ts\n'})
  assert.throws(()=>assertSafeGitMutation(m,'git commit -am "fix"'),/commit -a|commit -a\/--all/i)
  assert.throws(()=>assertSafeGitMutation(m,'git commit -m "fix" -- src/a.ts'),/pathspec/i)
  assert.throws(()=>assertSafeGitMutation(m,'git commit --only src/a.ts -m "fix"'),/pathspec/i)
})

test('hook-level flow invalidates staged proof after index mutation and after commit',async()=>{
  const {store,m}=mission();m.vcs.changed_files=['src/a.ts']
  const before=createToolBeforeHook(store),after=createToolAfterHook(store)
  await after({sessionID:m.identity.session_id,tool:'bash',args:{command:'git diff --cached --name-only'}},{stdout:'src/a.ts\n',metadata:{exit:0}})
  assert.ok(m.vcs.staging_safety)
  await before({sessionID:m.identity.session_id,tool:'bash',args:{command:'git add src/a.ts'}},{args:{command:'git add src/a.ts'}})
  assert.equal(m.vcs.staging_safety,undefined)
  await after({sessionID:m.identity.session_id,tool:'bash',args:{command:'git diff --cached --name-only'}},{stdout:'src/a.ts\n',metadata:{exit:0}})
  await before({sessionID:m.identity.session_id,tool:'bash',args:{command:'git commit -m "fix"'}},{args:{command:'git commit -m "fix"'}})
  await after({sessionID:m.identity.session_id,tool:'bash',args:{command:'git commit -m "fix"'}},{stdout:'[main abc] fix',metadata:{exit:0}})
  assert.equal(m.vcs.staging_safety,undefined)
})

test('pre-existing user baseline is frozen once and later Hi worker deltas are not reclassified as user-owned',()=>{
  const {m}=mission();recordPreexistingUserBaseline(m,{'notes/user.md':'u1'})
  m.vcs.changed_files.push('src/a.ts')
  recordPreexistingUserBaseline(m,{'notes/user.md':'u1','src/a.ts':'hi-later'})
  assert.deepEqual(m.vcs.preexisting_user_changes,{'notes/user.md':'u1'})
  assert.equal(m.vcs.preexisting_user_baseline_captured,true)
})


test('branch topology mutation requires fresh clean worktree proof and blocks dirty or user-owned state',()=>{
  const {m}=mission()
  assert.throws(()=>assertSafeGitMutation(m,'git merge feature'),/git status --porcelain/i)
  recordGitStatusInspection(m,'git status --porcelain',{stdout:' M src/a.ts\n'})
  assert.throws(()=>assertSafeGitMutation(m,'git rebase main'),/worktree is not clean/i)
  recordGitStatusInspection(m,'git status --porcelain',{stdout:''})
  assert.doesNotThrow(()=>assertSafeGitMutation(m,'git merge feature'))
  const {m:m2}=mission();recordPreexistingUserBaseline(m2,{'notes/user.md':'dirty'})
  recordGitStatusInspection(m2,'git status --porcelain',{stdout:''})
  assert.throws(()=>assertSafeGitMutation(m2,'git switch release'),/pre-existing user changes/i)
})

test('merge/rebase mutation stales evidence and topology proof is one-shot',async()=>{
  const {store,m}=mission();m.execution.evidence.fresh=true;m.execution.evidence.items.push({id:'ev',kind:'targeted-tests',summary:'pass',scope:[],observed_at:Date.now(),pass:true,outcome:'passed'})
  const before=createToolBeforeHook(store),after=createToolAfterHook(store)
  await after({sessionID:m.identity.session_id,tool:'bash',args:{command:'git status --porcelain'}},{stdout:'',metadata:{exit:0}})
  assert.ok(m.vcs.git_topology_safety?.clean)
  await before({sessionID:m.identity.session_id,tool:'bash',args:{command:'git merge feature'}},{args:{command:'git merge feature'}})
  assert.equal(m.vcs.git_topology_safety,undefined)
  assert.equal(m.execution.evidence.fresh,false)
  assert.ok(m.vcs.git_topology_pending)
})

test('merge conflict staged files become topology-owned and can be committed without absorbing unrelated files',async()=>{
  const {store,m}=mission();const before=createToolBeforeHook(store),after=createToolAfterHook(store)
  await after({sessionID:m.identity.session_id,tool:'bash',args:{command:'git status --porcelain'}},{stdout:'',metadata:{exit:0}})
  await before({sessionID:m.identity.session_id,tool:'bash',args:{command:'git merge feature'}},{args:{command:'git merge feature'}})
  await after({sessionID:m.identity.session_id,tool:'bash',args:{command:'git merge feature'}},{stdout:'CONFLICT (content): Merge conflict in src/shared.ts',metadata:{exit:1}})
  assert.ok(m.execution.blockers.some(x=>x.startsWith('git-topology-conflict:')))
  await after({sessionID:m.identity.session_id,tool:'bash',args:{command:'git diff --cached --name-only'}},{stdout:'src/shared.ts\n',metadata:{exit:0}})
  assert.deepEqual(m.vcs.git_topology_owned_files,['src/shared.ts'])
  assert.doesNotThrow(()=>assertSafeGitMutation(m,'git commit -m "merge feature"'))
  recordStagingInspection(m,'git diff --cached --name-only',{stdout:'src/shared.ts\nnotes/user.md\n'})
  assert.throws(()=>assertSafeGitMutation(m,'git commit -m "merge feature"'),/outside Hi-owned delta/i)
})
