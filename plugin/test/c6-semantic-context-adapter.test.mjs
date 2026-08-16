import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { isSemanticContextContract } from '../dist/contracts/semantic-context.js'
import { TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER,SEMANTIC_CONTEXT_ADAPTERS,semanticContextsForTargets } from '../dist/runtime/semantic/typescript-context.js'

test('C6 exposes one explicit TypeScript SemanticContextAdapter with exact language/file support',()=>{
  assert.deepEqual(TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER.languageIds(),['typescript','typescriptreact'])
  for(const file of ['src/a.ts','src/a.tsx','SRC/A.TS'])assert.equal(TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER.supports(file),true)
  for(const file of ['src/a.js','src/a.jsx','src/a.mts','src/a.cts','src/a.py'])assert.equal(TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER.supports(file),false)
  assert.equal(SEMANTIC_CONTEXT_ADAPTERS.length,1)
  assert.equal(SEMANTIC_CONTEXT_ADAPTERS[0],TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER)
})

test('C6 adapter extract preserves bounded TypeScript extraction semantics',()=>{
  const source=`export interface User { id:string }\nexport type UserId = string\nconst noise='${'x'.repeat(2000)}'`
  const result=TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER.extract({source,file:'src/user.ts',names:['User'],maxChars:120})
  assert.equal(result.symbols.length,1)
  assert.equal(result.symbols[0].name,'User')
  assert.ok(result.contextChars<=120)
  assert.equal(source.slice(result.symbols[0].start,result.symbols[0].end),result.symbols[0].signature)
})

test('C6 generic semantic target entrypoint uses only registered adapters and does not widen to JavaScript',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-c6-semantic-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true})
    writeFileSync(join(root,'src','a.ts'),'export interface A { id:string }\n')
    writeFileSync(join(root,'src','b.tsx'),'export type B = string\n')
    writeFileSync(join(root,'src','c.js'),'export function c() {}\n')
    const contexts=semanticContextsForTargets(root,['src/a.ts','src/b.tsx','src/c.js'],'t-c6',1800)
    assert.deepEqual(contexts.map(x=>x.source_ref),['file:src/a.ts','file:src/b.tsx'])
    assert.ok(contexts.every(x=>x.language_adapter==='typescript'&&isSemanticContextContract(x)))
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('C6 SemanticContextContract does not accept unsupported LSP Tree-sitter or JavaScript adapter identities',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-c6-contract-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'export interface A { id:string }\n')
    const [ctx]=semanticContextsForTargets(root,['src/a.ts'],'t-c6',900)
    assert.ok(ctx)
    for(const language_adapter of ['lsp','tree-sitter','javascript'])assert.equal(isSemanticContextContract({...ctx,language_adapter}),false)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('C6 TaskRuntime consumes the generic adapter entrypoint and capability docs state the exact support boundary',()=>{
  const task=readFileSync(new URL('../src/runtime/task/task-runtime.ts',import.meta.url),'utf8')
  const hosts=readFileSync(new URL('../../docs/HOSTS.md',import.meta.url),'utf8')
  const architecture=readFileSync(new URL('../../docs/ARCHITECTURE.md',import.meta.url),'utf8')
  assert.match(task,/semanticContextsForTargets\(this\.projectRoot/)
  assert.doesNotMatch(task,/typescriptSemanticContextsForTargets\(this\.projectRoot/)
  assert.match(hosts,/only `TypeScriptSemanticContextAdapter`/)
  assert.match(hosts,/No LSP semantic adapter, Tree-sitter adapter, or JavaScript adapter is currently claimed/)
  assert.match(architecture,/`typescript` and `typescriptreact`/)
  assert.match(architecture,/JavaScript, LSP-backed and Tree-sitter-backed semantic adapters are not implemented or advertised/)
})
