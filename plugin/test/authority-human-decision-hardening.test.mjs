import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {AUTHORITY_APPROVAL_TTL_MS,approvePendingAuthority,beginAuthorizedAction,claimAuthorizedAction,requireAuthority} from '../dist/runtime/safety/authority.js'
import {ProjectAuthorityStore,applyProjectAuthorityPermissions} from '../dist/runtime/safety/project-authority.js'
import {authorityProtocolResponse} from './helpers/authority.mjs'

function mission(id){return new MissionStore().start(id,'authority hardening probe')}

test('different exact action cannot overwrite an unresolved executing authority slot',()=>{
  const m=mission('m13-executing')
  assert.throws(()=>requireAuthority(m,'git push origin main','/repo'),/approval required/i)
  assert.equal(approvePendingAuthority(m,authorityProtocolResponse(m,'approve')),true)
  beginAuthorizedAction(m,'git push origin main','/repo')
  const first=m.authority.authority.executing.hash
  assert.equal(claimAuthorizedAction(m,'gh release create v1.0.0','/repo'),'conflict')
  assert.throws(()=>beginAuthorizedAction(m,'gh release create v1.0.0','/repo'),/unresolved|conflict/i)
  assert.equal(m.authority.authority.executing.hash,first)
})

test('duplicate pending exact request preserves the original approval TTL',()=>{
  const m=mission('m13-ttl')
  assert.throws(()=>requireAuthority(m,'git push origin main','/repo'),/approval required/i)
  const decisionCreated=m.authority.human_decision.created_at
  const aged=Date.now()-AUTHORITY_APPROVAL_TTL_MS+1_000
  m.authority.authority.pending.created_at=aged
  assert.throws(()=>requireAuthority(m,'git push origin main','/repo'),/approval required/i)
  assert.equal(m.authority.authority.pending.created_at,aged)
  assert.equal(m.authority.human_decision.created_at,decisionCreated)
})

test('a different pending exact action conflicts instead of replacing authority identity',()=>{
  const m=mission('m13-pending-conflict')
  assert.throws(()=>requireAuthority(m,'git push origin main','/repo'),/approval required/i)
  const first=m.authority.authority.pending.hash
  const before=m.execution.obligations.filter(x=>x.kind==='authority').map(x=>x.id)
  assert.throws(()=>requireAuthority(m,'gh release create v1.0.0','/repo'),/another|pending|conflict/i)
  assert.equal(m.authority.authority.pending.hash,first)
  const after=m.execution.obligations.filter(x=>x.kind==='authority').map(x=>x.id)
  assert.equal(after.length,before.length+1,'durable requested-action obligations remain distinct while transient approval is serialized')
})

test('malformed persistent native-always authority state fails closed',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m13-authority-'))
  try{
    const policy=join(root,'.opencode','hi','policy');mkdirSync(policy,{recursive:true})
    writeFileSync(join(policy,'authority.json'),JSON.stringify({schema:1,grants:{'git-push':true}}))
    const store=new ProjectAuthorityStore(root)
    assert.equal(store.has('git-push'),false)
    const cfg={permission:{bash:{'*':'allow'}}};applyProjectAuthorityPermissions(cfg,store)
    assert.equal(cfg.permission.bash['git push *'],'ask')
  } finally {rmSync(root,{recursive:true,force:true})}
})
