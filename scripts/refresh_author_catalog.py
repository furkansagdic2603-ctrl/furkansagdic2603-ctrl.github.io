"""Refresh attributed, same-origin author snapshots; no visitor-side API dependency.
Biographical extracts: Turkish Wikipedia, CC BY-SA; portraits retain Commons credits.
Unmatched identities are left unresolved instead of assigning the first search hit.
"""
from pathlib import Path
import json, urllib.request, urllib.parse, concurrent.futures, time, re, sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from author_profiles import norm
UA={'User-Agent':'FurkanLibraryProfile/1.0 (https://furkansagdic.com.tr)'}
ALIASES={'g-w-f-hegel':'Georg Wilhelm Friedrich Hegel','descartes':'René Descartes','imam-gazali':'Gazzâlî','ahmed-bin-hanbel':'Ahmed bin Hanbel','ibni-arabi-eser-sahibi-ekrem-demirli-cevirmen':'İbnü’l-Arabî','s-ren-kierkegaard':'Søren Kierkegaard','bertrand-russell':'Bertrand Russell','f-w-nietzsche':'Friedrich Nietzsche','henri-lefebvre':'Henri Lefebvre','michel-de-certeau':'Michel de Certeau'}
OUT=ROOT/'data/author-catalog.json'
CACHE=ROOT/'.author-refresh';CACHE.mkdir(exist_ok=True)
def get(url):
 for attempt in range(2):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=25) as r:return json.load(r)
  except Exception:
   if attempt:raise
   time.sleep(2)
def query(base,params):return get(base+'?'+urllib.parse.urlencode(params))
def title(name):
 if name.upper()==name:name=name.lower().title()
 return name
records=json.loads((ROOT/'data/author-index.json').read_text())
people=[r for r in records if not r['name'].startswith('(') and norm(r['name']) not in ['kolektif','mecmua','anonim','derleme','cesitli yazarlar'] and '/' not in r['name']]
titles={r['slug']:ALIASES.get(r['slug'],title(r['name'])) for r in people}
chunks=[list(titles.items())[i:i+25] for i in range(0,len(titles),25)]
def wiki_batch(batch):
 key='wiki-'+str(chunks.index(batch));cache=CACHE/(key+'.json')
 if cache.exists():data=json.loads(cache.read_text())
 else:
  data=query('https://tr.wikipedia.org/w/api.php',dict(action='query',format='json',redirects=1,prop='extracts|pageimages|pageprops',exintro=1,explaintext=1,piprop='name|thumbnail',pithumbsize=480,titles='|'.join(v for k,v in batch)))
  cache.write_text(json.dumps(data,ensure_ascii=False))
 q=data.get('query',{}); redirects={x['from']:x['to'] for x in q.get('normalized',[])+q.get('redirects',[])}
 pages={x.get('title'):x for x in q.get('pages',{}).values()}
 result={}
 for slug,t in batch:
  for _ in range(5):
   if t not in redirects:break
   t=redirects[t]
  p=pages.get(t,{})
  if p.get('extract') and 'disambiguation' not in p.get('pageprops',{}) and p.get('pageprops',{}).get('wikibase_item'):
   result[slug]={'name':p['title'],'qid':p['pageprops']['wikibase_item'],'life':p['extract'],'portraitUrl':p.get('thumbnail',{}).get('source',''),'portraitFile':p.get('pageimage',''),'sources':[{'label':'Türkçe Vikipedi · CC BY-SA','url':'https://tr.wikipedia.org/wiki/'+urllib.parse.quote(p['title'].replace(' ','_'))}],'fetchedAt':time.strftime('%Y-%m-%d')}
 return result
profiles={}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for i,f in enumerate(pool.map(wiki_batch,chunks)):
  profiles.update(f);print('biographies',i+1,'/',len(chunks),len(profiles),flush=True)
# Validate human identities, and retain stable author IDs for bibliographic matching.
ids=sorted({p['qid'] for p in profiles.values()});entities={}
for i in range(0,len(ids),50):
 cache=CACHE/('entities-'+str(i)+'.json')
 try:
  if cache.exists():data=json.loads(cache.read_text())
  else:
   data=query('https://www.wikidata.org/w/api.php',dict(action='wbgetentities',format='json',ids='|'.join(ids[i:i+50]),props='claims|labels',languages='tr|en'))
   cache.write_text(json.dumps(data))
  entities.update(data.get('entities',{}))
 except Exception as e:print('entity batch unavailable',i,str(e),flush=True)
def vals(e,p):return [x.get('mainsnak',{}).get('datavalue',{}).get('value') for x in e.get('claims',{}).get(p,[]) if x.get('mainsnak',{}).get('datavalue')]
for slug,p in list(profiles.items()):
 e=entities.get(p['qid'],{});types=[x.get('id') for x in vals(e,'P31') if isinstance(x,dict)]
 if types and 'Q5' not in types:del profiles[slug];continue
 p['openLibraryId']=next(iter(vals(e,'P648')),'')
# Persist before portrait downloads so an interrupted refresh is resumable.
OUT.write_text(json.dumps({'updatedAt':time.strftime('%Y-%m-%d'),'profiles':profiles,'license':'Biographical extracts: Wikipedia CC BY-SA 4.0; linked sources and individual Commons image licenses apply.'},ensure_ascii=False,indent=2))
print('SAVED',len(profiles),'profiles',flush=True)
