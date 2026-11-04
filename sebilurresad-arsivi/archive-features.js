function installArchiveFeatures({rows, topics, normalize, get, viewLink, render}) {
 const names = new Map([
  ['mehmed akif','Mehmed Âkif'], ['sadi mehmed akif','Mehmed Âkif'],
  ['ferid vecdi','Muhammed Ferid Vecdi'], ['muhammed ferid vecdi','Muhammed Ferid Vecdi'],
  ['muhammed abduh','Muhammed Abduh'], ['seyh muhammed abduh','Muhammed Abduh']
 ]);
 const people = new Map();
 const aliases = name => names.get(normalize(name)) || name.trim().replace(/^[\[(]|[\])]$/g,'');
 const byId = new Map(rows.map(row => [row.id,row]));
 const sequential = [...rows].sort((a,b) => parseInt(a.issue)-parseInt(b.issue) || a.pdf-b.pdf);
 for (const row of sequential) {
  row.contributors = [];
  const add = (name,role) => {
   if (!name?.trim()) return;
   const person = aliases(name);
   if (!person) return;
   row.contributors.push({person,role});
   if (!people.has(person)) people.set(person,new Set());
   people.get(person).add(row.author);
  };
  const translated = row.author.match(/^(.*?)[\s,–/\-]*[\[(]?\s*(?:İngilizce’den\s+)?(?:Terc\.|Mütercimi\s*:?)\s*([^\])]+?)(?:[\])]\s*(.*))?$/iu);
  if (row.id === '18-266') {
   add('Nihad Paşa','Gönderen');
   add('Mehmed Âkif','Cevap veren');
  } else if (translated) {
   add(translated[1],'Yazar');
   add(normalize(translated[2])==='sadi' && normalize(translated[3])==='mehmed akif' ? 'Mehmed Âkif' : translated[2],'Mütercim');
  } else if (/\bmütercimi\b/iu.test(row.author)) {
   add(row.author.replace(/\s*\([^)]*mütercimi[^)]*\)\s*$/iu,''),'Mütercim');
  } else {
   add(row.author,names.has(normalize(row.author))?'Yazar':'Dizindeki imza');
  }
 }
 const series = new Map();
 const candidates = new Map();
 function register(title, entries, verified) {
  if (entries.length < 2) return;
  for (const row of entries) (verified ? series : candidates).set(row.id,{title,entries});
 }
 register('Vahdet-i Vücûd',sequential.filter(row=>row.author==='Ferid' && (row.id==='6-161' || /^vahdet i vucud \d+$/.test(row.q))),true);
 register('İslâm’da Fen ve Felsefe',sequential.filter(row=>/^m semseddin\b/.test(row.a) && /\bislamda fen ve felsefe\b/.test(row.q)),true);
 register('Müslüman Kadını',sequential.filter(row=>row.q==='musluman kadini' && /^ferid vecdi terc mehmed akif$/.test(row.a)),true);
 const vahdet=series.get('6-161');
 for(const id of ['7-152','8-8']){
  const row=byId.get(id);
  if(row&&vahdet&&row.q==='vahdet i vucud')candidates.set(id,{title:vahdet.title,entries:[...vahdet.entries,row]});
 }
 const proposed = new Map();
 for (const row of sequential) {
  const numbered = row.q.match(/^(.{10,}) ([1-9]\d?)$/);
  if (!numbered || !row.a || series.has(row.id)) continue;
  const key = row.a+'|'+numbered[1];
  if (!proposed.has(key)) proposed.set(key,[]);
  proposed.get(key).push(row);
 }
 for (const entries of proposed.values()) {
  if (new Set(entries.map(row=>row.issue)).size > 1) register(entries[0].title,entries,false);
 }

 const storageKey='sebilurresad-inceleme-v1';
 let edits={};
 try { edits=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}; } catch {}
 const original = new Map(rows.map(row=>[row.id,row.subject]));
 const queue=rows.filter(row=>row.subject?.[0]<0 || candidates.has(row.id));
 function applyEdits() {
  for (const row of rows) {
   const base=original.get(row.id);
   const edit=edits[row.id];
   row.subject=edit?.topic?.length===2 && base
    ? [topics.findIndex(topic=>topic[0]===edit.topic[0]&&topic[1]===edit.topic[1]),[],base[2]] : base;
  }
 }
 for (const edit of Object.values(edits)) {
  if (Array.isArray(edit?.topic) && !topics.some(topic=>topic[0]===edit.topic[0]&&topic[1]===edit.topic[1])) topics.push(edit.topic);
 }
 applyEdits();
 const tools=document.createElement('section');
 tools.className='search-box';
 get('search-title').closest('section').before(tools);
 function node(tag,text) {
  const element=document.createElement(tag);
  if(text) element.textContent=text;
  return element;
 }
 function panel(title) {
  const details=node('details');
  details.append(node('summary',title));
  tools.append(details);
  return details;
 }
 const authorPanel=panel('Yazar dosyaları');
 const authorSelect=node('select');
 authorSelect.setAttribute('aria-label','Arşivdeki kişi veya imza');
 authorSelect.append(new Option('Bir kişi veya imza seç',''));
 for (const person of [...people.keys()].sort((a,b)=>a.localeCompare(b,'tr'))) authorSelect.add(new Option(person));
 authorSelect.onchange=()=>{if(authorSelect.value) location.href=viewLink('','kisi',authorSelect.value).href;};
 authorPanel.append(authorSelect);

 const readings=panel('Tematik okuma dosyaları');
 const guides=[
  ['İslâm’da fen ve felsefe',[
   ['7-3','Mısır ve Mağrib üzerinden ilim tarihine giriş.'],
   ['7-10','Coğrafyayı Endülüs’e doğru genişlet.'],
   ['10-187','Öğretim kurumlarının ele alınışına bak.'],
   ['10-220','Kütüphanelerle bilgi dolaşımını karşılaştır.'],
   ['10-247','Rasathanelerle bilim kurumları bölümünü tamamla.']
  ]],
  ['Ahlâk ve medeniyet',[
   ['1-18','Din fikri ve medeniyet arasındaki ilişkiyi takip et.'],
   ['1-263','Toplum ve medeniyet için öne sürülen esasları karşılaştır.'],
   ['2-116','Batı medeniyetinin oluşumuna dair tercümeyi oku.'],
   ['5-384','Medeniyet tartışmasının gündelik yükümlülüklere nasıl bağlandığına bak.'],
   ['5-413','Hürriyet ve nefis kavramları üzerinden diziyi sürdür.']
  ]],
  ['Kadın ve aile tartışmaları',[
   ['1-31','Tercümanın okura sunduğu girişle başla.'],
   ['1-32','Müslüman Kadını tefrikasının ilk kaydına geç.'],
   ['1-71','Tercümeye ilişkin sonraki açıklamayı oku.'],
   ['5-283','Kadın meselesi etrafındaki daha sonraki polemiği incele.']
  ]]
 ];
 for (const [title,entries] of guides) {
  readings.append(node('h3',title));
  const list=node('ol');
  for (const [id,description] of entries) {
   if (!byId.has(id)) continue;
   const item=node('li');
   item.append(viewLink(byId.get(id).title,'yazi',id),' · '+description);
   list.append(item);
  }
  readings.append(list);
  if (title==='Kadın ve aile tartışmaları') {
   const related=node('p','Sitedeki ilgili okuma · ');
   const link=node('a','Kadınlar – Arthur Schopenhauer (Mütercim: Şerefüddin)');
   link.href='/kitap-notlari/sirat-i-mustakim-sebil-rresad-mecmuasi/kadinlar-arthur-schopenhauer/';
   related.append(link);
   readings.append(related);
  }
 }

 const review=panel('Editör incelemesi');
 review.append(node('p','Kategori değişiklikleri bu tarayıcıda saklanır. Başka bir cihazda sürdürmek için inceleme dosyasını dışa aktar ve orada içe al.'));
 const reviewMode=node('select');
 reviewMode.setAttribute('aria-label','İnceleme kuyruğu');
 reviewMode.append(new Option('Konu incelemesi','topic'),new Option('Tefrika eşleşmeleri','series'),new Option('İncelenenler','done'));
 const reviewSelect=node('select');
 reviewSelect.setAttribute('aria-label','İncelenecek yazı');
 const form=node('div');
 const message=node('p');
 message.setAttribute('role','status');
 function refreshQueue() {
  reviewSelect.replaceChildren(new Option('Kayıt seç',''));
  const visible=queue.filter(row=>reviewMode.value==='done'?edits[row.id]?.done:!edits[row.id]?.done&&(reviewMode.value==='series'?candidates.has(row.id):original.get(row.id)?.[0]<0));
  for (const row of visible) reviewSelect.add(new Option(row.issue+' · '+row.title,row.id));
  message.textContent=visible.length.toLocaleString('tr')+' kayıt';
  form.replaceChildren();
 }
 function save(next) {
  try { localStorage.setItem(storageKey,JSON.stringify(next)); }
  catch { message.textContent='Değişiklik tarayıcıya kaydedilemedi.'; return false; }
  edits=next;
  for (const edit of Object.values(edits)) if (edit.topic && !topics.some(topic=>topic[0]===edit.topic[0]&&topic[1]===edit.topic[1])) topics.push(edit.topic);
  applyEdits();
  refreshQueue();
  render();
  return true;
 }
 reviewMode.onchange=refreshQueue;
 reviewSelect.onchange=()=>{
  form.replaceChildren();
  const row=byId.get(reviewSelect.value);
  if (!row) return;
  const category=node('select');
  category.setAttribute('aria-label','Kategori ve alt konu');
  category.append(new Option('Kategori seç',''));
  for (const [i,topic] of topics.entries()) category.add(new Option(topic.join(' / '),i));
  const existing=edits[row.id]?.topic;
  const match=topics.findIndex(topic=>existing?.[0]===topic[0] && existing[1]===topic[1]);
  if (match>=0) category.value=match;
  const group=node('input');
  group.placeholder='Yeni ana kategori';
  group.setAttribute('aria-label',group.placeholder);
  const subtopic=node('input');
  subtopic.placeholder='Yeni alt konu';
  subtopic.setAttribute('aria-label',subtopic.placeholder);
  const done=node('input');
  done.type='checkbox';
  done.checked=Boolean(edits[row.id]?.done);
  const label=node('label','İncelendi ');
  label.append(done);
  const suggest=[...(row.subject?.[1]||[]),...topics.map((topic,i)=>[topic,i]).filter(([topic])=>normalize(topic[1]).split(' ').some(word=>word.length>=5 && row.q.includes(word))).map(([,i])=>i)];
  const pdf=get('volume').querySelector('option[value="'+row.volume+'"]');
  const link=node('a','PDF sayfası');
  link.href=document.querySelector('tbody a[href$="/turkce/cilt_'+row.volume+'.pdf"]').href+'#page='+row.pdf;
  const button=node('button','Kaydet');
  button.type='button';
  button.onclick=()=>{
   if (Boolean(group.value.trim())!==Boolean(subtopic.value.trim())) {message.textContent='Yeni konu için kategori ve alt konu birlikte gerekli.';return;}
   const topic=group.value.trim()?[group.value.trim(),subtopic.value.trim()]:category.value===''?null:topics[Number(category.value)];
   if(save({...edits,[row.id]:{topic,done:done.checked}})) message.textContent='İnceleme kaydedildi.';
  };
  form.append(node('h3',row.title),node('p',[row.author,pdf?.textContent,row.issue+'. sayı'].filter(Boolean).join(' · ')),link,
   node('p',suggest.length?'Öneriler: '+[...new Set(suggest)].slice(0,5).map(i=>topics[i].join(' / ')).join(', '):'Otomatik konu önerisi bulunamadı.'));
  if(candidates.has(row.id)) form.append(node('p','Tefrika adayları: '+candidates.get(row.id).entries.map(item=>item.issue+'. sayı').join(', ')));
  form.append(category,group,subtopic,label,button);
 };
 const download=node('button','İncelemeleri dışa aktar');
 download.type='button';
 download.onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(edits,null,2)],{type:'application/json'}));
  const link=node('a'); link.href=url; link.download='sebilurresad-incelemeleri.json'; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const upload=node('input');
 upload.type='file';
 upload.accept='.json,application/json';
 const importLabel=node('label',' İnceleme dosyası içe al ');
 importLabel.append(upload);
 upload.onchange=async()=>{
  if (!upload.files.length) return;
  try {
   const imported=JSON.parse(await upload.files[0].text());
   if (!imported || Array.isArray(imported) || typeof imported!=='object') throw Error();
   for (const [id,edit] of Object.entries(imported)) {
    if (!byId.has(id)||typeof edit?.done!=='boolean'||!(edit.topic===null || (Array.isArray(edit.topic)&&edit.topic.length===2&&edit.topic.every(s=>typeof s==='string'&&s.trim()&&s.length<=150)))) throw Error();
   }
   if(save({...edits,...imported})) message.textContent='İncelemeler birleştirildi.';
  } catch { message.textContent='Geçerli bir inceleme dosyası seç.'; }
  upload.value='';
 };
 review.append(reviewMode,reviewSelect,form,download,importLabel,message);
 refreshQueue();

 function decorate(article,row) {
  if (row.contributors.length) {
   const credits=node('p');
   for (const {person,role} of row.contributors) credits.append(role+' · ',viewLink(person,'kisi',person),' ');
   article.append(credits);
  }
  const group=series.get(row.id);
  if (!group) return;
  const index=group.entries.indexOf(row);
  const nav=node('p','Tefrika · '+group.title+' · ');
  for (const [offset,label] of [[-1,'Önceki parça'],[1,'Sonraki parça']]) {
   const neighbor=group.entries[index+offset];
   if (neighbor) nav.append(viewLink(label+' ('+neighbor.issue+'. sayı)','yazi',neighbor.id),' ');
  }
  article.append(nav);
 }
 return {decorate,people,installTextSearch:()=>installTextSearch({panel,rows,normalize,viewLink,node})};
}

function installTextSearch({panel,rows,normalize,viewLink,node}) {
 const search=panel('Tam metinde ara');
 search.append(node('p','Latin harfli çevriyazıda ara. Yazı sınırı belirlenebilen eşleşmeler yazı fişine, diğerleri doğrudan PDF sayfasına gider.'));
 const form=node('form');
 const field=node('input');
 field.type='search';
 field.required=true;
 field.placeholder='Ör. medeniyet';
 field.setAttribute('aria-label','Tam metin sorgusu');
 const volume=node('select');
 volume.setAttribute('aria-label','Aranacak cilt');
 volume.append(new Option('Tüm ciltler',''));
 for (const number of new Set(rows.map(row=>row.volume))) volume.add(new Option(number+'. cilt',number));
 const submit=node('button','Ara');
 const status=node('p');
 status.setAttribute('role','status');
 const results=node('ol');
 const more=node('button','Daha fazla sonuç');
 more.type='button';
 more.hidden=true;
 form.append(field,volume,submit);
 search.append(form,status,results,more);
 let controller;
 const maxCache=4;
 const cache=new Map();
 const cacheRoot='https://raw.githubusercontent.com/furkansagdic2603-ctrl/furkansagdic2603-ctrl.github.io/archive-search/';
 async function loadVolume(number,signal) {
  if (cache.has(number)) return cache.get(number);
  const response=await fetch(cacheRoot+number+'.json.gz',{signal});
  if (!response.ok) throw Error('Metin dizini alınamadı');
  const data=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
  if (cache.size>=maxCache) cache.delete(cache.keys().next().value);
  cache.set(number,data);
  return data;
 }
 form.onsubmit=async event=>{
  event.preventDefault();
  controller?.abort();
  const active=new AbortController();
  controller=active;
  results.replaceChildren();
  more.hidden=true;
  const query=normalize(field.value);
  if(query.length<2){status.textContent='En az iki harf yaz.';return;}
  const matches=[];
  const failures=[];
  const numbers=volume.value?[volume.value]:[...new Set(rows.map(row=>row.volume))];
  let shown=0;
  function show(){
   for(const {article,number,page,snippet} of matches.slice(shown,shown+30)){
    const item=node('li');
    const base=document.querySelector('tbody a[href$="/turkce/cilt_'+number+'.pdf"]');
    const pdf=node('a',number+'. cilt · PDF s. '+page);
    pdf.href=base.href+'#page='+page;
    if(article) item.append(viewLink(article.title,'yazi',article.id),' · ');
    item.append(pdf,node('p',(article?'Yazı eşleşmesi':'Sayfa eşleşmesi')+' · '+snippet));
    results.append(item);
    shown++;
   }
   more.hidden=shown>=matches.length;
  }
  more.onclick=show;
  for(const [index,number] of numbers.entries()){
   if(active.signal.aborted)return;
   status.textContent='Ciltler taranıyor · '+(index+1)+' / '+numbers.length;
   try{
    const [first,pages,ranges]=await loadVolume(number,active.signal);
    const records=rows.filter(row=>row.volume===number);
    const byPage=new Map();
    for(const [position,[begin,end]] of Object.entries(ranges)){
     for(let i=begin[0];i<=end[0];i++){
      if(!byPage.has(i))byPage.set(i,[]);
      byPage.get(i).push([records[Number(position)-1],i===begin[0]?begin[1]:0,i===end[0]?end[1]:pages[i].length]);
     }
    }
    const matchPattern=new RegExp('(^| )('+query+')','u');
    for(const [i,text] of pages.entries()){
     const normalized=normalize(text);
     const found=matchPattern.exec(normalized);
     if(!found)continue;
     // Compare normalized prefixes to keep the excerpt in the original spelling.
     const words=[...text.matchAll(/\S+/g)];
     let low=0,high=words.length;
     while(low<high){
      const middle=(low+high)>>1;
      if(normalize(text.slice(0,words[middle].index)).length<=found.index)low=middle+1;
      else high=middle;
     }
     const offset=words[Math.max(0,low-1)]?.index||0;
     const article=(byPage.get(i)||[]).find(([,start,end])=>offset>=start&&offset<end&&matchPattern.test(normalize(text.slice(start,end))))?.[0];
     const snippet=(offset>65?'…':'')+text.slice(Math.max(0,offset-65),offset+135)+(offset+135<text.length?'…':'');
     matches.push({article,number,page:first+i,snippet});
    }
   }catch{
    if(active.signal.aborted)return;
    failures.push(number);
   }
  }
  if(active.signal.aborted)return;
  status.textContent=matches.length.toLocaleString('tr')+' PDF sayfası bulundu.'+
   (failures.length?' Metin dizini yüklenemeyen ciltler: '+failures.join(', ')+'.':'');
  show();
 };
}
