---
name: hhc-ci-build-recovery
description: CI/build başarısızlığını yerel fark, pipeline ve deterministik kanıtla daraltma.
---

# CI / Build Kurtarma

İlk gerçek başarısız adımı ve exit code'u bul; downstream gürültüyü takip etme. Local/CI runtime, environment, cache, path, dependency ve command farkını ayır. Pipeline'ı gevşeterek yeşile çevirme; root cause'u düzelt. Secret/credential gerektiren adımda USER_ACTION_REQUIRED dön; bağımsız yerel doğrulamaları sürdür.
