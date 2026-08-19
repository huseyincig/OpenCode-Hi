# OpenCode-Hi Configuration Guide

This guide is the complete user-facing reference for configuring OpenCode-Hi after the plugin is installed. It covers Windows, Linux, and macOS; default behavior; execution/topology policy; model and fallback routing; role/category variants; provider/model restrictions; concurrency; CLI configuration; manual JSON; verification; and troubleshooting.

The canonical project-owned configuration file is:

```text
<project>/.opencode/hi/policy/routing.json
```

OpenCode plugin registration and Hi runtime configuration are different concerns:

- `opencode.json` / OpenCode local-plugin loading decides **whether Hi is loaded**.
- `.opencode/hi/policy/routing.json` decides **how Hi behaves in this project**.

The mechanical option inventory is `data/hi-config-options.json`. The generated appendix at the end of this document is derived from that inventory.

## 0. Install/load Hi first

If Hi is already visible in OpenCode, continue to [Platform paths](#1-platform-paths). Installation and configuration are separate: installation makes the plugin load; `routing.json` controls Hi behavior after it loads.

### npm/OpenCode package registration

The simplest OpenCode registration for the published release is:

```json
{
  "plugin": [
    "opencode-hi@0.2.0"
  ]
}
```

Put that entry in the project's OpenCode configuration without deleting unrelated plugins/settings. Restart OpenCode and verify that Hi tools are visible.

If you also want the package-provided `opencode-hi-setup` CLI in the project, install the npm package as a development dependency:

#### Windows PowerShell

```powershell
Set-Location C:\Projects\MyApp
npm install --save-dev opencode-hi@0.2.0
.\node_modules\.bin\opencode-hi-setup.cmd doctor C:\Projects\MyApp
```

#### Linux / macOS

```bash
cd /path/to/MyApp
npm install --save-dev opencode-hi@0.2.0
./node_modules/.bin/opencode-hi-setup doctor "$PWD"
```

### Git source without the npm registry — recommended

Windows, Linux and macOS use the same OpenCode package spec. Add it to the existing `plugin` array in `opencode.json` / `opencode.jsonc`:

```json
{
  "plugin": [
    "opencode-hi@git+https://github.com/huseyincig/OpenCode-Hi.git"
  ]
}
```

Restart OpenCode. **Do not create a wrapper and do not run Bun/npm for this install path.** OpenCode owns Git package materialization and plugin loading. The Hi package root avoids npm/Pacote Git-preparation lifecycle triggers; its OpenCode plugin peer is optional so the host's large type/runtime dependency graph is not redundantly installed.

The immutable `v0.2.0` tag is older than this direct-Git packaging fix. Keep that release immutable; the unpinned Git source spec above follows current repository source until a later release explicitly contains the correction. See [Installation and Lifecycle](INSTALLATION.md) and [Host Support](HOSTS.md) for evidence boundaries.

## 1. Platform paths

Assume the project is named `MyApp`.

| Platform | Example project | Hi project config |
|---|---|---|
| Windows | `C:\Projects\MyApp` | `C:\Projects\MyApp\.opencode\hi\policy\routing.json` |
| Linux | `/home/alice/projects/MyApp` | `/home/alice/projects/MyApp/.opencode/hi/policy/routing.json` |
| macOS | `/Users/alice/Projects/MyApp` | `/Users/alice/Projects/MyApp/.opencode/hi/policy/routing.json` |

### Windows PowerShell

```powershell
$Project = "C:\Projects\MyApp"
New-Item -ItemType Directory -Force "$Project\.opencode\hi\policy" | Out-Null
notepad "$Project\.opencode\hi\policy\routing.json"
```

### Linux / macOS shell

```bash
PROJECT=/path/to/MyApp
mkdir -p "$PROJECT/.opencode/hi/policy"
${EDITOR:-vi} "$PROJECT/.opencode/hi/policy/routing.json"
```

Restart OpenCode after changing project routing configuration when the host does not hot-reload it.

## 2. Do I need to configure anything?

No. Hi has built-in defaults and can operate without a hand-written file. When the project routing file is missing, Hi may create a schema-1 `hi-routing` file containing inventory-aware recommended role models. Those recommendations are **preferences**, not vendor locks: unavailable recommended models are filtered by runtime inventory/policy and normal routing can continue with eligible models.

Core built-in defaults are:

```json
{
  "executionPolicy": "adaptive",
  "primaryMode": "auto",
  "execution": {
    "topology": "adaptive",
    "maxAgents": 4,
    "parallelism": 2
  },
  "models": {
    "mode": "adaptive",
    "default": "auto",
    "roles": {}
  },
  "routing": {
    "strategy": "cost-quality",
    "categoryModels": {},
    "categoryVariants": {},
    "roleModels": {},
    "roleVariants": {},
    "maxFallbacks": 3,
    "allowedProviders": [],
    "deniedModels": []
  },
  "parallel": {
    "enabled": true,
    "max": 3,
    "providers": {},
    "models": {}
  },
  "profile": {
    "minimal": { "specialistThreshold": "high", "reviewThreshold": "low" },
    "balanced": { "specialistThreshold": "medium", "reviewThreshold": "medium" },
    "thorough": { "specialistThreshold": "low", "reviewThreshold": "high" }
  }
}
```

The project file itself uses this envelope:

```json
{
  "schema": 1,
  "type": "hi-routing"
}
```

Only fields recognized by the current project-routing loader affect runtime behavior.


## 2.1 Project fields vs host-only fields

The 29-option canonical `HiConfig` inventory contains both host-supplied and project-supplied surfaces. On the accepted OpenCode `1.18.x` project path, put user project settings in `.opencode/hi/policy/routing.json`; do **not** assume arbitrary top-level `hi` keys in `opencode.json` survive OpenCode schema normalization.

Project `routing.json` recognizes:

- `executionPolicy`, `primaryMode`;
- `execution.*`;
- `models.*`;
- `routing.*`;
- `parallel.*`;
- `profile.*`.

The canonical `schemaVersion` and `compatibility.*` entries are host-Hi/config-diagnostic surfaces and are not read from project `routing.json` by the current project-routing loader. The project file has its own envelope: `schema: 1`, `type: "hi-routing"`.

## 3. Recommended starter configuration

This keeps Hi adaptive while giving explicit, bounded project limits:

```json
{
  "schema": 1,
  "type": "hi-routing",
  "executionPolicy": "adaptive",
  "primaryMode": "auto",
  "execution": {
    "topology": "adaptive",
    "maxAgents": 4,
    "parallelism": 2
  },
  "routing": {
    "strategy": "cost-quality",
    "maxFallbacks": 3
  },
  "parallel": {
    "enabled": true,
    "max": 3
  }
}
```

## 4. Execution policy

`executionPolicy` accepts:

| Value | Behavior |
|---|---|
| `minimal` | Always uses the minimal execution profile. Specialist threshold is high; review threshold is low. |
| `balanced` | Always uses the balanced profile. |
| `thorough` | Always uses the thorough profile. Specialist/review routing becomes more conservative. |
| `adaptive` | Default. Chooses minimal for low-risk local/unambiguous work, thorough for high/authority-boundary risk, otherwise balanced. Automatic continuation and adaptive idle evaluation are enabled. |
| `manual` | Uses balanced profile thresholds but disables automatic continuation; user/control-plane continuation is required. |

Example:

```json
{
  "schema": 1,
  "type": "hi-routing",
  "executionPolicy": "thorough"
}
```

## 5. Primary manager mode

`primaryMode` accepts:

| Value | Meaning |
|---|---|
| `auto` | Default. Low-risk local work normally uses `working-manager`; Hi still delegates when semantics require specialists or independent review. |
| `working-manager` | Forces the write-capable primary role. It can directly complete scoped work and delegate when material. |
| `manager` | Forces the read-only coordinating primary. Implementation is delegated rather than performed directly by the primary. |

```json
{
  "schema": 1,
  "type": "hi-routing",
  "primaryMode": "manager"
}
```

`manager` and `working-manager` are **primary roles**. They are not interchangeable with child workers such as `coder` or `qa-reviewer`.

## 6. Canonical roles

| Role | Class | Primary purpose | Write behavior |
|---|---|---|---|
| `working-manager` | primary | Direct small/medium work and bounded coordination | scoped write |
| `manager` | primary | Read-only coordination | no repository write |
| `coder` | child | Implementation/correction | scoped write |
| `architect` | child | Architecture/contracts/data-model design | read-only |
| `repository-explorer` | child | Bounded repository discovery | read-only |
| `qa-reviewer` | child reviewer | Regression/acceptance review | read-only |
| `security-reviewer` | child reviewer | Security/trust/authority review | read-only |
| `visual-qa` | child reviewer | Browser/visual/accessibility verification | read-only |

Primary role selection uses `primaryMode`. Model maps are narrower: current Hi role-model configuration accepts only the six model-routed child role IDs listed below; primary or unknown role-model keys are ignored by the effective config loader.

### Primary-role model ownership

Current project model routing is applied by `TaskRuntime` when Hi dispatches **child workers**. The active child role IDs are `coder`, `architect`, `repository-explorer`, `qa-reviewer`, `security-reviewer`, and `visual-qa`.

`manager` and `working-manager` are primary OpenCode agents. Their current session model is selected/owned by the OpenCode host/session-agent layer, not by Hi's child `resolveModel()` path. They are therefore **not valid Hi role-model targets**: project `models.roles`, `routing.roleModels`, and `routing.roleVariants` admit child roles only. The setup CLI rejects primary-role model assignments explicitly.

OpenCode's supported project/global default-model control is the root `model` field in `opencode.json`/`opencode.jsonc`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "provider/model-x"
}
```

See the official OpenCode model guide: <https://opencode.ai/docs/models/>. OpenCode also supports model properties on user-defined agent configurations, but **do not redeclare canonical Hi agent IDs** such as `manager` or `working-manager` just to set a model: Hi protects its injected role contracts and rejects incompatible same-name agent definitions as collisions. See <https://opencode.ai/docs/agents/> for the host's generic agent model mechanism.

Auto-init writes recommendations for the six child roles only. `opencode-hi-setup role-models --set manager=...` or `working-manager=...` is blocked with an action telling you to choose the primary model in OpenCode instead.

## 7. Model-routing controls: which mechanism should I use?

There are two different model-selection layers. They are intentionally not the same.

Supported Hi role-model targets are exactly:

```text
coder
architect
repository-explorer
qa-reviewer
security-reviewer
visual-qa
```

`manager` and `working-manager` remain valid values of `primaryMode`, but they are not valid model-map targets.

### 7.1 `models.mode`: project-level child-model preference

`models.mode` accepts `adaptive`, `fixed`, or `role-mapped`.

- `adaptive`: normal Hi routing/scoring.
- `fixed`: `models.default` becomes the preferred model for Hi-dispatched child tasks.
- `role-mapped`: `models.roles[role]` becomes the preferred model for a supported child role.

These are **child-routing preferences/overrides**, not model allowlists. If the preferred model is unavailable or rejected by policy, routing may continue with another eligible model.

### 7.2 `routing.roleModels`: ordered role candidates and fallback priors

`routing.roleModels` accepts an ordered array for each supported child role. It is an ordered **routing prior**, not an unconditional hard order. When all configured role candidates are live/policy-allowed and bounded feedback is still sparse, the recommended fast path preserves the configured order. If candidates are unavailable/rejected or enough admitted feedback exists, eligible configured candidates can be reranked by the normal routing logic. Fallback output is still bounded by `routing.maxFallbacks`.

Example:

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "roleModels": {
      "coder": [
        "provider-a/coder-primary",
        "provider-b/coder-fallback-1",
        "provider-c/coder-fallback-2"
      ]
    },
    "maxFallbacks": 2
  }
}
```

Use `models.roles` when you want **one preferred model per child role**. Use `routing.roleModels` when you want **an ordered child-role candidate/fallback list**.

## 8. Recipe: prefer one model for all Hi-dispatched child tasks

Use fixed mode for Hi-dispatched child TaskRuntime work:

```json
{
  "schema": 1,
  "type": "hi-routing",
  "models": {
    "mode": "fixed",
    "default": "provider/model-x"
  }
}
```

Important: this means **prefer `provider/model-x` for Hi-dispatched child tasks**, not “force the OpenCode primary session to this model” and not “forbid every other model”. If it is unavailable or policy-rejected, Hi can choose another eligible model.

If you want no fallback entries to be returned after a selected primary, also set:

```json
"routing": { "maxFallbacks": 0 }
```

That still does **not** turn `models.default` into a hard allowlist. Current Hi has provider allowlisting and exact model denylisting, but no general `allowedModels` whitelist. Do not rely on `fixed` as a strict single-model security boundary.

### Use the same model for the primary session and every Hi child

This requires configuring both ownership layers with the same model ID.

In `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-hi@0.2.0"],
  "model": "provider/model-x"
}
```

In `.opencode/hi/policy/routing.json`:

```json
{
  "schema": 1,
  "type": "hi-routing",
  "models": {
    "mode": "fixed",
    "default": "provider/model-x"
  },
  "routing": {
    "maxFallbacks": 0
  }
}
```

The OpenCode `model` field controls the primary session/default host model; the Hi `models.fixed` setting controls Hi-dispatched child tasks. `maxFallbacks: 0` removes returned fallback entries after the selected child primary, but it does not create a hard model whitelist. If strict provider confinement is required, combine this with `routing.allowedProviders` and normal OpenCode provider policy.

## 9. Recipe: one different preferred model per child role

This section applies only to the six Hi child workers. `manager` and `working-manager` are intentionally absent; their primary session model remains an OpenCode concern.

```json
{
  "schema": 1,
  "type": "hi-routing",
  "models": {
    "mode": "role-mapped",
    "roles": {
      "coder": "provider/model-code",
      "architect": "provider/model-reasoning",
      "repository-explorer": "provider/model-fast",
      "qa-reviewer": "provider/model-review",
      "security-reviewer": "provider/model-security",
      "visual-qa": "provider/model-vision"
    }
  }
}
```

A missing role entry falls back to normal routing for that role.

## 10. Recipe: multiple models per role with ordered fallback

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "roleModels": {
      "coder": ["provider-a/code", "provider-b/code", "provider-c/code"],
      "architect": ["provider-a/reason", "provider-b/reason"],
      "repository-explorer": ["provider-a/fast", "provider-b/fast"],
      "qa-reviewer": ["provider-a/review", "provider-b/review"],
      "security-reviewer": ["provider-a/security", "provider-b/security"],
      "visual-qa": ["provider-a/vision", "provider-b/vision"]
    },
    "maxFallbacks": 2
  }
}
```

Each model list is deduplicated and bounded by the current loader. `maxFallbacks` is bounded to `0..6`.

## 11. Recipe: same primary model, role-specific fallback models

If all Hi-dispatched child roles should start with the same model but have different fallbacks, repeat the same primary at index 0:

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "roleModels": {
      "coder": ["provider/common", "provider/code-specialist"],
      "architect": ["provider/common", "provider/reasoning-specialist"],
      "qa-reviewer": ["provider/common", "provider/review-specialist"],
      "security-reviewer": ["provider/common", "provider/security-specialist"],
      "visual-qa": ["provider/common", "provider/vision-specialist"]
    },
    "maxFallbacks": 1
  }
}
```

## 12. Task categories

Hi routes tasks into five canonical model categories:

| Category | Typical intent | Built-in variant preference |
|---|---|---|
| `quick` | fast/cheap local work | `low`, `minimal`, `none` |
| `standard` | balanced general work | `medium`, `low`, `none` |
| `deep` | reasoning/coding-heavy work | `high`, `xhigh`, `medium` |
| `visual` | visual/browser work | `high`, `medium`, `xhigh` |
| `critical` | high-assurance/critical work | `xhigh`, `max`, `high` |

Category routing is separate from role routing. Role candidates are considered before category candidates.

## 13. Category-specific model routing

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "categoryModels": {
      "quick": ["provider/fast"],
      "standard": ["provider/balanced"],
      "deep": ["provider/reasoning", "provider/code"],
      "visual": ["provider/vision"],
      "critical": ["provider/high-assurance"]
    }
  }
}
```

Unknown category keys are ignored by the canonical config resolver.

## 14. Variants

A model variant is selected only if that variant exists in the runtime model inventory.

Variant preference order is:

1. exact `routing.roleVariants[role][model]`;
2. `routing.categoryVariants[category]` in listed order;
3. built-in category preference;
4. the model's first available variant.

### Role-specific variant

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "roleModels": {
      "coder": ["provider/model-x"]
    },
    "roleVariants": {
      "coder": {
        "provider/model-x": "high"
      }
    }
  }
}
```

### Category-specific variants

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "categoryVariants": {
      "quick": ["low", "minimal"],
      "deep": ["high", "xhigh"],
      "critical": ["xhigh", "max"]
    }
  }
}
```

Variant names are provider/model-specific. Unsupported names are skipped rather than manufactured.

## 15. Routing strategy

`routing.strategy` controls scoring among eligible models:

- `cost-quality` — default; balances quality against heuristic expected completion cost.
- `quality` — biases more strongly toward quality.
- `cost` — biases more strongly toward expected completion cost.

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": { "strategy": "quality" }
}
```

The cost signal used by routing is a Hi/OpenCode-derived heuristic for selection. It is not a claim of provider-billed cost.

## 16. Provider and model restrictions

### Allow only selected providers

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "allowedProviders": ["provider-a", "provider-b"]
  }
}
```

When non-empty, `allowedProviders` also disables unconstrained `host-default` fallback. A model from another provider is rejected even if runtime-visible.

### Deny exact models

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "deniedModels": [
      "provider-a/model-old",
      "provider-b/model-expensive"
    ]
  }
}
```

`host-default` can also be denied explicitly by including the literal `"host-default"`.

### Composition with host policy

Hi never uses project configuration to widen a host denial:

- host + project `allowedProviders` compose by **intersection** when both are present;
- host + project `deniedModels` compose by **union**;
- native OpenCode provider allow/deny policy is still enforced;
- runtime models marked non-write-capable are excluded from write-capable model routing.

## 17. Topology and concurrency: three different limits

Do not confuse these controls:

### `execution.maxAgents`

Maximum agents in the selected mission topology. Range `1..8`.

### `execution.parallelism`

Maximum parallel streams allowed by the mission topology. Range `1..8`.

### `parallel.max`

Global scheduler capacity for concurrently acquired workers. Range `1..8`. If `parallel.enabled` is `false`, effective global scheduler capacity becomes `1` regardless of `parallel.max`.

Example:

```json
{
  "schema": 1,
  "type": "hi-routing",
  "execution": {
    "topology": "adaptive",
    "maxAgents": 4,
    "parallelism": 2
  },
  "parallel": {
    "enabled": true,
    "max": 3
  }
}
```

Actual concurrency can be lower than any configured maximum because dependency, authority, verification, isolation, provider, or model limits may serialize work.

## 18. Force single-agent or multi-agent topology

```json
{
  "schema": 1,
  "type": "hi-routing",
  "execution": {
    "topology": "single-agent",
    "maxAgents": 1,
    "parallelism": 1
  }
}
```

or:

```json
{
  "schema": 1,
  "type": "hi-routing",
  "execution": {
    "topology": "multi-agent",
    "maxAgents": 4,
    "parallelism": 2
  }
}
```

Topology settings do not bypass authority, permission, dependency, or independent-review requirements.

## 19. Provider-specific and model-specific concurrency

Each positive limit is capped at `32` by the runtime resolver.

```json
{
  "schema": 1,
  "type": "hi-routing",
  "parallel": {
    "enabled": true,
    "max": 4,
    "providers": {
      "provider-a": 2,
      "provider-b": 1
    },
    "models": {
      "provider-a/model-large": 1,
      "provider-a/model-fast": 2
    }
  }
}
```

The scheduler must satisfy global, provider, and model ceilings simultaneously.

## 20. Profiles and specialist/reviewer thresholds

Profiles control how readily capability routing introduces specialists or reviewers.

Allowed thresholds: `low`, `medium`, `high`.

```json
{
  "schema": 1,
  "type": "hi-routing",
  "profile": {
    "minimal": {
      "specialistThreshold": "high",
      "reviewThreshold": "low"
    },
    "balanced": {
      "specialistThreshold": "medium",
      "reviewThreshold": "medium"
    },
    "thorough": {
      "specialistThreshold": "low",
      "reviewThreshold": "high"
    }
  }
}
```

Use the defaults unless you have a concrete reason to change dispatch sensitivity. These are routing thresholds, not permission or authority grants.

## 21. Complete practical configuration example

```json
{
  "schema": 1,
  "type": "hi-routing",
  "executionPolicy": "adaptive",
  "primaryMode": "auto",
  "execution": {
    "topology": "adaptive",
    "maxAgents": 4,
    "parallelism": 2
  },
  "models": {
    "mode": "adaptive",
    "default": "auto",
    "roles": {}
  },
  "routing": {
    "strategy": "cost-quality",
    "roleModels": {
      "coder": ["provider-a/code", "provider-b/code"],
      "architect": ["provider-a/reasoning", "provider-b/reasoning"],
      "qa-reviewer": ["provider-a/review"],
      "security-reviewer": ["provider-a/security"],
      "visual-qa": ["provider-a/vision"]
    },
    "roleVariants": {
      "coder": {
        "provider-a/code": "high"
      }
    },
    "categoryModels": {
      "quick": ["provider-a/fast"],
      "critical": ["provider-a/high-assurance"]
    },
    "categoryVariants": {
      "quick": ["low"],
      "critical": ["xhigh", "high"]
    },
    "maxFallbacks": 2,
    "allowedProviders": ["provider-a", "provider-b"],
    "deniedModels": []
  },
  "parallel": {
    "enabled": true,
    "max": 3,
    "providers": {
      "provider-a": 2
    },
    "models": {
      "provider-a/high-assurance": 1
    }
  },
  "profile": {
    "minimal": { "specialistThreshold": "high", "reviewThreshold": "low" },
    "balanced": { "specialistThreshold": "medium", "reviewThreshold": "medium" },
    "thorough": { "specialistThreshold": "low", "reviewThreshold": "high" }
  }
}
```

## 22. Configuration precedence

Effective configuration is resolved per field, not by replacing the whole configuration object.

General runtime precedence is:

```text
built-in default
  < host Hi configuration
  < project .opencode/hi/policy/routing.json
```

Important exceptions/composition rules:

- `routing.allowedProviders`: project narrows host policy; if both are non-empty, effective value is their intersection.
- `routing.deniedModels`: host and project values are unioned.
- `routing.roleModels`, `roleVariants`, `categoryModels`, `categoryVariants`, `models.roles`, `parallel.providers`, and `parallel.models`: project keys override matching host keys while unrelated host keys remain.
- invalid enum/string/number values do not become new behavior; recognized canonical fields fall back/are bounded according to the resolver.
- unknown project fields do not become supported configuration merely because JSON accepts them.

Project configuration can narrow behavior but cannot override OpenCode permission/authority/provider denials.

## 23. CLI configuration from an npm installation

If installed from npm into the project:

### Windows PowerShell

```powershell
$Project = "C:\Projects\MyApp"
.\node_modules\.bin\opencode-hi-setup.cmd reconfigure $Project --execution-policy adaptive --primary-mode auto --routing-strategy cost-quality --parallel enabled --parallel-max 3
```

### Linux / macOS

```bash
PROJECT=/path/to/MyApp
./node_modules/.bin/opencode-hi-setup reconfigure "$PROJECT" \
  --execution-policy adaptive \
  --primary-mode auto \
  --routing-strategy cost-quality \
  --parallel enabled \
  --parallel-max 3
```

Useful `reconfigure` flags:

```text
--execution-policy minimal|balanced|thorough|adaptive|manual
--primary-mode auto|working-manager|manager
--routing-strategy cost-quality|quality|cost
--allow-provider PROVIDER          (repeatable)
--deny-model PROVIDER/MODEL        (repeatable)
--max-fallbacks 0..6
--parallel enabled|disabled
--parallel-max 1..8
--provider-limit PROVIDER=1..32    (repeatable)
--model-limit PROVIDER/MODEL=1..32 (repeatable)
--profile-target minimal|balanced|thorough
--specialist-threshold low|medium|high
--review-threshold low|medium|high
--print
```

`reconfigure` changes only explicitly supplied supported fields and preserves unrelated project/OpenCode configuration.

Current CLI help may also expose legacy `--team-mode`, `--team-max-members`, and `--team-wall-minutes` arguments. Generic TeamMode is **not** part of the current canonical `HiConfig` or project-routing loader, so those legacy fields are not documented as supported runtime configuration and should not be used to infer active team semantics. Current topology/concurrency controls are `execution.*` and `parallel.*`.

## 24. Role-model CLI

Inspect the current role mappings:

### Windows PowerShell

```powershell
.\node_modules\.bin\opencode-hi-setup.cmd role-models C:\Projects\MyApp --print
```

### Linux / macOS

```bash
./node_modules/.bin/opencode-hi-setup role-models /path/to/MyApp --print
```

List models visible to the helper:

```bash
./node_modules/.bin/opencode-hi-setup role-models /path/to/MyApp --list-available
```

Set one or multiple candidates for roles:

```bash
./node_modules/.bin/opencode-hi-setup role-models /path/to/MyApp \
  --set 'coder=provider-a/code,provider-b/code' \
  --set 'architect=provider-a/reasoning,provider-b/reasoning' \
  --variant 'coder:provider-a/code=high' \
  --policy manual
```

On PowerShell use the same arguments with `.cmd` and Windows path syntax.

`--set ROLE=PRIMARY,FALLBACK1,FALLBACK2` writes `routing.roleModels`. `--variant ROLE:MODEL=VARIANT` writes `routing.roleVariants`. The CLI bounds each explicit `--set` role list and preserves routing fields it does not own.

Primary-role assignments are intentionally rejected. For example, `--set manager=provider/model` returns `BLOCKED` with reason `role-model-primary-owned-by-opencode`.

`--defaults --policy recommended` writes inventory-validated recommended role mappings. Recommended defaults are preferences; unavailable models are not forced into runtime use.

The role-model CLI accepts only `coder`, `architect`, `repository-explorer`, `qa-reviewer`, `security-reviewer`, and `visual-qa`. Attempts to assign `manager` or `working-manager` are blocked because primary model ownership belongs to OpenCode.

## 25. Manual JSON vs CLI

Use manual JSON when you need the full project routing surface, including:

- `execution.topology`, `execution.maxAgents`, `execution.parallelism`;
- `models.mode`, `models.default`, `models.roles`;
- category models/variants;
- complete profile definitions.

Use `reconfigure` for common runtime knobs and concurrency/provider limits. Use `role-models` for role candidate lists and role variants.

The CLI does not expose every canonical field, so “not present as a CLI flag” does not mean “unsupported in routing.json”.

## 26. Validate after changing configuration

1. Save `routing.json`.
2. Restart OpenCode if the host does not hot-reload project/plugin state.
3. Run Hi doctor in the active OpenCode session and inspect effective config/routing status.
4. Confirm the desired model/provider is actually runtime-visible; a model name in JSON is not proof that the provider exposes it.
5. For model routing changes, run a representative task and inspect the selected effective model/variant rather than trusting static configuration alone.

The setup CLI's static `doctor` checks registration/ownership/lifecycle state. Runtime `hi_doctor` is the stronger check for effective Hi configuration and host capability state.

## 27. Troubleshooting

### `routing.json` exists but seems ignored

Check all of the following:

- path is exactly `.opencode/hi/policy/routing.json` under the project opened by OpenCode;
- JSON parses successfully;
- `schema` is `1`;
- `type` is `"hi-routing"`;
- OpenCode was restarted when necessary;
- the field is supported by the project-routing loader.

Malformed JSON or a wrong schema/type is fail-closed: Hi does not reinterpret arbitrary data as project policy.

### A configured model is not selected

Possible reasons include:

- model is absent from runtime provider inventory;
- provider is outside `allowedProviders`;
- model is in `deniedModels`;
- native OpenCode provider policy denies/disables the provider;
- model is marked non-write-capable for a write-capable route;
- an explicit task model or stronger project model mode takes precedence;
- bounded feedback/scoring reorders candidates when the recommended fast path no longer applies.

### My first role model is unavailable

Hi records that the role primary was unavailable/policy-rejected and continues with eligible configured/scored candidates. Reduce `maxFallbacks` if you want fewer reported fallback alternatives, but remember that this is not a hard single-model whitelist.

### I set `parallel.max` to 8 but only one worker runs

Concurrency is bounded by semantics as well as capacity. Single-agent topology, dependencies, authority boundaries, provider/model limits, verification sequencing, or `parallel.enabled: false` can reduce actual concurrency.

### Provider allowlist removed host-default fallback

This is intentional. A non-empty `allowedProviders` means Hi cannot claim that an unconstrained host-default model is within the requested provider boundary.

### Unknown fields do nothing

Expected. Hi is current-schema/fail-closed: JSON extensibility is not a support claim. Use only documented canonical fields.

## 28. Security and authority boundary

Configuration changes model/topology/routing preferences and capacity. They do not grant external-action authority, widen OpenCode permissions, bypass user dirty-file ownership, or convert observations into verification evidence. Host and Hi safety/authority boundaries remain monotonic.

## 29. Canonical option appendix

The following table is generated from `data/hi-config-options.json` and is the mechanical current inventory of supported top-level/HiConfig option paths.

<!-- BEGIN GENERATED CONFIG REFERENCE -->
Generated from `data/hi-config-options.json`. Do not hand-edit this table.

| Path | Class | Default | Safety | Executable/diagnostic effect |
|---|---|---|---|---|
| `schemaVersion` | schema-marker | `2` | constraint | reports noncanonical supplied schema while runtime remains current-only |
| `executionPolicy` | runtime | `adaptive` | preference | selects minimal/balanced/thorough routing profile and automatic/adaptive continuation behavior |
| `primaryMode` | runtime | `auto` | preference | selects/forces primary agent and direct-vs-delegated minimum-team behavior |
| `compatibility.mode` | diagnostic | `compatible` | constraint | changes unsupported/unvalidated host compatibility findings from warning to failure under strict mode |
| `compatibility.validatedOpenCodeVersions` | diagnostic | `[]` | constraint | matches observed OpenCode version against the validated-version inventory |
| `execution.topology` | runtime | `adaptive` | constraint | forces/adapts single-agent versus multi-agent mission topology |
| `execution.maxAgents` | runtime | `4` | capacity | caps topology agent count; value 1 is an executable single-agent ceiling |
| `execution.parallelism` | runtime | `2` | capacity | caps parallel streams inside selected mission topology |
| `models.mode` | runtime | `adaptive` | preference | switches adaptive scoring versus fixed or role-mapped model preference |
| `models.default` | runtime | `auto` | preference | provides fixed project model when models.mode=fixed |
| `models.roles` | runtime | `{}` | preference | provides project child-role-specific model when models.mode=role-mapped; primary manager models remain OpenCode-owned |
| `routing.strategy` | runtime | `cost-quality` | preference | changes model scoring between quality, cost, and cost-quality |
| `routing.categoryModels` | runtime | `{}` | preference | prepends configured category candidates before scored models |
| `routing.categoryVariants` | runtime | `{}` | preference | changes selected native model variant by task category |
| `routing.roleModels` | runtime | `{}` | preference | prepends configured child-role candidates before category/scored models; primary manager roles are excluded |
| `routing.roleVariants` | runtime | `{}` | preference | changes selected native variant for a specific child-role/model pair; primary manager roles are excluded |
| `routing.maxFallbacks` | runtime | `3` | capacity | bounds fallback candidate count |
| `routing.allowedProviders` | runtime | `[]` | constraint | narrows eligible providers and disables unconstrained host-default fallback when nonempty |
| `routing.deniedModels` | runtime | `[]` | constraint | denies exact models and composes project/raw denies monotonically |
| `parallel.enabled` | runtime | `true` | capacity | sets global scheduler capacity to one when disabled |
| `parallel.max` | runtime | `3` | capacity | caps total concurrently acquired workers |
| `parallel.providers` | runtime | `{}` | capacity | caps concurrent workers per provider |
| `parallel.models` | runtime | `{}` | capacity | caps concurrent workers per model |
| `profile.minimal.specialistThreshold` | runtime | `high` | preference | changes specialist dispatch threshold for the selected execution profile |
| `profile.minimal.reviewThreshold` | runtime | `low` | preference | changes reviewer dispatch threshold for the selected execution profile |
| `profile.balanced.specialistThreshold` | runtime | `medium` | preference | changes specialist dispatch threshold for the selected execution profile |
| `profile.balanced.reviewThreshold` | runtime | `medium` | preference | changes reviewer dispatch threshold for the selected execution profile |
| `profile.thorough.specialistThreshold` | runtime | `low` | preference | changes specialist dispatch threshold for the selected execution profile |
| `profile.thorough.reviewThreshold` | runtime | `high` | preference | changes reviewer dispatch threshold for the selected execution profile |
<!-- END GENERATED CONFIG REFERENCE -->
