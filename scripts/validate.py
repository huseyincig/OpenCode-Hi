#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERR: list[str] = []

CANONICAL_ROLES = {
    'manager', 'working-manager',
    'coder', 'architect', 'repository-explorer', 'researcher',
    'technical-writer', 'test-engineer', 'qa-reviewer',
    'security-reviewer', 'visual-qa',
}
PRIMARY_ROLES = {'manager', 'working-manager'}
CHILD_ROLES = CANONICAL_ROLES - PRIMARY_ROLES
OBLIGATION_TYPES = {
    'implementation', 'analysis', 'review', 'verification',
    'research', 'documentation', 'test-authoring',
}
CONFIG_CLASSES = {'runtime', 'diagnostic', 'schema-marker'}


def err(message: str) -> None:
    ERR.append(message)


def load_json(rel: str):
    return json.loads((ROOT / rel).read_text(encoding='utf-8'))


def sha(rel: str) -> str:
    return hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ['git', '-c', f'safe.directory={ROOT}', *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=check,
    )


def validate_identity_and_packages() -> str:
    version = (ROOT / 'VERSION').read_text(encoding='utf-8').strip()
    if not re.fullmatch(r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?', version):
        err(f'VERSION is not valid SemVer: {version}')

    identity = load_json('data/product.json')
    expected = {
        'product_name': 'OpenCode-Hi',
        'short_name': 'HI',
        'version': version,
        'repository': 'https://github.com/huseyincig/OpenCode-Hi',
        'plugin_package': 'opencode-hi',
        'runtime_entrypoint': 'plugin/dist/plugin.js',
    }
    for key, value in expected.items():
        if identity.get(key) != value:
            err(f'product identity {key}: {identity.get(key)!r} != {value!r}')

    root_pkg = load_json('package.json')
    plugin_pkg = load_json('plugin/package.json')
    root_lock = load_json('package-lock.json')
    plugin_lock = load_json('plugin/package-lock.json')
    versions = [
        root_pkg.get('version'), plugin_pkg.get('version'),
        root_lock.get('version'), (root_lock.get('packages') or {}).get('', {}).get('version'),
        plugin_lock.get('version'), (plugin_lock.get('packages') or {}).get('', {}).get('version'),
    ]
    if any(item != version for item in versions):
        err(f'package/version parity drift: VERSION={version} observed={versions}')
    if root_pkg.get('name') != 'opencode-hi':
        err('root package name drift')
    if root_pkg.get('main') != 'plugin/dist/plugin.js' or not (ROOT / 'plugin/dist/plugin.js').is_file():
        err('root plugin entrypoint missing')

    host_target = str((root_pkg.get('dependencies') or {}).get('@opencode-ai/sdk') or '').strip()
    host_peer = str((root_pkg.get('peerDependencies') or {}).get('@opencode-ai/plugin') or '').strip()
    if not re.fullmatch(r'\d+\.\d+\.\d+', host_target) or host_peer != host_target:
        err('exact OpenCode SDK/plugin target pin drift')

    if plugin_pkg.get('allowScripts') != {'msgpackr-extract@3.0.4': True}:
        err('plugin install-script allowlist mismatch')
    for rel, meta in (plugin_lock.get('packages') or {}).items():
        if not rel or meta.get('link'):
            continue
        if not meta.get('version'):
            err(f'plugin package-lock entry missing version: {rel}')
        if not meta.get('resolved') or not meta.get('integrity'):
            err(f'plugin package-lock entry missing resolved/integrity: {rel}')
    return version


def validate_repository_hygiene(version: str) -> None:
    required_root = {
        'README.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE',
        'VERSION', 'package.json', 'package-lock.json',
    }
    for name in required_root:
        if not (ROOT / name).is_file():
            err(f'required root file missing: {name}')

    if not re.search(rf'^##\s+(?:\[)?v?{re.escape(version)}(?:\])?(?:\s|$)', (ROOT / 'CHANGELOG.md').read_text(encoding='utf-8'), re.M | re.I):
        err('CHANGELOG current version entry missing')

    forbidden = {
        'KURULUM.md', 'RELEASE-READINESS.md', 'WORK-STATE.md', 'work-state.json',
        'HI.cmd', 'HI.sh', 'HI-VALIDATE.cmd', 'HI-VALIDATE.sh',
        'HI-RELEASE-PREP.cmd', 'HI-RELEASE-PREP.sh',
        'docs/HI-TEST-LAB-HANDOFF.md', 'docs/FLOW-11-COVERAGE.md',
        'docs/NATIVE-FIRST-10-COVERAGE.md', 'docs/MIGRATION-Hi-NEXT.md',
    }
    for rel in forbidden:
        if (ROOT / rel).exists():
            err(f'non-product/legacy file present: {rel}')

    required_docs = {
        'README.md', 'ARCHITECTURE.md', 'INSTALLATION.md', 'CONFIGURATION.md',
        'SKILLS.md', 'HOSTS.md', 'HUMAN-DECISIONS.md', 'RELEASE.md',
        'VERIFICATION.md', 'SECURITY-MODEL.md',
        'locales/tr/README.md', 'locales/tr/CONFIGURATION.md',
    }
    actual_docs = {p.relative_to(ROOT / 'docs').as_posix() for p in (ROOT / 'docs').rglob('*.md')}
    if actual_docs != required_docs:
        err(f'docs set mismatch: {sorted(actual_docs)}')

    for rel in (
        '.github/CONTRIBUTING.md', '.github/SECURITY.md', '.github/SUPPORT.md',
        '.github/pull_request_template.md', '.github/ISSUE_TEMPLATE/bug_report.yml',
        '.github/ISSUE_TEMPLATE/feature_request.yml',
    ):
        if not (ROOT / rel).is_file():
            err(f'community health file missing: {rel}')

    for opencode_dir in ROOT.rglob('.opencode'):
        parts = opencode_dir.relative_to(ROOT).parts
        if '.agent-work' in parts:
            continue
        if opencode_dir.is_dir() and opencode_dir.parent != ROOT:
            err(f'nested project-local runtime directory present in product source: {opencode_dir.relative_to(ROOT).as_posix()}')


def validate_documentation_and_product_truth(version: str) -> None:
    product_truth = load_json('data/validation/product-truth-inventory.json')
    if product_truth.get('schema') != 1 or product_truth.get('kind') != 'PRODUCT_TRUTH_TRACE_INVENTORY' or product_truth.get('status') != 'PASS':
        err('product truth inventory invalid')
    if product_truth.get('release') != version or (product_truth.get('violations') or {}).get('missing_paths') != []:
        err('product truth inventory drift')
    areas = product_truth.get('areas') or []
    area_ids = [row.get('area') for row in areas if isinstance(row, dict)]
    if len(area_ids) != 24 or len(area_ids) != len(set(area_ids)):
        err('product truth inventory area coverage/uniqueness drift')
    for row in areas:
        if not isinstance(row, dict):
            err('product truth inventory row must be object')
            continue
        for key in ('owner_path', 'canonical_doc'):
            rel = row.get(key)
            if not isinstance(rel, str) or not (ROOT / rel).exists():
                err(f"product truth {row.get('area')} missing {key}: {rel}")
        for key in ('producer_or_contract_paths', 'consumer_or_executor_paths', 'proof_paths'):
            for rel in row.get(key, []):
                if isinstance(rel, str) and '/' in rel and not (ROOT / rel).exists():
                    err(f"product truth {row.get('area')} missing {key}: {rel}")

    policy = load_json('data/documentation-ownership.json')
    inventory = load_json('data/validation/documentation-inventory.json')
    parity = load_json('data/validation/documentation-parity.json')
    if policy.get('schema') != 1 or policy.get('type') != 'hi-documentation-ownership':
        err('documentation ownership policy header invalid')
    if inventory.get('schema') != 1 or inventory.get('kind') != 'DOCUMENTATION_TRUTH_INVENTORY' or inventory.get('status') != 'PASS':
        err('documentation inventory invalid')
    if parity.get('schema') != 1 or parity.get('kind') != 'DOCUMENTATION_PARITY' or parity.get('status') != 'PASS' or parity.get('violations') != []:
        err('documentation parity invalid')
    if inventory.get('release') != version or parity.get('release') != version:
        err('documentation validation version drift')

    meta = inventory.get('policy') or {}
    rel = meta.get('path')
    if rel != 'data/documentation-ownership.json' or not (ROOT / rel).is_file() or sha(rel) != meta.get('sha256'):
        err('documentation ownership policy hash drift')
    violations = inventory.get('violations') or {}
    if any(violations.get(key) != [] for key in ('missing', 'duplicate_area', 'budget_or_tracking')):
        err('documentation inventory reports violations')

    public = policy.get('public_documents') or []
    machine = policy.get('machine_owners') or []
    owners = public + machine
    owner_areas = [row.get('area') for row in owners if isinstance(row, dict)]
    if not owner_areas or len(owner_areas) != len(set(owner_areas)):
        err('documentation area ownership duplicate/empty')
    for row in owners:
        rel = row.get('path') if isinstance(row, dict) else None
        if not isinstance(rel, str) or not (ROOT / rel).is_file():
            err(f'documentation owner missing: {rel}')
    summary = inventory.get('summary') or {}
    doc_policy = policy.get('policy') or {}
    if summary.get('docs_markdown', 10**9) > doc_policy.get('public_docs_budget', 0):
        err('documentation public budget exceeded')
    if summary.get('root_markdown', 10**9) > doc_policy.get('root_markdown_budget', 0):
        err('documentation root markdown budget exceeded')

    for name, meta in (parity.get('inputs') or {}).items():
        rel = meta.get('path') if isinstance(meta, dict) else None
        expected = meta.get('sha256') if isinstance(meta, dict) else None
        if not isinstance(rel, str) or not (ROOT / rel).is_file():
            err(f'documentation parity input missing: {name}')
        elif sha(rel) != expected:
            err(f'documentation parity input hash drift: {name}')


def validate_config_roles_permissions_methodologies() -> None:
    config_catalog = load_json('data/hi-config-options.json')
    if config_catalog.get('schema') != 1 or config_catalog.get('type') != 'hi-config-option-catalog':
        err('Hi config option catalog header invalid')
    options = config_catalog.get('options') or []
    ids: list[str] = []
    paths: list[str] = []
    for item in options:
        if not isinstance(item, dict):
            err('Hi config option entry must be object')
            continue
        oid = item.get('id')
        path = item.get('path')
        classification = item.get('classification')
        ids.append(oid)
        paths.append(path)
        if item.get('owner') != 'hi-config':
            err(f'{oid}: config option owner invalid')
        if classification not in CONFIG_CLASSES:
            err(f'{oid}: unknown config classification {classification}')
            continue
        if classification == 'runtime':
            if not item.get('runtime_consumer') or not item.get('executor_effect'):
                err(f'{oid}: runtime config missing executable consumer/effect')
        else:
            if item.get('runtime_consumer') or item.get('executor_effect'):
                err(f'{oid}: non-runtime config falsely claims executable effect')
            if not item.get('diagnostic_consumer') or not item.get('diagnostic_effect'):
                err(f'{oid}: diagnostic/schema config missing diagnostic consumer/effect')
        for ref in item.get('behavioral_acceptance_refs', []):
            if not (ROOT / 'plugin/test' / ref).is_file():
                err(f'{oid}: missing config acceptance {ref}')
    if len(ids) != len(set(ids)) or len(paths) != len(set(paths)):
        err('duplicate Hi config option id/path')

    roles = load_json('data/hi-roles.json')
    if roles.get('schema') != 2 or roles.get('type') != 'hi-role-contract-catalog':
        err('Hi role contract catalog header invalid')
    role_entries = roles.get('roles') or []
    role_ids = {item.get('id') for item in role_entries if isinstance(item, dict)}
    if role_ids != CANONICAL_ROLES or len(role_entries) != len(CANONICAL_ROLES):
        err(f'Hi role contract inventory drift: expected={sorted(CANONICAL_ROLES)} observed={sorted(role_ids)}')

    permission_catalog = load_json('data/hi-permission-profiles.json')
    if permission_catalog.get('schema') != 1 or permission_catalog.get('type') != 'hi-permission-profile-catalog':
        err('Hi permission profile catalog header invalid')
    permission_entries = permission_catalog.get('profiles') or []
    permission_ids = [item.get('id') for item in permission_entries if isinstance(item, dict)]
    if len(permission_ids) != len(set(permission_ids)):
        err('duplicate Hi permission profile IDs')
    permission_by_id = {item.get('id'): item for item in permission_entries if isinstance(item, dict)}

    for item in role_entries:
        if not isinstance(item, dict):
            err('Hi role contract row must be object')
            continue
        rid = item.get('id')
        expected_class = 'primary' if rid in PRIMARY_ROLES else 'child'
        if item.get('role_class') != expected_class:
            err(f'{rid}: invalid role_class')
        if not isinstance(item.get('read_only'), bool) or not isinstance(item.get('reviewer'), bool):
            err(f'{rid}: role flags must be boolean')
        if item.get('read_only') and item.get('repository_write_authority') != 'none':
            err(f'{rid}: read-only role has write authority')
        obligations = item.get('obligation_authority') or []
        if not isinstance(obligations, list) or any(value not in OBLIGATION_TYPES for value in obligations):
            err(f'{rid}: invalid obligation authority')
        if item.get('reviewer') and 'review' not in obligations:
            err(f'{rid}: reviewer lacks review obligation authority')
        delegation = item.get('delegation') or {}
        refs = delegation.get('allowed_role_refs') or [] if isinstance(delegation, dict) else []
        if any(ref not in CANONICAL_ROLES for ref in refs):
            err(f'{rid}: delegation references unknown role')
        pref = item.get('permission_profile_ref')
        if pref not in permission_by_id:
            err(f'{rid}: unknown permission_profile_ref {pref}')
            continue
        if item.get('read_only'):
            rules = permission_by_id[pref].get('rules') or []
            edit = [r for r in rules if isinstance(r, dict) and r.get('capability') == 'edit' and 'pattern' not in r]
            if len(edit) != 1 or edit[0].get('action') != 'deny':
                err(f'{rid}: read-only permission profile must explicitly deny edit')

    role_files = {p.stem for p in (ROOT / 'roles').glob('*.md')}
    if role_files != CANONICAL_ROLES:
        err(f'role Markdown inventory drift: {sorted(role_files)}')

    methodologies = load_json('data/hi-methodologies.json')
    profiles = methodologies.get('profiles') or []
    profile_names = [item.get('name') for item in profiles if isinstance(item, dict)]
    skill_names = [p.parent.name for p in (ROOT / 'skills').glob('*/SKILL.md')]
    if len(profile_names) != len(set(profile_names)):
        err('duplicate Hi methodology names')
    if sorted(profile_names) != sorted(skill_names):
        err('Hi methodology catalog != packaged skill inventory')
    policy = methodologies.get('policy') or {}
    if policy.get('activation_owner') != 'Hi methodology activation':
        err('Hi methodology activation owner mismatch')
    if policy.get('selection_scope') != 'mission-task-or-obligation':
        err('Hi methodology selection scope mismatch')
    signal_catalog = methodologies.get('signal_catalog') or {}
    exit_catalog = methodologies.get('exit_requirement_catalog') or {}
    if not signal_catalog or not exit_catalog:
        err('Hi methodology signal/exit catalogs missing')
    for item in profiles:
        if not isinstance(item, dict):
            continue
        name = item.get('name')
        preferred = item.get('role_affinity') or []
        compatible = item.get('compatible_roles') or []
        signals = item.get('activation_signals') or []
        exits = item.get('exit_requirements') or []
        if not preferred or not compatible:
            err(f'{name}: methodology roles missing')
        if any(role not in compatible for role in preferred):
            err(f'{name}: preferred role not compatible')
        if any(role not in CANONICAL_ROLES for role in compatible):
            err(f'{name}: compatible role reference unknown')
        if not signals or any(signal not in signal_catalog for signal in signals):
            err(f'{name}: invalid methodology activation signals')
        if not exits or any(value not in exit_catalog for value in exits):
            err(f'{name}: invalid methodology exit requirements')
        if 'trigger_sources' in item:
            err(f'{name}: trigger_sources is duplicate derived truth')


def validate_generated_contract_presence() -> None:
    required = [
        'plugin/src/generated/config-policy.ts',
        'plugin/src/generated/permission-policy.ts',
        'plugin/src/generated/role-policy.ts',
        'plugin/src/generated/agent-config.ts',
        'plugin/src/generated/methodology-policy.ts',
        'plugin/dist/plugin.js',
        'data/validation/projection-receipts.json',
    ]
    for rel in required:
        if not (ROOT / rel).is_file():
            err(f'generated/runtime contract missing: {rel}')


def main() -> int:
    version = validate_identity_and_packages()
    validate_repository_hygiene(version)
    validate_documentation_and_product_truth(version)
    validate_config_roles_permissions_methodologies()
    validate_generated_contract_presence()

    if ERR:
        print('VALIDATION FAIL')
        for message in ERR:
            print(f'- {message}')
        return 1
    print('VALIDATION PASS')
    print(f'roles={len(CANONICAL_ROLES)} child_roles={len(CHILD_ROLES)} config_options={len(load_json("data/hi-config-options.json").get("options") or [])} methodologies={len(load_json("data/hi-methodologies.json").get("profiles") or [])}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
