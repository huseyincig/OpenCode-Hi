import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { isSemanticContextContract } from '../dist/contracts/semantic-context.js'
import { extractTypeScriptSemanticContext,renderSemanticContext,typescriptSemanticContextsForTargets } from '../dist/runtime/semantic/typescript-context.js'

test('SemanticContextContract binds live source hash and exact selected ranges to one Task consumer',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-semantic-contract-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true})
    const source="  export interface User { id:string }\nexport type UserId = string\nconst hidden=1\n"
    writeFileSync(join(root,'src','user.ts'),source)
    const [ctx]=typescriptSemanticContextsForTargets(root,['src/user.ts'],'t-consumer',1200)
    assert.ok(ctx)
    assert.equal(isSemanticContextContract(ctx),true)
    assert.equal(ctx.consumer_task_ref,'t-consumer')
    assert.equal(ctx.source_ref,'file:src/user.ts')
    assert.equal(ctx.relationships.length,0)
    assert.equal(ctx.symbols.length,ctx.selected_ranges.length)
    for(const symbol of ctx.symbols)assert.equal(source.slice(symbol.start,symbol.end),symbol.signature)
    assert.equal(ctx.budget.used_chars,ctx.text.length)
    assert.match(renderSemanticContext(ctx),/^semantic-typescript:src\/user\.ts/)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('SemanticContext source mutation changes source hash and derived context identity',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-semantic-freshness-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true})
    const file=join(root,'src','a.ts')
    writeFileSync(file,'export interface A { id:string }\n')
    const [before]=typescriptSemanticContextsForTargets(root,['src/a.ts'],'t-one',900)
    writeFileSync(file,'export interface A { id:string; name:string }\n')
    const [after]=typescriptSemanticContextsForTargets(root,['src/a.ts'],'t-one',900)
    assert.notEqual(before.source_hash,after.source_hash)
    assert.notEqual(before.id,after.id)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('SemanticContext validator rejects forged ranges, unknown fields and relationships to absent symbols',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-semantic-negative-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'export interface A { id:string }\n')
    const [ctx]=typescriptSemanticContextsForTargets(root,['src/a.ts'],'t-one',900)
    assert.equal(isSemanticContextContract({...ctx,unexpected:true}),false)
    assert.equal(isSemanticContextContract({...ctx,id:'sc_'+ 'f'.repeat(20)}),false)
    assert.equal(isSemanticContextContract({...ctx,source_ref:'file:../secret.ts'}),false)
    assert.equal(isSemanticContextContract({...ctx,selected_ranges:[{start:0,end:1}]}),false)
    assert.equal(isSemanticContextContract({...ctx,selected_ranges:[...ctx.selected_ranges,{start:100,end:101}]}),false)
    assert.equal(isSemanticContextContract({...ctx,relationships:[{kind:'references',source_symbol:'A',target_symbol:'Missing'}]}),false)
    assert.equal(isSemanticContextContract({...ctx,budget:{...ctx.budget,used_chars:ctx.text.length+1}}),false)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('low-level TypeScript extraction remains bounded and does not invent a dependency graph',()=>{
  const source=`import x from 'x'\nconst privateThing=1\nexport interface User { id:string; name:string }\nexport type UserId = string\nexport function loadUser(id:UserId):Promise<User> { throw 0 }\n`+`const noise='${'z'.repeat(4000)}'`
  const r=extractTypeScriptSemanticContext(source,['User','UserId','loadUser'],500)
  assert.ok(r.text.includes('interface User'))
  assert.ok(r.contextChars<=500)
  assert.ok(r.contextChars<r.sourceChars/2)
  for(const symbol of r.symbols)assert.equal(source.slice(symbol.start,symbol.end),symbol.signature)
})
