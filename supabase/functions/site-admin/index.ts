const SITE_ORIGIN = 'https://furkansagdic.com.tr';
const PROJECT_URL = 'https://vdwioetyxlujrhqrzhwc.supabase.co';
const PUBLIC_KEY = 'sb_publishable_4dB2-eRe_FEkJJfkzaLwoQ_UuzIF5WT';
const REPOSITORY = 'furkansagdic2603-ctrl/furkansagdic2603-ctrl.github.io';
const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
const cors = {
  'Access-Control-Allow-Origin': SITE_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const result = (data: object, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
const slug = (s: string) => s.toLocaleLowerCase('tr').replace(/[ıİ]/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const sanitizeArticleHtml = (value: string) => {
  let html = String(value || '');
  const blocked = ['script','iframe','object','embed','form','base','link','meta'];
  for (const tag of blocked) {
    const paired = new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '\\s*>', 'gi');
    const single = new RegExp('<' + tag + '\\b[^>]*\\/?>', 'gi');
    html = html.replace(paired, '').replace(single, '');
  }
  html = html.replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/\s+(href|src|xlink:href|formaction)\s*=\s*"\s*javascript:[^"]*"/gi, '');
  html = html.replace(/\s+(href|src|xlink:href|formaction)\s*=\s*'\s*javascript:[^']*'/gi, '');
  html = html.replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return html;
};
type Category = { slug: string; name: string; parent?: string };
const categoryPath = (item: Category) => `${item.parent ? item.parent + '/' : ''}${item.slug}`;
const ghUrl = (path: string) => `https://api.github.com/repos/${REPOSITORY}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
const ghHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' });
function encode(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function decode(base64: string) {
  const bytes = Uint8Array.from(atob(base64.replace(/\s/g, '')), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function commentAdminKey() {
  const configured = Deno.env.get('SUPABASE_SECRET_KEYS');
  let key: string | undefined;
  if (configured) {
    try { key = JSON.parse(configured).default; } catch { /* Legacy projects may only have a service role key. */ }
  }
  key ||= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('Yorum yönetimi için Supabase sunucu anahtarı bulunamadı.');
  return key;
}
function commentHeaders() {
  const key = commentAdminKey();
  return { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }), 'Content-Type': 'application/json' };
}
async function getCategories(token: string) {
  const res = await fetch(ghUrl('data/categories.json'), { headers: ghHeaders(token) });
  if (!res.ok) throw new Error('Kategori listesi alınamadı.');
  const file = await res.json();
  return { categories: JSON.parse(decode(file.content)) as Category[], sha: file.sha as string };
}
async function putFile(token: string, path: string, content: string, message: string, sha?: string) {
  const res = await fetch(ghUrl(path), {
    method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: encode(content), ...(sha ? { sha } : {}) }),
  });
  if (res.status === 422 || res.status === 409) throw new Error('Bu adla kayıt zaten var veya dosya değişti. Farklı ad dene.');
  if (!res.ok) throw new Error(`GitHub yayımlama hatası (${res.status}).`);
  const saved = await res.json();
  return saved.content.sha as string;
}


async function persistPdfAttachments(token: string, body: string) {
  const matches = [...body.matchAll(/href="data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})"/g)];
  for (const match of matches) {
    const base64 = match[1];
    const binary = atob(base64);
    if (binary.length > 20 * 1024 * 1024 || !binary.slice(0, 1024).includes('%PDF-')) {
      throw new Error('Geçerli bir PDF seç (en fazla 20 MB).');
    }
    const path = `assets/documents/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.pdf`;
    const response = await fetch(ghUrl(path), {
      method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Upload original PDF', content: base64 }),
    });
    if (!response.ok) throw new Error(`PDF dosyası kaydedilemedi (${response.status}).`);
    body = body.split(match[0]).join(`href="/${path}"`);
  }
  return body;
}

async function generateCover(token: string, title: string, description: string, body: string) {
  const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')?.trim();
  const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN')?.trim();
  if (accountId || apiToken) {
    if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId) || !apiToken || !/^[\x21-\x7e]+$/.test(apiToken)) throw new Error('Cloudflare hesap kimliği veya API anahtarı eksik ya da geçersiz. Supabase Secrets ayarlarını kontrol et. Yazı yayımlanmadı.');
    const summary = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1100);
    const prompt = `Editorial cover photograph for a Turkish essay. Topic: ${title}. ${description}. Context: ${summary}. Visually interpret the subject as a distinctive, realistic scene. Warm paper tones, subtle Ottoman and Islamic art influence, refined composition, landscape 16:9 feel. No text, letters, logo, watermark, frame or human faces.`.slice(0, 2048);
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, steps: 4 }), signal: AbortSignal.timeout(90000),
    });
    if (response.status === 429) throw new Error('Cloudflare ücretsiz görsel kotası veya hız sınırı doldu (429). Daha sonra dene ya da “Kapak görseli oluştur” seçeneğini kapatıp yazıyı yayımla. Yazı yayımlanmadı.');
    if (!response.ok) throw new Error(`Cloudflare kapak görseli üretemedi (${response.status}). Yazı yayımlanmadı.`);
    const generated = await response.json();
    const image = generated.result?.image;
    if (generated.success !== true || typeof image !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(image) || image.length > 13_000_000) throw new Error('Cloudflare geçerli bir kapak görseli döndürmedi. Yazı yayımlanmadı.');
    const path = `assets/covers/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
    const upload = await fetch(ghUrl(path), { method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Generate cover: ${title}`, content: image }) });
    if (!upload.ok) throw new Error(`Kapak kaydedilemedi (${upload.status}). Yazı yayımlanmadı.`);
    return `/${path}`;
  }
  const key = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (!key) return null; // Existing publishing remains available until the secret is configured.
  if (!/^[\x21-\x7e]+$/.test(key)) throw new Error('Gemini API anahtarında geçersiz karakter var. Supabase Secrets içindeki GEMINI_API_KEY değerine yalnızca anahtarın kendisini yapıştır. Yazı yayımlanmadı.');
  const summary = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2200);
  const prompt = `Türkçe bir düşünce ve kültür sitesindeki yazı için yatay, 16:9 kapak görseli oluştur. Konuyu özgün ve somut bir sahneyle yorumla. Sitenin sıcak kâğıt tonlarına ve ölçülü Osmanlı/İslam sanat estetiğine uyumlu, incelikli bir kompozisyon olsun. Gerekmedikçe dinî sembol veya insan yüzü ekleme. Yazı, harf, logo, filigran, çerçeve ve sahte tarihî belge ekleme. Başlık: ${title}. Açıklama: ${description}. Yazıdan özet: ${summary}`;
  const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite-image:generateContent', {
    method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } }),
    signal: AbortSignal.timeout(90000),
  });
  if (response.status === 429) throw new Error('Gemini görsel kotası veya hız sınırı aşıldı (429). Google AI Studio kota ve faturalandırma ayarlarını kontrol et ya da panelde “Gemini kapak görseli oluştur” seçeneğini kapatıp yazıyı kapaksız yayımla. Yazı yayımlanmadı.');
  if (!response.ok) throw new Error(`Gemini kapak görseli üretemedi (${response.status}). Yazı yayımlanmadı.`);
  const generated = await response.json();
  const image = generated.candidates?.[0]?.content?.parts?.find((part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData?.data)?.inlineData;
  const ext = image?.mimeType === 'image/png' ? 'png' : image?.mimeType === 'image/jpeg' ? 'jpg' : image?.mimeType === 'image/webp' ? 'webp' : null;
  if (!ext || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data) || image.data.length > 13_000_000) throw new Error('Gemini geçerli bir kapak görseli döndürmedi. Yazı yayımlanmadı.');
  const path = `assets/covers/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const upload = await fetch(ghUrl(path), { method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Generate cover: ${title}`, content: image.data }) });
  if (!upload.ok) throw new Error(`Kapak kaydedilemedi (${upload.status}). Yazı yayımlanmadı.`);
  return `/${path}`;
}

async function getArticle(token: string, path: string, categories: Category[]) {
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+){1,6}\/index\.html$/.test(path) || !categories.some(item => !item.parent && path.startsWith(item.slug + '/'))) throw new Error('Yazı yolu geçersiz.');
  const res = await fetch(ghUrl(path), { headers: ghHeaders(token) });
  if (!res.ok) throw new Error('Yazı GitHub üzerinde bulunamadı.');
  const file = await res.json();
  let content: string;
  if (file.encoding === 'base64' && file.content) content = decode(file.content);
  else {
    const raw = await fetch(ghUrl(path), { headers: { ...ghHeaders(token), Accept: 'application/vnd.github.raw+json' } });
    if (!raw.ok) throw new Error('Büyük yazı GitHub üzerinden okunamadı.');
    content = await raw.text();
  }
  if (!/<article\b[^>]*\byazi-icerik\b[^>]*>/i.test(content)) throw new Error('Bu sayfa panelde düzenlenebilen bir yazı değil.');
  return { content, sha: file.sha as string };
}


const kyClean=(v:string)=>v.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
const kyMeta=(html:string,key:string)=>{for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){if(tag.toLowerCase().includes(key.toLowerCase())){const m=tag.match(/content=["']([^"']*)["']/i);if(m)return kyClean(m[1]);}}return'';};
const kySafeUrl=(v:string)=>{try{const u=new URL(v);return /(^|\.)kitapyurdu\.com$/i.test(u.hostname)?u.href:'';}catch{return'';}};
async function kyFetch(url:string){
 const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8','Accept-Language':'tr-TR,tr;q=0.9,en;q=0.7','Cache-Control':'no-cache','Pragma':'no-cache','Referer':'https://www.kitapyurdu.com/'};
 const r=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(20000)});
 if(r.ok)return await r.text();
 // Kitapyurdu sometimes refuses datacenter/server IPs with 403. Do not try to bypass
 // their access controls; report it distinctly so the client can offer URL/manual fallback.
 if(r.status===403)throw new Error('Kitapyurdu sunucu erişimini reddetti (403). Ürün bağlantısını doğrudan yapıştır veya bilgileri elle ekle.');
 throw new Error('Kitapyurdu sayfası alınamadı ('+r.status+').');
}
async function googleBooksLookup(query:string){
 const raw=query.replace(/^https?:\/\/\S+$/i,'').trim();if(!raw)return[];
 const isbn=(raw.match(/(?:97[89][\s-]?)?(?:\d[\s-]?){9}[\dXx]/)||[])[0]?.replace(/[\s-]/g,'')||'';
 const q=isbn?('isbn:'+isbn):raw;
 const r=await fetch('https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent(q)+'&maxResults=10&printType=books',{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)return[];
 const data=await r.json();return (Array.isArray(data.items)?data.items:[]).map((x:any)=>{const d=x.volumeInfo||{},ids=Array.isArray(d.industryIdentifiers)?d.industryIdentifiers:[],found=isbn||String(ids.find((z:any)=>z.type==='ISBN_13')?.identifier||ids.find((z:any)=>z.type==='ISBN_10')?.identifier||'');let cover=String(d.imageLinks?.extraLarge||d.imageLinks?.large||d.imageLinks?.medium||d.imageLinks?.thumbnail||'').replace(/^http:/,'https:');return{title:String(d.title||'').slice(0,160),author:String(d.authors?.join(', ')||'').slice(0,160),description:String(d.description||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,500),cover,publisher:String(d.publisher||'').slice(0,160),isbn:found.slice(0,40),pages:String(d.pageCount||''),publishDate:String(d.publishedDate||''),sourceUrl:String(d.infoLink||''),source:'Google Books'};}).filter((x:any)=>x.title);
}
async function trBookLookup(query:string){
 const raw=query.replace(/^https?:\/\/\S+$/i,'').trim();if(!raw)return[];
 const sources=[
  {name:'1000Kitap',url:'https://1000kitap.com/arama?q='+encodeURIComponent(raw),host:'1000kitap.com'},
  {name:'BKM Kitap',url:'https://www.bkmkitap.com/arama?q='+encodeURIComponent(raw),host:'bkmkitap.com'},
  {name:'D&R',url:'https://www.dr.com.tr/search?q='+encodeURIComponent(raw),host:'dr.com.tr'},
  {name:'idefix',url:'https://www.idefix.com/search?q='+encodeURIComponent(raw),host:'idefix.com'},
  {name:'Amazon Türkiye',url:'https://www.amazon.com.tr/s?k='+encodeURIComponent(raw),host:'amazon.com.tr'}
 ];
 const results:any[]=[];
 for(const src of sources){
  try{
   const r=await fetch(src.url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; FurkanSagdicBookAdmin/1.0)','Accept':'text/html,application/xhtml+xml','Accept-Language':'tr-TR,tr;q=0.9'},redirect:'follow',signal:AbortSignal.timeout(9000)});
   if(!r.ok)continue;const html=await r.text();const links=new Set<string>();
   for(const m of html.matchAll(/href=["']([^"'#]+)["']/gi)){try{const u=new URL(m[1],src.url);if((u.hostname===src.host||u.hostname.endsWith('.'+src.host))&&/(kitap|book|urun|product)/i.test(u.pathname)){links.add(u.href);if(links.size>=5)break;}}catch{}}
   for(const url of [...links].slice(0,3)){try{const p=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; FurkanSagdicBookAdmin/1.0)','Accept':'text/html','Accept-Language':'tr-TR,tr;q=0.9'},redirect:'follow',signal:AbortSignal.timeout(7000)});if(!p.ok)continue;const h=await p.text(),title=kyMeta(h,'og:title').replace(/\s*[|–-].*$/,'').trim(),cover=kyMeta(h,'og:image'),description=kyMeta(h,'og:description');if(title&&title.toLocaleLowerCase('tr').includes(raw.toLocaleLowerCase('tr').split(/\s+/)[0]))results.push({title:title.slice(0,160),author:'',description:description.slice(0,500),cover,publisher:'',isbn:'',pages:'',publishDate:'',sourceUrl:url,source:src.name});}catch{}}
  }catch{}
  if(results.length>=6)break;
 }
 return results;
}
async function fallbackBookLookup(query:string){const g=await googleBooksLookup(query);if(g.length)return g;const o=await openLibraryLookup(query);if(o.length)return o;return await trBookLookup(query);}
async function openLibraryLookup(query:string){
 const isbn=(query.match(/(?:97[89][\s-]?)?(?:\d[\s-]?){9}[\dXx]/)||[])[0]?.replace(/[\s-]/g,'')||'';
 const q=isbn?('isbn:'+isbn):query.replace(/^https?:\/\/\S+$/i,'').trim();
 if(!q)return[];
 const url='https://openlibrary.org/search.json?q='+encodeURIComponent(q)+'&limit=8&fields=key,title,author_name,publisher,isbn,first_publish_year,number_of_pages_median,cover_i';
 const r=await fetch(url,{headers:{'User-Agent':'FurkanSagdicBookAdmin/1.0 (furkansagdic.com.tr)','Accept':'application/json'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Yedek kitap veritabanına ulaşılamadı ('+r.status+').');
 const data=await r.json();return (Array.isArray(data.docs)?data.docs:[]).slice(0,8).map((d:any)=>{const foundIsbn=isbn||(Array.isArray(d.isbn)?String(d.isbn.find((x:any)=>/^97[89]\d{10}$/.test(String(x)))||d.isbn[0]||''):'');return{title:String(d.title||'').slice(0,160),author:String(d.author_name?.[0]||'').slice(0,160),description:'',cover:d.cover_i?'https://covers.openlibrary.org/b/id/'+d.cover_i+'-L.jpg':(foundIsbn?'https://covers.openlibrary.org/b/isbn/'+foundIsbn+'-L.jpg?default=false':''),publisher:String(d.publisher?.[0]||'').slice(0,160),isbn:foundIsbn.slice(0,40),pages:String(d.number_of_pages_median||''),publishDate:String(d.first_publish_year||''),sourceUrl:d.key?('https://openlibrary.org'+d.key):'',source:'Open Library'};});}
function kyProduct(html:string,sourceUrl:string){
 let title=kyMeta(html,'og:title').replace(/\s*Fiyatı,.*$/i,'').trim(),description=kyMeta(html,'og:description'),cover=kyMeta(html,'og:image'),author='',publisher='',isbn='',pages='',publishDate='';
 for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const root=JSON.parse(m[1]);const walk=(o:any)=>{if(!o||typeof o!=='object')return;const t=String(o['@type']||'').toLowerCase();if(t==='product'||t==='book'){title||=String(o.name||'');description||=kyClean(String(o.description||''));const im=Array.isArray(o.image)?o.image[0]:o.image;cover||=typeof im==='string'?im:String(im?.url||'');const a=Array.isArray(o.author)?o.author[0]:o.author;author||=typeof a==='string'?a:String(a?.name||'');const p=Array.isArray(o.publisher)?o.publisher[0]:o.publisher;publisher||=typeof p==='string'?p:String(p?.name||o.brand?.name||'');isbn||=String(o.isbn||'');pages||=String(o.numberOfPages||'');publishDate||=String(o.datePublished||'');}for(const v of Object.values(o)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}};(Array.isArray(root)?root:[root]).forEach(walk);}catch{}}
 const h1=html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);title||=h1?kyClean(h1[1]):'';const am=html.match(/<a[^>]+href=["'][^"']*(?:yazar|manufacturer)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);author||=am?kyClean(am[1]):'';
 const field=(label:string)=>{const pos=html.toLocaleLowerCase('tr').indexOf(label.toLocaleLowerCase('tr'));if(pos<0)return'';return kyClean(html.slice(pos,pos+350)).replace(new RegExp('^.*?'+label+'\\s*:?\\s*','i'),'').slice(0,100);};isbn||=field('ISBN').split(' ')[0];pages||=field('Sayfa Sayısı').split(' ')[0];publishDate||=field('Yayın Tarihi').split(' ')[0];
 return{title:title.slice(0,160),author:author.slice(0,160),description:description.slice(0,500),cover,publisher:publisher.slice(0,160),isbn:isbn.slice(0,40),pages:pages.slice(0,30),publishDate:publishDate.slice(0,40),sourceUrl};
}
async function kySaveCover(token:string,remoteUrl:string){const u=new URL(remoteUrl);if(!/(^|\.)(?:kitapyurdu\.(?:com|net)|covers\.openlibrary\.org|books\.googleusercontent\.com|googleusercontent\.com|1000kitap\.com|bkmkitap\.com|dr\.com\.tr|idefix\.com|amazon\.com\.tr|media-amazon\.com|ssl-images-amazon\.com)$/i.test(u.hostname))throw new Error('Kapak adresi izin verilen kitap kaynağında değil.');const r=await fetch(u.href,{headers:{'User-Agent':'Mozilla/5.0',Referer:'https://www.kitapyurdu.com/'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Kitapyurdu kapağı indirilemedi.');const bytes=new Uint8Array(await r.arrayBuffer());if(!bytes.length||bytes.length>2*1024*1024)throw new Error('Kitapyurdu kapağı çok büyük veya boş.');const ct=(r.headers.get('content-type')||'').toLowerCase(),ext=ct.includes('png')?'png':ct.includes('webp')?'webp':ct.includes('gif')?'gif':'jpg';let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const path='assets/uploads/'+new Date().toISOString().slice(0,10)+'/'+crypto.randomUUID()+'.'+ext;const put=await fetch(ghUrl(path),{method:'PUT',headers:{...ghHeaders(token),'Content-Type':'application/json'},body:JSON.stringify({message:'Import Kitapyurdu book cover',content:btoa(binary)})});if(!put.ok)throw new Error('Kitapyurdu kapağı siteye kaydedilemedi ('+put.status+').');return'/'+path;}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.headers.get('Origin') !== SITE_ORIGIN) return result({ error: 'Bu kaynağa izin verilmedi.' }, 403);
  if (req.method !== 'POST') return result({ error: 'Yönteme izin verilmedi.' }, 405);
  const token = Deno.env.get('GITHUB_TOKEN');
  const adminEmail = Deno.env.get('ADMIN_EMAIL')?.trim().toLowerCase();
  if (!token || !adminEmail) return result({ error: 'Yönetim sunucusu henüz yapılandırılmadı.' }, 503);
  const bearer = req.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+$/.test(bearer)) return result({ error: 'Oturum açmalısın.' }, 401);
  try {
    const auth = await fetch(`${PROJECT_URL}/auth/v1/user`, { headers: { apikey: PUBLIC_KEY, Authorization: bearer } });
    if (!auth.ok) return result({ error: 'Oturum geçersiz.' }, 401);
    const user = await auth.json();
    if (!user.email_confirmed_at || user.email?.toLowerCase() !== adminEmail) return result({ error: 'Bu hesap yönetici değil.' }, 403);
    if (Number(req.headers.get('content-length') || 0) > MAX_REQUEST_BYTES) return result({ error: 'Yükleme 32 MB sınırını aşıyor. PDF dosyası en fazla 20 MB olabilir.' }, 413);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_REQUEST_BYTES) return result({ error: 'Yükleme 32 MB sınırını aşıyor. PDF dosyası en fazla 20 MB olabilir.' }, 413);
    const input = JSON.parse(raw);
    if (input.action === 'whoami') return result({ ok: true });
    if (input.action === 'stats') {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const params = new URLSearchParams({ select: 'page_path,created_at', created_at: `gte.${since}`, order: 'created_at.desc', limit: '10000' });
      const response = await fetch(`${PROJECT_URL}/rest/v1/site_page_views?${params}`, { headers: commentHeaders() });
      if (!response.ok) throw new Error(`İstatistik tablosu okunamadı (${response.status}). Kurulum SQL dosyasını çalıştır.`);
      const views = await response.json() as { page_path: string; created_at: string }[];
      const days: Record<string, number> = {}, paths: Record<string, number> = {};
      const dayOf = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
      for (const view of views) { const day = dayOf(new Date(view.created_at)); days[day] = (days[day] || 0) + 1; paths[view.page_path] = (paths[view.page_path] || 0) + 1; }
      return result({ total: views.length, today: days[dayOf(new Date())] || 0, daily: Object.entries(days).sort(([a], [b]) => a.localeCompare(b)), top: Object.entries(paths).sort((a, b) => b[1] - a[1]).slice(0, 12), truncated: views.length === 10000 });
    }
    if (input.action === 'list_comments') {
      const offset = Number(input.offset || 0);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return result({ error: 'Yorum sayfası geçersiz.' }, 400);
      const params = new URLSearchParams({ select: 'id,page_path,first_name,last_name,body,created_at', order: 'created_at.desc,id.desc', limit: '100', offset: String(offset) });
      const res = await fetch(`${PROJECT_URL}/rest/v1/site_comments?${params}`, { headers: commentHeaders() });
      if (!res.ok) throw new Error(`Yorumlar alınamadı (${res.status}).`);
      return result({ comments: await res.json() });
    }
    if (input.action === 'delete_comment') {
      const id = Number(input.id);
      if (!Number.isSafeInteger(id) || id < 1) return result({ error: 'Yorum numarası geçersiz.' }, 400);
      const params = new URLSearchParams({ id: `eq.${id}`, select: 'id' });
      const res = await fetch(`${PROJECT_URL}/rest/v1/site_comments?${params}`, { method: 'DELETE', headers: { ...commentHeaders(), Prefer: 'return=representation' } });
      if (!res.ok) throw new Error(`Yorum silinemedi (${res.status}).`);
      if (!(await res.json()).length) return result({ error: 'Yorum bulunamadı veya zaten silinmiş.' }, 404);
      return result({ ok: true });
    }
    if (input.action === 'save_reading_desk_design') {
      const design = String(input.design || '');
      if (!['tezhip', 'study', 'iznik', 'emerald', 'watercolor', 'manuscript'].includes(design)) return result({ error: 'Geçerli bir okuma masası tasarımı seç.' }, 400);
      const path = 'data/reading-desk-design.json';
      const existing = await fetch(ghUrl(path), { headers: ghHeaders(token) });
      let sha: string | undefined;
      if (existing.ok) sha = (await existing.json()).sha;
      else if (existing.status !== 404) throw new Error('Tasarım ayarı okunamadı.');
      await putFile(token, path, JSON.stringify({ design }, null, 2) + '\n', 'Update reading desk header design', sha);
      return result({ ok: true, design });
    }
    if (input.action === 'save_theme') {
      const theme = input.theme || {};
      const validColor = (value: unknown) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
      if (!validColor(theme.accent) || !validColor(theme.paper) || !validColor(theme.ink)) return result({ error: 'Geçerli renk değerleri seç.' }, 400);
      const path = 'data/theme.json';
      const existing = await fetch(ghUrl(path), { headers: ghHeaders(token) });
      let sha: string | undefined;
      if (existing.ok) sha = (await existing.json()).sha as string;
      else if (existing.status !== 404) throw new Error('Renk ayarları okunamadı.');
      await putFile(token, path, JSON.stringify({ accent: theme.accent, paper: theme.paper, ink: theme.ink }, null, 2) + '\n', 'Update site colors', sha);
      return result({ ok: true });
    }
    if (input.action === 'delete_category') {       const path = String(input.path || '');       const { categories, sha } = await getCategories(token);       const selected = categories.find(item => categoryPath(item) === path);       if (!selected) return result({ error: 'Kategori bulunamadı; listeyi yenile.' }, 404);       if (categories.some(item => item.parent === path || categoryPath(item).startsWith(path + '/'))) {         return result({ error: 'Önce bu kategorinin alt kategorilerini sil.' }, 409);       }       const contentsResponse = await fetch(ghUrl(path), { headers: ghHeaders(token) });       let contents: { name: string; type: string; sha: string }[] = [];       if (contentsResponse.ok) {         const value = await contentsResponse.json();         if (!Array.isArray(value)) return result({ error: 'Kategori içeriği doğrulanamadı; işlem yapılmadı.' }, 502);         contents = value;       } else if (contentsResponse.status !== 404) {         throw new Error('Kategori içeriği okunamadı (' + contentsResponse.status + ').');       }       const indexFile = contents.find(item => item.name === 'index.html' && item.type === 'file');       const otherContents = contents.filter(item => item !== indexFile);       if (otherContents.length) return result({ error: 'Bu kategoride içerik veya dosya var. Önce onları kaldır.' }, 409);       if (indexFile) {         const deleteResponse = await fetch(ghUrl(path + '/index.html'), {           method: 'DELETE', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },           body: JSON.stringify({ message: 'Delete category page: ' + path, sha: indexFile.sha }),         });         if (!deleteResponse.ok) throw new Error('Kategori sayfası silinemedi (' + deleteResponse.status + ').');       }       const remaining = categories.filter(item => categoryPath(item) !== path);       await putFile(token, 'data/categories.json', JSON.stringify(remaining, null, 2), 'Delete category: ' + path, sha);       return result({ categories: remaining });     }     if (input.action === 'add_category') {
      const name = String(input.name || '').trim();
      const parent = String(input.parent || '');
      const categorySlug = slug(name);
      if (!name || name.length > 50 || !/^[\p{L}\p{N} &\/-]+$/u.test(name) || !/^[a-z][a-z0-9-]{1,39}$/.test(categorySlug)) return result({ error: 'Geçerli bir kategori adı yaz.' }, 400);
      const { categories, sha } = await getCategories(token);
      if (parent && (!categories.some(item => categoryPath(item) === parent) || parent.split('/').length >= 4)) return result({ error: 'Üst kategori geçersiz.' }, 400);
      const path = `${parent ? parent + '/' : ''}${categorySlug}`;
      if (categories.some(item => categoryPath(item) === path)) return result({ error: 'Bu kategori zaten var.' }, 409);
      categories.push({ slug: categorySlug, name, ...(parent ? { parent } : {}) });
      await putFile(token, 'data/categories.json', JSON.stringify(categories, null, 2) + '\n', `Add category: ${name}`, sha);
      return result({ path, categories });
    }
    if (input.action === 'add_book') {
      const title = String(input.title || '').trim();
      const author = String(input.author || '').trim();
      const description = String(input.description || '').trim();
      const category = String(input.category || '').trim();
      const cover = String(input.cover || '').trim();
      if (!title || title.length > 160 || author.length > 160 || description.length > 500) return result({ error: 'Kitap bilgileri geçersiz.' }, 400);
      const { categories } = await getCategories(token);
      if (!/^(kitap-notlari|mecmua-yazilari)(?:\/|$)/.test(category) || !categories.some(item => categoryPath(item) === category)) return result({ error: 'Kitap için geçerli bir kategori seç.' }, 400);
      if (cover && !/^\/assets\/uploads\/[a-zA-Z0-9_./-]+$/.test(cover)) return result({ error: 'Kapak yolu geçersiz.' }, 400);
      const path = 'data/site-books.json';
      const existing = await fetch(ghUrl(path), { headers: ghHeaders(token) });
      let books: any[] = [], sha: string | undefined;
      if (existing.ok) { const file = await existing.json(); sha = file.sha; books = JSON.parse(decode(file.content)); }
      else if (existing.status !== 404) throw new Error('Kitap kataloğu okunamadı.');
      const bookSlug = slug(title);
      const id = category + '/' + bookSlug;
      if (!bookSlug || books.some(book => book.id === id)) return result({ error: 'Bu kitap bu kategoride zaten var.' }, 409);
      const fallback = ['burgundy','teal','ochre','ink'][books.length % 4];
      const book = { id, title, author, description, category, cover: cover || '', fallback, createdAt: new Date().toISOString() };
      books.push(book);
      await putFile(token, path, JSON.stringify(books, null, 2) + '\n', 'Add book: ' + title, sha);
      return result({ book });
    }
    if (input.action === 'update_book') {
      const id = String(input.id || '').trim();
      const title = String(input.title || '').trim();
      const author = String(input.author || '').trim();
      const description = String(input.description || '').trim();
      const category = String(input.category || '').trim();
      const cover = String(input.cover || '').trim();
      if (!id || !title || title.length > 160 || author.length > 160 || description.length > 500) return result({ error: 'Kitap bilgileri geçersiz.' }, 400);
      const { categories } = await getCategories(token);
      if (!/^(kitap-notlari|mecmua-yazilari)(?:\/|$)/.test(category) || !categories.some(item => categoryPath(item) === category)) return result({ error: 'Kitap için geçerli bir kategori seç.' }, 400);
      if (cover && !/^\/assets\/uploads\/[a-zA-Z0-9_./-]+$/.test(cover)) return result({ error: 'Kapak yolu geçersiz.' }, 400);
      const path = 'data/site-books.json';
      const existing = await fetch(ghUrl(path), { headers: ghHeaders(token) });
      let books: any[] = [], sha: string | undefined;
      if (existing.ok) { const file = await existing.json(); sha = file.sha; books = JSON.parse(decode(file.content)); }
      else if (existing.status !== 404) throw new Error('Kitap kataloğu okunamadı.');
      const index = books.findIndex(book => book.id === id);
      const fallback = index >= 0 ? (books[index].fallback || 'burgundy') : ['burgundy','teal','ochre','ink'][books.length % 4];
      const book = { ...(index >= 0 ? books[index] : {}), id, title, author, description, category, cover, fallback, createdAt: index >= 0 ? books[index].createdAt : new Date().toISOString(), updatedAt: new Date().toISOString() };
      if (index >= 0) books[index] = book; else books.push(book);
      await putFile(token, path, JSON.stringify(books, null, 2) + '\n', 'Update book: ' + title, sha);
      return result({ book });
    }
    if (input.action === 'delete_book') {
      const id = String(input.id || '').trim();
      const sourcePath = String(input.sourcePath || '').trim().replace(/^\/+|\/+$/g, '');
      if (!/^(?:kitap-notlari|mecmua-yazilari)\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,5}$/.test(id)) return result({ error: 'Kitap kimliği geçersiz.' }, 400);
      if (sourcePath && !/^(?:kitap-notlari|mecmua-yazilari)\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,6}$/.test(sourcePath)) return result({ error: 'Kitap yolu geçersiz.' }, 400);
      const catalogPath = 'data/site-books.json';
      const existing = await fetch(ghUrl(catalogPath), { headers: ghHeaders(token) });
      let books: any[] = [], catalogSha: string | undefined;
      if (existing.ok) { const file = await existing.json(); catalogSha = file.sha; books = JSON.parse(decode(file.content)); }
      else if (existing.status !== 404) throw new Error('Kitap kataloğu okunamadı.');
      const catalogBook = books.find(book => book.id === id);
      const cover = String(catalogBook?.cover || input.cover || '');
      const treeRes = await fetch('https://api.github.com/repos/' + REPOSITORY + '/git/trees/main?recursive=1', { headers: ghHeaders(token) });
      if (!treeRes.ok) throw new Error('Site dosyaları taranamadı.');
      const tree = await treeRes.json();
      const candidates = (tree.tree || []).filter((item: any) => item.type === 'blob' && /^(?:kitap-notlari|mecmua-yazilari)\/.+\/index\.html$/.test(item.path));
      const deletePaths = new Set<string>();
      for (const item of candidates) {
        if (sourcePath && (item.path === sourcePath + '/index.html' || item.path.startsWith(sourcePath + '/'))) deletePaths.add(item.path);
        const raw = await fetch(ghUrl(item.path), { headers: { ...ghHeaders(token), Accept: 'application/vnd.github.raw+json' } });
        if (raw.ok) {
          const html = await raw.text();
          if (html.includes('data-book-id="' + id + '"') || html.includes("data-book-id='" + id + "'")) deletePaths.add(item.path);
        }
      }
      let deleted = 0;
      for (const path of deletePaths) {
        const meta = await fetch(ghUrl(path), { headers: ghHeaders(token) });
        if (!meta.ok) continue;
        const file = await meta.json();
        const del = await fetch(ghUrl(path), { method: 'DELETE', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Delete book content: ' + id, sha: file.sha }) });
        if (!del.ok) throw new Error('Kitap içeriği silinemedi (' + del.status + ').');
        deleted++;
      }
      if (catalogBook) {
        books = books.filter(book => book.id !== id);
        await putFile(token, catalogPath, JSON.stringify(books, null, 2) + '\n', 'Delete book: ' + catalogBook.title, catalogSha);
      }
      if (/^\/assets\/uploads\/[a-zA-Z0-9_./-]+$/.test(cover) && !books.some(book => book.cover === cover)) {
        const coverPath = cover.slice(1);
        const meta = await fetch(ghUrl(coverPath), { headers: ghHeaders(token) });
        if (meta.ok) {
          const file = await meta.json();
          await fetch(ghUrl(coverPath), { method: 'DELETE', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Delete book cover: ' + id, sha: file.sha }) });
        }
      }
      return result({ ok: true, deleted, title: catalogBook?.title || String(input.title || 'Kitap') });
    }

    if(input.action==='kitapyurdu_lookup'){
      const query=String(input.query||'').trim();if(!query||query.length>300)return result({error:'Kitap adı, ISBN veya Kitapyurdu bağlantısı yaz.'},400);
      const direct=kySafeUrl(query);if(direct&&/\/kitap\//i.test(new URL(direct).pathname)){try{return result({results:[kyProduct(await kyFetch(direct),direct)]});}catch(err){if(String(err).includes('403')){const slug=decodeURIComponent(new URL(direct).pathname.split('/').filter(Boolean)[1]||'').replace(/[-_]+/g,' ');const fallback=await fallbackBookLookup(slug);return result({results:fallback,blocked:true,fallback:'book-databases',message:fallback.length?'Kitapyurdu engelledi; kitap adı bağlantıdan çıkarılıp yedek veritabanında arandı.':'Kitapyurdu engelledi ve yedek kaynakta eşleşme bulunamadı.'});}throw err;}}
      let html='';try{html=await kyFetch('https://www.kitapyurdu.com/index.php?route=product/search&filter_name='+encodeURIComponent(query));}catch(err){if(String(err).includes('(403)')||String(err).includes('403')){const fallback=await fallbackBookLookup(query);return result({results:fallback,blocked:true,fallback:'book-databases',message:fallback.length?'Kitapyurdu erişimi engelledi; sonuçlar yedek kitap veritabanından getirildi.':'Kitapyurdu erişimi engelledi ve yedek kaynakta eşleşme bulunamadı.'});}throw err;}const found=new Map<string,string>();
      for(const m of html.matchAll(/<a[^>]+href=["']((?:https?:\/\/www\.kitapyurdu\.com)?\/kitap\/[^"'?#]+\/\d+\.html[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)){let url=m[1].replace(/&amp;/g,'&');if(url.startsWith('/'))url='https://www.kitapyurdu.com'+url;const title=kyClean(m[2]);if(title&&!found.has(url))found.set(url,title);if(found.size>=8)break;}
      const detailed:any[]=[];for(const url of Array.from(found.keys()).slice(0,5)){try{detailed.push(kyProduct(await kyFetch(url),url));}catch{}}return result({results:detailed});
    }
    if(input.action==='kitapyurdu_import_cover'){const remoteUrl=String(input.url||'').trim();if(!remoteUrl)return result({error:'Kitapyurdu kapak adresi bulunamadı.'},400);return result({url:await kySaveCover(token,remoteUrl)});}
    if (input.action === 'set_book_cover') {
      const id = String(input.id || '').trim();
      const filename = String(input.filename || '');
      const type = String(input.mime || '');
      const base64 = String(input.data || '');
      const formats: Record<string, { ext: string; magic: number[] }> = {
        'image/jpeg': { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
        'image/png': { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
        'image/gif': { ext: 'gif', magic: [0x47, 0x49, 0x46, 0x38] },
        'image/webp': { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] },
      };
      const format = formats[type];
      if (!id || !format || !filename || filename.length > 120 || /[\\/\r\n]/.test(filename) || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > 2_800_000) return result({ error: 'Geçerli bir kitap ve en fazla 2 MB JPEG, PNG, GIF veya WebP kapak seç.' }, 400);
      const binary = atob(base64);
      if (binary.length > 2 * 1024 * 1024 || !format.magic.every((byte, index) => binary.charCodeAt(index) === byte) || (type === 'image/webp' && binary.slice(8, 12) !== 'WEBP')) return result({ error: 'Kapak görselinin biçimi veya boyutu geçersiz.' }, 400);

      // Upload and catalog binding happen in one server request. The client can no
      // longer finish the upload while silently losing the book-cover association.
      const coverPath = `assets/uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${format.ext}`;
      const upload = await fetch(ghUrl(coverPath), {
        method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Upload book cover: ${filename}`, content: base64 }),
      });
      if (!upload.ok) throw new Error(`Kapak yükleme hatası (${upload.status}).`);

      const catalogPath = 'data/site-books.json';
      for (let attempt = 0; attempt < 3; attempt++) {
        const existing = await fetch(ghUrl(catalogPath), { headers: ghHeaders(token), cache: 'no-store' });
        if (!existing.ok) throw new Error('Kitap kataloğu okunamadı.');
        const file = await existing.json();
        const books: any[] = JSON.parse(decode(file.content));
        const index = books.findIndex(book => book.id === id);
        if (index < 0) throw new Error('Kapak bağlanacak kitap bulunamadı.');
        const cover = '/' + coverPath;
        books[index] = { ...books[index], cover, updatedAt: new Date().toISOString() };
        const save = await fetch(ghUrl(catalogPath), {
          method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Set book cover: ' + books[index].title, content: encode(JSON.stringify(books, null, 2) + '\\n'), sha: file.sha }),
        });
        if (save.ok) {
          const verify = await fetch(ghUrl(catalogPath), { headers: ghHeaders(token), cache: 'no-store' });
          if (!verify.ok) throw new Error('Kapak kaydı doğrulanamadı.');
          const verifiedFile = await verify.json();
          const verifiedBooks: any[] = JSON.parse(decode(verifiedFile.content));
          const book = verifiedBooks.find(item => item.id === id);
          if (!book || book.cover !== cover) throw new Error('Kapak yüklendi fakat kitap kaydı doğrulanamadı.');
          return result({ book, url: cover });
        }
        if (save.status !== 409 && save.status !== 422) throw new Error(`Kapak kitap kaydına bağlanamadı (${save.status}).`);
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
      throw new Error('Kitap kataloğu aynı anda değişti. Kapak kaydı güvenli biçimde tamamlanamadı; tekrar dene.');
    }

    if (input.action === 'save_site_music') {
      const title = String(input.title || 'Sükûnet').trim().slice(0,80) || 'Sükûnet';
      const defaultVolume = Math.max(0, Math.min(0.5, Number(input.defaultVolume) || 0.12));
      const filename = String(input.filename || '');
      const type = String(input.mime || '');
      const base64 = String(input.data || '');
      let src = String(input.currentSrc || '').trim();
      if (base64) {
        const formats: Record<string,string> = { 'audio/mpeg':'mp3','audio/mp3':'mp3','audio/ogg':'ogg','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a','audio/x-m4a':'m4a' };
        const ext = formats[type];
        if (!ext || !filename || filename.length > 120 || /[\\/\r\n]/.test(filename) || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > 11_500_000) return result({ error: 'MP3, OGG, WAV veya M4A seç; en fazla 8 MB.' }, 400);
        const binary = atob(base64); if (binary.length > 8*1024*1024) return result({ error: 'Müzik dosyası en fazla 8 MB olabilir.' }, 400);
        const path = 'assets/audio/' + new Date().toISOString().slice(0,10) + '/' + crypto.randomUUID() + '.' + ext;
        const upload = await fetch(ghUrl(path), { method:'PUT', headers:{...ghHeaders(token),'Content-Type':'application/json'}, body:JSON.stringify({message:'Upload site music: '+filename,content:base64}) });
        if (!upload.ok) throw new Error('Müzik yüklenemedi ('+upload.status+').');
        src = '/' + path;
      }
      if (src && !/^\/assets\/audio\/[a-zA-Z0-9_./-]+$/.test(src)) return result({ error:'Müzik yolu geçersiz.' },400);
      const path='data/site-music.json'; const existing=await fetch(ghUrl(path),{headers:ghHeaders(token)});
      let sha:string|undefined;if(existing.ok){sha=(await existing.json()).sha;}else if(existing.status!==404)throw new Error('Müzik ayarları okunamadı.');
      const config={title,src,defaultVolume};
      await putFile(token,path,JSON.stringify(config,null,2)+'\n','Update site music',sha);
      return result({config});
    }
    if (input.action === 'save_quote_entry' || input.action === 'delete_quote_entry') {
      const path='data/quotes.json'; const current=await fetch(ghUrl(path),{headers:ghHeaders(token)});let items:any[]=[];let sha:string|undefined;
      if(current.ok){const data=await current.json();sha=data.sha;try{items=JSON.parse(decodeBase64Utf8(String(data.content||'').replace(/\n/g,'')));}catch{items=[];}}else if(current.status!==404)throw new Error('Alıntı verileri okunamadı.');
      if(!Array.isArray(items))items=[];
      if(input.action==='save_quote_entry'){const x=input.item||{},text=String(x.text||'').trim(),label=String(x.label||'').trim(),category=String(x.category||'idea'),chapter=String(x.chapter||'I'),color=String(x.color||'rose'),page=x.page?Number(x.page):null,id=String(x.id||crypto.randomUUID());if(!text||text.length>1200||label.length>100||!['idea','author','place','style','concept'].includes(category)||!['I','II','III','IV','V','VI','VII','VIII','IX'].includes(chapter)||!['rose','mint','blue','amber'].includes(color)||page!==null&&(!Number.isInteger(page)||page<1||page>9999))return result({error:'Alıntı bilgileri geçersiz.'},400);items.unshift({id,text,label,category,chapter,color,page,createdAt:new Date().toISOString()});}
      else{const id=String(input.id||'');items=items.filter((x:any)=>String(x.id)!==id);}
      await putFile(token,path,JSON.stringify(items,null,2)+'\n',input.action==='save_quote_entry'?'Add quotation':'Delete quotation',sha);return result({items});
    }
    if (input.action === 'upload_image') {
      const filename = String(input.filename || '');
      const type = String(input.mime || '');
      const base64 = String(input.data || '');
      const formats: Record<string, { ext: string; magic: number[] }> = {
        'image/jpeg': { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
        'image/png': { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
        'image/gif': { ext: 'gif', magic: [0x47, 0x49, 0x46, 0x38] },
        'image/webp': { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] },
      };
      const format = formats[type];
      if (!format || !filename || filename.length > 120 || /[\\/\r\n]/.test(filename) || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > 2_800_000) return result({ error: 'JPEG, PNG, GIF veya WebP görsel seç (en fazla 2 MB).' }, 400);
      const binary = atob(base64);
      if (binary.length > 2 * 1024 * 1024 || !format.magic.every((byte, index) => binary.charCodeAt(index) === byte) || (type === 'image/webp' && binary.slice(8, 12) !== 'WEBP')) return result({ error: 'Görsel biçimi veya boyutu geçersiz.' }, 400);
      const isQuotePhoto = input.gallery === 'iktibas-alintilar';
      const path = isQuotePhoto
        ? `iktibas-alintilar/fotograflar/${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${crypto.randomUUID()}.${format.ext}`
        : `assets/uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${format.ext}`;
      const res = await fetch(ghUrl(path), {
        method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Upload image: ${filename}`, content: base64 }),
      });
      if (!res.ok) throw new Error(`Görsel yükleme hatası (${res.status}).`);
      return result({ url: `/${path}` });
    }
    if (input.action === 'load_article' || input.action === 'update_article' || input.action === 'delete_article') {
      const path = String(input.path || '');
      const { categories } = await getCategories(token);
      const original = await getArticle(token, path, categories);
      if (input.action === 'load_article') return result({ ...original, path });
      if (String(input.sha || '') !== original.sha) return result({ error: 'Yazı başka bir işlemle değişti. Listeyi yenileyip tekrar aç.' }, 409);
      if (input.action === 'delete_article') {
        const res = await fetch(ghUrl(path), {
          method: 'DELETE', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Delete article: ${path}`, sha: original.sha }),
        });
        if (!res.ok) throw new Error(`GitHub silme hatası (${res.status}).`);
        return result({ ok: true });
      }
      const title = String(input.title || '').trim(), description = String(input.description || '').trim();
      let body = String(input.body || '').trim();
      const category = String(input.category || '');
      if (!categories.some(item => categoryPath(item) === category)) return result({ error: 'Kategori geçersiz.' }, 400);
      if (!title || title.length > 160 || description.length > 500 || !body) return result({ error: 'Başlık veya yazı içeriği geçersiz.' }, 400);
      body = sanitizeArticleHtml(body);
      body = await persistPdfAttachments(token, body);
      const article = /(<article\b[^>]*\byazi-icerik\b[^>]*>)[\s\S]*?(<\/article>)/i;
      let updated = original.content;
      if (!/<div class="article-head">[\s\S]*?<h1>[\s\S]*?<\/h1>/.test(updated) || !/<meta name="description" content="[^"]*">/.test(updated) || !article.test(updated)) throw new Error('Yazının biçimi düzenleme için uygun değil.');
      updated = updated.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)} | Furkan Sağdıç</title>`);
      updated = updated.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`);
      updated = updated.replace(/(<div class="article-head">[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/, (_all, before, after) => `${before}${escapeHtml(title)}${after}`);
      updated = updated.replace(article, (_all, before, after) => `${before}${body}${after}`);
      updated = updated.replace(/(<article\b[^>]*\byazi-icerik\b[^>]*)(>)/i, (_all, before, after) => `${before.replace(/\sdata-category="[^"]*"/i, '')} data-category="${category}"${after}`);
      const sha = await putFile(token, path, updated, `Update article: ${title}`, original.sha);
      return result({ url: `/${path.replace(/index\.html$/, '')}`, sha, body });
    }
    if (input.action === 'publish') {
      const title = String(input.title || '').trim(), description = String(input.description || '').trim();
      let body = String(input.body || '').trim();
      const category = String(input.category || '');
      if (!title || title.length > 160 || description.length > 500 || !body) return result({ error: 'Başlık veya yazı içeriği geçersiz.' }, 400);
      body = sanitizeArticleHtml(body);
      const { categories } = await getCategories(token);
      const selected = categories.find(item => categoryPath(item) === category);
      if (!selected) return result({ error: 'Kategori geçersiz.' }, 400);
      const articleSlug = slug(title);
      if (!articleSlug || articleSlug.length > 100) return result({ error: 'Başlık URL için uygun değil.' }, 400);
      const path = [category, articleSlug, 'index.html'].join('/');
      const url = `/${path.replace(/index\.html$/, '')}`;
      const existing = await fetch(ghUrl(path), { headers: ghHeaders(token) });
      if (existing.ok) return result({ error: 'Bu başlıkla bir yazı zaten var.' }, 409);
      if (existing.status !== 404) throw new Error('Yazı yolu kontrol edilemedi.');
      body = await persistPdfAttachments(token, body);
      const cover = input.skipCover === true ? null : await generateCover(token, title, description, body);
      const date = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date());
      const coverHtml = cover ? `<figure class="article-cover"><img src="${cover}" alt="${escapeHtml(title)} için oluşturulmuş kapak görseli" width="1200" height="675"></figure>` : '';
      const coverAttr = cover ? ` data-cover="${cover}"` : '';
      const page = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Furkan Sağdıç</title><meta name="description" content="${escapeHtml(description)}"><link rel="stylesheet" href="/style.css"></head><body><header class="masthead"><div class="topline"><a class="brand" href="/">Furkan Sağdıç</a></div></header><main><div class="article-head"><a class="back" href="/${category}/">← ${escapeHtml(selected.name)}</a><div class="eyebrow">${escapeHtml(selected.name)} · ${date}</div><h1>${escapeHtml(title)}</h1></div>${coverHtml}<article class="prose yazi-icerik" data-article="true"${coverAttr}>${body}</article></main></body></html>`;
      await putFile(token, path, page, `Publish article: ${title}`);
      return result({ url, coverConfigured: Boolean(cover), body });
    }
    return result({ error: 'İşlem tanınmadı.' }, 400);
  } catch (error) {
    return result({ error: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' }, 400);
  }
});
