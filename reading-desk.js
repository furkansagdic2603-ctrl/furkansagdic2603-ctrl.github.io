(() => {
  const nav=document.querySelector('.main-nav');if(nav&&!nav.querySelector('a[href="/su-an-masada/"]')){const a=document.createElement('a');a.href='/su-an-masada/';a.textContent='Şu An Masada';nav.prepend(a);}
  const path=location.pathname.replace(/\/$/,'');if(path!==''&&path!=='/su-an-masada')return;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;};
  const css=el('link');css.rel='stylesheet';css.href='/reading-desk.css?v=20261014-headers';document.head.append(css);
  async function applyHeader(){
    if(path!=='/su-an-masada')return;
    const hero=document.querySelector('.page-head');if(!hero)return;
    hero.classList.add('desk-hero');hero.dataset.deskDesign='tezhip';
    try{const response=await fetch('/data/reading-desk-design.json',{cache:'no-store'});if(response.ok){const config=await response.json();if(['tezhip','study'].includes(config.design))hero.dataset.deskDesign=config.design;}}catch{}
  }
  applyHeader();
  async function start(){
    const main=document.querySelector('main');if(!main)return;
    const section=el('section','reading-desk');section.setAttribute('aria-label','Şu an okuduğum kitaplar');
    const head=el('div','desk-heading');head.append(el('span','desk-kicker','FURKAN SAĞDIÇ’IN OKUMA MASASI'),el('h2','','Şu An Masada'),el('p','','Okumakta olduğum, not aldığım ve üzerinde düşündüğüm eserler.'));
    section.append(head);const host=el('div','desk-books');section.append(host);
    if(path==='') {const a=el('a','desk-more','Okuma masasına göz at →');a.href='/su-an-masada/';section.append(a);const hero=main.querySelector('.heritage-hero');if(hero)hero.after(section);else main.prepend(section);}else main.append(section);
    host.append(el('p','desk-empty','Okuma masası yükleniyor…'));
    try{const r=await fetch('/data/site-books.json',{cache:'no-store'});if(!r.ok)throw Error();const all=await r.json();const books=all.filter(b=>b.category==='kitap-notlari/su-an-masada');host.replaceChildren();
      if(!books.length)host.append(el('p','desk-empty','Masamdaki kitapları yakında burada paylaşacağım.'));
      books.forEach(book=>{const card=el('article','desk-book'),cover=el('div','desk-cover');if(/^\/assets\/uploads\/[a-zA-Z0-9_./-]+$/.test(book.cover||'')){const img=el('img');img.src=book.cover;img.alt=book.title+' kapağı';img.loading='lazy';img.onerror=()=>img.replaceWith(el('span','',book.title));cover.append(img);}else cover.append(el('span','',book.title));const body=el('div','desk-book-body');body.append(el('span','desk-status','Şu an okuyorum'),el('h3','',book.title));if(book.author)body.append(el('p','desk-author',book.author));if(book.description)body.append(el('p','desk-note',book.description));card.append(cover,body);host.append(card);});
    }catch{host.replaceChildren(el('p','desk-empty','Okuma masası yüklenemedi.'));const retry=el('button','','Yenile');retry.type='button';retry.onclick=()=>{section.remove();start();};host.append(retry);}
  }start();
})();
