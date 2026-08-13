import test from 'node:test'
import assert from 'node:assert/strict'
import {canonicalHash,contentHash,stableJson,assertCanonicalId,ContractValidationError} from '../dist/contracts/common.js'
import {createProjectionReceipt,projectionReceiptHash,validateProjectionReceipt,validateProvenanceRecord} from '../dist/contracts/provenance.js'

test('canonical serialization and hash are deterministic across object key order',()=>{
  const a={z:1,a:{y:true,x:['v',2]},n:null}
  const b={n:null,a:{x:['v',2],y:true},z:1}
  assert.equal(stableJson(a),stableJson(b))
  assert.deepEqual(canonicalHash(a),canonicalHash(b))
})

test('canonical serialization rejects undefined and non-finite numbers instead of silently normalizing',()=>{
  assert.throws(()=>stableJson({a:undefined}),ContractValidationError)
  assert.throws(()=>stableJson({a:Number.NaN}),ContractValidationError)
})

test('canonical IDs use language-neutral technical syntax',()=>{
  assert.equal(assertCanonicalId('hi.role-coder'),'hi.role-coder')
  for(const bad of ['Hi Role','coder/role','_coder','coder:role'])assert.throws(()=>assertCanonicalId(bad))
})

test('provenance is strict, normalized and rejects path escape/duplicates',()=>{
  const h=contentHash('x')
  const p=validateProvenanceRecord({sourceType:'external-source',sourceId:'repo@sha',sourceRevision:'abc',sourceHash:h,owner:'hi.contracts',fileHashes:[{path:'b/file',hash:h},{path:'a/file',hash:h}]})
  assert.deepEqual(p.fileHashes.map(x=>x.path),['a/file','b/file'])
  assert.throws(()=>validateProvenanceRecord({...p,unknown:true}),/unknown field/)
  assert.throws(()=>validateProvenanceRecord({sourceType:'project',sourceId:'x',owner:'hi.contracts',fileHashes:[{path:'../escape',hash:h}]}),/bounded relative path/)
  assert.throws(()=>validateProvenanceRecord({sourceType:'project',sourceId:'x',owner:'hi.contracts',fileHashes:[{path:'a',hash:h},{path:'a',hash:h}]}),/duplicate path/)
})

test('projection receipt is deterministic, source-contract ordered, and validates output integrity metadata',()=>{
  const input={projectionSchema:'hi.opencode-agent.v1',generatorId:'hi.role-projector',generatorVersion:'1',outputPath:'plugin/src/generated/example.ts',outputContent:'export const X=1\n'}
  const a=createProjectionReceipt({...input,sourceContracts:[{id:'hi.role.coder',contract:{b:2,a:1}},{id:'hi.permission.coder',contract:{edit:'allow'}}]})
  const b=createProjectionReceipt({...input,sourceContracts:[{id:'hi.permission.coder',contract:{edit:'allow'}},{id:'hi.role.coder',contract:{a:1,b:2}}]})
  assert.deepEqual(a,b)
  assert.equal(a.outputHash.value,contentHash(input.outputContent).value)
  assert.deepEqual(a.sourceContracts.map(x=>x.id),['hi.permission.coder','hi.role.coder'])
  assert.deepEqual(projectionReceiptHash(a),projectionReceiptHash(b))
  assert.deepEqual(validateProjectionReceipt(structuredClone(a)),a)
})

test('projection receipt rejects duplicate contract identity, invalid hash, path escape and unknown fields',()=>{
  const base={projectionSchema:'hi.opencode-agent.v1',generatorId:'hi.role-projector',generatorVersion:'1',outputPath:'generated/x',outputContent:'x'}
  assert.throws(()=>createProjectionReceipt({...base,sourceContracts:[{id:'hi.role.coder',contract:{}},{id:'hi.role.coder',contract:{x:1}}]}),/duplicate contract/)
  const receipt=createProjectionReceipt({...base,sourceContracts:[{id:'hi.role.coder',contract:{}}]})
  assert.throws(()=>validateProjectionReceipt({...receipt,extra:true}),/unknown field/)
  assert.throws(()=>validateProjectionReceipt({...receipt,outputHash:{algorithm:'sha256',value:'bad'}}),/64 lowercase hexadecimal/)
  assert.throws(()=>createProjectionReceipt({...base,outputPath:'../escape',sourceContracts:[{id:'hi.role.coder',contract:{}}]}),/bounded relative path/)
})
