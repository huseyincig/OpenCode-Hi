import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {LocalPreviewManager} from '../dist/runtime/browser/local-preview.js'

test('Hi local preview is loopback-only, scope-bounded, reusable, and cleanup-owned',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-preview-'));mkdirSync(join(root,'assets'));writeFileSync(join(root,'index.html'),'<!doctype html><script src="assets/app.js"></script><canvas></canvas>');writeFileSync(join(root,'assets/app.js'),'globalThis.previewLoaded=true');writeFileSync(join(root,'.secret'),'nope');writeFileSync(join(root,'other.txt'),'not in task scope')
  const preview=new LocalPreviewManager(root)
  try{
    const first=await preview.start('t1','index.html',['index.html','assets/'])
    assert.match(first.origin,/^http:\/\/127\.0\.0\.1:\d+$/);assert.equal(first.reused,false);assert.equal(preview.active('t1'),true)
    const html=await fetch(first.url);assert.equal(html.status,200);assert.match(await html.text(),/<canvas>/)
    const asset=await fetch(first.origin+'/assets/app.js');assert.equal(asset.status,200);assert.match(await asset.text(),/previewLoaded/)
    const hidden=await fetch(first.origin+'/.secret');assert.equal(hidden.status,403)
    const outsideScope=await fetch(first.origin+'/other.txt');assert.equal(outsideScope.status,403)
    const reused=await preview.start('t1','index.html',['index.html','assets/']);assert.equal(reused.reused,true);assert.equal(reused.origin,first.origin)
    await assert.rejects(()=>preview.start('t2','../outside.html',['index.html']),/bounded project-relative path/)
    await assert.rejects(()=>preview.start('t2','assets/app.js',['index.html']),/outside the visual task scope/)
    assert.equal(await preview.stop('t1'),true);assert.equal(preview.active('t1'),false)
  }finally{await preview.dispose();rmSync(root,{recursive:true,force:true})}
})


test('local preview reuse refreshes an expanded task scope instead of serving from the stale lease policy',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-preview-scope-refresh-'));mkdirSync(join(root,'assets'));writeFileSync(join(root,'index.html'),'index');writeFileSync(join(root,'assets/app.js'),'expanded')
  const preview=new LocalPreviewManager(root)
  try{
    const first=await preview.start('scope-task','index.html',['index.html'])
    assert.equal((await fetch(first.origin+'/assets/app.js')).status,403)
    const expanded=await preview.start('scope-task','assets/app.js',['index.html','assets/'])
    assert.equal(expanded.reused,false,'scope policy drift must replace the prior preview lease')
    assert.equal((await fetch(expanded.url)).status,200,'same-task preview must enforce the current expanded task scope, not the stale creation scope')
  }finally{await preview.dispose();rmSync(root,{recursive:true,force:true})}
})
