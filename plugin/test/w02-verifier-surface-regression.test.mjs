import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {collectRepoContext} from '../dist/runtime/intent/repo-context.js'
import {parseSemanticIntentAssessment,resolveAdaptiveVerificationAssessment} from '../dist/runtime/intent/semantic-assessment.js'
import {verificationCommandKind} from '../dist/runtime/evidence/evidence-runtime.js'
import {discoverVerificationRoutes} from '../dist/runtime/verification/discovery.js'

function fixture(){
  const root=mkdtempSync(join(tmpdir(),'hi-w02-verifier-surface-'))
  writeFileSync(join(root,'file_manager.py'),'print("seed")\n')
  mkdirSync(join(root,'test'))
  writeFileSync(join(root,'test','test_public.py'),'import unittest\nclass T(unittest.TestCase):\n    def test_ok(self): self.assertTrue(True)\n')
  writeFileSync(join(root,'README.md'),'Public regression: `python3 -m unittest discover -s test -v`\n')
  return root
}

test('W02 regression: manifest-free Python + unittest is a real repo verification surface',()=>{
  const root=fixture()
  try{
    const repo=collectRepoContext(root,{directory:root,worktree:root,project:{id:'w02',vcs:'git'}})
    assert.ok(repo.ecosystems.includes('python'))
    assert.ok(repo.markers.includes('python-files'))
    assert.ok(repo.markers.includes('test/'))
    assert.ok(repo.likelyVerification.includes('unittest'))
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('W02 regression: bounded medium material work filters unavailable inferred build/check against repo surface even when model scope is multi-file',()=>{
  const root=fixture()
  try{
    const repo=collectRepoContext(root,{directory:root,worktree:root,project:{id:'w02',vcs:'git'}})
    const proposed=parseSemanticIntentAssessment({
      material:true,message_kind:'mission',task_kind:'implementation',scope:'multi-file',risk:'medium',ambiguity:'resolvable',dependency_class:'sequential',
      required_capabilities:['implementation','security-review','verification'],requested_external_actions:[],
      likely_verification:['targeted-tests','build','changed-surface-sanity'],user_verification:[],verification_ceiling:false,
      likely_targets:['file_manager.py'],intent_signals:[],suppressed_intent_signals:[],constraint_atoms:[],
    })
    const resolved=resolveAdaptiveVerificationAssessment(proposed,'Mevcut public testleri çalıştır, gerekiyorsa minimum ek test yaz.',repo)
    assert.equal(resolved.policy,'local-capability-surface')
    assert.deepEqual(resolved.assessment.likely_verification,['targeted-tests'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('W02 regression: python unittest invocation is canonical targeted-test evidence',()=>{
  assert.equal(verificationCommandKind('python3 -m unittest discover -s test -v'),'targeted-tests')
})

test('W02 regression: control projection discovers the declared repo-native unittest route',()=>{
  const root=fixture()
  try{
    const routes=discoverVerificationRoutes(root,['file_manager.py'])
    assert.ok(routes.some(r=>r.evidenceKind==='targeted-tests'&&r.command==='python3 -m unittest discover -s test -v'&&r.source==='targeted-test'),JSON.stringify(routes))
  }finally{rmSync(root,{recursive:true,force:true})}
})
