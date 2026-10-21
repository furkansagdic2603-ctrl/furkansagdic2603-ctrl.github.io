(()=>{'use strict';
const root=document.getElementById('author-timeline');if(!root)return;
const search=document.getElementById('timeline-search');
const count=document.getElementById('timeline-count');
let items=[];
const fmtYear=y=>y<0?'MÖ '+Math.abs(y):String(y);
const norm=s=>String(s||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
function render(){
 const q=norm(search.value.trim());
 const list=items.filter(x=>!q||norm([x.name,x.era,x.birth,x.death].join(' ')).includes(q));
 count.textContent=list.length.toLocaleString('tr-TR')+' müellif';
 const eras=new Map();
 list.forEach(x=>{if(!eras.has(x.era))eras.set(x.era,[]);eras.get(x.era).push(x)});
 root.innerHTML=[...eras.entries()].map(([era,arr])=>'<section class="timeline-era"><header><span>'+era+'</span><small>'+arr.length+' isim</small></header><div class="timeline-era-line">'+arr.map(x=>'<a class="timeline-person" href="/muellif/'+x.slug+'/"><time>'+fmtYear(x.birth)+(x.death?'–'+fmtYear(x.death):'–')+'</time><strong>'+x.name+'</strong><small>'+x.count+' eser kütüphanemde</small></a>').join('')+'</div></section>').join('')||'<p class="empty">Eşleşen müellif bulunamadı.</p>';
}
search.addEventListener('input',render);
fetch('/data/author-timeline.json',{cache:'no-store'}).then(r=>r.json()).then(d=>{items=Array.isArray(d)?d:[];render()}).catch(()=>{root.innerHTML='<p class="empty">Zaman çizelgesi yüklenemedi.</p>'});
})();