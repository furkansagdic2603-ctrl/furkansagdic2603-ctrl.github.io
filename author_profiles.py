"""Build static müellif profile pages from the personal bibliography."""
from pathlib import Path
from html import escape
import json, re, unicodedata
from semantic_relations import build_semantic_relations

TR_MAP = str.maketrans({'ı':'i','ç':'c','ğ':'g','ö':'o','ş':'s','ü':'u','İ':'i','Ç':'c','Ğ':'g','Ö':'o','Ş':'s','Ü':'u'})

def norm(value):
    value = unicodedata.normalize('NFD', str(value or '')).translate(TR_MAP)
    value = ''.join(ch for ch in value if unicodedata.category(ch) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', ' ', value).strip()

def slugify(value):
    return re.sub(r'[^a-z0-9]+', '-', norm(value)).strip('-') or 'isimsiz'

def display_score(name):
    text = str(name or '').strip()
    all_caps = bool(text) and text.upper() == text and any(ch.isalpha() for ch in text)
    noisy = '(' in text or ',' in text or '/' in text
    return (0 if noisy else 4) + (0 if all_caps else 3) + min(len(text), 48) / 100

def build_author_groups(books):
    raw = {}
    for book in books:
        name = str(book.get('author') or '').strip()
        key = norm(name)
        if not key:
            continue
        raw.setdefault(key, {'names': [], 'books': []})
        raw[key]['names'].append(name)
        raw[key]['books'].append(book)

    aliases = {}
    keys = list(raw)
    for key in keys:
        parts = key.split()
        if len(parts) != 1 or len(key) < 4:
            continue
        candidates = [k for k in keys if k != key and k.split()[-1:] == [key] and len(k.split()) > 1]
        if len(candidates) == 1:
            aliases[key] = candidates[0]

    groups = {}
    for key, data in raw.items():
        canonical = aliases.get(key, key)
        group = groups.setdefault(canonical, {'keys': set(), 'names': [], 'books': []})
        group['keys'].add(key)
        group['names'].extend(data['names'])
        group['books'].extend(data['books'])

    for key, group in groups.items():
        names = sorted(set(group['names']), key=lambda n: (-display_score(n), n.casefold()))
        group['name'] = names[0] if names else key.title()
        group['slug'] = slugify(group['name'])
        group['keys'].add(key)
    return groups, aliases

def related_items(group, site_books, quotes, semantic_articles):
    keys = {norm(x) for x in group['names'] if norm(x)}
    surnames = {k.split()[-1] for k in keys if len(k.split()[-1]) >= 5}

    def mentions(text):
        hay = ' ' + norm(text) + ' '
        if any((' ' + k + ' ') in hay for k in keys if len(k) >= 5):
            return True
        return any((' ' + s + ' ') in hay for s in surnames)

    related_books = []
    for item in site_books:
        if norm(item.get('author')) in keys or mentions(item.get('author')):
            path = str(item.get('id') or '').strip('/')
            related_books.append({
                'title': item.get('title') or 'Kitap notu',
                'url': '/' + path + '/' if path else '',
                'cover': item.get('cover') or '',
                'description': item.get('description') or ''
            })

    note_urls = {item.get('url') for item in related_books if item.get('url')}
    related_articles = []
    seen = set()
    for article in semantic_articles or []:
        url = article.get('url') or ''
        if not url or url in seen or url in note_urls:
            continue
        seen.add(url)
        related_articles.append(article)

    related_quotes = []
    for quote in quotes:
        label = str(quote.get('label') or '')
        if norm(label) in keys or mentions(label):
            related_quotes.append(quote)
    return related_books[:12], related_articles[:18], related_quotes[:10]

def strength_class(value):
    return {'çok güçlü':'cok-guclu','güçlü':'guclu','muhtemel':'muhtemel'}.get(str(value or '').strip(), 'muhtemel')

def evidence_text(article):
    seen = []
    for item in article.get('semanticEvidence') or []:
        term = str(item.get('term') or '').strip()
        if term and term not in seen:
            seen.append(term)
    return ', '.join(seen[:4])

def book_row(book):
    title = escape(str(book.get('title') or 'İsimsiz eser'))
    publisher = escape(str(book.get('publisher') or '—'))
    pages = escape(str(book.get('pages') or '—'))
    translator = escape(str(book.get('translator') or '—'))
    return f'<tr><td>{title}</td><td>{publisher}</td><td>{pages}</td><td>{translator}</td></tr>'

def build_author_profiles(root, articles, doc, write):
    root = Path(root)
    books = json.loads((root/'data/books.json').read_text(encoding='utf-8'))
    try:
        site_books = json.loads((root/'data/site-books.json').read_text(encoding='utf-8'))
    except Exception:
        site_books = []
    try:
        quotes = json.loads((root/'data/quotes.json').read_text(encoding='utf-8'))
    except Exception:
        quotes = []

    groups, aliases = build_author_groups(books)
    semantic_relations = build_semantic_relations(root, articles, groups)
    urls = set()
    index_items = []

    for key, group in sorted(groups.items(), key=lambda kv: kv[1]['name'].casefold()):
        name = group['name']
        slug = group['slug']
        library = sorted(group['books'], key=lambda b: str(b.get('title') or '').casefold())
        publishers = sorted({str(b.get('publisher') or '').strip() for b in library if str(b.get('publisher') or '').strip()})
        notes, related_articles, related_quotes = related_items(group, site_books, quotes, semantic_relations.get(key, []))

        stats = (
            f'<div class="author-profile-stats">'
            f'<div><strong>{len(library)}</strong><span>Kütüphanemdeki eser</span></div>'
            f'<div><strong>{len(publishers)}</strong><span>Yayınevi</span></div>'
            f'<div><strong>{len(notes)+len(related_articles)}</strong><span>İlgili not / yazı</span></div>'
            f'<div><strong>{len(related_quotes)}</strong><span>İlgili alıntı</span></div>'
            f'</div>'
        )
        aliases_text = sorted({n for n in group['names'] if n != name}, key=str.casefold)
        alias_html = ''
        if aliases_text:
            alias_html = '<p class="author-aliases"><span>Kayıtlardaki diğer yazımlar</span> ' + ' · '.join(escape(x) for x in aliases_text[:6]) + '</p>'

        works = ''.join(book_row(b) for b in library)
        work_section = (
            '<section class="author-section author-library"><div class="author-section-head">'
            f'<div><span class="eyebrow">KİŞİSEL KÜTÜPHANE</span><h2>Eserleri</h2></div><strong>{len(library)}</strong></div>'
            '<div class="author-work-table-wrap"><table class="author-work-table"><thead><tr><th>Eser</th><th>Yayınevi</th><th>Sayfa</th><th>Mütercim</th></tr></thead>'
            f'<tbody>{works}</tbody></table></div></section>'
        )

        note_cards = ''.join(
            f'<a class="author-note-card" href="{escape(n["url"], quote=True)}">'
            + (f'<img src="{escape(n["cover"], quote=True)}" alt="" loading="lazy">' if n.get('cover') else '<span class="author-note-cover">✦</span>')
            + f'<span><small>KİTAP NOTU</small><strong>{escape(str(n["title"]))}</strong></span></a>'
            for n in notes if n.get('url')
        )
        article_cards = ''.join(
            f'<a class="author-article-card" href="{escape(str(a.get("url") or ""), quote=True)}">'
            f'<div class="author-relation-meta"><small>{escape(str(a.get("date") or "YAZI"))}</small>'
            f'<em class="semantic-badge semantic-{strength_class(a.get("semanticStrength"))}">{escape(str(a.get("semanticStrength") or "ilişkili"))} ilişki</em></div>'
            f'<strong>{escape(str(a.get("title") or "Yazı"))}</strong><span>{escape(str(a.get("description") or "")[:180])}</span>'
            + (f'<p class="semantic-evidence">Bağ: {escape(evidence_text(a))}</p>' if evidence_text(a) else '')
            + '</a>'
            for a in related_articles
        )
        related_html = ''
        if note_cards or article_cards:
            related_html = '<section class="author-section"><div class="author-section-head"><div><span class="eyebrow">SEMANTİK BAĞLANTILAR</span><h2>Notlar ve yazılar</h2></div></div><div class="author-related-grid">' + note_cards + article_cards + '</div></section>'

        quote_html = ''
        if related_quotes:
            quote_html = '<section class="author-section"><div class="author-section-head"><div><span class="eyebrow">İKTİBASLAR</span><h2>Alıntılar</h2></div></div><div class="author-quote-grid">' + ''.join(
                f'<blockquote><p>{escape(str(q.get("text") or ""))}</p><footer>{escape(str(q.get("label") or name))}'
                + (f' · s. {escape(str(q.get("page")))}' if q.get('page') else '') + '</footer></blockquote>'
                for q in related_quotes
            ) + '</div></section>'

        publisher_html = ''
        if publishers:
            publisher_html = '<div class="author-publishers"><span>Yayınevleri</span><div>' + ''.join(f'<em>{escape(p)}</em>' for p in publishers[:18]) + '</div></div>'

        research_section = (
            f'<section class="author-research" data-author-research data-author-name="{escape(name, quote=True)}" data-author-slug="{escape(slug, quote=True)}">'
            '<div class="author-research-intro"><div><span class="eyebrow">ARAŞTIRMA DOSYASI</span><h2>Hayatı, düşüncesi ve eserleri</h2>'
            '<p>Bu bölüm uluslararası ve Türkçe bibliyografik kataloglardan canlı olarak derlenir.</p></div><p id="author-research-meta" class="author-research-meta"></p></div>'
            '<div class="author-research-grid">'
            '<article class="author-research-card"><span class="author-research-number">01</span><h3>Hayatı</h3><p id="author-life" class="author-research-text">Biyografik kayıtlar getiriliyor…</p></article>'
            '<article class="author-research-card"><span class="author-research-number">02</span><h3>Düşüncesi / Felsefesi</h3><p id="author-thought" class="author-research-text">Düşünsel çerçeve hazırlanıyor…</p></article>'
            '</div>'
            '<section class="author-bibliography-block"><div class="author-section-head"><div><span class="eyebrow">ÖZGÜN KÜLLİYAT</span><h2>Anadilinde / özgün eserleri</h2></div><strong id="author-original-count">…</strong></div>'
            '<p class="author-source-note">Wikidata ve Open Library kayıtları birleştirilir. Başlıklar kaynak katalogların ana kayıt biçiminde korunur.</p>'
            '<ol id="author-original-works" class="author-external-work-list"><li class="author-loading-row">Eser kataloğu hazırlanıyor…</li></ol></section>'
            '<section class="author-bibliography-block"><div class="author-section-head"><div><span class="eyebrow">TÜRKÇE TERCÜMELER</span><h2>Türkçeye çevrilen eserleri</h2></div><strong id="author-turkish-count">…</strong></div>'
            '<p class="author-source-note">Türkçe baskı ve tercüme kayıtları Google Books kataloğundan taranır ve mükerrer kayıtlar ayıklanır.</p>'
            '<ol id="author-turkish-works" class="author-external-work-list"><li class="author-loading-row">Türkçe katalog taranıyor…</li></ol></section>'
            '<p id="author-research-sources" class="author-research-sources">Kaynaklar hazırlanıyor…</p></section>'
        )
        main = (
            '<section class="author-profile-hero"><a class="back" href="/kaynakca/">← Kaynakça</a>'
            '<div class="author-monogram"><span aria-hidden="true">' + escape(name[:1].upper()) + '</span><img id="author-portrait" src="" alt="' + escape(name, quote=True) + ' portresi" hidden loading="lazy"></div>'
            '<div class="author-profile-copy"><span class="eyebrow">MÜELLİF DOSYASI</span>'
            f'<h1>{escape(name)}</h1><p>Hayatı, düşüncesi, eser külliyatı, Türkçe tercümeleri ve benim kütüphanemde bulunan nüshaları tek dosyada topluyorum.</p>{alias_html}{publisher_html}</div></section>'
            + stats + research_section + work_section + related_html + quote_html
        )
        page = doc(name + ' — Müellif', main, '', f'{name} için kişisel kütüphane eserleri, kitap notları ve ilgili yazılar.')
        page = page.replace('/style.css?v=20261020-ultrarealbook1','/style.css?v=20261021-author-research1').replace('</body>','<script src="/author-research.js?v=20261021-1" defer></script></body>')
        write(f'muellif/{slug}/index.html', page)
        url = f'/muellif/{slug}/'
        urls.add(url)
        index_items.append((name, url, len(library)))

    groups_by_letter = {}
    for name, url, count in index_items:
        letter = name[:1].upper() if name else '#'
        groups_by_letter.setdefault(letter, []).append((name,url,count))
    index_body = '<section class="page-head author-index-head"><span class="eyebrow">KÜTÜPHANE DİZİNİ</span><h1>Müellifler</h1><p>Kişisel kütüphanemdeki müellifler ve eserleri.</p></section><section class="author-index">'
    for letter in sorted(groups_by_letter, key=lambda x: x.casefold()):
        index_body += f'<section class="author-letter"><h2>{escape(letter)}</h2><div>'
        index_body += ''.join(f'<a href="{escape(url, quote=True)}"><span>{escape(name)}</span><small>{count} eser</small></a>' for name,url,count in groups_by_letter[letter])
        index_body += '</div></section>'
    index_body += '</section>'
    index_page = doc('Müellifler', index_body, '', 'Kişisel kütüphanedeki müellifler ve eserleri.')
    index_page = index_page.replace('/style.css?v=20261020-ultrarealbook1','/style.css?v=20261021-author-research1')
    write('muellif/index.html', index_page)
    urls.add('/muellif/')
    return urls
