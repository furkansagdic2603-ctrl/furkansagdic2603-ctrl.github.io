# Yönetim paneli dosya yapısı

`index.html`, önce zengin metin düzenleyicisi `editor.js` dosyasını, sonra `panel.js` ES modülü giriş noktasını yükler. `panel.js`, aşağıdaki modülleri başlatır:

| Modül | Görev |
| --- | --- |
| `modules/auth.js` | Oturum ve Supabase Edge Function çağrıları |
| `modules/categories.js` | Kategorilerin yüklenmesi ve yeni kategori ekleme |
| `modules/articles.js` | Yazı arama, açma, yayımlama, düzenleme ve silme |
| `modules/comments.js` | Yorumları listeleme, arama ve silme |
| `modules/stats.js` | Ziyaret istatistiklerini gösterme |
| `modules/theme.js` | Site renklerini yükleme ve kaydetme |
| `modules/images.js` | Editöre görsel yükleme |

Modüller yalnızca ihtiyaç duydukları DOM erişimini, `callAdmin` işlevini ve diğer bağımlılıkları giriş noktasından alır. Yeni panel özelliklerini ilgili modüle ekleyin. `supabase/functions/site-admin/index.ts` mevcut Supabase Dashboard yayımlama yöntemiyle uyumlu tek giriş dosyası olarak durur.
