import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createMessagesTransformHook} from '../dist/hooks/messages-transform.js'
import {createSystemTransformHook} from '../dist/hooks/system-transform.js'
import {createSessionCompactingHook} from '../dist/hooks/session-compacting.js'
import {ownershipContract} from '../dist/runtime/skills/methodology.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function user(parts){return{info:{id:'u1',role:'user'},parts}}

test('foreign marker text cannot suppress the canonical Hi message contract and repeated transform is idempotent',async()=>{
  const store=new MissionStore(),bg=new BackgroundRegistry(),m=startAssessedMission(store,'compose-msg','opaque task')
  const foreign={type:'text',text:'foreign plugin note: Hi CONTROL-PLANE CONTRACT but not the canonical contract',metadata:{foreign:true}},out={messages:[user([foreign])]}
  const hook=createMessagesTransformHook(store,bg);await hook({sessionID:'compose-msg'},out);await hook({sessionID:'compose-msg'},out)
  const canonical=ownershipContract('parent'),parts=out.messages[0].parts
  assert.equal(parts.filter(p=>p?.type==='text'&&p.text===canonical).length,1)
  assert.equal(parts[0].metadata.foreign,true);assert.equal(parts[0].text,foreign.text)
  const collisions=m.execution.ledger.filter(e=>e.type==='host.composition-collision'&&e.payload?.surface==='messages-transform')
  assert.equal(collisions.length,1);assert.equal(collisions[0].payload.reason,'hi-contract-marker-without-canonical-contract')
})

test('system transform preserves prior plugin output, diagnoses marker collision, and appends one canonical projection',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'compose-system','opaque task'),hook=createSystemTransformHook(store,new BackgroundRegistry())
  const out={system:['external-plugin-system','foreign Hi MISSION RUNTIME PROJECTION shadow']}
  await hook({sessionID:'compose-system',agent:'build'},out)
  const canonical=out.system.find(x=>x!==out.system[0]&&x!==out.system[1]&&/Hi MISSION RUNTIME PROJECTION/.test(x));assert.ok(canonical)
  await hook({sessionID:'compose-system',agent:'build'},out)
  assert.deepEqual(out.system.slice(0,2),['external-plugin-system','foreign Hi MISSION RUNTIME PROJECTION shadow'])
  assert.equal(out.system.filter(x=>x===canonical).length,1)
  assert.equal(m.execution.ledger.filter(e=>e.type==='host.composition-collision'&&e.payload?.surface==='system-transform').length,1)
})

test('compaction transform is additive/idempotent and diagnoses a conflicting Hi survival marker without replacing foreign context',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'compose-compact','opaque task'),hook=createSessionCompactingHook(store,new BackgroundRegistry())
  const out={context:['external-plugin-context','foreign Hi MISSION SURVIVAL STATE shadow']}
  await hook({sessionID:'compose-compact'},out)
  const canonical=out.context.find(x=>x!==out.context[0]&&x!==out.context[1]&&x.startsWith('Hi MISSION SURVIVAL STATE'));assert.ok(canonical)
  await hook({sessionID:'compose-compact'},out)
  assert.deepEqual(out.context.slice(0,2),['external-plugin-context','foreign Hi MISSION SURVIVAL STATE shadow'])
  assert.equal(out.context.filter(x=>x===canonical).length,1)
  assert.equal(m.execution.ledger.filter(e=>e.type==='host.composition-collision'&&e.payload?.surface==='session-compacting').length,1)
})
