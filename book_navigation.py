"""Resolve catalog books to real published notes, never guessed paths."""
from pathlib import Path
from lxml import html
from html import escape
import json, re, unicodedata

def norm(s):return ''.join(c for c in unicodedata.normalize('NFKD',str(s).casefold().replace('ı','i')) if not unicodedata.combining(c)).strip()

def build_book_navigation(root,doc,write):
 root=Path(root);books=json.loads((root/'data/site-books.json').read_text());articles=[]
 for p in (root/'kitap-notlari').rglob('index.html'):
  t=html.fromstring(p.read_text());a=t.xpath('//article[contains(concat(" ",normalize-space(@class)," ")," yazi-icerik ")]')
  if not a:continue
  h=t.xpath('//h1');meta=t.xpath('//*[@data-book-title]')
  articles.append({'url':'/'+str(p.parent.relative_to(root))+'/','title':h[0].text_content().strip() if h else p.parent.name,'book':meta[0].get('data-book-title','') if meta else ''})
 out={}
 for b in books:
  id=str(b.get('id','')).strip('/')
  if not id.startswith('kitap-notlari/') or '..' in id:continue
  url='/'+id+'/'
  notes=[{'title':a['title'],'url':a['url']} for a in articles if (a['book'] and norm(a['book'])==norm(b.get('title'))) or a['url']==url or a['url'].startswith(url)]
  notes=list({x['url']:x for x in notes}.values())
  notes.sort(key=lambda n:re.sub(r'\d+',lambda m:m.group().zfill(8),n['url']))
  out[id]={'url':url,'notes':notes,'title':b.get('title','')}
  if not (root/id/'index.html').is_file():
   rows=''.join('<a class="chapter-row" href="'+escape(n['url'],quote=True)+'"><span>'+str(i+1).zfill(2)+'</span><span>'+escape(n['title'])+'</span><span>→</span></a>' for i,n in enumerate(notes))
   if not rows:rows='<p class="empty">Bu kitap için henüz yayımlanmış bir not bulunmuyor.</p>'
   main='<section class="page-head"><a class="back" href="/kitap-notlari/">← Kitap Notları</a><h1>'+escape(b.get('title','Kitap'))+'</h1><p>'+str(len(notes))+' yayımlanmış not</p></section><section class="chapter-list" aria-label="Kitabın notları">'+rows+'</section>'
   write(id+'/index.html',doc(b.get('title','Kitap'),main,'kitap-notlari'))
 write('data/book-navigation.json',json.dumps(out,ensure_ascii=False,indent=2))
 return out
