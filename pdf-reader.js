// PDF bytes remain in the saved article; rendered canvases are disposable.
export async function initPdfReaders() {
  const links = [...document.querySelectorAll('article.yazi-icerik a.pdf-original')];
  if (!links.length) return;
  let engine;
  const loadEngine = () => engine ||= import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs').then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    return pdfjs;
  });
  for (const link of links) {
    const source = link.getAttribute('href') || '';
    if (!/^data:application\/pdf;base64,[A-Za-z0-9+/]+=*$/.test(source)) continue;
    const binary = atob(source.slice(source.indexOf(',') + 1));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    link.href = blobUrl;
    const open = document.createElement('a');
    open.href = blobUrl; open.target = '_blank'; open.rel = 'noopener';
    open.textContent = 'PDF’yi ayrı aç ↗';
    open.style.marginInlineStart = '16px';
    link.after(open);
    const status = document.createElement('p');
    status.setAttribute('role', 'status'); status.textContent = 'PDF sayfaları yükleniyor…';
    const pages = document.createElement('div');
    pages.style.cssText = 'display:grid;gap:16px;max-width:100%;clear:both';
    const frame = document.createElement('iframe');
    frame.src = blobUrl;
    frame.title = link.download || 'Orijinal PDF';
    frame.style.cssText = 'display:block;width:100%;height:85vh;min-height:480px;border:1px solid #aaa;background:white';
    const fallback = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'PDF görünmüyorsa sayfaları burada göster';
    fallback.append(summary, status, pages);
    link.closest('.pdf-document').append(frame, fallback);
    // The native PDF viewer opens the exact uploaded file. The page renderer is a fallback.
    await new Promise(resolve => fallback.addEventListener('toggle', () => {
      if (fallback.open) resolve();
    }));
    try {
      const pdfjs = await loadEngine();
      const pdf = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
      status.textContent = `${pdf.numPages} sayfa · Orijinal PDF`;
      // Render only pages near the viewport to keep long PDFs usable on phones.
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          renderPage(Number(entry.target.dataset.page), entry.target).catch(() => {
            entry.target.textContent = 'Bu sayfa görüntülenemedi. Orijinal PDF’yi açabilirsin.';
          });
        }
      }, { rootMargin: '400px' });
      async function renderPage(number, holder) {
        const page = await pdf.getPage(number);
        const original = page.getViewport({ scale: 1 });
        const width = Math.min(holder.clientWidth || 800, 1200);
        const scale = width / original.width * Math.min(devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        canvas.style.cssText = 'display:block;width:100%;height:auto;background:white';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `PDF sayfa ${number}. Metni okumak için orijinal PDF bağlantısını kullan.`);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        holder.replaceChildren(canvas); holder.style.minHeight = '0';
        holder.style.aspectRatio = `${original.width}/${original.height}`;
        page.cleanup();
      }
      const first = await pdf.getPage(1);
      const size = first.getViewport({ scale: 1 });
      for (let number = 1; number <= pdf.numPages; number++) {
        const holder = document.createElement('div');
        holder.dataset.page = String(number);
        holder.style.cssText = `aspect-ratio:${size.width}/${size.height};background:#fff;color:#333;border:1px solid #ddd;overflow:hidden`;
        holder.textContent = `Sayfa ${number}`;
        pages.append(holder); observer.observe(holder);
      }
    } catch (error) {
      console.error(error);
      status.textContent = 'Önizleme yüklenemedi. PDF’yi yukarıdaki bağlantıdan açabilir veya indirebilirsin.';
    }
  }
}
