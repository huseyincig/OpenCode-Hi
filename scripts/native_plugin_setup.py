#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess, sys, time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PRODUCT='OpenCode-Hi'
SHORT='HI'
PACKAGE='opencode-hi'
REPO='https://github.com/huseyincig/OpenCode-Hi.git'
VERSION=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
OWNERSHIP=Path('.opencode/hi/provenance/setup.json')
OWNERSHIP_SCHEMA=2
HI_PROJECT_DIR=Path('.opencode/hi')
ROUTING_CONFIG=HI_PROJECT_DIR/'policy'/'routing.json'

# Default provider fallback when OpenCode env is not queryable from this script.
# Mirrors the HI defaults documented in docs/INSTALLATION.md.
DEFAULT_PROVIDER_MODELS=[
    'opencode-go/minimax-m3',
    'opencode-go/minimax-m3-high',
    'opencode-go/minimax-m3-low',
    'opencode-go/qwen3.7-plus',
    'opencode-go/deepseek-v4-pro',
]

# Roles with explicit per-role model mapping hints. Other roles fall back to
# scoring + provider selection without an explicit roleModels entry.
ROLES_WITH_HINT=['working-manager','manager','repository-explorer','architect','coder','qa-reviewer','security-reviewer','visual-qa']

DEFAULT_ROLE_MODELS={
 'working-manager':['opencode-go/minimax-m3'],
 'manager':['opencode-go/minimax-m3-high','opencode-go/minimax-m3'],
 'repository-explorer':['opencode-go/deepseek-v4-flash'],
 'architect':['opencode-go/glm-5.2'],
 'coder':['opencode-go/deepseek-v4-pro'],
 'qa-reviewer':['opencode-go/qwen3.7-plus'],
 'security-reviewer':['opencode-go/glm-5.2'],
 'visual-qa':['opencode-go/mimo-v2.5'],
}
DEFAULT_ROLE_MODEL='opencode-go/minimax-m3'

ROUTING_SCHEMA=1
EXECUTION_POLICIES={'minimal','balanced','thorough','adaptive','manual'}
PROFILE_NAMES={'minimal','balanced','thorough'}

def sha_text(s:str)->str:return hashlib.sha256(s.encode()).hexdigest()
def load(path:Path)->dict:
    try:return json.loads(path.read_text(encoding='utf-8'))
    except Exception:return {}
def dump(d:dict)->str:return json.dumps(d,ensure_ascii=False,indent=2)+'\n'

def managed_path_safe(project:Path,path:Path)->bool:
    root=project.resolve()
    try:
        rel=path.relative_to(project)
    except ValueError:
        return False
    cur=project
    for part in rel.parts:
        cur=cur/part
        if cur.is_symlink():
            return False
    try:
        target=path.resolve(strict=False)
        return os.path.commonpath([str(root),str(target)])==str(root)
    except (OSError,ValueError):
        return False

def assert_managed_paths(project:Path,*paths:Path)->dict|None:
    unsafe=[str(p) for p in paths if not managed_path_safe(project,p)]
    return {'status':'BLOCKED','product':PRODUCT,'reason':'managed-path-escapes-project-or-uses-symlink','unsafe_paths':unsafe} if unsafe else None

def config_path(project:Path)->Path:
    j=project/'opencode.json'; jc=project/'opencode.jsonc'
    return j if j.exists() or not jc.exists() else jc
def hi_spec(version:str|None=None)->str:
    return f'{PACKAGE}@{version or VERSION}'
def is_hi(x:object)->bool:
    return isinstance(x,str) and (x==PACKAGE or x.startswith(PACKAGE+'@') or 'OpenCode-Hi' in x)
def _plugins(data:dict)->list[str]:
    raw=data.get('plugin')
    return [x for x in raw if isinstance(x,str)] if isinstance(raw,list) else []

def plan(project:Path,version:str|None=None)->dict:
    cfg=config_path(project);data=load(cfg);plugins=_plugins(data);target=hi_spec(version)
    hi=[x for x in plugins if is_hi(x)]
    foreign=[x for x in hi if x!=target]
    next_plugins=[x for x in plugins if not is_hi(x)]+[target]
    after=dict(data);after['plugin']=next_plugins
    status='BLOCKED' if foreign or cfg.suffix=='.jsonc' else 'READY'
    return {'status':status,'product':PRODUCT,'short':SHORT,'project':str(project),'config':str(cfg),'plugin_spec':target,'conflicting_hi_specs':foreign,'before_plugins':plugins,'after_plugins':next_plugins,'changed':plugins!=next_plugins,'rendered':dump(after)}

def install(project:Path,version:str|None=None)->dict:
    p=plan(project,version)
    if p['status']!='READY':p.pop('rendered',None);return p
    project.mkdir(parents=True,exist_ok=True);cfg=Path(p['config']);own=project/OWNERSHIP;guard=assert_managed_paths(project,cfg,own);
    if guard:return guard
    cfg.parent.mkdir(parents=True,exist_ok=True)
    before=cfg.read_text(encoding='utf-8') if cfg.exists() else ''
    cfg.write_text(p['rendered'],encoding='utf-8')
    own.parent.mkdir(parents=True,exist_ok=True)
    own.write_text(dump({'schema':OWNERSHIP_SCHEMA,'product':PRODUCT,'short':SHORT,'plugin_spec':p['plugin_spec'],'managed':{'config':{'path':str(cfg.relative_to(project)),'before_sha256':sha_text(before),'after_sha256':sha_text(p['rendered']),'plugin_spec':p['plugin_spec']}},'preserved':{'user_plugins':True},'installed_at':int(time.time())}),encoding='utf-8')
    return {'status':'APPLIED','config':str(cfg),'plugin_spec':p['plugin_spec'],'restart_required':True,'next':'Restart OpenCode, then verify HI tools, agents, native skills and role-model routing in the runtime.'}

def uninstall(project:Path)->dict:
    cfg=config_path(project);own_path=project/OWNERSHIP;guard=assert_managed_paths(project,cfg,own_path)
    if guard:return guard
    data=load(cfg);plugins=_plugins(data);own=load(own_path) if own_path.exists() else {}
    managed=(own.get('managed') or {}).get('config') or {}
    owned_spec=managed.get('plugin_spec')
    if cfg.suffix=='.jsonc':return {'status':'BLOCKED','product':PRODUCT,'reason':'jsonc-safe-mutation-not-supported','config':str(cfg)}
    if not owned_spec:
        # No ownership proof: never delete an arbitrary Hi registration.
        found=[x for x in plugins if is_hi(x)]
        return {'status':'NOOP' if not found else 'BLOCKED','product':PRODUCT,'config':str(cfg),'reason':'ownership-proof-missing' if found else 'not-installed-by-hi','removed':[]}
    if owned_spec not in plugins:
        # User changed/adopted the registration after install. Preserve it.
        if own_path.exists(): own_path.unlink()
        return {'status':'PRESERVED','product':PRODUCT,'config':str(cfg),'removed':[],'reason':'owned-plugin-spec-no-longer-present; current Hi registration treated as user-owned','restart_required':False}
    data['plugin']=[x for x in plugins if x!=owned_spec]
    cfg.write_text(dump(data),encoding='utf-8')
    # Remove only setup-owned/configuration surfaces. Durable project knowledge,
    # artifacts, and project-created skills are separate ownership classes and
    # are intentionally preserved unless a future explicit purge operation owns them.
    removed_paths=[]
    for rel in (OWNERSHIP,):
        path=project/rel
        if path.exists() and path.is_file():path.unlink();removed_paths.append(str(rel))
    for rel in (HI_PROJECT_DIR/'provenance', HI_PROJECT_DIR):
        path=project/rel
        try:path.rmdir()
        except OSError:pass
    opencode_dir=project/'.opencode'
    try:opencode_dir.rmdir()
    except OSError:pass
    preserved=[]
    for rel in (HI_PROJECT_DIR/'policy',HI_PROJECT_DIR/'project-intelligence',HI_PROJECT_DIR/'artifacts',Path('.opencode/skills')):
        if (project/rel).exists():preserved.append(str(rel))
    return {'status':'APPLIED','product':PRODUCT,'config':str(cfg),'removed':[owned_spec],'removed_owned_paths':removed_paths,'preserved_project_data':preserved,'restart_required':True}

def doctor(project:Path)->dict:
    cfg=config_path(project);data=load(cfg);plugins=_plugins(data);hi=[x for x in plugins if is_hi(x)]
    own_path=project/OWNERSHIP;own=load(own_path) if own_path.exists() else {}
    managed=(own.get('managed') or {}).get('config') or {}
    recorded_after=managed.get('after_sha256')
    config_drift=None
    if recorded_after and cfg.exists():config_drift=sha_text(cfg.read_text(encoding='utf-8'))!=recorded_after
    routing_path=project/ROUTING_CONFIG;routing=load(routing_path) if routing_path.exists() else {}
    routing_schema=routing.get('schema') if routing_path.exists() else None
    issues=[];warnings=[]
    if not hi:issues.append('hi-plugin-not-registered')
    if len(hi)>1:issues.append('duplicate-hi-registration')
    if hi and not own_path.exists():warnings.append('ownership-proof-missing')
    if config_drift is True:warnings.append('managed-config-drift')
    if routing_path.exists() and routing_schema!=ROUTING_SCHEMA:issues.append('unsupported-routing-schema')
    return {'status':'FAIL' if issues else ('WARN' if warnings else 'OK'),'product':PRODUCT,'short':SHORT,'config':str(cfg),'hi_specs':hi,'ownership':{'state':'missing' if not own_path.exists() else ('healthy' if own else 'invalid'),'schema':own.get('schema'),'config_drift':config_drift},'routing':{'path':str(routing_path),'schema':routing_schema,'valid':not routing_path.exists() or routing_schema==ROUTING_SCHEMA},'issues':issues,'warnings':warnings,'note':'Registration/ownership doctor is static; actual plugin/agent/native-skill/model load must be verified in OpenCode runtime.'}

def discover_available_models()->list[str]:
    """Best-effort enumeration of currently available models.

    Tries in order:
      1. `opencode models --json` (if the binary is on PATH)
      2. parsing the HI plugin cache config.json (last resort, manifest only)
      3. fallback DEFAULT_PROVIDER_MODELS
    """
    try:
        out=subprocess.run(['opencode','models','--json'],capture_output=True,text=True,timeout=10)
        if out.returncode==0 and out.stdout.strip().startswith('['):
            data=json.loads(out.stdout)
            if isinstance(data,list):
                ids=[]
                for m in data:
                    if isinstance(m,dict) and isinstance(m.get('id'),str):ids.append(m['id'])
                    elif isinstance(m,str):ids.append(m)
                if ids:return sorted({i for i in ids if i.strip()})
    except Exception:pass
    # Fallback: read HI plugin cache manifest if it ships a model list
    try:
        m=json.loads((ROOT/'plugin/package.json').read_text())
    except Exception:return list(DEFAULT_PROVIDER_MODELS)
    # Plugin package itself doesn't enumerate OpenCode inventory; fall through.
    return list(DEFAULT_PROVIDER_MODELS)

def _prompt_model_selection(role:str,available:list[str],defaults_by_role:dict[str,list[str]])->list[str]:
    print(f"\n  Role: {role}")
    print(f"    default: {' / '.join(defaults_by_role.get(role,[DEFAULT_ROLE_MODEL]))}")
    print(f"    available:")
    for i,m in enumerate(available,1):
        print(f"      {i:>3}. {m}")
    raw=input("    select [comma-separated numbers | d=default | 0=none | a=abort] > ").strip()
    if raw=='' or raw.lower()=='d':return list(defaults_by_role.get(role,[DEFAULT_ROLE_MODEL]))
    if raw=='0':return []
    if raw.lower()=='a':sys.exit(0)
    selected=[]
    for token in raw.split(','):
        token=token.strip()
        if not token:continue
        try:
            idx=int(token)
        except ValueError:continue
        if 1<=idx<=len(available):
            sel=available[idx-1]
            if sel not in selected:selected.append(sel)
    return selected or list(defaults_by_role.get(role,[DEFAULT_ROLE_MODEL]))

def role_models(project:Path,list_available:bool=False,defaults:bool=False,print_only:bool=False,sets:list[str]|None=None,variants:list[str]|None=None,policy:str|None=None)->dict:
    """Interactive role→model mapping for HI routing.roleModels.

    Writes `.opencode/hi/policy/routing.json` (schema 1). HI runtime reads this
    file at startup and merges roleModels into HiConfig.routing.
    """
    cfg=project/ROUTING_CONFIG
    guard=assert_managed_paths(project,cfg)
    if guard:return guard
    existing=load(cfg) if cfg.exists() else {}
    existing_routing=existing.get('routing',{}) if isinstance(existing.get('routing'),dict) else {}
    existing_models=existing_routing.get('roleModels',{}) or {}
    existing_variants=existing_routing.get('roleVariants',{}) or {}

    if print_only:
        return {'status':'OK' if cfg.exists() else 'NOT_CONFIGURED','product':PRODUCT,'config':str(cfg),'roleModels':existing_models,'roleVariants':existing_variants,'modelPolicy':existing_routing.get('modelPolicy','adaptive'),'adaptiveRoles':existing_routing.get('adaptiveRoles',[]),'note':'HI runtime merges roleModels/roleVariants from this file.'}

    available=discover_available_models()
    if list_available:
        return {'status':'OK','product':PRODUCT,'available':available,'config':str(cfg),'note':'Use without --list-available to assign models.'}

    print(f"\n=== {PRODUCT} — Role Models Setup ===")
    print(f"Project: {project}")
    print(f"Config target: {cfg}")
    print(f"Schema: {ROUTING_SCHEMA}")
    if existing_models:
        print(f"Existing roleModels will be shown as default. Override per role.\n")
    else:
        print(f"No existing roleModels. Will write defaults unless you customise.\n")

    defaults_by_role={r:list(DEFAULT_ROLE_MODELS.get(r,[DEFAULT_ROLE_MODEL])) for r in ROLES_WITH_HINT}
    if existing_models:
        for r,ms in existing_models.items():defaults_by_role[r]=list(ms)

    # Preserve role mappings outside the interactive/canonical subset (for
    # example manager/working-manager or forward-compatible custom roles).
    new_roleModels={k:list(v) for k,v in existing_models.items() if isinstance(v,list)}
    if defaults and policy=='recommended':
        # Recommended reconfigure owns only canonical role recommendations;
        # preserve forward-compatible custom roles but do not retain stale
        # canonical models that are absent from the current inventory.
        new_roleModels={k:list(v) for k,v in existing_models.items() if isinstance(v,list) and k not in ROLES_WITH_HINT}

    if sets:
        for item in sets:
            if '=' not in item: continue
            role,models=item.split('=',1); role=role.strip(); vals=[x.strip() for x in models.split(',') if x.strip()]
            if role and vals:new_roleModels[role]=vals[:7]
    elif defaults:
        # Recommended setup validates defaults against the discovered inventory.
        # Missing roles are explicitly marked for Smart Select rather than
        # forcing a guessed/unavailable model into project config.
        for role,models in defaults_by_role.items():
            live=[m for m in models if m in available]
            if live:new_roleModels[role]=live
        print("Defaults mode: writing inventory-validated per-role recommendations.")
    else:
        try:
            for role in ROLES_WITH_HINT:
                new_roleModels[role]=_prompt_model_selection(role,available,defaults_by_role)
        except (EOFError,KeyboardInterrupt):
            return {'status':'ABORTED','product':PRODUCT,'reason':'user interrupted selection','config':str(cfg)}

    if not new_roleModels:
        return {'status':'NOT_CONFIGURED','product':PRODUCT,'reason':'no role models selected','config':str(cfg)}

    # Reconfigure is an in-place, ownership-safe edit. Preserve every
    # user/project-owned routing field we do not explicitly manage here.
    # Only roleModels is replaced by this command; strategy/category/provider
    # policy and unknown forward-compatible fields survive untouched.
    merged=dict(existing) if isinstance(existing,dict) else {}
    merged['schema']=ROUTING_SCHEMA
    merged.setdefault('type','hi-routing')
    existing_routing=merged.get('routing') if isinstance(merged.get('routing'),dict) else {}
    next_routing=dict(existing_routing)
    next_routing['roleModels']=new_roleModels
    next_variants={k:dict(v) for k,v in existing_variants.items() if isinstance(v,dict)}
    for item in variants or []:
        if '=' not in item or ':' not in item.split('=',1)[0]:continue
        lhs,var=item.split('=',1);role,model=lhs.split(':',1);role=role.strip();model=model.strip();var=var.strip()
        if role and model and var:next_variants.setdefault(role,{})[model]=var
    next_routing['roleVariants']=next_variants
    selected_policy=policy if policy in ('recommended','adaptive','manual') else ('manual' if sets or variants else ('recommended' if defaults else existing_routing.get('modelPolicy','manual')))
    next_routing['modelPolicy']=selected_policy
    if selected_policy=='recommended':
        next_routing['adaptiveRoles']=[r for r in ROLES_WITH_HINT if not new_roleModels.get(r)]
    elif selected_policy=='manual':
        next_routing['adaptiveRoles']=[]
    next_routing.setdefault('strategy','cost-quality')
    merged['routing']=next_routing
    merged['applied_at']=int(time.time())
    merged['applied_by']=PACKAGE
    merged.setdefault('ownership','project-routing-user-reconfigurable')
    cfg.parent.mkdir(parents=True,exist_ok=True)
    before_sha=sha_text(cfg.read_text(encoding='utf-8')) if cfg.exists() else ''
    cfg.write_text(dump(merged),encoding='utf-8')
    return {
        'status':'APPLIED',
        'product':PRODUCT,
        'config':str(cfg),
        'schema':ROUTING_SCHEMA,
        'roleModels':new_roleModels,
        'roleVariants':next_variants,
        'modelPolicy':next_routing['modelPolicy'],
        'adaptiveRoles':next_routing.get('adaptiveRoles',[]),
        'before_sha256':before_sha,
        'after_sha256':sha_text(merged['routing']['roleModels'] and json.dumps(merged,sort_keys=True) or ''),
        'restart_required':True,
        'next':'Restart OpenCode. HI runtime will pick up roleModels from this file on next mission start.',
        'available_models_used':available,
    }


def _bool_arg(value:str|None)->bool|None:
    if value is None:return None
    return value.lower() in ('1','true','yes','on','enabled','allow')

def _kv_limits(items:list[str]|None)->dict[str,int]:
    out={}
    for item in items or []:
        if '=' not in item:continue
        key,raw=item.split('=',1);key=key.strip()
        try:value=int(raw.strip())
        except ValueError:continue
        if key and value>0:out[key]=min(32,value)
    return out

def reconfigure(project:Path,*,print_only:bool=False,execution_policy:str|None=None,primary_mode:str|None=None,routing_strategy:str|None=None,allow_providers:list[str]|None=None,deny_models:list[str]|None=None,max_fallbacks:int|None=None,parallel_state:str|None=None,parallel_max:int|None=None,provider_limits:list[str]|None=None,model_limits:list[str]|None=None,profile_target:str='balanced',specialist_threshold:str|None=None,review_threshold:str|None=None,team_state:str|None=None,team_max_members:int|None=None,team_wall_minutes:int|None=None)->dict:
    """Ownership-safe project reconfiguration for main-prompt runtime knobs.

    OpenCode 1.18.x canonical config strips unknown top-level `hi` fields before
    plugin config hooks run. HI therefore persists its project-owned runtime
    settings in `.opencode/hi/policy/routing.json`, next to the existing model-routing
    policy, instead of mutating native OpenCode schema with private keys.
    """
    cfg=config_path(project)
    routing_path=project/ROUTING_CONFIG
    guard=assert_managed_paths(project,routing_path)
    if guard:return guard
    routing_doc=load(routing_path) if routing_path.exists() else {}
    merged=dict(routing_doc) if isinstance(routing_doc,dict) else {}
    merged['schema']=ROUTING_SCHEMA;merged.setdefault('type','hi-routing')
    if print_only:
        project_hi={k:merged[k] for k in ('executionPolicy','primaryMode','parallel','profile','teamMode') if k in merged}
        if isinstance(merged.get('routing'),dict) and 'maxFallbacks' in merged['routing']:
            project_hi['routing']={'maxFallbacks':merged['routing']['maxFallbacks']}
        return {'status':'OK' if cfg.exists() or routing_path.exists() else 'NOT_CONFIGURED','product':PRODUCT,'config':str(cfg),'project_config':str(routing_path),'hi':project_hi,'routing':(merged.get('routing',{}) if isinstance(merged.get('routing'),dict) else {}),'note':'Project Hi runtime settings are persisted outside native OpenCode schema; runtime hi_doctor verifies effective state.'}
    changed=[]
    selected_policy=execution_policy if execution_policy in EXECUTION_POLICIES else None
    if selected_policy is not None:merged['executionPolicy']=selected_policy;changed.append('executionPolicy')
    if primary_mode is not None:merged['primaryMode']=primary_mode;changed.append('primaryMode')
    parallel=dict(merged.get('parallel',{})) if isinstance(merged.get('parallel'),dict) else {}
    if parallel_state is not None:parallel['enabled']=_bool_arg(parallel_state);changed.append('parallel.enabled')
    if parallel_max is not None:parallel['max']=max(1,min(8,int(parallel_max)));changed.append('parallel.max')
    pl=_kv_limits(provider_limits);ml=_kv_limits(model_limits)
    if pl:parallel['providers']=pl;changed.append('parallel.providers')
    if ml:parallel['models']=ml;changed.append('parallel.models')
    if parallel:merged['parallel']=parallel
    profiles=dict(merged.get('profile',{})) if isinstance(merged.get('profile'),dict) else {}
    if profile_target not in PROFILE_NAMES: profile_target='balanced'
    target=dict(profiles.get(profile_target,{})) if isinstance(profiles.get(profile_target),dict) else {}
    for key,val in [('specialistThreshold',specialist_threshold),('reviewThreshold',review_threshold)]:
        if val is not None:target[key]=val;changed.append(f'profile.{profile_target}.{key}')
    if target:profiles[profile_target]=target;merged['profile']=profiles
    team=dict(merged.get('teamMode',{})) if isinstance(merged.get('teamMode'),dict) else {}
    if team_state is not None:team['enabled']=_bool_arg(team_state);changed.append('teamMode.enabled')
    for key,val,lo,hi in [('maxMembers',team_max_members,2,8),('maxWallMinutes',team_wall_minutes,1,240)]:
        if val is not None:team[key]=max(lo,min(hi,int(val)));changed.append(f'teamMode.{key}')
    if team:merged['teamMode']=team
    rr=dict(merged.get('routing',{})) if isinstance(merged.get('routing'),dict) else {}
    if max_fallbacks is not None:rr['maxFallbacks']=max(0,min(6,int(max_fallbacks)));changed.append('routing.maxFallbacks')
    if routing_strategy is not None:rr['strategy']=routing_strategy;changed.append('routing.strategy')
    if allow_providers is not None:rr['allowedProviders']=[x for x in allow_providers if x];changed.append('routing.allowedProviders')
    if deny_models is not None:rr['deniedModels']=[x for x in deny_models if x];changed.append('routing.deniedModels')
    if rr:merged['routing']=rr
    if not changed:return {'status':'NOOP','product':PRODUCT,'config':str(cfg),'project_config':str(routing_path),'reason':'no reconfigure fields supplied'}
    merged['applied_at']=int(time.time());merged['applied_by']=PACKAGE;merged.setdefault('ownership','project-routing-user-reconfigurable')
    routing_path.parent.mkdir(parents=True,exist_ok=True);routing_path.write_text(dump(merged),encoding='utf-8')
    return {'status':'APPLIED','product':PRODUCT,'config':str(cfg),'project_config':str(routing_path),'routing_config':str(routing_path),'changed':changed,'primaryMode':merged.get('primaryMode','auto'),'restart_required':True,'note':'Only explicitly supplied HI settings were changed in the project-owned HI config. Native OpenCode config, user plugins/MCP/unknown fields were not mutated.'}

def main()->int:
    ap=argparse.ArgumentParser(description=f'{PRODUCT} native OpenCode plugin setup')
    ap.add_argument('command',choices=['plan','install','doctor','uninstall','role-models','reconfigure']);ap.add_argument('project',nargs='?',default='.');ap.add_argument('--version')
    ap.add_argument('--list-available',action='store_true',help='For role-models: list available models and exit')
    ap.add_argument('--defaults',action='store_true',help='For role-models: write sensible defaults without prompting')
    ap.add_argument('--print',action='store_true',help='For role-models: print current config and exit')
    ap.add_argument('--set',dest='sets',action='append',default=[],help='For role-models: ROLE=PRIMARY[,FALLBACK1,FALLBACK2] (repeatable)')
    ap.add_argument('--variant',dest='variants',action='append',default=[],help='For role-models: ROLE:MODEL=VARIANT (repeatable)')
    ap.add_argument('--policy',choices=['recommended','adaptive','manual'],help='For role-models: persisted project model policy')
    ap.add_argument('--execution-policy',choices=['minimal','balanced','thorough','adaptive','manual'])
    ap.add_argument('--primary-mode',choices=['auto','working-manager','manager'])
    ap.add_argument('--routing-strategy',choices=['cost-quality','quality','cost'])
    ap.add_argument('--allow-provider',dest='allow_providers',action='append')
    ap.add_argument('--deny-model',dest='deny_models',action='append')
    ap.add_argument('--max-fallbacks',type=int)
    ap.add_argument('--parallel',dest='parallel_state',choices=['enabled','disabled'])
    ap.add_argument('--parallel-max',type=int)
    ap.add_argument('--provider-limit',action='append',default=[])
    ap.add_argument('--model-limit',action='append',default=[])
    ap.add_argument('--profile-target',choices=['minimal','balanced','thorough'],default='balanced')
    ap.add_argument('--specialist-threshold',choices=['low','medium','high'])
    ap.add_argument('--review-threshold',choices=['low','medium','high'])
    ap.add_argument('--team-mode',dest='team_state',choices=['enabled','disabled'])
    ap.add_argument('--team-max-members',type=int)
    ap.add_argument('--team-wall-minutes',type=int)
    a=ap.parse_args();project=Path(a.project).expanduser().resolve()
    cmds={
      'plan':lambda:plan(project,a.version),
      'install':lambda:install(project,a.version),
      'doctor':lambda:doctor(project),
      'uninstall':lambda:uninstall(project),
      'role-models':lambda:role_models(project,list_available=a.list_available,defaults=a.defaults,print_only=a.print,sets=a.sets,variants=a.variants,policy=a.policy),
      'reconfigure':lambda:reconfigure(project,print_only=a.print,execution_policy=a.execution_policy,primary_mode=a.primary_mode,routing_strategy=a.routing_strategy,allow_providers=a.allow_providers,deny_models=a.deny_models,max_fallbacks=a.max_fallbacks,parallel_state=a.parallel_state,parallel_max=a.parallel_max,provider_limits=a.provider_limit,model_limits=a.model_limit,profile_target=a.profile_target,specialist_threshold=a.specialist_threshold,review_threshold=a.review_threshold,team_state=a.team_state,team_max_members=a.team_max_members,team_wall_minutes=a.team_wall_minutes),
    }
    out=cmds[a.command]()
    out.pop('rendered',None);print(dump(out),end='');return 2 if out.get('status') in ('BLOCKED','FAIL') else 0
if __name__=='__main__':raise SystemExit(main())
