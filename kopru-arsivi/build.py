import argparse,base64,gzip,json,re
from pathlib import Path
from lxml import html
from urllib.parse import urlparse

parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path)
parser.add_argument('output',type=Path)
args=parser.parse_args()
root=html.parse(str(args.source))
issues=[]
articles={}
pdfs=set()
def title(node):return ' '.join(node.text_content().split())
def path(url):return urlparse(url).path
for node in root.xpath('//strong[@class="wsp-category-title"]/a'):
    label=title(node)
    m=re.match(r'0*(\d+(?:-\d+)?)\s*\.\s*Sayı\b',label,re.I)
    group=path(node.get('href'))
    number=m[1] if m else '168' if group=='/dimagdan-vicdana-duygular/' else ''
    year=re.search(r'\b(?:19|20)\d{2}\b',label)
    issue=len(issues)
    issues.append([number,label,group,year[0] if year else ''])
    for a in node.xpath('../../ul/li/a'):
        key=path(a.get('href'))
        if key not in articles:articles[key]=[title(a),key,[]]
        articles[key][2].append(issue)
for a in root.xpath('//a[@href]'):
    link=a.get('href')
    if path(link).lower().endswith('.pdf'):pdfs.add(link)
assert len(articles)>1000 and len(issues)>100
payload=[issues,list(articles.values()),sorted(pdfs)]
args.output.write_text('window.kopruArchive="'+base64.b64encode(gzip.compress(json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()+'";\n')
print(len(issues),sum(bool(i[0]) for i in issues),len(articles),len(pdfs))
