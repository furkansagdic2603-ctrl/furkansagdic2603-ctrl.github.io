export function initBooks({ $, callAdmin, feedback }) {
  const uploadedPreviews = new Map();
  const savedBooks = new Map();
  const deletedBooks = new Set();
  let cover = '';
  let localPreview = '';
  let localPreviewObjectUrl = '';
  let libraryBooks = [];
  let editCover = '';
  let editLocalPreview = '';
  let editUploadPending = false;
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  const preview = () => {
    const source = localPreview || uploadedPreviews.get(cover) || cover;
    const face = $('new-book-cover-preview');
    const img = $('new-book-cover-preview-img');
    face.hidden = !source;
    $('new-book-cover-fallback').hidden = Boolean(source);
    $('new-book-cover-remove').hidden = !source;
    face.style.backgroundImage = 'none';
    face.classList.toggle('is-loading-cover', Boolean(source));
    face.classList.remove('is-cover-error');
    if (img) {
      img.hidden = !source;
      if (source) {
        if (img.src !== source) img.src = source;
      } else {
        img.removeAttribute('src');
      }
    }
    const note = $('new-book-cover-note');
    if (note && source) note.textContent = 'Kapak önizlemesi hazır.';
  };
  async function loadCategories() {
    const res = await fetch('/data/categories.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Kitap kategorileri yüklenemedi.');
    const categories = await res.json();
    const pathOf = item => (item.parent ? item.parent + '/' : '') + item.slug;
    const names = new Map(categories.map(item => [pathOf(item), item.name]));
    const bookRoots = new Set(['kitap-notlari', 'mecmua-yazilari']);
    const options = categories.filter(item => {
      const path = pathOf(item);
      return Array.from(bookRoots).some(root => path === root || path.startsWith(root + '/'));
    }).map(item => {
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
    libraryBooks = Array.from(map.values()).filter(book=>!deletedBooks.has(book.id));
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
      const id=$('edit-book-id').value;
      if(!id) throw new Error('Kapak bağlanacak kitap seçili değil.');
      const result=await callAdmin('set_book_cover',{id,filename:file.name,mime:file.type,data:dataUrl.slice(dataUrl.indexOf(',')+1)});
      if(!result.url || result.book?.cover!==result.url) throw new Error('Kapak yükleme ve kitap eşleştirmesi tamamlanamadı.');
      uploadedPreviews.set(result.url,dataUrl);
      editCover=result.url;
      savedBooks.set(result.book.id,result.book);
      editPreview();
      await loadLibrary();
      $('edit-book-status').textContent='Kapak yüklendi, kitaba bağlandı ve doğrulandı.';
      feedback('Kapak kitaba kaydedildi ve doğrulandı.');
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
    const id=$('edit-book-id').value; const book=libraryBooks.find(item=>item.id===id);
    if(!book)return;
    const ok=confirm('“'+book.title+'” kitabını ve bu kitaba bağlı BÜTÜN notları/bölümleri kalıcı olarak silmek istiyor musun? Bu işlem geri alınamaz.');
    if(!ok)return;
    const second=confirm('Son onay: “'+book.title+'” tamamen silinecek. Devam edilsin mi?');
    if(!second)return;
    const button=$('delete-book'); button.disabled=true; $('edit-book-status').textContent='Kitap ve içindekiler siliniyor…'; feedback('Kitap tamamen siliniyor…');
    try{
      const result=await callAdmin('delete_book',{id:book.id,title:book.title,cover:book.cover||'',sourcePath:book.sourcePath||''});
      savedBooks.delete(book.id);
      deletedBooks.add(book.id);
      libraryBooks=libraryBooks.filter(item=>item.id!==book.id);
      $('edit-book-card').hidden=true; feedback('“'+book.title+'” ve bağlı '+result.deleted+' içerik silindi.'); await loadLibrary();
    }catch(err){$('edit-book-status').textContent=err.message;feedback(err.message);}finally{button.disabled=false;}
  });

  const kyNormalizeIsbn=value=>{
    const m=String(value||'').match(/(?:97[89][\s-]?)?(?:\d[\s-]?){9}[\dXx]/);
    return m?m[0].replace(/[\s-]/g,'').toUpperCase():'';
  };
  const kyMergeClientResults=(...groups)=>{
    const out=[],seen=new Set();
    for(const group of groups)for(const item of group||[]){
      if(!item?.title)continue;
      const key=[String(item.isbn||'').replace(/[^0-9X]/gi,''),String(item.title||'').toLocaleLowerCase('tr'),String(item.author||'').toLocaleLowerCase('tr')].join('|');
      if(seen.has(key))continue;seen.add(key);out.push(item);
    }
    return out;
  };
  const browserIsbnLookup=async query=>{
    const isbn=kyNormalizeIsbn(query);if(!isbn)return[];
    const google=(async()=>{try{
      const r=await fetch('https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent('isbn:'+isbn)+'&maxResults=20&printType=books&projection=full');
      if(!r.ok)return[];const data=await r.json();
      return (Array.isArray(data.items)?data.items:[]).map(x=>{const d=x.volumeInfo||{},ids=Array.isArray(d.industryIdentifiers)?d.industryIdentifiers:[],found=String(ids.find(z=>z.type==='ISBN_13')?.identifier||ids.find(z=>z.type==='ISBN_10')?.identifier||isbn);return{title:String(d.title||'').slice(0,160),author:String(d.authors?.join(', ')||'').slice(0,160),description:String(d.description||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,500),cover:String(d.imageLinks?.extraLarge||d.imageLinks?.large||d.imageLinks?.medium||d.imageLinks?.thumbnail||'').replace(/^http:/,'https:'),publisher:String(d.publisher||'').slice(0,160),isbn:found,pages:String(d.pageCount||''),publishDate:String(d.publishedDate||''),sourceUrl:String(d.infoLink||''),source:'Google Books'};}).filter(x=>x.title);
    }catch{return[];}})();
    const openLibrary=(async()=>{try{
      const r=await fetch('https://openlibrary.org/api/books?bibkeys='+encodeURIComponent('ISBN:'+isbn)+'&jscmd=data&format=json');
      if(!r.ok)return[];const data=await r.json(),d=data?.['ISBN:'+isbn];if(!d?.title)return[];
      return [{title:String(d.title).slice(0,160),author:String((Array.isArray(d.authors)?d.authors.map(a=>a?.name).filter(Boolean):[]).join(', ')).slice(0,160),description:String(d.subtitle||'').slice(0,500),cover:String(d.cover?.large||d.cover?.medium||d.cover?.small||'').replace(/^http:/,'https:'),publisher:String((Array.isArray(d.publishers)?d.publishers.map(p=>p?.name).filter(Boolean):[]).join(', ')).slice(0,160),isbn,pages:String(d.number_of_pages||''),publishDate:String(d.publish_date||''),sourceUrl:String(d.url||d.info_url||('https://openlibrary.org/isbn/'+isbn)),source:'Open Library ISBN'}];
    }catch{return[];}})();
    const [g,o]=await Promise.all([google,openLibrary]);
    return kyMergeClientResults(g,o);
  };

  const kyResults=$('ky-book-results'),kyStatus=$('ky-book-status');
  const renderKyResults=items=>{
    kyResults.replaceChildren(...items.map(item=>{
      const card=document.createElement('button');card.type='button';card.className='ky-result-card';
      if(item.cover){const img=document.createElement('img');img.src=item.cover;img.alt='';img.loading='lazy';card.append(img);}
      const info=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small'),meta=document.createElement('i');
      strong.textContent=item.title||'Adsız kitap';small.textContent=item.author||item.publisher||'Yazar bilgisi yok';
      meta.textContent=[item.source,item.publisher,item.isbn&&('ISBN '+item.isbn),item.pages&&item.pages+' sayfa'].filter(Boolean).join(' · ');
      info.append(strong,small,meta);card.append(info);
      card.addEventListener('click',async()=>{
        $('new-book-title').value=item.title||'';$('new-book-author').value=item.author||'';$('new-book-description').value=(item.description||'').slice(0,500);$('new-book-fallback-title').textContent=item.title||'Kitap adı';
        kyStatus.textContent='Bilgiler forma aktarıldı. Kapak siteye kopyalanıyor…';feedback((item.source||'Kitap veritabanı')+' bilgileri getirildi.');
        if(item.cover){
          try{const imported=await callAdmin('kitapyurdu_import_cover',{url:item.cover});if(!imported.url)throw new Error('Kapak alınamadı.');cover=imported.url;localPreview=item.cover;uploadedPreviews.set(cover,item.cover);preview();kyStatus.textContent='Bilgiler ve kapak hazır. Kategoriyi seçip kitabı oluştur.';}
          catch(err){kyStatus.textContent='Bilgiler geldi ancak kapak alınamadı: '+err.message;}
        }else kyStatus.textContent='Bilgiler hazır. Bu kayıtta kapak bulunamadı.';
        kyResults.replaceChildren();
      });return card;
    }));
  };
  $('ky-book-search').addEventListener('click',async()=>{
    const query=$('ky-book-query').value.trim();if(!query){kyStatus.textContent='ISBN-10 veya ISBN-13 numarasını yaz.';return;}
    const button=$('ky-book-search'),isbn=kyNormalizeIsbn(query);button.disabled=true;kyStatus.textContent='ISBN Türkiye kitapçıları ve açık kitap kataloglarında aranıyor…';kyResults.replaceChildren();
    try{
      const data=await callAdmin('kitapyurdu_lookup',{query});
      let items=Array.isArray(data.results)?data.results:[];
      let browserFallback=false;
      if(!items.length&&isbn){items=await browserIsbnLookup(isbn);browserFallback=items.length>0;}
      renderKyResults(items);
      kyStatus.textContent=browserFallback
        ? items.length+' sonuç tarayıcıdaki yedek ISBN aramasıyla bulundu. Doğru kitabı seç.'
        : (data.message||(items.length?items.length+' sonuç bulundu. Doğru kitabı seç.':'Bu ISBN açık kitap kataloglarında bulunamadı. ISBN numarasını kontrol et; tireli veya tiresiz yazabilirsin.'));
    }catch(err){
      const items=isbn?await browserIsbnLookup(isbn).catch(()=>[]):[];
      if(items.length){renderKyResults(items);kyStatus.textContent=items.length+' sonuç bulundu. Sunucu araması yanıt vermediği için tarayıcı yedeği kullanıldı.';}
      else{kyStatus.textContent=err.message;feedback(err.message);}
    }finally{button.disabled=false;}
  });
  $('ky-book-query').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('ky-book-search').click();}});
  $('new-book-title').addEventListener('input', () => { $('new-book-fallback-title').textContent = $('new-book-title').value.trim() || 'Kitap adı'; });
  $('new-book-cover').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 2*1024*1024 || !allowed.includes(file.type)) { feedback('JPEG, PNG, WebP veya GIF kapak seç; en fazla 2 MB.'); return; }

    if (localPreviewObjectUrl) URL.revokeObjectURL(localPreviewObjectUrl);
    localPreviewObjectUrl = URL.createObjectURL(file);
    localPreview = localPreviewObjectUrl;
    preview();
    const note = $('new-book-cover-note');
    if (note) note.textContent = 'Yerel kapak gösteriliyor · siteye yükleniyor…';

    const button = $('create-book'); button.disabled = true; feedback('Kapak seçildi. Önizleme gösteriliyor ve siteye yükleniyor…');
    try {
      const dataUrl = await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(new Error('Kapak okunamadı.')); reader.readAsDataURL(file); });
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const result = await callAdmin('upload_image',{filename:file.name,mime:file.type,data});
      if(!result.url) throw new Error('Kapak yükleme tamamlanamadı.');
      uploadedPreviews.set(result.url,dataUrl);
      cover=result.url;
      localPreview=dataUrl;
      if (localPreviewObjectUrl) { URL.revokeObjectURL(localPreviewObjectUrl); localPreviewObjectUrl=''; }
      preview();
      if (note) note.textContent = 'Kapak yüklendi ve önizlemeye bağlandı.';
      feedback('Kapak hazır. Kitabı oluşturabilirsin.');
    } catch(err) {
      if (note) note.textContent = 'Önizleme yerelde hazır; yükleme tamamlanamadı: '+err.message;
      feedback(err.message);
    } finally { button.disabled=false; }
  });
  $('new-book-cover-remove').addEventListener('click',()=>{ if(localPreviewObjectUrl)URL.revokeObjectURL(localPreviewObjectUrl);localPreviewObjectUrl='';cover='';localPreview='';preview();$('new-book-cover-note').textContent='Kapak yüklemezsen kitap yine oluşturulur.';feedback('Kapak kaldırıldı. Otomatik estetik kapak kullanılacak.'); });
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
      $('new-book-title').value=''; $('new-book-author').value=''; $('new-book-description').value=''; if(localPreviewObjectUrl)URL.revokeObjectURL(localPreviewObjectUrl);localPreviewObjectUrl='';cover=''; localPreview=''; $('new-book-fallback-title').textContent='Kitap adı'; $('new-book-cover-note').textContent='Kapak yüklemezsen kitap yine oluşturulur.'; preview();
    }catch(err){ $('book-create-status').textContent=err.message; feedback(err.message); }
    finally{ button.disabled=false; }
  });
  const newPreviewImg=$('new-book-cover-preview-img');
  if(newPreviewImg){
    newPreviewImg.addEventListener('load',()=>{ $('new-book-cover-preview').classList.remove('is-loading-cover','is-cover-error'); });
    newPreviewImg.addEventListener('error',()=>{ $('new-book-cover-preview').classList.remove('is-loading-cover'); $('new-book-cover-preview').classList.add('is-cover-error'); $('new-book-cover-note').textContent='Kapak dosyası seçildi fakat tarayıcı önizlemeyi açamadı. JPEG veya PNG olarak yeniden kaydedip dene.'; });
  }
  preview();
  loadLibrary();
  return { loadCategories, loadLibrary };
}
