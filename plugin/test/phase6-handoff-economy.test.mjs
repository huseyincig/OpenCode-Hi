import test from 'node:test'
import assert from 'node:assert/strict'
import {workerHandoffText} from '../dist/runtime/task/contracts.js'
import {ownershipContract} from '../dist/runtime/skills/methodology.js'

const base={
  objective:'Fix src/a.ts',scope:['src/a.ts'],
  constraints:['minimum sufficient change','no unrequested publish/push/deploy','return compact evidence','no pre-existing native dirty paths were observed at worker start'],
  relevant_context:[],approval_gated_methodologies:[],
  expected_output:{status:true,summary:true,changed_files:true,scope_expansions:true,evidence:true,open_issues:true},
}
function full(h){return `${ownershipContract('child',h.methodologies)}\n\n${workerHandoffText(h)}`}

test('Phase 6 trivial handoff is a task delta instead of repeated methodology/control boilerplate',()=>{
  const h={...base,required_evidence:[],methodologies:[],methodology_exit_requirements:[]},core=workerHandoffText(h),text=full(h)
  assert.ok(text.length<1800,`trivial child handoff regressed to ${text.length} chars`)
  assert.doesNotMatch(core,/Control plane: Hi|HI METHODOLOGIES|METHODOLOGY EXIT REQUIREMENTS|APPROVAL-GATED METHODOLOGIES|BrowserObservation|targeted-test-evidence/)
  assert.match(text,/Hi CHILD CONTROL-PLANE CONTRACT/)
  assert.match(core,/OBJECTIVE: Fix src\/a\.ts/)
  assert.match(core,/RESULT: compact JSON/)
  assert.match(core,/scope_expansions/)
})

test('Phase 6 evidence-specific handoff keeps exact canonical evidence semantics only when evidence is required',()=>{
  const text=workerHandoffText({...base,required_evidence:['targeted-tests'],methodologies:[],methodology_exit_requirements:[]})
  assert.match(text,/REQUIRED EVIDENCE: targeted-tests/)
  assert.match(text,/Required evidence kinds are canonical IDs/)
  assert.match(text,/emit those exact values as evidence\.kind/)
  assert.match(text,/never rename or alias them/)
})

test('Phase 6 methodology and visual proof rules are lazy and task-specific',()=>{
  const plain=workerHandoffText({...base,required_evidence:['targeted-tests'],methodologies:[],methodology_exit_requirements:[]})
  assert.doesNotMatch(plain,/Methodology exits require|BrowserObservation/)
  const methodology=workerHandoffText({...base,required_evidence:['targeted-tests'],methodologies:['hi-test-driven-development'],methodology_exit_requirements:['hi-test-driven-development: task-success, no-open-issues, targeted-test-evidence']})
  assert.match(methodology,/METHODOLOGY EXIT REQUIREMENTS: hi-test-driven-development/)
  assert.match(methodology,/Methodology exits require fresh passed structured evidence/)
  const visual=workerHandoffText({...base,required_evidence:['visual-evidence'],methodologies:['hi-browser-testing','hi-visual-qa'],methodology_exit_requirements:['hi-browser-testing: task-success, no-open-issues, browser-evidence','hi-visual-qa: task-success, no-open-issues, visual-evidence'],expected_output:{...base.expected_output,findings:true}})
  assert.match(visual,/evidence\.outcome="passed"/)
  assert.match(visual,/Never manufacture PASS from a BrowserObservation or screenshot alone/)
  assert.match(visual,/actual Hi browser observation/)
})

test('Phase 6 reviewer-only finding schema is not paid by ordinary coder handoffs',()=>{
  const coder=workerHandoffText({...base,required_evidence:[],methodologies:[],methodology_exit_requirements:[]})
  assert.doesNotMatch(coder,/Reviewer findings:/)
  const reviewer=workerHandoffText({...base,required_evidence:['review-evidence'],methodologies:[],methodology_exit_requirements:[],expected_output:{...base.expected_output,findings:true}})
  assert.match(reviewer,/Reviewer findings:/)
  assert.match(reviewer,/causality=pre-existing/)
})
