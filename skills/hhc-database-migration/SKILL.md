---
name: hhc-database-migration
description: Şema, migration, backfill ve veri bütünlüğü değişikliklerinde güvenli uygulama akışı.
---

# Veritabanı / Migration

Mevcut şema ve gerçek veri akışını doğrula. Migration sırası, nullable/default/backfill, transaction/locking, geri uyumluluk, rollback ve büyük veri hacmi risklerini kapsam kadar değerlendir. Destructive veya production migration'ı kullanıcı onayı olmadan çalıştırma. Uygulama ile şema geçişinin birlikte çalışacağı ara durumu hesaba kat.
