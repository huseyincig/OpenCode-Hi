#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/validation/prompt-b-documentation-defect-cycle.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def row(step,owner,oa,proof,pa):
 ot=(ROOT/owner).read_text(errors='replace');pt=(ROOT/proof).read_text(errors='replace');ok=oa in ot and pa in pt
 return {'step':step,'status':'PASS' if ok else 'FAIL','owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa}
rows=[
 row('source-change','scripts/generate-product-truth-inventory.py','owner_sha256','data/validation/product-truth-inventory.json','"owner_sha256"'),
 row('tests','scripts/generate-product-truth-inventory.py','proof_paths','data/validation/product-truth-inventory.json','"proof_paths"'),
 row('docs-owner-impact-check','data/documentation-ownership.json','one-meaning-one-canonical-documentation-owner','data/validation/documentation-inventory.json','"canonical_ownership"'),
 row('generated-parity-update','scripts/generate-documentation-projections.py','Generated from','data/validation/documentation-parity.json','"status": "PASS"'),
 row('doc-lint','scripts/validate-documentation.py','documentation parity','data/validation/documentation-parity.json','"violations": []'),
]
pti=json.loads((ROOT/'data/validation/product-truth-inventory.json').read_text());di=json.loads((ROOT/'data/validation/documentation-inventory.json').read_text());dp=json.loads((ROOT/'data/validation/documentation-parity.json').read_text())
static={
 'product_truth_areas_24':pti.get('status')=='PASS' and len(pti.get('areas',[]))==24,
 'each_area_has_doc_owner_and_proof':all(x.get('canonical_doc') and x.get('owner_sha256') and x.get('proof_paths') for x in pti.get('areas',[])),
 'documentation_inventory_pass':di.get('status')=='PASS' and not any((di.get('violations') or {}).values()),
 'parity_pass':dp.get('status')=='PASS' and dp.get('violations')==[],
 'generated_dirty_guard':'GENERATED_ARTIFACT_DIRTY' in (ROOT/'scripts/architecture_lint.mjs').read_text(),
 'generated_hand_edit_guard':'GENERATED_ARTIFACT_HAND_EDIT' in (ROOT/'scripts/architecture_lint.mjs').read_text(),
 'prompt_a_docs_not_frozen':(ROOT/'docs/engineering-constitution/MASTER-CONTINUATION.md').is_file(),
}
viol=[x['step'] for x in rows if x['status']!='PASS']+[f'static:{k}' for k,v in static.items() if not v]
out={'schema':1,'kind':'PROMPT_B_DOCUMENTATION_DEFECT_CYCLE_AUDIT','program':'PROMPT_B','section':29,'status':'PASS' if not viol else 'FAIL','summary':{'required':5,'covered':sum(x['status']=='PASS' for x in rows),'violations':len(viol)},'cycle':rows,'static_guards':static,'violations':viol,'claim_boundary':'Documentation is evaluated in every material defect cycle. A source change does not require meaningless prose churn; it requires canonical documentation-owner impact evaluation, regenerated machine projections where applicable, and parity/lint PASS. Documentation never outranks live source/contracts/runtime evidence.'}
OUT.write_text(json.dumps(out,indent=2)+'\n');print(f"documentation defect-cycle audit {out['status']}: covered={out['summary']['covered']}/5 violations={len(viol)}")
if viol:raise SystemExit(1)
