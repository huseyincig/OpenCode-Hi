import test from 'node:test'
import assert from 'node:assert/strict'
import {workerHandoffText} from '../dist/runtime/task/contracts.js'

test('worker handoff treats required evidence kinds as canonical IDs rather than aliasable prose',()=>{
  const text=workerHandoffText({objective:'review exact invariant',scope:['src/security.js'],constraints:[],required_evidence:['review-evidence'],relevant_context:[],methodologies:[],expected_output:{status:true,summary:true,changed_files:true,scope_expansions:true,evidence:true,findings:true,open_issues:true}})
  assert.match(text,/REQUIRED EVIDENCE: review-evidence/)
  assert.match(text,/Required evidence kinds are canonical IDs/)
  assert.match(text,/emit those exact values as evidence\.kind/)
  assert.match(text,/never rename or alias them/)
})


test('reviewer handoff keeps source details inside canonical review-evidence instead of inventing evidence kinds',()=>{
  const text=workerHandoffText({objective:'review dependency',scope:['requirements.txt'],constraints:[],required_evidence:['review-evidence'],relevant_context:[],methodologies:[],expected_output:{status:true,summary:true,changed_files:true,scope_expansions:true,evidence:true,findings:true,open_issues:true}})
  assert.match(text,/Reviewer closure: emit evidence\.kind="review-evidence"/)
  assert.match(text,/Do not invent provider-, package-, advisory-, CVE-, or scanner-specific evidence\.kind IDs/)
  assert.match(text,/blocking introduced finding must return FIX_REQUIRED/)
})
