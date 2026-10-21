(()=>{'use strict';
const form=document.getElementById('semantic-search-form');if(!form)return;
const input=document.getElementById('semantic-search-input');
const out=document.getElementById('semantic-result-groups');
const title=document.getElementById('semantic-result-title');
const count=document.getElementById('semantic-result-count');
const examples=[...document.querySelectorAll('.semantic-search-examples button')];
let data=null;
const typeNames={article:'Yazılar ve Notlar',book:'Kitaplar',author:'Müellifler',quote:'İktibaslar'};
const typeOrder=['article','book','author','quote'];
const norm=s=>String(s||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9çğıöşü]+/gi,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stop=new Set(['ve','veya','ile','icin','hakkinda','ilgili','nedir','neler','var','bir','bu','ne','mi','mu','mı','mü','in','ın','un','ün','anlayisi','anlayışı']);
function tokens(q){return norm(q).split(/\s+/).filter(x=>x.length>2&&!stop.has(x))}
function expand(q){
 const base=tokens(q), set=new Set(base);
 for(const t of base){
   for(const [key,vals] of Object.entries(data.synonyms||{})){
     if(norm(key)===t || vals.some(v=>norm(v)===t)){set.add(norm(key));vals.forEach(v=>norm(v).split(/\s+/).forEach(x=>x&&set.add(x)))}
   }
 }
 return [...set];
}
function detectedAuthors(q){
 const nq=' '+norm(q)+' ';
 return data.records.filter(r=>r.type==='author' && (' '+nq).includes(' '+norm(r.title)+' ') || (r.type==='author'&&norm(r.title).split(' ').some(x=>x.length>=5&&nq.includes(' '+x+' ')))).slice(0,5);
}
function score(r,q,terms,authors){
 const hay=norm([r.title,r.description,r.author,r.publisher,r.category,r.text].join(' '));
 const nt=norm(r.title), nq=norm(q);
 let s=0;
 if(nq&&hay.includes(nq))s+=120;
 if(nq&&nt.includes(nq))s+=160;
 for(const t of terms){
   if(!t)continue;
   if(nt.includes(t))s+=28;
   if(norm(r.author).includes(t))s+=34;
   const hits=hay.split(t).length-1;
   s+=Math.min(hits,5)*6;
 }
 for(const a of authors){
   const an=norm(a.title), surname=an.split(' ').at(-1);
   if(norm(r.author).includes(an)||norm(r.author).includes(surname))s+=90;
   if(r.type==='article'&&(r.semanticAuthors||[]).some(x=>x.author===a.url.split('/').filter(Boolean).at(-1)))s+=100;
   if(hay.includes(an)||hay.includes(surname))s+=40;
 }
 if(r.type==='author'&&authors.some(a=>a.url===r.url))s+=180;
 return s;
}
function excerpt(text,terms){
 const raw=String(text||'').replace(/\s+/g,' ').trim();if(!raw)return '';
 const n=norm(raw);let idx=-1;
 for(const t of terms){const i=n.indexOf(t);if(i>=0&&(idx<0||i<idx))idx=i}
 if(idx<0)return raw.slice(0,210)+(raw.length>210?'…':'');
 const start=Math.max(0,idx-80), end=Math.min(raw.length,start+240);
 return (start?'…':'')+raw.slice(start,end)+(end<raw.length?'…':'');
}
function run(q){
 if(!data){title.textContent='Arama dizini hazırlanıyor…';return}
 const terms=expand(q),authors=detectedAuthors(q);
 const scored=data.records.map(r=>({r,s:score(r,q,terms,authors)})).filter(x=>x.s>=18).sort((a,b)=>b.s-a.s).slice(0,80);
 title.textContent='“'+q+'” için semantik sonuçlar';
 count.textContent=scored.length.toLocaleString('tr-TR')+' sonuç';
 const grouped=new Map(typeOrder.map(t=>[t,[]]));
 scored.forEach(x=>grouped.get(x.r.type)?.push(x));
 out.innerHTML=typeOrder.map(type=>{
   const arr=grouped.get(type)||[];if(!arr.length)return '';
   return '<section class="semantic-result-section"><header><h2>'+typeNames[type]+'</h2><span>'+arr.length+'</span></header><div class="semantic-result-list">'+arr.slice(0,24).map(({r,s})=>'<a href="'+esc(r.url)+'"><div class="semantic-result-top"><small>'+typeNames[type].replace('lar','').replace('ler','')+'</small><em>'+Math.round(s)+' puan</em></div><strong>'+esc(r.title)+'</strong><p>'+esc(excerpt(r.description||r.text,terms))+'</p>'+(r.author?'<span>'+esc(r.author)+'</span>':'')+'</a>').join('')+'</div></section>';
 }).join('')||'<p class="empty">Bu sorgu için anlamlı bir eşleşme bulunamadı.</p>';
}
function submit(){const q=input.value.trim();if(!q)return;history.replaceState(null,'','?q='+encodeURIComponent(q));run(q)}
form.addEventListener('submit',e=>{e.preventDefault();submit()});
examples.forEach(b=>b.addEventListener('click',()=>{input.value=b.textContent.trim();submit()}));
fetch('/data/semantic-search.json',{cache:'no-store'}).then(r=>r.json()).then(d=>{data=d;const q=new URLSearchParams(location.search).get('q');if(q){input.value=q.slice(0,180);run(input.value)}}).catch(()=>{title.textContent='Arama dizini yüklenemedi.'});
})();