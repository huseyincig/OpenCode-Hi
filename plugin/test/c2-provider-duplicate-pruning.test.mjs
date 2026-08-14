import test from 'node:test'
import assert from 'node:assert/strict'
import { providerToolOutputSignature,pruneDuplicateProviderToolOutputs } from '../dist/runtime/context/provider-duplicate-pruning.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createMessagesTransformHook } from '../dist/hooks/messages-transform.js'
import { startAssessedMission } from './helpers/semantic.mjs'

function tool(callID,tool,input,output,{status='completed',metadata,attachments}={}){
  const state=status==='completed'?{status,input,output,title:tool,metadata:metadata??{},time:{start:1,end:2},...(attachments?{attachments}:{})}:{status:'error',input,error:output,metadata,time:{start:1,end:2}}
  return{id:`part-${callID}`,sessionID:'s',messageID:`m-${callID}`,type:'tool',callID,tool,state}
}
function message(role,parts,id){return{info:{role,id:id??`m-${role}`},parts}}

test('C2 canonical argument ordering and normalized read path produce the same signature',()=>{
  const output='x'.repeat(400)
  const a=tool('a','read',{filePath:'./src\\a.ts',offset:1,limit:20},output)
  const b=tool('b','read',{limit:20,offset:1,filePath:'src/a.ts'},output)
  assert.equal(providerToolOutputSignature(a),providerToolOutputSignature(b))
})

test('C2 keeps latest equivalent read result and compacts only older duplicate provider output',()=>{
  const output='same file content\n'.repeat(50)
  const original=[message('assistant',[tool('old','read',{filePath:'./src/a.ts'},output)],'m1'),message('assistant',[tool('new','read',{filePath:'src/a.ts'},output)],'m2')]
  const snapshot=structuredClone(original),result=pruneDuplicateProviderToolOutputs(original)
  assert.deepEqual(original,snapshot,'canonical/provider input objects must not be mutated in place')
  assert.deepEqual(result.pruned_call_ids,['old'])
  assert.match(result.messages[0].parts[0].state.output,/duplicate old output omitted/)
  assert.equal(result.messages[1].parts[0].state.output,output)
  assert.ok(result.after_chars<result.before_chars)
})

test('C2 does not dedupe a file read when observed content changes',()=>{
  const a='a'.repeat(500),b='b'.repeat(500),result=pruneDuplicateProviderToolOutputs([message('assistant',[tool('a','read',{path:'src/a.ts'},a)]),message('assistant',[tool('b','read',{path:'src/a.ts'},b)])])
  assert.deepEqual(result.pruned_call_ids,[])
})

test('C2 command output requires repository/workspace state identity before pruning',()=>{
  const output='status line\n'.repeat(60),input={command:'git status --short',cwd:'./repo',env:{CI:'1'}}
  const none=pruneDuplicateProviderToolOutputs([message('assistant',[tool('a','bash',input,output)]),message('assistant',[tool('b','bash',input,output)])])
  assert.deepEqual(none.pruned_call_ids,[],'same command+args without state identity must fail safe')
  const same=pruneDuplicateProviderToolOutputs([message('assistant',[tool('a','bash',input,output,{metadata:{repoStateHash:'r1'}})]),message('assistant',[tool('b','bash',input,output,{metadata:{repoStateHash:'r1'}})])])
  assert.deepEqual(same.pruned_call_ids,['a'])
  const changed=pruneDuplicateProviderToolOutputs([message('assistant',[tool('a','bash',input,output,{metadata:{repoStateHash:'r1'}})]),message('assistant',[tool('b','bash',input,output,{metadata:{repoStateHash:'r2'}})])])
  assert.deepEqual(changed.pruned_call_ids,[],'repository state change must prevent dedupe')
})


test('C2 unknown/stateful tool classes fail safe without explicit state identity and command signatures do not expose env values',()=>{
  const output='opaque output '.repeat(40)
  const generic=pruneDuplicateProviderToolOutputs([message('assistant',[tool('a','custom-tool',{value:1},output)]),message('assistant',[tool('b','custom-tool',{value:1},output)])])
  assert.deepEqual(generic.pruned_call_ids,[])
  const sig=providerToolOutputSignature(tool('cmd','bash',{command:'pwd',cwd:'/repo',env:{SECRET_TOKEN:'do-not-project'}},output,{metadata:{repoStateHash:'r1'}}))
  assert.ok(sig);assert.doesNotMatch(sig,/do-not-project|SECRET_TOKEN/)
})

test('C2 never prunes failed/error tool results or completed parts with attachments',()=>{
  const output='failure details '.repeat(50)
  const errors=pruneDuplicateProviderToolOutputs([message('assistant',[tool('a','read',{path:'src/a.ts'},output,{status:'error'})]),message('assistant',[tool('b','read',{path:'src/a.ts'},output,{status:'error'})])])
  assert.deepEqual(errors.pruned_call_ids,[])
  const attached=pruneDuplicateProviderToolOutputs([message('assistant',[tool('a','read',{path:'src/a.ts'},output,{attachments:[{type:'file'}]})]),message('assistant',[tool('b','read',{path:'src/a.ts'},output,{attachments:[{type:'file'}]})])])
  assert.deepEqual(attached.pruned_call_ids,[])
})

test('C2 avoids negative context economics for small duplicate outputs',()=>{
  const output='tiny',result=pruneDuplicateProviderToolOutputs([message('assistant',[tool('a','read',{path:'a'},output)]),message('assistant',[tool('b','read',{path:'a'},output)])])
  assert.deepEqual(result.pruned_call_ids,[]);assert.equal(result.after_chars,result.before_chars)
})

test('C2 messages transform prunes provider projection then appends Hi contract without mutating source messages',async()=>{
  const store=new MissionStore(process.cwd()),bg=new BackgroundRegistry();startAssessedMission(store,'s','opaque task')
  const outputText='duplicate read '.repeat(60)
  const source=[message('user',[{type:'text',text:'opaque task'}],'u1'),message('assistant',[tool('old','read',{filePath:'src/a.ts'},outputText)],'a1'),message('assistant',[tool('new','read',{filePath:'src/a.ts'},outputText)],'a2')]
  const snapshot=structuredClone(source),out={messages:source}
  await createMessagesTransformHook(store,bg)({sessionID:'s'},out)
  assert.deepEqual(source,snapshot,'hook must not rewrite source/canonical message objects')
  assert.match(out.messages[1].parts[0].state.output,/duplicate old output omitted/)
  assert.equal(out.messages[2].parts[0].state.output,outputText)
  assert.ok(out.messages[0].parts.some(p=>p.type==='text'&&/Hi CONTROL-PLANE CONTRACT/.test(p.text)))
})
