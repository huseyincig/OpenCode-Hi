# OpenCode-Hi Türkçe Kurulum ve Yapılandırma Rehberi

Bu belge, OpenCode-Hi'yi kurduktan sonra **nasıl yapılandıracağınızı** baştan sona anlatan Türkçe kullanıcı rehberidir. Windows, Linux ve macOS kurulumu; primary rol seçimi; child role/model eşlemesi; tek model kullanımı; role başına ayrı model; çoklu fallback; variant; category routing; provider/model sınırları; concurrency; CLI; manuel JSON; doğrulama ve sorun giderme bu belgenin kapsamındadır.

Canonical proje ayar dosyası:

```text
<proje>/.opencode/hi/policy/routing.json
```

İki dosyanın sorumluluğunu karıştırmayın:

- `opencode.json` / `opencode.jsonc`: OpenCode plugin kaydı ve **primary session modeli** gibi host ayarları.
- `.opencode/hi/policy/routing.json`: Hi'nin proje içindeki execution, child model routing, fallback ve concurrency davranışı.

> En önemli kural: `manager` ve `working-manager` primary rollerdir. Hi tarafında bu iki role model atanmaz. Primary modeli OpenCode seçer. Hi model routing yalnız altı child role uygulanır: `coder`, `architect`, `repository-explorer`, `qa-reviewer`, `security-reviewer`, `visual-qa`.

## 0. Önce Hi'yi kurun/yükleyin

### npm package-runner — normal kullanıcı yolu

Windows, Linux ve macOS'ta aynı Node tabanlı package-runner kullanılır. `0.2.2` adayı için:

```bash
npx --yes opencode-hi@0.2.2 setup /path/to/MyApp
```

Windows PowerShell örneği:

```powershell
npx --yes opencode-hi@0.2.2 setup C:\Projects\MyApp
```

Komut mevcut OpenCode ayarlarınızı koruyarak exact Hi package kaydını ekler. Projeye development dependency kurmaz; application-root `package.json`, lock veya `node_modules` oluşturmaz ve harici Python gerektirmez.

Kurulumdan sonra OpenCode'u yeniden başlatın. Statik registration/ownership kontrolü için:

```bash
npx --yes opencode-hi@0.2.2 doctor /path/to/MyApp
```

Canlı provider/model inventory ve runtime capability doğrulaması için yüklenmiş OpenCode oturumundaki `hi_doctor` kullanılmalıdır. Package `doctor` provider authentication veya başarılı remote model çağrısı kanıtı değildir.

### Git/source loading — contributor yolu

Direct Git/local loading source development ve CI compatibility için kullanılabilir; normal kullanıcı onboarding yolu değildir. Tekrarlanabilir acceptance için exact repository SHA/spec kullanın ve OpenCode'un plugin'i gerçekten yüklediğini doğrulayın.

> OpenCode 1.18.19 model gerçeği: Hi structured provider inventory kullanır ve host `connected` provider kimliklerini sunuyorsa bunlarla kesiştirir. Bu host sürümünde model-level `disabled: true` picker filtresi yoktur; OpenCode tarafındaki model filtresi provider `whitelist` / `blacklist` üzerinden çalışır. Hi katalog fallback'i üretmez ve sekiz modelde kesmez. `visual-qa` yalnız host'un açıkça image-input capability verdiği modelle çalışır; text-only veya capability'si doğrulanmamış `host-default` kabul edilmez.

## 1. Windows, Linux ve macOS ayar yolu

| Platform | Örnek proje | Hi ayar dosyası |
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

### Linux / macOS

```bash
PROJECT=/path/to/MyApp
mkdir -p "$PROJECT/.opencode/hi/policy"
${EDITOR:-vi} "$PROJECT/.opencode/hi/policy/routing.json"
```

Ayar değişikliğinden sonra host hot-reload yapmıyorsa OpenCode'u yeniden başlatın.

## 2. Ayar dosyası zorunlu mu?

Hayır. Hi elle yazılmış bir routing dosyası olmadan çalışabilir. İlk effective runtime model inventory geldiğinde yalnız gerçekten enabled/policy-allowed ve role-eligible modelleri alır; aynı canonical cost/quality scoring mantığıyla altı child role için tek seferlik başlangıç önerilerini hesaplar. Kod içinde sabit provider/model ID önerisi yoktur.

Bu ilk seçimler hard lock değildir. `routing.json` oluşturulduktan sonra kullanıcı tercihi olarak düzenlenebilir; sonraki inventory refresh veya update geçerli mevcut role seçimlerini ezmez. `visual-qa` için ayrıca host tarafından doğrulanmış image-input capability gerekir.

Proje dosyasının envelope'u:

```json
{
  "schema": 1,
  "type": "hi-routing"
}
```

## 3. Önerilen başlangıç ayarı

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

## 4. `executionPolicy`

Geçerli değerler:

- `minimal`: minimum specialist/overhead yönelimi.
- `balanced`: dengeli sabit profile.
- `thorough`: daha güçlü specialist/review eğilimi.
- `adaptive`: default; risk/scope/ambiguity durumuna göre profile seçer.
- `manual`: balanced threshold kullanır fakat automatic continuation kapalıdır.

Örnek:

```json
{
  "schema": 1,
  "type": "hi-routing",
  "executionPolicy": "thorough"
}
```

## 5. Primary rol: `primaryMode`

`primaryMode` model seçmez; **hangi primary rolün kullanılacağını** belirler.

- `auto`: default. Uygun lokal işlerde çoğunlukla `working-manager`.
- `working-manager`: write-capable primary rolü zorlar.
- `manager`: read-only coordination primary rolünü zorlar; implementation child worker'a delege edilir.

```json
{
  "schema": 1,
  "type": "hi-routing",
  "primaryMode": "manager"
}
```

## 6. Roller ve model ownership

| Rol | Sınıf | Modeli kim seçer? | Amaç |
|---|---|---|---|
| `working-manager` | primary | **OpenCode** | direkt çalışma + koordinasyon |
| `manager` | primary | **OpenCode** | read-only koordinasyon |
| `coder` | child | **Hi** | implementation/fix |
| `architect` | child | **Hi** | architecture/contract |
| `repository-explorer` | child | **Hi** | bounded repository exploration |
| `qa-reviewer` | child reviewer | **Hi** | regression/quality review |
| `security-reviewer` | child reviewer | **Hi** | security review |
| `visual-qa` | child reviewer | **Hi** | browser/visual/accessibility review |

### Primary model nasıl seçilir?

OpenCode root `model` alanını kullanın:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "provider/model-x"
}
```

Hi config'inde şunları **yazmayın**:

```json
{
  "routing": {
    "roleModels": {
      "manager": ["provider/model-a"],
      "working-manager": ["provider/model-b"]
    }
  }
}
```

Current loader primary/unknown role-model key'lerini effective Hi config'e almaz. `opencode-hi-setup role-models --set manager=...` ve `working-manager=...` komutları da açıkça `BLOCKED` döner.

## 7. Hi model routing hangi rollerde çalışır?

Tam liste:

```text
coder
architect
repository-explorer
qa-reviewer
security-reviewer
visual-qa
```

Bunun dışındaki role key'lerini model map'e koymayın.

### `models.mode`

- `adaptive`: normal Hi scoring/routing.
- `fixed`: `models.default` bütün Hi child task'lar için tercih edilen model olur.
- `role-mapped`: `models.roles` ile child role başına tek tercih modeli verilir.

### `routing.roleModels`

Child role başına sıralı model aday/fallback listesi verir.

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "roleModels": {
      "coder": [
        "provider-a/code",
        "provider-b/code",
        "provider-c/code"
      ]
    },
    "maxFallbacks": 2
  }
}
```

Liste bir routing prior'dır; hard security allowlist değildir. Runtime availability, provider policy ve yeterli empirical feedback sonucu eligible candidate sıralaması değişebilir.

## 8. Bütün Hi child'larda tek model

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

Bu yalnız Hi child task modelini tercih eder. Primary session modelini değiştirmez.

`maxFallbacks: 0` fallback listesini kaldırır fakat **hard model whitelist oluşturmaz**. Current Hi'de genel `allowedModels` whitelist alanı yoktur.

## 9. Aynı model primary + bütün child'larda

İki ownership katmanında aynı model ID'yi yazın.

`opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-hi@0.2.2"],
  "model": "provider/model-x"
}
```

`.opencode/hi/policy/routing.json`:

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

OpenCode primary modeli; Hi ise child modeli yönetir.

## 10. Her child role ayrı tek model

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

Eksik child role normal routing'e düşer.

## 11. Role başına çoklu model/fallback

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

`maxFallbacks` aralığı `0..6`.

## 12. Ortak primary child modeli + role-specific fallback

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "roleModels": {
      "coder": ["provider/common", "provider/code-specialist"],
      "architect": ["provider/common", "provider/reasoning-specialist"],
      "repository-explorer": ["provider/common", "provider/fast-specialist"],
      "qa-reviewer": ["provider/common", "provider/review-specialist"],
      "security-reviewer": ["provider/common", "provider/security-specialist"],
      "visual-qa": ["provider/common", "provider/vision-specialist"]
    },
    "maxFallbacks": 1
  }
}
```

## 13. Task category'leri

Canonical category'ler:

| Category | Tipik kullanım | Built-in variant önceliği |
|---|---|---|
| `quick` | hızlı/ucuz lokal iş | `low`, `minimal`, `none` |
| `standard` | genel dengeli iş | `medium`, `low`, `none` |
| `deep` | reasoning/coding yoğun | `high`, `xhigh`, `medium` |
| `visual` | browser/visual | `high`, `medium`, `xhigh` |
| `critical` | high-assurance | `xhigh`, `max`, `high` |

Role candidates category candidates'tan önce değerlendirilir.

## 14. Category'ye göre model

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "categoryModels": {
      "quick": ["provider/fast"],
      "standard": ["provider/balanced"],
      "deep": ["provider/reasoning"],
      "visual": ["provider/vision"],
      "critical": ["provider/high-assurance"]
    }
  }
}
```

## 15. Variant ayarları

Variant ancak model runtime inventory'sinde gerçekten mevcutsa seçilir.

Öncelik:

1. `routing.roleVariants[role][model]`
2. `routing.categoryVariants[category]`
3. built-in category preference
4. modelin ilk available variant'ı

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

### Category variant

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

## 16. Routing strategy

`routing.strategy`:

- `cost-quality`: default; kalite ile expected completion cost arasında denge.
- `quality`: quality ağırlıklı.
- `cost`: expected completion cost ağırlıklı.

Bu cost provider faturası değildir; Hi/OpenCode-derived routing heuristic'tir.

## 17. Provider ve model sınırları

### Sadece belirli provider'lar

```json
{
  "schema": 1,
  "type": "hi-routing",
  "routing": {
    "allowedProviders": ["provider-a", "provider-b"]
  }
}
```

Non-empty `allowedProviders`, unconstrained `host-default` fallback'ı da kapatır.

### Exact model denylist

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

Host + project composition:

- `allowedProviders`: iki tarafta da doluysa intersection.
- `deniedModels`: union.
- OpenCode native provider deny her zaman korunur.

## 18. Topology ve concurrency farkları

Üç ayrı limit vardır:

- `execution.maxAgents`: mission topology agent üst sınırı, `1..8`.
- `execution.parallelism`: topology içindeki paralel stream üst sınırı, `1..8`.
- `parallel.max`: global scheduler worker kapasitesi, `1..8`.

`parallel.enabled: false` ise effective global kapasite `1` olur.

## 19. Single-agent / multi-agent zorlamak

Single:

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

Multi:

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

Bu ayarlar authority/permission/dependency/review requirement bypass etmez.

## 20. Provider/model concurrency limitleri

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

Provider/model limitleri positive integer'dır ve current resolver tarafından `32` ile sınırlandırılır.

## 21. Profile threshold'ları

Allowed değerler: `low`, `medium`, `high`.

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

Bunlar authority grant değildir; specialist/reviewer routing sensitivity ayarlarıdır.

## 22. Tam pratik örnek

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
      "repository-explorer": ["provider-a/fast"],
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
  }
}
```

## 23. Config precedence

Genel sıra:

```text
built-in default
  < host Hi config
  < project .opencode/hi/policy/routing.json
```

Önemli composition kuralları:

- `routing.allowedProviders`: narrowing/intersection.
- `routing.deniedModels`: union.
- child `models.roles`, `roleModels`, `roleVariants`, category maps ve concurrency maps: matching project key host key'i override eder; unrelated host key korunur.
- primary/unknown role-model key'leri child map'e alınmaz.
- invalid/unknown alanlar yeni destek yüzeyi oluşturmaz.

## 24. CLI ile genel reconfigure

### Windows

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

Önemli flag'ler:

```text
--execution-policy minimal|balanced|thorough|adaptive|manual
--primary-mode auto|working-manager|manager
--routing-strategy cost-quality|quality|cost
--allow-provider PROVIDER
--deny-model PROVIDER/MODEL
--max-fallbacks 0..6
--parallel enabled|disabled
--parallel-max 1..8
--provider-limit PROVIDER=1..32
--model-limit PROVIDER/MODEL=1..32
--profile-target minimal|balanced|thorough
--specialist-threshold low|medium|high
--review-threshold low|medium|high
--print
```

`--primary-mode` model atamaz; yalnız primary rol seçimini etkiler.

## 25. `role-models` CLI

Desteklenen role target'ları sadece:

```text
coder
architect
repository-explorer
qa-reviewer
security-reviewer
visual-qa
```

### Mevcut ayarı görüntüle

```powershell
.\node_modules\.bin\opencode-hi-setup.cmd role-models C:\Projects\MyApp --print
```

```bash
./node_modules/.bin/opencode-hi-setup role-models /path/to/MyApp --print
```

### Model inventory

```bash
./node_modules/.bin/opencode-hi-setup role-models /path/to/MyApp --list-available
```

### Bir role birden fazla model

```bash
./node_modules/.bin/opencode-hi-setup role-models /path/to/MyApp \
  --set 'coder=provider-a/code,provider-b/code' \
  --set 'architect=provider-a/reasoning,provider-b/reasoning' \
  --variant 'coder:provider-a/code=high' \
  --policy manual
```

Primary assignment örneği:

```text
--set manager=provider/model
```

bilinçli olarak `BLOCKED` döner. Reason: `role-model-primary-owned-by-opencode`.

## 26. Manuel JSON ne zaman?

Manuel `routing.json` kullanın:

- `execution.*`
- `models.*`
- category model/variant
- tam profile ayarları
- role listeleri/fallback'ler

gibi CLI'da tek tek flag'i olmayan full surface gerektiğinde.

Unknown field destek anlamına gelmez.

## 27. Değişiklikten sonra doğrulama

1. `routing.json` kaydedin.
2. Gerekirse OpenCode'u restart edin.
3. Aktif OpenCode session'da `hi_doctor` çalıştırın.
4. İstenen model/provider'ın runtime inventory'de gerçekten göründüğünü doğrulayın.
5. Representative child task çalıştırıp effective model/variant evidence'ına bakın.
6. Static JSON'da model adının bulunmasını runtime proof kabul etmeyin.

## 28. Sorun giderme

### `routing.json` okunmuyor

Kontrol edin:

- exact path `.opencode/hi/policy/routing.json`
- valid JSON
- `schema: 1`
- `type: "hi-routing"`
- doğru proje root'u
- restart gereksinimi

### `manager` model ayarım kayboldu

Bu beklenen davranıştır. Primary `manager` / `working-manager` modeli Hi child routing'in parçası değildir. Primary modeli OpenCode `model` ayarından seçin.

### Configured child model seçilmedi

Olası sebepler:

- runtime inventory'de yok
- provider allowlist dışında
- denylist'te
- OpenCode native provider policy reddediyor
- write-capable route için model uygun değil
- explicit task model daha güçlü precedence
- admitted feedback normal routing'i rerank ediyor

### `parallel.max=8` ama tek worker var

Capacity tek belirleyici değildir. Topology, dependency, authority, provider/model limitleri ve verification sequencing işi serialize edebilir.

### `allowedProviders` sonrası host-default yok

Beklenen. Non-empty provider sınırı unconstrained host-default fallback ile çelişir.

## 29. Security / authority sınırı

Config model, routing, topology ve capacity tercihlerini değiştirir. Şunları **yapamaz**:

- external action authority grant
- OpenCode deny/permission widen
- user dirty-file ownership bypass
- observation'ı verification evidence'a dönüştürme
- primary agent contract'ını Hi child role gibi ele alma

## 30. Canonical 29-option referansı

Aşağıdaki tablo `data/hi-config-options.json` kaynağından generated edilir. Alan adı/default/classification mekanik current inventory'dir; elle düzenlenmez.

<!-- BEGIN GENERATED CONFIG REFERENCE -->
`data/hi-config-options.json` kaynağından generated edilir. Elle düzenlemeyin.

| Alan | Sınıf | Default | Güvenlik semantiği |
|---|---|---|---|
| `schemaVersion` | schema-marker | `2` | constraint |
| `executionPolicy` | runtime | `adaptive` | preference |
| `primaryMode` | runtime | `auto` | preference |
| `compatibility.mode` | diagnostic | `compatible` | constraint |
| `compatibility.validatedOpenCodeVersions` | diagnostic | `[]` | constraint |
| `execution.topology` | runtime | `adaptive` | constraint |
| `execution.maxAgents` | runtime | `4` | capacity |
| `execution.parallelism` | runtime | `2` | capacity |
| `models.mode` | runtime | `adaptive` | preference |
| `models.default` | runtime | `auto` | preference |
| `models.roles` | runtime | `{}` | preference |
| `routing.strategy` | runtime | `cost-quality` | preference |
| `routing.categoryModels` | runtime | `{}` | preference |
| `routing.categoryVariants` | runtime | `{}` | preference |
| `routing.roleModels` | runtime | `{}` | preference |
| `routing.roleVariants` | runtime | `{}` | preference |
| `routing.maxFallbacks` | runtime | `3` | capacity |
| `routing.allowedProviders` | runtime | `[]` | constraint |
| `routing.deniedModels` | runtime | `[]` | constraint |
| `parallel.enabled` | runtime | `true` | capacity |
| `parallel.max` | runtime | `3` | capacity |
| `parallel.providers` | runtime | `{}` | capacity |
| `parallel.models` | runtime | `{}` | capacity |
| `profile.minimal.specialistThreshold` | runtime | `high` | preference |
| `profile.minimal.reviewThreshold` | runtime | `low` | preference |
| `profile.balanced.specialistThreshold` | runtime | `medium` | preference |
| `profile.balanced.reviewThreshold` | runtime | `medium` | preference |
| `profile.thorough.specialistThreshold` | runtime | `low` | preference |
| `profile.thorough.reviewThreshold` | runtime | `high` | preference |
<!-- END GENERATED CONFIG REFERENCE -->
