(()=>{'use strict';
const root=document.getElementById('library-dashboard');if(!root)return;
const statsEl=document.getElementById('library-stat-grid');
const catsEl=document.getElementById('library-category-bars');
const authorsEl=document.getElementById('library-top-authors');
const pubsEl=document.getElementById('library-top-publishers');
const fmt=n=>Number(n||0).toLocaleString('tr-TR');
fetch('/data/library-stats.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{
  const stats=[
    ['Kitap',d.totalBooks,'Kayıtlı eser'],
    ['Müellif',d.totalAuthors,'Tekilleştirilmiş yazar'],
    ['Yayınevi',d.totalPublishers,'Farklı yayınevi'],
    ['Tercüme kaydı',d.translatedRecords,'Mütercim bilgisi bulunan'],
    ['Yazı / not',d.articleCount,'Sitedeki içerik'],
    ['İktibas',d.quoteCount,'Alıntı kaydı']
  ];
  statsEl.innerHTML=stats.map(([label,value,note])=>'<article><span>'+label+'</span><strong>'+fmt(value)+'</strong><small>'+note+'</small></article>').join('');
  const cats=Object.entries(d.categories||{}).sort((a,b)=>b[1]-a[1]);
  const max=Math.max(1,...cats.map(x=>x[1]));
  catsEl.innerHTML=cats.map(([name,count])=>'<div class="library-bar-row"><div><strong>'+name+'</strong><span>'+fmt(count)+' eser</span></div><i><b style="width:'+Math.round(count/max*100)+'%"></b></i></div>').join('');
  authorsEl.innerHTML=(d.topAuthors||[]).map((a,i)=>'<a href="/muellif/'+a.slug+'/"><b>'+String(i+1).padStart(2,'0')+'</b><span>'+a.name+'</span><strong>'+fmt(a.count)+'</strong></a>').join('');
  pubsEl.innerHTML=(d.topPublishers||[]).map((p,i)=>'<div><b>'+String(i+1).padStart(2,'0')+'</b><span>'+p.name+'</span><strong>'+fmt(p.count)+'</strong></div>').join('');
}).catch(()=>{root.innerHTML='<p class="empty">Kütüphane istatistikleri yüklenemedi.</p>'});
})();