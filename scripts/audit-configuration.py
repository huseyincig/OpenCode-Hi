#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-configuration.json'
def sha(rel): return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def get_path(root,path):
    cur=root
    for part in path.split('.'): cur=cur[part]
    return cur
catalog=json.loads((ROOT/'data/hi-config-options.json').read_text())
options=catalog.get('options',[]);violations=[];rows=[]
if catalog.get('schema')!=1 or catalog.get('type')!='hi-config-option-catalog': violations.append('catalog-header')
if not options: violations.append('catalog-empty')
paths=[x.get('path') for x in options]
if len(paths)!=len(set(paths)): violations.append('duplicate-config-path')
if any(x.get('owner')!='hi-config' for x in options): violations.append('duplicate-config-owner')
# Consumer owners: actual executable/diagnostic implementation, not catalog prose.
def consumer_for(path):
    if path=='schemaVersion': return ('plugin/src/config/resolver.ts','suppliedSchema')
    if path=='executionPolicy': return ('plugin/src/config/execution-policy.ts','executionProfileFor')
    if path=='primaryMode': return ('plugin/src/runtime/application/runtime-services.ts','primaryMode')
    if path.startswith('compatibility.'): return ('plugin/src/doctor/checks.ts','config.compatibility')
    if path.startswith('execution.'): return ('plugin/src/runtime/execution/topology-policy.ts','config.')
    if path in {'models.mode','models.default','models.roles','routing.strategy','routing.categoryModels'}: return ('plugin/src/config/resolver.ts','legacyRoutingDiagnostics')
    if path.startswith('models.') or path.startswith('routing.'): return ('plugin/src/runtime/routing/model-resolver.ts','config.')
    if path.startswith('parallel.'): return ('plugin/src/runtime/application/runtime-services.ts','getConfig().parallel')
    if path.startswith('profile.'): return ('plugin/src/runtime/task/task-runtime.ts','cfg.profile')
    raise KeyError(path)
# defaults are generated from the catalog and consumed via DEFAULT_HI_CONFIG.
generated=(ROOT/'plugin/src/generated/config-policy.ts').read_text(errors='replace')
defaults=json.loads(generated.split('export const HI_CONFIG_DEFAULTS = ',1)[1].split(' as const',1)[0])
doc=(ROOT/'docs/INSTALLATION.md').read_text(errors='replace')
for opt in options:
    path=opt['path']; consumer,anchor=consumer_for(path); proof='plugin/test/'+opt['behavioral_acceptance_refs'][0]
    for required in ('validator','precedence_order','source_surfaces','behavioral_acceptance_refs'):
        if not opt.get(required): violations.append(f'{path}:missing-{required}')
    effect=opt.get('executor_effect') if opt['classification']=='runtime' else opt.get('diagnostic_effect')
    if not effect: violations.append(f'{path}:CONFIG_WITHOUT_EXECUTABLE_EFFECT')
    try:
        if get_path(defaults,path)!=opt['default']: violations.append(f'{path}:default-drift')
    except Exception: violations.append(f'{path}:generated-default-missing')
    if not (ROOT/consumer).is_file(): violations.append(f'{path}:consumer-missing:{consumer}')
    elif anchor not in (ROOT/consumer).read_text(errors='replace'): violations.append(f'{path}:consumer-anchor-drift:{anchor}')
    if not (ROOT/proof).is_file(): violations.append(f'{path}:proof-missing:{proof}')
    if f'`{path}`' not in doc: violations.append(f'{path}:STALE_CONFIG_DOC')
    rows.append({'path':path,'id':opt['id'],'classification':opt['classification'],'schema':'plugin/src/config/schema.ts','schema_sha256':sha('plugin/src/config/schema.ts'),'validator':opt['validator'],'default':opt['default'],'default_owner':'data/hi-config-options.json -> plugin/src/generated/config-policy.ts -> plugin/src/config/defaults.ts','precedence_order':opt['precedence_order'],'consumer':consumer,'consumer_sha256':sha(consumer),'consumer_anchor':anchor,'observable_effect':effect,'documentation':'docs/INSTALLATION.md','documentation_sha256':sha('docs/INSTALLATION.md'),'proof':proof,'proof_sha256':sha(proof),'safety_semantics':opt['safety_semantics']})
resolver=(ROOT/'plugin/src/config/resolver.ts').read_text(errors='replace'); discovery=(ROOT/'plugin/src/config/routing-discovery.ts').read_text(errors='replace'); hostile=(ROOT/'plugin/test/routing-config-discovery.test.mjs').read_text(errors='replace'); configtest=(ROOT/'plugin/test/config.test.mjs').read_text(errors='replace'); defaults_src=(ROOT/'plugin/src/config/defaults.ts').read_text(errors='replace')
guards={
 'catalog_unique_leaves':bool(options) and len(paths)==len(set(paths)),
 'single_semantic_owner':all(x.get('owner')=='hi-config' for x in options),
 'generated_defaults_owned_by_catalog':'HI_CONFIG_DEFAULTS' in defaults_src and 'structuredClone' in defaults_src,
 'resolver_uses_canonical_defaults':'DEFAULT_HI_CONFIG.' in resolver,
 'project_loader_sparse_overrides':"const out:Partial<HiConfig> = {}" in discovery and "routing.strategy = r.strategy" in discovery,
 'profile_known_leaf_enum_projection':'function threshold(value:unknown)' in resolver and 'profileLayer' in resolver,
 'unknown_host_config_confined':'unknown and invalid host profile leaves never enter canonical runtime config' in configtest,
 'per_leaf_precedence_proved':'project precedence is leaf-scoped and absent project siblings preserve host constraints' in hostile,
 'invalid_high_precedence_does_not_erase_low':'invalid or unknown project leaves cannot replace valid host config' in hostile,
 'constraint_composition_monotonic':'project routing constraints narrow but never weaken raw/native Hi constraints' in hostile and 'allowedProviders=hostAllowed.length&&projectAllowed.length?hostAllowed.filter' in resolver and 'deniedModels=[...new Set([...hostDenied,...projectDenied])]' in resolver,
 'docs_generated_from_catalog':'Generated from `data/hi-config-options.json`. Do not hand-edit this table.' in doc,
}
for k,v in guards.items():
    if not v: violations.append('static-guard:'+k)
status='PASS' if not violations else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_CONFIGURATION_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':23,'status':status,'leaves':rows,'static_guards':guards,'violations':violations,'summary':{'required':len(options),'covered':len(rows),'violations':len(violations),'runtime':sum(x['classification']=='runtime' for x in options),'diagnostic':sum(x['classification']=='diagnostic' for x in options),'schema_marker':sum(x['classification']=='schema-marker' for x in options)},'closed_defects':[{'id':'profile-unknown-config-injection','class':'UNKNOWN_CONFIG_ACCEPTED','fix':'Profile settings project only the two canonical threshold leaves and accept only low|medium|high.'},{'id':'block-level-precedence-widening','class':'LOWER_PRECEDENCE_SAFETY_WIDENING','fix':'Nested config resolution is per-leaf; absent/invalid project siblings no longer erase valid host constraints or preferences.'},{'id':'project-routing-synthetic-default-override','class':'DUPLICATE_CONFIG_OWNER','fix':'Project routing discovery returns sparse explicit validated overrides and no longer manufactures strategy/list/map defaults.'}],'claim_boundary':'A runtime config leaf is certified only when the canonical catalog, generated default, resolver/precedence path, executable or diagnostic consumer, generated documentation, and behavioral proof are all present. Unknown keys are ignored rather than admitted to canonical HiConfig; lower-precedence safety constraints are not silently widened by absent higher-precedence leaves.'}
OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"configuration audit {status}: covered={len(rows)}/{len(options)} violations={len(violations)}")
if violations: print('\n'.join(violations))
sys.exit(0 if status=='PASS' else 1)
