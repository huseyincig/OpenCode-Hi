import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import HhcPlugin from '../dist/plugin.js'

test('git package config hook registers packaged agents and skills', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hhc-package-'))
  try{
    const client={app:{log:async()=>{}},session:{},provider:{}}
    const hooks=await HhcPlugin({directory:dir,worktree:dir,project:{},client})
    const config={plugin:['opencode-hhc-orchestrator@git+https://github.com/huseyincig/OpenCode-HHC-Orchestrator.git']}
    await hooks.config(config)
    for(const name of ['working-manager','manager','coder','repository-explorer','qa-reviewer','architect','security-reviewer','visual-qa']) assert.ok(config.agent?.[name],name)
    assert.equal(config.default_agent,'working-manager')
    assert.equal(config.subagent_depth,1)
    assert.ok(Array.isArray(config.skills?.paths))
    assert.ok(config.skills.paths.some(x=>String(x).endsWith('/skills')||String(x).endsWith('\\skills')))
    await hooks.dispose?.()
  }finally{rmSync(dir,{recursive:true,force:true})}
})
