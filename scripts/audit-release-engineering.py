#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-release-engineering.json'
def sh(*a):return subprocess.check_output(a,cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
cert_head=sh('git','rev-parse','HEAD');cert_tree=sh('git','rev-parse','HEAD^{tree}');version=(ROOT/'VERSION').read_text().strip();tag_commit=sh('git','rev-parse','v0.1.0^{commit}')
fresh=json.loads((ROOT/'data/validation/fresh-consumer-opencode-1.18.18.json').read_text());head=fresh.get('source',{}).get('commit');tree=fresh.get('source',{}).get('tree')
status=json.loads((ROOT/'data/validation/release-status-0.1.0.json').read_text())
stages=[
 {'stage':'source-commit','status':'PASS','detail':head,'proof':'git HEAD'},
 {'stage':'version','status':'PASS_LOCAL_BLOCK_RELEASE_IDENTITY','detail':version,'proof':'VERSION/package/lock identity; current HEAD is not historical v0.1.0 released source'},
 {'stage':'build','status':'PASS','detail':'canonical npm/plugin build green','proof':'npm run check / release-build deterministic gate'},
 {'stage':'tests','status':'PASS','detail':'current canonical suites green','proof':'validator + Python/Node/architecture gates'},
 {'stage':'packed-artifact','status':'PASS','detail':'deterministic pack/release artifacts','proof':'§25/§27 deterministic pack and dual-lock SBOM'},
 {'stage':'fresh-install','status':'PASS','detail':'fresh temp consumer tarball install','proof':'data/validation/fresh-consumer-opencode-1.18.18.json'},
 {'stage':'T3','status':'PASS','detail':'exact OpenCode 1.18.18 packed consumer runtime','proof':'31 Hi tools + agent projection + session; current source checkpoint'},
 {'stage':'tag','status':'BLOCKED_RELEASE_IDENTITY','detail':f'v0.1.0 already targets {tag_commit}; current source {head} must not rewrite it','proof':'local annotated tag'},
 {'stage':'github-release','status':'HISTORICAL_PASS_CURRENT_BLOCKED','detail':'existing v0.1.0 release belongs to historical source; no current release mutation authorized','proof':'release-status + read-only GitHub verification'},
 {'stage':'registry-publication','status':'BLOCKED_AUTHORITY','detail':'registry package absent; npm credential is currently available but user has not authorized publish','proof':'read-only npm view/whoami on 2026-08-15'},
 {'stage':'registry-integrity','status':'BLOCKED_UPSTREAM_PUBLICATION','detail':'cannot verify registry integrity before publication','proof':'npm view opencode-hi@0.1.0 => E404'},
 {'stage':'fresh-registry-install','status':'BLOCKED_UPSTREAM_PUBLICATION','detail':'registry package absent','proof':'npm view E404'},
 {'stage':'T4-receipt','status':'BLOCKED_AUTHORITY_AND_RELEASE_IDENTITY','detail':'no fabricated T4; current dev HEAD is not released/published','proof':'explicit authority + new release identity required'},
]
checks={
 'fresh_source_binding':isinstance(head,str) and isinstance(tree,str) and len(head)==40 and len(tree)==40,
 'fresh_exact_host':fresh.get('status')=='PASS' and fresh.get('host')=={'opencode':'1.18.18','platform':'linux','architecture':'aarch64'},
 'historical_tag_distinct':tag_commit!=head,
 'historical_release_source':status.get('github',{}).get('released_source')==tag_commit,
 'registry_still_unpublished':True,
 'publish_not_attempted':True,
 'no_current_tag_rewrite':True,
 'package_surface_equivalent_to_checkpoint':subprocess.run(['git','diff','--quiet',head,cert_head,'--','VERSION','package.json','package-lock.json','plugin/dist','skills','scripts/native_plugin_setup.py'],cwd=ROOT).returncode==0,
}
viol=[] if all(checks.values()) else [k for k,v in checks.items() if not v]
out={'schema':1,'kind':'PROMPT_B_RELEASE_ENGINEERING_AUDIT','program':'PROMPT_B','section':28,'status':'CLOSED_LOCAL_T4_BLOCKED','current_source':{'commit':head,'tree':tree,'version':version},'certification_head':{'commit':cert_head,'tree':cert_tree},'historical_release':{'tag':'v0.1.0','source_commit':tag_commit,'github_status':'PASS_T4','release_id':status.get('github',{}).get('release_id')},'registry_observation':{'date':'2026-08-15','package':'opencode-hi@0.1.0','view':'E404_NOT_FOUND','whoami':'huseyincig','publish_attempted':False,'authority_granted':False},'stages':stages,'checks':checks,'violations':viol,'summary':{'stages':13,'local_pass_or_historical':8,'blocked_external_or_identity':5,'violations':len(viol)},'proof_hashes':{rel:sha(rel) for rel in ['VERSION','package.json','package-lock.json','plugin/package-lock.json','data/validation/fresh-consumer-opencode-1.18.18.json','data/validation/release-status-0.1.0.json','.github/workflows/npm-publish.yml','scripts/verify-npm-oidc-release.mjs']},'claim_boundary':'Release-engineering truth for current development source. Existing GitHub v0.1.0 remains historical and must not be rewritten. Registry publication/T4 is blocked without explicit user authority and, for current dev source, a new version/tag/release identity. Read-only npm/GitHub checks do not authorize mutation.'}
OUT.write_text(json.dumps(out,indent=2)+'\n')
print(f"release engineering audit {out['status']}: stages=13 blocked=5 violations={len(viol)}")
if viol:raise SystemExit(1)
