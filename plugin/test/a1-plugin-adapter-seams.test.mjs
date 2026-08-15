import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve,dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHostPort } from '../dist/opencode/host-port.js'
import { createRuntimeServices } from '../dist/runtime/application/runtime-services.js'
import { createHiToolSurface } from '../dist/runtime/application/hi-tool-surface.js'
import { RuntimeEventController } from '../dist/runtime/application/runtime-event-controller.js'
import { createOpenCodeHooks } from '../dist/opencode/open-code-hooks.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')

test('A1 plugin adapter exposes the four composition seams and state-free event controller',()=>{
  assert.equal(typeof createHostPort,'function')
  assert.equal(typeof createRuntimeServices,'function')
  assert.equal(typeof createHiToolSurface,'function')
  assert.equal(typeof createOpenCodeHooks,'function')
  assert.equal(typeof RuntimeEventController,'function')
  const controller=readFileSync(resolve(root,'plugin/src/runtime/application/runtime-event-controller.ts'),'utf8')
  assert.doesNotMatch(controller,/new MissionStore|new TaskRuntime|new TeamRuntime|new Map<[^>]*(Mission|Task)/i)
  assert.match(controller,/constructor\(private readonly deps:/,'controller may retain injected collaborators only')
})

test('A1 plugin.ts is a composition root rather than a second runtime owner',()=>{
  const source=readFileSync(resolve(root,'plugin/src/plugin.ts'),'utf8')
  assert.ok(source.split('\n').length<=50,`plugin.ts remains too concentrated: ${source.split('\n').length} lines`)
  for(const seam of ['createHostPort','createRuntimeServices','createHiToolSurface','createOpenCodeHooks','RuntimeEventController'])assert.ok(source.includes(seam),`missing composition seam ${seam}`)
  assert.doesNotMatch(source,/new MissionStore|new TaskRuntime|new TeamRuntime|normalizeOpenCodeEvent|nativeTool as tool/)
})
