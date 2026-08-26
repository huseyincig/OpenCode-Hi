# 05-security-session-service

Bu klasörde çalışan fakat güvenlik açısından problemli küçük bir session/auth servisi var. İşlevselliği koruyarak güvenlik incelemesi ve düzeltmesi yap.

Kontrol et: password hashing, cookie ayarları, session fixation, CSRF gerektiren mutationlar, open redirect, reflected/stored XSS, SQL injection, secret/log sızıntısı ve auth gerektiren endpoint'ler.

Her şüpheli pattern'i otomatik bug sayma; exploit edilebilirliği veya gerçek kontrat ihlalini mekanik olarak doğrula. Gerçek defect'leri minimal ve kalıcı biçimde düzelt. Security-reviewer sonucu worker prose olarak değil gerçek test/HTTP kanıtıyla doğrulansın. README'ye yalnız kullanıcı için gerekli güvenlik/çalıştırma notlarını ekle. Secret değerlerini log/commit etme.
