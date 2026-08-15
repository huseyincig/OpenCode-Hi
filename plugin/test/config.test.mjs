import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHiConfig } from '../dist/config/resolver.js'

test('config defaults are adaptive and bounded', () => {
  const config = resolveHiConfig(undefined)
  assert.equal(config.executionPolicy, 'adaptive')
  assert.equal(config.parallel.max, 3)
  assert.equal('auto' in config.teamMode, false)
})

test('parallel max is clamped', () => {
  assert.equal(resolveHiConfig({ parallel: { max: 999 } }).parallel.max, 8)
  assert.equal(resolveHiConfig({ parallel: { max: 0 } }).parallel.max, 1)
})


test('PROMPT B §23 unknown and invalid host profile leaves never enter canonical runtime config',()=>{
  const cfg=resolveHiConfig({surprise:'ignored',profile:{balanced:{specialistThreshold:'evil',reviewThreshold:'medium',surprise:'ignored'},unknown:{specialistThreshold:'low'}},routing:{surprise:true}})
  assert.deepEqual(cfg.profile.balanced,{specialistThreshold:'medium',reviewThreshold:'medium'})
  assert.deepEqual(Object.keys(cfg.profile).sort(),['balanced','minimal','thorough'])
  assert.equal('surprise' in cfg,false)
  assert.equal('surprise' in cfg.routing,false)
  assert.equal('surprise' in cfg.profile.balanced,false)
})
