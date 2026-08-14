import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'
import { createToolAfterHook } from '../dist/hooks/tool-after.js'
import { resolveUncertainAuthority } from '../dist/runtime/safety/authority.js'

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim()}

test('real bare-remote push with lost ACK is not blindly retried and is reconciled by remote proof', async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-real-remote-'))
  const remote=join(root,'remote.git'), work=join(root,'work')
  execFileSync('git',['init','--bare',remote])
  execFileSync('git',['init','-b','main',work])
  git(work,'config','user.name','Hi Test'); git(work,'config','user.email','hi@example.invalid')
  execFileSync('sh',['-c','printf x > tracked.txt'],{cwd:work})
  git(work,'add','tracked.txt'); git(work,'commit','-m','initial'); git(work,'remote','add','origin',remote)

  const store=new MissionStore(root), m=startAssessedMission(store,'real-remote-session','push release',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',requested_external_actions:['git-push']})
  const before=createToolBeforeHook(store,undefined,work), after=createToolAfterHook(store,undefined,undefined,work)
  const cmd='git push origin main'
  await before({sessionID:m.identity.session_id,tool:'bash',args:{command:cmd,cwd:work}},{args:{command:cmd,cwd:work}})

  // The side effect really happens on a Git remote, but the host ACK is intentionally lost.
  const pushOut=git(work,'push','origin','main')
  await after({sessionID:m.identity.session_id,tool:'bash',args:{command:cmd,cwd:work}},{stdout:pushOut,metadata:{}})
  assert.equal(m.identity.status,'waiting-user')
  assert.equal(m.release.release_chain?.push?.outcome,'unknown')
  await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'bash',args:{command:cmd,cwd:work}},{args:{command:cmd,cwd:work}}),/already in-flight or completed/)

  const head=git(work,'rev-parse','HEAD')
  const remoteLine=git(work,'ls-remote','origin','refs/heads/main')
  assert.match(remoteLine,new RegExp('^'+head+'\\s+refs/heads/main$'))

  // Explicit user reconciliation closes the uncertain authority action; fresh native probes
  // then prove the exact remote ref rather than trusting the user's statement alone.
  assert.equal(resolveUncertainAuthority(m,'confirm action succeeded'),true)
  await after({sessionID:m.identity.session_id,tool:'bash',args:{command:'git rev-parse HEAD',cwd:work}},{stdout:head+'\n',metadata:{exit:0}})
  await after({sessionID:m.identity.session_id,tool:'bash',args:{command:'git ls-remote origin refs/heads/main',cwd:work}},{stdout:remoteLine+'\n',metadata:{exit:0}})
  assert.equal(m.release.release_chain?.push?.outcome,'success')
  assert.equal(m.release.release_chain?.push?.remote_verified,true)
  assert.equal(m.release.release_chain?.push?.remote_hash,head)
})

test('real bare-remote annotated tag exposes direct tag object and peeled commit hashes', ()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-real-tag-'))
  const remote=join(root,'remote.git'), work=join(root,'work')
  execFileSync('git',['init','--bare','--initial-branch=main',remote])
  execFileSync('git',['init','-b','main',work])
  git(work,'config','user.name','Hi Test'); git(work,'config','user.email','hi@example.invalid')
  execFileSync('sh',['-c','printf y > tracked.txt'],{cwd:work})
  git(work,'add','tracked.txt'); git(work,'commit','-m','release candidate'); git(work,'remote','add','origin',remote)
  git(work,'push','origin','main'); git(work,'tag','-a','v2.0.10','-m','v2.0.10'); git(work,'push','origin','v2.0.10')
  const head=git(work,'rev-parse','HEAD')
  const direct=git(work,'rev-parse','v2.0.10')
  assert.notEqual(direct,head,'annotated tag object SHA must differ from commit SHA')
  const lines=git(work,'ls-remote','origin','refs/tags/v2.0.10','refs/tags/v2.0.10^{}').split(/\r?\n/)
  const directLine=lines.find(x=>x.endsWith('refs/tags/v2.0.10'))
  const peeledLine=lines.find(x=>x.endsWith('refs/tags/v2.0.10^{}'))
  assert.equal(directLine?.split(/\s+/)[0],direct)
  assert.equal(peeledLine?.split(/\s+/)[0],head)
})
