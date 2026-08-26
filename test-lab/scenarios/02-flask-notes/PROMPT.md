# 02-flask-notes

Python Flask ve SQLite ile tek proje klasöründe çalışan bir Kişisel Not Defteri geliştir.

UI: not ekleme (başlık, içerik, kategori), en yeniden eskiye listeleme, başlık/kategori anlık filtreleme, düzenleme ve onaylı silme.
API: GET /notes, POST /notes, PUT /notes/<id>, DELETE /notes/<id>.
Veri: id,title,content,category,created_date; migration framework zorunlu değil.
Frontend: tek embedded HTML/CSS/JS şablonu, responsive.
Güvenlik: parametreli SQL/ORM, ekrana basılan kullanıcı içeriğinde XSS koruması, beklenmeyen input için düzgün 4xx.
Çalıştırma: requirements.txt ve tek komut. README kurulum/kullanım anlatsın.
Doğrulama: uygulamayı gerçekten ayağa kaldır; ekle/listele/düzenle/filtrele/sil akışını ve en az bir XSS/SQLi negatif testini çalıştır. Browser ile UI davranışını da kontrol et. Karşılaşılan gerçek hataları kök nedenleriyle düzelt.
