Önce `/workspace/PROTOCOL.md` dosyasını oku ve eksiksiz uygula.

PROJECT_ROOT=/workspace/OpenCode-Hi
TEST_MASTER=/workspace/OpenCode-Hi/test-lab/MASTER_TEST_PROGRAM.md

`AGENTS.md`, `PROJECT_POLICY.md`, `TASKS.md`, `test-lab/MASTER_TEST_PROGRAM.md`, `test-lab/STATE.json` ve varsa aktif run içindeki `RUN_STATE.json` dosyasını oku. SentinelX audit, Git, filesystem, OpenCode/runtime process ve model inventory gerçeğini reconcile et.

Önceki sohbeti otorite kabul etme. ACTIVE bir test/run varsa yeniden başlatma; `exact_next_action` noktasından devam et. Canlı process/session varsa doğrulamadan yenisini başlatma. Tamamlanmış testi gereksiz yere tekrar koşma.

Failure varsa blind patch/retry yapma: gerçek failure kanıtını al, sınıflandır, tek root-cause hipotezi kur, internal contract chain'i incele, ilgili güncel reference/upstream implementasyonlarını tara, Hi'ye özgü coherent kalıcı çözüm üret, sonra focused verification + ilgili scenario rerun yap. Noktalama seviyesinde edit sonrası test koşma; coherent batch bitmeden rerun yapma.

Test model havuzu yalnız `test-lab/config/model-pool.json` içindeki efektif allowlist'tir; bunu ürün koduna hardcode etme. Live OpenCode stable sürümünü kullan; eski pin'e test host'u diye zorlanma.

Her coherent batch sonrası `RUN_STATE.json` + `test-lab/STATE.json` + `TASKS.md` status/last evidence/exact next action'ı güncelle. Test dosyalarını ve runtime artifactlerini `test-lab/` dışına dağıtma. Program bitene kadar yeni test/certification programı başlatma.

Şimdi kaldığın exact noktadan devam et.
