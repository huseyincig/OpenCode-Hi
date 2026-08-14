import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateRoleCatalog,validateRoleContract} from '../dist/contracts/role.js'
import {HI_ROLE_CONTRACTS,HI_ROLE_IDS,HI_ROLE_PRIMARY_IDS,HI_ROLE_CHILD_IDS} from '../dist/generated/role-policy.js'
import {primaryRoleCanDirectImplementation} from '../dist/runtime/roles/catalog.js'

function sourceCatalog(){
  const raw=JSON.parse(readFileSync(new URL('../../data/hi-roles.json',import.meta.url),'utf8'))
  assert.equal(raw.schema,2);assert.equal(raw.type,'hi-role-contract-catalog')
  return raw.roles.map(role=>({id:role.id,purpose:role.purpose,roleClass:role.role_class,useWhen:role.use_when,doNotUseWhen:role.do_not_use_when,readOnly:role.read_only,reviewer:role.reviewer,repositoryWriteAuthority:role.repository_write_authority,obligationAuthority:role.obligation_authority,delegation:{mayDelegate:role.delegation.may_delegate,allowedRoleRefs:role.delegation.allowed_role_refs},permissionProfileRef:role.permission_profile_ref}))
}

test('canonical role JSON validates and exactly drives generated runtime role policy',()=>{
  const source=validateRoleCatalog(sourceCatalog())
  assert.deepEqual(source,structuredClone(HI_ROLE_CONTRACTS))
  assert.deepEqual(HI_ROLE_IDS,[...source.map(x=>x.id)])
  assert.deepEqual(HI_ROLE_PRIMARY_IDS,source.filter(x=>x.roleClass==='primary').map(x=>x.id))
  assert.deepEqual(HI_ROLE_CHILD_IDS,source.filter(x=>x.roleClass==='child').map(x=>x.id))
})

test('RoleContract rejects safety and authority contradictions',()=>{
  const base=structuredClone(HI_ROLE_CONTRACTS.find(x=>x.id==='qa-reviewer'))
  assert.throws(()=>validateRoleContract({...base,repositoryWriteAuthority:'scoped'}),/read-only role must have none/)
  assert.throws(()=>validateRoleContract({...base,obligationAuthority:['verification']}),/reviewer role must own review/)
  assert.throws(()=>validateRoleContract({...base,unknown:true}),/unknown field/)
})

test('RoleContract catalog rejects unknown delegation and duplicate identity',()=>{
  const all=structuredClone(HI_ROLE_CONTRACTS)
  const wm=all.find(x=>x.id==='working-manager')
  wm.delegation.allowedRoleRefs=[...wm.delegation.allowedRoleRefs,'missing-role']
  assert.throws(()=>validateRoleCatalog(all),/unknown role missing-role/)
  assert.throws(()=>validateRoleCatalog([...structuredClone(HI_ROLE_CONTRACTS),structuredClone(HI_ROLE_CONTRACTS[0])]),/duplicate canonical role id/)
})


test('primary direct implementation authority is derived from canonical RoleContract write authority',()=>{
  assert.equal(primaryRoleCanDirectImplementation('working-manager'),true)
  assert.equal(primaryRoleCanDirectImplementation('manager'),false)
  assert.equal(primaryRoleCanDirectImplementation('coder'),false)
  assert.equal(primaryRoleCanDirectImplementation('foreign-role'),false)
})
