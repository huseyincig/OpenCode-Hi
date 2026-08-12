# OpenCode HHC Orchestrator (OHO)

**Sürüm: 2.0.10**

Canonical plugin spec:

`opencode-hhc-orchestrator@git+https://github.com/huseyincig/OpenCode-HHC-Orchestrator.git#2.0.10`

OHO, OpenCode için mission, agent, model, cost, task, evidence, authority ve STOP orchestration control-plane pluginidir.

HHC orchestration contract:

`WHO + WHEN + MODEL + COST + TASK + STATE + EVIDENCE + STOP`

- **OHO** ürün/plugin kimliğidir.
- **HHC** OHO içindeki orchestration mimarisidir.
- **OpenCode** session/agent/skill/permission/provider/model/tool/diff/event primitive'lerini sağlar.
- **HHC Native Skills** yalnız methodology/HOW sağlar; orchestration ownership taşımaz.

## Kurulum

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "opencode-hhc-orchestrator@git+https://github.com/huseyincig/OpenCode-HHC-Orchestrator.git#2.0.10"
  ]
}
```

OpenCode'u yeniden başlatın. Plugin config hook'u packaged HHC skill path'ini native skill discovery'ye ekler ve sekiz HHC agent tanımını effective config'e enjekte eder.

## OHO helper

```bash
python scripts/native_plugin_setup.py plan /path/to/project --ref <REF>
python scripts/native_plugin_setup.py install /path/to/project --ref <REF>
python scripts/native_plugin_setup.py doctor /path/to/project
python scripts/native_plugin_setup.py uninstall /path/to/project
python scripts/native_plugin_setup.py reconfigure /path/to/project --primary-mode manager --parallel-max 2
python scripts/native_plugin_setup.py role-models /path/to/project --print
```

Helper yalnız OHO registration/ownership alanını yönetir; diğer kullanıcı plugin ve MCP kayıtlarını korur.

## Runtime yüzeyi

- HHC Mission / Obligation / Task / Evidence state
- SMART minimum-team routing
- native child sessions
- role-specific model/provider/variant/fallback routing
- 29 packaged HHC-native methodology skill
- skill default zero; child-specific bounded loading
- evidence freshness
- event-driven continuation/autopilot
- authority boundaries
- completion adjudication / deterministic STOP
- Team Mode default kapalı

Prensip: bir worker yeterliyse bir worker; skill gerekmiyorsa 0 skill.

## Agent'lar

`working-manager`, `manager`, `coder`, `repository-explorer`, `qa-reviewer`, `architect`, `security-reviewer`, `visual-qa`.

## Native skill policy

HHC skill'leri methodology sağlar. Skill hiçbir zaman task dispatch, model seçimi, worker spawning, authority, continuation, completion veya STOP sahibi değildir. Normal worker hedefi 0–1 skill, birleşik ihtiyaçta en fazla 3 skill'dir.

Detay: `docs/SKILLS.md`.

## Geliştirme ve external validation

Local/in-process PASS, exact Git install/runtime PASS anlamına gelmez. External validation exact OpenCode sürümü, exact OHO candidate ve gerçek platform/runtime receipt'lerine bağlanır.

## Release artifacts

- `OpenCode-HHC-Orchestrator-<VERSION>-SOURCE.zip`
- `OpenCode-HHC-Orchestrator-<VERSION>-DISTRIBUTABLE.zip`

Archive metadata deterministic olarak canonicalize edilir; release manifest/SBOM provenance doğrulaması yapılır.
