# 04-broken-dashboard

Mevcut responsive dashboard fixture'ını incele ve çalışan/erişilebilir hale getir.

Bilinen kullanıcı şikayetleri: mobilde kartlar taşıyor, filtre sonrası sayaç yanlış, modal klavye ile düzgün kapanmıyor, dark-mode tercihi yenilemede kayboluyor ve bazı butonların accessible name'i yok.

İstenen:
- Kök nedenleri bul ve mevcut mimariyi gereksiz yeniden yazmadan düzelt.
- Masaüstü + mobil viewportlarda gerçek browser testi yap.
- Filtre, modal focus/ESC, tema persistence ve yeniden yükleme akışlarını doğrula.
- Erişilebilirlik açısından keyboard navigation, labels/names ve focus görünürlüğünü kontrol et.
- Görsel regression yaratma; visual-qa kullan.
- Değişiklikleri fixture dışına taşırma.
