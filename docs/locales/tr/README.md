# OpenCode-Hi

[English README](../../../README.md)

OpenCode-Hi, OpenCode üzerinde kanıta duyarlı yapay zekâ yazılım mühendisliği için **semantik ve yürütme kontrol düzlemidir**. Hi; Mission, Task, Worker, Role, Methodology, Authority, Evidence, Verification, recovery ve completion anlamlarını sahiplenir. OpenCode ise session, model/provider, tool, permission, PTY, workspace ve diğer native host primitive’lerini çalıştıran ana hosttur.

Temel kural:

> **Hi ürün semantiğine karar verir; OpenCode doğru native primitive’i çalıştırır.**

Hi, mümkün olan en fazla agent/token/araç yerine iş için **minimum yeterli** topology, model, context ve verification kullanmayı hedefler.

## Güncel ürün gerçeği

Bu checkout uygulama/package sürümü olarak `0.2.1`'i izler. Sürüm kimliğinin canonical sahibi `VERSION` dosyasıdır ve package metadata ile parity doğrulanır. Bir sürümün gerçekten yayımlanmış olup olmadığı mutable external state'tir; bunun authoritative kaynakları GitHub Releases ve npm registry'dir. Tarihsel `v0.1.1` ve `v0.1.0` release artifact'leri immutable kalır.

Güncel host/capability gerçeği elle yazılan metinden değil exact receipt'lerden üretilir. Ayrıntı için [Host Support](../../HOSTS.md) ve `data/validation/compatibility-matrix-0.1.0.json` kullanılır.

## Ne sağlar?

OpenCode-Hi native AI execution çevresine deterministic ürün semantiği ekler:

- tek canonical Mission/Task/Worker ownership modeli;
- direct, delegated ve bounded multi-agent execution;
- Role, model, Methodology ve topology'nin birbirinden bağımsız seçimi;
- exact Authority ve monotonic host Permission sınırları;
- bounded Mission runtime projection, durable context artifactları, TypeScript Semantic Context ve evidence-backed project methodology learning;
- lazy Methodology/skill discovery ve loading;
- structured Evidence, VerificationEnvelope ve deterministic completion;
- bounded recovery, WAIT ve authoritative STOP;
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
- **Browser execution:** Hi-owned ve runtime-health-gated yüzeyde supported. BrowserObservation veya screenshot otomatik Evidence/PASS değildir.
- **HumanDecision:** chat transport supported. Deterministic structured OpenCode question-opening UI transport, accepted host API gerekli public opener'ı sağlamadığı için unsupported'dır.
- **Semantic Context:** explicit first-class adapter yalnız TypeScript/TSX destekler. JavaScript, LSP ve Tree-sitter semantic adapter desteği ilan edilmez.

Exact host version/platform/architecture ve receipt bağlantıları için [Host Support](../../HOSTS.md) kullanın.

## Kurulum ve ilk kullanım

OpenCode-Hi'nin normal kullanıcı yolu npm-registry-first'tür. `0.2.2` adayı için tek seferlik Node package-runner kullanılır; repository checkout, Bun, harici Python, proje köküne `npm install`, proje `package.json`/lock veya kalıcı root `node_modules` gerekmez.

### npm registry — normal kullanıcı yolu

Exact release'i projeye bağımlılık olarak kurmak yerine package-runner ile kaydedin:

```bash
npx --yes opencode-hi@0.2.2 setup /path/to/project
```

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

Package lifecycle ile yüklü OpenCode runtime yüzeyi ayrıdır. Normal package komutları `setup`, `update`, `doctor`, `plan`, `rollback`, `recover` şeklindedir. `install`, `setup` alias'ıdır; `upgrade`, `update` alias'ıdır.

- `setup`: ilk exact Hi-owned registration/provenance kaydını oluşturur.
- `update`: Hi'nin sahip olduğu kaydı hedef exact sürüme taşır.
- `doctor`: registration, ownership, drift ve pending lifecycle state'i statik olarak kontrol eder.
- `plan`: değişikliği uygulamadan exact before/after planını gösterir.
- `rollback`: hash'ler hâlâ eşleşiyorsa tek kayıtlı rollback noktasını geri alır.
- `recover`: yalnız kayıtlı yarım setup/update transaction'ını uzlaştırır.

Plugin yüklendikten sonra **31 adet `hi_*` runtime tool** vardır. Kullanıcıya en yakın durum/diagnostic araçları `hi_doctor`, `hi_status`, `hi_readiness`, `hi_metrics` ve `hi_ledger`'dır; diğerleri task/worker, process, browser, context artifact, temporary mutation ve semantic control için bounded primitive'lerdir.

Bu sürümde `hi_state`, `hi_rotate` veya `hi_reprofile` diye bir komut/tool **yoktur**. Canlı Mission state için `hi_status` / `hi_readiness` / `hi_ledger`; kurulum ownership state için package `doctor` kullanılır.

Normal kurulum bugün tam interaktif wizard değildir. Akış bilinçli olarak deterministic'tir:

```text
setup -> OpenCode restart -> package doctor -> runtime hi_doctor
```

Kurulum sırasında provider/model/profile/concurrency seçim ekranı açılmaz. Provider authentication/configuration OpenCode-owned kalır. Hi, ilk effective runtime inventory geldiğinde yalnız gerçekten effective-enabled ve role-eligible child modelleri rank eder, ilk önerileri bir kez yazar; kullanıcı daha sonra bu routing'i değiştirebilir ve sonraki update/refresh geçerli tercihi ezmez. Gelişmiş `reconfigure` / `role-models` işlemleri legacy Python helper'dadır ve normal npm onboarding için zorunlu değildir.

`0.2.2` source tree şu anda pre-publication candidate'dır. npm registry publication ve fresh-registry T4 receipt oluşmadan public availability ilan edilmez.

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
