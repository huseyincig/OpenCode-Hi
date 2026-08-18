import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'

test('non-material assessment persists normalized intent instead of assessed/unclassified state',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-non-material-'))
  try{
    const store=new MissionStore(root),m=store.start('non-material-review','Review the bounded invariant')
    store.applyInitialSemanticAssessment('non-material-review',{material:false,message_kind:'non-material',task_kind:'review',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['review'],requested_external_actions:[],likely_verification:['review-evidence'],likely_targets:['src/security.js'],intent_signals:[],suppressed_intent_signals:[]})
    assert.equal(m.identity.status,'completed')
    assert.equal(m.identity.semantic_assessment.status,'assessed')
    assert.equal(m.identity.intent.taskKind,'review')
    assert.equal(m.identity.intent.scope,'local')
    assert.equal(m.identity.intent.risk,'low')
    assert.deepEqual(m.identity.intent.requiredCapabilities,['review'])
    assert.deepEqual(m.execution.obligations,[])
    const persistence=new RuntimePersistence(root)
    assert.doesNotThrow(()=>persistence.save(store.all()))
    const loaded=persistence.load()
    assert.equal(loaded.length,1)
    assert.equal(loaded[0].identity.intent.taskKind,'review')
    assert.equal(loaded[0].identity.status,'completed')
  }finally{rmSync(root,{recursive:true,force:true})}
})
