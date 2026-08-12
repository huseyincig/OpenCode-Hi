import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHiConfigWithReport } from '../dist/config/resolver.js'

test('unknown legacy superpowers config has no executable compatibility path',()=>{
  const clean=resolveHiConfigWithReport({})
  const legacy=resolveHiConfigWithReport({superpowers:{enabled:true,policy:'anything'}})
  assert.deepEqual(legacy.config,clean.config)
  assert.equal(legacy.report.notes.some(x=>/superpowers/i.test(x)),false)
})
