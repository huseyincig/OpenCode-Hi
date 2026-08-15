import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,rmSync,readFileSync,writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isAuthorityStateContract } from '../dist/contracts/authority.js'
import { externalActionTypeFromTechnicalKind,isExternalActionContract } from '../dist/contracts/external-action.js'
import { actionContract } from '../dist/runtime/safety/authority.js'
import { classifyExternalCommand,externalActionType } from '../dist/runtime/safety/command-classifier.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { RuntimePersistence } from '../dist/runtime/state/persistence.js'
import { startAssessedMission } from './helpers/semantic.mjs'

const TECHNICAL=[
  ['git push origin main','git-push'],
  ['gh release create v1','release-create'],
  ['npm publish','package-publish'],
  ['yarn npm publish','package-publish'],
  ['docker push acme/app','deploy'],
  ['kubectl delete deployment app','deploy'],
  ['terraform apply','deploy'],
  ['vercel deploy','deploy'],
  ['netlify deploy','deploy'],
]

test('technical external command kinds project into the closed canonical ExternalAction vocabulary',()=>{
  for(const [command,semantic] of TECHNICAL){
    const technical=classifyExternalCommand(command).kind
    assert.equal(externalActionTypeFromTechnicalKind(technical),semantic)
    assert.equal(externalActionType(command),semantic)
  }
  assert.equal(externalActionType('git status'),undefined)
})

test('exact Authority action contract binds semantic action, target, command and cwd into one hash identity',()=>{
  const a=actionContract('git push origin main','/repo/a'),b=actionContract('git push origin main','/repo/b'),c=actionContract('gh release create v1','/repo/a')
  assert.equal(a.action_type,'git-push');assert.equal(a.target.command,'git push origin main');assert.equal(a.target.cwd,'/repo/a');assert.match(a.authority_id,/^auth_[a-f0-9]{20}$/);assert.equal(a.one_shot,true)
  assert.notEqual(a.hash,b.hash);assert.notEqual(a.hash,c.hash)
  assert.throws(()=>actionContract('git status','/repo/a'),/not a canonical external action/)
})

test('AuthorityStateContract is strict/current-only and forbids ambiguous simultaneous active slots',()=>{
  const a=actionContract('npm publish','/repo')
  assert.equal(isAuthorityStateContract({pending:{hash:a.hash,action:a.action,created_at:1},completed_hashes:[]}),true)
  assert.equal(isAuthorityStateContract({pending:{hash:a.hash,action:a.action,created_at:1},approved:{hash:a.hash,approved_at:2}}),false)
  assert.equal(isAuthorityStateContract({executing:{hash:'x',action:a.action,started_at:1}}),false)
  assert.equal(isAuthorityStateContract({completed_hashes:[a.hash,a.hash]}),false)
})

test('ExternalActionContract rejects unknown action vocabulary and unknown fields',()=>{
  const valid={action_type:'deploy',target:'production',requested_explicitly:true,required_authority_ref:'auth_abc',executor:'opencode-bash'}
  assert.equal(isExternalActionContract(valid),true)
  assert.equal(isExternalActionContract({...valid,action_type:'docker-push'}),false)
  assert.equal(isExternalActionContract({...valid,extra:true}),false)
})

test('RuntimePersistence rejects malformed authority state instead of silently restoring it',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-authority-contract-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'authority-persist','release',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',requested_external_actions:['git-push']})
    const a=actionContract('git push origin main',root);m.authority.authority={executing:{hash:a.hash,action:a.action,started_at:Date.now()},completed_hashes:[]}
    new RuntimePersistence(root).save(store.all(),true);assert.equal(new RuntimePersistence(root).load().length,1)
    const persistence=new RuntimePersistence(root),raw=JSON.parse(readFileSync(persistence.path,'utf8'));raw.missions[0].authority.authority={executing:{hash:'bad',action:a.action,started_at:Date.now()},completed_hashes:[]};writeFileSync(persistence.path,JSON.stringify(raw));const invalid=new RuntimePersistence(root);assert.deepEqual(invalid.load(),[]);assert.match(invalid.lastLoadReport.error,/invalid mission state/)
  } finally { rmSync(root,{recursive:true,force:true}) }
})
