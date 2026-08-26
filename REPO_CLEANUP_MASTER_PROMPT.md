# OpenCode-Hi — Repository Simplification + Governance Regeneration Master Prompt

Önce `/workspace/PROTOCOL.md` dosyasını oku ve eksiksiz uygula.

`PROJECT_ROOT=/workspace/OpenCode-Hi`

Bu çalışma yeni özellik programı değildir. Amaç mevcut davranışı koruyarak repository'yi, test yapısını ve proje governance dosyalarını sade, tutarlı ve uzun ömürlü hale getirmektir.

## Ana hedef

Aşağıdakileri TEK program olarak ele al:

1. repository-wide dosya/klasör sadeleştirme,
2. özellikle `plugin/test/` test konsolidasyonu,
3. stale milestone/faz/deney isimlerinin temizlenmesi,
4. duplicate/obsolete test ve artefactların kaldırılması,
5. source/generated/dist ownership netliği,
6. canonical 11 role parity audit + repair,
7. `/workspace/PROTOCOL.md` esas alınarak `AGENTS.md`, `PROJECT_POLICY.md`, `TASKS.md` governance katmanının yeniden normalize edilmesi,
8. legacy project-local `PROTOCOL.md` içeriğinin gerekli proje-özel kısımlarını AGENTS/PROJECT_POLICY'ye taşıyıp global protokolle çakışan/tekrarlayan kısmı kaldırma kararı,
9. geçici çalışma dosyalarının ve tarihsel test-program kalıntılarının temizlenmesi,
10. mevcut ürün davranışını regression ile koruma.

## Başlangıç gerçeği

Önce sohbeti otorite kabul etmeden mekanik reconcile yap:

- Git branch / HEAD / origin / status
- tracked / ignored / untracked durum
- repo tree ve dosya sayıları
- `plugin/src`, `plugin/test`, `tests`, `scripts`, `data`, `docs`, `roles`, `skills`
- generated/dist zinciri
- package/build/test entrypointleri
- `.agent-work/reference/` corpus yapısı
- aktif process/lock/runtime kalıntısı
- mevcut `AGENTS.md`, `PROJECT_POLICY.md`, `TASKS.md`, legacy project `PROTOCOL.md`

Mevcut clean rollback tree'nin `667fe7422ce09bcbd101ed0e95cbae120a0ace7a` ürün ağacına eşdeğer olduğu varsayımını mekanik doğrula; eşleşmiyorsa farkı açıklamadan ilerleme.

## Değiştirilemez ürün ilkeleri

- Çözülmüş problemi yeniden icat etme.
- Davranışı sadeleştirme bahanesiyle düşürme.
- Security/authority/evidence/completion invariants'ı sessizce silme.
- Test sayısını azaltmak hedef değildir; duplicate ve tarihsel örgüyü kaldırmak hedeftir.
- Bir regression'ın tek kanıtı olan testi silme; önce canonical suite'e taşı.
- Generated/dist dosyasını source-of-truth sanma; generator zincirini doğrula.
- Yeni framework, dependency veya ikinci orchestration sistemi ekleme.
- W acceptance harness'i veya eski W programını geri getirme.
- ROADMAP oluşturma; kullanıcı ayrıca istemedikçe yalnız TASKS aktif state taşısın.
- Release/tag/npm publish yapma.

## 1. Repository inventory ve classification

Tüm tracked dosyaları domain bazında sınıflandır:

`KEEP | MERGE | RENAME | DELETE | GENERATED | HISTORICAL-ONLY`

Özellikle şunları bul:

- eski milestone isimleri (`mXX-*`, `phase*`, `prompt-b-*`, `q*`, `a*`, `w*`, `main-prompt-*` vb.)
- aynı davranışı tekrar tekrar test eden dosyalar
- dead compatibility wrappers
- stale scripts
- stale validation receipts
- artık consumer'ı olmayan generated artefactlar
- docs/source/config arasında eski hardcode/list/count kalıntıları
- repo dışında tutulması gereken runtime/temp/log/certification artefactları

README seviyesinde karar verme; gerçek import/caller/consumer/test chain'i kontrol et.

## 2. Test sadeleştirme

`plugin/test/` özellikle kapsamlı şekilde ele alınacak.

Hedef kalıcı semantik yapı:

```text
plugin/test/
  unit/
    config/
    roles/
    routing/
    mission/
    task/
    evidence/
    completion/
    scheduler/
    liveness/
    permissions/
    browser/
    process/
  integration/
    opencode/
    runtime/
    persistence/
    process/
  adversarial/
  acceptance/
  fixtures/
```

Bu exact dizinler kör zorunluluk değildir; repo gerçeğine göre minimum temiz varyantını kullan.

Kurallar:

- tarihsel faz adı yerine davranış adı kullan,
- duplicate testleri birleştir,
- shared fixture/helper gerçekten tekrar azaltıyorsa çıkar,
- tek devasa mega-test oluşturma,
- focused test çalıştırılabilirliği korunmalı,
- package test runner tüm yeni konumları doğru keşfetmeli,
- test rename/move sonrası import/path references güncellenmeli.

Her silinen test için şu soruyu mekanik cevapla:

`Bu invariant başka canonical testte gerçekten korunuyor mu?`

Cevap kanıtlanamıyorsa silme.

## 3. Source tree sadeleştirme

`plugin/src/` için:

- canonical owner başına mümkün olduğunca tek implementation chain,
- duplicate helper/adapter/policy owner'larını kaldır,
- source → generated → dist zincirini netleştir,
- barrel/export karmaşası varsa minimum hale getir,
- dead code ve unreachable compatibility kodunu caller kanıtıyla kaldır,
- dosya birleştirme yalnız cohesion artıyorsa yap; büyük god-file üretme.

Amaç dosya sayısını yapay biçimde azaltmak değil; ownership ve navigasyonu sadeleştirmektir.

## 4. Canonical role parity audit

Toplam canonical roller:

Primary:
- manager
- working-manager

Child:
- coder
- architect
- repository-explorer
- researcher
- technical-writer
- test-engineer
- qa-reviewer
- security-reviewer
- visual-qa

Her rol için şu zinciri uçtan uca doğrula:

canonical role definition
→ permission profile
→ generated role policy
→ generated agent config
→ semantic capabilities
→ capability routing
→ minimum-team selection
→ task admission/dispatch
→ model resolver/category
→ role model settings/schema
→ hi_settings / compatibility surfaces
→ CLI/setup/install/config
→ mutation guards
→ fallback/recovery/reuse
→ validation/generator scripts
→ tests
→ EN docs
→ TR docs

Eski `6 child role`, `six`, sabit allowlist/count/switch/case kalıntılarını repo-wide ara.

`researcher`, `technical-writer`, `test-engineer` dahil 9 child role her ilgili consumer surface'te gerçekten desteklenmeden role-parity COMPLETE deme.

Role category ile role ownership'i karıştırma. Coder universal fallback değildir.

## 5. Governance regeneration

Global otorite `/workspace/PROTOCOL.md`.

Mevcut `AGENTS.md`, `PROJECT_POLICY.md`, `TASKS.md`, project-local `PROTOCOL.md` dosyalarını tarihsel input olarak oku fakat kör merge etme.

Repository/runtime gerçeğinden yeniden normalize et:

### AGENTS.md
Yalnız stabil teknik profil:
- stack/runtime/platform
- package/build/test komutları
- repo yapısı
- canonical role modeli ve uzmanlıklar
- çalışma araçları/komut tercihleri
- generated/dist/test layout gerçekliği

### PROJECT_POLICY.md
Yalnız stabil mühendislik invariantları:
- architecture ownership
- security/authority boundaries
- role/capability ownership
- evidence/completion semantics
- reference-first koşulları
- model/provider ownership
- temp/reference/runtime state politikası
- Git/release/package kuralları
- generated source policy

### TASKS.md
Yalnız bu aktif cleanup programı:
- active task
- status
- acceptance criteria
- blockers
- last mechanical evidence
- exact next action

Tamamlanmış tarihçeyi TASKS'e doldurma.

### Legacy project-local PROTOCOL.md
Global `/workspace/PROTOCOL.md` ile karşılaştır.

- proje-özel ve hâlâ geçerli maddeleri AGENTS/PROJECT_POLICY'ye taşı,
- global protokolü tekrar eden/stale maddeleri taşıma,
- artık gerekli değilse project-local `PROTOCOL.md` kaldırılabilir,
- ancak önce tüm benzersiz geçerli proje kuralının yeni governance dosyalarında mekanik olarak temsil edildiğini doğrula.

## 6. Reference workspace

`.agent-work/reference/` tek reference corpus kökü olarak kalacak.

Beklenen üst yapı:

```text
.agent-work/reference/
  repos/
  research/
  audits/
  benchmarks/
  corpus/
```

Buraya aktif run/tmp/log/test output atma.

Referans repo ve kalıcı research dışında gereksiz artefact üretme.

## 7. İşleme biçimi

Büyük-bang silme yapma.

Her mantıksal batch:

1. exact inventory
2. dependency/caller check
3. classification
4. minimum coherent change
5. changed files re-read
6. import/caller/consumer check
7. focused tests
8. broader regression
9. git diff --check
10. status / ownership check
11. coherent commit
12. gerekiyorsa push
13. TASKS exact next action update

Bir batch yarıda kalırsa yarım rename/move bırakma.

## 8. Test ve verification standardı

Sadeleştirme sonunda en az:

- build PASS
- typecheck/lint varsa PASS
- complete product test suite PASS
- Python validation suite varsa PASS
- docs validation PASS
- generator idempotence/parity PASS
- package/install smoke PASS
- role parity targeted tests PASS
- no stale path/import references
- no duplicate milestone-only test naming unless gerçekten anlamlı historical compatibility contract
- `git diff --check` PASS
- working tree clean

Test sayısı düşebilir; coverage/invariant gücü düşemez.

## 9. Completion criteria

Program ancak şu durumda tamamlanmış sayılır:

- repo navigasyonu domain/ownership üzerinden anlaşılır,
- `plugin/test` tarihsel milestone çöplüğü olmaktan çıkmış,
- duplicate/obsolete tests kaldırılmış veya canonical suite'e taşınmış,
- source ownership zincirleri sade,
- canonical 11 role parity eksiksiz,
- AGENTS/PROJECT_POLICY repo gerçeğinden yeniden üretilmiş ve stale değil,
- TASKS kısa ve yalnız aktif state,
- legacy project-local PROTOCOL gereksizse güvenle kaldırılmış,
- `.agent-work` yalnız reference corpus için temiz,
- full regression PASS,
- clean Git state,
- release yapılmamış.

## 10. Continuation davranışı

Her yeni continuation turn'ünde bu dosyayı tekrar oku:

`/workspace/OpenCode-Hi/REPO_CLEANUP_MASTER_PROMPT.md`

Sonra `/workspace/PROTOCOL.md`, TASKS ve repo/Git gerçeğini reconcile et.

Önceki sohbet cevabından değil TASKS + Git + filesystem + mechanical evidence'dan devam et.

Takıldığında veya context dolduğunda TASKS'i exact next action ile güncelle ve coherent checkpoint bırak.

Şimdi inventory/classification ile başla; önce test/source/governance gerçeğini çıkar, sonra en düşük riskli ve en yüksek temizlik getirili batch'ten uygulamaya geç.