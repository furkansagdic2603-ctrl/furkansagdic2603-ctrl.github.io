(() => {
  const section = document.querySelector('.comments');
  if (!section) return;
  const config = window.COMMENTS_CONFIG;
  if (!config?.url || !config?.publishableKey) return;
  const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/site_comments`;
  const headers = { apikey: config.publishableKey, 'Content-Type': 'application/json' };
  const list = document.getElementById('comments-list');
  const form = document.getElementById('comment-form');
  const status = document.getElementById('comment-status');
  const path = location.pathname.replace(/\/?$/, '/');
  section.hidden = false;
  form.hidden = false;

  async function load() {
    list.textContent = 'Yorumlar yükleniyor…';
    const params = new URLSearchParams({ select: 'first_name,last_name,body,created_at', page_path: `eq.${path}`, order: 'created_at.asc', limit: '100' });
    try {
      const response = await fetch(`${endpoint}?${params}`, { headers });
      if (!response.ok) throw new Error('load failed');
      const comments = await response.json();
      list.replaceChildren();
      if (!comments.length) { list.textContent = 'Henüz yorum yok. İlk yorumu sen yazabilirsin.'; return; }
      for (const item of comments) {
        const article = document.createElement('article');
        article.className = 'comment';
        const name = document.createElement('strong');
        name.textContent = `${item.first_name} ${item.last_name}`;
        const time = document.createElement('time');
        time.dateTime = item.created_at;
        time.textContent = new Date(item.created_at).toLocaleDateString('tr-TR');
        const body = document.createElement('p');
        body.textContent = item.body;
        article.append(name, time, body);
        list.append(article);
      }
    } catch { list.textContent = 'Yorumlar şu anda yüklenemiyor.'; }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    if (String(data.get('website') || '').trim()) return;
    const first_name = String(data.get('first_name') || '').trim();
    const last_name = String(data.get('last_name') || '').trim();
    const body = String(data.get('body') || '').trim();
    if (!first_name || !last_name || !body) { status.textContent = 'Ad, soyad ve yorumunu doldur.'; return; }
    const button = form.querySelector('button');
    button.disabled = true;
    status.textContent = 'Yorum gönderiliyor…';
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ page_path: path, first_name, last_name, body }) });
      if (!response.ok) throw new Error('send failed');
      form.reset();
      status.textContent = 'Yorumun alındı. Onaylandıktan sonra burada görünecek.';
    } catch { status.textContent = 'Yorum gönderilemedi. Lütfen tekrar dene.'; }
    finally { button.disabled = false; }
  });
  load();
})();
