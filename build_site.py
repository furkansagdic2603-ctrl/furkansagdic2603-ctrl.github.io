"""Generate the GitHub Pages index, archive, categories and clean article pages."""
from pathlib import Path
from lxml import html, etree
import json, re
from html import escape

ROOT = Path(__file__).parent
CATS = {'felsefe':'Felsefe','sanat':'Sanat','edebiyat':'Edebiyat','tarih':'Tarih','din':'Din','mitoloji':'Mitoloji','sosyoloji':'Sosyoloji','psikoloji':'Psikoloji','bilim':'Bilim','notlar':'Notlar'}
EXTRAS = {'kaynakca':'Kaynakça','galeri':'Galeri','hakkimda':'Hakkımda','iletisim':'İletişim','arsiv':'Arşiv'}

def doc(title, main, active='', description='Furkan Sağdıç’ın yazıları ve notları.'):
    nav = ''.join(f'<a {"aria-current=\"page\"" if active == slug else ""} href="/{slug}/">{name}</a>' for slug,name in CATS.items())
    nav += ''.join(f'<a {"aria-current=\"page\"" if active == slug else ""} href="/{slug}/">{name}</a>' for slug,name in EXTRAS.items())
    return f'''<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} | Furkan Sağdıç</title><meta name="description" content="{escape(description,quote=True)}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css"></head><body><header class="masthead"><div class="topline"><a class="brand" href="/">Furkan Sağdıç<span>Yazılar &amp; notlar</span></a><div class="top-actions"><a class="search-link" href="/arama/">Ara</a><button id="menu-buton" class="menu-buton" aria-expanded="false" aria-controls="ana-menu">Menü</button></div></div><nav id="ana-menu" class="main-nav" aria-label="Ana menü">{nav}</nav></header><main id="icerik">{main}</main><footer class="footer"><span>© Furkan Sağdıç</span><a href="/arsiv/">Yazı arşivi</a><a href="/admin/">Yazı editörü</a></footer><script src="/script.js" defer></script></body></html>'''

def write(path, text):
    file = ROOT / path
    file.parent.mkdir(parents=True,exist_ok=True)
    file.write_text(text,encoding='utf-8')

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
    return title,date,(desc[0] if desc else ''),body

def card(a):
    return f'<article class="entry"><div class="eyebrow">{escape(CATS[a["category"]])} <span>·</span> {escape(a["date"])}</div><h3><a href="{a["url"]}">{escape(a["title"])}</a></h3><p>{escape(a["description"])}</p><a class="read" href="{a["url"]}">Yazıyı oku →</a></article>'

articles=[]
for path in sorted(ROOT.glob('*/**/index.html')):
    parts=path.relative_to(ROOT).parts
    if len(parts)<3 or parts[0] not in CATS: continue
    item=article_body(path)
    if not item: continue
    title,date,description,body=item
    original_titles={'ilk-deneme-yazim':'İlk Deneme Yazım','zaman-ve-insan':'Zaman ve İnsan','suut-kemal-yetkin-estetik':'Estetik (Müellif: Suut Kemal Yetkin)'}
    title=original_titles.get(path.parent.name,title)
    if not date and path.parent.name in original_titles: date='20 Eylül 2026'
    if 'data-article="true"' in path.read_text(encoding='utf-8'):
        pass
    category=parts[0]; url='/'+'/'.join(parts[:-1])+'/'
    if not description: description=title
    articles.append(dict(title=title,date=date,description=description,category=category,url=url))
    # Retain the original article body, including supplied images and formatting.
    # New editor-created pages are also normalized on the next GitHub build.
    label=CATS[category] + (' · '+parts[1].replace('-',' ').title() if len(parts)>3 else '')
    content=f'<div class="article-head"><a class="back" href="/{category}/">← {CATS[category]}</a><div class="eyebrow">{escape(label)} · {escape(date)}</div><h1>{escape(title)}</h1></div><article class="prose yazi-icerik" data-article="true">{body}</article><div class="article-end"><a href="/{category}/">← {CATS[category]} yazıları</a></div>'
    write(path.relative_to(ROOT),doc(title,content,category,description))

articles.sort(key=lambda a: ('2026' not in a['date'],a['url']))
write('articles.json',json.dumps(articles,ensure_ascii=False,indent=2))
latest=''.join(card(a) for a in articles[:5])
count=len(articles)
intro='<section class="hero"><div class="hero-kicker">KİŞİSEL YAZI DEFTERİ <span> / </span> DÜŞÜNCE • KÜLTÜR • SANAT</div><h1>Okumak, düşünmek,<br><em>yeniden bakmak.</em></h1><p>Felsefe, sanat, edebiyat, tarih ve düşünce üzerine yazılarım ile okuma notlarım.</p></section>'
sections=''.join(f'<a href="/{slug}/"><span>{name}</span><span>↗</span></a>' for slug,name in list(CATS.items())[:6])
main=intro+f'<section class="listing"><div class="section-heading"><div><span class="eyebrow">{count:02d} YAZI</span><h2>Son yazılar</h2></div><a href="/arsiv/">Tüm yazılar →</a></div><div class="entries">{latest}</div></section><section class="topics"><div class="section-heading"><h2>Konular</h2></div><div class="topic-grid">{sections}</div></section>'
write('index.html',doc('Ana sayfa',main,description='Furkan Sağdıç’ın felsefe, sanat, edebiyat, tarih ve düşünce yazıları.'))
for slug,name in CATS.items():
    matched=[a for a in articles if a['category']==slug]
    inner=f'<section class="page-head"><span class="eyebrow">KONU / {escape(name.upper())}</span><h1>{name}</h1><p>{len(matched)} yazı</p></section><section class="entries">'+(''.join(card(a) for a in matched) if matched else '<p class="empty">Bu bölümde henüz yazı yok. Yeni yazılar burada görünecek.</p>')+'</section>'
    write(f'{slug}/index.html',doc(name,inner,slug))
# Existing nested topic remains reachable from its parent.
if (ROOT/'felsefe/estetik').exists():
    matched=[a for a in articles if a['url'].startswith('/felsefe/estetik/')]
    write('felsefe/estetik/index.html',doc('Estetik','<section class="page-head"><a class="back" href="/felsefe/">← Felsefe</a><h1>Estetik</h1></section><section class="entries">'+''.join(card(a) for a in matched)+'</section>','felsefe'))
archive='<section class="page-head"><span class="eyebrow">TÜM YAZILAR</span><h1>Arşiv</h1><p>Yazılar ve okuma notları</p></section><section class="entries">'+''.join(card(a) for a in articles)+'</section>'
write('arsiv/index.html',doc('Arşiv',archive,'arsiv'))
write('arama/index.html',doc('Yazılarda ara','<section class="page-head"><span class="eyebrow">YAZILAR</span><h1>Ara</h1><label class="search-label" for="site-search">Başlık veya metin</label><input id="site-search" type="search" placeholder="Bir kelime yazın…" autofocus autocomplete="off"><p id="result-count" aria-live="polite"></p></section><section class="entries" id="search-results"></section>',description='Furkan Sağdıç’ın yazılarında arama.'))
write('hakkimda/index.html',doc('Hakkımda','<section class="page-head"><span class="eyebrow">YAZAR</span><h1>Hakkımda</h1></section><div class="prose static-copy"><p>Ben Furkan Sağdıç. Mühendislik eğitimi aldım; felsefe, edebiyat, sanat ve düşünce tarihi üzerine okuyup yazıyorum.</p><p>Bu site, okuduklarımı, sorularımı ve kendi yazılarımı bir araya getirdiğim kişisel alanım.</p></div>','hakkimda'))
write('kaynakca/index.html',doc('Kaynakça','<section class="page-head"><span class="eyebrow">OKUMA DEFTERİ</span><h1>Kaynakça</h1></section><div class="prose static-copy"><p>Yazılarda yararlandığım kitap ve kaynakları ilgili metinlerde belirtiyorum. Toplu kaynakça listesi eklendikçe burada yer alacak.</p></div>','kaynakca'))
write('galeri/index.html',doc('Galeri','<section class="page-head"><span class="eyebrow">GÖRSELLER</span><h1>Galeri</h1></section><div class="prose static-copy"><p>Görsel çalışmalar ve fotoğraflar yayımlandıkça bu bölümde yer alacak.</p></div>','galeri'))
write('iletisim/index.html',doc('İletişim','<section class="page-head"><span class="eyebrow">İLETİŞİM</span><h1>İletişim</h1></section><div class="prose static-copy"><p>İletişim bilgileri yakında burada yer alacak.</p></div>','iletisim'))
