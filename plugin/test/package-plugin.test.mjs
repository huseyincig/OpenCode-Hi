import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import HiPlugin from '../dist/plugin.js'

test('git package config hook registers packaged agents and skills', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-package-'))
  try{
    const client={app:{log:async()=>{}},session:{},provider:{}}
    const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client})
    const config={plugin:['opencode-hi@git+https://github.com/huseyincig/OpenCode-Hi.git']}
    await hooks.config(config)
    for(const name of ['working-manager','manager','coder','repository-explorer','qa-reviewer','architect','security-reviewer','visual-qa']) assert.ok(config.agent?.[name],name)
    assert.equal('default_agent' in config,false,'Hi must not take ownership of host-global default_agent')
    assert.equal('subagent_depth' in config,false,'Hi recursion policy must not mutate host-global subagent_depth')
    assert.ok(Array.isArray(config.skills?.paths))
    assert.ok(config.skills.paths.some(x=>String(x).endsWith('/skills')||String(x).endsWith('\\skills')))
    await hooks.dispose?.()
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('public package manifest stays native direct-Git install friendly', async()=>{
  const pkg=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../../package.json',import.meta.url),'utf8'))
  const gitPreparationTriggers=['postinstall','build','preinstall','install','prepack','prepare']
  for(const name of gitPreparationTriggers) assert.equal(pkg.scripts?.[name],undefined,`root script ${name} forces pacote git dependency preparation`)
  assert.equal(pkg.scripts?.['build:plugin'],'npm --prefix plugin run build')
  assert.equal(pkg.peerDependencies?.['@opencode-ai/plugin'],'1.18.18')
  assert.equal(pkg.peerDependenciesMeta?.['@opencode-ai/plugin']?.optional,true)
  assert.equal(pkg.dependencies?.['@opencode-ai/sdk'],'1.18.18')
})

test('release readiness exercises exact-sha native direct-Git install on every platform', async()=>{
  const fs=await import('node:fs/promises')
  const workflow=await fs.readFile(new URL('../../.github/workflows/release-readiness.yml',import.meta.url),'utf8')
  assert.match(workflow,/Native direct-Git plugin install/)
  assert.match(workflow,/opencode-hi@git\+https:\/\/github\.com\/\$\{\{ github\.repository \}\}\.git#\$\{\{ github\.sha \}\}/)
  assert.match(workflow,/npm run test:direct-git-install/)
})

test('release readiness runs exact OpenCode native direct-Git host acceptance', async()=>{
  const fs=await import('node:fs/promises')
  const workflow=await fs.readFile(new URL('../../.github/workflows/release-readiness.yml',import.meta.url),'utf8')
  assert.match(workflow,/Exact OpenCode 1\.18\.18 native direct-Git host load/)
  assert.match(workflow,/npm run test:direct-git-host/)
})
