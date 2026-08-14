import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { appendLedger } from '../dist/runtime/ledger/ledger.js'
import { compactLedgerReport } from '../dist/runtime/ledger/report.js'
import { missionMetrics, aggregateMissionMetrics } from '../dist/runtime/ledger/metrics.js'
import { formatUserMissionStatus } from '../dist/runtime/ledger/status.js'
import {startAssessedMission} from './helpers/semantic.mjs'

test('ledger is bounded by event count and payload size while retaining critical mission lifecycle',()=>{
  const s=new MissionStore();const m=startAssessedMission(s,'ledger-bounded','opaque task',{task_kind:'bug-fix',likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
  for(let i=0;i<260;i++)appendLedger(m,'diagnostic.sample',{payload:{blob:'x'.repeat(5000),items:Array.from({length:100},(_,j)=>`item-${j}-${'y'.repeat(100)}`)}})
  assert.equal(m.execution.ledger.length,200)
  assert.ok(m.execution.ledger.some(e=>e.type==='mission.provisional'));assert.ok(m.execution.ledger.some(e=>e.type==='semantic.assessed'))
  const sample=m.execution.ledger.find(e=>e.type==='diagnostic.sample')
  assert.ok(String(sample.payload.blob).length<700)
  assert.ok(sample.payload.items.length<=24)
  const report=compactLedgerReport(m,40)
  assert.ok(report.events.length<=40)
})

test('user status is separate from ledger/log detail and exposes only compact operational state',()=>{
  const s=new MissionStore();const m=s.start('status-separation','fix src/a.ts bug test it')
  appendLedger(m,'sensitive.internal',{payload:{secretish:'do-not-surface',raw:'tool trajectory'}})
  m.execution.blockers.push('verification-env')
  const status=formatUserMissionStatus(m)
  assert.match(status,/^Hi:/)
  assert.match(status,/next /)
  assert.doesNotMatch(status,/do-not-surface|tool trajectory|sensitive\.internal/)
})

test('economy metrics report minimum-team methodology and handoff signals without fabricating tokens',()=>{
  const s=new MissionStore();const m=s.start('metrics','fix src/a.ts typo')
  m.execution.workers.push({id:'w1',task_id:'t1',role:'coder',category:'quick',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],methodologies:[],fingerprint:'f1',status:'completed'})
  m.execution.tasks.push({id:'t1',objective:'fix typo',status:'completed',role:'coder',category:'quick',scope:['src/a.ts'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w1',created_at:Date.now(),updated_at:Date.now()})
  appendLedger(m,'worker.handoff',{task_id:'t1',worker_id:'w1',payload:{chars:420,methodologies:0,context_budget:8000,handoff_budget:12000}})
  appendLedger(m,'worker.resumed',{task_id:'t1',worker_id:'w1'})
  const row=missionMetrics(m)
  assert.equal(row.agents_spawned,1)
  assert.equal(row.zero_methodology_workers,1)
  assert.equal(row.methodologies_loaded_total,0)
  assert.equal(row.average_handoff_chars,420)
  assert.equal(row.same_session_resumes,1)
  const agg=aggregateMissionMetrics([m])
  assert.equal(agg.zero_methodology_workers,1)
  assert.match(String(agg.note),/does not fabricate unavailable token\/cost telemetry/)
  assert.equal('tokens_used' in agg,false)
})
