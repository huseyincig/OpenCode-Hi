# OpenCode-Hi

[English README](README.md)

OpenCode-Hi, OpenCode üzerinde kanıta duyarlı yapay zekâ yazılım mühendisliği için **semantik ve yürütme kontrol düzlemidir**. Hi; Mission, Task, Worker, Role, Methodology, Authority, Evidence, Verification, recovery ve completion anlamlarını sahiplenir. OpenCode ise session, model/provider, tool, permission, PTY, workspace ve diğer native host primitive’lerini çalıştıran ana hosttur.

Temel kural:

> **Hi ürün semantiğine karar verir; OpenCode doğru native primitive’i çalıştırır.**

Hi mümkün olan en fazla agent/token/araç yerine iş için **minimum yeterli** topology, model, context ve verification kullanmayı hedefler.

## Güncel ürün gerçeği

Source tree uygulama sürümünü `0.1.0` olarak bildiriyor. Sürümün canonical sahibi `VERSION` dosyasıdır ve package metadata ile parity doğrulanır. Bu, güncel development HEAD’in daha önce yayımlanmış immutable GitHub `v0.1.0` source’u ile aynı olduğu anlamına gelmez.

GitHub `v0.1.0` release’i source-bound ve immutable’dır. npm bootstrap ise henüz tamamlanmadı; `opencode-hi@0.1.0` şu anda npm registry’den alınabilir durumda değildir. Bu nedenle aşağıdaki package registration mekanikleri, bugün public npm download yolunun açık olduğuna dair kanıt değildir.

Mutable release durumu `data/validation/release-status-0.1.0.json`, host/capability durumu ise `data/validation/compatibility-matrix-0.1.0.json` tarafından üretilir.

## Ne sağlar?

OpenCode-Hi şunları ekler:

- tek canonical Mission/Task/Worker ownership modeli;
- direct, delegated ve bounded multi-agent execution;
- Role, model, Methodology ve topology’nin birbirinden bağımsız seçimi;
- exact Authority ve monotonic Permission sınırları;
- source-aware Context Governor, Project Intelligence ve TypeScript Semantic Context;
- lazy Methodology/skill discovery ve loading;
- structured Evidence, VerificationEnvelope ve deterministic completion;
- bounded recovery, WAIT ve authoritative STOP;
- exact-host kabulü olan Hi-owned process, isolated-workspace ve browser execution yüzeyleri;
- restart-safe lifecycle state;
- ownership-aware install/upgrade/reconfigure/uninstall/rollback/recovery.

Modelin “done” demesi, screenshot bulunması, skill’in kurulu olması veya host API’nin mevcut olması tek başına support/PASS/completion kanıtı değildir.

## Capability özeti

Canonical mutable support görünümü generated compatibility projection’dır:

- **Process lifecycle:** Hi-owned `ProcessContract` / `ProcessExecutor` yüzeyinde supported. PID-bound spawn, bounded IO, event-driven WAIT, timeout, kill, ayrı cleanup, restart adoption ve STOP reconciliation kapsanır. Genel native/model-facing bash otomatik olarak Hi ownership’a girmez.
- **Workspace isolation:** Hi-owned `IsolationDecision` / `WorkspaceLease` / `WorkspaceRuntime` zincirinde supported. Required isolation alternate workspace’e bağlanır; verification aynı lease içinde yürür; primary/user-dirty worktree korunur.
- **Browser execution:** Hi-owned ve runtime-health-gated yüzeyde supported. BrowserObservation veya screenshot otomatik Evidence/PASS değildir.
- **HumanDecision:** chat transport supported. Deterministic structured OpenCode question-opening UI transport, gerekli public host opener olmadığı için unsupported.
- **Semantic Context:** explicit first-class adapter yalnız TypeScript/TSX destekler; JavaScript/LSP/Tree-sitter semantic adapter desteği ilan edilmez.

Exact host version/platform/architecture ve receipt bağları için [Host Support](docs/HOSTS.md) kullanın.

## Kurulum durumu

Canonical package adı `opencode-hi` olmakla birlikte npm bootstrap publication açık değildir. Registry package oluşana kadar normal fresh-user npm kurulumu **mevcut gibi gösterilmez**.

Registry package mevcut olduğunda repository setup lifecycle exact package registration’ı user config’i ezmeden yönetebilir:

```bash
python3 scripts/native_plugin_setup.py plan /path/to/project --version <version>
python3 scripts/native_plugin_setup.py install /path/to/project --version <version>
python3 scripts/native_plugin_setup.py doctor /path/to/project
```

Source development için:

```bash
npm ci --prefix plugin
npm run build
```

OpenCode project-local plugin’leri `.opencode/plugins/` altında ve local/file loading mekanizmalarıyla destekler. Exact host version’ın desteklediği local loading yolunu kullanın; Git URL’yi npm package gibi varsaymayın.

Install/upgrade/reconfigure/uninstall/rollback/recover davranışı için [Installation](docs/INSTALLATION.md) belgesine bakın.

## Mimari ve güvenlik

`ROLE != AGENT != MODEL != METHODOLOGY != TASK != WORKER != TOPOLOGY`.

Permission ile Authority farklıdır. OpenCode Permission native action’ın çalışıp çalışamayacağını belirler; Hi Authority hassas/external action’ı exact action/target/parameter/scope’a bağlar. Hi host denial’ı genişletemez.

User’a ait dirty/staged/unrelated dosyalar user-owned kalır. Broad reset/stash/checkout/restore veya `git add -A` güvenli ownership shortcut’ı değildir.

Evidence de prose’dan farklıdır. Worker/model çıktısı, Context, Project Intelligence, Methodology içeriği veya BrowserObservation ikna edici görünse bile otomatik Evidence olmaz. Completion ancak current obligation ve fresh admissible proof deterministic olarak uzlaştığında kapanır.

## Methodologies ve OpenCode skills

Hi 27 built-in `hi-*` Methodology paketler. Methodology reusable **HOW**’dur; OpenCode skill ise ana hostta methodology içeriğini discover/load eden native primitive’dir. Installed skill, admitted Methodology, selected Methodology ve loaded Methodology aynı şey değildir.

## Geliştirme ve doğrulama

Repository root’tan:

```bash
npm run check
python -m pytest -q tests/test_hi.py
python scripts/validate.py
```

Fresh test count dokümana elle yazılmaz; command output onun sahibidir. Host-bound claim T3, gerçek external publication claim T4 evidence gerektirir.

Canonical davranış dokümantasyonu [English README](README.md) ve onun bağladığı İngilizce product docs’tur. Bu Türkçe çeviri yeni davranış tanımlamaz veya İngilizce canonical truth’u genişletmez.

## Lisans

Apache-2.0. Üçüncü taraf attribution/source-reuse sınırları `THIRD_PARTY_NOTICES.md` ve [Source Reuse Matrix](docs/SOURCE-REUSE-MATRIX.md) içinde tutulur.
