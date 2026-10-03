// Connect an article/note to a previously created book.
export function createBookCovers({ $, feedback }) {
  let books = [];
  let selectedId = '';
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function fetchBooks() {
    try {
      const res = await fetch('/data/site-books.json', { cache: 'no-store' });
      books = res.ok ? await res.json() : [];
    } catch { books = []; }
    render();
  }
  function currentCategory() { return $('category').value || ''; }
  function relevantBooks() {
    const category = currentCategory();
    if (!category.startsWith('kitap-notlari/')) return [];
    return books.filter(book => book.category === category || category.startsWith(book.category + '/') || book.category.startsWith(category + '/'));
  }
  function renderSelected() {
    const book = books.find(item => item.id === selectedId);
    $('book-id').value = selectedId;
    $('book-note-selected').hidden = !book;
    if (!book) return;
    $('book-note-title').textContent = book.title || '';
    $('book-note-author').textContent = book.author || '';
    const cover = $('book-note-cover');
    cover.replaceChildren();
    cover.dataset.fallback = book.fallback || 'burgundy';
    if (book.cover) {
      const img = document.createElement('img');
      img.src = book.cover + '?v=' + encodeURIComponent(book.createdAt || '1');
      img.alt = book.title + ' kapağı';
      img.loading = 'eager';
      img.addEventListener('error', () => { img.remove(); cover.textContent = book.title || 'Kitap'; });
      cover.append(img);
    } else cover.textContent = book.title || 'Kitap';
  }
  function select(id) {
    selectedId = id || '';
    render();
    renderSelected();
    localStorage.setItem('furkan-book-note-id-v1', selectedId);
  }
  function render() {
    const list = relevantBooks();
    const grid = $('book-note-grid');
    grid.replaceChildren(...list.map(book => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'book-note-choice';
      button.dataset.bookId = book.id;
      if (book.id === selectedId) button.classList.add('is-selected');
      const cover = document.createElement('span'); cover.className = 'book-note-choice-cover';
      cover.dataset.fallback = book.fallback || 'burgundy';
      if (book.cover) {
        const img = document.createElement('img');
        img.src = book.cover + '?v=' + encodeURIComponent(book.createdAt || '1');
        img.alt = book.title + ' kapağı'; img.loading = 'eager';
        img.addEventListener('error', () => { img.remove(); cover.textContent = book.title || 'Kitap'; });
        cover.append(img);
      } else cover.textContent = book.title || 'Kitap';
      const text = document.createElement('span'); text.className = 'book-note-choice-text';
      const strong = document.createElement('strong'); strong.textContent = book.title || 'İsimsiz kitap';
      const small = document.createElement('small'); small.textContent = book.author || 'Yazar belirtilmemiş';
      text.append(strong, small); button.append(cover, text);
      button.addEventListener('click', () => select(book.id));
      return button;
    }));
    $('book-note-empty').hidden = list.length > 0;
    if (selectedId && !list.some(book => book.id === selectedId)) selectedId = '';
    renderSelected();
  }
  function load(article) {
    const metadata = article?.querySelector('[data-book-id], [data-book-title]');
    selectedId = metadata?.dataset.bookId || '';
    if (!selectedId && metadata?.dataset.bookTitle) {
      const title = metadata.dataset.bookTitle;
      selectedId = books.find(book => book.title === title)?.id || '';
    }
    metadata?.remove();
    render(); renderSelected();
  }
  function body(content) {
    if (!currentCategory().startsWith('kitap-notlari/')) return content;
    const book = books.find(item => item.id === selectedId);
    if (!book) throw new Error('Bu notun ait olduğu kitabı seç.');
    return `<div hidden data-book-id="${esc(book.id)}" data-book-title="${esc(book.title)}" data-book-author="${esc(book.author)}" data-book-cover="${esc(book.cover)}"></div>${content}`;
  }
  const updateVisibility = () => {
    $('book-fields').hidden = !currentCategory().startsWith('kitap-notlari/');
    render();
  };
  $('category').addEventListener('change', updateVisibility);
  document.addEventListener('admin:editor-open', () => { fetchBooks(); updateVisibility(); });
  fetchBooks();
  return { load, body, updateVisibility, fetchBooks };
}
