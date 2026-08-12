---
name: hhc-changelog-and-documentation
description: Kullanıcıyı etkileyen davranış değişikliklerinde docs/changelog kontrolü.
---

# Değişiklik Günlüğü ve Dokümantasyon

Yalnız kullanıcıyı etkileyen davranış değişikliklerini belgele; refactor/cosmetic/internal rename gibi kullanıcı-görünür olmayan değişiklikleri atlama.

Kaynak kümeyi `git log <range> --oneline` (range: `from..to`, etiket/branch/hash) veya PR commit listesiyle çıkar; hangi commit'lerin kullanıcıya göründüğüne karar ver, hepsini körlemesine aktarma.

Kullanıcıyı etkileyen değişiklikleri sınıflandır ve madde başında açıkça etiketle: **breaking** (geri uyumsuz/veri/sözleşme/API), **security** (yetki/secret validasyonu), **behavior** (gözlemlenebilir davranış), **deprecation**. Etiketleri birbirine karıştırma; bir değişiklik birden fazlasını taşıyorsa birincil olanı seç.

Mevcut CHANGELOG stilini koru: `## X.Y.Z — Kısa Başlık` altında her bullet tek bir kullanıcı-görünür değişiklik, gereksiz TEKnik/PR/commit özeti değil. Kodla çelişen eski örnekleri ve duplikat başlıkları temizle. Değişiklik günlüğünü geliştirme/rehberlik günlüğüne veya her-commit loguna dönüştürme.
