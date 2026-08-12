---
name: hhc-task-classification
description: Belirsiz/çok adımlı/riskli görevde minimum ekip ve doğrulama seçimi.
---

# Görev Sınıflandırma ve Yönlendirme

Amaç: **yeterli güveni sağlayan en küçük çalışma seti**. Görevi ilk kez sınıflandır; yeni maddi bulgu kapsam/risk/bağımlılık/uzmanlık ihtiyacını değiştirmedikçe tekrar sınıflandırma veya planı yeniden yazma.

1. Amaç + gözlenebilir kabul ölçütünü belirle.
2. Kararı değiştirmeyecek bilinmeyeni araştırma; maddi bilinmeyeni önce mevcut bağlam/kod/config/docs/tests/tool ile doğrula, hâlâ gerekliyse sor.
3. Ağır repo keşfi, mimari karar, uygulama, QA, güvenlik veya görsel QA gerçekten gerekiyor mu?
4. Test/build/lint/diff veya OpenCode LSP diagnostic yeterliyse ikinci LLM doğrulaması ekleme.
5. Geri dönüşü zor/dış etkili işlemde kullanıcı onayını belirle.
6. OAuth/device login, MFA, izin/onay/credential gerekirse alt ajan beklemesin/retry etmesin; `USER_ACTION_REQUIRED` dönsün.

## Minimum yönlendirme

Çalışma profili ajan kadrosu değildir; minimum setle başla, yalnız yeni bulguda genişlet.

- `repository-explorer`: kapsam belirsiz/çok alanlıysa, ilişki haritası gerekiyorsa veya keşif ana context’i ciddi büyütecekse; aksi durumda native Task rehberini izle.
- `architect`: alt sistem, sözleşme/API, veri modeli/şema, geçiş, büyük bağımlılık veya mimari sınır değişiyorsa.
- `coder`: ayrı uygulama işi devredilecekse.
- `qa-reviewer`: anlamlı davranış/regresyon veya bağımsız yorum gerekiyorsa; typo gibi deterministik küçük değişiklikte zorunlu değildir.
- `security-reviewer`: auth/authz, izin, secret, girdi, DB/dosya mutasyonu, upload, ağ, dependency, serialization, crypto, production/release veya remote execution etkileniyorsa.
- `visual-qa`: UI/CSS/layout/responsive/DOM/template veya görsel etkileşim değişiyorsa.

## Döngü ve handoff

Specialist dönüşünü tekrar özetleme. Child kabul ölçütü + deterministik kanıtı sağlıyorsa yeni review turu açma. Retry yalnız **yeni bilgi veya gerçek ilerleme** sağlayacak yeni hipotez/kanıt/farklı strateji varsa. Review kaynaklı `FIX_REQUIRED` için ilk iki hedefli tur mümkünse aynı implementer `task_id` ile; ardından gerçek ilerleme ihtimali varsa yalnız bir fresh/farklı-strateji uygulama turu; sonrasında açık load-bearing bulgular adjudicate edilir ve gerekiyorsa `BLOCKED` olur. Yeni finding sayaç sıfırlamaz. `USER_ACTION_REQUIRED`/auth/MFA/permission/confirmation → **WAIT_FOR_USER**; otomatik retry etme. OpenCode `doom_loop` korumasını aşma. Handoff kısa olsun; ham büyük çıktı yerine kritik bulgu + kanıt/referans taşı. **Bağlam taşıma; referans taşı.**
