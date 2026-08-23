import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {assessDiagnosticHypothesis} from '../dist/runtime/diagnosis/hypothesis.js'

function mission(id='diag-contract'){
  const s=new MissionStore(),m=s.start(id,'diagnose parser failure')
  s.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'diagnosis',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['repository-analysis','verification'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/parser.ts'],intent_signals:[],suppressed_intent_signals:[]})
  return m
}
const input=(refs,outcome='SUPPORTED')=>({hypothesis:'Parser branch truncates the token.',falsifier:'The focused reproduction passes while the branch remains unchanged.',outcome,evidence_refs:refs})

test('diagnostic hypothesis accepts fresh terminal canonical evidence on diagnosis scope',()=>{
  const m=mission(),e=addEvidence(m,{kind:'targeted-tests',summary:'focused reproduction',scope:['src/parser.ts'],source:'bash',trusted_source_class:'host-tool-observation',source_state_hash:'a'.repeat(64),outcome:'failed',pass:false})
  const out=assessDiagnosticHypothesis(m,input([e.id]));assert.equal(out.supported,true);assert.deepEqual(out.admissible_evidence_refs,[e.id]);assert.deepEqual(out.rejected_evidence_refs,[])
})

test('unknown stale pending and environment observations cannot support diagnosis',()=>{
  const m=mission('diag-reject'),stale=addEvidence(m,{kind:'targeted-tests',summary:'old',scope:['src/parser.ts'],source:'bash',outcome:'failed',pass:false}),pending=addEvidence(m,{kind:'diagnostic-evidence',summary:'process output',scope:['src/parser.ts'],source:'process:p',outcome:'pending'}),env=addEvidence(m,{kind:'targeted-tests',summary:'tool missing',scope:['src/parser.ts'],source:'bash',outcome:'environment-issue'});stale.invalidated_at=Date.now()
  const out=assessDiagnosticHypothesis(m,input(['missing',stale.id,pending.id,env.id]));assert.equal(out.supported,false);assert.deepEqual(out.rejected_evidence_refs.map(x=>x.reason),['unknown-evidence-ref','stale-evidence','non-terminal-diagnostic-observation','non-terminal-diagnostic-observation'])
})

test('falsified and inconclusive hypotheses remain non-supporting even with admissible evidence',()=>{
  const m=mission('diag-outcome'),e=addEvidence(m,{kind:'targeted-tests',summary:'probe',scope:['src/parser.ts'],source:'bash',outcome:'passed',pass:true})
  assert.equal(assessDiagnosticHypothesis(m,input([e.id],'FALSIFIED')).supported,false);assert.equal(assessDiagnosticHypothesis(m,input([e.id],'INCONCLUSIVE')).supported,false)
})
