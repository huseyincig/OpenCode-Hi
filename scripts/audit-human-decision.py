#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-human-decision.json'
rows=[];violations=[]
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def add(name,owner,owner_anchor,proof,proof_anchor):
    op,pp=ROOT/owner,ROOT/proof
    if not op.is_file():violations.append(f'{name}:missing-owner:{owner}');return
    if not pp.is_file():violations.append(f'{name}:missing-proof:{proof}');return
    ot,pt=op.read_text(errors='replace'),pp.read_text(errors='replace')
    if owner_anchor not in ot:violations.append(f'{name}:owner-anchor-drift')
    if proof_anchor not in pt:violations.append(f'{name}:proof-anchor-drift')
    rows.append({'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':owner_anchor,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':proof_anchor})
add('semantic-decision-not-transport','plugin/src/runtime/human-decision/runtime.ts','m.authority.human_decision=decision','plugin/test/h1-human-decision-transport.test.mjs','transport-only and never resolve canonical HumanDecision state')
add('typed-choice','plugin/src/runtime/human-decision/transport.ts',"if(kind==='choice')",'plugin/test/h1-human-decision-transport.test.mjs','typed choice rejects invalid chat input')
add('freeform-bounded-to-semantic-plane','plugin/src/runtime/human-decision/runtime.ts',"return{semantic_type:'value_judgment',response_schema:{kind:'free-text'}}",'plugin/test/human-decision-contract.test.mjs','authority HumanDecision requires exact authority semantics')
add('timeout-is-transport-only','plugin/src/runtime/human-decision/transport.ts',"status:'TIMEOUT'",'plugin/test/h1-human-decision-transport.test.mjs','timeout and cancel are transport-only')
add('cancellation-is-transport-only','plugin/src/runtime/human-decision/transport.ts','cancel(decisionId:string)','plugin/test/h1-human-decision-transport.test.mjs','timeout and cancel are transport-only')
add('stale-answer-rejected','plugin/src/runtime/human-decision/transport.ts',"entry.handle.state!=='OPEN'",'plugin/test/h1-human-decision-transport.test.mjs','stale answer to a replaced HumanDecision')
add('duplicate-answer-idempotency','plugin/src/runtime/human-decision/transport.ts',"state:'RESPONDED'",'plugin/test/h1-human-decision-transport.test.mjs','duplicate/conflicting replies are inert')
add('conflicting-answer-first-wins','plugin/src/runtime/human-decision/transport.ts','entry.response=response','plugin/test/h1-human-decision-transport.test.mjs','duplicate/conflicting replies are inert')
add('restart-no-transport-replay','plugin/src/runtime/application/runtime-services.ts','new ChatHumanDecisionTransport()','plugin/test/h1-human-decision-transport.test.mjs','restart reopens persisted semantic decision but never replays stale ephemeral transport response')
add('question-provenance','plugin/src/contracts/human-decision.ts','blocking_scope:HumanDecisionScope','plugin/test/human-decision-contract.test.mjs','identity and provenance bind exact blocked task/worker scope')
add('exact-blocked-decision-relation','plugin/src/runtime/completion/evaluator.ts','human-decision:','plugin/test/human-decision-contract.test.mjs','open operational HumanDecision blocks deterministic completion')
add('source-resolvable-not-asked','plugin/src/runtime/continuation/evaluator.ts','Resolve the contract-critical ambiguity from repository structure','plugin/test/main-prompt-delegation-preconditions.test.mjs','source-resolvable ambiguity must not ask the user')
add('no-accidental-authority-grant','plugin/src/contracts/human-decision.ts',"authorityDecision=v.semantic_type==='authority_request'",'plugin/test/human-decision-contract.test.mjs','operational HumanDecision response never creates or approves Authority state')
add('idle-does-not-reclassify-open-decision','plugin/src/runtime/application/runtime-event-controller.ts',"m.authority.human_decision?.status!=='OPEN'",'plugin/test/p3-process-control-integration.test.mjs','parent idle preserves an existing canonical operational HumanDecision')
add('structured-host-ui-truthful-unsupported','plugin/src/contracts/host-capability.ts',"unsupported('structured-human-decision-transport'",'plugin/test/h2-structured-human-decision-host.test.mjs','structured host UI remains unsupported')
# Static semantic coherence guards.
contract=(ROOT/'plugin/src/contracts/human-decision.ts').read_text()
runtime=(ROOT/'plugin/src/runtime/human-decision/runtime.ts').read_text()
transport=(ROOT/'plugin/src/runtime/human-decision/transport.ts').read_text()
if "authorityDecision&&(!nonempty(v.authority_ref)||response.kind!=='authority-protocol')" not in contract:violations.append('authority-request-coherence-guard-missing')
if "!authorityDecision&&(v.authority_ref!==undefined||response.kind==='authority-protocol')" not in contract:violations.append('non-authority-impersonation-guard-missing')
if "if(!isHumanDecisionContract(decision))throw" not in runtime:violations.append('open-human-decision-self-validation-missing')
if 'writeFile' in transport or 'RuntimePersistence' in transport:violations.append('transport-persistence-owner-leak')
status='PASS' if not violations and len(rows)==15 else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_HUMAN_DECISION_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':15,'status':status,'invariants':rows,'violations':violations,'summary':{'required':15,'covered':len(rows),'violations':len(violations)},'closed_defects':[{'id':'idle-human-decision-authority-reclassification','fix':'RuntimeEventController preserves an already-open canonical HumanDecision instead of classifying USER_ACTION_REQUIRED again.'},{'id':'authority-request-semantic-coherence','fix':'authority_request requires exact authority_ref + authority-protocol; non-authority decisions cannot carry either.'},{'id':'reason-label-authority-inference','fix':'Runtime reason labels can no longer manufacture authority_request; exact Authority owners create protocol-bound decisions directly.'}],'claim_boundary':'HumanDecision owns semantic blocked-decision state; chat/host UI is transport only. Transport timeout/cancel/reply never grants Authority by itself, and OpenCode structured host UI remains explicitly unsupported.'}
OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f'human decision audit {status}: covered={len(rows)}/15 violations={len(violations)}')
if violations:print(json.dumps(data,indent=2))
sys.exit(0 if status=='PASS' else 1)
