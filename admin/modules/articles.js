import { createBookCovers } from './book-covers.js?v=20261003-booknotes3';
// Published article picker and create/edit/delete actions.
export function createArticles({ $, callAdmin, feedback }) {
  const bookCovers = createBookCovers({ $, callAdmin, feedback });
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
  const documentFile = $('article-document-file');
  const documentStatus = $('article-document-status');
  const documentName = $('article-document-name');
  function escapeImportHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  async function importDocx(file) {
    if (!window.mammoth) {
      await new Promise((resolve, reject) => {
        const script=document.createElement('script');
        script.src='https://cdn.jsdelivr.net/npm/mammoth@1.10.0/mammoth.browser.min.js';
        script.onload=resolve; script.onerror=()=>reject(new Error('Word dönüştürücü yüklenemedi.'));
        document.head.append(script);
      });
    }
    const result=await window.mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},{
      styleMap:[
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h2:fresh",
        "p[style-name='Heading 2'] => h3:fresh",
        "p[style-name='Quote'] => blockquote:fresh"
      ],
      includeDefaultStyleMap:true
    });
    return result.value;
  }
  async function importPdf(file) {
    const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    const pages=[];
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      documentStatus.textContent=`PDF okunuyor… ${pageNo}/${pdf.numPages}`;
      const page=await pdf.getPage(pageNo);
      const content=await page.getTextContent();
      const items=content.items.filter(item=>item.str && item.str.trim());
      const lines=[]; let current=[]; let lastY=null;
      for(const item of items){
        const y=Math.round(item.transform?.[5]||0);
        if(lastY!==null && Math.abs(y-lastY)>3){ if(current.length) lines.push(current.join(' ')); current=[]; }
        current.push(item.str.trim()); lastY=y;
      }
      if(current.length) lines.push(current.join(' '));
      pages.push(lines.filter(Boolean).map(line=>`<p>${escapeImportHtml(line)}</p>`).join(''));
    }
    return pages.join('<hr>');
  }
  documentFile?.addEventListener('change',async event=>{
    const file=event.target.files?.[0]; if(!file)return;
    documentName.textContent=file.name;
    if(file.size>20*1024*1024){documentStatus.textContent='Dosya en fazla 20 MB olabilir.';event.target.value='';return;}
    const isDocx=/\.docx$/i.test(file.name), isPdf=/\.pdf$/i.test(file.name);
    if(!isDocx&&!isPdf){documentStatus.textContent='Yalnızca .docx veya .pdf seçebilirsin.';event.target.value='';return;}
    if($('editor').textContent.trim()&&!confirm('Dosya içeriği editördeki mevcut metnin yerine aktarılsın mı?')){event.target.value='';return;}
    documentStatus.textContent=isDocx?'Word belgesi dönüştürülüyor…':'PDF okunuyor…';
    documentFile.disabled=true;
    try{
      const imported=isDocx?await importDocx(file):await importPdf(file);
      if(!imported||!imported.replace(/<[^>]*>/g,'').trim())throw new Error('Belgeden aktarılabilir metin bulunamadı.');
      $('editor').innerHTML=imported;
      const firstHeading=$('editor').querySelector('h1,h2');
      if(!$('title').value.trim()&&firstHeading){
        $('title').value=firstHeading.textContent.trim();
        firstHeading.remove();
      }
      documentStatus.textContent=`${file.name} editöre aktarıldı. Yayımlamadan önce içeriği kontrol edebilirsin.`;
      feedback('Belge editöre aktarıldı.');
      $('editor').dispatchEvent(new Event('input',{bubbles:true}));
    }catch(err){documentStatus.textContent=err.message||'Belge aktarılamadı.';}
    finally{documentFile.disabled=false;event.target.value='';}
  });

  function resetEditor() {
    editing = null;
    bookCovers.load(null);
    $('title').value = '';
    $('description').value = '';
    $('editor').innerHTML = '';
    $('category').disabled = false;
    $('editor-heading').textContent = 'Yeni yazı';
    $('publish').textContent = 'Yayımla';
    $('cover-option').hidden = false;
    $('edit-note').hidden = true;
    $('delete-article').disabled = true;
    $('delete-article').textContent = 'Yazıyı sil (önce aç)';
    localStorage.removeItem('furkan-editor-draft-v1');
  }
  $('new-article').addEventListener('click', () => {
    if (($('title').value || $('editor').textContent.trim()) && !confirm('Editördeki yazıyı kapatıp yeni yazı açmak istiyor musun?')) return;
    resetEditor();
    feedback('Yeni yazı açıldı.');
    document.dispatchEvent(new CustomEvent('admin:editor-open'));
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
      document.dispatchEvent(new CustomEvent('admin:article-deleted'));
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
      bookCovers.load(article);
      $('editor').innerHTML = article.innerHTML;
      $('editor-heading').textContent = 'Yazıyı düzenle';
      $('publish').textContent = 'Değişiklikleri kaydet';
      $('cover-option').hidden = true;
      $('edit-note').hidden = false;
      $('delete-article').disabled = false;
      $('delete-article').textContent = 'Bu yazıyı sil';
      $('article-status').textContent = 'Yazı açıldı; değiştirip kaydedebilirsin.';
      document.dispatchEvent(new CustomEvent('admin:editor-open'));
    } catch (err) { $('article-status').textContent = err.message; }
    finally { button.disabled = false; }
  });
  $('publish').addEventListener('click', async () => {
    const title = $('title').value.trim(), body = bookCovers.body($('editor').innerHTML.trim());
    if (!title || !$('editor').textContent.trim()) { feedback('Başlık ve yazı içeriği gerekli.'); return; }
    const category = $('category').value;
    const description = $('description').value.trim() || $('editor').textContent.trim().slice(0, 160);
    const skipCover = !$('generate-cover').checked;
    const button = $('publish'); button.disabled = true; feedback(editing ? 'Değişiklikler kaydediliyor…' : skipCover ? 'Yazı kapaksız yayımlanıyor…' : 'Kapak görseli oluşturuluyor ve yazı yayımlanıyor… Bu işlem biraz sürebilir.');
    try {
      const result = editing
        ? await callAdmin('update_article', { title, description, body, category, path: editing.path, sha: editing.sha })
        : await callAdmin('publish', { title, description, category, body, skipCover });
      if (editing) editing.sha = result.sha;
      const link = document.createElement('a'); link.href = result.url; link.textContent = 'Yazıyı aç →';
      const message = editing ? 'Değişiklikler kaydedildi. Sitede görünmesi birkaç dakika sürebilir. ' : result.coverConfigured ? 'Kapak görseliyle birlikte yazı kaydedildi. Sitede görünmesi birkaç dakika sürebilir. ' : 'Yazı kapak görseli olmadan kaydedildi. Sitede görünmesi birkaç dakika sürebilir. ';
      $('feedback').replaceChildren(message, link);
    } catch (err) { feedback(err.message); }
    finally { button.disabled = false; }
  });
  return { loadArticles, getArticles: () => articles };
}
