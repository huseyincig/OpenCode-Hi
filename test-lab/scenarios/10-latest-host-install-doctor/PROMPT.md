# 10-latest-host-install-doctor

Tamamen fresh sandbox proje oluştur. O anda mevcut güncel stable OpenCode sürümünü kullan; repo içindeki eski pin'i live host diye zorlamaya çalışma.

OpenCode-Hi'yi gerçek paket/Git kurulumu üzerinden projeye ekle. Setup/config/doctor akışını çalıştır. Test-only model allowlist'ini kullan; main ve child execution bu havuzun dışına çıkmasın. Primary role model ownership ile child role model routing ayrımını koru.

Kontrol et: clean install, idempotent setup/update, effective plugin registration, duplicate registration detection, model inventory görünürlüğü, role configuration, doctor çıktısı, basit bir child delegation ve plugin restart sonrası state. Güncel OpenCode host API davranışı repo pin'inden farklıysa upstream source'a bakıp kalıcı adapter çözümü üret; testi eski host'a düşürerek kaçma. Release/tag/npm publish yapma.
