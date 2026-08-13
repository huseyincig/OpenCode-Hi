# OpenCode-Hi

**Sürüm: 0.1.0** · [English README](README.md)

OpenCode-Hi, OpenCode üzerinde yapay zekâ destekli yazılım mühendisliği için kanıta duyarlı, uyarlanabilir yürütme ve Hybrid Intelligence kontrol düzlemidir. Hi; yürütme yolunu, rolü, skill’i, model/araç politikasını, bağlam ve izolasyon derinliğini, doğrulama gereksinimlerini, yetki kapılarını, devam kararını, tamamlanmayı ve deterministik STOP kararını yönetir. Session, agent, provider/model, permission, tool, diff ve event gibi native runtime primitive’leri OpenCode’a aittir.

Ana ilke: **minimum yeterli hesaplama, maksimum ilgili muhakeme**. Bir capability’nin mevcut olması onun etkinleştirileceği anlamına gelmez.

## Kurulum

Project-local yapılandırma `<project-root>/opencode.json` dosyasındadır. Dosya varsa ilgisiz ayarları silmeden plugin kaydını birleştirin; yoksa oluşturun.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "opencode-hi@git+https://github.com/huseyincig/OpenCode-Hi.git#<EXACT-REF>"
  ]
}
```

Plugin kaydı değiştiğinde OpenCode’u yeniden başlatın. 0.1.0 için garanti edilen nihai kurulum sözdizimi, exact candidate gerçek OpenCode resolver ile doğrulanana kadar release gate altında kalır.

```bash
python scripts/native_plugin_setup.py install /path/to/project --ref <EXACT-REF>
python scripts/native_plugin_setup.py doctor /path/to/project
python scripts/native_plugin_setup.py reconfigure /path/to/project --primary-mode manager --parallel-max 2
python scripts/native_plugin_setup.py uninstall /path/to/project
```

Helper yalnız Hi-owned registration alanını yönetir ve kullanıcıya ait ilgisiz plugin/MCP/config kayıtlarını korur.

## Uyarlanabilir yürütme

Altı eksen birbirinden ayrıdır: **rol, methodology, model/araç, execution depth, context depth, isolation depth**. Yürütme yolları `DIRECT`, `EVIDENCE`, `PLANNED`, `ESCALATED`’dır. Açık ve düşük riskli lokal işte varsayılan yol assess → execute → targeted verify → STOP’tur; gerekli değilse planner, reviewer, memory, broad scan, ikinci model veya child agent kullanılmaz.

Topology adaptive/single-agent/multi-agent modlarını destekler. Açık task override → project policy → Hi adaptive selection → host/provider default önceliği geçerlidir. Host permission denial hiçbir zaman aşılmaz.

## Methodologies ve OpenCode skills

**27 built-in `hi-*` methodology** paketlenir. Varsayılan aktif methodology sayısı **0**’dır; normal iş 0–1 methodology kullanır ve hard bound 3’tür. OpenCode ana hostunda seçilen methodology içeriği native `skill` primitive’i ile lazy-load edilir. OpenCode-visible bir skill otomatik olarak Hi-selectable methodology değildir. Methodology’ler HOW taşır; routing, model selection, agent spawning, topology, authority, continuation, completion veya STOP sahibi değildir.

## Bağlam, gizlilik ve insan kararı

Mission survival state kritik görev durumunu context pressure altında korur. Context Governor protected/compressible/purgeable ayrımı yapar. Project Intelligence kanıta ve freshness durumuna bağlıdır. Semantic Context minimum yeterli TypeScript contract bilgisini çıkarır. Provider’a giden task promptları Privacy Boundary’den geçer. Opsiyonel memory retrieval’a yardım edebilir ama verification yerine geçmez.

Düşük riskli, geri alınabilir project-local seçimlerde gereksiz soru sorulmaz. Contract-critical belirsizlik, credential/MFA/OAuth, ücretli harcama, geri döndürülemez dış etki ve publish/deploy/push/release gerçek kullanıcı yetkisi gerektirir. Genel “continue” komutu privileged action onayı değildir.

## Geliştirme ve doğrulama

```bash
cd plugin
npm ci
npm test
cd ..
python -m pytest -q tests/test_hi.py
python scripts/validate.py
```

OpenCode 0.1.0 desteği ancak exact candidate external version-matrix ve clean-consumer runtime gate’inden geçince ilan edilir. Lokal PASS external runtime PASS gibi sunulmaz.

Mimari ayrıntıları için [English README](README.md) içindeki dokümantasyon bağlantılarını kullanın. Canonical davranış dokümantasyonu `README.md`’dir; bu çeviri yeni davranış tanımlamaz.

## Lisans

Apache-2.0. Üçüncü taraf attribution ve source-reuse kararları `THIRD_PARTY_NOTICES.md` ve `docs/SOURCE-REUSE-MATRIX.md` içinde kayıtlıdır.
