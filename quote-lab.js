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

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const colorFor=x=>x?.color||tone[x?.category]||'rose';
  const chapterIndex=x=>Math.max(0,roman.indexOf(x?.chapter));
  const xFor=x=>{
    const base=chapterIndex(x);
    const micro=x?.page?Math.min(.82,(Number(x.page)%19)/24):.42;
    return Math.max(1.5,Math.min(98.5,((base+micro)/9)*100));
  };
  const visibleItems=()=>state.items.filter(x=>(state.label==='all'||(x.label||'')===state.label)&&(state.category==='all'||x.category===state.category));

  function renderFilters(){
    const labelCounts=new Map();
    state.items.forEach(x=>{const k=(x.label||'').trim();if(k)labelCounts.set(k,(labelCounts.get(k)||0)+1)});
    const top=[...labelCounts].sort((a,b)=>b[1]-a[1]).slice(0,6);
    el.people.innerHTML='<button type="button" class="'+(state.label==='all'?'is-on':'')+'" data-label="all">Tümü <small>'+state.items.length+'</small></button>'+
      top.map(([k,n])=>'<button type="button" class="'+(state.label===k?'is-on':'')+'" data-label="'+esc(k)+'">'+esc(k)+' <small>'+n+'</small></button>').join('');
    const cats=['all','idea','author','place','style','concept'];
    el.modes.innerHTML=cats.map(k=>{
      const n=k==='all'?state.items.length:state.items.filter(x=>x.category===k).length;
      return '<button type="button" class="'+(state.category===k?'is-on':'')+'" data-category="'+k+'">'+names[k]+' <small>'+n+'</small></button>';
    }).join('');
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
    el.notes.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>selectById(b.dataset.id,true));
  }

  function renderTimeline(){
    const items=visibleItems();
    const by=new Map();
    items.forEach(x=>{
      const k=(x.label||names[x.category]||'Alıntı').trim();
      if(!by.has(k))by.set(k,[]);
      by.get(k).push(x);
    });
    const rows=[...by.entries()].slice(0,6);
    el.rows.innerHTML=rows.map(([k,list])=>'<div class="timeline-row"><b title="'+esc(k)+'">'+esc(k)+'</b>'+
      list.map(x=>'<button type="button" class="timeline-dot '+(state.selected?.id===x.id?'is-active':'')+'" data-id="'+esc(x.id)+'" style="--x:'+xFor(x)+'%;--dot:'+toneHex[colorFor(x)]+'" aria-label="'+esc((x.label||names[x.category])+' '+(x.chapter||''))+'"></button>').join('')+
      '</div>').join('');
    el.rows.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>selectById(b.dataset.id,true));
    updateCursor();
  }

  function bookContext(item){
    const peers=state.items.filter(x=>x.id!==item.id && ((item.label&&x.label===item.label)||x.category===item.category)).slice(0,4);
    if(!peers.length)return 'Bu alıntı için henüz başka bağlam kaydı yok. Yeni alıntılar eklendikçe bu sayfa bir okuma haritasına dönüşecek.';
    return peers.map(x=>x.text).join(' ');
  }

  function updateBook(item,turn){
    if(!item)return;
    el.kicker.textContent=(names[item.category]||'Alıntı')+' · '+(item.chapter||'I');
    el.label.textContent=item.label||'İktibas';
    el.text.textContent=item.text;
    el.leftContext.textContent=bookContext(item);
    el.leftNo.textContent=item.page?Math.max(1,Number(item.page)-1):chapterIndex(item)*2+1;
    el.pageNo.textContent=item.page||chapterIndex(item)*2+2;
    el.book.classList.add('is-open');
    if(turn){
      el.book.classList.remove('is-turning');
      void el.book.offsetWidth;
      el.book.classList.add('is-turning');
      setTimeout(()=>el.book.classList.remove('is-turning'),820);
    }
    updateCursor();
  }

  function updateCursor(){
    if(!state.selected){el.cursor.style.left='8%';el.cursor.querySelector('em').textContent='';return}
    const x=xFor(state.selected);
    el.cursor.style.left=x+'%';
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
    renderFilters();
    renderNotes();
    renderTimeline();
    if(filterChanged){
      const vis=visibleItems();
      if(state.selected && !vis.some(x=>x.id===state.selected.id))state.selected=null;
      root.classList.remove('is-filtering');void root.offsetWidth;root.classList.add('is-filtering');
      setTimeout(()=>root.classList.remove('is-filtering'),420);
      if(!state.selected)el.book.classList.remove('is-open');
    }
  }

  async function load(){
    try{
      const r=await fetch('/data/quotes.json?ts='+Date.now(),{cache:'no-store'});
      state.items=r.ok?await r.json():[];
      if(!Array.isArray(state.items))state.items=[];
      renderAll(false);
    }catch(err){
      console.warn('Alıntı verileri yüklenemedi',err);
      state.items=[];
      renderAll(false);
    }
  }

  el.book.addEventListener('click',()=>el.book.classList.toggle('is-open'));
  el.book.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.book.classList.toggle('is-open')}});
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