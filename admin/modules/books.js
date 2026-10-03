export function initBooks({ $, callAdmin, feedback }) {
  let cover = '';
  let localPreview = '';
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  const preview = () => {
    const source = localPreview || cover;
    $('new-book-cover-preview').hidden = !source;
    $('new-book-cover-fallback').hidden = Boolean(source);
    $('new-book-cover-remove').hidden = !source;
    $('new-book-cover-preview').style.backgroundImage = source ? `url("${source}")` : 'none';
  };
  async function loadCategories() {
    const res = await fetch('/data/categories.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Kitap kategorileri yüklenemedi.');
    const categories = await res.json();
    const pathOf = item => (item.parent ? item.parent + '/' : '') + item.slug;
    const names = new Map(categories.map(item => [pathOf(item), item.name]));
    const options = categories.filter(item => pathOf(item).startsWith('kitap-notlari/')).map(item => {
      const path = pathOf(item);
      const label = path.split('/').map((part,i,parts)=>names.get(parts.slice(0,i+1).join('/'))||part).join(' → ');
      return new Option(label, path);
    });
    $('new-book-category').replaceChildren(...options);
  }
  $('new-book-title').addEventListener('input', () => { $('new-book-fallback-title').textContent = $('new-book-title').value.trim() || 'Kitap adı'; });
  $('new-book-cover').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 2*1024*1024 || !allowed.includes(file.type)) { feedback('JPEG, PNG, WebP veya GIF kapak seç; en fazla 2 MB.'); return; }
    const button = $('create-book'); button.disabled = true; feedback('Kitap kapağı yükleniyor…');
    try {
      const dataUrl = await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(new Error('Kapak okunamadı.')); reader.readAsDataURL(file); });
      localPreview = dataUrl;
      preview();
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const result = await callAdmin('upload_image',{filename:file.name,mime:file.type,data});
      cover=result.url; preview(); feedback('Kapak hazır. Kitabı oluşturabilirsin.');
    } catch(err) { feedback(err.message); }
    finally { button.disabled=false; }
  });
  $('new-book-cover-remove').addEventListener('click',()=>{ cover=''; localPreview=''; preview(); feedback('Kapak kaldırıldı. Otomatik estetik kapak kullanılacak.'); });
  $('create-book').addEventListener('click', async ()=>{
    const title=$('new-book-title').value.trim();
    if(!title){ feedback('Kitap adını yaz.'); $('new-book-title').focus(); return; }
    if(!$('new-book-category').value){ feedback('Kitabın kategorisini seç.'); return; }
    const button=$('create-book'); button.disabled=true; $('book-create-status').textContent='Kitap oluşturuluyor…'; feedback('Kitap oluşturuluyor…');
    try{
      const result=await callAdmin('add_book',{title,author:$('new-book-author').value.trim(),description:$('new-book-description').value.trim(),category:$('new-book-category').value,cover});
      $('book-create-status').textContent='“'+result.book.title+'” oluşturuldu. Sitede görünmesi birkaç dakika sürebilir.';
      feedback('Kitap başarıyla oluşturuldu.');
      $('new-book-title').value=''; $('new-book-author').value=''; $('new-book-description').value=''; cover=''; localPreview=''; $('new-book-fallback-title').textContent='Kitap adı'; preview();
    }catch(err){ $('book-create-status').textContent=err.message; feedback(err.message); }
    finally{ button.disabled=false; }
  });
  preview();
  return { loadCategories };
}
