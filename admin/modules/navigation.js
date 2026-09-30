const screens = {
  overview: ['Genel bakış', 'Paneline hoş geldin. Yapmak istediğin işlemi seç.'],
  articles: ['Yazılar', 'Yayımlanmış yazılarını bul, aç ve düzenle.'],
  editor: ['Yazı editörü', 'Yazını hazırla, biçimlendir ve yayımla.'],
  categories: ['Kategoriler', 'Ana ve alt kategorilerini tek yerden yönet.'],
  media: ['Görseller', 'İktibas / Alıntılar bölümüne fotoğraf ekle.'],
  comments: ['Yorumlar', 'Okuyucuların yorumlarını incele ve yönet.'],
  stats: ['İstatistikler', 'Okunma sayılarını ve öne çıkan yazıları gör.'],
  appearance: ['Görünüm', 'Ana sayfa tasarımını ve site renklerini düzenle.']
};

export function initNavigation() {
  const byId = id => document.getElementById(id);
  function showView(key, focus = true) {
    if (!screens[key]) return;
    document.querySelectorAll('[data-view]').forEach(view => { view.hidden = view.dataset.view !== key; });
    document.querySelectorAll('[data-admin-view]').forEach(button => {
      if (button.dataset.adminView === key) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    byId('admin-page-title').textContent = screens[key][0];
    byId('admin-page-description').textContent = screens[key][1];
    byId('admin-breadcrumb').textContent = screens[key][0].toLocaleUpperCase('tr');
    if (focus) {
      byId('admin-page-title').setAttribute('tabindex', '-1');
      byId('admin-page-title').focus({ preventScroll: true });
      byId('admin-page-title').scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }
  document.querySelectorAll('[data-admin-view], [data-admin-go]').forEach(button => {
    button.addEventListener('click', () => showView(button.dataset.adminView || button.dataset.adminGo));
  });
  document.querySelectorAll('[data-admin-new]').forEach(button => {
    button.addEventListener('click', () => byId('new-article').click());
  });
  document.addEventListener('admin:editor-open', () => showView('editor'));
  document.addEventListener('admin:article-deleted', () => showView('articles'));
  function updateCounts() {
    byId('admin-article-count').textContent = byId('article-list').options.length;
    byId('admin-category-count').textContent = byId('category').options.length;
  }
  showView('overview', false);
  return { showView, updateCounts };
}
