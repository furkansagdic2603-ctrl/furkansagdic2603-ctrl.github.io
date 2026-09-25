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
  const escapeAttribute = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let editing = null;
  let articles = [];
  let managedComments = [];
  let commentOffset = 0;

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
  async function loadArticles() {
    const res = await fetch('/articles.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Yazı listesi yüklenemedi.');
    articles = (await res.json()).filter(item => item.url && ![
      '/kitap-notlari/felsefe/bir-birey-nasil-yasayabilir/',
      '/kitap-notlari/sinema/sinemanin-kokleri/'
    ].includes(item.url));
    filterArticles();
  }
  function renderComments() {
    const query = $('comment-search').value.trim().toLocaleLowerCase('tr');
    const visible = managedComments.filter(item => `${item.first_name} ${item.last_name} ${item.body} ${item.page_path}`.toLocaleLowerCase('tr').includes(query));
    const container = $('comment-admin-list');
    container.replaceChildren();
    for (const item of visible) {
      const row = document.createElement('article'); row.className = 'comment-admin-item';
      const header = document.createElement('header');
      const name = document.createElement('strong'); name.textContent = `${item.first_name} ${item.last_name}`;
      const time = document.createElement('time'); time.dateTime = item.created_at; time.textContent = new Date(item.created_at).toLocaleString('tr-TR');
      header.append(name, time);
      const body = document.createElement('p'); body.textContent = item.body;
      const page = document.createElement('a');
      const article = articles.find(entry => entry.url === item.page_path);
      page.href = /^\/[a-z0-9/-]+\/$/.test(item.page_path) ? item.page_path : '/arsiv/';
      page.textContent = article ? `Yazı: ${article.title} →` : `Yazı: ${item.page_path} →`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Yorumu sil';
      remove.addEventListener('click', async () => {
        if (prompt(`“${item.first_name} ${item.last_name}” yorumunu silmek için SİL yaz:`) !== 'SİL') return;
        remove.disabled = true;
        try {
          await callAdmin('delete_comment', { id: item.id });
          managedComments = managedComments.filter(comment => comment.id !== item.id);
          renderComments();
          $('comment-admin-status').textContent = 'Yorum silindi.';
        } catch (err) { $('comment-admin-status').textContent = err.message; remove.disabled = false; }
      });
      row.append(header, body, page, document.createTextNode(' '), remove);
      container.append(row);
    }
    if (!visible.length) container.textContent = query ? 'Eşleşen yorum yok.' : 'Henüz yorum yok.';
    $('comment-admin-status').textContent = `${visible.length} yorum gösteriliyor (${managedComments.length} yorum yüklendi).`;
  }
  async function fetchComments(reset = false) {
    if (reset) { commentOffset = 0; managedComments = []; }
    $('comment-admin-status').textContent = 'Yorumlar yükleniyor…';
    const data = await callAdmin('list_comments', { offset: commentOffset });
    managedComments.push(...data.comments);
    commentOffset += data.comments.length;
    $('more-comments').hidden = data.comments.length < 100;
    renderComments();
  }
  async function fetchStats() {
    $('stats-status').textContent = 'İstatistikler yükleniyor…';
    const data = await callAdmin('stats');
    $('stats-summary').textContent = `Bugün ${data.today} · Son 30 gün ${data.total} sayfa görüntüleme${data.truncated ? ' (ilk 10.000 kayıt)' : ''}`;
    const daily = new Map(data.daily);
    const max = Math.max(1, ...daily.values());
    const chart = $('stats-chart'); chart.replaceChildren();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
      const count = daily.get(date) || 0;
      const bar = document.createElement('div'); bar.className = 'stats-bar';
      bar.title = `${date}: ${count} görüntüleme`;
      bar.style.height = `${Math.max(3, count / max * 100)}%`;
      chart.append(bar);
    }
    const top = $('stats-top'); top.replaceChildren();
    for (const [path, count] of data.top) {
      const row = document.createElement('li');
      const link = document.createElement('a'); link.href = /^\/[a-z0-9/-]*$/.test(path) ? path : '/';
      link.textContent = articles.find(article => article.url === path)?.title || path;
      row.append(link, ` — ${count}`); top.append(row);
    }
    $('stats-status').textContent = 'Sayfa görüntülemeleri; ziyaretçi kimliği tutulmaz. Sayfa başına oturumda bir kez sayılır.';
  }
  function filterArticles() {
    const query = $('article-search').value.trim().toLocaleLowerCase('tr');
    const list = $('article-list');
    list.replaceChildren(...articles.filter(item => item.title.toLocaleLowerCase('tr').includes(query)).map(item => new Option(`${item.title} — ${item.url}`, item.url)));
    $('article-status').textContent = `${list.options.length} yazı listeleniyor.`;
  }
  async function showPanel() {
    await callAdmin('whoami');
    try {
      const themeRes = await fetch('/data/theme.json', { cache: 'no-store' });
      const theme = themeRes.ok ? await themeRes.json() : {};
      $('theme-accent').value = theme.accent || '#8b3d2e';
      $('theme-paper').value = theme.paper || '#faf8f3';
      $('theme-ink').value = theme.ink || '#22221e';
    } catch { /* First visit or unavailable theme file: use the built-in palette. */ }
    await loadCategories();
    await loadArticles();
    $('admin-login').hidden = true;
    $('admin-panel').hidden = false;
    fetchComments(true).catch(err => { $('comment-admin-status').textContent = err.message; });
    fetchStats().catch(err => { $('stats-status').textContent = err.message; });
  }
  $('refresh-stats').addEventListener('click', () => fetchStats().catch(err => { $('stats-status').textContent = err.message; }));
  $('generate-audio').addEventListener('click', async () => {
    if (!editing) return;
    const button = $('generate-audio'); button.disabled = true;
    try {
      for (let index = 0; ; index++) {
        $('audio-status').textContent = `Ses hazırlanıyor: ${index + 1}. parça…`;
        const result = await callAdmin('generate_audio_chunk', { path: editing.path, index });
        $('audio-status').textContent = `${index + 1}/${result.total} parça hazır${result.cached ? ' (önceden oluşturulmuş)' : ''}.`;
        if (result.ready) break;
      }
      $('audio-status').textContent = 'Yapay zekâ seslendirmesi hazır. Yazı sayfasını yenileyerek dinleyebilirsin.';
    } catch (err) { $('audio-status').textContent = err.message; }
    finally { button.disabled = !editing; }
  });
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
  $('comment-search').addEventListener('input', renderComments);
  $('refresh-comments').addEventListener('click', () => fetchComments(true).catch(err => { $('comment-admin-status').textContent = err.message; }));
  $('more-comments').addEventListener('click', () => fetchComments().catch(err => { $('comment-admin-status').textContent = err.message; }));
  $('save-theme').addEventListener('click', async () => {
    const button = $('save-theme'); button.disabled = true;
    $('theme-feedback').textContent = 'Renkler kaydediliyor…';
    try {
      await callAdmin('save_theme', { theme: {
        accent: $('theme-accent').value,
        paper: $('theme-paper').value,
        ink: $('theme-ink').value
      }});
      $('theme-feedback').textContent = 'Renkler kaydedildi. Sitede görünmesi birkaç dakika sürebilir.';
    } catch (err) { $('theme-feedback').textContent = err.message; }
    finally { button.disabled = false; }
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
  let imageRange = null;
  const rememberSelection = () => {
    const selection = getSelection();
    if (selection.rangeCount && $('editor').contains(selection.anchorNode)) imageRange = selection.getRangeAt(0).cloneRange();
  };
  $('editor').addEventListener('mouseup', rememberSelection);
  $('editor').addEventListener('keyup', rememberSelection);
  $('image-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    if (file.size > 2 * 1024 * 1024) { feedback('Görsel en fazla 2 MB olabilir.'); return; }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) { feedback('JPEG, PNG, GIF veya WebP görsel seç.'); return; }
    const button = $('image'); button.disabled = true; feedback('Görsel yükleniyor…');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Görsel okunamadı.'));
        reader.readAsDataURL(file);
      });
      const result = await callAdmin('upload_image', { filename: file.name, mime: file.type, data: dataUrl.split(',')[1] });
      $('editor').focus();
      if (imageRange && $('editor').contains(imageRange.commonAncestorContainer)) {
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(imageRange);
      }
      const alt = prompt('Görsel açıklaması (isteğe bağlı):') || '';
      document.execCommand('insertHTML', false, `<img src="${result.url}" alt="${escapeAttribute(alt)}">`);
      $('editor').dispatchEvent(new Event('input'));
      feedback('Görsel eklendi. Yazıyı kaydettiğinde sitede görünür.');
    } catch (err) { feedback(err.message); }
    finally { button.disabled = false; imageRange = null; }
  });
  $('article-search').addEventListener('input', filterArticles);
  function resetEditor() {
    editing = null;
    $('title').value = '';
    $('description').value = '';
    $('editor').innerHTML = '';
    $('category').disabled = false;
    $('editor-heading').textContent = 'Yeni yazı';
    $('publish').textContent = 'Yayımla';
    $('edit-note').hidden = true;
    $('delete-article').disabled = true;
    $('generate-audio').disabled = true;
    $('audio-status').textContent = '';
    $('delete-article').textContent = 'Yazıyı sil (önce aç)';
    localStorage.removeItem('furkan-editor-draft-v1');
  }
  $('new-article').addEventListener('click', () => {
    if (($('title').value || $('editor').textContent.trim()) && !confirm('Editördeki yazıyı kapatıp yeni yazı açmak istiyor musun?')) return;
    resetEditor();
    feedback('Yeni yazı açıldı.');
  });
  $('delete-article').addEventListener('click', async () => {
    if (!editing) return;
    const current = articles.find(item => editing.path === item.url.replace(/^\//, '') + 'index.html');
    const name = $('title').value.trim();
    if (prompt(`“${name}” yazısını kalıcı olarak silmek için SİL yaz:`) !== 'SİL') return;
    const button = $('delete-article'); button.disabled = true;
    $('article-status').textContent = 'Yazı siliniyor…';
    try {
      await callAdmin('delete_article', { path: editing.path, sha: editing.sha });
      articles = articles.filter(item => item !== current);
      resetEditor();
      filterArticles();
      $('article-status').textContent = `“${name}” silindi. Site listelerinin güncellenmesi birkaç dakika sürebilir.`;
      feedback('Yazı silindi.');
    } catch (err) { $('article-status').textContent = err.message; }
    finally { button.disabled = !editing; }
  });
  $('open-article').addEventListener('click', async () => {
    const url = $('article-list').value;
    if (!url) { $('article-status').textContent = 'Önce listeden bir yazı seç.'; return; }
    if (($('title').value || $('editor').textContent.trim()) && !confirm('Editördeki mevcut yazıyı kapatıp seçili yazıyı açmak istiyor musun?')) return;
    const button = $('open-article'); button.disabled = true;
    $('article-status').textContent = 'Yazı açılıyor…';
    try {
      const path = url.replace(/^\//, '') + 'index.html';
      const data = await callAdmin('load_article', { path });
      const page = new DOMParser().parseFromString(data.content, 'text/html');
      const article = page.querySelector('article.yazi-icerik');
      const title = page.querySelector('.article-head h1');
      if (!article || !title) throw new Error('Bu sayfa düzenlenebilen bir yazı değil.');
      const category = article.dataset.category || Array.from($('category').options).map(option => option.value).filter(value => path.startsWith(value + '/')).sort((a, b) => b.length - a.length)[0];
      if (!category) throw new Error('Yazının kategorisi bulunamadı.');
      editing = { path, sha: data.sha };
      $('category').value = category;
      $('category').disabled = false;
      $('title').value = title.textContent.trim();
      $('description').value = page.querySelector('meta[name="description"]')?.content || '';
      $('editor').innerHTML = article.innerHTML;
      $('editor-heading').textContent = 'Yazıyı düzenle';
      $('publish').textContent = 'Değişiklikleri kaydet';
      $('edit-note').hidden = false;
      $('delete-article').disabled = false;
      $('generate-audio').disabled = false;
      $('audio-status').textContent = 'Bu yazıyı yapay zekâ ile seslendirebilirsin.';
      $('delete-article').textContent = 'Bu yazıyı sil';
      $('article-status').textContent = 'Yazı açıldı; değiştirip kaydedebilirsin.';
      $('editor-heading').scrollIntoView({ behavior: 'smooth' });
    } catch (err) { $('article-status').textContent = err.message; }
    finally { button.disabled = false; }
  });
  $('publish').addEventListener('click', async () => {
    const title = $('title').value.trim(), body = $('editor').innerHTML.trim();
    if (!title || !$('editor').textContent.trim()) { feedback('Başlık ve yazı içeriği gerekli.'); return; }
    const category = $('category').value;
    const description = $('description').value.trim() || $('editor').textContent.trim().slice(0, 160);
    const button = $('publish'); button.disabled = true; feedback(editing ? 'Değişiklikler kaydediliyor…' : 'Yayımlanıyor…');
    try {
      const result = editing
        ? await callAdmin('update_article', { title, description, body, category, path: editing.path, sha: editing.sha })
        : await callAdmin('publish', { title, description, category, body });
      if (editing) editing.sha = result.sha;
      const link = document.createElement('a'); link.href = result.url; link.textContent = 'Yazıyı aç →';
      $('feedback').replaceChildren(editing ? 'Değişiklikler kaydedildi. Sitede görünmesi birkaç dakika sürebilir. ' : 'Yazı kaydedildi. Sitede görünmesi birkaç dakika sürebilir. ', link);
    } catch (err) { feedback(err.message); }
    finally { button.disabled = false; }
  });
  if (session) showPanel().catch(err => { session = null; sessionStorage.removeItem(authKey); $('login-feedback').textContent = err.message; });
})();
