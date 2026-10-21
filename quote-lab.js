(()=> {
  const root=document.querySelector('.quote-lab');
  if(!root) return;

  const el={
    people:root.querySelector('#quote-character-filters'),
    modes:root.querySelector('#quote-mode-filters'),
    notes:root.querySelector('#quote-notes'),
    book:root.querySelector('#quote-book'),
    scene:root.querySelector('#quote-book-scene'),
    leftContext:root.querySelector('#quote-page-context'),
    leftNo:root.querySelector('#quote-page-left-number'),
    kicker:root.querySelector('#quote-page-kicker'),
    label:root.querySelector('#quote-page-label'),
    text:root.querySelector('#quote-page-text'),
    pageNo:root.querySelector('#quote-page-number'),
    rows:root.querySelector('#quote-timeline-rows'),
    cursor:root.querySelector('#quote-timeline-cursor')
  };
  const names={all:'Tümü',idea:'Düşünce',author:'Müellif',place:'Mekân',style:'Üslup',concept:'Kavram'};
  const tone={idea:'rose',author:'mint',place:'blue',style:'amber',concept:'rose'};
  const toneHex={rose:'#c87758',mint:'#5b9875',blue:'#668bad',amber:'#ba9934'};
  const roman=['I','II','III','IV','V','VI','VII','VIII','IX'];
  const state={items:[],label:'all',category:'all',selected:null};
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let turnTimer=0, openTimer=0, generation=0;
  const sheet=el.book.querySelector('.book-turn-sheet');
  const controls=document.createElement('div');
  controls.className='quote-book-controls';
  controls.innerHTML='<button type="button" data-step="-1" aria-label="Önceki alıntı">←</button><span class="quote-book-status" role="status">Bir alıntı seç · Kitabı aç</span><button type="button" data-step="1" aria-label="Sonraki alıntı">→</button>';
  el.scene.after(controls);
  const status=controls.querySelector('span');
  el.book.setAttribute('aria-expanded','false');
  el.book.setAttribute('aria-controls','quote-page-text');
  const help=document.createElement('p');help.className='quote-lab-help';
  help.textContent='Kâğıtları ve haritadaki izleri seçerek alıntılar arasında dolaş.';
  controls.after(help);
  const pop=document.createElement('div');pop.className='quote-slip-preview';pop.setAttribute('aria-hidden','true');root.append(pop);
  const hidePreview=()=>{pop.classList.remove('is-visible');};
  const showPreview=b=>{
    if(!b || !matchMedia('(hover: hover)').matches)return;
    const item=state.items.find(x=>x.id===b.dataset.id);if(!item)return;
    pop.textContent=item.text;pop.classList.add('is-visible');
    const box=b.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
    pop.style.left=Math.max(12,Math.min(innerWidth-w-12,box.left+box.width/2-w/2))+'px';
    pop.style.top=Math.max(12,Math.min(innerHeight-h-12,box.top+box.height/2-h/2))+'px';
  };
  addEventListener('scroll',hidePreview,true);addEventListener('resize',hidePreview);
  function openBook(open){
    clearTimeout(openTimer);
    el.book.classList.toggle('is-open',open);
    el.book.classList.remove('is-opening');
    el.book.setAttribute('aria-expanded',String(open));
    el.scene.classList.toggle('has-open-book',open);
  }
  function navigate(step){
    const list=visibleItems();if(!list.length)return;
    const i=list.findIndex(x=>x.id===state.selected?.id);
    selectById(list[(i+step+list.length)%list.length].id,true);
  }
  controls.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>navigate(Number(b.dataset.step)));
  el.scene.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();navigate(e.key==='ArrowRight'?1:-1);}});


  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const colorFor=x=>x?.color||tone[x?.category]||'rose';
  const chapterIndex=x=>Math.max(0,roman.indexOf(x?.chapter));
  const xFor=x=>{
    const chapter=chapterIndex(x), same=state.items.filter(y=>chapterIndex(y)===chapter);
    const pages=same.map(y=>Number(y.page)).filter(n=>Number.isFinite(n)&&n>0);
    const min=Math.min(...pages),max=Math.max(...pages),page=Number(x.page);
    const fraction=pages.length&&max>min?(page-min)/(max-min):.5;
    return ((chapter+.12+fraction*.76)/9)*100;
  };
  const visibleItems=()=>state.items.filter(x=>(state.label==='all'||(x.label||'')===state.label)&&(state.category==='all'||x.category===state.category));

  function renderFilters(){
    const labelCounts=new Map();
    state.items.forEach(x=>{const k=(x.label||'').trim();if(k)labelCounts.set(k,(labelCounts.get(k)||0)+1)});
    const top=[...labelCounts].sort((a,b)=>b[1]-a[1]);
    el.people.innerHTML='<button type="button" class="'+(state.label==='all'?'is-on':'')+'" data-label="all">Tümü <small>'+state.items.length+'</small></button>'+
      top.map(([k,n])=>'<button type="button" class="'+(state.label===k?'is-on':'')+'" data-label="'+esc(k)+'">'+esc(k)+' <small>'+n+'</small></button>').join('');
    const cats=['all','idea','author','place','style','concept'];
    el.modes.innerHTML=cats.map(k=>{
      const n=k==='all'?state.items.length:state.items.filter(x=>x.category===k).length;
      return '<button type="button" class="'+(state.category===k?'is-on':'')+'" data-category="'+k+'">'+names[k]+' <small>'+n+'</small></button>';
    }).join('');
    root.querySelectorAll('.quote-filter-row button').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('is-on'))));
    el.people.querySelectorAll('button').forEach(b=>b.onclick=()=>{state.label=b.dataset.label;renderAll(true)});
    el.modes.querySelectorAll('button').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;renderAll(true)});
  }

  function grouped(items){
    const map=new Map();
    const byLabel=state.category!=='all' && state.label==='all';
    items.forEach(x=>{
      const key=byLabel?((x.label||'İsimsiz').trim()||'İsimsiz'):x.category;
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(x);
    });
    return [...map.entries()];
  }

  function renderNotes(){
    const items=visibleItems();
    if(!items.length){
      el.notes.innerHTML='<div class="quote-empty">Bu süzgeçte henüz alıntı yok. Admin panelinden yeni kayıt eklediğinde burada kâğıt parçaları halinde görünecek.</div>';
      return;
    }
    const groups=grouped(items);
    el.notes.innerHTML=groups.map(([key,list],gi)=>{
      const byLabel=state.category!=='all' && state.label==='all';
      const heading=byLabel?key:(names[key]||key);
      const c=colorFor(list[0]);
      return '<section class="quote-note-group"><h3 class="quote-tape '+esc(c)+'">'+esc(heading)+' <small>'+list.length+'</small></h3><div class="quote-fragment-wrap">'+
        list.map((x,i)=>'<button type="button" class="quote-fragment '+(state.selected?.id===x.id?'is-active':'')+'" data-id="'+esc(x.id)+'" style="--delay:'+((gi*3+i)*28)+'ms" title="'+esc(x.label||heading)+'">'+esc(x.text)+'</button>').join('')+
        '</div></section>';
    }).join('');
    el.notes.querySelectorAll('[data-id]').forEach(b=>{
      b.setAttribute('aria-pressed',String(b.dataset.id===state.selected?.id));
      b.onclick=()=>{hidePreview();selectById(b.dataset.id,true);};
      b.onpointerenter=()=>showPreview(b);b.onpointerleave=hidePreview;
      b.onfocus=()=>showPreview(b);b.onblur=hidePreview;
    });
  }

  function renderTimeline(){
    const items=visibleItems();
    const by=new Map();
    items.forEach(x=>{
      const k=(x.label||names[x.category]||'Alıntı').trim();
      if(!by.has(k))by.set(k,[]);
      by.get(k).push(x);
    });
    const rows=[...by.entries()];
    el.rows.innerHTML=rows.map(([k,list])=>'<div class="timeline-row"><b title="'+esc(k)+'">'+esc(k)+'</b>'+
      list.map(x=>'<button type="button" class="timeline-dot '+(state.selected?.id===x.id?'is-active':'')+'" data-id="'+esc(x.id)+'" style="--x:'+xFor(x)+'%;--dot:'+(toneHex[colorFor(x)]||toneHex.rose)+'" aria-label="'+esc((x.label||names[x.category])+' '+(x.chapter||''))+'"></button>').join('')+
      '</div>').join('');
    el.rows.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>selectById(b.dataset.id,true));
    updateCursor();
  }

  function bookContext(item){
    if(item.context)return String(item.context);
    const peers=state.items.filter(x=>x.id!==item.id && ((item.label&&x.label===item.label)||x.category===item.category)).slice(0,4);
    if(!peers.length)return (item.label||'İktibas defteri')+' · '+(names[item.category]||'Alıntı')+'\n\n'+(item.source||'')+'\n'+(item.chapter?'Bölüm '+item.chapter:'')+(item.page?' · Sayfa '+item.page:'');
    return peers.map(x=>x.text).join(' ');
  }

  function updateBook(item,turn){
    if(!item)return;
    const ticket=++generation, previous=Number(el.pageNo.textContent)||0;
    clearTimeout(turnTimer);
    const paint=()=>{
      if(ticket!==generation)return;
      el.kicker.textContent=(names[item.category]||'Alıntı')+' · '+(item.chapter||'I');
      el.label.textContent=item.label||'İktibas';
      el.text.textContent=item.text;
      el.leftContext.textContent=bookContext(item);
      const page=Number(item.page)||chapterIndex(item)*2+2;
      el.leftNo.textContent=Math.max(1,page-1);el.pageNo.textContent=page;
      status.textContent=(item.label||'İktibas')+' · '+(item.chapter||'I')+' · s. '+page;
    };
    const wasOpen=el.book.classList.contains('is-open');
    el.book.classList.remove('is-turning','turn-back');
    if(turn&&wasOpen&&!reduced()){
      sheet.replaceChildren();
      const copy=el.book.querySelector('.book-page-right').cloneNode(true);
      copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
      copy.className='turn-copy';sheet.append(copy);
      el.book.classList.toggle('turn-back',(Number(item.page)||0)<previous);
      void el.book.offsetWidth;el.book.classList.add('is-turning');
      turnTimer=setTimeout(()=>{paint();el.book.classList.remove('is-turning','turn-back');},980);
    }else{paint();openBook(true);}
    updateCursor();
  }

  function updateCursor(){
    if(!state.selected){el.cursor.style.left='8%';el.cursor.querySelector('em').textContent='';return}
    const x=xFor(state.selected);
    el.cursor.style.left='calc(76px + (100% - 76px) * '+(x/100)+')';
    el.cursor.querySelector('em').textContent=(state.selected.page?'s. '+state.selected.page:(state.selected.chapter||''));
  }

  function selectById(id,turn){
    const item=state.items.find(x=>x.id===id);
    if(!item)return;
    state.selected=item;
    renderNotes();
    renderTimeline();
    updateBook(item,turn);
  }

  function renderAll(filterChanged=false){
    hidePreview();
    if(filterChanged&&state.selected&&!visibleItems().some(x=>x.id===state.selected.id)){
      state.selected=null;++generation;clearTimeout(turnTimer);openBook(false);
      el.book.classList.remove('is-turning','turn-back');
      status.textContent='Bir alıntı seç · Kitabı aç';
    }
    const old=new Map([...el.notes.querySelectorAll('[data-id]')].map(n=>[n.dataset.id,n.getBoundingClientRect()]));
    renderFilters();renderNotes();renderTimeline();
    if(filterChanged&&!reduced()){
      el.notes.querySelectorAll('[data-id]').forEach(n=>{
        const a=old.get(n.dataset.id),b=n.getBoundingClientRect();
        if(a)n.animate([{transform:'translate('+(a.left-b.left)+'px,'+(a.top-b.top)+'px)',opacity:.4},{transform:'translate(0,0)',opacity:1}],{duration:620,easing:'cubic-bezier(.2,.75,.2,1)'});
      });
    }
    controls.querySelectorAll('button').forEach(b=>b.disabled=!visibleItems().length);
  }

  async function load(){
    try{
      const r=await fetch('/data/quotes.json?ts='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      state.items=await r.json();
      if(!Array.isArray(state.items))throw new Error('Geçersiz alıntı verisi');
      state.items=state.items.filter(x=>x&&typeof x.id==='string'&&typeof x.text==='string');
      renderAll(false);
      const wanted=new URLSearchParams(location.search).get('quote');
      if(wanted)selectById(wanted,true);
    }catch(err){
      console.warn('Alıntı verileri yüklenemedi',err);
      state.items=[];
      renderAll(false);
      el.notes.innerHTML='<div class="quote-empty" role="alert">Alıntılar yüklenemedi. <button type="button">Yeniden dene</button></div>';
      el.notes.querySelector('button').onclick=load;
    }
  }

  function toggleBook(){
    ++generation;clearTimeout(turnTimer);el.book.classList.remove('is-turning','turn-back');
    if(!el.book.classList.contains('is-open')&&!state.selected){
      const item=visibleItems()[0];if(item){selectById(item.id,false);return;}
    }
    if(!el.book.classList.contains('is-open')&&state.selected){updateBook(state.selected,false);return;}
    openBook(!el.book.classList.contains('is-open'));
  }
  el.book.addEventListener('click',toggleBook);
  el.book.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleBook();}});
  let raf=0;
  el.scene.addEventListener('pointermove',e=>{
    if(el.book.classList.contains('is-open')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const r=el.scene.getBoundingClientRect(),dx=(e.clientX-r.left)/r.width-.5,dy=(e.clientY-r.top)/r.height-.5;
      el.scene.style.setProperty('--tilt-y',(dx*4.2)+'deg');
      el.scene.style.setProperty('--tilt-x',(-dy*2.7)+'deg');
    });
  });
  el.scene.addEventListener('pointerleave',()=>{el.scene.style.setProperty('--tilt-y','0deg');el.scene.style.setProperty('--tilt-x','0deg')});
  load();
})();