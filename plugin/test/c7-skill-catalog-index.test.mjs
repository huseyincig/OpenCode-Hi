import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,mkdirSync,writeFileSync,rmSync,statSync,utimesSync,readFileSync,realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { SkillCatalogIndex } from '../dist/runtime/skills/catalog-index.js'

const skillText=(name,description='indexed proof',body='bodyA')=>`---\nname: ${name}\ndescription: ${description}\nlicense: MIT\n---\n${body}\n`
const sha=text=>createHash('sha256').update(text).digest('hex')

function fixture(){const project=mkdtempSync(join(tmpdir(),'hi-c7-project-')),hiRoot=mkdtempSync(join(tmpdir(),'hi-c7-hi-'));mkdirSync(join(project,'.opencode','skills'),{recursive:true});mkdirSync(join(hiRoot,'skills'),{recursive:true});return{project,hiRoot,cleanup:()=>{rmSync(project,{recursive:true,force:true});rmSync(hiRoot,{recursive:true,force:true})}}}

test('C7 SkillCatalogIndex records canonical metadata frontmatter resources and validity',()=>{
  const f=fixture();try{
    const name='hi-c7-metadata',dir=join(f.hiRoot,'skills',name),file=join(dir,'SKILL.md'),refs=join(dir,'references')
    mkdirSync(refs,{recursive:true});const text=skillText(name);writeFileSync(file,text);writeFileSync(join(refs,'guide.md'),'guide')
    const index=new SkillCatalogIndex(f.project,f.hiRoot),record=index.records({}).find(x=>x.skill_id===name)
    assert.ok(record);assert.equal(record.provider,'hi');assert.equal(record.skill_path,file);assert.equal(record.realpath,realpathSync(file));assert.ok(record.mtime_ms>0);assert.equal(record.content_sha256,sha(text));assert.equal(record.frontmatter.name,name);assert.equal(record.frontmatter.description,'indexed proof');assert.equal(record.frontmatter.license,'MIT');assert.equal(record.valid,true)
    assert.deepEqual(record.resource_map.map(x=>`${x.kind}:${x.relativePath}`),['references:guide.md'])
    const invalid='hi-c7-invalid',invalidDir=join(f.hiRoot,'skills',invalid);mkdirSync(invalidDir);writeFileSync(join(invalidDir,'SKILL.md'),'---\nname: wrong\ndescription: invalid\n---\nbody\n')
    const bad=index.records({}).find(x=>x.skill_id===invalid);assert.ok(bad);assert.equal(bad.valid,false)
  }finally{f.cleanup()}
})

test('C7 repeated reads fingerprint the cache without repeating full discovery scans',()=>{
  const f=fixture();try{
    const dir=join(f.hiRoot,'skills','hi-c7-cache');mkdirSync(dir);writeFileSync(join(dir,'SKILL.md'),skillText('hi-c7-cache'))
    const index=new SkillCatalogIndex(f.project,f.hiRoot);index.records({});const first=index.diagnostics();index.candidates({});index.records({});const after=index.diagnostics()
    assert.equal(first.full_scans,1);assert.equal(after.full_scans,1);assert.ok(after.fingerprint_checks>=2);assert.equal(after.cached_records,1)
  }finally{f.cleanup()}
})

test('C7 content hash drift invalidates even when SKILL mtime and size are preserved',()=>{
  const f=fixture();try{
    const name='hi-c7-hash',dir=join(f.hiRoot,'skills',name),file=join(dir,'SKILL.md');mkdirSync(dir);const beforeText=skillText(name,'first proof','bodyA');const afterText=skillText(name,'other proof','bodyB');assert.equal(beforeText.length,afterText.length);writeFileSync(file,beforeText)
    const index=new SkillCatalogIndex(f.project,f.hiRoot),before=index.records({}).find(x=>x.skill_id===name),saved=statSync(file);writeFileSync(file,afterText);utimesSync(file,saved.atime,saved.mtime)
    const after=index.records({}).find(x=>x.skill_id===name);assert.ok(before&&after);assert.notEqual(before.content_sha256,after.content_sha256);assert.equal(after.content_sha256,sha(afterText));assert.equal(index.diagnostics().full_scans,2)
  }finally{f.cleanup()}
})

test('C7 detects SKILL installation into a pre-existing child directory and resource-map changes',()=>{
  const f=fixture();try{
    const root=join(f.hiRoot,'skills'),name='hi-c7-install',dir=join(root,name);mkdirSync(dir);const index=new SkillCatalogIndex(f.project,f.hiRoot);assert.equal(index.records({}).some(x=>x.skill_id===name),false)
    writeFileSync(join(dir,'SKILL.md'),skillText(name));const future=new Date(Date.now()+2500);utimesSync(dir,future,future)
    let record=index.records({}).find(x=>x.skill_id===name);assert.ok(record);assert.equal(index.diagnostics().full_scans,2)
    const refs=join(dir,'references');mkdirSync(refs);writeFileSync(join(refs,'one.md'),'one');utimesSync(dir,new Date(Date.now()+5000),new Date(Date.now()+5000));record=index.records({}).find(x=>x.skill_id===name);assert.deepEqual(record.resource_map.map(x=>x.relativePath),['one.md'])
    writeFileSync(join(refs,'two.md'),'two');utimesSync(refs,new Date(Date.now()+7500),new Date(Date.now()+7500));record=index.records({}).find(x=>x.skill_id===name);assert.deepEqual(record.resource_map.map(x=>x.relativePath),['one.md','two.md'])
  }finally{f.cleanup()}
})

test('C7 config path changes and admitted project methodology surfaces trigger bounded refresh',()=>{
  const f=fixture();const extra=mkdtempSync(join(tmpdir(),'hi-c7-extra-'));try{
    const name='external-c7',dir=join(extra,name);mkdirSync(dir);writeFileSync(join(dir,'SKILL.md'),skillText(name))
    const index=new SkillCatalogIndex(f.project,f.hiRoot);index.records({});assert.equal(index.diagnostics().full_scans,1)
    const records=index.records({skills:{paths:[extra]}});assert.ok(records.some(x=>x.skill_id===name&&x.provider==='personal'));assert.equal(index.diagnostics().full_scans,2)
    assert.equal(index.invalidateChanged(['src/a.ts']),false)
    assert.equal(index.invalidateChanged(['.opencode/hi/policy/methodologies/hi-project-proof.json']),true)
    index.records({skills:{paths:[extra]}});assert.equal(index.diagnostics().full_scans,3)
    assert.equal(index.invalidateChanged(['.opencode/skills/hi-project-proof/references/guide.md']),true)
  }finally{f.cleanup();rmSync(extra,{recursive:true,force:true})}
})

test('C7 OpenCode config hook eagerly refreshes the existing runtime-scoped SkillCatalogIndex',()=>{
  const source=readFileSync(new URL('../src/opencode/open-code-hooks.ts',import.meta.url),'utf8')
  const scoped=readFileSync(new URL('../src/runtime/application/runtime-scoped-stores.ts',import.meta.url),'utf8')
  assert.match(source,/services\.scopedStores\.skillCatalog\.refresh\(opencodeConfig\)/)
  assert.doesNotMatch(source,/skillCatalog\.invalidate\(\)\s*\n\s*reconfigureToolSurface/)
  assert.match(scoped,/skillCatalog:new SkillCatalogIndex\(projectRoot,hiRoot\)/)
})
