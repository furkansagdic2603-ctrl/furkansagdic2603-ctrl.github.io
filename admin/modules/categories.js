// Category tree and category creation.
export function createCategories({ $, callAdmin, feedback }) {
  const pathOf = item => `${item.parent ? item.parent + '/' : ''}${item.slug}`;
  function renderCategories(categories, selected) {
    const select = $('category');
    const parentSelect = $('category-parent');
    const deleteSelect = $('delete-category');
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
    deleteSelect.replaceChildren(new Option('Silinecek kategoriyi seç', ''), ...options.map(option => option.cloneNode(true)));
    if (names.has(previous)) select.value = previous;
    if (names.has(previousParent)) parentSelect.value = previousParent;
  }
  async function loadCategories() {
    const res = await fetch('/data/categories.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Kategoriler yüklenemedi.');
    renderCategories(await res.json());
  }
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
  $('delete-category-button').addEventListener('click', async () => {
    const path = $('delete-category').value;
    if (!path) { feedback('Silinecek kategoriyi seç.'); return; }
    const label = $('delete-category').selectedOptions[0].textContent;
    if (!confirm(`“${label}” kategorisini silmek istiyor musun? Yalnızca boş kategoriler silinebilir.`)) return;
    const button = $('delete-category-button'); button.disabled = true; feedback('Kategori siliniyor…');
    try {
      const result = await callAdmin('delete_category', { path });
      feedback(`“${label}” silindi. Sitede görünmesi birkaç dakika sürebilir.`);
      renderCategories(result.categories);
    } catch (err) { feedback(err.message); }
    finally { button.disabled = false; }
  });
  return { loadCategories };
}
