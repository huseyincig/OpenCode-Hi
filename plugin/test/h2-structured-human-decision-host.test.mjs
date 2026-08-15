import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {openCodeHostCapabilityContracts,hostCapabilityByID} from '../dist/contracts/host-capability.js'

const all={childSessions:true,asyncPrompt:true,syncPrompt:true,abort:true,providerInventory:true,appLog:true,sessionStatus:true,childSessionList:true,sessionTodo:true,sessionDiff:true,sessionFork:true,sessionSummarize:true,sessionRevert:true,sessionUnrevert:true}

test('H2 OpenCode 1.18.18 public question API can list/reply/reject but cannot directly open a structured question',()=>{
  const sdk=readFileSync(new URL('../node_modules/@opencode-ai/sdk/dist/v2/gen/sdk.gen.d.ts',import.meta.url),'utf8')
  const start=sdk.indexOf('export declare class Question extends HeyApiClient')
  const end=sdk.indexOf('export declare class Permission extends HeyApiClient',start)
  assert.ok(start>=0&&end>start)
  const surface=sdk.slice(start,end)
  assert.match(surface,/\blist</)
  assert.match(surface,/\breply</)
  assert.match(surface,/\breject</)
  assert.match(surface,/List pending questions/)
  assert.match(surface,/Reply to question request/)
  assert.match(surface,/Reject question request/)
  assert.doesNotMatch(surface,/\bask\s*</)
  assert.doesNotMatch(surface,/\bopen\s*</)
})

test('H2 structured host UI remains unsupported rather than model-mediated or inferred from question events',()=>{
  const capability=hostCapabilityByID(openCodeHostCapabilityContracts(all),'structured-human-decision-transport')
  assert.equal(capability?.status,'UNSUPPORTED')
  assert.equal(capability?.verification_level,'OBSERVED')
  assert.equal(capability?.native_primitive,undefined)
  assert.equal(capability?.adapter_entrypoint,undefined)
  assert.match(capability?.forbidden_fake_behavior??'',/list\/reply\/reject|model-facing question tool/i)
  assert.equal(hostCapabilityByID(openCodeHostCapabilityContracts(all),'browser-execution')?.status,'UNSUPPORTED')
})

test('H2 source tree has no fake host UI transport that delegates HumanDecision opening to a model prompt',()=>{
  const transport=readFileSync(new URL('../src/runtime/human-decision/transport.ts',import.meta.url),'utf8')
  const hooks=readFileSync(new URL('../src/opencode/open-code-hooks.ts',import.meta.url),'utf8')
  assert.doesNotMatch(transport,/question\.ask|session\.prompt|browser|WebSocket/i)
  assert.doesNotMatch(hooks,/question\.ask/)
})
