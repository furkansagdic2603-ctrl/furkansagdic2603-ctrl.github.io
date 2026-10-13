(() => {
  if (location.pathname.replace(/\/$/, '') !== '/kitap-notlari') return;
  const main = document.querySelector('main');
  if (!main) return;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/bookshelf.css?v=20261013-horizontal'; document.head.append(css);
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
    section.append(toolbar,el('p','shelf-hint','Kapakları kaydırarak bir kitap seç veya liste görünümüne geç.'));
    const stats=el('div','shelf-stats');stats.append(el('span','',books.length+' kitap'),el('span','',new Set(books.map(b=>b.category.split('/')[1])).size+' konu'));section.append(stats);
    const filters=el('nav','shelf-filters');filters.setAttribute('aria-label','Kitap kategorileri');section.append(filters);
    const labels={felsefe:'Felsefe',din:'Din',sanat:'Sanat',sinema:'Sinema',tarih:'Tarih',edebiyat:'Edebiyat'};
    ['all',...new Set(books.map(b=>b.category.split('/')[1]))].forEach(key=>{const f=el('button','',key==='all'?'Tümü':labels[key]||key);f.type='button';f.setAttribute('aria-pressed',String(key==='all'));f.onclick=()=>{filters.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===f)));rack.querySelectorAll('.shelf-book').forEach(n=>n.hidden=key!=='all'&&n.dataset.topic!==key);carouselBooks.forEach(item=>item.filtered=key!=='all'&&item.book.category.split('/')[1]!==key);renderCarousel(0);};filters.append(f);});
    const rack = el('div','shelf-rack'); section.append(rack);
    const dialog = el('dialog','shelf-dialog'); dialog.setAttribute('aria-labelledby','shelf-book-title');
    const close = el('button','shelf-close','×'); close.type='button'; close.setAttribute('aria-label','Kitabı kapat');
    const spread=el('div','shelf-spread'), left=el('div','shelf-left'), right=el('div','shelf-right');
    spread.append(left,right); dialog.append(close,spread); document.body.append(dialog);
    let opener, token=0, busy=false, bookObject=null;
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = async (node, frames, duration) => {
      const animation=node.animate(frames,{duration:reduced()?1:duration,easing:'cubic-bezier(.22,.68,.2,1)',fill:'forwards'});
      await animation.finished; return animation;
    };
    function poses(button) {
      const r=button.getBoundingClientRect(), bounds=dialog.getBoundingClientRect();
      const d={left:bounds.left+bookObject.offsetLeft,top:bounds.top+bookObject.offsetTop,width:bookObject.offsetWidth,height:bookObject.offsetHeight};
      const x=r.left+r.width/2-(d.left+d.width/2), y=r.top+r.height/2-(d.top+d.height/2);
      return [
        `translate3d(${x}px,${y}px,0) rotateX(0deg) rotateY(78deg) rotateZ(0deg)`,
        `translate3d(${x}px,${y}px,150px) rotateX(0deg) rotateY(78deg) rotateZ(0deg)`,
        'translate3d(0,0,120px) rotateX(12deg) rotateY(-10deg) rotateZ(20deg)',
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
      const spine=el('div','physical-spine');
      spine.append(el('span','physical-spine-title',book.title),el('span','physical-spine-author',book.author||'OKUMA DEFTERİ'));
      cover.append(el('span','physical-board-edge'));
      for(let band=0;band<4;band++){const rib=el('i','binding-rib');rib.style.setProperty('--rib-position',[12,23,77,88][band]+'%');spine.append(rib);}
      spine.style.setProperty('--binding',button.style.getPropertyValue('--binding'));
      bookObject.append(el('div','physical-shadow'),el('div','physical-back'),el('div','physical-pages'),spine,cover);
      bookObject.style.setProperty('--binding',button.style.getPropertyValue('--binding'));dialog.append(bookObject);
      dialog.showModal();document.body.classList.add('shelf-reading');button.classList.add('is-returning');close.focus();
      const p=poses(button);
      try {
        await motion(bookObject,[{transform:p[0]},{transform:p[1],offset:.3},{transform:p[2],offset:.75},{transform:p[3]}],1150);
        await motion(cover,[{transform:'rotateY(0deg)'},{transform:'rotateY(-165deg)'}],650);
        dialog.classList.add('is-open-book');
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
      for(let band=0;band<4;band++){const rib=el('i','binding-rib');rib.style.setProperty('--rib-position',[10,17,83,90][band]+'%');button.append(rib);}
      button.setAttribute('aria-label',book.title+' — kitabı aç');button.append(el('span','shelf-spine-title',book.title),el('span','shelf-spine-mark','✧'));button.onclick=()=>open(book,button);rack.append(button);
    });
    const carousel=el('div','library-carousel');
    const stage=el('div','library-cover-stage');stage.setAttribute('aria-label','Kaydırmalı kitap kapakları');
    const controls=el('div','library-cover-controls');
    const prev=el('button','','‹'),next=el('button','','›'),info=el('div','library-cover-info');
    prev.type=next.type='button';prev.setAttribute('aria-label','Önceki kitap');next.setAttribute('aria-label','Sonraki kitap');
    const selectedTitle=el('h3'),selectedAuthor=el('p'),read=el('button','','Notları oku');read.type='button';
    info.append(selectedTitle,selectedAuthor,read);controls.append(prev,info,next);carousel.append(stage,controls);rack.after(carousel);
    const carouselBooks=[];let currentCover=0;
    books.filter(book=>book.id?.startsWith('kitap-notlari/')&&book.title).forEach(book=>{
      const card=el('button','library-cover-book');card.type='button';card.setAttribute('aria-label',book.title+' kitabını seç');
      if(safe(book.cover)){const img=el('img');img.src=book.cover;img.alt=book.title;img.loading='lazy';img.decoding='async';img.onerror=()=>img.replaceWith(el('span','library-cover-fallback',book.title));card.append(img);}
      else card.append(el('span','library-cover-fallback',book.title));
      const item={book,card,filtered:false};carouselBooks.push(item);stage.append(card);
      card.onclick=()=>{const visible=carouselBooks.filter(b=>!b.filtered),index=visible.indexOf(item);if(index===currentCover)open(book,card);else renderCarousel(index);};
    });
    function renderCarousel(index){
      const visible=carouselBooks.filter(item=>!item.filtered);if(!visible.length)return;
      currentCover=(index+visible.length)%visible.length;
      carouselBooks.forEach(item=>{const i=visible.indexOf(item);let offset=i-currentCover;if(offset>visible.length/2)offset-=visible.length;if(offset< -visible.length/2)offset+=visible.length;
        item.card.hidden=item.filtered;item.card.style.setProperty('--offset',offset);item.card.style.setProperty('--distance',Math.abs(offset));item.card.style.zIndex=String(10-Math.abs(offset));item.card.classList.toggle('is-selected',i===currentCover);item.card.setAttribute('aria-pressed',String(i===currentCover));item.card.tabIndex=item.card.hidden?-1:0;
      });
      const active=visible[currentCover];
      requestAnimationFrame(()=>{if(!carousel.hidden)stage.scrollTo({left:Math.max(0,active.card.offsetLeft-stage.clientWidth/2+active.card.offsetWidth/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
      selectedTitle.textContent=active.book.title;selectedAuthor.textContent=active.book.author||'Kitap notları';read.onclick=()=>open(active.book,active.card);prev.disabled=next.disabled=visible.length<2;
    }
    prev.onclick=()=>renderCarousel(currentCover-1);next.onclick=()=>renderCarousel(currentCover+1);
    stage.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();renderCarousel(currentCover+(e.key==='ArrowRight'?1:-1));carouselBooks.filter(b=>!b.filtered)[currentCover].card.focus();}});
    function setList(list){section.classList.toggle('is-list',list);rack.hidden=!list;carousel.hidden=list;toggle.textContent=list?'Kaydırmalı kitaplar':'Liste görünümü';toggle.setAttribute('aria-pressed',String(list));}
    toggle.onclick=()=>{setList(!section.classList.contains('is-list'));renderCarousel(currentCover);};setList(false);renderCarousel(0);
    const heading=main.querySelector('.page-head');
    const legacy=[...main.children].filter(n=>n!==heading);
    const switcher=el('nav','library-design-switch');switcher.setAttribute('aria-label','Kitap Notları görünümü');
    const modern=el('button','','Kitaplık'), classic=el('button','','Eski Tasarım');
    modern.type=classic.type='button';switcher.append(modern,classic);
    let selected='modern';try{selected=localStorage.getItem('library-design')||selected;}catch{}
    function choose(value){
      const old=value==='classic';section.hidden=old;
      legacy.forEach(n=>n.hidden=!old);
      modern.setAttribute('aria-pressed',String(!old));classic.setAttribute('aria-pressed',String(old));
      try{localStorage.setItem('library-design',old?'classic':'modern');}catch{}
    }
    modern.onclick=()=>choose('modern');classic.onclick=()=>choose('classic');
    if(heading)heading.after(switcher,section);else main.prepend(switcher,section);
    choose(selected);
  }
  start().catch(()=>{/* Existing categories and notes stay usable. */});
})();
