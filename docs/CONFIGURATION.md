# OpenCode-Hi Configuration Guide

This guide is the complete user-facing reference for configuring OpenCode-Hi after the plugin is installed. It covers Windows, Linux, and macOS; default behavior; execution/topology policy; model and fallback routing; role/category variants; provider/model restrictions; concurrency; CLI configuration; manual JSON; verification; and troubleshooting.

The canonical project-owned configuration file is:

```text
<project>/.opencode/hi/policy/routing.json
```

OpenCode plugin registration and Hi runtime configuration are different concerns:

- `opencode.json` / OpenCode local-plugin loading decides **whether Hi is loaded**.
- `.opencode/hi/policy/routing.json` decides **how Hi behaves in this project**.

## Current development: one Settings control plane

Current `dev` presents three normal-user Work Modes: `Adaptive`, `Single`, and `Multi`. OpenCode still owns provider authentication and the primary session model. `Single` is a one-agent topology, so its effective primary behavior is `working-manager`; a persisted `manager` preference is preserved and becomes effective again after leaving Single. Child roles remain Automatic unless the user persists a strict global model allowlist or a per-role model/fallback list. `hi_settings apply` accepts `allowed_models`, and `npx opencode-hi config --model-pool MODEL[,MODEL...]` writes the same canonical project setting.

Use runtime `hi_settings show` / `hi_settings apply` for live connected-inventory-aware settings. One `apply` transaction can change mode, limits, and multiple role mappings together; the whole patch is validated before persistence. Use `npx opencode-hi config` for the same project preference model when a deterministic CLI is preferable. The CLI does not invent or validate live provider availability outside OpenCode runtime.

`hi_role_models` remains compatibility-only; new multi-setting flows should use `hi_settings`. With no explicit routing file, Adaptive + Automatic is valid and no model preference is fabricated. The first pending session can offer setup once live models exist, while material work proceeds without interruption. Each runtime settings open refreshes OpenCode inventory before presenting models.

The mechanical option inventory is `data/hi-config-options.json`. The generated appendix at the end of this document is derived from that inventory.

## 0. Install/load Hi first

If Hi is already visible in OpenCode, continue to [Platform paths](#1-platform-paths). Installation and configuration are separate: installation makes the plugin load; `routing.json` controls Hi behavior after it loads.

### npm package runner — normal user path

Windows, Linux and macOS use the same Node-based package runner. The immutable published release is `opencode-hi@0.2.3`; the current repository development candidate is `opencode-hi@0.2.4` and is not registry-published until its external release gates close. For release `0.2.2`:

```bash
npx --yes opencode-hi@0.2.2 setup /path/to/MyApp
```

On Windows PowerShell the project path can be native Windows syntax:

```powershell
npx --yes opencode-hi@0.2.2 setup C:\Projects\MyApp
```

The command preserves unrelated OpenCode settings and registers the exact package spec. It does not install a project development dependency, create application-root package metadata, or require an external Python interpreter. Restart OpenCode, then run:

```bash
npx --yes opencode-hi@0.2.2 doctor /path/to/MyApp
```

Use the in-runtime `hi_doctor` tool after the plugin loads to inspect the live effective provider/model inventory. Static package `doctor` verifies registration/ownership, not provider authentication or successful model execution.

### Git/source loading — contributor path

Direct Git/local loading remains available for source development and CI compatibility, but it is not the normal-user onboarding recommendation. Reproducible acceptance should use an exact repository SHA/spec and must verify that OpenCode actually loaded the plugin. See [Installation and Lifecycle](INSTALLATION.md) and [Host Support](HOSTS.md) for the evidence boundaries.

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

No. Hi can operate without a hand-written routing file. At runtime it filters OpenCode's effective connected inventory through provider/model policy and hard role capability requirements. If there is no explicit task model, explicit ordered role mapping, or OpenCode agent model, Hi makes an **ephemeral capability/variant recommendation**. There are no built-in provider/model IDs, the automatic result is never persisted as a user preference, and cost/quality/feedback telemetry does not silently rerank it.

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

Hi does **not** auto-write an initial role recommendation. For each Hi-routed child role, runtime selection applies host/provider/model policy and hard role-capability filters first. Precedence is: explicit ordered `routing.roleModels` mapping → agent-supplied per-task model hint → explicit OpenCode agent model → ephemeral capability/variant recommendation from the effective live inventory. A persisted user role mapping is authoritative and cannot be bypassed by a model-generated `hi_task_start.model` hint. No provider/model ID is hard-coded, automatic recommendations are never persisted as user preference, and cost/quality/feedback telemetry cannot silently reorder the result. `visual-qa` additionally requires explicit image-input capability. The retained advanced `opencode-hi-setup role-models --set manager=...` / `working-manager=...` commands remain blocked with an action telling you to choose the primary model in OpenCode instead.

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

### 7.0 Effective runtime inventory on OpenCode 1.18.21

Hi does not treat the full provider/model catalog as usable inventory. It consumes OpenCode's structured provider state, intersects the provider set with the host's `connected` IDs when exposed, preserves host model capability metadata, and then applies Hi's own provider/model/role policy. OpenCode 1.18.21 has already applied `enabled_providers`, `disabled_providers`, provider `whitelist` / `blacklist`, alpha/deprecated filtering and provider runtime overrides before Hi selection.

For this exact host version, model-level `disabled: true` is not the picker filter; use the provider `whitelist` / `blacklist` mechanism for OpenCode-side model filtering. Hi also has no arbitrary eight-model display or routing cap.

A model being present in the inventory is not proof that credentials are valid or that a remote inference has succeeded. Conversely, when inventory is unavailable Hi does not invent a bundled fallback catalog. `visual-qa` has a stronger rule: the chosen model must explicitly report image-input capability. Text-only candidates and an unverified `host-default` are rejected before ranking and revalidated again at dispatch/fallback time.

### 7.1 Legacy model-mode fields: compatibility diagnostics only

`models.mode`, `models.default`, `models.roles`, `routing.strategy`, and `routing.categoryModels` remain parseable in `0.2.4` so older project files do not become unreadable. They are **diagnostic compatibility fields**, not model-routing authorities. When explicitly supplied, config resolution reports that boundary; changing them does not change the selected child model.

Use `routing.roleModels` / `routing.roleVariants` for explicit Hi child preferences, OpenCode agent configuration for a host-owned agent model, and `routing.allowedProviders` / `routing.deniedModels` for executable narrowing.

### 7.2 `routing.roleModels`: authoritative ordered role candidates

`routing.roleModels` accepts an ordered array for each supported child role. Among live, policy-allowed, role-capable entries, the configured order is authoritative: Hi does not rerank it using cost, quality, or feedback telemetry. Unavailable or policy-rejected entries are skipped; Hi never invents an unconfigured fallback for an explicit role mapping. If no configured candidate remains eligible, that explicit mapping fails closed. Returned configured fallbacks are still bounded by `routing.maxFallbacks`.

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

Use `routing.roleModels` when you want an explicit ordered child-role model/fallback list. There is no separate active `models.roles` routing path in `0.2.4`.

## 8. Recipe: prefer one model for all Hi-dispatched child roles

Apply the same explicit model to each child role you want to constrain:

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "roleModels": {
      "coder": ["provider/model-x"],
      "architect": ["provider/model-x"],
      "repository-explorer": ["provider/model-x"],
      "qa-reviewer": ["provider/model-x"],
      "security-reviewer": ["provider/model-x"],
      "visual-qa": ["provider/model-x"]
    }
  }
}
```

Important: this affects only Hi-dispatched child roles, not the OpenCode primary session. `visual-qa` still requires proven image-input capability. If a role's explicit list has no eligible candidate, that role selection fails closed instead of silently substituting an unconfigured model.

If you want no fallback entries to be returned after a selected primary, also set:

```json
"routing": { "maxFallbacks": 0 }
```

That still does **not** turn `models.default` into a hard allowlist. Current `dev` uses `routing.allowedModels` for an explicit strict child-model allowlist, alongside provider allowlisting and exact model denylisting. The allowlist is a Hi constraint over OpenCode runtime inventory; its array order is not Adaptive routing priority; it does not create a second model catalog and does not control the OpenCode-owned primary session model.

### Use the same model for the primary session and every Hi child

This requires configuring both ownership layers with the same model ID.

In `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-hi@0.2.2"],
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

## 15. Legacy routing strategy compatibility

`routing.strategy` is still parsed in `0.2.4` so older project files remain readable, but it is **diagnostic-only** and does not control model selection. Normal automatic selection is capability/variant based and ephemeral; explicit task/role/host model ownership has precedence.

If an older file contains `cost-quality`, `quality`, or `cost`, Hi reports the legacy field through config diagnostics rather than turning it into hidden routing authority. Cost/quality measurements may still be retained as telemetry for evaluation, but they cannot silently reorder explicit user preferences or the normal automatic recommendation.

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

## 23. Node configuration wizard and advanced legacy Python CLI

Normal development `0.2.4` project reconfiguration is Node-native:

```bash
npx --yes opencode-hi@0.2.4 reconfigure .
```

The normal-user wizard covers only `primaryMode` (`auto`, `working-manager`, `manager`). `setup` and `install` open it only on a real terminal; CI/non-TTY remains deterministic with `--non-interactive`. Topology, execution profile, specialist thresholds, parallelism and scoring strategy stay internal. After OpenCode loads, type **“Hi rol modellerini ayarla”** in chat; `hi_role_models` lists only effective connected models and writes explicit child-role mappings. Cancelling the wizard performs no mutation.

The development `0.2.4` Node package runner covers the normal lifecycle plus common project controls: terminal `setup`/`install` wizard, `reconfigure`, `update`, `doctor`, `state`, `reprofile`, `roles`, `rotate`, `check-update`, `plan`, `rollback`, and `recover`. `reprofile` owns only `executionPolicy`; `roles` owns explicit child-role model/fallback/variant leaves; `rotate` only rotates one child role's fallback order. Provider authentication and `manager` / `working-manager` primary model selection remain OpenCode-owned. The older Python helper remains only for advanced/manual fields that are not yet mirrored by these bounded Node commands.

If you deliberately install the package locally for this advanced helper, the following examples apply.

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

On OpenCode 1.18.21 this legacy helper calls `opencode models --pure`. It returns the complete host-filtered ID list it can observe and returns an empty list if the host query is unavailable; it does not fall back to a bundled OpenCode-Go catalog. This helper list is still not authentication proof; live Hi routing uses the structured runtime provider inventory described above.

Set one or multiple candidates for roles:

```bash
./node_modules/.bin/opencode-hi-setup role-models /path/to/MyApp \
  --set 'coder=provider-a/code,provider-b/code' \
  --set 'architect=provider-a/reasoning,provider-b/reasoning' \
  --variant 'coder:provider-a/code=high' \
  --policy manual
```

On PowerShell use the same arguments with `.cmd` and Windows path syntax.

`--set ROLE=PRIMARY,FALLBACK1,FALLBACK2` writes `routing.roleModels`. `--variant ROLE:MODEL=VARIANT` writes `routing.roleVariants`. Current M16 preserves the complete de-duplicated ordered role list rather than truncating it to an arbitrary seven/eight-entry limit, and it preserves routing fields it does not own.

Primary-role assignments are intentionally rejected. For example, `--set manager=provider/model` returns `BLOCKED` with reason `role-model-primary-owned-by-opencode`.

`--defaults --policy recommended` in the legacy Python helper returns `DEFERRED` because ID-only CLI discovery is not authoritative model availability. Restart OpenCode and inspect the effective connected inventory with `hi_role_models`. Automatic capability/variant recommendations remain ephemeral and are not written to project policy; use `--set ROLE=...` only when you explicitly want to persist an ordered child-role mapping.

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
- an explicit task model, explicit ordered role mapping, or explicit OpenCode agent model owns the selection before automatic recommendation;
- an explicit role mapping has no remaining live/policy-eligible candidate and therefore fails closed instead of inventing another model.

### My first role model is unavailable

Hi records that the unavailable/policy-rejected entry was skipped and continues only with the remaining **explicitly configured** eligible candidates, preserving their order. It never appends an unconfigured automatic model to rescue that explicit mapping. If none remain, selection fails closed. `maxFallbacks` only bounds the reported configured fallback list.

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
| `models.mode` | diagnostic | `adaptive` | preference | parses the legacy model-selection mode for compatibility, reports it in config resolution diagnostics, and gives it no model-routing authority |
| `models.default` | diagnostic | `auto` | preference | parses the legacy fixed-model value for compatibility, reports it in config resolution diagnostics, and gives it no model-routing authority |
| `models.roles` | diagnostic | `{}` | preference | parses the legacy role-model map for compatibility, reports it in config resolution diagnostics, and gives it no model-routing authority |
| `routing.strategy` | diagnostic | `cost-quality` | preference | parses the legacy cost/quality strategy for compatibility, reports it in config resolution diagnostics, and gives it no model-routing authority |
| `routing.categoryModels` | diagnostic | `{}` | preference | parses legacy category model lists for compatibility, reports them in config resolution diagnostics, and gives them no model-routing authority |
| `routing.categoryVariants` | runtime | `{}` | preference | changes selected native model variant by task category |
| `routing.roleModels` | runtime | `{}` | preference | selects configured child-role candidates in explicit order after hard eligibility filters and before host-agent/automatic selection; primary manager roles are excluded |
| `routing.roleVariants` | runtime | `{}` | preference | changes selected native variant for a specific child-role/model pair; primary manager roles are excluded |
| `routing.maxFallbacks` | runtime | `3` | capacity | bounds fallback candidate count |
| `routing.allowedModels` | runtime | `[]` | constraint | strictly constrains Hi child routing membership to explicitly allowed runtime models; selection among eligible allowed models remains role/capability/routing driven |
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
