(async()=>{
 const get=id=>document.getElementById(id);
 const make=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 const anchor=(text,href)=>{const a=make('a',text);a.href=href;return a;};
 const route=(key,value)=>'?'+new URLSearchParams({[key]:value});
 const source=path=>new URL(path,'https://www.koprudergisi.com').href;
 const norm=text=>String(text??'').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]+/g,' ').trim();
 const params=new URLSearchParams(location.search);
 let data;
 try{
  const bytes=Uint8Array.from(atob(window.kopruArchive),x=>x.charCodeAt(0));
  data=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
 }catch{get('status').textContent='Dizin yüklenemedi. Kaynak arşivi yukarıdaki bağlantıdan açabilirsin.';return;}
 const [issues,articles]=data;
 const numbered=issues.map((issue,id)=>({issue,id})).filter(x=>x.issue[0]).sort((a,b)=>parseInt(b.issue[0])-parseInt(a.issue[0]));
 const taxonomy=[
  ['Din ve inanç / Tefsir, iman ve ibadet',/\b(kuran|tefsir|iman|ibadet|nubuvvet|ayet|hadis)\b/],
  ['Din ve inanç / Risale-i Nur, şerh ve izah',/risale i nur|serh ve izah|said nursi|bediuzzaman/],
  ['Din ve toplum / Cemaat, laiklik ve Diyanet',/cemaat|laiklik|diyanet|mesihat|din devlet/],
  ['Siyaset ve hukuk / Demokrasi, cumhuriyet ve anayasa',/demokra|cumhuriyet|anayasa|mesveret|mesrutiyet/],
  ['Siyaset ve hukuk / Adalet, hürriyet ve insan hakları',/adalet|hurriyet|hukuk|insan haklari|liyakat/],
  ['Toplum ve kültür / Kadın, aile ve gençlik',/kadin|\baile|evlilik|genclik|cocuk/],
  ['Toplum ve kültür / Medeniyet, modernleşme ve barış',/medeniyet|modernlesme|baris|milliyet|kuresellesme/],
  ['Eğitim ve bilim / Eğitim, fen ve tıp',/egitim|medresetuzzehra|bilim|\bfen\b|\btip\b|genetik/],
  ['Felsefe ve sanat / Ahlâk, estetik ve edebiyat',/ahlak|estetik|edebiyat|felsefe|sanat|muzik/],
  ['İktisat / Emek, yoksulluk ve ekonomi',/iktisat|ekonomi|yoksulluk|isgucu|maise/],
  ['Tarih / Osmanlı, savaş ve siyasal dönüşüm',/osmanli|harb|savas|devlet i aliyye/]
 ];
 const verified={'/bahar-1994/mesihattan-diyanete/':['Kâzım Güleçyüz','01.04.1994']};
 const rows=articles.map(([title,path,ids])=>{
  const own=norm(title);
  const issue=ids.find(i=>issues[i][0])??ids[0];
  const fromTitle=taxonomy.filter(([,pattern])=>pattern.test(own)).map(([name])=>name);
  const tags=fromTitle.length?fromTitle:taxonomy.filter(([,pattern])=>pattern.test(norm(issues[issue][1]))).map(([name])=>name);
  const credit=title.match(/\s[–—-]\s((?:Prof\.?|Doç\.?|Dr\.?)\s.+)$/iu);
  return {title,path,ids,issue,tags,author:verified[path]?.[0]??credit?.[1]??'',date:verified[path]?.[1]??'',basis:fromTitle.length?'Başlık':'Sayı dosyası'};
 });
 const candidates=new Map();
 for(const row of rows){
  const match=norm(row.title).match(/^(.{12,}) (i|ii|iii|iv|v|vi|[1-9])$/);
  if(!match)continue;
  if(!candidates.has(match[1]))candidates.set(match[1],[]);
  candidates.get(match[1]).push(row);
 }
 const related=new Map();
 for(const group of candidates.values()){
  if(new Set(group.map(row=>row.issue)).size<2)continue;
  for(const row of group)related.set(row.path,group.filter(other=>other!==row));
 }
 const fields=['query','author','issue','year','topic','review'].map(get);
 function options(id,base,items){const select=get(id);select.replaceChildren(new Option(base,''));for(const [value,label] of items)select.add(new Option(label,value));}
 options('issue','Tüm sayılar',numbered.map(({issue,id})=>[id,issue[0]+'. sayı']));
 options('year','Tüm yıllar',[...new Set(issues.map(i=>i[3]).filter(Boolean))].sort().reverse().map(y=>[y,y]));
 const storage='kopru-editor-v1';
 let edits={};
 try{edits=JSON.parse(localStorage.getItem(storage)||'{}')||{};}catch{}
 function topics(){
  const field=get('topic'),current=field.value;
  options('topic','Tüm konular',[...new Set([...taxonomy.map(t=>t[0]),...Object.values(edits).map(e=>e.topic).filter(Boolean)])].map(t=>[t,t]));
  field.value=current;
 }
 topics();
 const download=make('button','İncelemeleri dışa aktar');
 download.type='button';
 download.onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(edits,null,2)],{type:'application/json'}));
  const link=anchor('',url);link.download='kopru-incelemeleri.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 get('review').closest('.filters').after(download);
 const listing=get('issues');
 for(const {issue,id} of numbered){
  const li=make('li');
  li.append(anchor(issue[1],route('sayi',id)));
  listing.append(li);
 }
 const guides=get('guides');
 for(const [title,numbers,description] of [
  ['Kadın, aile ve toplum',['113','152','156','166','167'],'Kadın dosyalarından aile politikaları ve aile ekonomisi tartışmalarına ilerle.'],
  ['Demokrasi, hukuk ve cumhuriyet',['103','105','120','163','164','165'],'Meşrutiyet ve anayasa arayışlarından güncel cumhuriyet dosyalarına geç.'],
  ['Risale-i Nur ve medeniyet',['102','118','119','121','122'],'Medeniyet anlayışının ardından şerh ve izah yöntemlerine bak.']
 ]){
  const group=make('p');
  group.append(make('strong',title+' · '),description+' ');
  for(const number of numbers){const item=numbered.find(x=>x.issue[0]===number);if(item)group.append(anchor(number+'. sayı',route('sayi',item.id)),' ');}
  guides.append(group);
 }
 const rawIssue=params.get('sayi');
 const chosenIssue=rawIssue===null?null:issues[Number(rawIssue)];
 const chosenArticle=rows.find(row=>row.path===params.get('yazi'));
 const chosenAuthor=params.get('imza');
 const view=get('view');
 if(chosenArticle||chosenIssue||chosenAuthor){
  view.hidden=false;
  view.append(anchor('Arşive dön','./'),make('h2',chosenArticle?'Yazı fişi':chosenIssue?.[1]??'İmza dosyası · '+chosenAuthor));
  if(chosenIssue){
   view.append(anchor('Dergideki sayı',source(chosenIssue[2])));
   const index=numbered.findIndex(x=>x.issue===chosenIssue);
   for(const [offset,label] of [[1,'Önceki sayı'],[-1,'Sonraki sayı']]){
    const item=numbered[index+offset];if(index>=0&&item)view.append(' ',anchor(label,route('sayi',item.id)));
   }
  }
 }
 const contains=(value,query)=>norm(query).split(' ').every(word=>norm(value).includes(word));
 let page=0;
 function render(){
  const [q,a,i,y,t,r]=fields.map(f=>f.value);
  const found=chosenArticle?[chosenArticle]:rows.filter(row=>{
   const edit=edits[row.path], tags=edit?.topic?[edit.topic]:row.tags;
   return (!chosenIssue||row.ids.includes(Number(rawIssue)))&&(!chosenAuthor||norm(row.author)===norm(chosenAuthor))&&contains(row.title,q)&&contains(row.author,a)&&(!i||row.ids.includes(Number(i)))&&(!y||row.ids.some(id=>issues[id][3]===y))&&(!t||tags.includes(t))&&(!r||(r==='done'?edit?.done:!edit?.done&&!tags.length));
  });
  const total=Math.ceil(found.length/24);
  page=Math.min(page,Math.max(0,total-1));
  get('status').textContent=found.length.toLocaleString('tr')+' yazı · '+rows.length.toLocaleString('tr')+' dizin kaydı';
  get('page').textContent=total?(page+1)+' / '+total:'';
  get('prev').disabled=page===0;
  get('next').disabled=page+1>=total;
  const results=get('results');
  results.replaceChildren();
  for(const row of found.slice(page*24,page*24+24)){
   const issue=issues[row.issue];
   const article=make('article');
   const heading=make('h3');
   heading.append(anchor(row.title,route('yazi',row.path)));
   const meta=make('p');
   if(row.author)meta.append(anchor(row.author,route('imza',row.author)),' · ');
   meta.append(anchor(issue[1],route('sayi',row.issue)));
   if(row.date)meta.append(' · '+row.date);
   const edit=edits[row.path];
   const tags=edit?.topic?[edit.topic]:row.tags;
   const citation=[row.author,row.title,'Köprü',issue[0]?issue[0]+'. sayı':'',row.date||issue[3],source(row.path)].filter(Boolean).join(', ');
   const copy=make('button','Künyeyi kopyala');
   copy.onclick=async()=>{try{await navigator.clipboard.writeText(citation);copy.textContent='Künye kopyalandı';}catch{window.prompt('Künyeyi kopyala',citation);}};
   const review=make('details');
   const field=make('input');
   field.value=edit?.topic||'';
   field.placeholder='Kategori / Alt konu';
   field.setAttribute('aria-label','Kategori ve alt konu');
   const checked=make('input');checked.type='checkbox';checked.checked=Boolean(edit?.done);
   const label=make('label','İncelendi');label.append(checked);
   const save=make('button','Kaydet');
   save.onclick=()=>{
    const updated={...edits,[row.path]:{topic:field.value.trim(),done:checked.checked}};
    try{localStorage.setItem(storage,JSON.stringify(updated));edits=updated;topics();render();}
    catch{save.textContent='Kaydedilemedi';}
   };
   review.append(make('summary','Editör incelemesi · bu tarayıcı'),field,label,save);
   article.append(heading,meta,make('p',tags.length?(edit?.topic?'Editör konusu':row.basis+' üzerinden')+' · '+tags.join(' · '):'Konu incelemesi bekliyor'),anchor('Yazının aslı',source(row.path)),copy,review);
   if(related.has(row.path)){
    const series=make('p','İncelenecek seri eşleşmeleri · ');
    for(const other of related.get(row.path))series.append(anchor(issues[other.issue][0]+'. sayı',route('yazi',other.path)));
    article.append(series);
   }
   results.append(article);
  }
 }
 for(const field of fields)field.addEventListener('input',()=>{page=0;render();});
 get('prev').onclick=()=>{page--;render();get('status').scrollIntoView();};
 get('next').onclick=()=>{page++;render();get('status').scrollIntoView();};
 render();
})();
