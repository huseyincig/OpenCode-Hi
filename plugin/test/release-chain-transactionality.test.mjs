import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'
import { createToolAfterHook } from '../dist/hooks/tool-after.js'
import { recordStagingInspection } from '../dist/runtime/safety/staging-safety.js'


const H='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
async function verifyRemote(m,after){await after({sessionID:m.session_id,tool:'bash',args:{command:'git rev-parse HEAD'}},{stdout:H+'\n',metadata:{exit:0}});await after({sessionID:m.session_id,tool:'bash',args:{command:'git ls-remote origin refs/heads/main'}},{stdout:H+'\trefs/heads/main\n',metadata:{exit:0}})}

function setup(){const store=new MissionStore('.'),sid=`s-${Math.random()}`,m=startAssessedMission(store,sid,'opaque release mission',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',required_capabilities:['verification'],requested_external_actions:['git-push','release-create'],likely_verification:[]});m.changed_files=['src/a.ts'];return{store,m,before:createToolBeforeHook(store),after:createToolAfterHook(store)}}

test('failed push blocks release create even when persistent/native permission would allow it',async()=>{
 const {m,before,after}=setup();await before({sessionID:m.session_id,tool:'bash',args:{command:'git push origin main'}},{args:{command:'git push origin main'}});await after({sessionID:m.session_id,tool:'bash',args:{command:'git push origin main'}},{stdout:'rejected',metadata:{exit:1}})
 assert.equal(m.release_chain?.push?.outcome,'failure')
 await assert.rejects(()=>before({sessionID:m.session_id,tool:'bash',args:{command:'gh release create v1'}},{args:{command:'gh release create v1'}}),/release creation is blocked.*push-failed/i)
})

test('unknown push ACK blocks release until user reconciles and a current successful push is proven',async()=>{
 const {m,before,after}=setup();await before({sessionID:m.session_id,tool:'bash',args:{command:'git push origin main'}},{args:{command:'git push origin main'}});await after({sessionID:m.session_id,tool:'bash',args:{command:'git push origin main'}},{stdout:'',metadata:{}})
 assert.equal(m.release_chain?.push?.outcome,'unknown')
 await assert.rejects(()=>before({sessionID:m.session_id,tool:'bash',args:{command:'gh release create v1'}},{args:{command:'gh release create v1'}}),/push-unknown/i)
})

test('successful push permits release, but a later local commit invalidates that push proof',async()=>{
 const {m,before,after}=setup();await before({sessionID:m.session_id,tool:'bash',args:{command:'git push origin main'}},{args:{command:'git push origin main'}});await after({sessionID:m.session_id,tool:'bash',args:{command:'git push origin main'}},{stdout:'ok',metadata:{exit:0}})
 await verifyRemote(m,after)
 await assert.doesNotReject(()=>before({sessionID:m.session_id,tool:'bash',args:{command:'gh release create v1'}},{args:{command:'gh release create v1'}}))
 // complete the release attempt so the exact-action idempotency guard does not obscure the next assertion
 await after({sessionID:m.session_id,tool:'bash',args:{command:'gh release create v1'}},{stdout:'released',metadata:{exit:0}})
 recordStagingInspection(m,'git diff --cached --name-only',{stdout:'src/a.ts\n'})
 await before({sessionID:m.session_id,tool:'bash',args:{command:'git commit -m "late fix"'}},{args:{command:'git commit -m "late fix"'}})
 await after({sessionID:m.session_id,tool:'bash',args:{command:'git commit -m "late fix"'}},{stdout:'[main abc] late fix',metadata:{exit:0}})
 assert.equal(m.release_chain?.push,undefined)
 await assert.rejects(()=>before({sessionID:m.session_id,tool:'bash',args:{command:'gh release create v2'}},{args:{command:'gh release create v2'}}),/push-not-proven-after-local-revision/i)
})

test('user-confirmed success for an unknown push ACK satisfies the release-chain push prerequisite',async()=>{
 const {m,before,after}=setup();await before({sessionID:m.session_id,tool:'bash',args:{command:'git push origin main'}},{args:{command:'git push origin main'}});await after({sessionID:m.session_id,tool:'bash',args:{command:'git push origin main'}},{stdout:'',metadata:{}})
 const { resolveUncertainAuthority }=await import('../dist/runtime/safety/authority.js')
 assert.equal(resolveUncertainAuthority(m,'confirm action succeeded'),true)
 assert.equal(m.release_chain?.push?.outcome,'success')
 await verifyRemote(m,after)
 await assert.doesNotReject(()=>before({sessionID:m.session_id,tool:'bash',args:{command:'gh release create v1'}},{args:{command:'gh release create v1'}}))
})

test('explicit create-release mission cannot complete after push alone',async()=>{
 const { evaluateCompletion }=await import('../dist/runtime/completion/evaluator.js')
 const {m}=setup();m.obligations.forEach(o=>{o.status='closed'});m.evidence.fresh=true;m.release_chain={push:{outcome:'success',at:Date.now(),command:'git push origin main'}}
 const c=evaluateCompletion(m);assert.equal(c.complete,false);assert.ok(c.reasons.some(r=>r==='release-chain:release-not-completed'))
 m.release_chain.release={outcome:'success',at:Date.now(),command:'gh release create v1',remote_verified:true};const d=evaluateCompletion(m);assert.ok(!d.reasons.includes('release-chain:release-not-completed'))
})
