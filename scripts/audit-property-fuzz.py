#!/usr/bin/env python3
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-property-fuzz-testing.json'
ACC=ROOT/'data/validation/property-fuzz-acceptance-0.1.0.json'
AREAS={
'ids':('plugin/src/contracts/common.ts','assertCanonicalId','Q4 seeded property fuzz: canonical IDs accept valid syntax and reject malformed forms'),
'paths':('plugin/src/contracts/common.ts','normalizeBoundedProjectPath','Q4 seeded property fuzz: paths remain project-bounded'),
'schemas':('plugin/src/runtime/mission/validators.ts','validateMissionEnvelope','Q4 seeded property fuzz: strict schemas reject widening unknown and malformed permission profiles'),
'event-ordering':('plugin/src/runtime/application/runtime-event-controller.ts',"ev.kind==='permission-asked'",'Q4 seeded property fuzz: permission event ordering and duplicates never leave phantom pending authority'),
'host-observations':('plugin/src/opencode/event-adapter.ts','normalizeOpenCodeEvent','Q4 seeded property fuzz: malformed host observations normalize without unbounded output or fabricated permission decisions'),
'config':('plugin/src/config/resolver.ts','resolveHiConfigWithReport','Q4 seeded property fuzz: malformed config resolves to bounded canonical executable values'),
'decision-payloads':('plugin/src/runtime/safety/authority.ts','approvePendingAuthority','Q4 seeded property fuzz: decision payloads cannot authorize without exact structured identity'),
'tool-outputs':('plugin/src/runtime/task/result-parser.ts','parseWorkerResult','Q4 seeded property fuzz: arbitrary tool/worker output parsing is bounded and canonical'),
'persistence-envelopes':('plugin/src/runtime/state/persistence.ts','validateMissionEnvelope','Q4 seeded property fuzz: persistence envelopes reject malformed schema and shape while valid round-trips survive'),
}
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
acc=json.loads(ACC.read_text())
viol=[]
expected=['ids','paths','schemas','event-ordering','host-observations','config','decision-payloads','tool-outputs','persistence-envelopes']
if acc.get('status')!='PASS':viol.append('acceptance-not-pass')
cfg=acc.get('configuration') or {}
if cfg.get('areas')!=expected or cfg.get('cases_per_seed')!=32 or cfg.get('generated_cases')!=864 or len(cfg.get('seeds') or [])!=3:viol.append('bounded-reproducible-configuration-drift')
term=acc.get('terminal') or {}
if term.get('tests')!=9 or term.get('pass')!=9 or term.get('fail')!=0 or term.get('cancelled')!=0:viol.append('terminal-test-summary-drift')
if acc.get('failures')!=[]:viol.append('unresolved-fuzz-failures')
case_rel='data/validation/property-fuzz-failures/persistence-envelopes-seed-c0ffee-case-0.json'
case=json.loads((ROOT/case_rel).read_text())
if case.get('kind')!='PROPERTY_FUZZ_HISTORICAL_REGRESSION_CASE' or case.get('observed_before_fix')!='accepted-malformed-persisted-mission' or case.get('expected')!='reject-malformed-persisted-mission':viol.append('historical-failing-case-not-preserved')
test_rel='plugin/test/q4-property-fuzz.test.mjs'; test_text=(ROOT/test_rel).read_text()
rows=[]
for area,(owner,owner_anchor,proof_anchor) in AREAS.items():
    if owner_anchor not in (ROOT/owner).read_text():viol.append(f'owner-anchor:{area}')
    if proof_anchor not in test_text:viol.append(f'proof-anchor:{area}')
    rows.append({'area':area,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':owner_anchor,'proof':test_rel,'proof_sha256':sha(test_rel),'proof_anchor':proof_anchor})
static_guards={
'fixed-seeds':cfg.get('seeds_hex')==['0x00c0ffee','0x5eed1234','0x000a11ce'],
'bounded-cases':cfg.get('cases_per_seed')==32,
'failing-cases-saved':(ROOT/case_rel).is_file(),
'unknown-persisted-identity-rejected':"!onlyKeys(identity,IDENTITY_KEYS)" in (ROOT/'plugin/src/runtime/mission/validators.ts').read_text(),
'acceptance-source-bound':acc.get('source_binding',{}).get('tested_git_commit')=='6fe74d7786e25cb6894ddca7d4408a17220cc936',
}
if not all(static_guards.values()):viol.append('static-guard-drift')
out={'schema':1,'kind':'PROMPT_B_PROPERTY_FUZZ_TESTING_AUDIT','program':'PROMPT_B','section':32,'status':'PASS' if not viol else 'FAIL','acceptance_receipt':'data/validation/property-fuzz-acceptance-0.1.0.json','summary':{'required_areas':9,'covered_areas':len(rows),'generated_cases':cfg.get('generated_cases'),'violations':len(viol)},'areas':rows,'static_guards':static_guards,'closed_defects':[{'id':'persisted-mission-unknown-identity-field-accepted','finding':'RuntimePersistence accepted a persisted Mission carrying an unknown identity field.','resolution':'Mission identity, intent, and semantic-assessment validators now reject unknown keys.'}],'historical_failure_case':case_rel,'violations':viol}
OUT.write_text(json.dumps(out,indent=2)+'\n')
print(f"property/fuzz audit {out['status']}: covered={len(rows)}/9 generated={cfg.get('generated_cases')} violations={len(viol)}")
raise SystemExit(0 if not viol else 1)
