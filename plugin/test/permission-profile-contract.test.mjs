import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validatePermissionProfileCatalog,validateRolePermissionBindings} from '../dist/contracts/permission-profile.js'
import {HI_PERMISSION_PROFILES} from '../dist/generated/permission-policy.js'
import {HI_ROLE_CONTRACTS} from '../dist/generated/role-policy.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'

function sourceProfiles(){
  const raw=JSON.parse(readFileSync(new URL('../../data/hi-permission-profiles.json',import.meta.url),'utf8'))
  assert.equal(raw.schema,1);assert.equal(raw.type,'hi-permission-profile-catalog')
  return raw.profiles.map(p=>({id:p.id,rules:p.rules,safetyClass:p.safety_class,mayBeWidenedByLowerLayer:p.may_be_widened_by_lower_layer,hostMappingRequirements:p.host_mapping_requirements}))
}
function native(profile){
  const out={}
  for(const rule of profile.rules){
    if(rule.pattern===undefined)out[rule.capability]=rule.action
    else (out[rule.capability]??={})[rule.pattern]=rule.action
  }
  return out
}

test('canonical PermissionProfile catalog validates and exactly drives non-methodology native permissions',()=>{
  const profiles=validatePermissionProfileCatalog(sourceProfiles())
  assert.deepEqual(profiles,structuredClone(HI_PERMISSION_PROFILES))
  validateRolePermissionBindings(structuredClone(HI_ROLE_CONTRACTS),profiles)
  const byId=new Map(profiles.map(p=>[p.id,p]))
  for(const role of HI_ROLE_CONTRACTS){
    const expected=native(byId.get(role.permissionProfileRef));const actual=structuredClone(PACKAGED_HI_AGENTS[role.id].permission);delete actual.skill
    assert.deepEqual(actual,expected,`${role.id}: native permission projection drift`)
  }
})

test('PermissionProfile safety is fail-closed for widening, duplicate rules, methodology ownership and read-only edit',()=>{
  const base=structuredClone(HI_PERMISSION_PROFILES[0])
  assert.throws(()=>validatePermissionProfileCatalog([{...base,mayBeWidenedByLowerLayer:true}]),/must be false/)
  assert.throws(()=>validatePermissionProfileCatalog([{...base,rules:[...base.rules,structuredClone(base.rules[0])]}]),/duplicate capability\/pattern/)
  const withSkill=validatePermissionProfileCatalog([{...base,id:'bad-skill-owner',rules:[...base.rules,{capability:'skill',action:'allow',pattern:'hi-code-review'}]}])
  assert.throws(()=>validateRolePermissionBindings([],withSkill),/skill permission belongs to MethodologyContract/)
  const writable=validatePermissionProfileCatalog([{...base,id:'bad-readonly',rules:base.rules.map(r=>r.capability==='edit'?{...r,action:'allow'}:r)}])
  assert.throws(()=>validateRolePermissionBindings([{id:'reader',readOnly:true,permissionProfileRef:'bad-readonly'}],writable),/must explicitly deny edit/)
  assert.throws(()=>validateRolePermissionBindings([{id:'reader',readOnly:true,permissionProfileRef:'missing'}],validatePermissionProfileCatalog([base])),/unknown permission profile/)
})

test('role Markdown no longer owns mechanical permissions',()=>{
  for(const role of HI_ROLE_CONTRACTS){
    const text=readFileSync(new URL(`../../roles/${role.id}.md`,import.meta.url),'utf8')
    const fm=text.split('\n---\n',1)[0]
    assert.doesNotMatch(fm,/^permission:\s*$/m,role.id)
  }
})
