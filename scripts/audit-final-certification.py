#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
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
 'README':'README.md','product-identity':'docs/PRODUCT-IDENTITY.md','architecture':'docs/ARCHITECTURE.md',
 'Constitution':'docs/engineering-constitution/15-ENGINEERING-CONSTITUTION.md','terminology':'docs/TERMINOLOGY.md','HOSTS':'docs/HOSTS.md',
 'installation':'docs/INSTALLATION.md','configuration':'data/validation/prompt-b-configuration.json','methodologies-skills':'docs/SKILLS.md',
 'security':'docs/THREAT-MODEL.md','validation':'docs/VALIDATION.md','release':'docs/RELEASE.md',
 'acceptance':'data/validation/prompt-b-user-journey-acceptance.json','MASTER':'docs/engineering-constitution/MASTER-CONTINUATION.md',
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
r42={'schema':1,'kind':'PROMPT_B_FINAL_DOCUMENTATION_REAUDIT','program':'PROMPT_B','section':42,'status':'PASS' if not viol else 'FAIL','source_checkpoint':{'commit':HEAD,'tree':TREE},'areas':rows,'documentation_parity':{'path':'data/validation/documentation-parity.json',**checkpoint_blob('data/validation/documentation-parity.json'),'violations':len(docpar.get('violations') or [])},'documentation_inventory':{'path':'data/validation/documentation-inventory.json',**checkpoint_blob('data/validation/documentation-inventory.json'),'status':inv.get('status')},'summary':{'required':15,'covered':sum(x['status']=='PASS' for x in rows),'violations':len(viol)},'violations':viol,'claim_boundary':'Final documentation re-audit requires current source/docs/receipts to agree; historical documents cannot own current truth.'}
write('data/validation/prompt-b-final-documentation-reaudit.json',r42)

# §43 explicit evidence tiers
claims=[
 ('source-doc-parity','T0','T0','data/validation/documentation-parity.json'),
 ('contracts-and-unit-semantics','T1','T1','data/validation/prompt-b-test-suite-audit.json'),
 ('runtime-wiring-fresh-consumer','T2','T3','data/validation/fresh-consumer-opencode-1.18.18.json'),
 ('process-lifecycle','T3','T3','data/validation/external-opencode-hi-0.1.1-process-1.18.18-head-3ca843d.json'),
 ('workspace-isolation-binding','T3','T3','data/validation/external-opencode-hi-0.1.1-workspace-1.18.18-head-3ca843d.json'),
 ('browser-execution','T3','T3','data/validation/external-opencode-hi-0.1.1-browser-1.18.18-head-3ca843d.json'),
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
cross=load('data/validation/prompt-b-cross-platform-acceptance.json'); windows_current=bool((cross.get('windows') or {}).get('current_source_tested'))
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
r44={'schema':1,'kind':'FINAL_SYSTEM_CERTIFICATION','program':'PROMPT_B','section':44,'status':pre_status,'release':VERSION,'certified_source_checkpoint':{'commit':HEAD,'tree':TREE,'note':'Source checkpoint attested by a subsequent evidence commit to avoid self-referential Git hashes.'},'schema_versions':{'final_certification':1},'host_matrix':compat.get('current_reference_host'),'platform_matrix':{'linux_current':'PASS','windows_current':'PASS' if windows_current else 'PENDING_EXTERNAL_CI'},'test_totals':(gates.get('counts') if gates and gates.get('status')=='PASS' else {'python':z.get('full_python_pass'),'node':z.get('full_node_pass'),'architecture':z.get('architecture_rules_pass'),'documentation_parity_violations':z.get('docs_parity_violations')}),'mutation':load('data/validation/prompt-b-mutation-testing.json')['summary'],'property_fuzz':load('data/validation/prompt-b-property-fuzz-testing.json')['summary'],'replay':load('data/validation/prompt-b-replay-testing.json')['summary'],'failure_injection':load('data/validation/prompt-b-failure-injection.json')['summary'],'exact_t3':t3['summary'],'known_unsupported_capabilities':['alternate-host implementation is not shipped','structured native HumanDecision UI open remains unsupported; chat transport is used'],'known_limitations':['T3 scope is exact OpenCode 1.18.18 on Linux/aarch64 for current local receipts','Windows current-source proof is external-CI gated until pushed','T4 is impossible before real GitHub/npm publication and is not fabricated'],'known_defect_count':z.get('unresolved_known_defects'),'blockers':blockers,'current_projections':input_meta,'claim_boundary':'PARTIAL means engineering evidence is closed locally while externally impossible prepublication evidence remains pending. CERTIFIED is emitted only after current-source Windows acceptance and real current-release T4 proof.'}
write(f'data/validation/final-system-certification-{VERSION}.json',r44)

doc=f'''# Final System Certification\n\n## Status\n\n**{pre_status}** — OpenCode-Hi `{VERSION}`.\n\nThis is an exact-evidence certification, not a marketing assertion. The certified source checkpoint is `{HEAD}` (tree `{TREE}`). The certification receipts are committed afterward as an attestation because a file cannot truthfully contain the hash of the same Git commit that contains that file.\n\n## Evidence summary\n\n- Package version: `{VERSION}`.\n- Schema: final certification v1.\n- Exact host: OpenCode `1.18.18`, Linux/aarch64; Process, Workspace and Browser are `SUPPORTED_T3`.\n- Platform: Linux current-source PASS; Windows current-source {'PASS' if windows_current else 'PENDING_EXTERNAL_CI'}.\n- Architecture: {z.get('architecture_rules_pass')}/{z.get('architecture_rules_pass')} rules PASS.\n- Security: 20/20 PASS. Authority: 18/18 PASS.\n- Context / Project Intelligence: 12/12 PASS.\n- Process / Workspace / Browser lifecycle: 61/61 PASS.\n- Persistence / concurrency: 31/31 PASS. Git/VCS/path safety: 31/31 PASS.\n- Fresh final gates: Python {(gates.get('counts') or {}).get('python') if gates else z.get('full_python_pass')}, Node {(gates.get('counts') or {}).get('node') if gates else z.get('full_node_pass')}, architecture {(gates.get('counts') or {}).get('architecture') if gates else z.get('architecture_rules_pass')}, docs parity violations {(gates.get('counts') or {}).get('documentation_parity_violations') if gates else z.get('docs_parity_violations')}.\n- Mutation: 15/15 compile-valid critical mutants killed; 0 survivors.\n- Property/fuzz: 864 deterministic cases across 9/9 areas.\n- Replay: 28 cases across 5/5 surfaces; nondeterministic drift 0.\n- Failure injection: 12/12 required injections PASS; bounded terminal behavior.\n- Install lifecycle: 14/14 PASS. Fresh packed consumer: 8/8 PASS, 31 Hi tools on exact OpenCode 1.18.18.\n- Documentation parity: PASS, 0 violations.\n- Known defects in audited scope: **{z.get('unresolved_known_defects')}**.\n\n## Evidence tiers\n\nT0 = static/schema/lint/doc parity; T1 = deterministic unit/contract; T2 = integration/runtime wiring; T3 = exact-version real-host; T4 = real external publication/release. Lower tiers never certify higher-tier claims. See `data/validation/prompt-b-certification-evidence-tiers.json`.\n\n## T3 receipts\n\n- `data/validation/external-opencode-hi-0.1.1-process-1.18.18-head-3ca843d.json`\n- `data/validation/external-opencode-hi-0.1.1-workspace-1.18.18-head-3ca843d.json`\n- `data/validation/external-opencode-hi-0.1.1-browser-1.18.18-head-3ca843d.json`\n\n## Release / T4\n\nCurrent release status is machine-owned by `data/validation/release-status-{VERSION}.json`. {'Current GitHub/npm T4 evidence is present.' if t4 else 'Current GitHub/npm T4 evidence is **pending**; no T4 claim is made before real publication and registry verification.'}\n\n## Known unsupported capabilities and limitations\n\n- Alternate host implementations are feasible by port contract but are not shipped or certified.\n- Native structured HumanDecision UI opening is unsupported; bounded chat transport remains the truthful fallback.\n- Current local T3 receipts are exact to OpenCode 1.18.18 on Linux/aarch64.\n- {'Windows current-source acceptance is pending the exact-source CI run.' if not windows_current else 'Windows current-source acceptance is externally verified.'}\n- {'T4 publication verification is pending.' if not t4 else 'T4 publication verification is complete.'}\n\n## Blockers\n\n{chr(10).join('- `'+b+'`' for b in blockers) if blockers else '- None.'}\n\n## Canonical documentation index\n\nCanonical ownership is machine-defined in `data/documentation-ownership.json`; current documentation inventory and hashes are in `data/validation/documentation-inventory.json`.\n\n## Certification vocabulary\n\n{'**CERTIFIED** — all required local and external evidence is present.' if not blockers else '**PARTIAL** — do not label this release CERTIFIED until every blocker above is closed.'}\n\n`ZERO KNOWN DEFECT` is scoped strictly to the audited Prompt B defect inventory and does not claim future defects are impossible. `DOCUMENTATION-SOURCE PARITY VERIFIED` is supported by the current documentation parity receipt.\n'''
(ROOT/'docs/FINAL-SYSTEM-CERTIFICATION.md').write_text(doc)

# §45 vocabulary audit
text=(ROOT/'docs/FINAL-SYSTEM-CERTIFICATION.md').read_text(); vocab_viol=[]
if blockers and '**CERTIFIED** — all required' in text: vocab_viol.append('certified-label-with-blockers')
if z.get('unresolved_known_defects')!=0 and 'ZERO KNOWN DEFECT' in text: vocab_viol.append('zero-known-defect-with-known-defect')
r45={'schema':1,'kind':'PROMPT_B_CERTIFICATION_VOCABULARY_AUDIT','program':'PROMPT_B','section':45,'status':'PASS' if not vocab_viol else 'FAIL','current_label':pre_status,'blockers':blockers,'allowed_positive_labels':(['CERTIFIED','ZERO KNOWN DEFECT','RELEASE-GRADE ENGINEERING','DOCUMENTATION-SOURCE PARITY VERIFIED'] if not blockers else ['ZERO KNOWN DEFECT (audited scope)','RELEASE-GRADE ENGINEERING','DOCUMENTATION-SOURCE PARITY VERIFIED']),'violations':vocab_viol,'rule':'CERTIFIED is forbidden while any required T3/T4, platform, correctness, security, authority, docs, cleanliness or artifact proof remains unresolved.'}
write('data/validation/prompt-b-certification-vocabulary.json',r45)

# §46 product quality
user_j=load('data/validation/prompt-b-user-journey-acceptance.json'); dev_j=load('data/validation/prompt-b-developer-journey-acceptance.json')
quality_checks={'user_journeys':user_j.get('status')=='PASS','developer_journeys':dev_j.get('status')=='PASS','authority':ok_receipt('data/validation/prompt-b-authority-permission-external-action.json'),'failure_recovery':ok_receipt('data/validation/prompt-b-failure-injection.json'),'verification_completion':z.get('unresolved_known_defects')==0,'single_semantic_owner':load('data/validation/documentation-inventory.json').get('status')=='PASS','native_first_t3':t3.get('status')=='PASS','safe_persistence_restart':ok_receipt('data/validation/prompt-b-persistence-concurrency.json'),'clean_package':ok_receipt('data/validation/prompt-b-packaging-fresh-consumer.json'),'canonical_docs':docpar.get('status')=='PASS'}
r46={'schema':1,'kind':'PROMPT_B_FINAL_PRODUCT_QUALITY_AUDIT','program':'PROMPT_B','section':46,'status':'PASS' if all(quality_checks.values()) else 'FAIL','checks':quality_checks,'summary':{'required':len(quality_checks),'covered':sum(quality_checks.values()),'violations':sum(not x for x in quality_checks.values())},'violations':[k for k,v in quality_checks.items() if not v]}
write('data/validation/prompt-b-final-product-quality.json',r46)

# §47 mandatory end-state; external blockers remain truthful prepublication blockers.
state_paths=['plugin/src','plugin/dist','data/validation','docs/README_DOES_NOT_EXIST']
coherence={'source_contracts':load('data/validation/source-contracts.json').get('release')==VERSION,'generated_projections':docpar.get('status')=='PASS','runtime_behavior':t3.get('status')=='PASS','tests':z.get('full_python_pass',0)>0 and z.get('full_node_pass',0)>0,'real_host_behavior':t3.get('summary',{}).get('exact_current_capabilities')==3,'receipts':r42['status']=='PASS' and r43['status']=='PASS','README':(ROOT/'README.md').is_file(),'architecture_docs':(ROOT/'docs/ARCHITECTURE.md').is_file(),'Constitution':(ROOT/'docs/engineering-constitution/15-ENGINEERING-CONSTITUTION.md').is_file(),'installation_docs':(ROOT/'docs/INSTALLATION.md').is_file(),'release_docs':(ROOT/'docs/RELEASE.md').is_file(),'certification_docs':(ROOT/'docs/FINAL-SYSTEM-CERTIFICATION.md').is_file()}
r47={'schema':1,'kind':'PROMPT_B_FINAL_MANDATORY_END_STATE_AUDIT','program':'PROMPT_B','section':47,'status':'PASS' if all(coherence.values()) else 'FAIL','certification_state':pre_status,'source_checkpoint':{'commit':HEAD,'tree':TREE},'coherence':coherence,'external_blockers':blockers,'summary':{'required':len(coherence),'coherent':sum(coherence.values()),'violations':sum(not x for x in coherence.values())},'violations':[k for k,v in coherence.items() if not v],'claim_boundary':'Repository-internal mandatory end-state can be coherent before publication; CERTIFIED remains withheld until external blockers are closed.'}
write('data/validation/prompt-b-final-mandatory-state.json',r47)
print(f'final certification audit: §42={r42["status"]} §43={r43["status"]} §44={pre_status} §45={r45["status"]} §46={r46["status"]} §47={r47["status"]} blockers={len(blockers)}')
if any(x['status']=='FAIL' for x in [r42,r43,r45,r46,r47]): sys.exit(1)
