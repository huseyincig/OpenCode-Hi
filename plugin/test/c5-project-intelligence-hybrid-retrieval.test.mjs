import test from 'node:test'
import assert from 'node:assert/strict'
import { retrieveProjectIntelligence } from '../dist/runtime/project-intelligence/retrieval.js'
import { ProjectIntelligenceStore } from '../dist/runtime/project-intelligence/store.js'

function pi(id,statement,files,{confidence=.8,freshness='FRESH',lifecycle='ACTIVE',updated=1}={}){
  return{id,statement,source_refs:files.map((file,i)=>({ref:`file:${file}`,hash:String((i+1)%10).repeat(64)})),confidence,freshness,lifecycle,consumer_domains:['task-context'],updated_at:updated}
}

test('C5 lexical retrieval finds semantically related PI without exact file overlap',()=>{
  const items=[
    pi('semantic','PublicContract identifiers remain stable across serialization',['src/contracts/public.ts']),
    pi('noise','CSS spacing uses four pixels',['ui/theme.css'],{confidence:1}),
  ]
  const hits=retrieveProjectIntelligence(items,{query:'preserve stable PublicContract identifier serialization',files:['src/api/handler.ts'],consumer:'task-context',limit:4})
  assert.deepEqual(hits.map(x=>x.item.id),['semantic'])
  assert.ok(hits[0].signals.lexical>0);assert.ok(hits[0].signals.path<4,'semantic hit must not depend on exact path overlap')
})

test('C5 exact path and lexical signals fuse deterministically with reciprocal-rank scoring',()=>{
  const items=[
    pi('exact','Token validation follows canonical boundary',['src/auth/token.ts'],{confidence:.6,updated:3}),
    pi('lexical','Authentication token validation errors use ResultEnvelope',['src/auth/errors.ts'],{confidence:.9,updated:2}),
    pi('same-dir-noise','Unrelated cache eviction policy',['src/auth/cache.ts'],{confidence:1,updated:4}),
  ]
  const a=retrieveProjectIntelligence(items,{query:'token validation ResultEnvelope',files:['src/auth/token.ts'],consumer:'task-context',limit:4})
  const b=retrieveProjectIntelligence([...items].reverse(),{query:'token validation ResultEnvelope',files:['src/auth/token.ts'],consumer:'task-context',limit:4})
  assert.deepEqual(a.map(x=>x.item.id),b.map(x=>x.item.id),'input order must not affect ranking')
  assert.ok(a.some(x=>x.item.id==='exact'&&x.signals.path===4))
  assert.ok(a.some(x=>x.item.id==='lexical'&&x.signals.lexical>0&&x.signals.path===3))
  assert.equal(a.some(x=>x.item.id==='same-dir-noise'),false,'same-directory proximity alone must not widen task context')
})

test('C5 shared source-ref graph can surface a related PI record without lexical query match',()=>{
  const items=[
    pi('seed','Authentication contract uses bounded token parser',['src/auth/token.ts','src/auth/shared.ts']),
    pi('graph','Parser ownership lives in the auth module',['src/auth/shared.ts','src/auth/parser.ts']),
    pi('other','Database pool size is fixed',['src/db/pool.ts']),
  ]
  const hits=retrieveProjectIntelligence(items,{query:'bounded authentication token contract',files:['src/auth/token.ts'],consumer:'task-context',limit:5})
  const graph=hits.find(x=>x.item.id==='graph');assert.ok(graph);assert.ok(graph.signals.graph>0)
  assert.equal(hits.some(x=>x.item.id==='other'),false)
})

test('C5 filters stale non-active and consumer-ineligible records before scoring regardless of confidence',()=>{
  const items=[
    pi('fresh','ResultEnvelope error contract',['src/errors.ts'],{confidence:.2}),
    pi('stale','ResultEnvelope error contract',['src/errors.ts'],{confidence:1,freshness:'POTENTIALLY_STALE'}),
    pi('archived','ResultEnvelope error contract',['src/errors.ts'],{confidence:1,lifecycle:'ARCHIVED'}),
    {...pi('wrong-consumer','ResultEnvelope error contract',['src/errors.ts'],{confidence:1}),consumer_domains:[]},
  ]
  const hits=retrieveProjectIntelligence(items,{query:'ResultEnvelope error contract',files:['src/errors.ts'],consumer:'task-context',limit:10})
  assert.deepEqual(hits.map(x=>x.item.id),['fresh'])
})

test('C5 confidence ranks eligible knowledge but cannot manufacture retrieval relevance',()=>{
  const items=[pi('low','API request IDs are stable',['src/api/id.ts'],{confidence:.2}),pi('high-noise','Unrelated release note policy',['docs/release.md'],{confidence:1})]
  const hits=retrieveProjectIntelligence(items,{query:'stable API request IDs',files:['src/api/handler.ts'],consumer:'task-context',limit:5})
  assert.deepEqual(hits.map(x=>x.item.id),['low'])
})

test('C5 ProjectIntelligenceStore exposes derived retrieval without creating another store owner',()=>{
  const store=new ProjectIntelligenceStore();store.upsert(pi('p1','Errors use ResultEnvelope',['src/errors.ts']))
  const hit=store.retrieve('ResultEnvelope errors',['src/other.ts'],'task-context',3)[0]
  assert.equal(hit.item.id,'p1');assert.ok(hit.score>0);assert.equal(store.get('p1').statement,'Errors use ResultEnvelope')
})
