(() => {
  if (location.pathname.replace(/\/$/, '') !== '/kitap-notlari') return;
  const main = document.querySelector('main');
  if (!main) return;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/bookshelf.css?v=20261012'; document.head.append(css);
  const el = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls || ''; if (text) n.textContent = text; return n; };
  const safe = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('..');
  async function start() {
    const response = await fetch('/data/site-books.json', {cache:'no-cache'}); if (!response.ok) throw new Error('catalog');
    const books = await response.json();
    if (Array.isArray(books) && !books.some(b=>b.id==='kitap-notlari/sinema/sinemanin-kokleri')) books.push({id:'kitap-notlari/sinema/sinemanin-kokleri',title:'Sinemanın Kökleri',author:'Enver Gülşen',category:'kitap-notlari/sinema'});
    if (!Array.isArray(books) || !books.length) return;
    const section = el('section','library-shelf'); section.setAttribute('aria-label','Animasyonlu kitaplık');
    const toolbar = el('div','shelf-toolbar'); toolbar.append(el('h2','','Kitaplığım'));
    const toggle = el('button','shelf-toggle','Liste görünümü'); toggle.type='button'; toggle.setAttribute('aria-pressed','false'); toolbar.append(toggle);
    section.append(toolbar,el('p','shelf-hint','Bir kitabı seç; kapağını aç ve notlarına göz at.'));
    const rack = el('div','shelf-rack'); section.append(rack);
    const dialog = el('dialog','shelf-dialog'); dialog.setAttribute('aria-labelledby','shelf-book-title');
    const close = el('button','shelf-close','×'); close.type='button'; close.setAttribute('aria-label','Kitabı kapat');
    const spread=el('div','shelf-spread'), left=el('div','shelf-left'), right=el('div','shelf-right');
    spread.append(left,right); dialog.append(close,spread); document.body.append(dialog);
    close.onclick=()=>dialog.close(); dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
    let opener, token=0;
    dialog.addEventListener('close',()=>{ token++; document.body.classList.remove('shelf-reading'); opener?.focus(); });
    function link(title,url){const a=el('a','shelf-note-link',title+' →'); a.href=url; return a;}
    async function open(book,button){
      opener=button; const current=++token; left.replaceChildren(); right.replaceChildren();
      left.append(el('span','shelf-exlibris','FURKAN SAĞDIÇ · OKUMA DEFTERİ'));
      if(safe(book.cover)){const img=el('img','shelf-cover');img.src=book.cover;img.alt=book.title+' kitap kapağı';img.onerror=()=>img.replaceWith(el('div','shelf-cover-fallback',book.title));left.append(img);} else left.append(el('div','shelf-cover-fallback',book.title));
      const title=el('h2','',book.title);title.id='shelf-book-title';right.append(el('span','shelf-kicker','KİTAP NOTLARI'),title);
      if(book.author)right.append(el('p','shelf-author',book.author));
      if(book.description)right.append(el('p','shelf-description',book.description));
      const notes=el('nav','shelf-notes');notes.setAttribute('aria-label','Kitabın notları');right.append(notes);
      const url='/'+book.id.replace(/^\/+|\/+$/g,'')+'/';
      if(safe(url)) notes.append(link('Notları oku',url));
      dialog.showModal(); document.body.classList.add('shelf-reading');close.focus();
      // Existing category pages retain the published grouping of notes into books.
      try{
        const category='/'+book.category.replace(/^\/+|\/+$/g,'').split('/').slice(0,2).join('/')+'/';
        const r=await fetch(category);if(!r.ok)return;const doc=new DOMParser().parseFromString(await r.text(),'text/html');
        const match=[...doc.querySelectorAll('.cinema-book')].find(b=>b.dataset.title===book.title);
        if(current!==token || !dialog.open || !match)return;
        const target=match.dataset.url;
        if(target?.startsWith('#')){
          const group=doc.getElementById(target.slice(1)); const links=[...(group?.querySelectorAll('a')||[])].filter(a=>safe(a.getAttribute('href')));
          if(links.length)notes.replaceChildren(...links.map(a=>link(a.textContent,a.getAttribute('href'))));
        }else if(safe(target))notes.replaceChildren(link('Notları oku',target));
      }catch{/* The original note link remains available when enrichment fails. */}
    }
    books.filter(b=>b.id?.startsWith('kitap-notlari/') && b.title).forEach((book,i)=>{
      const button=el('button','shelf-book');button.type='button';button.style.setProperty('--binding',['#315b59','#704651','#746039','#404b68'][i%4]);button.style.setProperty('--book-height',(232+i%4*12)+'px');
      button.setAttribute('aria-label',book.title+' — kitabı aç');button.append(el('span','shelf-spine-title',book.title),el('span','shelf-spine-mark','✧'));button.onclick=()=>open(book,button);rack.append(button);
    });
    toggle.onclick=()=>{const list=section.classList.toggle('is-list');toggle.textContent=list?'Raf görünümü':'Liste görünümü';toggle.setAttribute('aria-pressed',String(list));};
    main.querySelector('.page-head')?.after(section);
  }
  start().catch(()=>{/* Existing categories and notes stay usable. */});
})();
