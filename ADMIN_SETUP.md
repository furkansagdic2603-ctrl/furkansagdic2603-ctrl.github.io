# Yönetim panelinin kurulumu

Bu değişiklik yayına alınmadan önce aşağıdaki kurulum gerekir. Yönetici şifresi ve GitHub anahtarı site koduna veya sohbete yazılmaz.

1. Supabase Dashboard → Authentication → Users bölümünde yalnızca kendi e-posta adresin için bir kullanıcı oluştur. E-posta doğrulanmış olmalı. Şifreyi kendin belirle.
2. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens bölümünde yalnızca `furkansagdic2603-ctrl.github.io` deposuna erişen bir anahtar oluştur. Repository permissions altında **Contents: Read and write** ver. Son kullanma tarihini seç ve yenilemek için kendine not koy.
3. Supabase Dashboard → Edge Functions → Secrets bölümüne iki sır ekle: `ADMIN_EMAIL` = 1. adımdaki e-posta; `GITHUB_TOKEN` = 2. adımdaki anahtar. Bunları `comments-config.js` dosyasına yazma.
4. Edge Functions → Create a new function bölümünde adı `site-admin` olsun. `supabase/functions/site-admin/index.ts` içeriğini yapıştırıp yayımla. İşlevin platform düzeyindeki eski **Verify JWT** ayarını kapat; işlev her çağrıda Supabase Auth `/user` üzerinden oturumu doğrular ve e-posta eşleşmesini zorunlu tutar.
5. Hazırlanmış yönetim paneli değişikliklerini yayımla. `/admin/` adresinden e-posta ve şifrenle giriş yap, önce yeni kategori, ardından kısa bir deneme yazısı yayımla. GitHub Actions yazı ve kategori sayfalarını oluşturur.

Panelin HTML ve JavaScript dosyaları herkese açık GitHub Pages dosyalarıdır. Şifre dosyaları gizlemez; yalnızca yayımlama işlemi Supabase işlevindeki oturum kontrolünden geçer. Yazı yayımlamak için ileride GitHub sitesine girmen gerekmez. Token süresi dolarsa 2. ve 3. adımları yenilemen gerekir.
