import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DefaultContextBudgetEstimator,contextBudgetEstimator,providerUsageObservation } from '../dist/runtime/context/budget-estimator.js'

test('provider usage is exact only when it is actually observed and model-compatible',()=>{
  const messages=[{info:{role:'assistant',providerID:'openai',modelID:'gpt-x',tokens:{input:321,output:10,reasoning:0,cache:{read:0,write:0}}},parts:[]}]
  const observed=providerUsageObservation(messages);assert.deepEqual(observed,{value:321,unit:'tokens',source:'provider-usage',confidence:'exact',model_identity:'openai/gpt-x'})
  assert.deepEqual(contextBudgetEstimator.estimate({content:'x'.repeat(2000),observed},'openai/gpt-x'),{value:321,unit:'tokens',source:'provider-usage',confidence:'exact'})
})

test('mismatched provider usage is not reused for a different model',()=>{
  const estimator=new DefaultContextBudgetEstimator(),observed={value:100,unit:'tokens',source:'provider-usage',confidence:'exact',model_identity:'p/a'}
  const result=estimator.estimate({content:'x'.repeat(400),observed},'q/b')
  assert.deepEqual(result,{value:100,unit:'tokens',source:'estimated',confidence:'estimated'})
})

test('model-independent heuristic is never labeled exact tokens',()=>{
  const estimator=new DefaultContextBudgetEstimator(),result=estimator.estimate('x'.repeat(401),'provider/model')
  assert.equal(result.unit,'tokens');assert.equal(result.source,'estimated');assert.equal(result.confidence,'estimated');assert.equal(result.value,101)
})

test('no-model fallback reports exact characters rather than fabricated tokens',()=>{
  const result=contextBudgetEstimator.estimate(['abc','def'])
  assert.deepEqual(result,{value:7,unit:'characters',source:'fallback',confidence:'exact'})
})

test('exact host-observed characters remain exact characters',()=>{
  const observed={value:777,unit:'characters',source:'host-observed',confidence:'exact'}
  assert.deepEqual(contextBudgetEstimator.estimate({content:'ignored',observed}),{value:777,unit:'characters',source:'host-observed',confidence:'exact'})
})

test('provider usage extractor ignores user messages and malformed/negative token observations',()=>{
  assert.equal(providerUsageObservation([{info:{role:'user',tokens:{input:100}}},{info:{role:'assistant',tokens:{input:-1}}}]),undefined)
})

test('exact token confidence cannot originate from estimated or fallback paths',()=>{
  const source=new URL('../src/runtime/context/budget-estimator.ts',import.meta.url)
  // Structural proof complements behavior: estimated token fallback is explicitly confidence=estimated.
  const text=readFileSync(source,'utf8')
  assert.match(text,/unit:'tokens',source:'estimated',confidence:'estimated'/)
  assert.doesNotMatch(text,/unit:'tokens',source:'(?:estimated|fallback)',confidence:'exact'/)
})
