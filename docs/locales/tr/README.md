# OpenCode-Hi

[English README](../../../README.md)

OpenCode-Hi, OpenCode üzerinde kanıta duyarlı yapay zekâ yazılım mühendisliği için **semantik ve yürütme kontrol düzlemidir**. Hi; Mission, Task, Worker, Role, Methodology, Authority, Evidence, Verification, recovery ve completion anlamlarını sahiplenir. OpenCode ise session, model/provider, tool, permission, PTY, workspace ve diğer native host primitive’lerini çalıştıran ana hosttur.

Temel kural:

> **Hi ürün semantiğine karar verir; OpenCode doğru native primitive’i çalıştırır.**

Hi, mümkün olan en fazla agent/token/araç yerine iş için **minimum yeterli** topology, model, context ve verification kullanmayı hedefler.

## Güncel ürün gerçeği

Güncel immutable public release `opencode-hi@0.2.4` / `v0.2.4`'tür. GitHub Releases ve npm registry public availability için authoritative kaynaklardır. Yayınlanmış `0.2.4`; exact Git tag/source `19bcb4e7adf9d71b851c82cf5f74210e4ca56eb0`, başarılı Ubuntu/Windows Release Readiness, npm Trusted Publishing provenance, registry digest eşitliği ve fresh-registry exact OpenCode `1.18.21` kabulü ile doğrulanmıştır. `dev` branch'i aktif post-release geliştirme hattıdır; `main` stabil yayımlanmış 0.2.4 kaynak hattını korur.

Güncel host/capability gerçeği elle yazılan metinden değil exact receipt'lerden üretilir. Ayrıntı için [Host Support](../../HOSTS.md) ve `data/validation/compatibility-matrix-0.1.0.json` kullanılır.

## Ne sağlar?

OpenCode-Hi native AI execution çevresine deterministic ürün semantiği ekler:

- tek canonical Mission/Task/Worker ownership modeli;
- direct, delegated ve bounded multi-agent execution;
- Role, model, Methodology ve topology'nin birbirinden bağımsız seçimi;
- exact Authority ve monotonic host Permission sınırları;
- explicit supersession ve fail-closed mutation enforcement taşıyan revision-bound structured kullanıcı Constraint/Decision atomları;
- olasılıksal confidence veya routing authority iddiası üretmeden local semantic sensitivity gösteren advisory counterfactual decision-stability diagnostics;
- kanıta bağlı falsifiable diagnosis hipotezleri; root-cause prose tek başına completion veya harmful learning credit üretemez;
- bounded Mission runtime projection, durable context artifactları, TypeScript Semantic Context ve confidence/freshness gate'li evidence-backed project methodology learning;
- lazy Methodology/skill discovery ve loading;
- structured Evidence, VerificationEnvelope ve deterministic completion;
- bounded recovery, WAIT ve authoritative STOP;
- cost/telemetry verisini routing authority yapmadan exact attempt-level usage ve lifecycle-bound causal repeat/context attribution;
- exact deterministic certification kararını değiştirmeyen advisory benchmark uncertainty diagnostics (95% örnek aralığı, opsiyonel Fleiss judge agreement, explicit evidence-family diversity);
- OpenCode session history ownershipünü almadan explicit priority/freshness/protection metadata kullanan, whole-group seçimli ve benchmark-gated atomic child-handoff context projection;
- exact-host kabulü bulunan Hi-owned process, isolated-workspace ve browser executor yüzeyleri;
- restart-safe durable state;
- ownership-aware install, upgrade, reconfigure, uninstall, rollback ve crash recovery.

Bir modelin “done” demesi, screenshot bulunması, skill'in kurulu olması veya host API'nin mevcut olması tek başına product support/PASS/completion kanıtı değildir.

## Hi ve OpenCode

```text
User intent
   |
   v
Hi semantic assessment
   |
   v
Mission -> TaskRuntime -> Worker
   |          |             |
   |          +--> Role / model / Methodology
   |          +--> Authority / Permission
   |          +--> Context / methodology learning
   |          |
   |          v
   |       Hi HostPort
   |          |
   |          v
   |       OpenCode native execution
   |          |
   |          v
   +<-- observed result / Evidence / Verification
              |
              v
        recovery / WAIT / STOP
              |
              v
         deterministic completion
```

Hi semantiği host-portable'dır; OpenCode'a özgü tipler ve belirsiz host davranışı adapter sınırlarında kalır. OpenCode-native kavramlar kozmetik olarak Hi adıyla yeniden adlandırılmaz.

## Capability özeti

Machine-readable compatibility projection canonical mutable support görünümüdür. Güncel exact-host acceptance sınırında:

- **Process lifecycle:** Hi-owned `ProcessContract` / `ProcessExecutor` yüzeyinde supported. PID-bound spawn, bounded IO, event-driven WAIT, timeout, kill, ayrı cleanup, restart adoption ve STOP reconciliation kapsanır.
- **Workspace isolation:** Hi-owned `IsolationDecision` / `WorkspaceLease` / `WorkspaceRuntime` yüzeyinde supported. Required isolation alternate workspace'e bağlanır; verification aynı lease içinde yürür ve primary/user-dirty worktree korunur.
- **Browser execution:** Hi-owned ve runtime-health-gated yüzeyde supported. Mandatory local browser verification Chromium gerektirip executable bulunamadığında published `0.2.4` runtime pinned `playwright-core@1.62.1` üzerinden Hi-owned platform cache'e en fazla bir bounded bootstrap denemesi yapar. Bootstrap başarısız veya unavailable ise durum açık environment/capability blocker olur; aynı verification state synthetic continuation döngüsüne girmez. BrowserObservation veya screenshot otomatik Evidence/PASS değildir.
- **HumanDecision:** chat transport supported. Deterministic structured OpenCode question-opening UI transport, accepted host API gerekli public opener'ı sağlamadığı için unsupported'dır.
- **Semantic Context:** explicit first-class adapter yalnız TypeScript/TSX destekler. JavaScript, LSP ve Tree-sitter semantic adapter desteği ilan edilmez.

Exact host version/platform/architecture ve receipt bağlantıları için [Host Support](../../HOSTS.md) kullanın.

## Kurulum ve ilk kullanım

OpenCode-Hi'nin normal kullanıcı yolu npm-registry-first'tür. `0.2.2` adayı için tek seferlik Node package-runner kullanılır; repository checkout, Bun, harici Python, proje köküne `npm install`, proje `package.json`/lock veya kalıcı root `node_modules` gerekmez.

### npm registry — normal kullanıcı yolu

Projeye npm dependency eklemek yerine package-runner ile OpenCode kaydını oluşturun. Proje klasörünün içinde en kısa komut:

```bash
npx --yes opencode-hi@latest setup .
```

Bu komut proje kökündeki `opencode.json` dosyasını oluşturur veya mevcut dosyayı koruyarak exact Hi kaydını ekler. Hi-owned lifecycle/provenance dosyaları `.opencode/hi/**` altında kalır; proje köküne `package.json`, `package-lock.json` veya kalıcı `node_modules` saçmaz.

> OpenCode projesini hazırlamak için `npm i opencode-hi` kullanmayın. Düz `npm i`, npm dependency kurulumu yapar; proje npm dosyalarını/node_modules'u oluşturur ve Hi'nin `opencode.json` + `.opencode/hi/**` setup işlemini yapmaz.

Sonra OpenCode'u yeniden başlatın. Registry package cache/materialization ve native plugin loading OpenCode'un sorumluluğundadır. Statik registration/ownership kontrolü için:

```bash
npx --yes opencode-hi@0.2.2 doctor /path/to/project
```

Yüklenmiş OpenCode oturumunda canlı provider/model inventory ve runtime capability gerçeği için `hi_doctor` kullanın. Package `doctor`, bir modelin credential'ının geçerli olduğunu veya remote inference'ın başarılı olduğunu varsaymaz.

Hi'nin sahip olduğu mevcut exact kaydı yeni sürüme taşımak için hedef sürümün runner'ını kullanın:

```bash
npx --yes opencode-hi@0.2.2 update /path/to/project
```

`setup`/`update` yalnız exact Hi plugin kaydı ile `.opencode/hi/**` altındaki Hi-owned provenance'ı değiştirir; foreign plugin/provider/MCP ve bilinmeyen kullanıcı alanlarını korur. OpenCode kendi plugin runtime'ı için `.opencode/.gitignore`, `.opencode/package.json` veya `.opencode/node_modules` oluşturabilir; bunlar Hi-owned bootstrap state değildir.

### Komut yüzeyleri ve interaktif kurulum sınırı

Package lifecycle ile yüklü OpenCode runtime yüzeyi ayrıdır. Published `0.2.4` ile `install` güvenli **ensure** davranışına sahiptir: ownership yoksa setup, aynı exact owned sürümde NOOP, Hi-owned eski sürümde aynı drift/ownership guard'lı update. `setup` strict ilk kurulum olarak kalır.

- `install`: published `0.2.4` için exact registration'ı setup / safe owned update / NOOP ile ensure eder.
- `setup`: strict ilk exact Hi-owned registration/provenance kaydını oluşturur.
- `reconfigure`: published `0.2.4` için bounded project wizard'ı yeniden açar.
- `update`: Hi'nin sahip olduğu kaydı hedef exact sürüme açıkça taşır.
- `doctor`: registration, ownership, drift ve pending lifecycle state'i statik olarak kontrol eder.
- `state`: package/project registration + routing state'ini read-only gösterir; live Mission state değildir.
- `reprofile`: yalnız project-owned `executionPolicy` alanını değiştirir.
- `roles`: altı Hi child role için explicit model/fallback/variant eşlemesini gösterir/değiştirir.
- `rotate`: yalnız seçilen child role model fallback sırasını döndürür; credential/API key rotation değildir.
- `check-update`: npm latest metadata'yı okuyup advisory verir; project'i değiştirmez.
- `plan`: değişikliği uygulamadan exact before/after planını gösterir.
- `rollback`: hash'ler hâlâ eşleşiyorsa tek kayıtlı rollback noktasını geri alır.
- `recover`: yalnız kayıtlı yarım setup/update transaction'ını uzlaştırır.

### Güncel `dev` Settings control plane

Yayınlanmış `0.2.4` kanıtı immutable olarak 34 tool'da kalır. Güncel `dev` buna `hi_settings` yüzeyini ekler: Work Mode `Adaptive`, `Single`, `Multi`; child roller varsayılan Automatic; canlı model seçenekleri yalnız OpenCode'un effective connected inventory'sinden gelir. Çok alanlı değişiklikler tek transaction olarak doğrulanır ve ya tamamen yazılır ya hiç yazılmaz. Runtime ayar değişikliği yeni worker dispatch'lerinde restart olmadan uygulanır. Provider auth ve primary `manager` / `working-manager` model seçimi OpenCode-owned kalır. CLI karşılığı `npx opencode-hi config` komutudur; `hi_role_models` geriye dönük uyumluluk için korunur. Explicit settings dosyası yoksa Adaptive + Automatic geçerli defaulttur; canlı model varsa ilk pending sohbet oturumunda bounded onboarding bir kez sunulur, gerçek iş kesilmez. `hi_settings` açılırken inventory yeniden refresh edildiği için sonradan bağlanan provider restart olmadan görünür.

Plugin yüklendikten sonra **34 adet `hi_*` runtime tool** vardır. Kullanıcıya en yakın durum/diagnostic araçları `hi_doctor`, `hi_status`, `hi_readiness`, `hi_metrics` ve `hi_ledger`'dır; diğerleri task/worker, process, browser, context artifact, temporary mutation ve semantic control için bounded primitive'lerdir.

Güncel published `0.2.4` sürümünde kurulum ownership/drift durumu package `doctor` ile; canlı Mission durumu runtime `hi_status`, `hi_readiness` ve `hi_ledger` ile görülür. `0.2.4` normal setup/reconfigure akışını yalnız primary mode sorusuna indirir; rol-model eşlemesi OpenCode sohbetinde `hi_role_models` üzerinden yapılır. `state`, `reprofile`, `roles`, `rotate`, `check-update` deterministik CLI fallback olarak kalır.

```bash
npx --yes opencode-hi@0.2.3 reconfigure .
npx --yes opencode-hi@0.2.3 state .
npx --yes opencode-hi@0.2.4 reprofile . --profile balanced
npx --yes opencode-hi@0.2.3 roles . --set coder=provider/model-a,provider/model-b
npx --yes opencode-hi@0.2.3 rotate . --role coder
npx --yes opencode-hi@0.2.3 check-update .
```

Published `0.2.4` setup akışı CI/non-TTY kullanımında deterministic kalır. gerçek terminal algılandığında bounded soru-cevap wizard açar ve `--non-interactive` ile deterministic yol açıkça seçilebilir:

```text
setup/install (TTY) -> project wizard -> OpenCode restart -> package doctor -> runtime hi_doctor
setup/install (CI/non-TTY) -> deterministic registration -> restart -> doctor -> hi_doctor
```

Wizard yalnız mevcut canonical Hi ayarlarını sorar: `primaryMode`, `execution.topology`, `executionPolicy`, child-model policy ve `routing.strategy`. Provider authentication ve primary `manager` / `working-manager` model seçimi OpenCode-owned kalır. Setup anında live OpenCode model inventory yoksa wizard model ID uydurmaz. Adaptive seçen kullanıcıda Hi ilk effective runtime inventory'den eligible modelleri rank eder; manuel role mapping seçilirse otomatik ilk recommendation persistence bastırılır ve restart sonrası `hi_doctor` + `roles` ile exact child model adayları ayarlanır. Aynı wizard `reconfigure` ile tekrar açılır. Legacy Python helper yalnız advanced/compatibility alanları içindir.

`0.2.2` yayınlanmıştır; npm Trusted Publishing ve fresh-registry exact OpenCode `1.18.19` T4 doğrulaması tamamlanmıştır.

### Git/source — contributor ve geliştirme yolu

Direct Git/local loading geliştirme ve CI compatibility için kullanılabilir fakat normal kullanıcı onboarding yolu değildir. Reproducible kabulde exact SHA/spec kullanılmalı ve OpenCode'un plugin'i gerçekten yüklediği gözlenmelidir.

### Source development

Source development için önce runtime build edilir:

```bash
npm ci --prefix plugin
npm run build:plugin
```

OpenCode accepted host üzerinde `.opencode/plugins/` ve local/file plugin loading mekanizmalarını destekler. Runtime verification plugin'in, Hi agent/tool/native skill yüzeyinin gerçekten yüklendiğini doğrulamalıdır.

Install/upgrade/reconfigure/doctor/uninstall/rollback/recovery davranışı için [Installation and Lifecycle](../../INSTALLATION.md) belgesine bakın.

**Plugin kurulduktan sonra:** Windows, Linux ve macOS yolları; tüm Hi ayarları; primary rol/model ownership ayrımı; child role model eşlemesi; tek model, child role başına model, çoklu fallback, variant, provider/model sınırları ve concurrency için eksiksiz [Türkçe Kurulum ve Yapılandırma Rehberi](CONFIGURATION.md) belgesini kullanın.

## Configuration

Hi configuration current-only ve fail-closed'dur. Canonical machine inventory `data/hi-config-options.json` dosyasıdır. Her runtime option validator, precedence, consumer, executable effect, documentation ve test ile bağlı olmalıdır. Unknown veya stale config sessizce compatibility feature olarak kabul edilmez.

Ayrıntılı Türkçe kurulum ve ayarlar için [Kurulum ve Yapılandırma Rehberi](CONFIGURATION.md); lifecycle ayrıntıları için [Installation and Lifecycle](../../INSTALLATION.md) ve [Architecture](../../ARCHITECTURE.md#execution-policy) kullanın.

## Roles, models, Methodologies ve skills

`ROLE != AGENT != MODEL != METHODOLOGY != TASK != WORKER != TOPOLOGY`.

Hi, `hi-*` namespace altında 27 built-in Methodology sunar. Methodology reusable **HOW**'dur; OpenCode skill ise ana hostta methodology içeriğini discover/load eden native primitive'dir. Installed skill, admitted Methodology, selected Methodology ve loaded Methodology aynı şey değildir.

Role seçimi tek başına model seçmez; Methodology Authority veremez ve completion sahibi olamaz. Ayrıntı için [Methodologies and Skills](../../SKILLS.md) kullanın.

## Güvenlik ve kontrol

**Permission ile Authority farklıdır.** OpenCode Permission hostun ne çalıştırabileceğini belirler; Hi Authority hassas/external effect'i exact action/target/parameters/scope'a bağlar. Hi host denial'ını sessizce genişletemez.

User'a ait dirty, staged ve unrelated dosyalar user-owned kalır. Broad reset/stash/checkout/restore veya `git add -A` güvenli ownership shortcut'ı değildir.

**Evidence prose değildir.** Worker/model output, Context, project methodology-learning state, Methodology content veya browser observation ikna edici görünse bile otomatik Evidence olmaz. Completion ancak current obligations ile fresh admissible proof deterministic olarak uzlaştığında kapanır.

Ayrıntı için [Human Decisions and Authority](../../HUMAN-DECISIONS.md), [Verification](../../VERIFICATION.md) ve [Security model](../../SECURITY-MODEL.md) kullanın.

## State ve recovery

Hi-owned project state explicit storage ownership kurallarına göre `.opencode/hi/` altında yaşar. OpenCode-native plugin/skill dizinleri OpenCode-owned kalır. Durable state current-schema only'dir; restart reconciliation exact owned resource'u adopt eder veya mismatch'i quarantine eder, continuity uydurmaz.

Ayrıntı için [Architecture](../../ARCHITECTURE.md#storage-and-filesystem-ownership) kullanın.

## Dokümantasyon

- [Documentation index](../../README.md)
- [Installation and configuration](../../INSTALLATION.md)
- [Architecture](../../ARCHITECTURE.md)
- [Host support](../../HOSTS.md)
- [Methodologies and skills](../../SKILLS.md)
- [Human decisions and authority](../../HUMAN-DECISIONS.md)
- [Verification](../../VERIFICATION.md)
- [Security model](../../SECURITY-MODEL.md)
- [Release engineering](../../RELEASE.md)
- [Contributing](../../../.github/CONTRIBUTING.md) · [Security](../../../.github/SECURITY.md) · [Support](../../../.github/SUPPORT.md)

## Doğrulama

Repository root'tan canonical kontroller:

```bash
npm run check
python -m pytest -q tests/test_hi.py
python scripts/validate.py
```

Fresh test count dokümana elle yazılmaz; command output onun sahibidir. Host-bound claim T3, gerçek external publication claim T4 evidence gerektirir.

Bu Türkçe README current İngilizce README'nin localization yüzeyidir; yeni product behavior tanımlamaz veya canonical English truth'u genişletmez.

## Lisans

OpenCode-Hi Apache-2.0 lisanslıdır. External mechanisms, attribution ve source-reuse sınırları [Third-Party Notices](../../../THIRD_PARTY_NOTICES.md) içinde tutulur.
