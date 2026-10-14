(() => {
  const article=document.querySelector('article[data-article="true"]');
  if(!article || !location.pathname.startsWith('/kitap-notlari/'))return;
  const path=location.pathname.replace(/\/*$/,'/');
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;};
  async function start(){
    const r=await fetch('/data/reading-series.json',{cache:'no-cache'});if(!r.ok)return;
    const data=await r.json();const series=data.find(s=>s.chapters.some(c=>c.url===path));if(!series)return;
    const index=series.chapters.findIndex(c=>c.url===path), key='series-progress:'+series.id;
    let progress={completed:[]};try{const saved=JSON.parse(localStorage.getItem(key));if(saved && Array.isArray(saved.completed))progress=saved;}catch{}
    progress.last=path;function save(){try{localStorage.setItem(key,JSON.stringify(progress));}catch{}}
    save();
    const css=el('link');css.rel='stylesheet';css.href='/series-navigation.css?v=20261014';document.head.append(css);
    const widgets=[];
    function link(text,url){const a=el('a','',text);a.href=url;return a;}
    function widget(full){
      const section=el('section','series-navigation');section.setAttribute('aria-label',series.title+' seri navigasyonu');
      const heading=el('div','series-heading');heading.append(link(series.title,series.url),el('span','','Bölüm '+(index+1)+' / '+series.chapters.length));section.append(heading);
      const nav=el('nav','series-directions');nav.setAttribute('aria-label','Önceki ve sonraki bölüm');
      if(index>0)nav.append(link('← Önceki Bölüm: '+series.chapters[index-1].title,series.chapters[index-1].url));else nav.append(el('span','series-boundary','Serinin ilk bölümü'));
      if(index+1<series.chapters.length)nav.append(link('Sonraki Bölüm: '+series.chapters[index+1].title+' →',series.chapters[index+1].url));else nav.append(el('span','series-boundary','Serinin son bölümü'));
      section.append(nav);
      if(full){
        const status=el('p','series-status');status.setAttribute('aria-live','polite');
        const meter=el('progress');meter.max=series.chapters.length;meter.setAttribute('aria-label','Tamamlanan bölümler');
        const button=el('button','series-mark');button.type='button';button.onclick=()=>{progress.completed=progress.completed.includes(path)?progress.completed.filter(p=>p!==path):[...progress.completed,path];save();refresh();};
        const details=el('details','series-all'),summary=el('summary','','Tüm bölümler');details.append(summary);
        series.chapters.forEach((c,i)=>{const a=link((i+1)+'. '+c.title,c.url);if(c.url===path)a.setAttribute('aria-current','page');a.dataset.chapter=c.url;details.append(a);});
        section.append(status,meter,button,details,el('small','series-local','Okuma ilerlemesi bu tarayıcıda saklanır.'));widgets.push({status,meter,button,details});
      }
      return section;
    }
    function refresh(){const count=series.chapters.filter(c=>progress.completed.includes(c.url)).length;widgets.forEach(w=>{w.status.textContent=count+' / '+series.chapters.length+' bölüm tamamlandı';w.meter.value=count;const done=progress.completed.includes(path);w.button.textContent=done?'✓ Okundu — işareti kaldır':'Bu bölümü okudum';w.button.setAttribute('aria-pressed',String(done));w.details.querySelectorAll('a').forEach(a=>a.classList.toggle('is-read',progress.completed.includes(a.dataset.chapter)));});}
    document.querySelectorAll('.chapter-navigation').forEach(n=>n.remove());
    const head=document.querySelector('.article-head');if(head)head.after(widget(false));else article.before(widget(false));article.after(widget(true));refresh();
  }
  start().catch(()=>{});
})();
