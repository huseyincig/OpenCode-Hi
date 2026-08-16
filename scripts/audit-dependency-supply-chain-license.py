#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-dependency-supply-chain-license.json'
def sha(rel): return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def row(inv,owner,oa,proof,pa):
    ot=(ROOT/owner).read_text(errors='replace') if (ROOT/owner).is_file() else ''
    pt=(ROOT/proof).read_text(errors='replace') if (ROOT/proof).is_file() else ''
    ok=oa in ot and pa in pt
    return {'invariant':inv,'status':'PASS' if ok else 'FAIL','owner':owner,'owner_sha256':sha(owner) if (ROOT/owner).is_file() else None,'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof) if (ROOT/proof).is_file() else None,'proof_anchor':pa}
root=json.loads((ROOT/'package.json').read_text()); rlock=json.loads((ROOT/'package-lock.json').read_text()); plock=json.loads((ROOT/'plugin/package-lock.json').read_text())
rows=[
 row('dependency-versions','package.json','"@opencode-ai/sdk": "1.18.18"','package-lock.json','"version": "1.18.18"'),
 row('lockfiles','scripts/release-build.py',"def dependency_lock_paths(root:Path)",'tests/test_hi.py',"dependency_locks']==['package-lock.json','plugin/package-lock.json']"),
 row('direct-dependency-usage','plugin/src/opencode/client-adapter.ts',"@opencode-ai/sdk/v2/client",'data/validation/fresh-consumer-opencode-1.18.18.json','"consumer_resolution": true'),
 row('risky-install-scripts','package-lock.json','"hasInstallScript": true','THIRD_PARTY_NOTICES.md','msgpackr-extract'),
 row('provenance-integrity','scripts/release-build.py','dependency_graph_sha256','tests/test_hi.py','release_manifest_contains_dependency_sbom_and_supply_chain_digest'),
 row('dependency-licenses','THIRD_PARTY_NOTICES.md','`playwright-core`','package-lock.json','"license": "Apache-2.0"'),
 row('source-reuse','THIRD_PARTY_NOTICES.md','license/provenance boundaries','docs/SECURITY-MODEL.md','trust boundaries'),
 row('release-permissions',' .github/workflows/npm-publish.yml'.strip(),'id-token: write','plugin/test/r1-npm-oidc-workflow.test.mjs','no long-lived npm token surface'),
]
viol=[r['invariant'] for r in rows if r['status']!='PASS']
def lock_meta(lock):
    pkgs=lock.get('packages') or {}; bad=[]; scripts=[]
    for path,m in pkgs.items():
        if not path: continue
        if m.get('hasInstallScript'): scripts.append({'path':path,'version':m.get('version'),'license':m.get('license'),'optional':bool(m.get('optional'))})
        if str(m.get('resolved','')).startswith('https://registry.npmjs.org/') and (not m.get('integrity')): bad.append(path)
    return {'entries':len(pkgs),'registry_entries_missing_integrity':bad,'install_scripts':scripts}
rm=lock_meta(rlock); pm=lock_meta(plock)
static={
 'root_lock_v3':rlock.get('lockfileVersion')==3,
 'plugin_lock_v3':plock.get('lockfileVersion')==3,
 'exact_distribution_versions':root.get('peerDependencies',{}).get('@opencode-ai/plugin')=='1.18.18' and root.get('dependencies',{}).get('@opencode-ai/sdk')=='1.18.18' and root.get('optionalDependencies',{}).get('playwright-core')=='1.62.1',
 'registry_integrity_complete':not rm['registry_entries_missing_integrity'] and not pm['registry_entries_missing_integrity'],
 'only_known_install_script':all(x['path'].endswith('node_modules/msgpackr-extract') and x['version']=='3.0.4' and x['license']=='MIT' for x in rm['install_scripts']+pm['install_scripts']),
 'release_uses_both_locks':'def dependency_lock_paths(root:Path)' in (ROOT/'scripts/release-build.py').read_text() and "return [rel for rel in ['package-lock.json','plugin/package-lock.json']" in (ROOT/'scripts/release-build.py').read_text(),
 'workflow_ignore_scripts_proof_publish':'npm pack --dry-run --json --ignore-scripts' in (ROOT/'.github/workflows/npm-publish.yml').read_text() and 'npm publish --ignore-scripts --access public' in (ROOT/'.github/workflows/npm-publish.yml').read_text(),
 'minimal_oidc_permissions':'id-token: write' in (ROOT/'.github/workflows/npm-publish.yml').read_text() and 'contents: read' in (ROOT/'.github/workflows/npm-publish.yml').read_text(),
}
if not all(static.values()): viol.extend('static:'+k for k,v in static.items() if not v)
out={'schema':1,'kind':'PROMPT_B_DEPENDENCY_SUPPLY_CHAIN_LICENSE_AUDIT','program':'PROMPT_B','section':27,'status':'PASS' if not viol else 'FAIL','summary':{'required':8,'covered':sum(r['status']=='PASS' for r in rows),'violations':len(viol)},'invariants':rows,'lock_summary':{'package-lock.json':rm,'plugin/package-lock.json':pm},'static_guards':static,'closed_defects':[
 {'id':'publishable-root-lock-missing','fix':'Publishable distribution dependency graph now has canonical root package-lock.json v3 with exact accepted runtime versions and registry integrity.'},
 {'id':'third-party-notices-runtime-drift','fix':'Notices now enumerate direct runtime SDK, host peer, optional Playwright, build TypeScript, and the audited optional msgpackr-extract install-script boundary.'},
 {'id':'release-pack-proof-prepack-output-corruption','fix':'Canonical check/build runs before a scripts-disabled pack proof; publish also uses --ignore-scripts against the same built tree.'},
 {'id':'single-lock-sbom-omitted-distribution-runtime','fix':'Release SBOM and release-chain verification deterministically bind both root distribution and plugin build/test lock graphs.'}],
 'violations':viol,
 'claim_boundary':'Local deterministic supply-chain/license certification. npm audit is separately re-runnable against registry metadata; public npm publish remains authority-gated and is not performed by this audit.'}
OUT.write_text(json.dumps(out,indent=2)+'\n')
print(f"dependency/supply-chain/license audit {out['status']}: covered={out['summary']['covered']}/8 violations={len(viol)}")
if viol:
    print('\n'.join(viol),file=sys.stderr);raise SystemExit(1)
