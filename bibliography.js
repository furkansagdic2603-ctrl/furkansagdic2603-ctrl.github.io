(()=>{'use strict';

const search=document.getElementById('book-search');
const tree=document.getElementById('book-category-tree');
const browseTabs=[...document.querySelectorAll('[data-book-browse]')];
const categoryBrowser=document.getElementById('book-category-browser');
const authorBrowser=document.getElementById('book-author-browser');
const authorSearch=document.getElementById('book-author-search');
const authorLetters=document.getElementById('book-author-letters');
const authorList=document.getElementById('book-author-list');
const body=document.getElementById('book-rows');
const status=document.getElementById('book-status');
const activeCategory=document.getElementById('book-active-category');
const prev=document.getElementById('book-prev');
const next=document.getElementById('book-next');
const pageLabel=document.getElementById('book-page');

let books=[];
let page=0;
let selectedMain='';
let selectedSub='';
let selectedAuthor='';
let browseMode='category';
let selectedLetter='';
const size=50;

const MAIN_ORDER=['Felsefe','Sanat','Edebiyat','Tarih','Din'];
const SUB_ORDER={
  'Felsefe':['Estetik Felsefesi','Tarih Felsefesi','Felsefe Tarihi','Antik Felsefe','İslâm Felsefesi','Varlık ve Metafizik','Bilgi ve Bilim Felsefesi','Dil ve Yorum Felsefesi','Ahlâk Felsefesi','Siyaset Felsefesi','Mantık','İnsan ve Zihin Felsefesi','Toplum ve Kültür Felsefesi','Genel Felsefe'],
  'Sanat':['Sanat Tarihi','Sanat Kuramı','Sinema','Görsel Sanatlar','Mimarlık ve Şehir','Müzik'],
  'Edebiyat':['Edebiyat Tarihi','Roman','Şiir','Hikâye','Deneme ve Edebiyat'],
  'Tarih':['Yunan Tarihi','Roma ve Bizans Tarihi','Osmanlı Tarihi','Selçuklu Tarihi','Türk Tarihi','Türkiye Cumhuriyeti Tarihi','İslâm Tarihi','Avrupa Tarihi','Genel Tarih'],
  'Din':['Kur\'an ve Tefsir','Hadis ve Sünnet','Fıkıh ve Usûl','Kelâm ve Akaid','Tasavvuf','Dinler Tarihi','İslâm Düşüncesi']
};

const normalize=s=>String(s||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
const authorKey=s=>normalize(s).replace(/[^a-z0-9çğıöşü]+/g,' ').trim();
const authorLetter=s=>String(s||'').trim().charAt(0).toLocaleUpperCase('tr')||'#';
const has=(text,...keys)=>keys.some(k=>text.includes(normalize(k)));

function classifyBook(book){
  const title=normalize(book.title);
  const author=normalize(book.author);
  const x=title+' '+author;

  // Felsefe alt alanları
  if(has(x,'tarih felsefesi')) return ['Felsefe','Tarih Felsefesi'];
  if(has(x,'felsefe tarihi','felsefenin tarihi')) return ['Felsefe','Felsefe Tarihi'];
  if(has(x,'estetik','güzellik','sanat felsefesi','sanatın felsefesi','poetika','yargı yetisinin eleştirisi','aşk estetiği')) return ['Felsefe','Estetik Felsefesi'];
  if(has(x,'mantık','lojik','organon')) return ['Felsefe','Mantık'];
  if(has(x,'etik','ahlak','ahlâk','erdem','iyi ve kötü')) return ['Felsefe','Ahlâk Felsefesi'];
  if(has(x,'siyaset felsefesi','siyasal felsefe','politik felsefe','toplum sözleşmesi','leviathan','komünist manifesto','yönetim üzerine','siyasal düşünceler')) return ['Felsefe','Siyaset Felsefesi'];
  if(has(x,'bilim felsefesi','epistemoloji','bilgi felsefesi','bilgi kuramı','saf aklın','arı usun','aklın eleştirisi')) return ['Felsefe','Bilgi ve Bilim Felsefesi'];
  if(has(x,'metafizik','ontoloji','varlık ve zaman','varlık felsefesi','monadoloji','monodoloji','fenomenoloji','heidegger','husserl')) return ['Felsefe','Varlık ve Metafizik'];
  if(has(x,'dil felsefesi','wittgenstein','göstergebilim','semiotik','hermeneutik','yorum','anlam')) return ['Felsefe','Dil ve Yorum Felsefesi'];
  if(has(x,'islam felsefesi','islâm felsefesi','islam düşüncesi tarihi','islâm düşüncesi tarihi','farabi','fârâbî','ibn sina','ibn sînâ','kindi','kindî')) return ['Felsefe','İslâm Felsefesi'];
  if(has(x,'antik felsefe','yunan felsefesi','sokrates','platon','eflatun','aristoteles','herakleitos','epikuros','stoac')) return ['Felsefe','Antik Felsefe'];
  if(has(x,'nietzsche','schopenhauer','kant','hegel','descartes','spinoza','leibniz','kierkegaard','deleuze','derrida','bergson','whitehead','bacon','rousseau','hobbes','locke','comte','badiou','habermas','marx','felsefe','felsefi','felsefesi','filozof')) return ['Felsefe','Genel Felsefe'];
  if(has(x,'sosyoloji','sosyolojik','toplum','modernlik','postmodern','bauman','simmel','weber')) return ['Felsefe','Toplum ve Kültür Felsefesi'];

  // Din
  if(has(x,'fıkıh','fikih','mustasfa','islam hukuku','islâm hukuku')) return ['Din','Fıkıh ve Usûl'];
  if(has(x,'tefsir','kur\'an','kuran','meal','sûre','sure','âyet','ayet')) return ['Din','Kur\'an ve Tefsir'];
  if(has(x,'hadis','sünnet','sunnet','buhari','müsned','musned','tecrid','sahih','hanbel')) return ['Din','Hadis ve Sünnet'];
  if(has(x,'tasavvuf','ibn arabi','ibnü\'l arabi','ibni arabi','futuhat','fütuhat','fusûs','fusus','konevi','konevî','mevlana','mevlânâ','kuşeyr','kuseyr','gazzali','gazali')) return ['Din','Tasavvuf'];
  if(has(x,'akaid','akâid','kelam','kelâm','maturidi','mâturîdî','eşari','eş\'ar','inanç esasları','inanc esaslari')) return ['Din','Kelâm ve Akaid'];
  if(has(x,'hristiyan','hıristiyan','yahudi','dinler tarihi','budizm','hindu','incil','tevrat')) return ['Din','Dinler Tarihi'];
  if(has(x,'islam düşüncesi','islâm düşüncesi','bediüzzaman','bediuzzaman','risale','sıratımüstakim','siratimustakim','sebilürreşad','sebilurresad','mecmua','diyanet','islam','islâm','ilahiyat','şeriat','seriat')) return ['Din','İslâm Düşüncesi'];

  // Sanat
  if(has(x,'sanat tarihi','sanatın tarihi')) return ['Sanat','Sanat Tarihi'];
  if(has(x,'sinema','film','sinematograf','yönetmen','yonetmen')) return ['Sanat','Sinema'];
  if(has(x,'mimari','mimarlık','mimarlik','şehir estetiği','sehir estetigi','şehirlerin dili')) return ['Sanat','Mimarlık ve Şehir'];
  if(has(x,'resim','ressam','fotoğraf','fotograf','görme biçimleri','gorme bicimleri','görsel','gorsel','heykel','minyatür','minyatur')) return ['Sanat','Görsel Sanatlar'];
  if(has(x,'müzik','muzik','musiki','mûsikî')) return ['Sanat','Müzik'];
  if(has(x,'sanat','sanatsal','croce','bedrettin cömert','suu kemal yetkin','suut kemal yetkin','ismail tunalı','ömer naci soykan')) return ['Sanat','Sanat Kuramı'];

  // Edebiyat
  if(has(x,'edebiyat tarihi')) return ['Edebiyat','Edebiyat Tarihi'];
  const literaryAuthors=['mustafa kutlu','sezai karakoç','dostoyevski','tolstoy','kafka','orhan pamuk','ahmet hamdi tanpınar','tanpınar','cemil meriç','ismet özel','yahya kemal','mehmet akif','necip fazıl','necib fazıl','shakespeare','goethe','victor hugo','balzac','stendhal','flaubert'];
  if(has(x,'roman','romanlar')) return ['Edebiyat','Roman'];
  if(has(x,'şiir','siir','divan','poem')) return ['Edebiyat','Şiir'];
  if(has(x,'hikaye','hikâye','öykü','oyku')) return ['Edebiyat','Hikâye'];
  if(has(x,'edebiyat','edebî','edebi','hatıra','hatirat','mektuplar','günlük','gunluk') || literaryAuthors.some(n=>author.includes(normalize(n)))) return ['Edebiyat','Deneme ve Edebiyat'];

  // Tarih
  if(has(x,'yunan tarihi','antik yunan','hellen','helenistik','atina','sparta')) return ['Tarih','Yunan Tarihi'];
  if(has(x,'roma tarihi','roma imparator','romalı','romali','bizans')) return ['Tarih','Roma ve Bizans Tarihi'];
  if(has(x,'osmanlı','osmanli','devlet-i aliyye','ahmet cevdet paşa','uzunçarşılı','uzuncarsili','halil inalcık','halil inalcik')) return ['Tarih','Osmanlı Tarihi'];
  if(has(x,'selçuk','selcuk','osman turan')) return ['Tarih','Selçuklu Tarihi'];
  if(has(x,'cumhuriyet','atatürk','ataturk','milli mücadele','millî mücadele','inkılap','inkilap')) return ['Tarih','Türkiye Cumhuriyeti Tarihi'];
  if(has(x,'türk tarihi','turk tarihi','türkler','turkler','orta asya')) return ['Tarih','Türk Tarihi'];
  if(has(x,'islam tarihi','islâm tarihi','siyer','peygamber','hz. muhammed','halifeler','emevi','abbasi')) return ['Tarih','İslâm Tarihi'];
  if(has(x,'avrupa tarihi','batı tarihi','bati tarihi','ortaçağ','ortacag','rönesans','ronesans','fransız ihtilali','fransiz ihtilali')) return ['Tarih','Avrupa Tarihi'];
  if(has(x,'tarih','tarihi','imparatorluğu','imparatorlugu','medeniyet','braudel','hodgson','mısıroğlu','misiroglu')) return ['Tarih','Genel Tarih'];

  // Beş ana başlık dışına taşmaması için beşerî bilimlerde kalan kayıtlar felsefenin genel alanına alınır.
  if(has(x,'psikoloji','zihin','bilinç','bilinc','insan')) return ['Felsefe','İnsan ve Zihin Felsefesi'];
  return ['Felsefe','Genel Felsefe'];
}

function enrich(list){
  return list.map(book=>{
    const [mainCategory,subCategory]=classifyBook(book);
    return {...book,mainCategory,subCategory,authorKey:authorKey(book.author)};
  });
}

function getAuthors(){
  const map=new Map();
  books.forEach(book=>{
    if(!book.authorKey)return;
    if(!map.has(book.authorKey))map.set(book.authorKey,{key:book.authorKey,name:String(book.author||'').trim(),count:0});
    const item=map.get(book.authorKey);
    item.count++;
    const candidate=String(book.author||'').trim();
    if(candidate && candidate.length<item.name.length)item.name=candidate;
  });
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr',{sensitivity:'base'}));
}

function renderAuthorIndex(){
  if(!authorList||!authorLetters)return;
  const all=getAuthors();
  const letters=[...new Set(all.map(a=>authorLetter(a.name)))].sort((a,b)=>a.localeCompare(b,'tr'));
  authorLetters.innerHTML='<button type="button" class="'+(!selectedLetter?'is-active':'')+'" data-letter="">Tümü</button>'+letters.map(l=>'<button type="button" class="'+(selectedLetter===l?'is-active':'')+'" data-letter="'+l+'">'+l+'</button>').join('');
  authorLetters.querySelectorAll('[data-letter]').forEach(b=>b.onclick=()=>{selectedLetter=b.dataset.letter||'';renderAuthorIndex();});
  const q=normalize(authorSearch?.value||'');
  const filtered=all.filter(a=>(!selectedLetter||authorLetter(a.name)===selectedLetter)&&(!q||normalize(a.name).includes(q)));
  authorList.innerHTML=filtered.length?filtered.map(a=>'<button type="button" class="book-author-item '+(selectedAuthor===a.key?'is-active':'')+'" data-author="'+a.key.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"><span>'+a.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</span><small>'+a.count.toLocaleString('tr-TR')+'</small></button>').join(''):'<p class="book-author-empty">Müellif bulunamadı.</p>';
  authorList.querySelectorAll('[data-author]').forEach(button=>button.onclick=()=>{
    selectedAuthor=button.dataset.author||'';
    selectedMain='';selectedSub='';page=0;
    renderAuthorIndex();render();
  });
}

function setBrowseMode(mode){
  browseMode=mode==='author'?'author':'category';
  categoryBrowser.hidden=browseMode!=='category';
  authorBrowser.hidden=browseMode!=='author';
  browseTabs.forEach(b=>{const on=b.dataset.bookBrowse===browseMode;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on));});
  if(browseMode==='category'){selectedAuthor='';renderTree();}
  else{selectedMain='';selectedSub='';renderAuthorIndex();}
  page=0;render();
}

function countFor(main,sub=''){
  return books.filter(b=>(!main||b.mainCategory===main)&&(!sub||b.subCategory===sub)).length;
}

function renderTree(){
  const allButton='<button type="button" class="book-tree-all '+(!selectedMain?'is-active':'')+'" data-main="" data-sub=""><span>Tüm Kitaplar</span><small>'+books.length.toLocaleString('tr-TR')+'</small></button>';
  const groups=MAIN_ORDER.map(main=>{
    const mainCount=countFor(main);
    const mainActive=selectedMain===main&&!selectedSub;
    const subs=(SUB_ORDER[main]||[]).map(sub=>{
      const n=countFor(main,sub);
      if(!n)return '';
      const active=selectedMain===main&&selectedSub===sub;
      return '<button type="button" class="book-tree-sub '+(active?'is-active':'')+'" data-main="'+main+'" data-sub="'+sub+'"><span>'+sub+'</span><small>'+n.toLocaleString('tr-TR')+'</small></button>';
    }).join('');
    return '<section class="book-tree-group"><button type="button" class="book-tree-main '+(mainActive?'is-active':'')+'" data-main="'+main+'" data-sub=""><span>'+main+'</span><small>'+mainCount.toLocaleString('tr-TR')+'</small></button><div class="book-tree-children">'+subs+'</div></section>';
  }).join('');
  tree.innerHTML=allButton+groups;
  tree.querySelectorAll('button[data-main]').forEach(button=>{
    button.addEventListener('click',()=>{
      selectedMain=button.dataset.main||'';
      selectedSub=button.dataset.sub||'';
      selectedAuthor='';
      page=0;
      renderTree();
      render();
    });
  });
}

function render(){
  const query=normalize(search.value.trim());
  const matches=books.filter(b=>{
    const categoryOk=(!selectedMain||b.mainCategory===selectedMain)&&(!selectedSub||b.subCategory===selectedSub);
    const authorOk=!selectedAuthor||b.authorKey===selectedAuthor;
    const searchOk=normalize([b.title,b.author,b.publisher,b.translator,b.mainCategory,b.subCategory].join(' ')).includes(query);
    return categoryOk&&authorOk&&searchOk;
  });
  const pages=Math.max(1,Math.ceil(matches.length/size));
  page=Math.min(page,pages-1);
  const slice=matches.slice(page*size,(page+1)*size);
  body.replaceChildren(...slice.map(b=>{
    const row=document.createElement('tr');
    for(const key of ['title','author','publisher','pages','translator']){
      const cell=document.createElement('td');
      cell.textContent=b[key]||'—';
      row.append(cell);
    }
    return row;
  }));
  const selectedAuthorName=selectedAuthor?(getAuthors().find(a=>a.key===selectedAuthor)?.name||'Müellif'):'';
  const categoryLabel=selectedAuthor?'Müellif › '+selectedAuthorName:(selectedSub?selectedMain+' › '+selectedSub:(selectedMain||'Tüm kitaplar'));
  activeCategory.textContent=categoryLabel;
  status.textContent=matches.length
    ? matches.length.toLocaleString('tr-TR')+' kayıt · '+(page*size+1)+'–'+Math.min((page+1)*size,matches.length)+' arası gösteriliyor'
    : 'Bu kategori veya arama için kitap bulunamadı.';
  pageLabel.textContent=(page+1)+' / '+pages;
  prev.disabled=page===0;
  next.disabled=page>=pages-1;
}

search.addEventListener('input',()=>{page=0;render()});
browseTabs.forEach(button=>button.addEventListener('click',()=>setBrowseMode(button.dataset.bookBrowse)));
authorSearch?.addEventListener('input',()=>{selectedLetter='';renderAuthorIndex();});
prev.onclick=()=>{page=Math.max(0,page-1);render()};
next.onclick=()=>{page++;render()};

fetch('/data/books.json').then(r=>{
  if(!r.ok)throw Error();
  return r.json();
}).then(data=>{
  books=enrich(Array.isArray(data)?data:[]);
  renderTree();
  renderAuthorIndex();
  render();
}).catch(()=>{
  status.textContent='Kitap listesi yüklenemedi. Sayfayı yenileyerek tekrar deneyin.';
});
})();