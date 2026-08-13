import test from 'node:test'
import assert from 'node:assert/strict'
import { PACKAGED_HI_AGENTS } from '../dist/generated/agent-config.js'
import { HI_METHODOLOGY_POLICY } from '../dist/generated/methodology-policy.js'

const byName=new Map(HI_METHODOLOGY_POLICY.map(item=>[item.name,item]))

test('generated role methodology permissions are default-deny and exactly compatible with canonical methodology policy',()=>{
  for(const [role,agent] of Object.entries(PACKAGED_HI_AGENTS)){
    const permission=agent.permission.skill
    assert.equal(permission['*'],'deny',`${role} must default-deny native skills`)
    const allowed=Object.entries(permission).filter(([name,value])=>name!=='*'&&value==='allow').map(([name])=>name)
    for(const name of allowed){
      const policy=byName.get(name)
      assert.ok(policy,`${role} allows unknown methodology ${name}`)
      assert.ok(policy.compatibleRoles.includes(role),`${role} allows incompatible methodology ${name}`)
    }
    for(const policy of HI_METHODOLOGY_POLICY){
      if(policy.compatibleRoles.includes(role))assert.equal(permission[policy.name],'allow',`${role} must allow compatible methodology ${policy.name}`)
    }
  }
})

test('every built-in methodology has at least one executable role permission surface',()=>{
  for(const policy of HI_METHODOLOGY_POLICY){
    assert.ok(policy.compatibleRoles.length>0,`${policy.name} has no compatible role`)
    assert.ok(policy.compatibleRoles.some(role=>PACKAGED_HI_AGENTS[role]?.permission?.skill?.[policy.name]==='allow'),`${policy.name} is unreachable from role permissions`)
  }
})
