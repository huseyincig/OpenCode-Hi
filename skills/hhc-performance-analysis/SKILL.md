---
name: hhc-performance-analysis
description: Gerçek performans etkisini ölçüm, hot-path ve regresyon kanıtıyla değerlendirme.
---

# Performans Analizi

Önce ölçülebilir hedef veya regresyon belirtisi ara. Hot path, I/O, allocation, query sayısı, payload, concurrency veya cache davranışını görev kapsamıyla sınırlı incele. Ölçüm yoksa mikro-optimizasyon üretme. Değişikliğin correctness ve okunabilirlik maliyetini performans kazanımıyla karşılaştır; mümkünse önce/sonra aynı ölçümü kullan.
