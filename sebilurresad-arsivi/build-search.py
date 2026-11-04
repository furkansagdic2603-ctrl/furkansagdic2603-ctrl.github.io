"""Generate per-volume page text and conservative article ranges."""
import argparse
import base64
from collections import defaultdict
import gzip
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unicodedata

ROOT = Path(__file__).resolve().parent
URL = "https://www.bagcilar.bel.tr/Files/eKitap/siratimustakim_sebilurresad/turkce/cilt_{}.pdf"

def normalize(text):
    text = unicodedata.normalize("NFD", text.lower().replace("ı", "i"))
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in text if not unicodedata.combining(c)).replace("’", "").replace("'", "")).strip()

def extract(volume, source_dir):
    if source_dir:
        packed = source_dir / f"{volume}.b64"
        return json.loads(gzip.decompress(base64.b64decode(packed.read_bytes())))
    with tempfile.TemporaryDirectory() as temp:
        pdf = Path(temp) / "volume.pdf"
        subprocess.run(["curl", "-fLsS", "--retry", "4", "--max-time", "180", URL.format(volume), "-o", str(pdf)], check=True)
        text = subprocess.check_output(["pdftotext", "-raw", str(pdf), "-"]).decode()
    return 1, text.rstrip("\f").split("\f")

def build(volume, entries, output, source_dir):
    first, pages = extract(volume, source_dir)
    start = min(row[5] for row in entries)
    pages = pages[start - first:]
    end = next((i for i, p in enumerate(pages) if re.search(r"^\s*YAZAR İNDEKSİ\s*$", p, re.M | re.I)), len(pages))
    pages = [re.sub(r"\s+", " ", re.sub(r"[-‐­]\s*\n\s*(?=[^\W\d_])", "", p)).strip() for p in pages[:end]]
    if max(row[5] for row in entries) >= start + len(pages):
        raise ValueError(f"Cilt {volume}: PDF sayfaları dizinle uyuşmuyor")

    # Attach text to an article only when both boundaries are identifiable.
    by_page = defaultdict(list)
    for i, row in enumerate(entries):
        by_page[row[5] - start].append((i, row[2]))
    anchors = {}
    for page, titles in by_page.items():
        text = pages[page]
        words = list(re.finditer(r"[^\W_]+(?:[’'][^\W_]+)*", text))
        plain = " ".join(normalize(word.group()) for word in words)
        offsets = {}
        cursor = 0
        for word in words:
            offsets[cursor] = word.start()
            cursor += len(normalize(word.group())) + 1
        for i, title in titles:
            key = normalize(title)
            if len(key.split()) < 2:
                continue
            hits = list(re.finditer(r"(?<!\S)" + re.escape(key) + r"(?!\S)", plain))
            if len(hits) == 1 and hits[0].start() in offsets:
                anchors[i] = [page, offsets[hits[0].start()]]
    ranges = {}
    for i, begin in anchors.items():
        finish = anchors.get(i + 1)
        if finish and tuple(begin) < tuple(finish) and finish[0] - begin[0] <= 15:
            ranges[i + 1] = [begin, finish]
    payload = json.dumps([start, pages, ranges], ensure_ascii=False, separators=(",", ":"))
    (output / f"{volume}.json.gz").write_bytes(gzip.compress(payload.encode(), mtime=0))
    print(volume, len(pages), len(ranges), flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--index", type=Path, default=ROOT / "dizin.js")
    parser.add_argument("--output", type=Path, default=ROOT / "metin")
    args = parser.parse_args()
    encoded = re.search(r'"([A-Za-z0-9+/=]+)"', args.index.read_text()).group(1)
    data = json.loads(gzip.decompress(base64.b64decode(encoded)))
    args.output.mkdir(parents=True, exist_ok=True)
    for volume, entries in data.items():
        build(volume, entries, args.output, args.source_dir)

if __name__ == "__main__":
    main()
