# 08-context-restart-task-manager

Bu Python task-manager projesinde hata birden fazla modüle yayılıyor: tekrar eden görevlerin timezone hesaplaması yanlış, persistence reload sonrası bir edge-case kayboluyor ve CLI summary eski state'i gösterebiliyor.

Projeyi bounded şekilde incele, kontratları ve mevcut testleri kullan. Gereksiz tüm-repo context yükleme. Birden fazla bağımlı bulgu varsa context/artifact handoff'larını kullan. Çalışma sırasında sohbet/runtime continuation veya compaction/restart olursa aynı işi sıfırdan başlatmadan durable state üzerinden devam et.

Düzeltme sonrası focused unit/integration testler ve CLI smoke PASS olsun. Aynı failure için tekrarlı identical retry yapma.
