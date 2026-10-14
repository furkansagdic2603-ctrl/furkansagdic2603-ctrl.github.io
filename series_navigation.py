"""Build navigation from published series indexes in their displayed order."""
import json
from lxml import html

def build_series_navigation(root):
    series=[]
    for path in sorted((root/'kitap-notlari').rglob('index.html')):
        tree=html.fromstring(path.read_text(encoding='utf-8'))
        rel=path.parent.relative_to(root).as_posix()
        url='/'+rel+'/'
        sections=tree.xpath('//section[contains(concat(" ",normalize-space(@class)," ")," chapter-list ")]')
        if sections:
            links=sections[0].xpath('.//a[@href]')
        elif rel.endswith('/gundelik-hayat-tenkidleri'):
            links=tree.xpath('//main//a[@href]')
        else:
            continue
        chapters=[];seen=set()
        for link in links:
            dest=link.get('href','')
            if not dest.startswith(url) or dest==url or dest in seen:continue
            target=root/dest.strip('/')/'index.html'
            if not target.is_file():continue
            page=html.fromstring(target.read_text(encoding='utf-8'))
            headings=page.xpath('//main//h1')
            if not headings:continue
            seen.add(dest);chapters.append({'title':headings[0].text_content().strip(),'url':dest})
        headings=tree.xpath('//main//h1')
        if len(chapters)>1 and headings:
            series.append({'id':rel,'title':headings[0].text_content().strip(),'url':url,'chapters':chapters})
    (root/'data'/'reading-series.json').write_text(json.dumps(series,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
