# 07-parallel-api-ui-docs

Fixture'da birbirinden büyük ölçüde bağımsız üç defect var: API pagination sınırı yanlış, UI empty-state filtre sonrası güncellenmiyor ve kullanım dokümanı mevcut CLI flag'i yanlış anlatıyor.

Önce dependency/mutable-surface ilişkisini çıkar. Adaptive veya Multi yürütmede gerçekten bağımsız işler güvenli paralel çalışabiliyorsa Hi'nin bunu kendisinin seçmesine izin ver; sırf çoklu ajan göstermek için fan-out yapma.

Her alt iş doğru specialist owner'a gitsin; fan-in sonunda davranışların birlikte bozulmadığını doğrula. Aynı dosyaya çakışan yazımları paralelleştirme. API testleri, browser UI akışı ve docs/CLI parity doğrulaması PASS olmalı.
