import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {methodologyExitCheck} from '../dist/runtime/methodology/exit.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {workerHandoffText} from '../dist/runtime/task/contracts.js'
import {createWorker,beginWorkerAttempt} from '../dist/runtime/worker/worker-runtime.js'
import {evidenceProducerAttemptForWorker} from '../dist/runtime/evidence/applicability.js'

function fixture(){
  const store=new MissionStore(process.cwd()),m=store.start('b3-exit','visual');
  store.applyInitialSemanticAssessment('b3-exit',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-qa'],requested_external_actions:[],likely_verification:['visual-check'],likely_targets:['http://127.0.0.1:47841/'],intent_signals:['intent.browser','intent.visual-qa'],suppressed_intent_signals:[]});
  const task={id:'t_b3',mission_id:m.identity.mission_id,objective:'visual',status:'running',role:'visual-qa',category:'visual',scope:['http://127.0.0.1:47841/'],constraints:[],dependencies:[],requiredEvidence:['visual-check'],obligation_ids:['o-review','o-verification'],context_artifacts:[],gate_ids:[],external_action_requirements:[],worker_id:'w_b3',created_at:Date.now(),updated_at:Date.now(),result:{status:'DONE',summary:'done',changed_files:[],scope_expansions:[],evidence:[],open_issues:[],needs_context:[]}};
  m.execution.tasks.push(task);const worker=createWorker(m,task,'host-default',[],['hi-browser-testing','hi-visual-qa']);worker.session_id='b3-browser-child';worker.status='busy';worker.loaded_methodologies=['hi-browser-testing','hi-visual-qa'];beginWorkerAttempt(task,worker);return{m,task,worker};
}

test('B3 methodology exit keeps outcome-less browser/visual evidence pending rather than implicit PASS',()=>{
  const {m,task}=fixture();
  addEvidence(m,{kind:'browser-evidence',summary:'observed browser flow',scope:task.scope,source:'worker:w_b3',task_id:task.id,obligation_ids:task.obligation_ids});
  addEvidence(m,{kind:'visual-evidence',summary:'observed screenshot',scope:task.scope,source:'worker:w_b3',task_id:task.id,obligation_ids:task.obligation_ids});
  assert.deepEqual(methodologyExitCheck(m,'hi-browser-testing',{task,result:task.result,projectRoot:process.cwd()}).missing,['browser-evidence']);
  assert.deepEqual(methodologyExitCheck(m,'hi-visual-qa',{task,result:task.result,projectRoot:process.cwd()}).missing,['visual-evidence']);
});

test('B3 fresh explicit passed browser/visual evidence satisfies only the matching methodology exit',()=>{
  const {m,task,worker}=fixture(),producer=evidenceProducerAttemptForWorker(m,worker),observation=addEvidence(m,{kind:'browser-evidence',summary:'real browser observation',scope:task.scope,source:'browser:bo_fixture',source_session_id:worker.session_id,source_state_hash:'a'.repeat(64),task_id:task.id,obligation_ids:task.obligation_ids,producer_attempt:producer,outcome:'pending',reason:'browser-observation-only'});
  addEvidence(m,{kind:'browser-evidence',summary:'browser flow verified',scope:task.scope,source:`worker:${worker.id}:reviewer`,source_session_id:worker.session_id,source_state_hash:'b'.repeat(64),task_id:task.id,obligation_ids:task.obligation_ids,producer_attempt:producer,evidence_refs:[observation.id],outcome:'passed',pass:true});
  assert.equal(methodologyExitCheck(m,'hi-browser-testing',{task,result:task.result,projectRoot:process.cwd()}).ok,true);
  assert.deepEqual(methodologyExitCheck(m,'hi-visual-qa',{task,result:task.result,projectRoot:process.cwd()}).missing,['visual-evidence']);
  addEvidence(m,{kind:'visual-evidence',summary:'visual state verified',scope:task.scope,source:`worker:${worker.id}:reviewer`,source_session_id:worker.session_id,source_state_hash:'c'.repeat(64),task_id:task.id,obligation_ids:task.obligation_ids,producer_attempt:producer,evidence_refs:[observation.id],outcome:'passed',pass:true});
  assert.equal(methodologyExitCheck(m,'hi-visual-qa',{task,result:task.result,projectRoot:process.cwd()}).ok,true);
});

test('B3 worker handoff tells browser reviewers that methodology evidence must be explicitly passed and never auto-promoted from observation',()=>{
  const text=workerHandoffText({objective:'visual',scope:['http://127.0.0.1:47841/'],constraints:[],required_evidence:['visual-check'],relevant_context:[],methodologies:['hi-browser-testing','hi-visual-qa'],methodology_exit_requirements:['hi-browser-testing: task-success, no-open-issues, browser-evidence','hi-visual-qa: task-success, no-open-issues, visual-evidence'],expected_output:{status:true,summary:true,changed_files:true,scope_expansions:true,evidence:true,findings:true,open_issues:true}});
  assert.match(text,/evidence\.outcome=\"passed\"/);
  assert.match(text,/Never manufacture PASS from a BrowserObservation or screenshot alone/);
});
