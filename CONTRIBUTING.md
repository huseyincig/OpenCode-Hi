# Katkı

Değişiklikleri küçük tutun ve OpenCode'un yerleşik özelliklerini yeniden uygulamayın.

```bash
python scripts/validate.py
python -m pytest -q
```

Yeni rol/beceri/komut yalnız mevcut yapıyla çözülemeyen açık bir sorumluluk varsa eklenmelidir.

## Korunacak ürün sözleşmeleri

- Python çalışma zamanı **3.10+** olmalıdır.
- OpenCode native Task/skill/permission/compaction yüzeylerini yeniden uygulayan ikinci runtime eklemeyin.
- Basic/Standard/Powerful aynı role/skill capability havuzunu korur; yalnız çalışma eşiği/politikası değişir.
- Skill kullanımı varsayılan 0'dır; görünür skill listesi checklist değildir.
- Büyük repo keşfi parent context'i şişirmek yerine `repository-explorer` child contextinde kademeli yapılır; continuation için mümkünse aynı `task_id` kullanılır.
- External skill pilotu yalnız resmi `WordPress/agent-skills` içindir; kullanıcıya ait project-local skill'ler overwrite edilmez.
- Push/tag/publish/release ve yeni ücretli provider/spend kullanıcı onayı olmadan yapılmaz.

Release öncesi `VERSION`, preset `kit_version`, README envanteri ve `CHANGELOG.md` birlikte güncellenmelidir; `scripts/validate.py` bu sözleşmelerin bir bölümünü otomatik kontrol eder.
