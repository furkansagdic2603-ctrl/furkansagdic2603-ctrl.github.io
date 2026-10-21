"""Deterministic semantic relation engine for author profiles.

The engine reads the full text of published articles/notes, not only titles and
descriptions. It combines explicit name mentions, work-title fingerprints,
rare bibliography terms and curated concepts for major thinkers. No article
content is modified; the output is relation metadata used by author profiles.
"""
from pathlib import Path
from collections import Counter
from html import unescape
import json, math, re, unicodedata

TR_MAP = str.maketrans({'ı':'i','ç':'c','ğ':'g','ö':'o','ş':'s','ü':'u','İ':'i','Ç':'c','Ğ':'g','Ö':'o','Ş':'s','Ü':'u'})

STOP = {
    've','veya','ile','icin','üzerine','uzerine','giris','kitabi','kitap','eser','eserleri','cilt',
    'bir','iki','uc','dort','bes','the','and','of','in','on','for','from','to','introduction',
    'tarih','tarihi','felsefe','felsefesi','dusunce','dusuncesi','secmeler','dersleri','hakkinda',
    'hayati','hayat','yazilari','yazilar','notlari','notlar','studies','works','selected'
}

CONCEPTS = {
    'hegel': ['diyalektik','tin','geist','aufhebung','mutlak idealizm','tinin fenomenolojisi','efendi kole','kendinde varlik','kendi icin varlik','dunya tini','aklin hilesi','tez antitez sentez'],
    'kant': ['kategorik imperatif','numen','fenomen','askinsal','transandantal','saf akil','pratik akil','yargi yetisi','sentetik a priori','estetik yargi'],
    'schopenhauer': ['isteme','irade ve tasarim','tasarim olarak dunya','yeter sebep','kotumserlik','yasama iradesi'],
    'nietzsche': ['guc istenci','ustinsan','ebedi donus','tanrinin olumu','kole ahlaki','degerlerin yeniden degerlendirilmesi','amor fati'],
    'heidegger': ['dasein','varlik ve zaman','dunyada olmak','firlatilmislik','das man','ontolojik fark','varligin anlami'],
    'bergson': ['sure','elan vital','yaratici tekamul','sezgi','madde ve bellek','yasamsal atilim'],
    'deleuze': ['fark ve tekrar','rizom','olus','arzulama makineleri','organsiz beden','yersizyurtsuzlasma'],
    'spinoza': ['conatus','toz','modus','deus sive natura','zorunluluk','etika','duygulanim'],
    'platon': ['idealar','magara alegorisi','anamnesis','devlet','formlar kurami','diyalog'],
    'eflatun': ['idealar','magara alegorisi','anamnesis','devlet','formlar kurami','diyalog'],
    'aristoteles': ['dort neden','entelekheia','ousia','kategoriler','poetika','nikomakhos','madde form'],
    'descartes': ['cogito','metodik suphe','zihin beden dualizmi','res cogitans','res extensa','dusunuyorum oyleyse varim'],
    'husserl': ['fenomenolojik indirgeme','epokhe','yonelimsellik','yasam dunyasi','transandantal ego'],
    'lefebvre': ['gundelik hayat','mekanin uretimi','ritimanaliz','gundelik hayatin elestirisi'],
    'bakhtin': ['diyalojizm','karnaval','heteroglossia','kronotop','cokseslilik'],
    'debord': ['gosteri toplumu','situasyonist','detournement','gosteri'],
    'foucault': ['soylem','iktidar bilgi','episteme','biyopolitika','panoptikon','soykutuk','arkeoloji'],
    'derrida': ['yapisokum','differance','iz','supplement','logosantrizm'],
    'nursi': ['risale i nur','tecelli','esma i ilahiye','ene','mana yi harfi','mana yi ismi','acz fakr sefkat tefekkur','bediuzzaman'],
    'bediuzzaman': ['risale i nur','tecelli','esma i ilahiye','ene','mana yi harfi','mana yi ismi','acz fakr sefkat tefekkur'],
    'arabi': ['vahdet i vucud','insan i kamil','fusus','futuhat','tecelli','ayan i sabite'],
    'gazali': ['ihya','tehafut','marifet','tasavvuf','kalp ilmi','makasid'],
    'gazzali': ['ihya','tehafut','marifet','tasavvuf','kalp ilmi','makasid'],
    'farabi': ['medinetul fazila','akillar teorisi','saadet','ilk reis','erdemli sehir'],
    'sina': ['vacibul vucud','mahiyet vucud','ucan adam','isarat','necat','sifa'],
    'mevlana': ['mesnevi','sema','ney','ask','vuslat'],
    'marx': ['arti deger','yabancilasma','tarihsel materyalizm','meta fetisizmi','sinif mucadelesi','uretim iliskileri'],
    'weber': ['protestan ahlaki','rasyonellesme','ideal tip','burokrasi','buyunun bozulmasi'],
    'bauman': ['akiskan modernite','akiskan ask','tuketim toplumu','akiskan hayat'],
    'simmel': ['metropol','para felsefesi','yabanci','bicim sosyolojisi'],
    'kierkegaard': ['kaygi','umutsuzluk','inanc sicramasi','estetik etik dinsel','ya ya da'],
    'wittgenstein': ['dil oyunu','aile benzerligi','ozel dil','traktatus','soylenemeyen'],
    'benjamin': ['aura','mekanik yeniden uretim','pasajlar','tarih melegi'],
    'adorno': ['kultur endustrisi','negatif diyalektik','estetik teori','aydinlanmanin diyalektigi'],
    'sartre': ['kendinde varlik','kendi icin varlik','kotu niyet','varolusculuk','ozgurluk'],
    'camus': ['absurd','sisifos','baskaldiran insan','uyumsuz'],
    'freud': ['bilincdisi','id ego superego','odipus','ruya yorumu','libido'],
    'jung': ['kolektif bilincdisi','arketip','golge','anima animus','bireylesme']
}

def norm(value):
    value = unicodedata.normalize('NFD', str(value or '')).translate(TR_MAP)
    value = ''.join(ch for ch in value if unicodedata.category(ch) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', ' ', value).strip()

def tokens(value):
    return {t for t in norm(value).split() if len(t) >= 4 and t not in STOP and not t.isdigit()}

def body_text(root, article):
    url = str(article.get('url') or '').strip('/')
    path = Path(root) / url / 'index.html'
    pieces = [str(article.get('title') or ''), str(article.get('description') or '')]
    if path.is_file():
        try:
            raw = path.read_text(encoding='utf-8', errors='ignore')
            match = re.search(r'<article\b[^>]*>(.*?)</article>', raw, flags=re.I|re.S)
            if not match:
                match = re.search(r'<main\b[^>]*>(.*?)</main>', raw, flags=re.I|re.S)
            chunk = match.group(1) if match else raw
            chunk = re.sub(r'<(?:script|style|noscript)\b[^>]*>.*?</(?:script|style|noscript)>', ' ', chunk, flags=re.I|re.S)
            chunk = re.sub(r'<[^>]+>', ' ', chunk)
            pieces.append(unescape(chunk))
        except OSError:
            pass
    return norm(' '.join(pieces))

def concept_terms(group):
    keys = {norm(x) for x in group.get('names', []) if norm(x)}
    surname_keys = {k.split()[-1] for k in keys if k.split()}
    hits = []
    for fingerprint, terms in CONCEPTS.items():
        fp = norm(fingerprint)
        if any(fp == s or fp in k.split() or k.endswith(' '+fp) for k in keys for s in surname_keys | {k}):
            hits.extend(norm(t) for t in terms)
    return sorted(set(t for t in hits if t))

def author_signature(group, idf):
    variants = sorted({norm(x) for x in group.get('names', []) if norm(x)}, key=len, reverse=True)
    surnames = sorted({v.split()[-1] for v in variants if v.split() and len(v.split()[-1]) >= 5})
    title_phrases = []
    title_tokens = set()
    for book in group.get('books', []):
        title = norm(book.get('title'))
        if len(title) >= 8 and len(title.split()) >= 2:
            title_phrases.append(title)
        title_tokens |= tokens(book.get('title'))
    rare = sorted((t for t in title_tokens if idf.get(t, 0) >= 3.1), key=lambda t: (-idf.get(t,0), t))
    return {
        'variants': variants,
        'surnames': surnames,
        'works': sorted(set(title_phrases), key=len, reverse=True)[:30],
        'rare': rare[:30],
        'concepts': concept_terms(group)
    }

def evidence_add(evidence, kind, term):
    term = str(term).strip()
    if not term:
        return
    item = {'kind': kind, 'term': term}
    if item not in evidence:
        evidence.append(item)

def score_relation(signature, article, text):
    headline = norm(' '.join([str(article.get('title') or ''), str(article.get('description') or '')]))
    score = 0.0
    evidence = []

    for variant in signature['variants']:
        if len(variant) < 4:
            continue
        if variant in headline:
            score += 135 if len(variant.split()) > 1 else 95
            evidence_add(evidence, 'müellif adı', variant)
            break
        if len(variant.split()) > 1 and variant in text:
            score += 95
            evidence_add(evidence, 'müellif adı', variant)
            break

    for surname in signature['surnames']:
        pattern = r'(?<![a-z0-9])' + re.escape(surname) + r'(?![a-z0-9])'
        hcount = len(re.findall(pattern, headline))
        count = len(re.findall(pattern, text))
        if hcount:
            score += 90
            evidence_add(evidence, 'başlık/özet', surname)
            break
        if count:
            score += 30 + min(count, 3) * 20
            evidence_add(evidence, 'metin içi atıf', surname)
            break

    matched_concepts = []
    for phrase in signature['concepts']:
        if phrase in headline:
            score += 34
            matched_concepts.append(phrase)
        elif phrase in text:
            score += 21
            matched_concepts.append(phrase)
        if len(matched_concepts) >= 5:
            break
    if len(matched_concepts) >= 2:
        score += 18
    for term in matched_concepts:
        evidence_add(evidence, 'kavram', term)

    work_matches = []
    for work in signature['works']:
        if len(work) < 10:
            continue
        if work in text:
            score += 48
            work_matches.append(work)
        if len(work_matches) >= 2:
            break
    for work in work_matches:
        evidence_add(evidence, 'eser', work)

    article_tokens = set(text.split())
    rare_matches = [t for t in signature['rare'] if t in article_tokens]
    if len(rare_matches) >= 2:
        rare_score = min(32.0, sum(4.2 for _ in rare_matches[:8]))
        score += rare_score
        for term in rare_matches[:4]:
            evidence_add(evidence, 'bibliyografik iz', term)

    score = round(score, 1)
    if score >= 120:
        strength = 'çok güçlü'
    elif score >= 85:
        strength = 'güçlü'
    elif score >= 58:
        strength = 'muhtemel'
    else:
        strength = ''
    return score, strength, evidence

def build_semantic_relations(root, articles, groups):
    total = max(1, len(groups))
    df = Counter()
    for group in groups.values():
        ts = set()
        for book in group.get('books', []):
            ts |= tokens(book.get('title'))
        for token in ts:
            df[token] += 1
    idf = {t: math.log((total + 1) / (n + 1)) + 1 for t,n in df.items()}

    article_texts = {str(a.get('url') or ''): body_text(root, a) for a in articles}
    relations = {}
    public_dump = {'engine':'semantic-relations-v1','authors':{}}

    for key, group in groups.items():
        signature = author_signature(group, idf)
        matches = []
        for article in articles:
            text = article_texts.get(str(article.get('url') or ''), '')
            if not text:
                continue
            score, strength, evidence = score_relation(signature, article, text)
            if score < 58:
                continue
            item = {
                'title': article.get('title') or 'Yazı',
                'date': article.get('date') or '',
                'description': article.get('description') or '',
                'category': article.get('category') or '',
                'categoryPath': article.get('categoryPath') or '',
                'url': article.get('url') or '',
                'semanticScore': score,
                'semanticStrength': strength,
                'semanticEvidence': evidence[:8]
            }
            matches.append(item)
        matches.sort(key=lambda x: (-x['semanticScore'], str(x.get('date') or ''), str(x.get('title') or '').casefold()))
        relations[key] = matches[:24]
        if matches:
            public_dump['authors'][group.get('slug') or key] = [
                {
                    'url': x['url'],
                    'title': x['title'],
                    'score': x['semanticScore'],
                    'strength': x['semanticStrength'],
                    'evidence': x['semanticEvidence']
                } for x in matches[:24]
            ]

    out = Path(root) / 'data' / 'semantic-relations.json'
    out.write_text(json.dumps(public_dump, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return relations
