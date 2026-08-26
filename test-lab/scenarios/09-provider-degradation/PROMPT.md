# 09-provider-degradation

Bu senaryoda amaç uygulama kodu üretmekten çok OpenCode-Hi'nin gerçek model/provider bozulmasına verdiği tepkiyi gözlemlemektir. Fresh küçük bir proje oluştur ve düşük riskli, doğrulanabilir bir coding görevi ver.

Test model allowlist'i yalnız `test-lab/config/model-pool.json` içindeki canlı erişilebilir kesişim olsun. Free modeller dahil. Test sırasında doğal olarak quota/rate-limit/unavailable oluşursa bunu ürün bug'ı diye yamalama; Hi'nin fallback/recovery davranışını incele. Gerekirse kontrollü olarak unavailable bir allowed candidate seçimiyle failure path'i tetikle, fakat ürün source'una model ismi hardcode etme.

PASS davranışı: eski execution gerçekten inflight ise duplicate mutation yok; terminal provider/model failure doğru sınıflanıyor; uygun başka allowed model varsa bounded recovery/fallback; havuz tükenirse açık blocker; reasoning-stall ile provider failure karışmıyor. Aynı görevin iki worker tarafından çifte yazılmadığını mekanik doğrula.
