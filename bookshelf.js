(() => {
  if (location.pathname.replace(/\/$/, '') !== '/kitap-notlari') return;
  const main = document.querySelector('main');
  if (!main) return;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/bookshelf.css?v=20261012-physical'; document.head.append(css);
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
    section.append(toolbar,el('p','shelf-hint','Raftan bir kitap al, sayfalarını arala.'));
    const stats=el('div','shelf-stats');stats.append(el('span','',books.length+' kitap'),el('span','',new Set(books.map(b=>b.category.split('/')[1])).size+' konu'));section.append(stats);
    const filters=el('nav','shelf-filters');filters.setAttribute('aria-label','Kitap kategorileri');section.append(filters);
    const labels={felsefe:'Felsefe',din:'Din',sanat:'Sanat',sinema:'Sinema',tarih:'Tarih',edebiyat:'Edebiyat'};
    ['all',...new Set(books.map(b=>b.category.split('/')[1]))].forEach(key=>{const f=el('button','',key==='all'?'Tümü':labels[key]||key);f.type='button';f.setAttribute('aria-pressed',String(key==='all'));f.onclick=()=>{filters.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===f)));rack.querySelectorAll('.shelf-book').forEach(n=>n.hidden=key!=='all'&&n.dataset.topic!==key);};filters.append(f);});
    const rack = el('div','shelf-rack'); section.append(rack);
    const dialog = el('dialog','shelf-dialog'); dialog.setAttribute('aria-labelledby','shelf-book-title');
    const close = el('button','shelf-close','×'); close.type='button'; close.setAttribute('aria-label','Kitabı kapat');
    const spread=el('div','shelf-spread'), left=el('div','shelf-left'), right=el('div','shelf-right');
    spread.append(left,right); dialog.append(close,spread); document.body.append(dialog);
    let opener, token=0, busy=false, flight=null, bookObject=null;
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = async (node, frames, duration) => {
      const animation=node.animate(frames,{duration:reduced()?1:duration,easing:'cubic-bezier(.22,.68,.2,1)',fill:'forwards'});
      await animation.finished; return animation;
    };
    function poses(button) {
      const r=button.getBoundingClientRect(), d=bookObject.getBoundingClientRect();
      const x=r.left+r.width/2-(d.left+d.width/2), y=r.top+r.height/2-(d.top+d.height/2);
      return [
        `translate3d(${x}px,${y}px,0) rotateX(0deg) rotateY(-78deg) rotateZ(0deg)`,
        `translate3d(${x}px,${y}px,150px) rotateX(0deg) rotateY(-78deg) rotateZ(0deg)`,
        'translate3d(0,0,120px) rotateX(24deg) rotateY(-15deg) rotateZ(90deg)',
        'translate3d(0,0,0) rotateX(0deg) rotateY(0deg) rotateZ(0deg)'
      ];
    }
    async function returnToShelf() {
      if(busy || !dialog.open)return;
      busy=true; close.disabled=true;
      try {
        dialog.classList.remove('is-open-book');
        const cover=bookObject.querySelector('.physical-cover');
        await motion(cover,[{transform:'rotateY(-165deg)'},{transform:'rotateY(0deg)'}],420);
        // Recalculate the shelf destination in case the viewport changed.
        bookObject.getAnimations().forEach(a=>a.cancel());
        const p=poses(opener);
        await motion(bookObject,[{transform:p[3]},{transform:p[2],offset:.4},{transform:p[1],offset:.78},{transform:p[0]}],1050);
        dialog.close();
      }finally{
        opener?.classList.remove('is-returning');bookObject?.remove();bookObject=null;
        busy=false;close.disabled=false;opener?.focus({preventScroll:true});
      }
    }
    close.onclick=returnToShelf;
    dialog.addEventListener('cancel',e=>{e.preventDefault();returnToShelf();});
    dialog.addEventListener('click',e=>{if(e.target===dialog)returnToShelf();});
    dialog.addEventListener('close',()=>{token++;document.body.classList.remove('shelf-reading');});
    function link(title,url){const a=el('a','shelf-note-link',title+' →'); a.href=url; return a;}
    async function open(book,button){
      if(busy || dialog.open)return; opener=button;busy=true;close.disabled=true; const current=++token; left.replaceChildren(); right.replaceChildren();
      left.append(el('span','shelf-exlibris','FURKAN SAĞDIÇ · OKUMA DEFTERİ'));
      if(safe(book.cover)){const img=el('img','shelf-cover');img.src=book.cover;img.alt=book.title+' kitap kapağı';img.onerror=()=>img.replaceWith(el('div','shelf-cover-fallback',book.title));left.append(img);} else left.append(el('div','shelf-cover-fallback',book.title));
      const title=el('h2','',book.title);title.id='shelf-book-title';right.append(el('span','shelf-kicker','KİTAP NOTLARI'),title);
      if(book.author)right.append(el('p','shelf-author',book.author));
      let status='Henüz başlanmadı';try{if(localStorage.getItem('shelf-reading:'+book.id))status='Okumaya başlandı';}catch{}
      right.append(el('p','shelf-reading-status',status));
      if(book.description)right.append(el('p','shelf-description',book.description));
      const notes=el('nav','shelf-notes');notes.addEventListener('click',e=>{if(e.target.closest('a'))try{localStorage.setItem('shelf-reading:'+book.id,'1');}catch{}});notes.setAttribute('aria-label','Kitabın notları');right.append(notes);
      const url='/'+book.id.replace(/^\/+|\/+$/g,'')+'/';
      if(safe(url)) notes.append(link('Notları oku',url));
      dialog.classList.remove('is-open-book');
      bookObject=el('div','physical-book');bookObject.setAttribute('aria-hidden','true');
      const cover=el('div','physical-cover');
      cover.style.setProperty('--binding',button.style.getPropertyValue('--binding'));
      cover.append(el('span','physical-cover-title',book.title));
      if(safe(book.cover)){const img=el('img');img.src=book.cover;img.alt='';cover.append(img);}
      const spine=el('div','physical-spine',book.title);
      spine.style.setProperty('--binding',button.style.getPropertyValue('--binding'));
      bookObject.append(el('div','physical-pages'),spine,cover);dialog.append(bookObject);
      dialog.showModal();document.body.classList.add('shelf-reading');button.classList.add('is-returning');close.focus();
      const p=poses(button);
      try {
        await motion(bookObject,[{transform:p[0]},{transform:p[1],offset:.3},{transform:p[2],offset:.75},{transform:p[3]}],1150);
        dialog.classList.add('is-open-book');
        await motion(cover,[{transform:'rotateY(0deg)'},{transform:'rotateY(-165deg)'}],650);
      }finally{busy=false;close.disabled=false;}
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
      button.dataset.topic=book.category.split('/')[1];
      button.append(el('span','shelf-spine-author',book.author||'Kitap notları'));
      button.setAttribute('aria-label',book.title+' — kitabı aç');button.append(el('span','shelf-spine-title',book.title),el('span','shelf-spine-mark','✧'));button.onclick=()=>open(book,button);rack.append(button);
    });
    toggle.onclick=()=>{const list=section.classList.toggle('is-list');toggle.textContent=list?'Raf görünümü':'Liste görünümü';toggle.setAttribute('aria-pressed',String(list));};
    main.querySelector('.page-head')?.after(section);
  }
  start().catch(()=>{/* Existing categories and notes stay usable. */});
})();
