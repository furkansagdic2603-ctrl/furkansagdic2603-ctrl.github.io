"""Generate library dashboard, timeline and semantic-search data from local site data."""
from pathlib import Path
from html import escape, unescape
from collections import Counter
import json, re, math
from urllib.parse import quote
from author_profiles import build_author_groups, norm, slugify
from semantic_relations import CONCEPTS

FEATURE_SUITE_VERSION = '2026-10-21.2'

MAIN_ORDER = ['Felsefe','Sanat','Edebiyat','Tarih','Din']

TIMELINE = {
    'sokrates': (-470,-399,'Antik Yunan'),
    'platon': (-427,-347,'Antik Yunan'),
    'eflatun': (-427,-347,'Antik Yunan'),
    'aristoteles': (-384,-322,'Antik Yunan'),
    'epikuros': (-341,-270,'Antik Yunan'),
    'cicero': (-106,-43,'Roma'),
    'seneca': (-4,65,'Roma'),
    'augustinus': (354,430,'Geç Antik Çağ'),
    'farabi': (872,950,'İslâm düşüncesi'),
    'ibn sina': (980,1037,'İslâm düşüncesi'),
    'gazali': (1058,1111,'İslâm düşüncesi'),
    'gazzali': (1058,1111,'İslâm düşüncesi'),
    'ibn rusd': (1126,1198,'İslâm düşüncesi'),
    'ibn arabi': (1165,1240,'İslâm düşüncesi'),
    'ibni arabi': (1165,1240,'İslâm düşüncesi'),
    'mevlana': (1207,1273,'İslâm düşüncesi'),
    'sadreddin konevi': (1210,1274,'İslâm düşüncesi'),
    'ibn haldun': (1332,1406,'İslâm düşüncesi'),
    'machiavelli': (1469,1527,'Rönesans'),
    'francis bacon': (1561,1626,'Erken modern'),
    'hobbes': (1588,1679,'Erken modern'),
    'descartes': (1596,1650,'Erken modern'),
    'spinoza': (1632,1677,'Erken modern'),
    'locke': (1632,1704,'Erken modern'),
    'leibniz': (1646,1716,'Erken modern'),
    'berkeley': (1685,1753,'Aydınlanma'),
    'hume': (1711,1776,'Aydınlanma'),
    'rousseau': (1712,1778,'Aydınlanma'),
    'kant': (1724,1804,'Aydınlanma'),
    'hegel': (1770,1831,'Alman idealizmi'),
    'schopenhauer': (1788,1860,'19. yüzyıl'),
    'comte': (1798,1857,'19. yüzyıl'),
    'kierkegaard': (1813,1855,'19. yüzyıl'),
    'marx': (1818,1883,'19. yüzyıl'),
    'nietzsche': (1844,1900,'19. yüzyıl'),
    'freud': (1856,1939,'Modern düşünce'),
    'bergson': (1859,1941,'Modern düşünce'),
    'husserl': (1859,1938,'Fenomenoloji'),
    'weber': (1864,1920,'Modern düşünce'),
    'simmel': (1858,1918,'Modern düşünce'),
    'jung': (1875,1961,'Modern düşünce'),
    'benjamin': (1892,1940,'20. yüzyıl'),
    'bakhtin': (1895,1975,'20. yüzyıl'),
    'heidegger': (1889,1976,'20. yüzyıl'),
    'horkheimer': (1895,1973,'Frankfurt Okulu'),
    'marcuse': (1898,1979,'Frankfurt Okulu'),
    'gadamer': (1900,2002,'Hermeneutik'),
    'adorno': (1903,1969,'Frankfurt Okulu'),
    'sartre': (1905,1980,'Varoluşçuluk'),
    'levinas': (1906,1995,'20. yüzyıl'),
    'arendt': (1906,1975,'20. yüzyıl'),
    'merleau ponty': (1908,1961,'Fenomenoloji'),
    'ricoeur': (1913,2005,'Hermeneutik'),
    'camus': (1913,1960,'Varoluşçuluk'),
    'foucault': (1926,1984,'Çağdaş düşünce'),
    'deleuze': (1925,1995,'Çağdaş düşünce'),
    'derrida': (1930,2004,'Çağdaş düşünce'),
    'habermas': (1929,None,'Çağdaş düşünce'),
    'baudrillard': (1929,2007,'Çağdaş düşünce'),
    'badiou': (1937,None,'Çağdaş düşünce'),
    'bauman': (1925,2017,'Çağdaş düşünce'),
    'lefebvre': (1901,1991,'20. yüzyıl'),
    'debord': (1931,1994,'Sitüasyonizm'),
    'de certeau': (1925,1986,'Gündelik hayat'),
    'agnes heller': (1929,2019,'Gündelik hayat'),
    'said nursi': (1877,1960,'İslâm düşüncesi'),
    'bediuzzaman said nursi': (1877,1960,'İslâm düşüncesi'),
    'cemil meric': (1916,1987,'Türk düşüncesi'),
    'sezai karakoc': (1933,2021,'Türk düşüncesi'),
    'ismet ozel': (1944,None,'Türk düşüncesi'),
    'hilmi ziya ulken': (1901,1974,'Türk düşüncesi'),
    'nurettin topcu': (1909,1975,'Türk düşüncesi'),
    'ismail tunali': (1923,2015,'Türk düşüncesi'),
    'suut kemal yetkin': (1903,1980,'Türk düşüncesi'),
    'ahmet hamdi tanpinar': (1901,1962,'Edebiyat'),
    'yahya kemal': (1884,1958,'Edebiyat'),
    'mehmet akif': (1873,1936,'Edebiyat'),
    'dostoyevski': (1821,1881,'Edebiyat'),
    'tolstoy': (1828,1910,'Edebiyat'),
    'kafka': (1883,1924,'Edebiyat'),
    'goethe': (1749,1832,'Edebiyat'),
}

SYNONYMS = {
    'sanat':['estetik','guzellik','guzel','poetika','sanatsal','yargi yetisi'],
    'estetik':['sanat','guzellik','guzel','beğeni','begeni','yargi yetisi'],
    'varlik':['ontoloji','metafizik','vucud','mevcudiyet'],
    'ontoloji':['varlik','metafizik','vucud'],
    'ahlak':['etik','erdem','iyi','kotu'],
    'etik':['ahlak','erdem'],
    'siyaset':['politik','devlet','iktidar','yonetim'],
    'tarih':['tarihsel','tarihyazimi','medeniyet'],
    'din':['ilahiyat','teoloji','iman','vahiy'],
    'tasavvuf':['sufi','irfan','vahdet','tecelli'],
    'dil':['anlam','yorum','hermeneutik','soylem'],
    'modernlik':['modernite','modernizm','postmodern'],
    'gundelik':['gundelik hayat','siradan','ritim','mekan'],
}

def clean_html(path):
    try:
        raw = Path(path).read_text(encoding='utf-8', errors='ignore')
    except OSError:
        return ''
    m = re.search(r'<article\b[^>]*>(.*?)</article>', raw, flags=re.I|re.S)
    if not m:
        m = re.search(r'<main\b[^>]*>(.*?)</main>', raw, flags=re.I|re.S)
    chunk = m.group(1) if m else raw
    chunk = re.sub(r'<(?:script|style|noscript)\b[^>]*>.*?</(?:script|style|noscript)>',' ',chunk,flags=re.I|re.S)
    chunk = re.sub(r'<[^>]+>',' ',chunk)
    return re.sub(r'\s+',' ',unescape(chunk)).strip()

def classify(book):
    title = norm(book.get('title'))
    author = norm(book.get('author'))
    x = title + ' ' + author
    def has(*keys):
        return any(norm(k) in x for k in keys)

    if has('tarih felsefesi','felsefe tarihi','felsefenin tarihi','tarihselcilik'):
        return 'Felsefe'
    if has('estetik','güzellik','sanat felsefesi','sanatın felsefesi','poetika','yargı yetisinin eleştirisi','aşk estetiği'):
        return 'Felsefe'
    if has('mantık','lojik','organon','etik','ahlak','erdem','siyaset felsefesi','siyasal felsefe','politik felsefe','bilim felsefesi','epistemoloji','bilgi felsefesi','bilgi kuramı','metafizik','ontoloji','varlık ve zaman','fenomenoloji','dil felsefesi','hermeneutik','islam felsefesi','islâm felsefesi','antik felsefe','yunan felsefesi','sokrates','platon','eflatun','aristoteles','herakleitos','nietzsche','schopenhauer','kant','hegel','descartes','spinoza','leibniz','kierkegaard','deleuze','derrida','bergson','whitehead','bacon','rousseau','hobbes','locke','comte','badiou','habermas','marx','felsefe','felsefi','felsefesi','filozof','sosyoloji','sosyolojik','bauman','simmel','weber'):
        return 'Felsefe'

    if has('fıkıh','fikih','mustasfa','islam hukuku','tefsir','kur an','kuran','meal','hadis','sünnet','sunnet','buhari','müsned','musned','tecrid','sahih','hanbel','tasavvuf','ibn arabi','ibni arabi','futuhat','fütuhat','fusûs','fusus','konevi','konevî','mevlana','mevlânâ','kuşeyr','gazzali','gazali','akaid','akâid','kelam','kelâm','maturidi','mâturîdî','hristiyan','hıristiyan','yahudi','dinler tarihi','budizm','hindu','incil','tevrat','islam düşüncesi','islâm düşüncesi','bediüzzaman','bediuzzaman','risale','sıratımüstakim','sebilürreşad','mecmua','diyanet','islam','islâm','ilahiyat','şeriat'):
        return 'Din'

    if has('sanat tarihi','sanatın tarihi','sinema','film','sinematograf','yönetmen','mimari','mimarlık','şehir estetiği','resim','ressam','fotoğraf','görme biçimleri','görsel','heykel','minyatür','müzik','musiki','mûsikî','sanat','sanatsal','croce','bedrettin cömert','suut kemal yetkin','ismail tunalı','ömer naci soykan'):
        return 'Sanat'

    literary = ['mustafa kutlu','sezai karakoç','dostoyevski','tolstoy','kafka','orhan pamuk','ahmet hamdi tanpınar','tanpınar','cemil meriç','ismet özel','yahya kemal','mehmet akif','necip fazıl','necib fazıl','shakespeare','goethe','victor hugo','balzac','stendhal','flaubert']
    if has('edebiyat tarihi','edebiyat','şiir','siir','roman','hikaye','hikâye','öykü','oyku','divan','edebî','edebi','hatıra','hatirat','mektuplar','günlük','gunluk') or any(norm(n) in author for n in literary):
        return 'Edebiyat'

    if has('yunan tarihi','antik yunan','hellen','helenistik','atina','sparta','roma tarihi','roma imparator','romalı','bizans','osmanlı','osmanli','devlet i aliyye','ahmet cevdet paşa','uzunçarşılı','halil inalcık','selçuk','selcuk','osman turan','cumhuriyet','atatürk','milli mücadele','inkılap','türk tarihi','türkler','orta asya','islam tarihi','islâm tarihi','siyer','peygamber','halifeler','emevi','abbasi','avrupa tarihi','batı tarihi','ortaçağ','rönesans','fransız ihtilali','tarih','tarihi','imparatorluğu','medeniyet','braudel','hodgson','mısıroğlu'):
        return 'Tarih'

    if has('psikoloji','zihin','bilinç','insan'):
        return 'Felsefe'
    return 'Felsefe'

def author_timeline(groups):
    out = []
    for group in groups.values():
        aliases = {norm(x) for x in group['names']}
        candidates = []
        for alias in aliases:
            bits = alias.split()
            candidates.extend([alias, bits[-1] if bits else alias])
        hit = None
        for candidate in candidates:
            if candidate in TIMELINE:
                hit = TIMELINE[candidate]; break
        if not hit:
            for key,val in TIMELINE.items():
                if any(key in alias or alias in key for alias in aliases if len(alias)>=5):
                    hit=val; break
        if not hit:
            continue
        birth, death, era = hit
        out.append({'name':group['name'],'slug':group['slug'],'birth':birth,'death':death,'era':era,'count':len(group['books'])})
    out.sort(key=lambda x:(x['birth'],x['name'].casefold()))
    return out

def generate_search_index(root, articles, books, quotes, groups, semantic):
    records=[]
    sem_by_url={}
    for author_slug, rels in (semantic.get('authors') or {}).items():
        for rel in rels:
            sem_by_url.setdefault(rel.get('url',''),[]).append({'author':author_slug,'score':rel.get('score',0),'strength':rel.get('strength','')})
    for a in articles:
        url=a.get('url') or ''
        text=clean_html(Path(root)/url.strip('/')/'index.html')
        records.append({'type':'article','title':a.get('title') or 'Yazı','url':url,'description':a.get('description') or '','date':a.get('date') or '','category':a.get('categoryPath') or a.get('category') or '','text':text[:18000],'semanticAuthors':sem_by_url.get(url,[])})
    for b in books:
        title=str(b.get('title') or 'İsimsiz eser')
        author=str(b.get('author') or '')
        records.append({'type':'book','title':title,'url':'/kaynakca/?q='+quote(title),'description':' · '.join(x for x in [author,str(b.get('publisher') or '')] if x),'author':author,'publisher':b.get('publisher') or '','category':classify(b),'text':' '.join([title,author,str(b.get('publisher') or ''),str(b.get('translator') or '')])})
    for q in quotes:
        records.append({'type':'quote','title':q.get('label') or 'İktibas','url':'/iktibas-alintilar/?quote='+str(q.get('id') or ''),'description':q.get('text') or '','author':q.get('label') or '','category':q.get('category') or '','text':' '.join([str(q.get('label') or ''),str(q.get('text') or '')])})
    for group in groups.values():
        records.append({'type':'author','title':group['name'],'url':'/muellif/'+group['slug']+'/','description':str(len(group['books']))+' eser · Müellif profili','author':group['name'],'text':' '.join(group['names'])+' '+' '.join(str(b.get('title') or '') for b in group['books'][:30])})
    return {'version':1,'synonyms':SYNONYMS,'concepts':CONCEPTS,'records':records}

def build_library_features(root, articles, doc, write):
    root=Path(root)
    books=json.loads((root/'data/books.json').read_text(encoding='utf-8'))
    quotes=json.loads((root/'data/quotes.json').read_text(encoding='utf-8')) if (root/'data/quotes.json').is_file() else []
    groups,_=build_author_groups(books)
    try:
        semantic=json.loads((root/'data/semantic-relations.json').read_text(encoding='utf-8'))
    except Exception:
        semantic={'authors':{}}

    authors=[{'name':g['name'],'slug':g['slug'],'count':len(g['books'])} for g in groups.values()]
    authors.sort(key=lambda x:x['name'].casefold())
    (root/'data/author-index.json').write_text(json.dumps(authors,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    publishers=Counter(str(b.get('publisher') or '').strip() for b in books if str(b.get('publisher') or '').strip())
    categories=Counter(classify(b) for b in books)
    translators=sum(1 for b in books if str(b.get('translator') or '').strip())
    stats={
        'totalBooks':len(books),
        'totalAuthors':len(groups),
        'totalPublishers':len(publishers),
        'translatedRecords':translators,
        'categories':dict(categories),
        'topAuthors':sorted(authors,key=lambda x:(-x['count'],x['name'].casefold()))[:20],
        'topPublishers':[{'name':n,'count':c} for n,c in publishers.most_common(20)],
        'quoteCount':len(quotes),
        'articleCount':len(articles),
    }
    (root/'data/library-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    timeline=author_timeline(groups)
    (root/'data/author-timeline.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    discover=[]
    for a in articles:
        discover.append({'type':'Yazı','title':a.get('title') or 'Yazı','description':a.get('description') or '','url':a.get('url') or '/arsiv/'})
    for b in books:
        title=str(b.get('title') or 'İsimsiz eser')
        discover.append({'type':'Kitap','title':title,'description':str(b.get('author') or ''),'url':'/kaynakca/?q='+quote(title)})
    for g in groups.values():
        discover.append({'type':'Müellif','title':g['name'],'description':str(len(g['books']))+' eser kütüphanemde','url':'/muellif/'+g['slug']+'/'})
    for q in quotes:
        discover.append({'type':'İktibas','title':q.get('label') or 'İktibas','description':q.get('text') or '','url':'/iktibas-alintilar/?quote='+str(q.get('id') or '')})
    (root/'data/discover.json').write_text(json.dumps(discover,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

    search_index=generate_search_index(root,articles,books,quotes,groups,semantic)
    (root/'data/semantic-search.json').write_text(json.dumps(search_index,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

    library_main='''<section class="page-head library-hub-head"><span class="eyebrow">KİŞİSEL KÜTÜPHANE</span><h1>Kütüphanem</h1><p>Kaynakçanın sayılarla, dağılımlarla ve yoğunluklarla görünümü.</p><nav class="library-subnav"><a href="/kaynakca/">Kaynakça</a><a href="/muellif/">Müellifler</a><a href="/zaman-cizelgesi/">Zaman Çizelgesi</a><a href="/arama/">Semantik Arama</a></nav></section><section class="library-dashboard" id="library-dashboard"><div class="library-stat-grid" id="library-stat-grid"></div><div class="library-dashboard-grid"><section class="library-panel"><div class="section-heading"><h2>Alan dağılımı</h2></div><div id="library-category-bars" class="library-bars"></div></section><section class="library-panel"><div class="section-heading"><h2>En çok bulunan müellifler</h2></div><div id="library-top-authors" class="library-rank-list"></div></section><section class="library-panel"><div class="section-heading"><h2>Yayınevleri</h2></div><div id="library-top-publishers" class="library-rank-list"></div></section></div></section><script src="/library-dashboard.js?v=20261021-1" defer></script>'''
    page=doc('Kütüphanem',library_main,'', 'Furkan Sağdıç’ın kişisel kütüphanesinin istatistikleri ve dağılımları.').replace('/style.css?v=20261020-ultrarealbook1','/style.css?v=20261021-librarysuite1')
    write('kutuphanem/index.html',page)

    timeline_main='''<section class="page-head timeline-head"><span class="eyebrow">DÜŞÜNCE TARİHİ</span><h1>Zaman Çizelgesi</h1><p>Kütüphanemde yer alan müelliflerin tarih içindeki yerleri.</p><nav class="library-subnav"><a href="/kaynakca/">Kaynakça</a><a href="/muellif/">Müellifler</a><a href="/kutuphanem/">Kütüphanem</a><a href="/arama/">Semantik Arama</a></nav></section><section class="author-timeline-shell"><div class="timeline-toolbar"><label>Dönem veya müellif ara<input id="timeline-search" type="search" placeholder="Örn. Alman idealizmi, Kant…"></label><span id="timeline-count"></span></div><div id="author-timeline" class="author-timeline"></div><p class="timeline-source-note">Çizelge, kütüphanedeki müelliflerden tarih bilgisi doğrulanmış başlıca isimleri gösterir.</p></section><script src="/timeline.js?v=20261021-1" defer></script>'''
    page=doc('Zaman Çizelgesi',timeline_main,'','Kütüphanedeki müelliflerin kronolojik düşünce tarihi çizelgesi.').replace('/style.css?v=20261020-ultrarealbook1','/style.css?v=20261021-librarysuite1')
    write('zaman-cizelgesi/index.html',page)

    search_main='''<section class="page-head semantic-search-head"><span class="eyebrow">SEMANTİK ARAMA</span><h1>Sitede anlam üzerinden ara</h1><p>Kitapları, müellifleri, yazıları, notları ve alıntıları yalnız kelimeyle değil bağlamla birlikte ara.</p><nav class="library-subnav"><a href="/kaynakca/">Kaynakça</a><a href="/muellif/">Müellifler</a><a href="/kutuphanem/">Kütüphanem</a><a href="/zaman-cizelgesi/">Zaman Çizelgesi</a></nav><form id="semantic-search-form" class="semantic-search-box"><input id="semantic-search-input" type="search" placeholder="Örn. Kant'ın sanat anlayışıyla ilgili ne var?" autocomplete="off"><button type="submit">Ara</button></form><div class="semantic-search-examples"><button type="button">Hegel ve diyalektik</button><button type="button">Kant'ın sanat anlayışı</button><button type="button">gündelik hayat ve modernlik</button><button type="button">İbn Arabî ve vahdet-i vücud</button></div></section><section class="semantic-search-results"><div class="semantic-search-summary"><strong id="semantic-result-title">Aramaya hazır</strong><span id="semantic-result-count"></span></div><div id="semantic-result-groups"></div></section><script src="/semantic-search.js?v=20261021-1" defer></script>'''
    page=doc('Semantik Arama',search_main,'','Furkan Sağdıç sitesinde kitap, müellif, yazı, not ve alıntılarda anlam tabanlı arama.').replace('/style.css?v=20261020-ultrarealbook1','/style.css?v=20261021-librarysuite1')
    write('arama/index.html',page)

    return {'/kutuphanem/','/zaman-cizelgesi/','/arama/'}
