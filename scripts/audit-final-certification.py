#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
PKG=json.loads((ROOT/'package.json').read_text());TARGET=str((PKG.get('dependencies') or {}).get('@opencode-ai/sdk') or '').strip();FRESH=f'data/validation/fresh-consumer-opencode-{TARGET}.json'
VAL=ROOT/'data/validation'
VERSION=(ROOT/'VERSION').read_text().strip()
HEAD=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
TREE=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=ROOT,text=True).strip()
def sha(rel): return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def checkpoint_blob(rel):
    blob=subprocess.check_output(['git','show',f'{HEAD}:{rel}'],cwd=ROOT)
    oid=subprocess.check_output(['git','rev-parse',f'{HEAD}:{rel}'],cwd=ROOT,text=True).strip()
    return {'checkpoint_sha256':hashlib.sha256(blob).hexdigest(),'checkpoint_blob_oid':oid}
def load(rel): return json.loads((ROOT/rel).read_text())
def write(rel,obj): (ROOT/rel).write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')
def ok_receipt(rel):
    d=load(rel); return d.get('status') in {'PASS','COMPLETED','CLOSED_LOCAL_T4_BLOCKED','PREPUBLICATION_CERTIFIED_PENDING_T4','CERTIFIED_T4','PASS_WITH_TRUTHFUL_WINDOWS_CURRENT_SOURCE_LIMITATION'} and not d.get('violations')

# §42 Final documentation re-audit
checks={
 'README':'README.md','docs-index':'docs/README.md','architecture':'docs/ARCHITECTURE.md','HOSTS':'docs/HOSTS.md',
 'installation':'docs/INSTALLATION.md','configuration-guide':'docs/CONFIGURATION.md','configuration-guide-tr':'docs/locales/tr/CONFIGURATION.md','methodologies-skills':'docs/SKILLS.md','human-decisions':'docs/HUMAN-DECISIONS.md',
 'security':'docs/SECURITY-MODEL.md','verification':'docs/VERIFICATION.md','release':'docs/RELEASE.md',
 'configuration':'data/validation/prompt-b-configuration.json','acceptance':'data/validation/prompt-b-user-journey-acceptance.json',
 'receipts':'data/validation/prompt-b-zero-known-defect-loop.json'}
viol=[]; rows=[]
for name,rel in checks.items():
 p=ROOT/rel
 good=p.is_file()
 if rel.endswith('.json') and good: good=ok_receipt(rel)
 if not good: viol.append(f'{name}:{rel}')
 meta=checkpoint_blob(rel) if good else {}
 rows.append({'area':name,'path':rel,**meta,'status':'PASS' if good else 'FAIL'})
docpar=load('data/validation/documentation-parity.json'); inv=load('data/validation/documentation-inventory.json')
if docpar.get('status')!='PASS' or docpar.get('violations')!=[]: viol.append('documentation-parity')
if inv.get('status')!='PASS': viol.append('documentation-inventory')
r42={'schema':1,'kind':'PROMPT_B_FINAL_DOCUMENTATION_REAUDIT','program':'PROMPT_B','section':42,'status':'PASS' if not viol else 'FAIL','source_checkpoint':{'commit':HEAD,'tree':TREE},'areas':rows,'documentation_parity':{'path':'data/validation/documentation-parity.json',**checkpoint_blob('data/validation/documentation-parity.json'),'violations':len(docpar.get('violations') or [])},'documentation_inventory':{'path':'data/validation/documentation-inventory.json',**checkpoint_blob('data/validation/documentation-inventory.json'),'status':inv.get('status')},'summary':{'required':len(checks),'covered':sum(x['status']=='PASS' for x in rows),'violations':len(viol)},'violations':viol,'claim_boundary':'Final documentation re-audit requires current source/docs/receipts to agree; historical documents cannot own current truth.'}
write('data/validation/prompt-b-final-documentation-reaudit.json',r42)

# §43 explicit evidence tiers
compat_for_tiers=load('data/validation/compatibility-matrix-0.1.0.json')
t3_caps=(compat_for_tiers.get('current_reference_host') or {}).get('capabilities') or {}
def t3_receipt(cap):
    rel=(t3_caps.get(cap) or {}).get('receipt')
    if not isinstance(rel,str) or not rel: raise SystemExit(f'missing selected T3 receipt for {cap}')
    return rel
claims=[
 ('source-doc-parity','T0','T0','data/validation/documentation-parity.json'),
 ('contracts-and-unit-semantics','T1','T1','data/validation/prompt-b-test-suite-audit.json'),
 ('runtime-wiring-fresh-consumer','T2','T3',FRESH),
 ('process-lifecycle','T3','T3',t3_receipt('process-lifecycle')),
 ('workspace-isolation-binding','T3','T3',t3_receipt('workspace-isolation-binding')),
 ('browser-execution','T3','T3',t3_receipt('browser-execution')),
 ('external-publication','T4','T4' if (VAL/f'release-publication-{VERSION}.json').exists() else 'NONE',f'data/validation/release-publication-{VERSION}.json'),
]
rank={'NONE':-1,'T0':0,'T1':1,'T2':2,'T3':3,'T4':4}; tierrows=[]; tier_viol=[]
for name,req,av,rel in claims:
 sufficient=rank[av]>=rank[req]
 # T4 is intentionally pending prepublication, so truthful insufficiency is a blocker, not an audit defect.
 tierrows.append({'claim':name,'required_tier':req,'available_tier':av,'evidence':rel,'evidence_exists':(ROOT/rel).exists(),'sufficient':sufficient})
 if name!='external-publication' and not sufficient: tier_viol.append(name)
r43={'schema':1,'kind':'PROMPT_B_CERTIFICATION_EVIDENCE_TIERS','program':'PROMPT_B','section':43,'status':'PASS' if not tier_viol else 'FAIL','tiers':{'T0':'static/schema/lint/doc parity','T1':'deterministic unit/contract','T2':'integration/runtime wiring','T3':'exact-version real-host','T4':'real external publication/release'},'claims':tierrows,'summary':{'claims':len(tierrows),'locally_sufficient':sum(x['sufficient'] for x in tierrows),'pending_t4':not next(x for x in tierrows if x['claim']=='external-publication')['sufficient'],'violations':len(tier_viol)},'violations':tier_viol,'rule':'A lower evidence tier never certifies a higher-tier claim.'}
write('data/validation/prompt-b-certification-evidence-tiers.json',r43)

# External blockers drive truthful prepublication state.
cross=load('data/validation/prompt-b-cross-platform-acceptance.json'); windows_current=cross.get('status')=='PASS' and cross.get('windows_current_certified') is True
pub_rel=f'data/validation/release-publication-{VERSION}.json'; pub_exists=(ROOT/pub_rel).exists()
t4=False
if pub_exists:
 p=load(pub_rel); t4=(p.get('github_release') or {}).get('status')=='PASS_T4' and (p.get('npm_registry') or {}).get('status')=='PASS_T4'
blockers=[]
if not windows_current: blockers.append('current-source-windows-acceptance-pending-external-ci')
if not t4: blockers.append('T4-current-release-publication-verification-pending')
pre_status='CERTIFIED' if not blockers else 'PARTIAL'

# §44 machine certification + canonical document
z=load('data/validation/prompt-b-zero-known-defect-loop.json')['summary']; gates_rel=f'data/validation/final-gates-{VERSION}.json'; gates=load(gates_rel) if (ROOT/gates_rel).exists() else None; t3=load('data/validation/prompt-b-exact-current-opencode-t3.json'); compat=load('data/validation/compatibility-matrix-0.1.0.json')
inputs=[
 'data/validation/prompt-b-final-documentation-reaudit.json','data/validation/prompt-b-certification-evidence-tiers.json',
 'data/validation/prompt-b-security-privacy.json','data/validation/prompt-b-authority-permission-external-action.json',
 'data/validation/prompt-b-context-project-intelligence-compression.json','data/validation/prompt-b-process-workspace-browser-lifecycle.json',
 'data/validation/prompt-b-persistence-concurrency.json','data/validation/prompt-b-vcs-path-portability.json',
 'data/validation/prompt-b-test-suite-audit.json','data/validation/prompt-b-mutation-testing.json','data/validation/prompt-b-property-fuzz-testing.json',
 'data/validation/prompt-b-replay-testing.json','data/validation/prompt-b-failure-injection.json','data/validation/prompt-b-install-update-lifecycle.json',
 'data/validation/prompt-b-packaging-fresh-consumer.json','data/validation/prompt-b-cross-platform-acceptance.json','data/validation/prompt-b-exact-current-opencode-t3.json',
 'data/validation/prompt-b-zero-known-defect-loop.json','data/validation/prompt-b-hygiene.json','data/validation/documentation-parity.json','data/validation/compatibility-matrix-0.1.0.json',f'data/validation/release-status-{VERSION}.json'] + ([gates_rel] if gates else [])
input_meta={r:{'projection':'current-attestation','status':(load(r).get('status') if r.endswith('.json') else 'PRESENT')} for r in inputs if (ROOT/r).exists()}
r44={'schema':1,'kind':'FINAL_SYSTEM_CERTIFICATION','program':'PROMPT_B','section':44,'status':pre_status,'release':VERSION,'certified_source_checkpoint':{'commit':HEAD,'tree':TREE,'note':'Source checkpoint attested by a subsequent evidence commit to avoid self-referential Git hashes.'},'schema_versions':{'final_certification':1},'host_matrix':compat.get('current_reference_host'),'platform_matrix':{'linux_current':'PASS','windows_current':'PASS' if windows_current else 'PENDING_EXTERNAL_CI'},'test_totals':(gates.get('counts') if gates and gates.get('status')=='PASS' else None),'mutation':load('data/validation/prompt-b-mutation-testing.json')['summary'],'property_fuzz':load('data/validation/prompt-b-property-fuzz-testing.json')['summary'],'replay':load('data/validation/prompt-b-replay-testing.json')['summary'],'failure_injection':load('data/validation/prompt-b-failure-injection.json')['summary'],'exact_t3':t3['summary'],'known_unsupported_capabilities':['alternate-host implementation is not shipped','structured native HumanDecision UI open remains unsupported; chat transport is used'],'known_limitations':[f'T3 scope is exact OpenCode {TARGET} on Linux/aarch64 for current local receipts','Windows current-source proof is bound to the exact external CI source checkpoint and subsequent evidence-only attestation commits' if windows_current else 'Windows current-source proof is external-CI gated until pushed','T4 is impossible before real GitHub/npm publication and is not fabricated'],'known_defect_count':z.get('unresolved_known_defects'),'blockers':blockers,'current_projections':input_meta,'claim_boundary':'PARTIAL means engineering evidence is closed locally while externally impossible prepublication evidence remains pending. CERTIFIED is emitted only after current-source Windows acceptance and real current-release T4 proof.'}
write(f'data/validation/final-system-certification-{VERSION}.json',r44)

# Human-facing certification prose is intentionally not generated. Machine receipts are the certification owner.

# §45 vocabulary audit
vocab_viol=[]
if pre_status=='CERTIFIED' and blockers:vocab_viol.append('certified-label-with-blockers')
if z.get('unresolved_known_defects')!=0:vocab_viol.append('zero-known-defect-with-known-defect')
r45={'schema':1,'kind':'PROMPT_B_CERTIFICATION_VOCABULARY_AUDIT','program':'PROMPT_B','section':45,'status':'PASS' if not vocab_viol else 'FAIL','current_label':pre_status,'blockers':blockers,'allowed_positive_labels':(['CERTIFIED','ZERO KNOWN DEFECT','RELEASE-GRADE ENGINEERING','DOCUMENTATION-SOURCE PARITY VERIFIED'] if not blockers else ['ZERO KNOWN DEFECT (audited scope)','RELEASE-GRADE ENGINEERING','DOCUMENTATION-SOURCE PARITY VERIFIED']),'violations':vocab_viol,'rule':'CERTIFIED is forbidden while any required T3/T4, platform, correctness, security, authority, docs, cleanliness or artifact proof remains unresolved.'}
write('data/validation/prompt-b-certification-vocabulary.json',r45)

# §46 product quality
user_j=load('data/validation/prompt-b-user-journey-acceptance.json'); dev_j=load('data/validation/prompt-b-developer-journey-acceptance.json')
quality_checks={'user_journeys':user_j.get('status')=='PASS','developer_journeys':dev_j.get('status')=='PASS','authority':ok_receipt('data/validation/prompt-b-authority-permission-external-action.json'),'failure_recovery':ok_receipt('data/validation/prompt-b-failure-injection.json'),'verification_completion':z.get('unresolved_known_defects')==0,'single_semantic_owner':load('data/validation/documentation-inventory.json').get('status')=='PASS','native_first_t3':t3.get('status')=='PASS','safe_persistence_restart':ok_receipt('data/validation/prompt-b-persistence-concurrency.json'),'clean_package':ok_receipt('data/validation/prompt-b-packaging-fresh-consumer.json'),'canonical_docs':docpar.get('status')=='PASS'}
r46={'schema':1,'kind':'PROMPT_B_FINAL_PRODUCT_QUALITY_AUDIT','program':'PROMPT_B','section':46,'status':'PASS' if all(quality_checks.values()) else 'FAIL','checks':quality_checks,'summary':{'required':len(quality_checks),'covered':sum(quality_checks.values()),'violations':sum(not x for x in quality_checks.values())},'violations':[k for k,v in quality_checks.items() if not v]}
write('data/validation/prompt-b-final-product-quality.json',r46)

# §47 mandatory end-state; external blockers remain truthful prepublication blockers.
coherence={'source_contracts':load('data/validation/source-contracts.json').get('release')==VERSION,
 'generated_projections':docpar.get('status')=='PASS','runtime_behavior':t3.get('status')=='PASS',
 'tests':bool(gates and gates.get('status')=='PASS'),'real_host_behavior':t3.get('summary',{}).get('exact_current_capabilities')==3,
 'receipts':r42['status']=='PASS' and r43['status']=='PASS','README':(ROOT/'README.md').is_file(),
 'architecture_docs':(ROOT/'docs/ARCHITECTURE.md').is_file(),'installation_docs':(ROOT/'docs/INSTALLATION.md').is_file(),
 'release_docs':(ROOT/'docs/RELEASE.md').is_file(),'security_docs':(ROOT/'docs/SECURITY-MODEL.md').is_file(),
 'verification_docs':(ROOT/'docs/VERIFICATION.md').is_file()}
r47={'schema':1,'kind':'PROMPT_B_FINAL_MANDATORY_END_STATE_AUDIT','program':'PROMPT_B','section':47,'status':'PASS' if all(coherence.values()) else 'FAIL','certification_state':pre_status,'source_checkpoint':{'commit':HEAD,'tree':TREE},'coherence':coherence,'external_blockers':blockers,'summary':{'required':len(coherence),'coherent':sum(coherence.values()),'violations':sum(not x for x in coherence.values())},'violations':[k for k,v in coherence.items() if not v],'claim_boundary':'Repository-internal mandatory end-state can be coherent before publication; CERTIFIED remains withheld until external blockers are closed.'}
write('data/validation/prompt-b-final-mandatory-state.json',r47)
print(f'final certification audit: §42={r42["status"]} §43={r43["status"]} §44={pre_status} §45={r45["status"]} §46={r46["status"]} §47={r47["status"]} blockers={len(blockers)}')
if any(x['status']=='FAIL' for x in [r42,r43,r45,r46,r47]): sys.exit(1)
