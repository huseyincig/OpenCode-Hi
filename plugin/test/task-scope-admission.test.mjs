import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {admitNewTaskScope} from '../dist/runtime/task/scope-admission.js'

function root(){const r=mkdtempSync(join(tmpdir(),'hi-task-scope-admission-'));writeFileSync(join(r,'index.html'),'<!doctype html>\n');mkdirSync(join(r,'src'));return r}

test('unbound explorer pseudo-scope becomes empty bounded discovery only while target authority is unresolved',()=>{
  const r=root();try{
    const out=admitNewTaskScope({projectRoot:r,role:'repository-explorer',ambiguity:'resolvable',missionTargets:[],requestedScope:['workspace']})
    assert.equal(out.accepted,true);assert.deepEqual(out.scope,[]);assert.equal(out.reason,'repository-discovery-unbound-normalized');assert.deepEqual(out.unbound,['workspace'])
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('a real project-relative workspace directory is literal scope, never a magic project-root alias',()=>{
  const r=root();try{mkdirSync(join(r,'workspace'));writeFileSync(join(r,'workspace','owned.txt'),'x\n')
    const out=admitNewTaskScope({projectRoot:r,role:'repository-explorer',ambiguity:'resolvable',missionTargets:[],requestedScope:['workspace']})
    assert.equal(out.accepted,true);assert.deepEqual(out.scope,['workspace']);assert.equal(out.reason,'unchanged')
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('mixed bound and unbound explorer scope fails closed instead of silently widening or dropping entries',()=>{
  const r=root();try{
    const out=admitNewTaskScope({projectRoot:r,role:'repository-explorer',ambiguity:'resolvable',missionTargets:[],requestedScope:['src','workspace']})
    assert.equal(out.accepted,false);assert.equal(out.reason,'repository-scope-unbound');assert.deepEqual(out.unbound,['workspace'])
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('exact canonical Mission target remains explorer authority even when it names an explicit future file',()=>{
  const r=root();try{
    const out=admitNewTaskScope({projectRoot:r,role:'repository-explorer',ambiguity:'resolvable',missionTargets:['src/future.ts'],requestedScope:['src/future.ts']})
    assert.equal(out.accepted,true);assert.deepEqual(out.scope,['src/future.ts']);assert.equal(out.reason,'unchanged')
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('unbound explorer scope is rejected once Mission has canonical target authority',()=>{
  const r=root();try{
    const out=admitNewTaskScope({projectRoot:r,role:'repository-explorer',ambiguity:'resolvable',missionTargets:['index.html'],requestedScope:['workspace']})
    assert.equal(out.accepted,false);assert.equal(out.reason,'repository-scope-unbound');assert.deepEqual(out.canonical_targets,['index.html'])
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('writer future-file scope is untouched by repository-explorer admission policy',()=>{
  const r=root();try{
    const out=admitNewTaskScope({projectRoot:r,role:'coder',ambiguity:'none',missionTargets:[],requestedScope:['src/new.ts']})
    assert.equal(out.accepted,true);assert.deepEqual(out.scope,['src/new.ts']);assert.equal(out.reason,'unchanged')
  }finally{rmSync(r,{recursive:true,force:true})}
})
