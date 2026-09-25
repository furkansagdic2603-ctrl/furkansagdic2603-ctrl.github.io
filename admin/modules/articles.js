// Published article picker and create/edit/delete actions.
export function createArticles({ $, callAdmin, feedback }) {
  let articles = [];
  let editing = null;
  async function loadArticles() {
    const res = await fetch('/articles.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Yazı listesi yüklenemedi.');
    articles = (await res.json()).filter(item => item.url && ![
      '/kitap-notlari/felsefe/bir-birey-nasil-yasayabilir/',
      '/kitap-notlari/sinema/sinemanin-kokleri/'
    ].includes(item.url));
    filterArticles();
  }
  function filterArticles() {
    const query = $('article-search').value.trim().toLocaleLowerCase('tr');
    const list = $('article-list');
    list.replaceChildren(...articles.filter(item => item.title.toLocaleLowerCase('tr').includes(query)).map(item => new Option(`${item.title} — ${item.url}`, item.url)));
    $('article-status').textContent = `${list.options.length} yazı listeleniyor.`;
  }
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
  return { loadArticles, getArticles: () => articles };
}
