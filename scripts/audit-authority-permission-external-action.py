#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-authority-permission-external-action.json'
def sha(path): return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
checks=[
 ('generic-yes-not-authority','plugin/src/runtime/safety/authority.ts','approvePendingAuthority(m:MissionState,input:unknown)','plugin/test/authority-input-split.test.mjs','plain approval prose is not an authority response'),
 ('continuation-not-approval','plugin/src/hooks/chat-message.ts',"openDecision?.semantic_type==='authority_request'",'plugin/test/threat-model.test.mjs','T01 generic continuation cannot approve privileged action'),
 ('exact-action-scope','plugin/src/runtime/safety/authority.ts','actionContract(command:string,cwd?:string)','plugin/test/authority-contract.test.mjs','exact Authority action contract binds semantic action, target, command and cwd into one hash identity'),
 ('exact-target','plugin/src/runtime/safety/authority.ts',"target={cwd:cwd??'',command:command.trim()}",'plugin/test/q2-critical-invariant-guards.test.mjs','Q2 authority approval is bound to the exact action hash'),
 ('exact-parameters','plugin/src/runtime/safety/authority.ts','payloadHash(action)','plugin/test/authority-side-effect-idempotency.test.mjs','separate privileged action hashes own separate authority obligations'),
 ('once-vs-reusable','plugin/src/runtime/safety/project-authority.ts','PersistentAuthorityClass','plugin/test/project-authority-persistence.test.mjs','release-create persistent authority is distinct from git-push authority'),
 ('consumed-authority','plugin/src/runtime/safety/authority.ts','beginAuthorizedAction','plugin/test/authority-side-effect-idempotency.test.mjs','privileged bash success requires explicit exit=0 metadata'),
 ('replay-idempotency','plugin/src/runtime/safety/authority.ts',"completed_hashes??[]",'plugin/test/external-side-effect-real-git.test.mjs','real bare-remote push with lost ACK is not blindly retried and is reconciled by remote proof'),
 ('deny-precedence','plugin/src/runtime/safety/project-authority.ts','applyProjectAuthorityPermissions','plugin/test/project-authority-persistence.test.mjs','user explicit deny is never weakened by persistent Hi grant'),
 ('lower-level-cannot-widen-safety','plugin/src/runtime/routing/execution-profile.ts','promptToolOverrides','plugin/test/main-prompt-execution-profile-tools.test.mjs','prompt tool overrides only disable tools; they never turn a denied native permission into allow'),
 ('host-permission-cannot-widen-hi-authority','plugin/src/runtime/process/authority.ts','external_directory','plugin/test/p2-opencode-pty-executor.test.mjs','P2 external cwd requires explicit external_directory allow and external effects require matching ExternalAction authority'),
 ('stale-approvals-rejected','plugin/src/runtime/safety/authority.ts','AUTHORITY_APPROVAL_TTL_MS','plugin/test/authority-input-split.test.mjs','expired pending authority request rejects even a structurally exact response'),
 ('credential-mfa-oauth-boundary','plugin/src/runtime/process/shell-policy.ts','aws\\s+(?:sso\\s+login|configure\\s+sso|login)','plugin/test/prompt-b-authority-destructive-boundary.test.mjs','PROMPT B credential and destructive shell boundaries use distinct HumanDecision types'),
 ('paid-irreversible-boundary','plugin/src/runtime/process/shell-policy.ts','IRREVERSIBLE_EXTERNAL','plugin/test/prompt-b-authority-destructive-boundary.test.mjs','PROMPT B potentially paid or irreversible supported external effects enter exact Authority classification'),
 ('push-tag-release-publish-deploy-authority','plugin/src/runtime/safety/command-classifier.ts','ExternalCommandKind','plugin/test/project-authority-persistence.test.mjs','global ask does not spam autonomous local commit/merge steps; external push remains the single authority hinge'),
 ('destructive-filesystem-boundary','plugin/src/runtime/process/shell-policy.ts','CATASTROPHIC_FILESYSTEM','plugin/test/prompt-b-authority-destructive-boundary.test.mjs','PROMPT B tool-before opens operational HumanDecision for catastrophic or irreversible action'),
 ('secret-sensitive-boundary','plugin/src/runtime/process/shell-policy.ts','SECRET_SENSITIVE','plugin/test/prompt-b-authority-destructive-boundary.test.mjs','PROMPT B credential and destructive shell boundaries use distinct HumanDecision types'),
 ('no-natural-language-regex-authority','plugin/src/runtime/human-decision/transport.ts',"kind==='authority-protocol'",'plugin/test/authority-input-split.test.mjs','structured exact authority response advances only the matching pending action'),
]
violations=[]; rows=[]
for name,owner,owner_anchor,proof,proof_anchor in checks:
    op=ROOT/owner; pp=ROOT/proof
    if not op.is_file(): violations.append(f'{name}:missing-owner:{owner}'); continue
    if not pp.is_file(): violations.append(f'{name}:missing-proof:{proof}'); continue
    ot=op.read_text(errors='replace'); pt=pp.read_text(errors='replace')
    if owner_anchor not in ot: violations.append(f'{name}:owner-anchor-drift:{owner_anchor}')
    if proof_anchor not in pt: violations.append(f'{name}:proof-anchor-drift:{proof_anchor}')
    rows.append({'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':owner_anchor,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':proof_anchor})
# Static authority-semantic guards: NLP regexes/prose must not be the Authority owner.
auth=(ROOT/'plugin/src/runtime/safety/authority.ts').read_text()
chat=(ROOT/'plugin/src/hooks/chat-message.ts').read_text()
transport=(ROOT/'plugin/src/runtime/human-decision/transport.ts').read_text()
for forbidden in ['const APPROVE=','const CONFIRM_SUCCESS=','const CONFIRM_FAILURE=']:
    if forbidden in auth: violations.append(f'natural-language-authority-owner:{forbidden}')
if "approvePendingAuthority(existing,userText)" in chat or "resolveUncertainAuthority(existing,userText)" in chat:
    violations.append('chat-prose-directly-enters-authority-runtime')
if "JSON.parse(text)" not in transport or "authority-protocol" not in transport:
    violations.append('structured-authority-transport-missing')
# Persistent grants must remain bounded classes rather than arbitrary command hashes.
proj=(ROOT/'plugin/src/runtime/safety/project-authority.ts').read_text()
for required in ['git-push','release-create','package-publish','deploy']:
    if required not in proj: violations.append(f'persistent-authority-class-missing:{required}')
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_AUTHORITY_PERMISSION_EXTERNAL_ACTION_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':8,'status':status,'invariants':rows,'static_guards':{'natural_language_authority_regex_owner':False,'structured_authority_protocol':True,'persistent_authority_classes':['git-push','release-create','package-publish','deploy']},'violations':violations,'summary':{'required':len(checks),'covered':len(checks)-len([v for v in violations if ':owner-anchor-drift:' in v or ':proof-anchor-drift:' in v or ':missing-' in v]),'violations':len(violations)},'closed_defects':[{'id':'natural-language-regex-owned-authority','fix':'Authority accepts only exact HumanDecision decision_id + authority_ref + closed structured response; prose never enters privilege semantics.'},{'id':'stale-one-shot-approval','fix':'One-shot authority request/approval is TTL-bound and invalidated on semantic revision, stop, and restart while executing uncertainty remains durable.'},{'id':'destructive-irreversible-secret-boundaries','fix':'Credential/OAuth/SSO, secret-sensitive commands, catastrophic filesystem mutation, irreversible external destruction and supported potentially paid external effects are deterministically gated.'}],'claim_boundary':'Deterministic current-source certification of PROMPT B section 8. Persistent native-always grants stay separately bounded and explicit host deny remains dominant.'}
OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text(json.dumps(data,indent=2,sort_keys=False)+'\n')
print(f"authority audit {status}: covered={data['summary']['covered']}/{len(checks)} violations={len(violations)}")
if violations: print(json.dumps(data,indent=2))
sys.exit(0 if status=='PASS' else 1)
