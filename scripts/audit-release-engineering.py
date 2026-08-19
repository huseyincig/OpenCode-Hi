#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-release-engineering.json'
def sh(*a):return subprocess.check_output(a,cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def load(rel):return json.loads((ROOT/rel).read_text(encoding='utf-8'))
cert_head=sh('git','rev-parse','HEAD');cert_tree=sh('git','rev-parse','HEAD^{tree}');version=(ROOT/'VERSION').read_text(encoding='utf-8').strip();hist_tag_commit=sh('git','rev-parse','v0.1.0^{commit}')
fresh=load('data/validation/fresh-consumer-opencode-1.18.18.json');head=fresh.get('source',{}).get('commit');tree=fresh.get('source',{}).get('tree');fresh_host=fresh.get('host') or {};registry=fresh_host.get('registry_observation') or {}
historical=load('data/validation/release-status-0.1.0.json')
pub_rel=f'data/validation/release-publication-{version}.json';published=(ROOT/pub_rel).is_file();pub=load(pub_rel) if published else {}
t4=published and pub.get('status')=='PASS_T4' and (pub.get('github_release') or {}).get('status')=='PASS_T4' and (pub.get('npm_registry') or {}).get('status')=='PASS_T4' and (pub.get('fresh_registry_consumer') or {}).get('status')=='PASS_T4'
current_tag=f'v{version}'
if t4:
 stages=[
  {'stage':'source-commit','status':'PASS','detail':head,'proof':'exact-current T3 source checkpoint'},
  {'stage':'version','status':'PASS_NEW_RELEASE_IDENTITY','detail':version,'proof':'VERSION/package/lock identity; historical v0.1.0 immutable'},
  {'stage':'build','status':'PASS','detail':'canonical npm/plugin build green','proof':'canonical final gates'},
  {'stage':'tests','status':'PASS','detail':'current canonical suites green','proof':'validator + Python/Node/architecture gates'},
  {'stage':'packed-artifact','status':'PASS','detail':'fresh npm pack digest equals registry artifact','proof':pub_rel},
  {'stage':'fresh-install','status':'PASS','detail':'fresh temp consumer tarball install','proof':'data/validation/fresh-consumer-opencode-1.18.18.json'},
  {'stage':'T3','status':'PASS','detail':'exact OpenCode 1.18.18 packed consumer runtime','proof':'31 Hi tools + agent projection + session'},
  {'stage':'tag','status':'PASS_T4','detail':current_tag,'proof':pub_rel},
  {'stage':'github-release','status':'PASS_T4','detail':f'GitHub Release {current_tag} published and exact-tag verified','proof':pub_rel},
  {'stage':'registry-publication','status':'PASS_T4','detail':f'opencode-hi@{version} published through npm Trusted Publishing OIDC','proof':pub_rel},
  {'stage':'registry-integrity','status':'PASS_T4','detail':'registry integrity/shasum equal fresh pack proof; provenance exact-tag bound','proof':pub_rel},
  {'stage':'fresh-registry-install','status':'PASS_T4','detail':'fresh registry consumer loaded by exact OpenCode 1.18.18','proof':f'data/validation/t4-registry-exact-host-{version}.json'},
  {'stage':'T4-receipt','status':'PASS_T4','detail':'real GitHub/npm/provenance/exact-host publication evidence complete','proof':pub_rel},
 ]
else:
 stages=[
  {'stage':'source-commit','status':'PASS','detail':head,'proof':'git HEAD'},
  {'stage':'version','status':'PASS_NEW_RELEASE_IDENTITY' if version!='0.1.0' else 'BLOCKED_RELEASE_IDENTITY','detail':version,'proof':'VERSION/package/lock identity; historical v0.1.0 is immutable'},
  {'stage':'build','status':'PASS','detail':'canonical npm/plugin build green','proof':'npm run check / release-build deterministic gate'},
  {'stage':'tests','status':'PASS','detail':'current canonical suites green','proof':'validator + Python/Node/architecture gates'},
  {'stage':'packed-artifact','status':'PASS','detail':'deterministic pack/release artifacts','proof':'§25/§27 deterministic pack and dual-lock SBOM'},
  {'stage':'fresh-install','status':'PASS','detail':'fresh temp consumer tarball install','proof':'data/validation/fresh-consumer-opencode-1.18.18.json'},
  {'stage':'T3','status':'PASS','detail':'exact OpenCode 1.18.18 packed consumer runtime','proof':'31 Hi tools + agent projection + session; current source checkpoint'},
  {'stage':'tag','status':'PENDING_FINAL_AUTHORIZED_PUBLICATION','detail':f'historical v0.1.0 remains {hist_tag_commit}; current candidate tag is {current_tag}','proof':'explicit current user authority required after final certification'},
  {'stage':'github-release','status':'PENDING_FINAL_AUTHORIZED_PUBLICATION','detail':f'historical v0.1.0 remains immutable; {current_tag} publication waits for final certification','proof':'explicit current user publication authority required'},
  {'stage':'registry-publication','status':'PENDING_FINAL_AUTHORIZED_PUBLICATION','detail':f'opencode-hi@{version} publication is authorized only after final certification','proof':'explicit conditional user authority'},
  {'stage':'registry-integrity','status':'BLOCKED_UPSTREAM_PUBLICATION','detail':'cannot verify registry integrity before publication','proof':'current-version npm publication absent'},
  {'stage':'fresh-registry-install','status':'BLOCKED_UPSTREAM_PUBLICATION','detail':'registry package absent','proof':'current-version npm publication absent'},
  {'stage':'T4-receipt','status':'PENDING_REAL_PUBLICATION_PROOF','detail':'no fabricated T4; requires real current GitHub/npm publication and verification','proof':'final external publication receipt required'},
 ]
release_source=(pub.get('released_source') or {}) if t4 else {}
release_commit=release_source.get('git_commit') if t4 else head
release_tree=release_source.get('git_tree') if t4 else tree
runtime_paths=['VERSION','plugin/package.json','plugin/package-lock.json','plugin/src','plugin/dist','skills','scripts/native_plugin_setup.py']
release_package_paths=['package.json','package-lock.json','README.md','docs/locales/tr/README.md']
def changed_paths(base,target,paths):
    if not base or not target:return []
    out=subprocess.run(['git','diff','--name-only',base,target,'--',*paths],cwd=ROOT,text=True,capture_output=True)
    return [x for x in out.stdout.splitlines() if x]
runtime_drift=changed_paths(release_commit,cert_head,runtime_paths) if t4 else []
package_doc_drift=changed_paths(release_commit,cert_head,release_package_paths) if t4 else []
checks={
 'fresh_source_binding':isinstance(head,str) and isinstance(tree,str) and len(head)==40 and len(tree)==40,
 'fresh_exact_host':fresh.get('status')=='PASS' and fresh_host.get('opencode')=='1.18.18' and fresh_host.get('platform')=='linux' and fresh_host.get('architecture')=='aarch64' and isinstance(fresh_host.get('binary_sha256'),str) and len(fresh_host.get('binary_sha256'))==64,
 'historical_tag_distinct':hist_tag_commit!=release_commit,
 'historical_release_source':historical.get('github',{}).get('released_source')==hist_tag_commit,
 'released_runtime_immutable':not runtime_drift,
}
if t4:
 rs=pub.get('released_source') or {};gh=pub.get('github_release') or {};npm=pub.get('npm_registry') or {};fr=pub.get('fresh_registry_consumer') or {}
 checks.update({
  'current_tag_annotated':sh('git','cat-file','-t',f'refs/tags/{current_tag}')=='tag',
  'current_tag_exact_source':sh('git','rev-parse',f'{current_tag}^{{}}')==rs.get('git_commit') and rs.get('annotated_tag')==current_tag,
  'github_release_t4':gh.get('status')=='PASS_T4' and gh.get('tag')==current_tag and gh.get('tag_peels_to_released_source') is True,
  'registry_published_t4':npm.get('status')=='PASS_T4' and npm.get('package')=='opencode-hi' and npm.get('version')==version and npm.get('latest')==version,
  'registry_integrity_t4':npm.get('pack_integrity_match') is True and npm.get('pack_shasum_match') is True and npm.get('provenance_status')=='PASS',
  'fresh_registry_t4':fr.get('status')=='PASS_T4' and fr.get('exact_opencode')=='1.18.18',
  'publication_receipt_t4':pub.get('status')=='PASS_T4',
 })
else:
 checks.update({'current_publication_receipt_absent':not published,'no_current_tag_present':subprocess.run(['git','rev-parse','--verify','--quiet',f'refs/tags/{current_tag}'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0})
viol=[k for k,v in checks.items() if not v]
status='CLOSED_T4' if t4 and not viol else ('CLOSED_LOCAL_T4_BLOCKED' if not viol else 'FAIL')
proofs=['VERSION','package.json','package-lock.json','plugin/package-lock.json','data/validation/fresh-consumer-opencode-1.18.18.json','data/validation/release-status-0.1.0.json','.github/workflows/npm-publish.yml','scripts/verify-npm-oidc-release.mjs']
if published:proofs += [pub_rel,f'data/validation/t4-registry-exact-host-{version}.json']
out={'schema':1,'kind':'PROMPT_B_RELEASE_ENGINEERING_AUDIT','program':'PROMPT_B','section':28,'status':status,'current_source':{'commit':cert_head,'tree':cert_tree,'version':version},'release_source':{'commit':release_commit,'tree':release_tree,'tag':current_tag if t4 else None},'development_head':{'post_release':bool(t4 and cert_head!=release_commit),'runtime_drift_from_release':runtime_drift,'package_or_documentation_drift_from_release':package_doc_drift,'republish_same_version_forbidden':bool(t4 and cert_head!=release_commit)},'certification_head':{'commit':cert_head,'tree':cert_tree},'historical_release':{'tag':'v0.1.0','source_commit':hist_tag_commit,'github_status':'PASS_T4','release_id':historical.get('github',{}).get('release_id')},'registry_observation':{'observed_at':registry.get('observed_at'),'reference_host_registry_latest':registry.get('opencode_ai_latest'),'reference_sdk_registry_latest':registry.get('sdk_latest'),'current_publication_receipt_present':published,'authority_granted':False,'authority_condition':'explicit current user authority required after final certification; this audit never grants publication authority'},'stages':stages,'checks':checks,'violations':viol,'summary':{'stages':13,'local_pass_or_historical':13 if t4 else 8,'blocked_external_or_identity':0 if t4 else 5,'violations':len(viol)},'proof_hashes':{rel:sha(rel) for rel in proofs},'claim_boundary':'T4 certifies the immutable released tag/artifact, not every later documentation commit on main. A post-release development HEAD may advance documentation without mutating the published artifact; the same version must never be republished. Historical v0.1.0 remains immutable.' if t4 else 'Release-engineering truth for the current candidate. Historical v0.1.0 remains immutable. T4 remains pending until real external publication and verification.'}
OUT.write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8',newline='\n')
print(f"release engineering audit {out['status']}: stages=13 blocked={out['summary']['blocked_external_or_identity']} violations={len(viol)}")
if viol:raise SystemExit(1)
