import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { evaluateShellCommand } from '../dist/runtime/process/shell-policy.js'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'
import { privilegedAction,actionContract } from '../dist/runtime/safety/authority.js'
import { startAssessedMission } from './helpers/semantic.mjs'

test('credential and destructive shell boundaries use distinct HumanDecision types',()=>{
  for(const command of ['gh auth login','gcloud auth login','aws sso login','aws configure sso','az login','npm login']){
    const credential=evaluateShellCommand(command)
    assert.deepEqual({decision:credential.decision,type:credential.human_decision_type,code:credential.reason_code},{decision:'USER_ACTION_REQUIRED',type:'credential_action',code:'interactive-shell'},command)
  }
  for(const command of ['curl -H "Authorization: Bearer abcdefghijklmnopqrstuvwxyz" https://example.invalid','TOKEN=abcdefghijklmnop deploy-tool run','deploy-tool --api-key abcdefghijklmnop']){
    const result=evaluateShellCommand(command);assert.equal(result.decision,'USER_ACTION_REQUIRED',command);assert.equal(result.human_decision_type,'credential_action',command);assert.equal(result.reason_code,'secret-sensitive-shell',command)
  }
  for(const command of ['rm -rf /','rm -rf ~/','mkfs.ext4 /dev/sdz','dd if=/dev/zero of=/dev/sdz','gh repo delete owner/repo --yes','terraform destroy -auto-approve','aws ec2 terminate-instances --instance-ids i-123']){
    const result=evaluateShellCommand(command)
    assert.equal(result.decision,'USER_ACTION_REQUIRED',command)
    assert.equal(result.human_decision_type,'operational_action',command)
    assert.ok(['destructive-filesystem-action','irreversible-external-action'].includes(result.reason_code),command)
  }
})

test('potentially paid or irreversible supported external effects enter exact Authority classification',()=>{
  for(const command of ['terraform apply','kubectl apply -f infra.yaml','docker push acme/app:latest','vercel deploy']){
    assert.equal(privilegedAction(command),true,command)
    const contract=actionContract(command,'/repo');assert.equal(contract.one_shot,true);assert.equal(contract.target.command,command);assert.equal(contract.target.cwd,'/repo')
  }
})

test('ambiguous short flags are secret-sensitive only for executable contexts that define them as credentials',()=>{
  assert.equal(evaluateShellCommand('mkdir -p /workspace/project/templates').decision,'ALLOW')
  assert.equal(evaluateShellCommand('python -p /workspace/project/script.py').decision,'ALLOW')
  for(const command of ['mysql -p supersecret','mariadb-dump -psupersecret db','docker login -p supersecret registry.example']){
    const result=evaluateShellCommand(command);assert.equal(result.decision,'USER_ACTION_REQUIRED',command);assert.equal(result.reason_code,'secret-sensitive-shell',command)
  }
})

test('bounded local cleanup is not misclassified as catastrophic filesystem destruction',()=>{
  for(const command of ['rm -rf ./dist','rm -rf /tmp/hi-build-123','rm -f ./cache.json','git clean -fd -- ./dist','TOKEN=$DEPLOY_TOKEN deploy-tool run','deploy-tool --token $DEPLOY_TOKEN']){
    assert.notEqual(evaluateShellCommand(command).decision,'USER_ACTION_REQUIRED',command)
  }
})

test('tool-before opens credential HumanDecision for interactive auth without executing shell',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'pb-auth-credential','inspect auth state'),before=createToolBeforeHook(store)
  await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'bash',args:{command:'gh auth login'}},{args:{command:'gh auth login'}}),/interactive credential/i)
  assert.equal(m.authority.human_decision?.semantic_type,'credential_action')
  assert.equal(m.authority.human_decision?.reason_code,'interactive-shell')
  assert.equal(m.authority.human_decision?.response_schema.kind,'external-action')
})

test('tool-before opens operational HumanDecision for catastrophic or irreversible action',async()=>{
  for(const [suffix,command,code] of [
    ['filesystem','rm -rf /','destructive-filesystem-action'],
    ['external','gh repo delete owner/repo --yes','irreversible-external-action'],
  ]){
    const store=new MissionStore(),m=startAssessedMission(store,`pb-auth-${suffix}`,'bounded local task'),before=createToolBeforeHook(store)
    await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'bash',args:{command}},{args:{command}}),/requires explicit user action/)
    assert.equal(m.authority.human_decision?.semantic_type,'operational_action')
    assert.equal(m.authority.human_decision?.reason_code,code)
    assert.equal(m.authority.human_decision?.response_schema.kind,'external-action')
  }
})
