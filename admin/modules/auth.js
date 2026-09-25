// Authentication and the sole API gateway for admin actions.
export function createAuth(config) {
  const base = config.url.replace(/\/$/, '');
  const key = config.publishableKey;
  const authKey = 'furkan-admin-session';
  let session;
  try { session = JSON.parse(sessionStorage.getItem(authKey) || 'null'); } catch { session = null; }
  const authHeaders = () => ({ apikey: key, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' });
  async function refreshSession() {
    if (!session?.refresh_token) throw new Error('Oturum süresi doldu. Yeniden giriş yap.');
    if (Date.now() < session.expires_at - 60000) return;
    const res = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
    if (!res.ok) throw new Error('Oturum süresi doldu. Yeniden giriş yap.');
    const data = await res.json();
    session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + data.expires_in * 1000 };
    sessionStorage.setItem(authKey, JSON.stringify(session));
  }
  async function callAdmin(action, payload = {}) {
    const body = JSON.stringify({ action, ...payload });
    const bytes = new TextEncoder().encode(body).length;
    if (bytes > 4 * 1024 * 1024) throw new Error(`Yazı ${(bytes / 1024 / 1024).toFixed(1)} MB. Üst sınır 4 MB; görselleri bağlantı olarak ekle veya yazıyı bölümlere ayır.`);
    await refreshSession();
    let res;
    try {
      res = await fetch(`${base}/functions/v1/site-admin`, { method: 'POST', headers: authHeaders(), body });
    } catch {
      throw new Error(`Supabase bağlantısı kurulamadı (${(bytes / 1024).toFixed(0)} KB gönderiliyor). Bağlantını kontrol edip tekrar dene; yazı panelde duruyor.`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'İşlem tamamlanamadı.');
    return data;
  }
  return {
    get signedIn() { return !!session; },
    clear() { session = null; sessionStorage.removeItem(authKey); },
    async signIn(email, password) {
      const res = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) });
      if (!res.ok) throw new Error('E-posta veya şifre hatalı.');
      const data = await res.json();
      session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + data.expires_in * 1000 };
      sessionStorage.setItem(authKey, JSON.stringify(session));
    },
    callAdmin,
  };
}
