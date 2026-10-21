(()=>{'use strict';
const root=document.querySelector('[data-author-research]');
if(!root)return;

const name=root.dataset.authorName||'';
const slug=root.dataset.authorSlug||'author';
const lifeEl=document.getElementById('author-life');
const thoughtEl=document.getElementById('author-thought');
const originalEl=document.getElementById('author-original-works');
const turkishEl=document.getElementById('author-turkish-works');
const portrait=document.getElementById('author-portrait');
const monogram=document.querySelector('.author-monogram');
const meta=document.getElementById('author-research-meta');
const sources=document.getElementById('author-research-sources');
const originalCount=document.getElementById('author-original-count');
const turkishCount=document.getElementById('author-turkish-count');

const CACHE_KEY='author-research-v2:'+slug;
const CACHE_TTL=7*24*60*60*1000;
const norm=s=>String(s||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9çğıöşü]+/gi,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=(arr,key=x=>norm(x.title||x))=>{const m=new Map();for(const x of arr){const k=key(x);if(k&&!m.has(k))m.set(k,x)}return [...m.values()]};
const timeout=(ms=12000)=>{const c=new AbortController();setTimeout(()=>c.abort(),ms);return c.signal};
async function getJson(url){const r=await fetch(url,{signal:timeout(),headers:{Accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}

function claimValues(entity,pid){
  return (entity?.claims?.[pid]||[]).map(c=>c?.mainsnak?.datavalue?.value).filter(Boolean);
}
function entityIds(entity,pid){
  return claimValues(entity,pid).map(v=>v?.id).filter(Boolean);
}
function firstTime(entity,pid){
  const v=claimValues(entity,pid)[0];
  if(!v?.time)return '';
  const m=String(v.time).match(/[+-](\d{4,})-(\d{2})-(\d{2})/);
  return m?String(Number(m[1])):'';
}
async function wdSearch(){
  const url='https://www.wikidata.org/w/api.php?action=wbsearchentities&search='+encodeURIComponent(name)+'&language=tr&uselang=tr&type=item&limit=8&format=json&origin=*';
  const data=await getJson(url);
  const hits=data.search||[];
  const exact=hits.find(x=>norm(x.label)===norm(name));
  const human=hits.find(x=>/filozof|yazar|şair|tarihçi|ilahiyat|sosyolog|author|philosopher|writer|historian|poet|scholar/i.test((x.description||'')));
  return exact||human||hits[0]||null;
}
async function wdEntity(id){
  const url='https://www.wikidata.org/w/api.php?action=wbgetentities&ids='+encodeURIComponent(id)+'&props=labels|descriptions|claims|sitelinks&languages=tr|en|de|fr|ar&languagefallback=1&format=json&origin=*';
  const data=await getJson(url);return data.entities?.[id]||null;
}
async function wdLabels(ids){
  ids=[...new Set(ids.filter(Boolean))];
  const out={};
  for(let i=0;i<ids.length;i+=40){
    const batch=ids.slice(i,i+40);
    const url='https://www.wikidata.org/w/api.php?action=wbgetentities&ids='+encodeURIComponent(batch.join('|'))+'&props=labels&languages=tr|en&languagefallback=1&format=json&origin=*';
    const data=await getJson(url);
    for(const [id,e] of Object.entries(data.entities||{}))out[id]=e.labels?.tr?.value||e.labels?.en?.value||id;
  }
  return out;
}
function joinNames(ids,labels,max=6){return ids.map(id=>labels[id]).filter(Boolean).slice(0,max).join(', ')}

async function wikidataProfile(){
  const hit=await wdSearch();if(!hit)return null;
  const entity=await wdEntity(hit.id);if(!entity)return null;
  const pids=['P19','P20','P27','P106','P101','P135','P737','P800','P103'];
  const ids=pids.flatMap(p=>entityIds(entity,p));
  const labels=await wdLabels(ids);
  const birth=firstTime(entity,'P569'),death=firstTime(entity,'P570');
  const birthplace=joinNames(entityIds(entity,'P19'),labels,1);
  const deathplace=joinNames(entityIds(entity,'P20'),labels,1);
  const citizen=joinNames(entityIds(entity,'P27'),labels,2);
  const occupations=joinNames(entityIds(entity,'P106'),labels,4);
  const fields=joinNames(entityIds(entity,'P101'),labels,6);
  const movements=joinNames(entityIds(entity,'P135'),labels,5);
  const influences=joinNames(entityIds(entity,'P737'),labels,6);
  const notable=joinNames(entityIds(entity,'P800'),labels,6);
  const nativeLang=joinNames(entityIds(entity,'P103'),labels,2);
  const description=entity.descriptions?.tr?.value||entity.descriptions?.en?.value||hit.description||'';

  const lifeParts=[];
  if(birth||birthplace)lifeParts.push('Doğum'+(birth?' yılı '+birth:'')+(birthplace?', doğum yeri '+birthplace:'')+'.');
  if(occupations)lifeParts.push('Başlıca kimliği ve çalışma alanı '+occupations+' olarak kaydedilmiştir.');
  if(citizen)lifeParts.push('Vatandaşlık / tarihî aidiyet kaydı: '+citizen+'.');
  if(death||deathplace)lifeParts.push('Ölüm'+(death?' yılı '+death:'')+(deathplace?', ölüm yeri '+deathplace:'')+'.');
  if(nativeLang)lifeParts.push('Anadil kaydı: '+nativeLang+'.');
  if(!lifeParts.length&&description)lifeParts.push(description.charAt(0).toLocaleUpperCase('tr')+description.slice(1)+'.');

  const thoughtParts=[];
  const isPhilosopher=/filozof|philosopher/i.test(occupations+' '+description);
  if(movements)thoughtParts.push((isPhilosopher?'Felsefesi':'Düşünsel/entelektüel çizgisi')+' '+movements+' ile ilişkilendirilir.');
  if(fields)thoughtParts.push('Öne çıkan çalışma alanları '+fields+'.');
  if(influences)thoughtParts.push('Kaynak kayıtlarda etkilendiği isimler arasında '+influences+' yer alır.');
  if(notable)thoughtParts.push('Öne çıkan eserleri arasında '+notable+' sayılır.');
  if(!thoughtParts.length&&description)thoughtParts.push(description.charAt(0).toLocaleUpperCase('tr')+description.slice(1)+'.');

  const image=claimValues(entity,'P18')[0];
  const portraitUrl=image?'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(image)+'?width=520':'';
  return {qid:hit.id,life:lifeParts.join(' '),thought:thoughtParts.join(' '),portraitUrl,nativeLang,description};
}

async function openLibraryAuthor(){
  const data=await getJson('https://openlibrary.org/search/authors.json?q='+encodeURIComponent(name)+'&limit=10');
  const docs=data.docs||[];
  if(!docs.length)return null;
  const exact=docs.find(x=>norm(x.name)===norm(name));
  let best=exact||docs[0];
  if(!exact){
    const surname=norm(name).split(' ').at(-1);
    const bySurname=docs.find(x=>norm(x.name).split(' ').at(-1)===surname);
    if(bySurname)best=bySurname;
  }
  return best;
}
async function openLibraryWorks(){
  const author=await openLibraryAuthor();if(!author?.key)return {author:null,works:[]};
  const data=await getJson('https://openlibrary.org/authors/'+encodeURIComponent(author.key)+'/works.json?limit=1000');
  const works=(data.entries||[]).map(w=>({title:w.title||'',date:w.first_publish_date||'',source:'Open Library'})).filter(x=>x.title);
  return {author,works:uniq(works)};
}

async function wikidataWorks(qid){
  if(!qid)return [];
  const query='SELECT ?work ?workLabel ?date WHERE { ?work wdt:P50 wd:'+qid+' . OPTIONAL { ?work wdt:P577 ?date . } SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en,de,fr,ar". } } ORDER BY ?date';
  try{
    const data=await getJson('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(query));
    return uniq((data.results?.bindings||[]).map(x=>({title:x.workLabel?.value||'',date:(x.date?.value||'').slice(0,10),source:'Wikidata'})).filter(x=>x.title));
  }catch{return []}
}

async function googleTurkishWorks(){
  const results=[];let total=0;
  for(let start=0;start<400;start+=40){
    const url='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent('inauthor:"'+name+'"')+'&langRestrict=tr&maxResults=40&startIndex='+start+'&printType=books';
    let data;try{data=await getJson(url)}catch{break}
    total=Number(data.totalItems||0);
    const items=(data.items||[]).map(v=>v.volumeInfo||{}).filter(v=>v.title).map(v=>({title:v.title,subtitle:v.subtitle||'',publisher:v.publisher||'',date:v.publishedDate||'',authors:v.authors||[],source:'Google Books'}));
    results.push(...items);
    if(!data.items?.length||start+40>=total)break;
  }
  return {total,works:uniq(results)};
}

function renderList(el,items,{turkish=false}={}){
  if(!el)return;
  if(!items.length){el.innerHTML='<p class="author-research-empty">Bu kaynaklarda doğrulanmış eser kaydı bulunamadı.</p>';return}
  el.innerHTML=items.map((w,i)=>'<li><span class="author-work-no">'+String(i+1).padStart(2,'0')+'</span><div><strong>'+esc(w.title)+(w.subtitle?' <small>'+esc(w.subtitle)+'</small>':'')+'</strong><p>'+[w.date,w.publisher,w.source].filter(Boolean).map(esc).join(' · ')+'</p></div></li>').join('');
}

function renderProfile(data){
  if(data.profile){
    if(lifeEl)lifeEl.textContent=data.profile.life||'Biyografik kayıt bulunamadı.';
    if(thoughtEl)thoughtEl.textContent=data.profile.thought||'Düşünce alanı için yapılandırılmış kayıt bulunamadı.';
    if(data.profile.portraitUrl&&portrait){
      portrait.src=data.profile.portraitUrl;portrait.hidden=false;
      portrait.addEventListener('load',()=>monogram?.classList.add('has-portrait'),{once:true});
      portrait.addEventListener('error',()=>{portrait.hidden=true},{once:true});
    }
  }
  const originals=data.originalWorks||[];
  const turkish=data.turkishWorks||[];
  renderList(originalEl,originals);
  renderList(turkishEl,turkish,{turkish:true});
  if(originalCount)originalCount.textContent=originals.length.toLocaleString('tr-TR');
  if(turkishCount)turkishCount.textContent=turkish.length.toLocaleString('tr-TR');
  if(meta){
    const bits=[];
    if(data.profile?.nativeLang)bits.push('Anadil: '+data.profile.nativeLang);
    if(data.openLibraryAuthor?.name)bits.push('Open Library: '+data.openLibraryAuthor.name);
    meta.textContent=bits.join(' · ');
  }
  if(sources){
    sources.innerHTML='<span>Kaynak kapsamı:</span> Wikidata, Open Library ve Google Books katalogları birleştirilmiştir. Kamu katalogları bibliyografik olarak çok geniştir fakat hiçbir çevrimiçi katalog mutlak eksiksizlik garantisi vermez.';
  }
}

async function load(){
  try{
    const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
    if(cached?.savedAt&&Date.now()-cached.savedAt<CACHE_TTL){renderProfile(cached);return}
  }catch{}
  root.classList.add('is-loading');
  const profile=await wikidataProfile().catch(()=>null);
  const [ol,wdWorks,tr]=await Promise.all([
    openLibraryWorks().catch(()=>({author:null,works:[]})),
    wikidataWorks(profile?.qid).catch(()=>[]),
    googleTurkishWorks().catch(()=>({total:0,works:[]}))
  ]);
  const originalWorks=uniq([...(wdWorks||[]),...(ol.works||[])]);
  const data={savedAt:Date.now(),profile,originalWorks,turkishWorks:tr.works||[],turkishTotal:tr.total||0,openLibraryAuthor:ol.author||null};
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(data))}catch{}
  renderProfile(data);
  root.classList.remove('is-loading');
}
load();
})();