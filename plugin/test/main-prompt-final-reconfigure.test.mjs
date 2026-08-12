import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHiConfig } from '../dist/config/resolver.js'
import { minimumTeamFor } from '../dist/runtime/routing/minimum-team.js'

const localIntent={objective:'fix local typo',taskKind:'implementation',risk:'low',scope:'local',ambiguity:'none',dependencyClass:'independent',requiredCapabilities:[],likelyVerification:['changed-surface-sanity']}
const broadIntent={objective:'change architecture across repo',taskKind:'implementation',risk:'medium',scope:'repo-wide',ambiguity:'none',dependencyClass:'sequential',requiredCapabilities:['design-exploration'],likelyVerification:['targeted-tests']}

test('primary mode config defaults to auto and preserves explicit manager/working-manager overrides',()=>{
  assert.equal(resolveHiConfig({}).primaryMode,'auto')
  assert.equal(resolveHiConfig({primaryMode:'manager'}).primaryMode,'manager')
  assert.equal(resolveHiConfig({primaryMode:'working-manager'}).primaryMode,'working-manager')
  assert.equal(resolveHiConfig({primaryMode:'invalid'}).primaryMode,'auto')
})

test('forced manager disables direct local path while forced working-manager remains primary for broad work',()=>{
  const auto=minimumTeamFor(localIntent,{requiredKinds:['changed-surface-sanity'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false},'auto')
  assert.equal(auto.primary,'working-manager'); assert.equal(auto.direct,true)
  const manager=minimumTeamFor(localIntent,{requiredKinds:['changed-surface-sanity'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false},'manager')
  assert.equal(manager.primary,'manager'); assert.equal(manager.direct,false)
  const working=minimumTeamFor(broadIntent,{requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false},'working-manager')
  assert.equal(working.primary,'working-manager'); assert.equal(working.direct,false); assert.ok(working.roles.includes('architect'))
})
