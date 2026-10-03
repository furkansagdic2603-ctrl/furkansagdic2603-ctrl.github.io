// Book information travels with the note through the existing publishing API.
export function createBookCovers({ $, callAdmin, feedback }) {
  let cover = '';
  let loading = false;
  function preview() {
    $('book-cover-preview').hidden = !cover;
    $('book-cover-preview').src = cover;
  }
  function load(article) {
    loading = true;
    const metadata = article?.querySelector('[data-book-title]');
    $('book-title').value = metadata?.dataset.bookTitle || '';
    $('book-author').value = metadata?.dataset.bookAuthor || '';
    cover = metadata?.dataset.bookCover || '';
    metadata?.remove(); preview(); loading = false; persist();
  }
  function persist() {
    if (!loading) localStorage.setItem('furkan-book-draft-v1', JSON.stringify({title:$('book-title').value,author:$('book-author').value,cover}));
  }
  try {
    const draft = JSON.parse(localStorage.getItem('furkan-book-draft-v1') || '{}');
    $('book-title').value = draft.title || ''; $('book-author').value = draft.author || '';
    cover = draft.cover || ''; preview();
  } catch {}
  $('book-title').addEventListener('input',persist);
  $('book-author').addEventListener('input',persist);
  const esc = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function body(content) {
    const title = $('book-title').value.trim();
    if (!title || !$('category').value.startsWith('kitap-notlari/felsefe')) return content;
    return `<div hidden data-book-title="${esc(title)}" data-book-author="${esc($('book-author').value.trim())}" data-book-cover="${esc(cover)}"></div>${content}`;
  }
  $('book-cover-file').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    if (file.size > 2*1024*1024 || !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) { feedback('JPEG, PNG, WebP veya GIF kapak seç; en fazla 2 MB.'); return; }
    $('publish').disabled = true;
    feedback('Kitap kapağı yükleniyor…');
    try {
      const data = await new Promise((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = () => reject(new Error('Kapak okunamadı.')); r.readAsDataURL(file); });
      const result = await callAdmin('upload_image', {filename:file.name,mime:file.type,data});
      cover = result.url; preview(); persist();
      feedback('Kapak yüklendi. Kitap adını girip yazıyı kaydet; aynı adlı bölümler tek kitapta toplanır.');
    } catch(err) { feedback(err.message); }
    finally { $('publish').disabled = false; }
  });
  $('book-cover-remove').onclick = () => { cover = ''; preview(); persist(); };
  const updateVisibility = () => { $('book-fields').hidden = !$('category').value.startsWith('kitap-notlari/felsefe'); };
  $('category').addEventListener('change',updateVisibility);
  document.addEventListener('admin:editor-open',updateVisibility);
  return {load,body,updateVisibility};
}
