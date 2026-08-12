---
name: hhc-code-review
description: Anlamlı diffleri amaç, davranış ve risk açısından bağımsız inceleme.
---

# Kod İncelemesi

Kabul kriteri ve diff'ten başla. İlgili test kanıtını dikkate al; test/build sonucu zaten deterministik olarak doğrulanmışsa aynı sonucu yeniden tahmin etme. Hata yolları, sınır durumları, API/sözleşme değişiklikleri, yanlış abstraction, gereksiz karmaşıklık ve test boşluklarına odaklan. Şüphe varsa yalnız ilgili kaynak alanını genişlet. Bulguları dosya/satır veya sembol referansıyla ver.

## Scoped Re-review

Bir önceki review `FIX_REQUIRED` ürettiyse re-review bütün diff'i yeniden taramaz: açık finding ID'lerini, yalnız fix diff/range'ini ve covering test kanıtını doğrular. Her eski finding `RESOLVED` veya `OPEN` verdict alır. Fix'in doğrudan ürettiği yeni load-bearing regresyon eklenebilir; değişmeyen/ilgisiz koddan yeni scope açılmaz.

