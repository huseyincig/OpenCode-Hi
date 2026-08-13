#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path
from generate_methodology_skills import main as generate_skill_projections

ROOT=Path(__file__).resolve().parents[1]
PROFILES=ROOT/'data'/'hi-methodologies.json'
SKILLS=ROOT/'skills'
ROLE_CATALOG=ROOT/'data'/'hi-roles.json'
OUT=ROOT/'plugin'/'src'/'generated'/'methodology-policy.ts'

def contract(path:Path):
    text=path.read_text(encoding='utf-8')
    def field(label:str):
        m=re.search(rf'^- \*\*{re.escape(label)}:\*\*\s*(.+)$',text,re.M)
        if not m: raise ValueError(f'{path}: missing Contract field {label}')
        return m.group(1).strip()
    fm=re.match(r'^---\n([\s\S]*?)\n---\n',text)
    if not fm: raise ValueError(f'{path}: missing frontmatter')
    name=re.search(r'^name:\s*(.+)$',fm.group(1),re.M)
    desc=re.search(r'^description:\s*(.+)$',fm.group(1),re.M)
    method_match=re.search(r'^## Method\s*\n\n([\s\S]*?)\n\n## Ownership boundary',text,re.M)
    if not method_match: raise ValueError(f'{path}: missing Method section')
    method=method_match.group(1).strip()
    if len(method)<180: raise ValueError(f'{path}: Method section is too thin to be an operational methodology')
    return {
      'name':name.group(1).strip() if name else '',
      'description':desc.group(1).strip() if desc else '',
      'trigger':field('Trigger'),
      'do_not_trigger':field('Do not trigger'),
      'exit_condition':field('Exit condition'),
      'role_affinity':[x.strip() for x in field('Role affinity').split(',') if x.strip()],
      'method':method,
    }

def main():
    generate_skill_projections()
    raw=json.loads(PROFILES.read_text(encoding='utf-8'))
    if raw.get('schema')!=2: raise ValueError('hi-methodologies schema must be 2')
    profiles=raw.get('profiles',[])
    policy=raw.get('policy',{})
    signal_catalog=raw.get('signal_catalog',{})
    exit_requirement_catalog=raw.get('exit_requirement_catalog',{})
    if not isinstance(signal_catalog,dict) or not signal_catalog: raise ValueError('missing signal_catalog')
    if not isinstance(exit_requirement_catalog,dict) or not exit_requirement_catalog: raise ValueError('missing exit_requirement_catalog')
    for requirement,spec in exit_requirement_catalog.items():
        if not isinstance(requirement,str) or not requirement or not isinstance(spec,dict): raise ValueError('invalid exit requirement catalog entry')
        if spec.get('scope') not in ('worker','mission') or not isinstance(spec.get('owner'),str) or not spec.get('owner'): raise ValueError(f'{requirement}: invalid exit requirement spec')
    trigger_catalog=[]
    producer_catalog=[]
    for signal,spec in signal_catalog.items():
        if not isinstance(signal,str) or not signal: raise ValueError('invalid methodology signal name')
        if not isinstance(spec,dict) or not isinstance(spec.get('trigger_source'),str): raise ValueError(f'{signal}: invalid signal spec')
        producers=spec.get('producers')
        if not isinstance(producers,list) or not producers or not all(isinstance(x,str) and x for x in producers): raise ValueError(f'{signal}: invalid signal producers')
        trigger_catalog.append(spec['trigger_source'])
        producer_catalog.extend(producers)
    trigger_catalog=list(dict.fromkeys(trigger_catalog))
    producer_catalog=list(dict.fromkeys(producer_catalog))
    exit_requirement_classes=policy.get('exit_requirement_classes',[])
    if not isinstance(exit_requirement_classes,list) or not exit_requirement_classes or not all(isinstance(x,str) and x for x in exit_requirement_classes): raise ValueError('missing methodology exit_requirement_classes')
    if len(exit_requirement_classes)!=len(set(exit_requirement_classes)): raise ValueError('duplicate methodology exit_requirement_classes')
    if exit_requirement_classes!=list(exit_requirement_catalog): raise ValueError('policy exit_requirement_classes must exactly mirror exit_requirement_catalog order')
    if policy.get('default_active') != 0: raise ValueError('methodology default_active must be 0')
    if not isinstance(policy.get('typical_max'),int) or policy['typical_max'] < 0: raise ValueError('invalid methodology typical_max')
    if not isinstance(policy.get('hard_max'),int) or policy['hard_max'] < policy['typical_max']: raise ValueError('invalid methodology hard_max')
    names=[p['name'] for p in profiles]
    if len(names)!=len(set(names)): raise ValueError('duplicate methodology profile names')
    packaged_names=sorted(path.parent.name for path in SKILLS.glob('hi-*/SKILL.md'))
    if sorted(names)!=packaged_names: raise ValueError(f'methodology catalog/package inventory drift: catalog={sorted(names)} packaged={packaged_names}')
    role_raw=json.loads(ROLE_CATALOG.read_text(encoding='utf-8'))
    canonical_roles={item['id'] for item in role_raw.get('roles',[])}
    normalized=[]
    method_owners={}
    for p in profiles:
        name=p['name']
        c=contract(SKILLS/name/'SKILL.md')
        method_key=re.sub(r'\s+',' ',c['method']).strip().lower()
        if method_key in method_owners: raise ValueError('duplicate Method body: '+method_owners[method_key]+' and '+name)
        method_owners[method_key]=name
        if c['description']!=p['purpose']: raise ValueError(f"{name}: SKILL.md/profile drift for description/purpose: {c['description']!r} != {p['purpose']!r}")
        for key in ('name','trigger','do_not_trigger','exit_condition','role_affinity'):
            if c[key]!=p[key]: raise ValueError(f'{name}: SKILL.md/profile drift for {key}: {c[key]!r} != {p[key]!r}')
        compatible=list(dict.fromkeys(p.get('compatible_roles',[])))
        exit_requirements=list(dict.fromkeys(p.get('exit_requirements',[])))
        if not exit_requirements: raise ValueError(f'{name}: missing exit_requirements')
        unknown_exit=[item for item in exit_requirements if item not in exit_requirement_classes]
        if unknown_exit: raise ValueError(f'{name}: unknown exit_requirements {unknown_exit}')
        activation_signals=list(dict.fromkeys(p.get('activation_signals',[])))
        if not activation_signals: raise ValueError(f'{name}: missing activation_signals')
        unknown_signals=[signal for signal in activation_signals if signal not in signal_catalog]
        if unknown_signals: raise ValueError(f'{name}: unknown activation_signals {unknown_signals}')
        trigger_sources=list(dict.fromkeys(signal_catalog[signal]['trigger_source'] for signal in activation_signals))
        affinity=list(dict.fromkeys(p['role_affinity']))
        if not affinity: raise ValueError(f'{name}: missing role_affinity')
        if any(role not in compatible for role in affinity): raise ValueError(f'{name}: preferred role must be compatible')
        unknown_roles=[role for role in compatible if role not in canonical_roles]
        if unknown_roles: raise ValueError(f'{name}: compatible_roles reference unknown roles {unknown_roles}')
        normalized.append({
          'name':name,
          'purpose':p['purpose'],
          'trigger':p['trigger'],
          'doNotTrigger':p['do_not_trigger'],
          'exitCondition':p['exit_condition'],
          'preferredRoles':affinity,
          'compatibleRoles':compatible,
          'contextCost':p['context_cost'],
          'executionCost':p['execution_cost'],
          'priority':p['priority'],
          'weight':p['weight'],
          'compositionCost':p['composition_cost'],
          'usefulCoexistence':p.get('useful_coexistence',[]),
          'conflicts':p.get('conflicts',[]),
          'resourceRequirements':p.get('resource_requirements',[]),
          'exitRequirements':exit_requirements,
          'activationSignals':activation_signals,
          'triggerSources':trigger_sources,
        })
    payload=json.dumps(normalized,ensure_ascii=False,sort_keys=True,separators=(',',':'))
    trigger_payload=json.dumps(trigger_catalog,ensure_ascii=False,separators=(',',':'))
    producer_payload=json.dumps(producer_catalog,ensure_ascii=False,separators=(',',':'))
    limits_payload=json.dumps({'defaultActive':policy['default_active'],'typicalMax':policy['typical_max'],'hardMax':policy['hard_max']},separators=(',',':'))
    exit_payload=json.dumps(exit_requirement_classes,ensure_ascii=False,separators=(',',':'))
    exit_catalog_payload=json.dumps(exit_requirement_catalog,ensure_ascii=False,sort_keys=True,separators=(',',':'))
    signal_payload=json.dumps(signal_catalog,ensure_ascii=False,sort_keys=True,separators=(',',':'))
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(
        '/* generated from data/hi-methodologies.json; SKILL.md mechanical sections are generated projections; do not hand edit */\n'
        + f'export const HI_METHODOLOGY_SIGNAL_CATALOG = {signal_payload} as const\n'
        + "export type HiMethodologySignalName = keyof typeof HI_METHODOLOGY_SIGNAL_CATALOG\n"
        + f'export const HI_METHODOLOGY_TRIGGER_SOURCES = {trigger_payload} as const\n'
        + "export type HiMethodologyTriggerSource = typeof HI_METHODOLOGY_TRIGGER_SOURCES[number]\n"
        + f'export const HI_METHODOLOGY_PRODUCERS = {producer_payload} as const\n'
        + "export type HiMethodologyProducer = typeof HI_METHODOLOGY_PRODUCERS[number]\n"
        + f'export const HI_METHODOLOGY_LIMITS = {limits_payload} as const\n'
        + f'export const HI_METHODOLOGY_EXIT_REQUIREMENT_CATALOG = {exit_catalog_payload} as const\n'
        + f'export const HI_METHODOLOGY_EXIT_REQUIREMENTS = {exit_payload} as const\n'
        + "export type HiMethodologyExitRequirement = typeof HI_METHODOLOGY_EXIT_REQUIREMENTS[number]\n"
        + f'export const HI_METHODOLOGY_POLICY = {payload} as const\n'
        + "export type HiMethodologyName = typeof HI_METHODOLOGY_POLICY[number]['name']\n",
        encoding='utf-8',
    )
    print(f'generated {len(normalized)} methodologies -> {OUT.relative_to(ROOT)}')

if __name__=='__main__': main()
