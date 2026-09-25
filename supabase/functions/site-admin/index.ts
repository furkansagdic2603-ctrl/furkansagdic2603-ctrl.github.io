const SITE_ORIGIN = 'https://furkansagdic.com.tr';
const PROJECT_URL = 'https://vdwioetyxlujrhqrzhwc.supabase.co';
const PUBLIC_KEY = 'sb_publishable_4dB2-eRe_FEkJJfkzaLwoQ_UuzIF5WT';
const REPOSITORY = 'furkansagdic2603-ctrl/furkansagdic2603-ctrl.github.io';
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const cors = {
  'Access-Control-Allow-Origin': SITE_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const result = (data: object, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
const slug = (s: string) => s.toLocaleLowerCase('tr').replace(/[ıİ]/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
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
const audioStore = (path: string) => `${PROJECT_URL}/storage/v1/object/article-audio/${path.split('/').map(encodeURIComponent).join('/')}`;
function speechChunks(page: string) {
  const match = page.match(/<article\b[^>]*\byazi-icerik\b[^>]*>([\s\S]*?)<\/article>/i);
  if (!match) throw new Error('Seslendirilecek yazı bulunamadı.');
  const plain = match[1].replace(/<\s*br\s*\/?\s*>|<\/(?:p|h[1-6]|li|blockquote)>/gi, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, entity => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[entity] || entity)
    .replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let current = '';
  for (const word of plain.split(' ')) {
    if (current && (current.length + word.length + 1 > 1800)) { chunks.push(current); current = ''; }
    current += (current ? ' ' : '') + word;
  }
  if (current) chunks.push(current);
  if (!chunks.length || chunks.length > 300) throw new Error('Yazı seslendirme sınırını aşıyor.');
  return chunks;
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
    if (Number(req.headers.get('content-length') || 0) > MAX_REQUEST_BYTES) return result({ error: 'Yazı 4 MB sınırını aşıyor. Görselleri bağlantı olarak ekle veya yazıyı bölümlere ayır.' }, 413);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_REQUEST_BYTES) return result({ error: 'Yazı 4 MB sınırını aşıyor. Görselleri bağlantı olarak ekle veya yazıyı bölümlere ayır.' }, 413);
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
    if (input.action === 'generate_audio_chunk') {
      const path = String(input.path || '');
      const index = Number(input.index);
      const key = Deno.env.get('OPENAI_API_KEY');
      if (!key) return result({ error: 'Yapay zekâ seslendirmesi için OPENAI_API_KEY Supabase sırrını ekle.' }, 503);
      const { categories } = await getCategories(token);
      const article = await getArticle(token, path, categories);
      const chunks = speechChunks(article.content);
      if (!Number.isSafeInteger(index) || index < 0 || index >= chunks.length) return result({ error: 'Ses parçası numarası geçersiz.' }, 400);
      const prefix = `${path.replace(/\/index\.html$/, '')}/${article.sha.slice(0, 12)}`;
      const audioPath = `${prefix}/part-${String(index).padStart(3, '0')}.mp3`;
      const existing = await fetch(audioStore(audioPath), { method: 'HEAD' });
      if (!existing.ok) {
        const generated = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'coral', input: chunks[index], instructions: 'Türkçe metni doğal, sakin ve anlaşılır bir sesle oku.', response_format: 'mp3' }),
        });
        if (!generated.ok) throw new Error(`Yapay zekâ seslendirmesi başarısız (${generated.status}). API anahtarını ve krediyi kontrol et.`);
        const upload = await fetch(audioStore(audioPath), { method: 'POST', headers: { ...commentHeaders(), 'Content-Type': 'audio/mpeg', 'x-upsert': 'true' }, body: await generated.arrayBuffer() });
        if (!upload.ok) throw new Error(`Ses dosyası saklanamadı (${upload.status}). Kurulum SQL dosyasını çalıştır.`);
      }
      if (index === chunks.length - 1) {
        const manifest = { parts: chunks.length, version: article.sha.slice(0, 12), model: 'gpt-4o-mini-tts' };
        const uploaded = await fetch(audioStore(`${path.replace(/\/index\.html$/, '')}/manifest.json`), { method: 'POST', headers: { ...commentHeaders(), 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: JSON.stringify(manifest) });
        if (!uploaded.ok) throw new Error(`Ses listesi saklanamadı (${uploaded.status}).`);
      }
      return result({ index, total: chunks.length, ready: index === chunks.length - 1, cached: existing.ok });
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
    if (input.action === 'add_category') {
      const name = String(input.name || '').trim();
      const parent = String(input.parent || '');
      const categorySlug = slug(name);
      if (!name || name.length > 50 || !/^[\p{L}\p{N} &-]+$/u.test(name) || !/^[a-z][a-z0-9-]{1,39}$/.test(categorySlug)) return result({ error: 'Geçerli bir kategori adı yaz.' }, 400);
      const { categories, sha } = await getCategories(token);
      if (parent && (!categories.some(item => categoryPath(item) === parent) || parent.split('/').length >= 4)) return result({ error: 'Üst kategori geçersiz.' }, 400);
      const path = `${parent ? parent + '/' : ''}${categorySlug}`;
      if (categories.some(item => categoryPath(item) === path)) return result({ error: 'Bu kategori zaten var.' }, 409);
      categories.push({ slug: categorySlug, name, ...(parent ? { parent } : {}) });
      await putFile(token, 'data/categories.json', JSON.stringify(categories, null, 2) + '\n', `Add category: ${name}`, sha);
      return result({ path, categories });
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
      const path = `assets/uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${format.ext}`;
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
      const body = String(input.body || '').trim();
      const category = String(input.category || '');
      if (!categories.some(item => categoryPath(item) === category)) return result({ error: 'Kategori geçersiz.' }, 400);
      if (!title || title.length > 160 || description.length > 500 || !body) return result({ error: 'Başlık veya yazı içeriği geçersiz.' }, 400);
      if (/<\s*(script|iframe|object|embed|form|base|link|meta)\b|\bon[a-z]+\s*=|javascript:/i.test(body)) return result({ error: 'Yazı içinde izin verilmeyen HTML var.' }, 400);
      const article = /(<article\b[^>]*\byazi-icerik\b[^>]*>)[\s\S]*?(<\/article>)/i;
      let updated = original.content;
      if (!/<div class="article-head">[\s\S]*?<h1>[\s\S]*?<\/h1>/.test(updated) || !/<meta name="description" content="[^"]*">/.test(updated) || !article.test(updated)) throw new Error('Yazının biçimi düzenleme için uygun değil.');
      updated = updated.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)} | Furkan Sağdıç</title>`);
      updated = updated.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`);
      updated = updated.replace(/(<div class="article-head">[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/, (_all, before, after) => `${before}${escapeHtml(title)}${after}`);
      updated = updated.replace(article, (_all, before, after) => `${before}${body}${after}`);
      updated = updated.replace(/(<article\b[^>]*\byazi-icerik\b[^>]*)(>)/i, (_all, before, after) => `${before.replace(/\sdata-category="[^"]*"/i, '')} data-category="${category}"${after}`);
      const sha = await putFile(token, path, updated, `Update article: ${title}`, original.sha);
      await fetch(audioStore(`${path.replace(/\/index\.html$/, '')}/manifest.json`), { method: 'DELETE', headers: commentHeaders() }).catch(() => {});
      return result({ url: `/${path.replace(/index\.html$/, '')}`, sha });
    }
    if (input.action === 'publish') {
      const title = String(input.title || '').trim(), description = String(input.description || '').trim();
      const body = String(input.body || '').trim(), category = String(input.category || '');
      if (!title || title.length > 160 || description.length > 500 || !body) return result({ error: 'Başlık veya yazı içeriği geçersiz.' }, 400);
      if (/<\s*(script|iframe|object|embed|form|base|link|meta)\b|\bon[a-z]+\s*=|javascript:/i.test(body)) return result({ error: 'Yazı içinde izin verilmeyen HTML var.' }, 400);
      const { categories } = await getCategories(token);
      const selected = categories.find(item => categoryPath(item) === category);
      if (!selected) return result({ error: 'Kategori geçersiz.' }, 400);
      const articleSlug = slug(title);
      if (!articleSlug || articleSlug.length > 100) return result({ error: 'Başlık URL için uygun değil.' }, 400);
      const path = [category, articleSlug, 'index.html'].join('/');
      const url = `/${path.replace(/index\.html$/, '')}`;
      const date = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date());
      const page = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Furkan Sağdıç</title><meta name="description" content="${escapeHtml(description)}"><link rel="stylesheet" href="/style.css"></head><body><header class="masthead"><div class="topline"><a class="brand" href="/">Furkan Sağdıç</a></div></header><main><div class="article-head"><a class="back" href="/${category}/">← ${escapeHtml(selected.name)}</a><div class="eyebrow">${escapeHtml(selected.name)} · ${date}</div><h1>${escapeHtml(title)}</h1></div><article class="prose yazi-icerik" data-article="true">${body}</article></main></body></html>`;
      await putFile(token, path, page, `Publish article: ${title}`);
      return result({ url });
    }
    return result({ error: 'İşlem tanınmadı.' }, 400);
  } catch (error) {
    return result({ error: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' }, 400);
  }
});
