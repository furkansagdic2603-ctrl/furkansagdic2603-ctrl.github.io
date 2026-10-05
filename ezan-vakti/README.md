# Ezan Vakti merkezi güncellemeleri

Canlı ayar dosyası: https://furkansagdic.com.tr/ezan-vakti/config.json

Bu dosyayı değiştirip `revision` değerini bir artırarak yeni ayarları yayımla. Telefonlarda 1.2 veya sonraki APK gerekir. Aynı sürümde sadece başlık, alt başlık, duyuru, renkler, desteklenen görsel ve takvim verisi değişebilir; yeni Android/Widget kodu eklenemez.

- `schemaVersion`: 1; bu APK için değiştirme.
- `revision`: her yayında artan pozitif sayı. Eski bir görünümü geri almak için eski değerleri geri koyup revision'ı artır.
- `title`: en fazla 60 karakter.
- `tagline`: en fazla 160 karakter.
- `announcement`: en fazla 800 karakter; boşsa kart gizlenir.
- `bannerUrl`: boş olabilir veya sitenin HTTPS PNG/JPEG/WebP görsel URL'si. Dosya en fazla 2 MiB, genişlik/yükseklik en fazla 4096 piksel. SVG desteklenmez.
- `widgetAccent`: zümrüt widget'taki sıradaki vakit vurgusu; #RRGGBB.
- `light` ve `dark`: primary, foreground, muted, surface, background, hero renkleri; #RRGGBB. Kullanıcının otomatik/aydınlık/karanlık tercihi korunur.
- `calendarBundle`: sitedeki HTTPS vakitler.json URL'si veya boş değer. İndirme sınırı 8 MiB.

`vakitler.json`, APK'daki cache ile aynı veri biçimidir: her anahtar `month_ENLEM5_BOYLAM5_YYYY-MM`, örneğin `month_39.76650_30.54330_2026-10`. Ayın tüm günleri tarih sırasıyla ve eksiksiz bulunmalı; her gün date (YYYY-MM-DD), times (gece yarısından itibaren dakika, altı değer: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha), hijri alanı içerir. İmsak için Fajr kullanılır. Kaynak Aladhan Diyanet Türkiye yöntemi 13'tür. Takvim metnini/ayarları/görseli beraber değiştirip revision artır; geçersiz pakette telefondaki önceki ayarlar ve kayıtlar korunur.

İlk sunucu paketi sadece Eskişehir/Odunpazarı'nın Ekim 2026–Eylül 2027 kayıtlarını içerir. Diğer ilçeler kendi Aladhan kayıtlarını indirir. İleride başka ilçelerin kayıtları bu sunucu paketine eklenebilir; URL'nin sitene ait olması zorunludur. Bu statik sunucu Aladhan'ı tüm ilçeler için proxy'lemez. Vakit paketini yenilemek için yeni API verilerini aynı biçimde eklemek ve revision artırmak gerekir; paketin kendisi otomatik yeniden üretilmez.

Uygulama açılışta ve açıkken 60 saniyede bir kontrol eder. Arka planda JobScheduler yaklaşık 15 dakikalık aralıklarla kontrol eder; pil tasarrufu, bağlantı, zorla durdurma ve sistem planlaması gecikmeye yol açabilir. İnternet yokken son geçerli ayarlar/veriler kullanılır. Kullanıcı düğmeden hemen kontrol başlatabilir. GitHub Pages yayın/cache gecikmesi de olabilir. Tüm cihazların aynı anda güncellenmesi garanti edilmez.

Uzak dosyalar yalnızca veri olarak işlenir; JavaScript, HTML veya Android kodu çalıştırılmaz. HTTP, başka siteler ve şema değişiklikleri reddedilir.
