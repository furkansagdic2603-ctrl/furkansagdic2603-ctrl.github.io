"""Generate the GitHub Pages index, archive, categories and clean article pages."""
from pathlib import Path
from lxml import html, etree
import json, re
from html import escape
from math import ceil
from functools import lru_cache
from urllib.parse import unquote, urlsplit
from PIL import Image

ROOT = Path(__file__).parent
CATEGORY_ROWS = json.loads((ROOT/'data/categories.json').read_text(encoding='utf-8'))
CATS = {item['slug']: item['name'] for item in CATEGORY_ROWS if not item.get('parent')}
CATEGORY_PATHS = {item.get('parent', '') + ('/' if item.get('parent') else '') + item['slug']: item['name'] for item in CATEGORY_ROWS}
BOOK_TOPICS = {item['slug']:item['name'] for item in CATEGORY_ROWS if item.get('parent') == 'kitap-notlari'}
EXTRAS = {'kaynakca':'Kaynakça','galeri':'Galeri','hakkimda':'Hakkımda','iletisim':'İletişim','arsiv':'Arşiv'}
HOME_HIDDEN_CATEGORIES = {'din', 'mitoloji', 'sosyoloji', 'psikoloji', 'bilim', 'felsefe', 'sanat'}

def hero_design():
    palette = json.loads((ROOT/'data/theme.json').read_text(encoding='utf-8'))
    return {'#b46f48': 'iznik', '#ad853c': 'cilt'}.get(palette.get('accent', '').lower(), 'tezhip')

FOLIO_ART = {"kaynakca":"<svg class=\"folio-art\" viewBox=\"0 0 220 280\" aria-hidden=\"true\" focusable=\"false\"><g stroke=\"#dec28b\" stroke-width=\"1.5\" stroke-linejoin=\"round\" fill=\"none\"><rect x=\"10\" y=\"10\" width=\"200\" height=\"260\" rx=\"95\"/><rect x=\"18\" y=\"18\" width=\"184\" height=\"244\" rx=\"87\"/><path d=\"M110 22L116 31L110 40L104 31ZM110 240L116 249L110 258L104 249Z\"/><path d=\"M30 100 Q70 80 110 100 Q150 80 190 100 V195 Q150 175 110 195 Q70 175 30 195Z\" fill=\"#f6ecd4\"/><path d=\"M110 100V195M42 115Q 70 98 98 115\" /><path d=\"M43 124Q70 110 96 124M43 140Q70 126 96 140M124 124Q150 110 177 124M124 140Q150 126 177 140M43 156Q70 142 96 156M124 156Q150 142 177 156\"/><path d=\"M45 215H175M55 226H165\"/></g></svg>","galeri":"<svg class=\"folio-art\" viewBox=\"0 0 220 280\" aria-hidden=\"true\" focusable=\"false\"><g stroke=\"#d4be87\" stroke-width=\"1.5\" stroke-linejoin=\"round\" fill=\"none\"><rect x=\"10\" y=\"10\" width=\"200\" height=\"260\" rx=\"95\"/><rect x=\"18\" y=\"18\" width=\"184\" height=\"244\" rx=\"87\"/><path d=\"M110 22L116 31L110 40L104 31ZM110 240L116 249L110 258L104 249Z\"/><rect x=\"40\" y=\"65\" width=\"140\" height=\"160\" rx=\"2\"/><rect x=\"49\" y=\"74\" width=\"122\" height=\"142\"/><path d=\"M110 195V112M110 165Q 50 110 60 135Q60 165 110 165M110 180Q165 133 160 158Q155 182 110 180\" /><path d=\"M110 135Q75 110 92 93L110 108L128 93Q145 110 110 135Z\" fill=\"#b6c7bc\"/><path d=\"M62 198Q76 174 91 199M130 199Q145 174 160 198\"/></g></svg>","hakkimda":"<svg class=\"folio-art\" viewBox=\"0 0 220 280\" aria-hidden=\"true\" focusable=\"false\"><g stroke=\"#dbc48e\" stroke-width=\"1.5\" stroke-linejoin=\"round\" fill=\"none\"><rect x=\"10\" y=\"10\" width=\"200\" height=\"260\" rx=\"95\"/><rect x=\"18\" y=\"18\" width=\"184\" height=\"244\" rx=\"87\"/><path d=\"M110 22L116 31L110 40L104 31ZM110 240L116 249L110 258L104 249Z\"/><path d=\"M38 135H150V215H38Z\" fill=\"#f6ecd4\"/><path d=\"M50 150H133M50 165H121M50 180H133M50 195H105\"/><path d=\"M95 187Q130 95 180 65Q192 118 138 145L95 187Z\" fill=\"#d4b375\"/><path d=\"M95 187L180 65M126 126L151 118M139 106L165 96\"/><path d=\"M163 192H190L197 220H156Z\" fill=\"#d4b375\"/></g></svg>","iletisim":"<svg class=\"folio-art\" viewBox=\"0 0 220 280\" aria-hidden=\"true\" focusable=\"false\"><g stroke=\"#e4c595\" stroke-width=\"1.5\" stroke-linejoin=\"round\" fill=\"none\"><rect x=\"10\" y=\"10\" width=\"200\" height=\"260\" rx=\"95\"/><rect x=\"18\" y=\"18\" width=\"184\" height=\"244\" rx=\"87\"/><path d=\"M110 22L116 31L110 40L104 31ZM110 240L116 249L110 258L104 249Z\"/><rect x=\"33\" y=\"101\" width=\"154\" height=\"111\" rx=\"3\" fill=\"#f6ecd4\"/><path d=\"M33 104L110 163L187 104M33 211L90 151M187 211L130 151\"/><circle cx=\"110\" cy=\"163\" r=\"15\" fill=\"#ad675b\"/><path d=\"M105 163L110 156L115 163L110 170Z\" fill=\"#e4cb94\"/><path d=\"M70 77Q110 58 150 77M85 61Q110 48 135 61\"/></g></svg>"}

FOLIO_ART['arsiv'] = ''

def doc(title, main, active='', description='Furkan Sağdıç’ın yazıları ve notları.'):
    folio = active if active in FOLIO_ART else ''
    folio_css = '<link rel="stylesheet" href="/folio-pages.css?v=20261021-authors1">' if folio else ''
    folio_body = f' data-folio="{folio}"' if folio else ''
    if folio:
        main = main.replace('<section class="page-head">', '<section class="page-head folio-head"><div class="folio-heading">', 1)
        main = main.replace('</section>', '</div>' + FOLIO_ART[folio] + '</section>', 1)
    visible_categories = ((slug, name) for slug, name in CATS.items() if slug not in HOME_HIDDEN_CATEGORIES)
    nav = ''.join(f'<a {"aria-current=\"page\"" if active == slug else ""} href="/{slug}/">{escape(name)}</a>' for slug,name in visible_categories)
    nav += ''.join(f'<a {"aria-current=\"page\"" if active == slug else ""} href="/{slug}/">{name}</a>' for slug,name in EXTRAS.items())
    return f'''<!doctype html><html lang="tr" data-hero="{hero_design()}" data-category-design="{escape(active if active in CATS else '', quote=True)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} | Furkan Sağdıç</title><meta name="description" content="{escape(description,quote=True)}"><link rel="icon" href="/brand-mark.svg?v=2" type="image/svg+xml"><script src="/theme.js?v=20261004-reading-rate-v2"></script><link rel="stylesheet" href="/style.css?v=20261020-ultrarealbook1">{folio_css}</head><body{folio_body}><header class="masthead"><div class="topline"><a class="brand" href="/"><img class="brand-mark" src="/brand-mark.svg?v=2" alt="" width="42" height="42"><span class="brand-name">Furkan Sağdıç<small>Yazılar &amp; notlar</small></span></a><form class="header-search" action="/arama/" method="get" role="search"><label class="sr-only" for="header-query">Yazılarda ara</label><input id="header-query" name="q" type="search" placeholder="Yazılarda ara…" autocomplete="off"><button type="submit" aria-label="Ara"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 5 5"/></svg></button></form><div class="top-actions"><a class="admin-access" href="/admin/" aria-label="Admin paneline git">İdare</a><button id="theme-toggle" class="theme-toggle" type="button" aria-pressed="false">☾ Koyu</button><button id="menu-buton" class="menu-buton" aria-expanded="false" aria-controls="ana-menu">Menü</button></div></div><nav id="ana-menu" class="main-nav" aria-label="Ana menü">{nav}</nav></header><main id="icerik">{main}</main><footer class="footer"><span>© Furkan Sağdıç · Her hakkı mahfuzdur.</span><a href="/arsiv/">Yazı arşivi</a></footer><script src="/publication-dates.js?v=1" defer></script><script src="/script.js?v=20261018-music1" defer></script><script src="/comments-config.js" defer></script><script src="/analytics.js" defer></script></body></html>'''

@lru_cache(maxsize=512)
def image_size(src, page_path='index.html'):
    url = urlsplit(src)
    if url.scheme or url.netloc or not url.path:
        return None
    source = unquote(url.path)
    file = (ROOT / source.lstrip('/') if source.startswith('/') else ROOT / page_path).resolve()
    if not source.startswith('/'):
        file = (file.parent / source).resolve()
    if not file.is_relative_to(ROOT.resolve()) or not file.is_file():
        return None
    try:
        with Image.open(file) as image:
            return image.size
    except (OSError, ValueError):
        return None

def optimize_images(text, page_path):
    # Append attributes without reserializing Word paragraphs or inline formatting.
    def optimize(match):
        tag = match.group(0)
        image = html.fragment_fromstring(tag)
        additions = {}
        size = image_size(image.get('src', ''), str(page_path))
        if size:
            width, height = size
            old_width, old_height = image.get('width'), image.get('height')
            if not old_width and not old_height:
                additions.update(width=str(width), height=str(height))
            elif old_width and not old_height and old_width.isdigit():
                additions['height'] = str(max(1, round(int(old_width) * height / width)))
            elif old_height and not old_width and old_height.isdigit():
                additions['width'] = str(max(1, round(int(old_height) * width / height)))
        if image.get('loading') is None and 'brand-mark' not in image.get('class', '').split():
            additions['loading'] = 'lazy'
        if image.get('decoding') is None:
            additions['decoding'] = 'async'
        attrs = ''.join(f' {key}="{value}"' for key, value in additions.items())
        return re.sub(r'\s*/?>$', lambda end: attrs + end.group(0), tag) if attrs else tag
    return re.sub(r'''<img\b(?:[^>"']|"[^"]*"|'[^']*')*>''', optimize, text, flags=re.IGNORECASE)

def back_link(url, label):
    parts = [part.strip() for part in label.split(' · ')]
    if len(parts) == 1:
        return f'<a class="back" href="{escape(url, quote=True)}">← {escape(label)}</a>'
    return (f'<a class="back" href="{escape(url, quote=True)}" aria-label="{escape(label, quote=True)} bölümüne dön">'
            f'<span class="back-full">← {escape(label)}</span>'
            f'<span class="back-short" aria-hidden="true">← {escape(parts[-1])}</span></a>')

def write(path, text):
    file = ROOT / path
    file.parent.mkdir(parents=True,exist_ok=True)
    file.write_text(optimize_images(text, path) if str(path).endswith('.html') else text,encoding='utf-8')

# The palette must load as render-blocking CSS, before the page is first painted.
theme = json.loads((ROOT/'data/theme.json').read_text(encoding='utf-8'))
if not all(re.fullmatch(r'#[0-9a-fA-F]{6}', theme.get(key, '')) for key in ('accent', 'paper', 'ink')):
    raise ValueError('Invalid site colors')
write('data/theme.css', 'html:root{' + ''.join(f'--{key}:{theme[key]};' for key in ('accent', 'paper', 'ink')) + 'background:var(--paper)}\n')

def article_body(path):
    tree = html.fromstring(path.read_text(encoding='utf-8'))
    arts = tree.xpath('//article[contains(concat(" ", normalize-space(@class), " "), " yazi-icerik ")]')
    if not arts: return None
    art = arts[-1] if len(arts)>1 else arts[0]
    heading = tree.xpath('//h1[contains(@class,"yazi-baslik") or parent::div[contains(@class,"article-head")]]')
    title = heading[0].text_content().strip() if heading else path.parent.name.replace('-',' ').title()
    meta = tree.xpath('//div[contains(@class,"yazi-meta")]')
    date = meta[0].text_content().split('·')[0].strip() if meta else ''
    if not date:
        eye=tree.xpath('//div[contains(@class,"article-head")]/div[contains(@class,"eyebrow")]')
        if eye: date=eye[0].text_content().split('·')[-1].strip()
    desc = tree.xpath('//meta[@name="description"]/@content')
    body = ''.join(etree.tostring(child,encoding='unicode',method='html') for child in art)
    if art.text: body = escape(art.text) + body
    category_override = art.get('data-category', '')
    if not category_override:
        rel_parts = path.relative_to(ROOT).parts
        if len(rel_parts) >= 4:
            inferred_parent = '/'.join(rel_parts[:-2])
            if inferred_parent in CATEGORY_PATHS:
                category_override = inferred_parent
    cover = art.get('data-cover', '')
    if not re.fullmatch(r'/assets/covers/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]+\.(?:png|jpg|webp)', cover): cover = ''
    return title,date,(desc[0] if desc else ''),body,category_override,cover

def card(a):
    width, height = image_size(a.get('cover', '')) or (640, 360)
    cover = f'<a class="entry-cover" href="{a["url"]}"><img src="{escape(a["cover"], quote=True)}" alt="" loading="lazy" width="{width}" height="{height}"></a>' if a.get('cover') else ''
    return f'<article class="entry">{cover}<div class="eyebrow">{escape(CATS[a["category"]])} <span>·</span> {escape(a["date"])}</div><h3><a href="{a["url"]}">{escape(a["title"])}</a></h3><p>{escape(a["description"])}</p><a class="read" href="{a["url"]}">Yazıyı oku →</a></article>'

articles=[]
for path in sorted(ROOT.glob('*/**/index.html')):
    parts=path.relative_to(ROOT).parts
    if len(parts)<3 or parts[0] not in CATS: continue
    item=article_body(path)
    if not item: continue
    title,date,description,body,category_override,cover=item
    original_titles={'ilk-deneme-yazim':'İlk Deneme Yazım','zaman-ve-insan':'Zaman ve İnsan','suut-kemal-yetkin-estetik':'Estetik (Müellif: Suut Kemal Yetkin)'}
    if not date and path.parent.name in original_titles: date='20 Eylül 2026'
    if 'data-article="true"' in path.read_text(encoding='utf-8'):
        pass
    original_path = '/'.join(parts[:-2])
    category_path = category_override if category_override in CATEGORY_PATHS else next((key for key in sorted(CATEGORY_PATHS, key=len, reverse=True) if original_path == key or original_path.startswith(key+'/')), parts[0])
    category=category_path.split('/')[0]; url='/'+'/'.join(parts[:-1])+'/'
    if not description: description=title
    size = image_size(cover)
    cover_data = {'cover':cover, **({'coverWidth':size[0], 'coverHeight':size[1]} if size else {})} if cover else {}
    articles.append(dict(title=title,date=date,description=description,category=category,categoryPath=category_path,url=url,**cover_data))
    # Retain the original article body, including supplied images and formatting.
    # New editor-created pages are also normalized on the next GitHub build.
    label = ' · '.join(CATEGORY_PATHS['/'.join(category_path.split('/')[:i])] for i in range(1, len(category_path.split('/'))+1) if '/'.join(category_path.split('/')[:i]) in CATEGORY_PATHS)
    if not label: label=CATS[category]
    parent_url = f'/{category_path}/' if category_path else f'/{category}/'
    chapter_note = ''
    if category == 'kitap-notlari' and len(parts) > 4 and original_path not in CATEGORY_PATHS and not category_override:
        parent_url = '/' + '/'.join(parts[:-2]) + '/'
    chapter_navigation = ''
    chapter_match = re.fullmatch(r'bolum-(\d+)', path.parent.name)
    if category == 'kitap-notlari' and chapter_match:
        siblings = sorted((int(match.group(1)), folder) for folder in path.parent.parent.iterdir() if folder.is_dir() and (match := re.fullmatch(r'bolum-(\d+)', folder.name)) and (folder / 'index.html').is_file())
        numbers = [number for number, _ in siblings]
        position = numbers.index(int(chapter_match.group(1)))
        before = f'<a href="../bolum-{numbers[position-1]}/">← Bölüm {numbers[position-1]}</a>' if position else '<span></span>'
        after = f'<a href="../bolum-{numbers[position+1]}/">Bölüm {numbers[position+1]} →</a>' if position + 1 < len(numbers) else '<span></span>'
        chapter_navigation = f'<nav class="chapter-navigation" aria-label="Bölümler arasında gezinme">{before}{after}</nav>'
    comments = '''<section class="comments" aria-labelledby="comments-title" hidden><h2 id="comments-title">Yorumlar</h2><div id="comments-list" aria-live="polite"></div><form id="comment-form" hidden><div class="comment-fields"><label>Ad<input name="first_name" autocomplete="given-name" maxlength="60" required></label><label>Soyad<input name="last_name" autocomplete="family-name" maxlength="60" required></label></div><label>Yorum<textarea name="body" rows="5" maxlength="2000" required></textarea></label><div class="comment-trap" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><button type="submit">Yorumu gönder</button><p id="comment-status" role="status"></p></form></section><script src="/comments.js" defer></script>'''
    word_count = len(re.findall(r'\b\w+\b', html.fromstring(f'<div>{body}</div>').text_content(), re.UNICODE))
    minutes = max(1, ceil(word_count / 200))
    width, height = size or (1200, 675)
    cover_html = f'<figure class="article-cover"><img src="{escape(cover, quote=True)}" alt="{escape(title, quote=True)} için oluşturulmuş kapak görseli" width="{width}" height="{height}" loading="eager" decoding="async"></figure>' if cover else ''
    cover_attribute = f' data-cover="{escape(cover, quote=True)}"' if cover else ''
    content=f'<div class="article-head">{back_link(parent_url, label)}<div class="eyebrow">{escape(label)} · {escape(date)}</div><h1>{escape(title)}</h1><p class="reading-time">Yaklaşık {minutes} dk okuma · {format(word_count, ",").replace(",", ".")} kelime</p></div>{cover_html}{chapter_note}<article class="{"prose yazi-icerik docx-content" if category == "kitap-notlari" else "prose yazi-icerik"}" data-article="true" data-category="{escape(category_path, quote=True)}"{cover_attribute}>{body}</article>{chapter_navigation}<div class="article-end"><a href="{parent_url}">← {escape(label)} yazıları</a></div>{comments}'
    write(path.relative_to(ROOT),doc(title,content,category,description))

book_url = '/kitap-notlari/felsefe/bir-birey-nasil-yasayabilir/'
book = dict(title='Bir birey nasıl yaşayabilir?', date='', description='Deleuze üzerine kitap notları · 5 bölüm', category='kitap-notlari', categoryPath='kitap-notlari/felsefe', url=book_url)
articles.append(book)
cinema_book_url = '/kitap-notlari/sinema/sinemanin-kokleri/'
articles.append(dict(title='Sinemanın Kökleri', date='', description='Enver Gülşen · kitap notları · 5 bölüm', category='kitap-notlari', categoryPath='kitap-notlari/sinema', url=cinema_book_url))
visible = [a for a in articles if all(not a['url'].startswith(url) or a['url'] == url or a.get('categoryPath') not in ('kitap-notlari/felsefe','kitap-notlari/sinema') for url in (book_url, cinema_book_url))]
articles.sort(key=lambda a: ('2026' not in a['date'],a['url']))
write('articles.json',json.dumps(articles,ensure_ascii=False,indent=2))
latest=''.join(card(a) for a in visible[:5])
count=len(visible)
featured = next(a for a in visible if a['url'] == book_url)
intro=f'''<section class="heritage-hero" aria-labelledby="home-title"><div class="heritage-intro"><div class="heritage-rule" aria-hidden="true"><span>✧</span></div><span class="eyebrow">FURKAN SAĞDIÇ · YAZILAR VE NOTLAR</span><h1 id="home-title">Düşüncenin <em>izinde</em></h1><p class="heritage-lead">Felsefe, sanat ve hayat üzerine yazılar.</p><p class="heritage-description">Okuduklarım, düşündüklerim ve yeniden bakmak istediğim meseleler üzerine bir yazı defteri.</p><a class="heritage-explore" href="/arsiv/">Yazıları keşfet <span aria-hidden="true">→</span></a></div><article class="heritage-feature"><div class="heritage-arch" aria-hidden="true"><img src="/heritage-arch.svg" alt="" width="340" height="390"></div><div class="heritage-feature-copy"><span class="eyebrow">ÖNE ÇIKAN KİTAP NOTU</span><h2><a href="{book_url}">{escape(featured['title'])}</a></h2><p>{escape(featured['description'])}</p><a class="read" href="{book_url}">Bölümleri oku <span aria-hidden="true">→</span></a></div></article></section>'''
sections=''.join(f'<a href="/{slug}/"><span>{name}</span><span>↗</span></a>' for slug,name in list((slug, name) for slug, name in CATS.items() if slug not in HOME_HIDDEN_CATEGORIES)[:6])
resume='<section class="resume-reading" id="resume-reading" hidden><span class="eyebrow">OKUMAYA DEVAM ET</span><a id="resume-reading-link" href="/"></a><p id="resume-reading-detail"></p></section>'
main=intro+resume+f'<section class="heritage-topics" aria-label="Öne çıkan konular"><a href="/kitap-notlari/sinema/"><span class="heritage-topic-icon" aria-hidden="true">✦</span><span>SİNEMA</span><strong>Görüntü ve anlam</strong><span class="heritage-topic-more">Notları gör →</span></a></section><section class="listing"><div class="section-heading"><div><span class="eyebrow">{count:02d} YAZI</span><h2>Son yazılar</h2></div><a href="/arsiv/">Tüm yazılar →</a></div><div class="entries">{latest}</div></section><section class="topics"><div class="section-heading"><h2>Konular</h2></div><div class="topic-grid">{sections}</div></section>'
write('index.html',doc('Ana sayfa',main,description='Furkan Sağdıç’ın felsefe, sanat, edebiyat, tarih ve düşünce yazıları.'))
for slug,name in CATS.items():
    matched=[a for a in visible if a['category']==slug]
    inner=f'<section class="page-head"><span class="eyebrow">KONU / {escape(name.upper())}</span><h1>{name}</h1><p>{len(matched)} yazı</p></section><section class="entries">'+(''.join(card(a) for a in matched) if matched else '<p class="empty">Bu bölümde henüz yazı yok. Yeni yazılar burada görünecek.</p>')+'</section>'
    if slug == 'iktibas-alintilar':
        photos = sorted((p for p in (ROOT/slug/'fotograflar').glob('*') if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}), reverse=True)
        images = ''.join(f'<a href="/{slug}/fotograflar/{escape(p.name, quote=True)}" target="_blank" rel="noopener" aria-label="Fotoğrafı aç"><img src="/{slug}/fotograflar/{escape(p.name, quote=True)}" alt="İktibas / Alıntılar fotoğrafı" loading="lazy" decoding="async"></a>' for p in photos)
        quote_lab = '''<section class="quote-lab" aria-label="İktibas veri masası"><div class="quote-lab-top"><div id="quote-character-filters" class="quote-filter-row quote-character-row" aria-label="Kişi ve başlık süzgeçleri"><button type="button" class="is-on">Tümü</button></div><div id="quote-mode-filters" class="quote-filter-row quote-mode-row" aria-label="Alıntı türü süzgeçleri"><button type="button" class="is-on">Tümü</button></div></div><div class="quote-lab-stage"><div class="quote-book-zone"><div class="quote-book-scene" id="quote-book-scene"><div class="quote-book" id="quote-book" tabindex="0" role="button" aria-label="Alıntı kitabını aç veya kapat"><div class="book-shadow"></div><div class="book-bottom-cover"></div><div class="book-page-block"></div><div class="book-open-spread"><article class="book-page book-page-left"><small>İKTİBAS DEFTERİ</small><p id="quote-page-context" class="page-context">Sağdaki kâğıt parçalarından birine dokunduğunda alıntı bu kitabın sayfalarında açılır.</p><b id="quote-page-left-number">1</b></article><span class="book-gutter" aria-hidden="true"></span><article class="book-page book-page-right"><small id="quote-page-kicker">İKTİBAS</small><h3 id="quote-page-label">Furkan Sağdıç</h3><p><mark id="quote-page-text">Bir alıntı seçildiğinde metin burada görünür.</mark></p><b id="quote-page-number">2</b></article><span class="book-turn-sheet" aria-hidden="true"></span></div><div class="book-front-cover"><span class="book-spine-line" aria-hidden="true"></span><div class="book-cover-title"><small>OKUMA DEFTERİ</small><strong>İKTİBASLAR</strong><em>Furkan Sağdıç</em></div></div></div></div><div class="quote-timeline"><div class="timeline-chapters"><span>I</span><span>II</span><span>III</span><span>IV</span><span>V</span><span>VI</span><span>VII</span><span>VIII</span><span>IX</span></div><div id="quote-timeline-rows" class="timeline-rows"></div><div id="quote-timeline-cursor" class="timeline-cursor" style="left:8%"><em></em></div></div></div><aside class="quote-notes" id="quote-notes" aria-live="polite"><div class="quote-empty">Alıntılar hazırlanıyor…</div></aside></div></section>'''
        gallery = f'<section class="quote-photo-archive"><h2>Görsel Arşiv</h2><section class="quote-photo-grid" aria-label="İktibas ve alıntılar fotoğrafları">{images}</section></section>' if photos else '<section class="quote-photo-archive"><h2>Görsel Arşiv</h2><p class="empty">Henüz fotoğraf eklenmedi.</p></section>'
        inner=f'<section class="page-head"><span class="eyebrow">OKUMA DEFTERİ</span><h1>{escape(name)}</h1></section>'+quote_lab+gallery
    children=[(key,value) for key,value in CATEGORY_PATHS.items() if key.rsplit('/',1)[0] == slug and '/' in key]
    if children and slug != 'kitap-notlari':
        links=''.join(f'<a href="/{escape(key)}/"><span>{escape(value)}</span><span>↗</span></a>' for key,value in children)
        inner=inner.replace('<section class="entries">','<div class="topic-grid">'+links+'</div><section class="entries">',1)
    if slug == 'notlar':
        note_count = len(matched)
        inner = f'''<section class="page-head"><span class="eyebrow">FİKİR DEFTERİ</span><h1>Notlar</h1><p>Kısa sözlerden gelişmekte olan düşüncelere uzanan kişisel not defteri.</p></section><section class="notes-hub" aria-label="Not kategorileri"><a class="notes-hub-card quotes" href="/notlar/sozler/"><span class="note-mark">“</span><h2>Sözler</h2><p>Kısa cümleler, aforizmalar ve zihinde iz bırakan düşünce kırıntıları.</p><strong>Sözlere git →</strong></a><a class="notes-hub-card essays" href="/notlar/dusunce-notlari/"><span class="note-mark">✦</span><h2>Düşünce Notları</h2><p>Bir fikri birkaç paragrafta açan, makaleye dönüşmek zorunda olmayan düşünce yazıları.</p><strong>Notlara git →</strong></a></section>'''
        if matched:
            inner += '<section class="listing"><div class="section-heading"><h2>Son notlar</h2></div><div class="entries">'+''.join(card(a) for a in matched)+'</div></section>'
    if slug == 'kitap-notlari':
        links=''.join(f'<a href="/kitap-notlari/{key}/"><span>{value}</span><span>↗</span></a>' for key,value in BOOK_TOPICS.items())
        inner='<section class="page-head"><span class="eyebrow">OKUMA DEFTERİ</span><h1>Kitap Notları</h1><p>Okuduğum kitaplardan notlar, alıntılar ve değerlendirmeler.</p></section><div class="topic-grid">'+links+'</div><section class="listing"><div class="section-heading"><h2>Son kitap notları</h2></div><div class="entries">'+(''.join(card(a) for a in matched) if matched else '<p class="empty">Henüz kitap notu yayımlanmadı.</p>')+'</div></section>'
        for key,value in BOOK_TOPICS.items():
            notes=[a for a in matched if a.get('categoryPath','').startswith('kitap-notlari/'+key)]
            topic='<section class="page-head"><a class="back" href="/kitap-notlari/">← Kitap Notları</a><h1>'+value+'</h1><p>'+str(len(notes))+' kitap notu</p></section><section class="entries">'+(''.join(card(a) for a in notes) if notes else '<p class="empty">Bu kategoride henüz kitap notu yayımlanmadı.</p>')+'</section>'
            write(f'kitap-notlari/{key}/index.html',doc(value+' — Kitap Notları',topic,slug))
    page_html=doc(name,inner,slug)
    if slug == 'iktibas-alintilar':
        page_html=page_html.replace('/style.css?v=20261020-ultrarealbook1','/style.css?v=20261020-ultrarealbook1').replace('</body>','<script src="/quote-lab.js?v=20261020-ultrarealbook1" defer></script></body>')
    write(f'{slug}/index.html',page_html)
# Show nested categories at every level, including existing philosophy pages.
for path, name in CATEGORY_PATHS.items():
    if '/' not in path: continue
    parent=path.rsplit('/',1)[0]
    children=[(key,value) for key,value in CATEGORY_PATHS.items() if key.rsplit('/',1)[0] == path and '/' in key]
    matched=[a for a in visible if a.get('categoryPath') == path or a.get('categoryPath','').startswith(path+'/')]
    links=''.join(f'<a href="/{escape(key)}/"><span>{escape(value)}</span><span>↗</span></a>' for key,value in children)
    inner=f'<section class="page-head"><a class="back" href="/{parent}/">← {escape(CATEGORY_PATHS.get(parent, CATS.get(parent, parent)))}</a><h1>{escape(name)}</h1><p>{len(matched)} yazı</p></section>'
    if links: inner+='<div class="topic-grid">'+links+'</div>'
    is_chapter_index = path == 'kitap-notlari/felsefe/gundelik-hayat-felsefesi/gundelik-hayat-tenkidleri'
    is_words_page = path == 'notlar/sozler'
    if is_words_page:
        word_cards = ''.join(
            '<article class="soz-card"><span class="soz-quote" aria-hidden="true">“</span><p class="soz-text">' + escape(a["description"] or a["title"]) + '</p><footer><div><span>NOTLAR · SÖZLER</span><small>' + escape(a["date"]) + '</small></div><a href="' + escape(a["url"], quote=True) + '">Yazıyı oku →</a></footer></article>'
            for a in matched
        )
        count = len(matched)
        inner = (
            '<section class="page-head sozler-head"><a class="back" href="/notlar/">← Notlar</a><h1>Sözler</h1>'
            '<p>Kısa düşünceler, notlar ve zihnime düşen sözler…</p><small>' + str(count) + ' yazı</small></section>'
            '<section class="sozler-toolbar"><label><span aria-hidden="true">⌕</span><input id="soz-search" type="search" placeholder="Sözlerde ara…" aria-label="Sözlerde ara"></label>'
            '<div class="soz-view-controls" aria-label="Kart sütun sayısı"><span>Görünüm</span><button type="button" data-cols="1" aria-label="1 sütun">1</button><button type="button" data-cols="2" aria-label="2 sütun">2</button><button type="button" data-cols="3" aria-label="3 sütun">3</button></div>'
            '<span>' + str(count) + ' söz</span></section><section class="sozler-grid" id="sozler-grid">' + (word_cards if word_cards else '<p class="empty">Henüz söz yayımlanmadı.</p>') + '</section>'
            '<script src="/sozler.js?v=20261017-1" defer></script>'
        )
    elif is_chapter_index and matched:
        chapter_items = ''.join(
            f'<li><a class="chapter-title" href="{escape(a["url"], quote=True)}">{escape(re.sub(r"^\s*\d+\s*[-–.]\s*", "", a["title"]))}</a>'
            f'<a class="chapter-read" href="{escape(a["url"], quote=True)}" aria-label="{escape(a["title"], quote=True)} yazısını oku">Oku →</a></li>'
            for a in matched
        )
        inner+=f'<section class="chapter-index" aria-label="Bölümler"><ol>{chapter_items}</ol></section>'
    else:
        inner+='<section class="entries">'+(''.join(card(a) for a in matched) if matched else '<p class="empty">Bu bölümde henüz yazı yok.</p>')+'</section>'
    page=doc(name,inner,path.split('/')[0])
    if is_chapter_index:
        page=page.replace('/style.css?v=20261020-ultrarealbook1','/style.css?v=20261020-ultrarealbook1')
    write(f'{path}/index.html',page)
if (ROOT/'felsefe/estetik').exists() and 'felsefe/estetik' not in CATEGORY_PATHS:
    matched=[a for a in articles if a['url'].startswith('/felsefe/estetik/') and a.get('categoryPath') == 'felsefe']
    write('felsefe/estetik/index.html',doc('Estetik','<section class="page-head"><a class="back" href="/felsefe/">← Felsefe</a><h1>Estetik</h1></section><section class="entries">'+''.join(card(a) for a in matched)+'</section>','felsefe'))
book_rows = ''
for number in range(1, 6):
    available = (ROOT / f"kitap-notlari/felsefe/bir-birey-nasil-yasayabilir/bolum-{number}/index.html").is_file()
    href = f'href="{book_url}bolum-{number}/"' if available else 'aria-disabled="true"'
    caption = f'Bölüm {number}' + ('' if available else ' · Yakında')
    book_rows += f'<a class="chapter-row" {href}><span>{number}</span><span>{caption}</span><span>{"→" if available else ""}</span></a>' if available else f'<div class="chapter-row pending" aria-disabled="true"><span>{number}</span><span>{caption}</span></div>'
book_main = '<section class="page-head"><a class="back" href="/kitap-notlari/felsefe/">← Kitap Notları / Felsefe</a><h1>Bir birey nasıl yaşayabilir?</h1><p>Kitap notları · 5 bölüm</p></section><section class="chapter-list" aria-label="Bölümler">'+book_rows+'</section>'
write('kitap-notlari/felsefe/bir-birey-nasil-yasayabilir/index.html',doc('Bir birey nasıl yaşayabilir?',book_main,'kitap-notlari'))
cinema_rows = ''
for number in range(1, 6):
    available = (ROOT / f'kitap-notlari/sinema/sinemanin-kokleri/bolum-{number}/index.html').is_file()
    caption = f'Bölüm {number}' + ({1: ' · Mukaddime', 2: ' · Mukaddime', 3: ' · Filmlere Neden İhtiyacımız Var? Neden Film İzleriz?', 4: ' · İmge, Sanat Gelenekleri ve Sinemaya Giriş', 5: ' · Kayıp Hikmetin Peşinde'}.get(number, '')) + ('' if available else ' · Yakında')
    if available:
        cinema_rows += f'<a class="chapter-row" href="{cinema_book_url}bolum-{number}/"><span>{number}</span><span>{caption}</span><span>→</span></a>'
    else:
        cinema_rows += f'<div class="chapter-row pending" aria-disabled="true"><span>{number}</span><span>{caption}</span></div>'
cinema_main = '<section class="page-head"><a class="back" href="/kitap-notlari/sinema/">← Kitap Notları / Sinema</a><h1>Sinemanın Kökleri</h1><p>Enver Gülşen · Kitap notları · 5 bölüm</p></section><section class="chapter-list" aria-label="Bölümler">' + cinema_rows + '</section>'
write('kitap-notlari/sinema/sinemanin-kokleri/index.html',doc('Sinemanın Kökleri',cinema_main,'kitap-notlari'))
archive='<section class="page-head"><span class="eyebrow">TÜM YAZILAR</span><h1>Arşiv</h1><p>Yazılar ve okuma notları</p></section><section class="entries">'+''.join(card(a) for a in visible)+'</section>'
write('arsiv/index.html',doc('Arşiv',archive,'arsiv'))
write('arama/index.html',doc('Yazılarda ara','<section class="page-head"><span class="eyebrow">YAZILAR</span><h1>Ara</h1><label class="search-label" for="site-search">Başlık, kategori veya açıklama</label><div class="search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 5 5"/></svg><input id="site-search" type="search" placeholder="Yazılarda arayın…" autofocus autocomplete="off"></div><p id="result-count" aria-live="polite"></p></section><section class="entries" id="search-results"></section>',description='Furkan Sağdıç’ın yazılarında arama.'))
write('hakkimda/index.html',doc('Hakkımda','<section class="page-head"><span class="eyebrow">YAZAR</span><h1>Hakkımda</h1></section><div class="prose static-copy"><p>Ben Furkan Sağdıç. Mühendislik eğitimi aldım; felsefe, edebiyat, sanat ve düşünce tarihi üzerine okuyup yazıyorum.</p><p>Bu site, okuduklarımı, sorularımı ve kendi yazılarımı bir araya getirdiğim kişisel alanım.</p></div>','hakkimda'))
write('kaynakca/index.html',doc('Kaynakça',(ROOT/'bibliography_content.html').read_text(encoding='utf-8'),'kaynakca','Furkan Sağdıç’ın kişisel kütüphanesi: kitaplar, yazarlar ve yayınevleri.'))
from author_profiles import build_author_profiles
author_urls = build_author_profiles(ROOT, articles, doc, write)
write('galeri/index.html',doc('Galeri','<section class="page-head"><span class="eyebrow">GÖRSELLER</span><h1>Galeri</h1></section><div class="prose static-copy"><p>Görsel çalışmalar ve fotoğraflar yayımlandıkça bu bölümde yer alacak.</p></div>','galeri'))
write('iletisim/index.html',doc('İletişim','<section class="page-head"><span class="eyebrow">İLETİŞİM</span><h1>İletişim</h1></section><div class="prose static-copy"><p>İletişim bilgileri yakında burada yer alacak.</p></div>','iletisim'))
urls = {'/'} | {f'/{key}/' for key in CATEGORY_PATHS} | {f'/{key}/' for key in EXTRAS} | {a['url'] for a in articles} | author_urls
urls.add('/arama/')
urls.add('/kitap-notlari/felsefe/bir-birey-nasil-yasayabilir/')
urls.add('/kitap-notlari/sinema/sinemanin-kokleri/')
urls = sorted(url for url in urls if (ROOT / url.lstrip('/') / 'index.html').is_file())
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{escape("https://furkansagdic.com.tr" + url)}</loc></url>\n' for url in urls) + '</urlset>\n')
write('robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://furkansagdic.com.tr/sitemap.xml\n')

# Apply only to the philosophy selection page; note pages retain their reading layout.
from cinematic_books import build_cinematic
build_cinematic(ROOT, articles, CATEGORY_PATHS, doc, write, 'felsefe', 'Felsefe')
build_cinematic(ROOT, articles, CATEGORY_PATHS, doc, write, 'sanat', 'Sanat')
build_cinematic(ROOT, articles, CATEGORY_PATHS, doc, write, 'mecmualar', 'Mecmualar')

# Refresh series navigation whenever published chapters are rebuilt.
from series_navigation import build_series_navigation
build_series_navigation(ROOT)

# Current-reading landing page; book records are managed by the existing admin API.
write('su-an-masada/index.html',doc('Şu An Masada','<section class="page-head"><span class="eyebrow">OKUMA MASAM</span><h1>Şu An Masada</h1><p>Kitaplarla, notlarla ve sorularla devam eden bir çalışma.</p></section>','su-an-masada'))
