"""Accessible, source-attributed static author dossiers."""
from html import escape as E
import re, json

def url(value):
 value=str(value or '')
 return value if value.startswith(('https://','/assets/')) and not value.startswith('//') else ''

def dossier(name,slug,library,profile):
 profile=profile or {};sources=profile.get('sources',[])
 image=url(profile.get('portraitUrl'));credit=profile.get('portraitCredit',{})
 if image:
  portrait='<figure class="dossier-portrait"><img src="'+E(image,quote=True)+'" alt="'+E(name,quote=True)+' portresi" width="240" height="300" decoding="async">'
  if credit.get('url'):portrait+='<figcaption><a href="'+E(url(credit['url']),quote=True)+'" target="_blank" rel="noopener">'+E((credit.get('creator','')+' · '+credit.get('license','')).strip(' ·'))+'</a></figcaption>'
  elif profile.get('portraitFile'):portrait+='<figcaption><a href="https://commons.wikimedia.org/wiki/File:'+E(profile['portraitFile'].replace(' ','_'),quote=True)+'" target="_blank" rel="noopener">Wikimedia Commons · görsel kaynağı</a></figcaption>'
  portrait+='</figure>'
 else:portrait='<div class="dossier-portrait dossier-no-portrait" aria-label="Doğrulanmış portre bulunmuyor"><span aria-hidden="true">'+E(''.join(w[0] for w in name.split()[:2]))+'</span><small>Doğrulanmış portre yok</small></div>'
 source_links=''.join('<a href="'+E(url(s.get('url')),quote=True)+'" target="_blank" rel="noopener">'+E(s.get('label','Kaynak'))+' ↗</a>' for s in sources if url(s.get('url')))
 bio=profile.get('life','');paragraphs=[p.strip() for p in bio.split('\n') if p.strip()]
 if paragraphs:
  bio_html=''.join('<p>'+E(p)+'</p>' for p in paragraphs)
 else:bio_html='<p class="dossier-unverified">Bu katalog adı için güvenilir bir biyografi eşleştirmesi henüz doğrulanamadı. Yanlış bir kişinin fotoğrafı veya hayat hikâyesi gösterilmiyor.</p>'
 # Keep each edition/source distinct; do not pretend variant titles are separate originals.
 records=[];seen=set()
 for w in profile.get('turkishWorks',[]):
  k=(w.get('title','').casefold(),w.get('publisher','').casefold())
  if k in seen:continue
  seen.add(k);records.append(dict(w,kind='verified'))
 for b in library:
  k=(b.get('title','').casefold(),b.get('publisher','').casefold())
  if k in seen:continue
  seen.add(k);records.append({'title':b.get('title',''),'publisher':b.get('publisher',''),'translator':b.get('translator',''),'pages':b.get('pages',''),'source':'Kişisel kütüphane kaydı','kind':'library'})
 records.sort(key=lambda w:w.get('title','').casefold())
 rows=[]
 for w in records:
  title=E(w.get('title',''));link=url(w.get('url'))
  if link:title='<a href="'+E(link,quote=True)+'" target="_blank" rel="noopener">'+title+' ↗</a>'
  meta=[str(w[k]) for k in ['publisher','date'] if w.get(k)]
  if w.get('translator'):meta.append('Mütercim: '+str(w['translator']))
  if w.get('pages'):meta.append(str(w['pages'])+' sayfa')
  rows.append('<li class="dossier-work" data-work-source="'+w['kind']+'"><div><strong>'+title+'</strong><p>'+E(' · '.join(meta) or 'Baskı ayrıntıları katalogda belirtilmemiş.')+'</p></div><small>'+E(w.get('source','Katalog'))+'</small></li>')
 ol=profile.get('openLibraryId','');olurl='https://openlibrary.org/authors/'+ol if re.fullmatch(r'OL\d+A',str(ol)) else ''
 hero='<section class="dossier-hero"><a class="back" href="/muellif/">← Müellifler</a><div class="dossier-identity">'+portrait+'<div><span class="eyebrow">MÜELLİF DOSYASI</span><h1>'+E(name)+'</h1><p>Hayatı, Türkçe baskıları ve okuma notları.</p><div class="dossier-badges"><span>'+str(len(library))+' kütüphane kaydı</span><span>'+str(sum(w['kind']=='verified' for w in records))+' dış katalog kaydı</span></div><nav class="dossier-nav" aria-label="Müellif dosyası bölümleri"><a href="#hayati">Hayatı</a><a href="#turkce-eserler">Türkçe eserler</a><a href="#katalog-nushalari">Kütüphanemde</a><a href="#dosya-kaynaklari">Kaynaklar</a></nav></div></div></section>'
 research='<section class="dossier" data-author-research data-author-name="'+E(name,quote=True)+'" data-author-slug="'+E(slug,quote=True)+'">'
 research+='<section id="hayati" class="dossier-section"><header><span class="eyebrow">01 · HAYAT HİKÂYESİ</span><h2>Hayatı ve düşünce dünyası</h2></header><div class="dossier-biography">'+bio_html+'</div>'+('<p class="dossier-attribution">Kaynak: '+source_links+' · metin CC BY-SA kapsamında aktarılmıştır.</p>' if paragraphs else '')+'</section>'
 research+='<section id="turkce-eserler" class="dossier-section"><header><span class="eyebrow">02 · ESER BİBLİYOGRAFYASI</span><h2>Türkçe baskılar ve tercümeler</h2><p>Doğrulanmış Türkçe baskılar ve kişisel katalog kayıtları kaynaklarıyla birlikte gösterilir. Kişisel kayıtlarda dil veya tercüme bilgisi ayrıca doğrulanmış olmayabilir; özgün Türkçe eserler çeviri olarak etiketlenmez.</p></header><div class="dossier-controls"><label>Eserlerde ara<input id="dossier-search" type="search" placeholder="Eser, yayınevi veya mütercim…" autocomplete="off"></label><label>Kayıt kaynağı<select id="dossier-source"><option value="all">Tüm kayıtlar</option><option value="verified">Doğrulanmış Türkçe baskılar</option><option value="library">Kişisel kütüphane</option></select></label></div><p id="dossier-status" role="status">'+str(len(records))+' kayıt</p><ol id="dossier-works" class="dossier-works">'+''.join(rows)+'</ol><p class="dossier-no-results" hidden>Bu süzgeçte eser bulunamadı.</p></section>'
 research+='<section id="dosya-kaynaklari" class="dossier-section dossier-sources"><header><span class="eyebrow">03 · KAYNAKLAR VE KAPSAM</span><h2>Kaynaklar</h2></header>'+source_links
 if olurl:research+='<a href="'+E(olurl,quote=True)+'" target="_blank" rel="noopener">Open Library · müellif kaydı ↗</a>'
 research+='<p>Son veri derlemesi: '+E(profile.get('fetchedAt','2026-10-24'))+'. Türkçe baskılar Open Library’de eser kimliği ve baskı dili üzerinden eşleştirilir; kütüphanedeki nüshalar ayrı kaynak etiketi taşır. Farklı adlarla yayımlanmış çeviriler ve katalog dışı baskılar bulunabilir; liste bir eksiksizlik iddiası taşımaz.</p></section></section>'
 return hero,research
