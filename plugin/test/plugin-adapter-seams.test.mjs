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

test('plugin adapter exposes the four composition seams and state-free event controller',()=>{
  assert.equal(typeof createHostPort,'function')
  assert.equal(typeof createRuntimeServices,'function')
  assert.equal(typeof createHiToolSurface,'function')
  assert.equal(typeof createOpenCodeHooks,'function')
  assert.equal(typeof RuntimeEventController,'function')
  const controller=readFileSync(resolve(root,'plugin/src/runtime/application/runtime-event-controller.ts'),'utf8')
  assert.doesNotMatch(controller,/new MissionStore|new TaskRuntime|new TeamRuntime|new Map<[^>]*(Mission|Task)/i)
  assert.match(controller,/constructor\(private readonly deps:/,'controller may retain injected collaborators only')
})

test('host entrypoints delegate application composition to the generation-neutral runtime seam',()=>{
  const source=readFileSync(resolve(root,'plugin/src/plugin.ts'),'utf8')
  const runtime=readFileSync(resolve(root,'plugin/src/runtime/application/plugin-runtime.ts'),'utf8')
  assert.ok(source.split('\n').length<=45,`plugin.ts remains too concentrated: ${source.split('\n').length} lines`)
  for(const seam of ['createHostPort','createOpenCodeHooks','createHiRuntime'])assert.ok(source.includes(seam),`missing V1 edge seam ${seam}`)
  for(const seam of ['createRuntimeServices','createHiToolSurface','RuntimeEventController'])assert.ok(runtime.includes(seam),`generation-neutral runtime missing composition seam ${seam}`)
  assert.doesNotMatch(source,/new MissionStore|new TaskRuntime|new TeamRuntime|normalizeOpenCodeEvent|nativeTool as tool/)
  assert.doesNotMatch(runtime,/@opencode-ai\//,'generation-neutral application composition must not import OpenCode package types')
})
