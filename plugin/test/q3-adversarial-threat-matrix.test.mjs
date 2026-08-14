import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { createTask, createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { DEFAULT_HI_CONFIG } from '../dist/config/defaults.js'

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const matrix=JSON.parse(readFileSync(join(ROOT,'data/validation/adversarial-threat-matrix.json'),'utf8'))
const REQUIRED=['prompt-injection','role-prompt-drift','host-permission-widening','path-traversal','external-directory-escape','stale-child-callback','duplicate-child-callback','user-dirty-file-ownership','context-poisoning','pi-poisoning','summary-poisoning','process-orphan','workspace-cleanup-loss','browser-observation-forgery','external-action-replay','release-substitution','supply-chain-artifact-substitution']

function row(name){return matrix.threats.find(x=>x.threat===name)}

function runtime(){return new TaskRuntime({},new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),ROOT,ROOT,()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))}

test('Q3 threat matrix is closed, complete, stable-ID and tests-only verification metadata',()=>{
  assert.equal(matrix.schema,1);assert.equal(matrix.type,'hi-adversarial-threat-matrix')
  assert.deepEqual(matrix.threats.map(x=>x.threat),REQUIRED)
  assert.equal(new Set(matrix.threats.map(x=>x.id)).size,REQUIRED.length)
  assert.deepEqual(matrix.threats.map(x=>x.id),REQUIRED.map((_,i)=>`Q3-ADV-${String(i+1).padStart(3,'0')}`))
  for(const t of matrix.threats){assert.ok(t.owner);assert.ok(t.control);assert.ok(t.proof_tests.length,`${t.id} has no deterministic proof test`)}
  assert.equal(existsSync(join(ROOT,'plugin/src/adversarial-threat-matrix.ts')),false,'matrix must not become runtime configuration')
})

test('Q3 every deterministic control resolves to an existing executable proof test',()=>{
  for(const t of matrix.threats)for(const proof of t.proof_tests){const p=join(ROOT,proof.file);assert.ok(existsSync(p),`${t.id} missing ${proof.file}`);assert.match(readFileSync(p,'utf8'),new RegExp(proof.contains.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`${t.id} proof anchor drifted: ${proof.contains}`)}
})

test('Q3 T3/T4 claims are bound to existing receipts and exact claim anchors',()=>{
  for(const t of matrix.threats)for(const ev of t.evidence){assert.ok(['T3','T4'].includes(ev.tier),`${t.id} bad tier`);const p=join(ROOT,ev.receipt);assert.ok(existsSync(p),`${t.id} missing receipt ${ev.receipt}`);assert.ok(readFileSync(p,'utf8').includes(ev.contains),`${t.id} receipt claim anchor drifted: ${ev.contains}`)}
  assert.equal(row('process-orphan').evidence[0].tier,'T3');assert.equal(row('workspace-cleanup-loss').evidence[0].tier,'T3');assert.equal(row('browser-observation-forgery').evidence[0].tier,'T3');assert.equal(row('release-substitution').evidence[0].tier,'T4');assert.equal(row('supply-chain-artifact-substitution').evidence[0].tier,'T4')
})

test('Q3 duplicate child result callback is idempotently ignored by canonical TaskRuntime',()=>{
  const store=new MissionStore(),mission=store.start('q3-duplicate-child','verify duplicate child callback handling')
  const task=createTask(mission,{objective:'bounded child task',role:'coder',category:'standard',scope:[],dependencies:[],requiredEvidence:[]})
  const worker=createWorker(mission,task,'host-default',[],[],[]);worker.status='busy';worker.started_at=Date.now()-10
  const result={status:'DONE',summary:'bounded result',changed_files:[],evidence:[],open_issues:[],needs_context:[]}
  const rt=runtime();rt.applyResult(mission,worker.id,result)
  const firstUpdated=task.updated_at,firstEvidence=mission.evidence.items.length
  rt.applyResult(mission,worker.id,result)
  assert.equal(task.updated_at,firstUpdated);assert.equal(mission.evidence.items.length,firstEvidence)
  assert.ok(mission.ledger.some(e=>e.type==='worker.result.duplicate-ignored'&&e.worker_id===worker.id))
})

test('Q3 pinned threat/process/path reference revisions are recorded exactly',()=>{
  assert.deepEqual(matrix.reference_pins,{
    'opencode-agent-orchestration-kit':'c5824da575fb3b7cee30a3d1b889b7bf3328521a',
    'opencode-pty':'cc12a2bef39cdbf2a7e945b13a0ed423e4f104ee',
    'opencode-worktree':'77c2262f1c2c71077284643232cc85f6d05e06c0'
  })
})
