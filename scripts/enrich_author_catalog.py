"""Cache Commons portraits and Turkish editions matched by stable author IDs."""
from pathlib import Path
import json,urllib.request,urllib.parse,concurrent.futures,time,hashlib,re,io
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'data/author-catalog.json';data=json.loads(P.read_text());profiles=data['profiles'];C=ROOT/'.author-refresh';C.mkdir(exist_ok=True);A=ROOT/'assets/author-portraits';A.mkdir(parents=True,exist_ok=True)
UA={'User-Agent':'FurkanLibraryProfile/1.0 (https://furkansagdic.com.tr)'}
def get(url,binary=False):
 for attempt in range(2):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=25) as r:return r.read() if binary else json.load(r)
  except Exception:
   if attempt:raise
   time.sleep(2)
def cached(url):
 p=C/(hashlib.sha256(url.encode()).hexdigest()+'.json')
 if p.exists():return json.loads(p.read_text())
 d=get(url);p.write_text(json.dumps(d,ensure_ascii=False));return d
def query(base,params):return cached(base+'?'+urllib.parse.urlencode(params))
files=sorted({p['portraitFile'] for p in profiles.values() if p.get('portraitFile')});credits={}
for i in range(0,len(files),40):
 try:
  d=query('https://commons.wikimedia.org/w/api.php',dict(action='query',format='json',prop='imageinfo',iiprop='extmetadata|url',titles='|'.join('File:'+f for f in files[i:i+40])))
  for e in d.get('query',{}).get('pages',{}).values():
   info=next(iter(e.get('imageinfo',[])),{});m=info.get('extmetadata',{});clean=lambda k:re.sub('<[^>]+>','',m.get(k,{}).get('value','')).strip()
   credits[e['title'].removeprefix('File:').replace('_',' ')]={'creator':clean('Artist'),'license':clean('LicenseShortName'),'licenseUrl':clean('LicenseUrl'),'url':info.get('descriptionurl','')}
 except Exception as e:print('credit batch',i,str(e),flush=True)
def photo(item):
 slug,p=item;url=p.get('portraitUrl');credit=credits.get(p.get('portraitFile','').replace('_',' '),{})
 if not url:return slug,None
 # Keep only images whose reuse terms are explicitly identified.
 if not credit.get('license') or not any(k in credit['license'].lower() for k in ['cc','public domain','pd','gfdl']):return slug,None
 path=A/(p['qid']+'.jpg')
 try:
  if not path.exists():
   raw=get(url,True);im=Image.open(io.BytesIO(raw)).convert('RGB');im.thumbnail((480,600));im.save(path,quality=86,optimize=True)
  return slug,{'portraitUrl':'/assets/author-portraits/'+path.name,'portraitCredit':credit}
 except Exception as e:print('portrait unavailable',slug,str(e)[:80],flush=True);return slug,None
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,(slug,result) in enumerate(pool.map(photo,list(profiles.items()))):
  if result:profiles[slug].update(result)
  if i%20==0:print('portraits',i,flush=True)
P.write_text(json.dumps(data,ensure_ascii=False,indent=2));print('portraits saved',len(list(A.glob('*.jpg'))),flush=True)
# Search works whose edition language is Turkish. Selected edition records retain
# their Turkish title; editions are not confused with original-language works.
ids=sorted({p['openLibraryId'] for p in profiles.values() if re.fullmatch(r'OL\d+A',str(p.get('openLibraryId','')))})
byid={id:[p for p in profiles.values() if p.get('openLibraryId')==id] for id in ids}
batches=[ids[i:i+18] for i in range(0,len(ids),18)]
def works(batch):
 page=1;out=[];total=0
 while True:
  q='('+' OR '.join('author_key:'+id for id in batch)+') AND language:tur'
  d=query('https://openlibrary.org/search.json',dict(q=q,lang='tr',page=page,limit=100,fields='key,title,author_key,author_name,first_publish_year,editions,editions.title,editions.language,editions.publisher,editions.publish_date,editions.isbn'))
  docs=d.get('docs',[]);total=d.get('numFound',d.get('num_found',0));out.extend(docs)
  if not docs or page*100>=total:break
  page+=1
  if page>100:raise RuntimeError('Catalog unexpectedly exceeds 10000 works; refusing silent truncation')
 return out,total
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for i,(docs,total) in enumerate(pool.map(works,batches)):
  for w in docs:
   for id in w.get('author_key',[]):
    if id not in byid:continue
    for e in w.get('editions',{}).get('docs',[]):
     if 'tur' not in e.get('language',[]):continue
     record={'title':e.get('title') or w.get('title'),'publisher':', '.join(e.get('publisher',[])),'date':', '.join(e.get('publish_date',[])),'url':'https://openlibrary.org'+w['key'],'source':'Open Library · Türkçe baskı','language':'tr','originalTitle':w.get('title','')}
     for p in byid[id]:p.setdefault('turkishWorks',[]).append(record)
  print('Turkish catalog',i+1,'/',len(batches),'matched works',total,flush=True)
for p in profiles.values():
 records=p.get('turkishWorks',[]);seen={}
 for r in records:seen.setdefault(r['url']+'|'+r['title'],r)
 p['turkishWorks']=list(seen.values())
P.write_text(json.dumps(data,ensure_ascii=False,indent=2));print('COMPLETE',len(profiles),'profiles',sum(len(p.get('turkishWorks',[])) for p in profiles.values()),'Turkish records',flush=True)
