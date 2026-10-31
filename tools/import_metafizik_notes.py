from pathlib import Path
import base64, hashlib, json, shutil, tarfile, tempfile

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = ROOT / ".site-payload" / "metafizik-final"
OLD_PAYLOAD = ROOT / ".site-payload" / "metafizik-20261031"
BOOK = ROOT / "kitap-notlari" / "felsefe" / "metafizik" / "metafizik-kavram-ve-problemleriyle-varlik-felsefesi"

MAPPING = {
    "bolum-01-metafizik.html": "bolum-01-metafizik/index.html",
    "bolum-06-varlik-ve-hiclik.html": "bolum-06-varlik-ve-hiclik/index.html",
    "bolum-07-toz.html": "bolum-07-toz/index.html",
    "bolum-08-zamana-yazgili-olmak-ve-mekanda-kaybolan-zaman-zamana-dair-bir-sorgulama.html": "bolum-08-zamana-yazgili-olmak-ve-mekanda-kaybolan-zaman-zamana-dair-bir-sorgulama/index.html",
    "bolum-09-mekanin-metafizik-acidan-acimlanmasi.html": "bolum-09-mekanin-metafizik-acidan-acimlanmasi/index.html",
    "bolum-11-kategoriler.html": "bolum-11-kategoriler/index.html",
    "bolum-12-insan-metafizigi-benlik-kimlik-kisilik.html": "bolum-12-insan-metafizigi-benlik-kimlik-kisilik/index.html",
    "bolum-13-zihin-metafizigi.html": "bolum-13-zihin-metafizigi/index.html",
    "bolum-17-kader-uzerine.html": "bolum-17-kader-uzerine/index.html",
    "bolum-18-kaos.html": "bolum-18-kaos/index.html",
    "bolum-21-ozdeslik-ve-suredurum.html": "bolum-21-ozdeslik-ve-suredurum/index.html",
    "bolum-22-bilgi-ve-sinirlari.html": "bolum-22-bilgi-ve-sinirlari/index.html",
    "bolum-23-dogruluk-gerceklik.html": "bolum-23-dogruluk-gerceklik/index.html",
}

def main():
    payload_file = PAYLOAD / "payload.b64"
    meta_file = PAYLOAD / "meta.json"
    if not payload_file.exists():
        return

    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    raw = base64.b64decode(payload_file.read_text(encoding="ascii"), validate=True)
    if len(raw) != int(meta["archive_size"]):
        raise SystemExit("Metafizik payload size mismatch")
    if hashlib.sha256(raw).hexdigest() != meta["archive_sha256"]:
        raise SystemExit("Metafizik payload SHA-256 mismatch")

    with tempfile.TemporaryDirectory() as td:
        archive = Path(td) / "payload.tar.xz"
        archive.write_bytes(raw)
        extract = Path(td) / "extract"
        extract.mkdir()
        with tarfile.open(archive, "r:xz") as tf:
            names = set(tf.getnames())
            expected = set(MAPPING) | {"book-index.html"}
            if names != expected:
                raise SystemExit(f"Unexpected payload files: {sorted(names ^ expected)}")
            tf.extractall(extract)

        for src_name, rel_dest in MAPPING.items():
            src = extract / src_name
            dest = BOOK / rel_dest
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)

        shutil.copyfile(extract / "book-index.html", BOOK / "index.html")

    shutil.rmtree(PAYLOAD, ignore_errors=True)
    shutil.rmtree(OLD_PAYLOAD, ignore_errors=True)
    try:
        (ROOT / ".site-payload").rmdir()
    except OSError:
        pass
    Path(__file__).unlink(missing_ok=True)

if __name__ == "__main__":
    main()
