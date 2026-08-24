import test from 'node:test'
import assert from 'node:assert/strict'
import {clipList} from '../dist/runtime/context/budget.js'
import {projectContextGroups,renderProjectedContext} from '../dist/runtime/context/projection.js'

const g=(id,size,{priority='normal',protection='COMPRESSIBLE',freshness='FRESH',required=false,content_hash}={})=>({id,items:[`${id}:${id[0].repeat(Math.max(1,size-id.length-1))}`],priority,protection,freshness,required,content_hash})
function baseline(groups,budget){const flat=groups.flatMap(x=>x.items),selected=clipList(flat,budget);return{items:selected,chars:selected.reduce((n,x)=>n+x.length,0),requiredCovered:groups.filter(x=>x.required||x.protection==='PROTECTED').every(x=>selected.includes(x.items[0])),partial:selected.some(x=>/\[Hi truncated /.test(x))}}
function projected(groups,budget){const d=projectContextGroups(groups,budget),items=renderProjectedContext(d);return{decision:d,items,chars:items.reduce((n,x)=>n+x.length,0),requiredCovered:d.complete&&groups.filter(x=>x.required||x.protection==='PROTECTED').every(x=>d.selected.some(y=>y.id===x.id)),partial:items.some(x=>/\[Hi truncated /.test(x))}}

test('ablation: whole-group projection preserves required coverage and avoids mid-group truncation at real handoff budget',()=>{
  const groups=[g('required',1500,{priority:'high',protection:'PROTECTED',required:true}),g('noise',2800,{priority:'low',protection:'PURGEABLE',freshness:'POTENTIALLY_STALE'}),g('fresh',1800,{priority:'high'}),g('small',600,{priority:'normal'})]
  const b=baseline(groups,5000),p=projected(groups,5000)
  assert.equal(b.requiredCovered,true);assert.equal(p.requiredCovered,true)
  assert.equal(b.partial,true);assert.equal(p.partial,false)
  const baselineFresh=b.items.find(x=>x.startsWith('fresh:')),projectedFresh=p.items.find(x=>x.startsWith('fresh:'))
  assert.ok(baselineFresh);assert.ok(projectedFresh);assert.ok(baselineFresh.length<groups[2].items[0].length);assert.equal(projectedFresh.length,groups[2].items[0].length)
  assert.ok(p.chars<b.chars);assert.ok(p.chars<=5000)
})

test('ablation: byte-identical duplicate groups are paid once without losing required content',()=>{
  const duplicateText='duplicate:'+('d'.repeat(1490)),groups=[g('required',1200,{priority:'high',protection:'PROTECTED',required:true}),{...g('dup-a',1500),items:[duplicateText]},{...g('dup-b',1500),items:[duplicateText]},g('useful',1700,{priority:'high'})]
  const b=baseline(groups,5000),p=projected(groups,5000)
  assert.equal(b.requiredCovered,true);assert.equal(p.requiredCovered,true)
  assert.deepEqual(p.decision.duplicate_groups,['dup-b'])
  const baselineUseful=b.items.find(x=>x.startsWith('useful:')),projectedUseful=p.items.find(x=>x.startsWith('useful:'))
  assert.ok(baselineUseful);assert.ok(projectedUseful);assert.ok(baselineUseful.length<groups[3].items[0].length);assert.equal(projectedUseful.length,groups[3].items[0].length)
  assert.ok(p.chars<b.chars)
})

test('projection fails closed instead of partially emitting required atomic context',()=>{
  const p=projected([g('must-a',3000,{protection:'PROTECTED'}),g('must-b',3000,{protection:'PROTECTED'})],5000)
  assert.equal(p.decision.complete,false);assert.deepEqual(p.decision.missing_required,['must-b']);assert.equal(p.partial,false)
})


test('equal explicit utility preserves caller order and required duplicate content is never deduped away',()=>{
  const ordered=[g('first',1800,{priority:'high',freshness:'UNKNOWN'}),g('second',600,{priority:'high',freshness:'UNKNOWN'})],p=projected(ordered,2000)
  assert.equal(p.decision.selected[0].id,'first')
  const duplicateText='required-byte-identical',required=projectContextGroups([{...g('optional',900),items:[duplicateText]},{...g('must',900,{required:true,protection:'PROTECTED'}),items:[duplicateText]}],2000)
  assert.equal(required.complete,true);assert.deepEqual(required.selected.map(x=>x.id),['must']);assert.deepEqual(required.duplicate_groups,['optional'])
})

test('source provenance hashes never dedupe different rendered Worker context bytes',()=>{
  const sameSourceHash='b'.repeat(64),decision=projectContextGroups([
    {...g('projection-a',900),content_hash:sameSourceHash,items:['same source, selected contract A']},
    {...g('projection-b',900),content_hash:sameSourceHash,items:['same source, selected contract B']},
  ],2000)
  assert.deepEqual(decision.selected.map(x=>x.id),['projection-a','projection-b'])
  assert.deepEqual(decision.duplicate_groups,[])
})
