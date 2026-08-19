# OpenCode-Hi

[English README](../../../README.md)

OpenCode-Hi, OpenCode üzerinde kanıta duyarlı yapay zekâ yazılım mühendisliği için **semantik ve yürütme kontrol düzlemidir**. Hi; Mission, Task, Worker, Role, Methodology, Authority, Evidence, Verification, recovery ve completion anlamlarını sahiplenir. OpenCode ise session, model/provider, tool, permission, PTY, workspace ve diğer native host primitive’lerini çalıştıran ana hosttur.

Temel kural:

> **Hi ürün semantiğine karar verir; OpenCode doğru native primitive’i çalıştırır.**

Hi, mümkün olan en fazla agent/token/araç yerine iş için **minimum yeterli** topology, model, context ve verification kullanmayı hedefler.

## Güncel ürün gerçeği

Bu checkout uygulama/package sürümü olarak `0.2.0`'yi izler. Sürüm kimliğinin canonical sahibi `VERSION` dosyasıdır ve package metadata ile parity doğrulanır. Bir sürümün gerçekten yayımlanmış olup olmadığı mutable external state'tir; bunun authoritative kaynakları GitHub Releases ve npm registry'dir. Tarihsel `v0.1.1` ve `v0.1.0` release artifact'leri immutable kalır.

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

OpenCode-Hi hem npm registry üzerinden hem de **doğrudan Git source** kullanılarak kurulabilir. Aşağıdaki Git/Bun local-plugin yolunda npm registry zorunlu değildir.

### Git source — npm registry gerektirmez

Exact OpenCode `1.18.18` için doğrulanmış Git-source yolu, OpenCode-Hi'yi OpenCode config dizini içinde Bun ile materialize edip local plugin wrapper üzerinden yüklemektir:

```bash
mkdir -p .opencode/plugins
cat > .opencode/package.json <<'JSON'
{
  "private": true,
  "dependencies": {
    "opencode-hi": "git+https://github.com/huseyincig/OpenCode-Hi.git#v0.2.0"
  }
}
JSON
cat > .opencode/plugins/opencode-hi.js <<'JS'
export { default } from "opencode-hi"
JS
(cd .opencode && bun install)
```

Kurulumdan sonra OpenCode'u yeniden başlatın. Bu yol public `v0.2.0` Git tag'i ile exact OpenCode `1.18.18` üzerinde acceptance-tested edildi: Git dependency başarıyla import edildi ve çalışan host güncel paketin beklediği `31` Hi tool ID'sini gördü.

Bazı OpenCode sürümleri veya package resolver konfigürasyonları `opencode.json` içinde doğrudan Git package spec kabul edebilir:

```json
{
  "plugin": [
    "opencode-hi@git+https://github.com/huseyincig/OpenCode-Hi.git"
  ]
}
```

Bu doğrudan biçim Git kullanıcılarının package spec'i açıkça görebilmesi için dokümante edilmiştir; ancak **OpenCode 1.18.18 üzerinde certified değildir**. Exact-host probe `1.18.18` üzerinde repository'yi fetch/resolve ederken native Git-plugin installer `git dep preparation failed` ile başarısız olur. Güncel stable OpenCode dokümantasyonu npm package ve local plugin yollarını garanti eder; Git package spec'i garanti etmez. `1.18.18` için yukarıdaki doğrulanmış Git/Bun local-wrapper yolunu kullanın.

### npm registry

Bu release'in exact registry kimliği `opencode-hi@0.2.0`'dir. Yayımlanan sürümler npm Trusted Publishing OIDC provenance kullanır ve recorded exact OpenCode host üzerinde acceptance ile doğrulanır.

Yeni bir proje repository checkout yapmadan exact package sürümünü kurabilir ve package içindeki setup CLI'ı kullanabilir:

```bash
npm install --save-dev opencode-hi@0.2.0
./node_modules/.bin/opencode-hi-setup plan /path/to/project --version 0.2.0
./node_modules/.bin/opencode-hi-setup install /path/to/project --version 0.2.0
./node_modules/.bin/opencode-hi-setup doctor /path/to/project
```

Registration/doctor ile runtime loading farklıdır. Published-release T4 evidence fresh-registry installation ve exact-host loading doğrulamasını içerir; güncel evidence ayrıntıları Release Engineering dokümanında tutulur.

### Source development

Source development için önce runtime build edilir:

```bash
npm ci --prefix plugin
npm run build
```

OpenCode accepted host üzerinde `.opencode/plugins/` ve local/file plugin loading mekanizmalarını destekler. Runtime verification plugin'in, Hi agent/tool/native skill yüzeyinin gerçekten yüklendiğini doğrulamalıdır.

Install/upgrade/reconfigure/doctor/uninstall/rollback/recovery davranışı için [Installation and Lifecycle](../../INSTALLATION.md) belgesine bakın.

## Configuration

Hi configuration current-only ve fail-closed'dur. Canonical machine inventory `data/hi-config-options.json` dosyasıdır. Her runtime option validator, precedence, consumer, executable effect, documentation ve test ile bağlı olmalıdır. Unknown veya stale config sessizce compatibility feature olarak kabul edilmez.

Ayrıntı için [Installation and Configuration](../../INSTALLATION.md) ve [Architecture](../../ARCHITECTURE.md#execution-policy) kullanın.

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
