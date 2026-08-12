---
name: hhc-test-strategy
description: Değişikliğe göre minimum yeterli deterministik doğrulama seçimi.
---

# Test Stratejisi

Önce değişikliği doğrudan kanıtlayan en dar deterministik kontrolü seç; başarısızlık veya etki alanı gerektirirse kapsamı genişlet.

- Hata düzeltmesi: yeniden üretim/regresyon testi + ilgili mevcut testler.
- Yeni davranış: hedef test + etkilenmiş entegrasyon.
- Yeniden düzenleme: davranışı koruyan mevcut testler.
- Arayüz: fonksiyonel kontrol + gerçekten gerekiyorsa farklı ekran boyutlarına uyum/tarayıcı doğrulaması.
- Güvenlik: ilgili pozitif/negatif senaryolar.
- Kurulum: temiz kurulum + tekrar kurulum.

Çalıştırılmayan testi `PASS` sayma. Aynı şeyi ikinci LLM görüşüyle tekrar doğrulatma.
