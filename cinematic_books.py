"""Philosophy book catalog derived from published notes and editor metadata."""
from html import escape
from lxml import html
import json

def build_cinematic(root, articles, categories, doc, write):
    prefix = 'kitap-notlari/felsefe'
    # The admin stores the authoritative book cover in data/site-books.json.
    # Article metadata can be stale after a cover edit, so the catalog must win.
    catalog = []
    catalog_path = root / 'data/site-books.json'
    if catalog_path.is_file():
        try:
            raw = catalog_path.read_text(encoding='utf-8').rstrip()
            if raw.endswith(r'\n'):
                raw = raw[:-2]
            catalog = json.loads(raw)
        except Exception:
            catalog = []
    catalog_by_id = {str(b.get('id','')).strip('/'): b for b in catalog if b.get('id')}
    catalog_by_title = {str(b.get('title','')).strip().casefold(): b for b in catalog if b.get('title')}
    groups = {}
    for a in articles:
        if not a.get('categoryPath', '').startswith(prefix):
            continue
        path = root / a['url'].lstrip('/') / 'index.html'
        tree = html.fromstring(path.read_text(encoding='utf-8'))
        metadata = tree.xpath('//*[@data-book-title]')
        m = metadata[0] if metadata else None
        title = m.get('data-book-title') if m is not None else a['title']
        url = a['url']
        author = m.get('data-book-author', '') if m is not None else ''
        cover = m.get('data-book-cover', '') if m is not None else ''
        if '/bir-birey-nasil-yasayabilir/' in url:
            title = (m.get('data-book-title') if m is not None else None) or 'Bir birey nasıl yaşayabilir?'
            url = '/kitap-notlari/felsefe/bir-birey-nasil-yasayabilir/'
        elif '/gundelik-hayat-tenkidleri/' in url:
            title = (m.get('data-book-title') if m is not None else None) or 'Gündelik Hayat Tenkidleri'
            url = '/kitap-notlari/felsefe/gundelik-hayat-felsefesi/gundelik-hayat-tenkidleri/'
        if not cover.startswith('/assets/') or '..' in cover:
            cover = ''
        key = title.casefold()
        b = groups.setdefault(key, dict(title=title, author=author, cover=cover, url=url, chapters=[]))
        if author: b['author'] = author
        if cover: b['cover'] = cover
        if tree.xpath('//article[contains(@class,"yazi-icerik")]'):
            b['chapters'].append(dict(title=a['title'], url=a['url']))
    # Overlay admin catalog data after discovering the notes. This preserves the
    # generated chapter grouping while making edited covers/authors authoritative.
    for b in groups.values():
        record = catalog_by_id.get(str(b.get('url','')).strip('/')) or catalog_by_title.get(str(b.get('title','')).strip().casefold())
        if not record:
            continue
        saved_cover = str(record.get('cover','')).strip()
        if saved_cover.startswith('/assets/') and '..' not in saved_cover:
            b['cover'] = saved_cover
        if record.get('author'):
            b['author'] = str(record['author'])
    books = list(groups.values())
    books.sort(key=lambda b: ('bir birey' not in b['title'].lower(), b['title'].lower()))
    e = lambda s: escape(str(s), quote=True)
    cards, rows = [], []
    for i, b in enumerate(books):
        # Named books can collect notes from different subcategories.
        if len(b['chapters']) > 1 and b['url'] == b['chapters'][0]['url']:
            b['url'] = '#book-chapters-' + str(i)
        count = len(b['chapters'])
        label = f'{count} bölüm' if count else 'Kitap notları'
        art = f'<img src="{e(b["cover"])}" alt="" width="400" height="600" decoding="async">' if b['cover'] else ''
        cover = f'<span class="book-front">{art}<span class="book-lettering"><strong>{e(b["title"])}</strong><small>{e(b["author"])}</small><span aria-hidden="true">✧</span></span></span><span class="book-pages" aria-hidden="true"></span>'
        cards.append(f'<button class="cinema-book {"has-cover" if art else ""}" type="button" data-index="{i}" data-title="{e(b["title"])}" data-author="{e(b["author"])}" data-url="{e(b["url"])}" data-count="{e(label)}" aria-label="{e(b["title"])} kitabını seç" aria-pressed="{str(i == 0).lower()}">{cover}</button>')
        thumb = f'<img src="{e(b["cover"])}" alt="" width="48" height="72" loading="lazy">' if art else '<span class="book-mini" aria-hidden="true">✧</span>'
        rows.append(f'<div class="book-list-row"><a href="{e(b["url"])}">{thumb}<span><strong>{e(b["title"])}</strong><small>{e(b["author"])} · {e(label)}</small></span><span aria-hidden="true">›</span></a></div>')
        if b['url'].startswith('#'):
            rows.append(f'<details id="book-chapters-{i}" class="book-chapter-links"><summary>{e(b["title"])} — bölümler</summary>'+''.join(f'<a href="{e(c["url"])}">{e(c["title"])}</a>' for c in b['chapters'])+'</details>')
    first = books[0] if books else dict(title='Henüz kitap eklenmedi', url='#kitap-listesi')
    hero = '<section class="book-cinema" aria-labelledby="cinema-title"><a class="cinema-back" href="/kitap-notlari/">Kitap Notları / Felsefe</a><h1 id="cinema-title">Felsefe</h1><div class="book-stage">'+''.join(cards)+'</div><div class="cinema-controls"><button type="button" id="book-prev" aria-label="Önceki kitap">‹</button><div class="cinema-selection" aria-live="polite"><h2 id="book-selected-title">'+e(first['title'])+'</h2><p id="book-selected-meta"></p><a id="book-open" href="'+e(first['url'])+'">Notları Oku</a></div><button type="button" id="book-next" aria-label="Sonraki kitap">›</button></div><a class="cinema-down" href="#kitap-listesi">Kitap listesine geç ↓</a></section>'
    links = ''.join(f'<a href="/{e(k)}/">{e(v)}</a>' for k,v in categories.items() if k.rsplit('/',1)[0] == prefix)
    lower = '<section class="cinema-list" id="kitap-listesi"><h2>Kategoriler ve Kitaplar</h2><nav class="cinema-categories" aria-label="Felsefe alt kategorileri">'+links+'</nav><div class="book-direct-list">'+''.join(rows)+'</div></section>'
    page = doc('Felsefe', hero+lower, 'kitap-notlari')
    page = page.replace('<body>', '<body class="cinema-page">').replace('</head>', '<link rel="stylesheet" href="/cinematic-books.css?v=20261004-catalog1"></head>').replace('</body>', '<script src="/cinematic-books.js?v=20261004-catalog1" defer></script></body>')
    write(prefix+'/index.html', page)
