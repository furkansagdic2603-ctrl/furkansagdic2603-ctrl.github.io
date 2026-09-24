(() => {
  const cfg = window.COMMENTS_CONFIG;
  const $ = id => document.getElementById(id);
  const base = cfg.url.replace(/\/$/, '');
  const key = cfg.publishableKey;
  const authKey = 'furkan-admin-session';
  let session;
  try { session = JSON.parse(sessionStorage.getItem(authKey) || 'null'); } catch { session = null; }
  const authHeaders = () => ({ apikey: key, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' });
  const feedback = message => { $('feedback').textContent = message; };
  const pathOf = item => `${item.parent ? item.parent + '/' : ''}${item.slug}`;

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
    await refreshSession();
    const res = await fetch(`${base}/functions/v1/site-admin`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action, ...payload }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'İşlem tamamlanamadı.');
    return data;
  }
  function renderCategories(categories, selected) {
    const select = $('category');
    const parentSelect = $('category-parent');
    const previous = selected || JSON.parse(localStorage.getItem('furkan-editor-draft-v1') || '{}').category || select.value;
    const previousParent = parentSelect.value;
    const names = new Map(categories.map(item => [pathOf(item), item.name]));
    const options = categories.map(item => {
      const option = document.createElement('option');
      option.value = pathOf(item);
      option.textContent = option.value.split('/').map((part, i, parts) => names.get(parts.slice(0, i + 1).join('/')) || part).join(' → ');
      return option;
    });
    select.replaceChildren(...options.map(option => option.cloneNode(true)));
    parentSelect.replaceChildren(new Option('Ana kategori', ''), ...options.filter(option => option.value.split('/').length < 4));
    if (names.has(previous)) select.value = previous;
    if (names.has(previousParent)) parentSelect.value = previousParent;
  }
  async function loadCategories() {
    const res = await fetch('/data/categories.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Kategoriler yüklenemedi.');
    renderCategories(await res.json());
  }
  async function showPanel() {
    await callAdmin('whoami');
    await loadCategories();
    $('admin-login').hidden = true;
    $('admin-panel').hidden = false;
  }
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    $('login-feedback').textContent = 'Giriş yapılıyor…';
    try {
      const res = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.elements.namedItem('email').value.trim(), password: form.elements.namedItem('password').value }) });
      if (!res.ok) throw new Error('E-posta veya şifre hatalı.');
      const data = await res.json();
      session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + data.expires_in * 1000 };
      sessionStorage.setItem(authKey, JSON.stringify(session));
      form.elements.namedItem('password').value = '';
      await showPanel();
      $('login-feedback').textContent = '';
    } catch (err) { $('login-feedback').textContent = err.message; }
    finally { button.disabled = false; }
  });
  $('logout').addEventListener('click', () => {
    session = null; sessionStorage.removeItem(authKey);
    $('admin-panel').hidden = true; $('admin-login').hidden = false;
  });
  $('add-category').addEventListener('click', async () => {
    const name = $('new-category').value.trim();
    if (!name) { feedback('Kategori adı yaz.'); return; }
    const button = $('add-category'); button.disabled = true; feedback('Kategori ekleniyor…');
    try {
      const result = await callAdmin('add_category', { name, parent: $('category-parent').value });
      $('new-category').value = '';
      feedback(`“${name}” eklendi. Sitede görünmesi birkaç dakika sürebilir.`);
      renderCategories(result.categories, result.path);
    } catch (err) { feedback(err.message); }
    finally { button.disabled = false; }
  });
  $('publish').addEventListener('click', async () => {
    const title = $('title').value.trim(), body = $('editor').innerHTML.trim();
    if (!title || !$('editor').textContent.trim()) { feedback('Başlık ve yazı içeriği gerekli.'); return; }
    const category = $('category').value;
    const description = $('description').value.trim() || $('editor').textContent.trim().slice(0, 160);
    const button = $('publish'); button.disabled = true; feedback('Yayımlanıyor…');
    try {
      const result = await callAdmin('publish', { title, description, category, body });
      const link = document.createElement('a'); link.href = result.url; link.textContent = 'Yazıyı aç →';
      $('feedback').replaceChildren('Yazı kaydedildi. Sitede görünmesi birkaç dakika sürebilir. ', link);
    } catch (err) { feedback(err.message); }
    finally { button.disabled = false; }
  });
  if (session) showPanel().catch(err => { session = null; sessionStorage.removeItem(authKey); $('login-feedback').textContent = err.message; });
})();
