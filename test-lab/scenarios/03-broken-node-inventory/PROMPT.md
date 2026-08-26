# 03-broken-node-inventory

Bu klasörde yarım bırakılmış bir Node.js envanter servisi var. Yeni bir proje yazmak yerine mevcut davranışı incele ve kök nedenleri düzelt.

Beklenenler:
- `npm test` içindeki gerçek hataları teşhis et.
- Ürün ekleme/listeleme/stok güncelleme/silme akışları deterministik çalışsın.
- Negatif stok ve boş SKU kabul edilmesin; duplicate SKU 409 dönsün.
- Veri dosyasına yazım atomik ve bozuk JSON'a karşı fail-closed olsun.
- API hata durumları doğru 4xx/5xx semantiği kullansın.
- README mevcut gerçek komutlarla uyumlu hale gelsin.
- Gereksiz dependency/refactor ekleme.

Önce failure mekanizmasını ve ownership chain'i anla; küçük küçük patch+rerun yapma. Sonunda targeted testler ve gerçek HTTP smoke akışı PASS olmalı.
