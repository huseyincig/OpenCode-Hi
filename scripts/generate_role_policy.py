#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'data'/'hi-roles.json'
ROLES=ROOT/'roles'
OUT=ROOT/'plugin'/'src'/'generated'/'role-policy.ts'
ID_RE=re.compile(r'^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$')
ROLE_CLASSES={'primary','child'}
WRITE_AUTH={'none','scoped','general'}
OBLIGATIONS={'implementation','analysis','review','verification'}

def fail(msg:str): raise ValueError(msg)
def string_list(value,field,allow_empty=False):
    if not isinstance(value,list) or (not allow_empty and not value): fail(f'{field}: expected {"an" if allow_empty else "a non-empty"} array')
    if not all(isinstance(x,str) and x.strip() for x in value): fail(f'{field}: entries must be non-empty strings')
    return value

def validate_role(raw,index):
    required={'id','purpose','role_class','use_when','do_not_use_when','read_only','reviewer','repository_write_authority','obligation_authority','delegation'}
    if not isinstance(raw,dict): fail(f'roles[{index}]: must be object')
    extra=set(raw)-required; missing=required-set(raw)
    if extra: fail(f'roles[{index}]: unknown fields {sorted(extra)}')
    if missing: fail(f'roles[{index}]: missing fields {sorted(missing)}')
    rid=raw['id']
    if not isinstance(rid,str) or not ID_RE.fullmatch(rid): fail(f'roles[{index}].id: invalid canonical id')
    if not isinstance(raw['purpose'],str) or not raw['purpose'].strip(): fail(f'{rid}: purpose required')
    if raw['role_class'] not in ROLE_CLASSES: fail(f'{rid}: invalid role_class')
    if not isinstance(raw['read_only'],bool) or not isinstance(raw['reviewer'],bool): fail(f'{rid}: read_only/reviewer must be boolean')
    if raw['repository_write_authority'] not in WRITE_AUTH: fail(f'{rid}: invalid repository_write_authority')
    if raw['read_only'] and raw['repository_write_authority']!='none': fail(f'{rid}: read-only role cannot own repository writes')
    string_list(raw['use_when'],f'{rid}.use_when'); string_list(raw['do_not_use_when'],f'{rid}.do_not_use_when')
    obligations=string_list(raw['obligation_authority'],f'{rid}.obligation_authority',True)
    if len(obligations)!=len(set(obligations)): fail(f'{rid}: duplicate obligation authority')
    if any(x not in OBLIGATIONS for x in obligations): fail(f'{rid}: unknown obligation authority')
    if raw['reviewer'] and 'review' not in obligations: fail(f'{rid}: reviewer must own review obligation')
    d=raw['delegation']
    if not isinstance(d,dict) or set(d)!={'may_delegate','allowed_role_refs'}: fail(f'{rid}: invalid delegation contract')
    if not isinstance(d['may_delegate'],bool): fail(f'{rid}: may_delegate must be boolean')
    refs=string_list(d['allowed_role_refs'],f'{rid}.allowed_role_refs',True)
    if any(not ID_RE.fullmatch(x) for x in refs): fail(f'{rid}: invalid delegation role ref')
    if not d['may_delegate'] and refs: fail(f'{rid}: non-delegating role lists refs')
    return raw

def frontmatter_projection(path:Path):
    text=path.read_text(encoding='utf-8')
    if not text.startswith('---\n'): fail(f'{path}: missing frontmatter')
    end=text.find('\n---\n',4)
    if end<0: fail(f'{path}: unterminated frontmatter')
    fm=text[4:end]
    description=re.search(r'^description:\s*(.+)$',fm,re.M)
    mode=re.search(r'^mode:\s*(.+)$',fm,re.M)
    if not description or not mode: fail(f'{path}: description/mode required during M2 parity window')
    return description.group(1).strip(),mode.group(1).strip()

def main():
    raw=json.loads(CATALOG.read_text(encoding='utf-8'))
    if raw.get('schema')!=1 or raw.get('type')!='hi-role-contract-catalog': fail('hi-roles catalog header invalid')
    roles=[validate_role(x,i) for i,x in enumerate(raw.get('roles',[]))]
    if len(roles)!=8: fail(f'canonical role inventory must remain 8 during M2: {len(roles)}')
    ids=[r['id'] for r in roles]
    if len(ids)!=len(set(ids)): fail('duplicate canonical role IDs')
    known=set(ids)
    for role in roles:
        for ref in role['delegation']['allowed_role_refs']:
            if ref not in known: fail(f"{role['id']}: delegation references unknown role {ref}")
    files={p.stem:p for p in ROLES.glob('*.md')}
    if set(files)!=known: fail(f'role contract/Markdown inventory drift: contracts={sorted(known)} markdown={sorted(files)}')
    for role in roles:
        desc,mode=frontmatter_projection(files[role['id']])
        expected_mode='primary' if role['role_class']=='primary' else 'subagent'
        if desc!=role['purpose']: fail(f"{role['id']}: Markdown description drift from RoleContract")
        if mode!=expected_mode: fail(f"{role['id']}: Markdown mode drift from RoleContract ({mode} != {expected_mode})")
    def ids_where(pred): return [r['id'] for r in roles if pred(r)]
    normalized=[{
      'id':r['id'],'purpose':r['purpose'],'roleClass':r['role_class'],'useWhen':r['use_when'],'doNotUseWhen':r['do_not_use_when'],
      'readOnly':r['read_only'],'reviewer':r['reviewer'],'repositoryWriteAuthority':r['repository_write_authority'],
      'obligationAuthority':r['obligation_authority'],'delegation':{'mayDelegate':r['delegation']['may_delegate'],'allowedRoleRefs':r['delegation']['allowed_role_refs']}
    } for r in roles]
    lines=[
      '/* generated from data/hi-roles.json and parity-validated against roles/*.md; do not hand edit */',
      f"export const HI_ROLE_CONTRACTS = {json.dumps(normalized,ensure_ascii=False,separators=(',',':'))} as const",
      f"export const HI_ROLE_IDS = {json.dumps(ids_where(lambda r:True),separators=(',',':'))} as const",
      f"export const HI_ROLE_PRIMARY_IDS = {json.dumps(ids_where(lambda r:r['role_class']=='primary'),separators=(',',':'))} as const",
      f"export const HI_ROLE_CHILD_IDS = {json.dumps(ids_where(lambda r:r['role_class']=='child'),separators=(',',':'))} as const",
      f"export const HI_ROLE_READ_ONLY_CHILD_IDS = {json.dumps(ids_where(lambda r:r['role_class']=='child' and r['read_only']),separators=(',',':'))} as const",
      f"export const HI_ROLE_REVIEWER_IDS = {json.dumps(ids_where(lambda r:r['reviewer']),separators=(',',':'))} as const",
      "export type HiRole = typeof HI_ROLE_IDS[number]",
      "export type HiPrimaryRole = typeof HI_ROLE_PRIMARY_IDS[number]",
      "export type HiChildRole = typeof HI_ROLE_CHILD_IDS[number]",
      "export type HiRoleContract = typeof HI_ROLE_CONTRACTS[number]",
      ''
    ]
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text('\n'.join(lines),encoding='utf-8')
    print(f'generated {len(roles)} role contracts -> {OUT.relative_to(ROOT)}')
if __name__=='__main__': main()
