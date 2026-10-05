export function initBooks({ $, callAdmin, feedback }) {
  const uploadedPreviews = new Map();
  const savedBooks = new Map();
  let cover = '';
  let localPreview = '';
  let libraryBooks = [];
  let editCover = '';
  let editLocalPreview = '';
  let editUploadPending = false;
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  const preview = () => {
    const source = localPreview || uploadedPreviews.get(cover) || cover;
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
    $('new-book-category').replaceChildren(...options.map(o=>o.cloneNode(true)));
    $('edit-book-category').replaceChildren(...options.map(o=>o.cloneNode(true)));
  }
  async function loadLibrary() {
    let catalog = [];
    try { const r = await fetch('/data/site-books.json', {cache:'no-store'}); if (r.ok) catalog = await r.json(); } catch {}
    let discovered = [];
    try {
      const r = await fetch('/kitap-notlari/felsefe/', {cache:'no-store'});
      if (r.ok) {
        const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
        discovered = Array.from(doc.querySelectorAll('.cinema-book')).map(el => ({
          id: el.dataset.url && el.dataset.url !== '#' && !el.dataset.url.startsWith('#') ? el.dataset.url.replace(/^\//,'').replace(/\/$/,'') : 'kitap-notlari/felsefe/' + String(el.dataset.title||'kitap').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
          title: el.dataset.title || 'Kitap', author: el.dataset.author || '', description: '', category:'kitap-notlari/felsefe',
          cover: el.querySelector('.book-front img')?.getAttribute('src') || '', fallback:'burgundy', discovered:true, sourcePath: el.dataset.url && el.dataset.url.startsWith('/') && !el.dataset.url.startsWith('/#') ? el.dataset.url.slice(1).replace(/\/$/,'') : ''
        }));
      }
    } catch {}
    const map = new Map(discovered.map(b=>[b.id,b]));
    for (const b of catalog) map.set(b.id,{...map.get(b.id),...b,discovered:false});
    for (const [id, book] of savedBooks) map.set(id, {...map.get(id), ...book, discovered:false});
    libraryBooks = Array.from(map.values());
    renderLibrary();
  }
  function renderLibrary() {
    const host=$('book-library');
    host.replaceChildren(...libraryBooks.map(book=>{
      const button=document.createElement('button'); button.type='button'; button.className='admin-book-card';
      const face=document.createElement('span'); face.className='admin-book-card-cover';
      if(book.cover) face.style.backgroundImage=`url("${uploadedPreviews.get(book.cover) || (book.cover + '?v=' + encodeURIComponent(book.updatedAt||book.createdAt||'1'))}")`;
      else { face.classList.add('is-missing'); face.textContent='Kapak ekle'; }
      const info=document.createElement('span'); const strong=document.createElement('strong'); strong.textContent=book.title;
      const small=document.createElement('small'); small.textContent=book.author || (book.cover?'Kitabı düzenle':'Kapak yok · Kapak ekle');
      info.append(strong,small); button.append(face,info); button.addEventListener('click',()=>openEdit(book)); return button;
    }));
    $('book-library-empty').hidden=libraryBooks.length>0;
  }
  function editPreview() {
    const source=editLocalPreview||uploadedPreviews.get(editCover)||editCover;
    const face=$('edit-book-cover');
    const img=$('edit-book-cover-preview-img');
    face.style.backgroundImage='none';
    face.classList.toggle('is-missing',!source);
    if (img) {
      img.hidden=!source;
      if (source) img.src=source;
      else img.removeAttribute('src');
    }
    Array.from(face.childNodes).filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>node.remove());
    if(!source) face.append(document.createTextNode('Kapak yok'));
    $('edit-book-cover-note').textContent=source?(editLocalPreview?'Yeni kapak önizlemesi hazır. Yükleme tamamlanınca kaydedebilirsin.':'Kapak kayıtlı. İstersen yenisini seçebilirsin.'):'Bu kitapta kapak yok. Yukarıdan bir görsel seç.';
  }
  function openEdit(book) {
    $('edit-book-id').value=book.id; $('edit-book-title').value=book.title||''; $('edit-book-author').value=book.author||'';
    $('edit-book-description').value=book.description||''; $('edit-book-category').value=book.category||'kitap-notlari/felsefe';
    editCover=book.cover||''; editLocalPreview=uploadedPreviews.get(editCover)||''; editPreview(); $('edit-book-card').hidden=false; $('edit-book-status').textContent='';
    $('edit-book-card').scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('edit-book-cover-file').addEventListener('change',async e=>{
    const file=e.target.files[0]; e.target.value=''; if(!file)return;
    if(file.size>2*1024*1024||!allowed.includes(file.type)){feedback('JPEG, PNG, WebP veya GIF kapak seç; en fazla 2 MB.');return;}
    const saveButton=$('save-book'); editUploadPending=true; saveButton.disabled=true; $('edit-book-status').textContent='Kapak yükleniyor…';
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Kapak okunamadı.'));r.readAsDataURL(file);});
      editLocalPreview=dataUrl; editPreview(); feedback('Yeni kapak yükleniyor…');
      const result=await callAdmin('upload_image',{filename:file.name,mime:file.type,data:dataUrl.slice(dataUrl.indexOf(',')+1)});
      if(!result.url) throw new Error('Kapak yükleme tamamlanamadı.');
      uploadedPreviews.set(result.url,dataUrl); editCover=result.url; editPreview(); $('edit-book-status').textContent='Kapak hazır. Şimdi değişiklikleri kaydedebilirsin.'; feedback('Kapak hazır. Değişiklikleri kaydet.');
    }catch(err){editLocalPreview='';editPreview();$('edit-book-status').textContent=err.message;feedback(err.message);}
    finally{editUploadPending=false;saveButton.disabled=false;}
  });
  $('edit-book-cover-remove').addEventListener('click',()=>{editCover='';editLocalPreview='';editPreview();});
  $('cancel-book-edit').addEventListener('click',()=>{$('edit-book-card').hidden=true;});
  $('save-book').addEventListener('click',async()=>{
    const id=$('edit-book-id').value,title=$('edit-book-title').value.trim(),category=$('edit-book-category').value;
    if(editUploadPending){feedback('Kapak yüklemesi henüz bitmedi. Birkaç saniye bekle.');return;}
    if(!id||!title||!category){feedback('Kitap adı ve kategori gerekli.');return;}
    const button=$('save-book');button.disabled=true;$('edit-book-status').textContent='Kaydediliyor…';
    try{
      const result=await callAdmin('update_book',{id,title,author:$('edit-book-author').value.trim(),description:$('edit-book-description').value.trim(),category,cover:editCover});
      if(editCover && result.book.cover!==editCover) throw new Error('Kapak kitap kaydına bağlanamadı. Tekrar dene.');
      savedBooks.set(result.book.id,result.book);
      editCover=result.book.cover||''; editLocalPreview=uploadedPreviews.get(editCover)||''; editPreview();
      $('edit-book-status').textContent='“'+result.book.title+'” güncellendi'+(result.book.cover?' ve kapak kaydedildi.':' ancak kapak seçilmedi.')+' Site birkaç dakika içinde güncellenecek.';
      feedback(result.book.cover?'Kitap ve kapak kaydedildi.':'Kitap güncellendi.'); await loadLibrary();
    }catch(err){$('edit-book-status').textContent=err.message;feedback(err.message);}finally{button.disabled=false;}
  });
  $('delete-book').addEventListener('click',async()=>{
    feedback('Güvenlik için kitap silme geçici olarak kapalı.'); return;
    /*
    const id=$('edit-book-id').value; const book=libraryBooks.find(item=>item.id===id);
    if(!book)return;
    const ok=confirm('“'+book.title+'” kitabını ve bu kitaba bağlı BÜTÜN notları/bölümleri kalıcı olarak silmek istiyor musun? Bu işlem geri alınamaz.');
    if(!ok)return;
    const second=confirm('Son onay: “'+book.title+'” tamamen silinecek. Devam edilsin mi?');
    if(!second)return;
    const button=$('delete-book'); button.disabled=true; $('edit-book-status').textContent='Kitap ve içindekiler siliniyor…'; feedback('Kitap tamamen siliniyor…');
    try{
      const result=await callAdmin('delete_book',{id:book.id,title:book.title,cover:book.cover||'',sourcePath:book.sourcePath||''});
      $('edit-book-card').hidden=true; feedback('“'+book.title+'” ve bağlı '+result.deleted+' içerik silindi.'); await loadLibrary();
    }catch(err){$('edit-book-status').textContent=err.message;feedback(err.message);}finally{button.disabled=false;}
  });
    */
  });
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
      if(!result.url) throw new Error('Kapak yükleme tamamlanamadı.');
      uploadedPreviews.set(result.url,dataUrl); cover=result.url; preview(); feedback('Kapak hazır. Kitabı oluşturabilirsin.');
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
      savedBooks.set(result.book.id,result.book);
      feedback('Kitap başarıyla oluşturuldu.'); await loadLibrary();
      $('new-book-title').value=''; $('new-book-author').value=''; $('new-book-description').value=''; cover=''; localPreview=''; $('new-book-fallback-title').textContent='Kitap adı'; preview();
    }catch(err){ $('book-create-status').textContent=err.message; feedback(err.message); }
    finally{ button.disabled=false; }
  });
  preview();
  loadLibrary();
  return { loadCategories, loadLibrary };
}
