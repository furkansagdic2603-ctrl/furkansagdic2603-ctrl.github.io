(() => {
  if (location.pathname.replace(/\/$/, '') !== '/kitap-notlari') return;
  const main = document.querySelector('main');
  if (!main) return;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/bookshelf.css?v=20261012-return'; document.head.append(css);
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
    let opener, token=0, closing=false;
    async function returnToShelf() {
      if (closing || !dialog.open) return;
      closing=true;
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!opener?.isConnected || reduced) {
        dialog.close(); closing=false; return;
      }
      const cover=left.querySelector('.shelf-cover, .shelf-cover-fallback');
      const from=(cover || left).getBoundingClientRect();
      const ghost=el('div','shelf-return-book');
      ghost.setAttribute('aria-hidden','true');
      ghost.style.setProperty('--binding',opener.style.getPropertyValue('--binding'));
      ghost.append(el('span','shelf-return-title',right.querySelector('h2')?.textContent || ''));
      if(cover?.tagName==='IMG') { const image=cover.cloneNode(); image.removeAttribute('id'); ghost.prepend(image); }
      Object.assign(ghost.style,{left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px'});
      try {
        await left.animate([{transform:'rotateY(0deg)'},{transform:'rotateY(75deg)'}],{duration:230,easing:'ease-in',fill:'forwards'}).finished;
        document.body.append(ghost);
        dialog.close();
        opener.classList.add('is-returning');
        const to=opener.getBoundingClientRect();
        await ghost.animate([
          {transform:'translate(0,0) scale(1)',opacity:1},
          {transform:`translate(${to.left-from.left}px,${to.top-from.top-14}px) scale(${to.width/from.width},${to.height/from.height})`,opacity:1,offset:.86},
          {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${to.width/from.width},${to.height/from.height})`,opacity:1}
        ],{duration:650,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).finished;
      } finally {
        ghost.remove(); opener?.classList.remove('is-returning');
        left.getAnimations().forEach(a=>a.cancel());
        closing=false; opener?.focus({preventScroll:true});
      }
    }
    close.onclick=returnToShelf;
    dialog.addEventListener('cancel',e=>{e.preventDefault();returnToShelf();});
    dialog.addEventListener('click',e=>{if(e.target===dialog)returnToShelf();});
    dialog.addEventListener('close',()=>{ token++; document.body.classList.remove('shelf-reading'); if(!closing) opener?.focus({preventScroll:true}); });
    function link(title,url){const a=el('a','shelf-note-link',title+' →'); a.href=url; return a;}
    async function open(book,button){
      if(closing)return; opener=button; const current=++token; left.replaceChildren(); right.replaceChildren();
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
