const menu=document.getElementById('menu-buton');const nav=document.getElementById('ana-menu');if(menu&&nav)menu.addEventListener('click',()=>{const open=nav.classList.toggle('acik');menu.setAttribute('aria-expanded',String(open))});
const search=document.getElementById('site-search');if(search){fetch('/articles.json').then(r=>r.json()).then(items=>{const output=document.getElementById('search-results'),count=document.getElementById('result-count');function render(){const q=search.value.trim().toLocaleLowerCase('tr');const found=q?items.filter(a=>(a.title+' '+a.description+' '+a.category).toLocaleLowerCase('tr').includes(q)):items;output.replaceChildren(...found.map(a=>{const article=document.createElement('article');article.className='entry';const meta=document.createElement('div');meta.className='eyebrow';meta.textContent=a.category+' · '+a.date;const heading=document.createElement('h3');const link=document.createElement('a');link.href=a.url;link.textContent=a.title;heading.append(link);const p=document.createElement('p');p.textContent=a.description;article.append(meta,heading,p);return article}));count.textContent=found.length+' yazı bulundu.'}search.addEventListener('input',render);render()}).catch(()=>{document.getElementById('result-count').textContent='Yazılar yüklenemedi.'})}

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
