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
      if (!title || title.length > 160 || description.length > 500 || !body) return result({ error: 'Başlık veya yazı içeriği geçersiz.' }, 400);
      if (/<\s*(script|iframe|object|embed|form|base|link|meta)\b|\bon[a-z]+\s*=|javascript:/i.test(body)) return result({ error: 'Yazı içinde izin verilmeyen HTML var.' }, 400);
      const article = /(<article\b[^>]*\byazi-icerik\b[^>]*>)[\s\S]*?(<\/article>)/i;
      let updated = original.content;
      if (!/<div class="article-head">[\s\S]*?<h1>[\s\S]*?<\/h1>/.test(updated) || !/<meta name="description" content="[^"]*">/.test(updated) || !article.test(updated)) throw new Error('Yazının biçimi düzenleme için uygun değil.');
      updated = updated.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)} | Furkan Sağdıç</title>`);
      updated = updated.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`);
      updated = updated.replace(/(<div class="article-head">[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/, (_all, before, after) => `${before}${escapeHtml(title)}${after}`);
      updated = updated.replace(article, (_all, before, after) => `${before}${body}${after}`);
      const sha = await putFile(token, path, updated, `Update article: ${title}`, original.sha);
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
