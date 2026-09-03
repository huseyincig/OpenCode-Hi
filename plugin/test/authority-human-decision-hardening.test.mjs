import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {AUTHORITY_APPROVAL_TTL_MS,approvePendingAuthority,beginAuthorizedAction,claimAuthorizedAction,requireAuthority} from '../dist/runtime/safety/authority.js'
import {ProjectAuthorityStore,applyProjectAuthorityPermissions} from '../dist/runtime/safety/project-authority.js'
import {authorityProtocolResponse} from './helpers/authority.mjs'
import {startAssessedMission} from './helpers/semantic.mjs'

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

test('unclean restore preserves executing authority and opens one stable exact reconciliation decision',()=>{
  const source=new MissionStore(),command='git push origin main',cwd='/repo'
  const m=startAssessedMission(source,'authority-unclean-reconcile','publish current main',{task_kind:'implementation',scope:'external',risk:'authority-boundary',requested_external_actions:['git-push']})
  assert.throws(()=>requireAuthority(m,command,cwd),/approval required/i)
  assert.equal(approvePendingAuthority(m,authorityProtocolResponse(m,'approve')),true)
  beginAuthorizedAction(m,command,cwd)
  const hash=m.authority.authority.executing.hash
  const restored=new MissionStore();restored.restore([structuredClone(m)],true)
  const r=restored.get(m.identity.session_id)
  assert.equal(r.authority.authority.executing.hash,hash)
  assert.equal(r.identity.status,'waiting-user')
  assert.equal(r.authority.human_decision.status,'OPEN')
  assert.equal(r.authority.human_decision.semantic_type,'authority_request')
  assert.equal(r.authority.human_decision.response_schema.kind,'authority-protocol')
  assert.equal(r.authority.human_decision.response_schema.protocol,'reconcile-action-outcome')
  assert.equal(r.authority.human_decision.authority_ref,hash)
  assert.equal(claimAuthorizedAction(r,command,cwd),'duplicate')
  assert.ok(r.execution.ledger.some(e=>e.type==='authority.execution.uncertain'&&e.payload?.hash===hash))
  const decisionID=r.authority.human_decision.decision_id,uncertainCount=r.execution.ledger.filter(e=>e.type==='authority.execution.uncertain').length
  const twice=new MissionStore();twice.restore([structuredClone(r)],true);const rr=twice.get(m.identity.session_id)
  assert.equal(rr.authority.authority.executing.hash,hash)
  assert.equal(rr.authority.human_decision.decision_id,decisionID)
  assert.equal(rr.execution.ledger.filter(e=>e.type==='authority.execution.uncertain').length,uncertainCount)
  assert.equal(claimAuthorizedAction(rr,command,cwd),'duplicate')
})
