const menu=document.getElementById('menu-buton');const nav=document.getElementById('ana-menu');if(menu&&nav)menu.addEventListener('click',()=>{const open=nav.classList.toggle('acik');menu.setAttribute('aria-expanded',String(open))});
const search=document.getElementById('site-search');if(search){const initial=new URLSearchParams(location.search).get('q');if(initial){search.value=initial.slice(0,160);const header=document.getElementById('header-query');if(header)header.value=search.value}fetch('/articles.json').then(r=>r.json()).then(items=>{const output=document.getElementById('search-results'),count=document.getElementById('result-count');function render(){const q=search.value.trim().toLocaleLowerCase('tr');const found=q?items.filter(a=>(a.title+' '+a.description+' '+a.category).toLocaleLowerCase('tr').includes(q)):items;output.replaceChildren(...found.map(a=>{const article=document.createElement('article');article.className='entry';const meta=document.createElement('div');meta.className='eyebrow';meta.textContent=a.category+' · '+(window.publicationDateText?.(a.date) || a.date);const heading=document.createElement('h3');const link=document.createElement('a');link.href=a.url;link.textContent=a.title;heading.append(link);const p=document.createElement('p');p.textContent=a.description;if(a.cover){const cover=document.createElement('a');cover.className='entry-cover';cover.href=a.url;const img=document.createElement('img');img.src=a.cover;img.alt='';img.loading='lazy';img.width=a.coverWidth||640;img.height=a.coverHeight||360;img.decoding="async";cover.append(img);article.append(cover)}article.append(meta,heading,p);return article}));count.textContent=found.length+' yazı bulundu.'}search.addEventListener('input',render);render()}).catch(()=>{document.getElementById('result-count').textContent='Yazılar yüklenemedi.'})}

// Reading positions stay in this browser; no account or server request is needed.
(() => {
  const storageKey = 'furkan-reading-progress-v1';
  const read = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; }
    catch { return {}; }
  };
  const write = entries => {
    try { localStorage.setItem(storageKey, JSON.stringify(entries)); }
    catch { /* Browsers can disable or limit local storage. */ }
  };
  const article = document.querySelector('article.yazi-icerik[data-article]');
  if (article) {
    const url = location.pathname.replace(/\/?$/, '/');
    const title = document.querySelector('.article-head h1')?.textContent.trim() || document.title;
    const saved = read()[url];
    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const resume = () => scrollTo({ top: Math.min(saved.y, maxScroll()), behavior: 'smooth' });
    if (saved && Number.isFinite(saved.y) && saved.y > 500) {
      const banner = document.createElement('div');
      banner.className = 'resume-banner';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Kaldığın yerden devam et';
      button.addEventListener('click', resume);
      const note = document.createElement('small');
      note.textContent = 'Okuma konumun bu tarayıcıda saklandı.';
      banner.append(button, note);
      document.querySelector('.article-head')?.append(banner);
      if (new URLSearchParams(location.search).has('devam')) addEventListener('load', resume, { once: true });
    }
    let timer;
    const save = () => {
      const entries = read();
      const limit = maxScroll();
      const y = Math.round(scrollY);
      if (limit < 900) return;
      if (y >= limit - 120 || article.getBoundingClientRect().bottom <= innerHeight + 80) delete entries[url];
      else if (y > 500) entries[url] = { url, title, y, progress: Math.round(y / limit * 100), updated: Date.now() };
      const recent = Object.values(entries).filter(item => item && Number.isFinite(item.updated)).sort((a, b) => b.updated - a.updated).slice(0, 40);
      write(Object.fromEntries(recent.map(item => [item.url, item])));
    };
    addEventListener('scroll', () => { clearTimeout(timer); timer = setTimeout(save, 250); }, { passive: true });
    addEventListener('pagehide', save);
  }
  const home = document.getElementById('resume-reading');
  if (home) {
    const recent = Object.values(read()).filter(item => item && /^\/[a-z0-9/-]+\/$/.test(item.url) && item.title && Number.isFinite(item.updated)).sort((a, b) => b.updated - a.updated)[0];
    if (recent) {
      const link = document.getElementById('resume-reading-link');
      link.textContent = recent.title + ' →';
      link.href = recent.url + '?devam=1';
      document.getElementById('resume-reading-detail').textContent = `Yaklaşık %${Math.min(99, Math.max(1, recent.progress || 1))} okundu`;
      home.hidden = false;
    }
  }
})();


/* Perspective book showcase. */
(() => {
  const stage=document.querySelector('.book-cinema-stage');
  if(!stage) return;
  const books=[...stage.querySelectorAll('.cinema-book')], caption=document.querySelector('.book-cinema-caption');
  let active=Math.min(2,books.length-1), downX=null, openTimer=null;
  const mobile=()=>matchMedia('(max-width:700px)').matches;
  function render(){
    const step=mobile()?92:132;
    books.forEach((book,i)=>{
      const d=i-active, ad=Math.abs(d);
      book.style.setProperty('--x',(d*step)+'px');
      book.style.setProperty('--z',(ad===0?105:-58-ad*58)+'px');
      book.style.setProperty('--ry',(d===0?-2:(d<0?46:-46))+'deg');
      book.style.setProperty('--scale',String(ad===0?1.035:Math.max(.68,.94-ad*.075)));
      book.style.zIndex=String(20-ad);
      book.classList.toggle('is-active',d===0);
      book.setAttribute('aria-current',d===0?'true':'false');
      book.tabIndex=d===0?0:-1;
    });
    caption.textContent=books[active]?.dataset.title||'';
  }
  function openActive(){
    clearTimeout(openTimer);
    books.forEach(b=>b.classList.remove('is-open'));
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    openTimer=setTimeout(()=>books[active]?.classList.add('is-open'),420);
  }
  function settle(){
    const book=books[active];
    if(!book || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    book.classList.remove('is-settling');
    void book.offsetWidth;
    book.classList.add('is-settling');
    setTimeout(()=>book.classList.remove('is-settling'),760);
  }
  function move(dir){active=(active+dir+books.length)%books.length;render();settle();openActive()}
  stage.querySelector('.book-cinema-prev')?.addEventListener('click',()=>move(-1));
  stage.querySelector('.book-cinema-next')?.addEventListener('click',()=>move(1));
  books.forEach((book,i)=>book.addEventListener('click',e=>{if(i!==active || book.getAttribute('href')==='#'){e.preventDefault();if(i!==active){active=i;render();settle();openActive()}}}));
  stage.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1)}if(e.key==='ArrowRight'){e.preventDefault();move(1)}});
  stage.addEventListener('pointerdown',e=>{downX=e.clientX});
  stage.addEventListener('pointerup',e=>{if(downX===null)return;const dx=e.clientX-downX;downX=null;if(Math.abs(dx)>35)move(dx<0?1:-1)});
  addEventListener('resize',render,{passive:true});
  render();
  openActive();
})();

// Display original PDF documents without converting them to plain text.
if (document.querySelector('article.yazi-icerik .pdf-original')) {
  import('/pdf-reader.js?v=20261005-widepdf').then(module => module.initPdfReaders()).catch(console.error);
}
