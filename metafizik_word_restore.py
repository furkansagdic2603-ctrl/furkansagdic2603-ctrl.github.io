from pathlib import Path
import base64
import io
import json
import lzma
import re
import tarfile

BOOK_ID = "kitap-notlari/felsefe/metafizik/metafizik-kavram-ve-problemleriyle-varlik-felsefesi"
BOOK_TITLE = "Metafizik - Kavram ve Problemleriyle Varlık Felsefesi"
BOOK_AUTHOR = "Prof. Dr. A. Kadir Çüçen"

WORD_STYLE = r'''<style id="metafizik-word-exact-style">
.word-copy-page .word-source-article{
  max-width:8.65in!important;
  width:100%!important;
  font:inherit!important;
  white-space:normal!important;
  overflow-wrap:normal!important;
  overflow-x:auto!important;
}
.word-copy-page .word-paste{
  width:8.27in;
  max-width:none;
  margin:0 auto;
  padding:.98in;
  box-sizing:border-box;
  background:#fff!important;
  color:#000!important;
  font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif;
  font-size:11pt;
  line-height:115%;
  white-space:normal!important;
  text-rendering:optimizeLegibility;
}
.word-copy-page .word-paste p{
  direction:ltr;
  margin-top:0!important;
  margin-bottom:.1in!important;
  widows:2;
  orphans:2;
  text-align:left;
  line-height:115%!important;
  background:transparent!important;
  color:#000;
  font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif;
  font-size:11pt;
  white-space:normal!important;
  max-width:none!important;
}
.word-copy-page .word-paste p[align="center"]{text-align:center!important}
.word-copy-page .word-paste p[align="justify"]{text-align:justify!important}
.word-copy-page .word-paste p[align="right"]{text-align:right!important}
.word-copy-page .word-paste p[align="left"]{text-align:left!important}
.word-copy-page .word-paste b,.word-copy-page .word-paste strong{font-weight:700}
.word-copy-page .word-paste i,.word-copy-page .word-paste em{font-style:italic}
.word-copy-page .word-paste u{text-decoration:underline}
.word-copy-page .word-paste img{max-width:100%!important;height:auto!important}
.word-copy-page .article-head h1{
  position:absolute!important;
  width:1px!important;
  height:1px!important;
  padding:0!important;
  margin:-1px!important;
  overflow:hidden!important;
  clip:rect(0,0,0,0)!important;
  white-space:nowrap!important;
  border:0!important;
}
</style>'''

def _add_body_class(page: str) -> str:
    def repl(match):
        attrs = match.group(1)
        cm = re.search(r'class=(["\'])(.*?)\1', attrs, flags=re.I|re.S)
        if cm:
            classes = cm.group(2).split()
            if "word-copy-page" not in classes:
                classes.append("word-copy-page")
            attrs = attrs[:cm.start()] + 'class="' + ' '.join(classes) + '"' + attrs[cm.end():]
        else:
            attrs += ' class="word-copy-page"'
        return "<body" + attrs + ">"
    return re.sub(r'<body\b([^>]*)>', repl, page, count=1, flags=re.I)

def _add_article_class(opening: str) -> str:
    m = re.search(r'class=(["\'])(.*?)\1', opening, flags=re.I|re.S)
    if not m:
        return opening
    classes = m.group(2).split()
    if "word-source-article" not in classes:
        classes.append("word-source-article")
    return opening[:m.start()] + 'class="' + ' '.join(classes) + '"' + opening[m.end():]

def apply_metafizik_word_restore(root):
    root = Path(root)
    payload_dir = root / ".site-payload" / "metafizik-word-exact"
    parts = sorted(payload_dir.glob("part-*"))
    if len(parts) != 20:
        raise RuntimeError(f"Metafizik Word payload eksik: {len(parts)}/20")
    encoded = "".join(p.read_text(encoding="utf-8") for p in parts)
    archive = lzma.decompress(base64.b64decode(encoded))
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as tf:
        manifest = json.loads(tf.extractfile("manifest.json").read().decode("utf-8"))
        if len(manifest) != 13:
            raise RuntimeError(f"Metafizik Word manifest eksik: {len(manifest)}/13")
        changed = 0
        for slug in manifest:
            member = tf.extractfile(slug + ".html")
            if member is None:
                raise RuntimeError("Eksik Word HTML: " + slug)
            word_html = member.read().decode("utf-8")
            page_path = root / BOOK_ID / slug / "index.html"
            if not page_path.is_file():
                raise RuntimeError("Eksik bölüm sayfası: " + str(page_path))
            page = page_path.read_text(encoding="utf-8")
            if 'id="metafizik-word-exact-style"' not in page:
                page = page.replace("</head>", WORD_STYLE + "</head>", 1)
            page = _add_body_class(page)
            hidden = (
                '<div hidden data-book-id="' + BOOK_ID +
                '" data-book-title="' + BOOK_TITLE +
                '" data-book-author="' + BOOK_AUTHOR + '"></div>'
            )
            wrapped = '<div class="word-paste" lang="tr-TR" dir="ltr">' + word_html + '</div>'
            pattern = re.compile(r'(<article\b[^>]*\bdata-article="true"[^>]*>)[\s\S]*?(</article>)', re.I)
            match = pattern.search(page)
            if not match:
                raise RuntimeError("Makale gövdesi bulunamadı: " + slug)
            opening = _add_article_class(match.group(1))
            page = page[:match.start()] + opening + hidden + wrapped + match.group(2) + page[match.end():]
            page_path.write_text(page, encoding="utf-8")
            changed += 1
    print("METAFIZIK_WORD_EXACT_APPLIED", changed)
