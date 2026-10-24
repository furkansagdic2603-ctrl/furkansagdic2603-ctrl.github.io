(()=>{'use strict';
const index=document.querySelector('[data-author-index]');
if(index){const input=index.querySelector('#author-index-search'),status=index.querySelector('#author-index-status'),rows=[...index.querySelectorAll('[data-author-name]')];
 const norm=s=>s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
 const filter=()=>{const q=norm(input.value);let n=0;rows.forEach(r=>{r.hidden=!norm(r.dataset.authorName).includes(q);if(!r.hidden)n++;});index.querySelectorAll('.author-letter').forEach(g=>g.hidden=![...g.querySelectorAll('[data-author-name]')].some(r=>!r.hidden));status.textContent=n+' müellif / katalog adı';};input.addEventListener('input',filter);filter();
}
const root=document.querySelector('[data-author-research]');if(!root)return;
const search=root.querySelector('#dossier-search'),source=root.querySelector('#dossier-source'),list=root.querySelector('#dossier-works'),status=root.querySelector('#dossier-status');
if(!search||!source||!list)return;
const normalize=s=>s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
const rows=[...list.children].map(row=>({row,text:normalize(row.textContent),kind:row.dataset.workSource}));
function filter(){const q=normalize(search.value.trim());let count=0;for(const {row,text,kind} of rows){const visible=(!q||text.includes(q))&&(source.value==='all'||source.value===kind);row.hidden=!visible;if(visible)count++;}status.textContent=count.toLocaleString('tr-TR')+' / '+rows.length.toLocaleString('tr-TR')+' kayıt';root.querySelector('.dossier-no-results').hidden=count>0;}
search.addEventListener('input',filter);source.addEventListener('change',filter);
// Static content survives blocked external APIs, disabled storage and failed images.
for(const img of document.querySelectorAll('.dossier-portrait img'))img.addEventListener('error',()=>{img.hidden=true;const note=document.createElement('p');note.className='dossier-photo-error';note.textContent='Portre yüklenemedi; görsel kaynağını aşağıdaki bağlantıdan açabilirsiniz.';img.after(note);},{once:true});
})();
