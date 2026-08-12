# Güvenlik

- HHC API anahtarı veya sağlayıcı kimlik bilgisini saklamaz.
- Uzak Git erişiminde mevcut Git/SSH/Credential Manager yapılandırmasını kullanır; etkileşimli kimlik bilgisi toplamaz.
- Kullanıcı istemeden push, tag, publish veya release yapılmaz.
- Ajan izinleri role göre sınırlıdır; inceleyici roller salt okunurdur.
- MCP varsayılan olarak kurulmaz veya etkinleştirilmez.
- Mevcut proje dosyalarının üzerine `--force` verilmeden yazılmaz.

Güvenlik açığı bildirirken gizli bilgi veya özel kod deposu içeriğini paylaşmayın.
- Skill erişimi `data/skill-policy.json` ile role göre exact allowlist üretilerek sınırlandırılır; skill gövdeleri ihtiyaç olmadan context'e yüklenmez.
- Primary agent güvenli/geri alınabilir kararları kullanıcı beklemeden verebilir; credential/MFA, yeni ücretli harcama, destructive dış etki ve release/publish/push kullanıcı kapısında kalır.
- Global updater release manifesti + SHA-256 doğrulamasına ek olarak ZIP path traversal/symlink girdilerini de reddeder.
## WordPress external skill pilotu

HHC, yalnız proje WordPress olarak algılandığında resmi `WordPress/agent-skills` kaynağından seçili skill klasörlerini project-local `.agents/skills/` altına indirebilir. Upstream arşiv **kod olarak çalıştırılmaz**: HHC arşiv boyutu/dosya sayısı/extracted-size sınırlarını uygular, path traversal ve symlink girdilerini reddeder, beklenen skill adı ile `SKILL.md` frontmatter `name` alanını eşleştirir ve yalnız allowlist'teki klasörleri çıkarır. Var olan aynı adlı skill dizinleri üzerine yazılmaz.

Bu skill'lerin içindeki yardımcı script'ler yalnız dosya olarak gelir; HHC kurulum aşamasında bunları yürütmez. Sonraki agent çalıştırmaları yine ilgili rolün normal bash/permission politikasına tabidir. WordPress skill indirmesi `--wordpress-skills disabled` ile kapatılabilir.

Pilot kaynak `trunk` branch'ini izler; bu kaynak değişkendir. HHC indirilen ZIP'in SHA-256 değerini proje state'ine kaydeder, fakat bunu sabit upstream sürüm garantisi olarak yorumlamaz. Sıkı yeniden üretilebilirlik gereken projelerde WordPress skill auto-acquisition kapatılabilir veya ekip kendi project-local skill snapshot'ını yönetebilir.

WPCS/PHPCS HHC tarafından yüklenmez veya Composer dependency'si değiştirilmez; yalnız projede mevcut araç/config varsa read-only verification komutu olarak keşfedilir.

