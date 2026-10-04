// Apply the reader's choice before CSS paints to avoid a light flash during navigation.
(() => {
  // Resolve the closest category identity before the first paint, including
  // pages created by the editor and nested book-note categories.
  const designs = new Set(['kitap-notlari', 'makaleler', 'notlar', 'sinema-tahlilleri', 'iktibas-alintilar', 'felsefe', 'sanat', 'din', 'mitoloji', 'sosyoloji', 'psikoloji', 'bilim', 'tarih', 'edebiyat']);
  const parts = location.pathname.split('/').filter(Boolean);
  let design = designs.has(parts[0]) ? parts[0] : '';
  if (parts[0] === 'kitap-notlari' && designs.has(parts[1])) design = parts[1];
  if (parts[0] === 'kitap-notlari' && parts[1] === 'sinema') design = 'sinema-tahlilleri';
  document.documentElement.dataset.categoryDesign = design;
  const key = 'furkan-color-mode-v1';
  let mode = 'light';
  try { if (localStorage.getItem(key) === 'dark') mode = 'dark'; } catch { /* Private browsing may block storage. */ }
  document.documentElement.dataset.theme = mode;

  document.addEventListener('DOMContentLoaded', () => {
    // Reader script preference; preserve the source text so switching back is exact.
    if (!document.getElementById('admin-panel')) {
      const originalText = new Map();
      const scriptKey = 'furkan-reading-script-v1';
      const map = { a:'ا', b:'ب', c:'ج', ç:'چ', d:'د', e:'ه', f:'ف', g:'گ', ğ:'غ', h:'ه', ı:'ی', i:'ی', j:'ژ', k:'ك', l:'ل', m:'م', n:'ن', o:'و', ö:'و', p:'پ', r:'ر', s:'س', ş:'ش', t:'ت', u:'و', ü:'و', v:'و', y:'ي', z:'ز', q:'ق', w:'و', x:'كس' };
      const words = { ve:'و', bir:'بر', bu:'بو', ile:'ايله', için:'ايچون', da:'ده', de:'ده', ki:'كه', ne:'نه', ben:'بن', sen:'سن', o:'او', biz:'بز', siz:'سز', onlar:'اونلار', felsefe:'فلسفه', sanat:'صنعت', tarih:'تاريخ', kitap:'كتاب', din:'دين', insan:'انسان', hayat:'حيات', zaman:'زمان', düşünce:'دوشونجه', osmanlı:'عثمانلی', yazı:'يازی', yazılar:'يازىلار', notlar:'نوتلار', kitaplar:'كتاب لار', edebiyat:'ادبيات', mitoloji:'ميتولوژی', sosyoloji:'سوسيولوژی', psikoloji:'پسيكولوژی', bilim:'علم', kaynakça:'مآخذ', galeri:'گالری', hakkında:'حقّنده', iletişim:'ارتباط', arşiv:'آرشيو', oku:'اوقو', okuma:'اوقوما', ara:'آرا' };
      const convert = source => source.replace(/[A-Za-zÇĞİÖŞÜçğıöşü]+/g, word => words[word.toLocaleLowerCase('tr')] || [...word.toLocaleLowerCase('tr')].map(letter => map[letter] || letter).join(''));
      const shouldSkip = node => node.parentElement?.closest('script,style,noscript,code,pre,svg,textarea,[contenteditable],.script-switch,.script-note,[data-script-exempt]');
      function applyScript(root, ottoman) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (shouldSkip(node) || (!originalText.has(node) && !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(node.nodeValue))) continue;
          if (!originalText.has(node)) originalText.set(node, node.nodeValue);
          const supplied = node.parentElement?.childNodes.length === 1 ? node.parentElement.getAttribute('data-ottoman') : null;
          node.nodeValue = ottoman ? (supplied || convert(originalText.get(node))) : originalText.get(node);
        }
      }
      const actions = document.querySelector('.top-actions');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'script-switch';
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', 'Osmanlı harfleriyle oku');
      button.innerHTML = '<span lang="tr">Latin</span><span class="switch-track" aria-hidden="true"><i></i></span><span lang="tr">Osmanlıca</span>';
      actions?.prepend(button);
      const notice = document.createElement('p');
      notice.className = 'script-note';
      notice.textContent = 'Otomatik harf aktarımıdır; tarihî Osmanlı imlasının birebir karşılığı değildir.';
      notice.hidden = true;
      const main = document.querySelector('main');
      main?.prepend(notice);
      let ottoman = false;
      function setScript(next) {
        ottoman = next;
        document.documentElement.dataset.script = next ? 'ottoman' : 'latin';
        applyScript(document.body, next);
        button.setAttribute('aria-pressed', String(next));
        button.setAttribute('aria-label', next ? 'Latin harflerine geç' : 'Osmanlı harfleriyle oku');
        notice.hidden = !next;
        try { localStorage.setItem(scriptKey, next ? 'ottoman' : 'latin'); } catch { /* Preference still works on this page. */ }
      }
      button.addEventListener('click', () => setScript(!ottoman));
      try { if (localStorage.getItem(scriptKey) === 'ottoman') setScript(true); } catch { /* Storage may be disabled. */ }
      const observer = new MutationObserver(records => {
        if (!ottoman) return;
        for (const record of records) for (const added of record.addedNodes) {
          if (added.nodeType === Node.TEXT_NODE && !shouldSkip(added)) {
            if (!originalText.has(added)) originalText.set(added, added.nodeValue);
            added.nodeValue = convert(originalText.get(added));
          } else if (added.nodeType === Node.ELEMENT_NODE && !added.closest('.script-switch,.script-note')) applyScript(added, true);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    const button = document.getElementById('theme-toggle');
    if (button) {
      function updateThemeButton() {
        const dark = document.documentElement.dataset.theme === 'dark';
        button.setAttribute('aria-pressed', String(dark));
        button.setAttribute('aria-label', dark ? 'Açık temaya geç' : 'Koyu temaya geç');
        button.textContent = dark ? '☀ Açık' : '☾ Koyu';
      }
      updateThemeButton();
      button.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem(key, next); } catch { /* Choice still applies to this page. */ }
        updateThemeButton();
      });
    }

    const article = document.querySelector('article.yazi-icerik');
    if (!article) return;

    const styles = document.createElement('style');
    styles.textContent = '.reading-progress{position:fixed;top:0;left:0;width:100vw;height:4px;z-index:1000;background:rgba(112,96,82,.22);pointer-events:none}.reading-progress span{display:block;width:0;height:100%;background:var(--accent);transition:width .12s linear}@media(prefers-reduced-motion:reduce){.reading-progress span{transition:none}}';
    document.head.appendChild(styles);

    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-label', 'Yazıdaki ilerleme');
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    const fill = document.createElement('span');
    progressBar.appendChild(fill);
    document.body.appendChild(progressBar);

    let framePending = false;
    function updateProgress() {
      framePending = false;
      const articleTop = window.scrollY + article.getBoundingClientRect().top;
      const articleHeight = article.scrollHeight;
      const start = articleTop - window.innerHeight * 0.65;
      const end = articleTop + articleHeight - window.innerHeight * 0.35;
      const percent = Math.round(Math.min(100, Math.max(0, (window.scrollY - start) / Math.max(1, end - start) * 100)));
      fill.style.width = percent + '%';
      progressBar.setAttribute('aria-valuenow', String(percent));
      progressBar.setAttribute('aria-valuetext', percent + '%');
    }
    function scheduleProgressUpdate() {
      if (framePending) return;
      framePending = true;
      window.requestAnimationFrame(updateProgress);
    }
    window.addEventListener('scroll', scheduleProgressUpdate, { passive: true });
    window.addEventListener('resize', scheduleProgressUpdate, { passive: true });
    updateProgress();
  });
})();

// Optional reader-controlled scrolling. Never start automatically on navigation.
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const article = document.querySelector('article.yazi-icerik');
    if (!article) return;
    const style = document.createElement('style');
    style.textContent = `
      .auto-reader{position:fixed;right:20px;bottom:20px;z-index:900;max-width:calc(100vw - 24px);padding:10px 12px;border:1px solid var(--rule);border-radius:14px;background:var(--paper);color:var(--ink);box-shadow:0 4px 20px #0002;font:14px/1.4 system-ui,sans-serif;direction:ltr}
      .auto-reader button{min-height:44px;padding:8px 12px;border:1px solid var(--rule);border-radius:9px;background:var(--paper);color:var(--ink);font:inherit}
      .auto-reader button:focus-visible,.auto-reader input:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
      .auto-reader-controls{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}
      .auto-reader-controls[hidden]{display:none}
      .auto-reader label{display:flex;align-items:center;gap:8px}
      .auto-reader input{width:110px;accent-color:var(--accent)}
      .auto-reader output{min-width:30px;font-variant-numeric:tabular-nums}
      .auto-reader-rate{flex-basis:100%;color:var(--muted);font-size:12px}
      .auto-reader-status{display:block;color:var(--muted);font-size:12px;margin-top:6px}
      @media(max-width:600px){.auto-reader{right:12px;bottom:calc(12px + env(safe-area-inset-bottom));padding:6px 10px}.auto-reader-controls{gap:6px}.auto-reader input{width:90px}}
    `;
    document.head.append(style);
    const panel = document.createElement('section');
    panel.className = 'auto-reader';
    panel.setAttribute('aria-label', 'Otomatik kaydırma');
    panel.setAttribute('data-script-exempt', '');
    panel.innerHTML = '<button type="button" class="auto-reader-toggle" aria-expanded="false" aria-controls="auto-reader-controls">Otomatik kaydır</button><div id="auto-reader-controls" class="auto-reader-controls" hidden><button type="button" class="auto-reader-play" aria-pressed="false">▶ Başlat</button><label for="auto-reader-speed">Hız <input id="auto-reader-speed" type="range" min="1" max="5" step="0.5" value="2"><output for="auto-reader-speed">2×</output></label><span class="auto-reader-rate" title="Yazının kelime sayısı ve ekrandaki yüksekliğine göre ortalama tahmindir."></span></div><span class="auto-reader-status" role="status" hidden></span>';
    document.body.append(panel);
    const toggle = panel.querySelector('.auto-reader-toggle');
    const controls = panel.querySelector('.auto-reader-controls');
    const play = panel.querySelector('.auto-reader-play');
    const speed = panel.querySelector('input');
    const output = panel.querySelector('output');
    const status = panel.querySelector('.auto-reader-status');
    const key = 'furkan-auto-scroll-speed-v1';
    try {
      const saved = Number(localStorage.getItem(key));
      if (Number.isFinite(saved) && saved >= 1 && saved <= 5) speed.value = String(Math.round(saved * 2) / 2);
    } catch { /* Controls also work when storage is unavailable. */ }
    const rate = panel.querySelector('.auto-reader-rate');
    // Estimate the average words passing through the viewport per minute.
    // Text density varies with screen width, font size, images and paragraph spacing.
    const wordCount = (article.textContent.trim().match(/\S+/g) || []).length;
    const showSpeed = () => {
      output.value = speed.value + '×';
      const height = article.getBoundingClientRect().height || article.scrollHeight;
      const wordsPerMinute = height > 0 ? Math.max(10, Math.round(wordCount / height * Number(speed.value) * 12 * 60 / 10) * 10) : 0;
      rate.textContent = wordsPerMinute ? '≈ ' + wordsPerMinute + ' kelime/dk · Ortalama' : 'Ortalama hız hesaplanıyor…';
      speed.setAttribute('aria-valuetext', speed.value + ' kat, yaklaşık ' + wordsPerMinute + ' kelime/dakika');
    };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(showSpeed).observe(article);
    window.addEventListener('load', showSpeed, { once: true });
    showSpeed();
    let running = false, frame = 0, last = null, position = 0;
    function pause(message = 'Duraklatıldı') {
      running = false;
      cancelAnimationFrame(frame);
      last = null;
      play.textContent = '▶ Devam';
      play.setAttribute('aria-pressed', 'false');
      status.textContent = message;
      status.hidden = false;
    }
    function endPosition() {
      return Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight,
        scrollY + article.getBoundingClientRect().bottom - innerHeight + panel.offsetHeight + 24));
    }
    function tick(now) {
      if (!running) return;
      const end = endPosition();
      if (scrollY >= end - 1) { pause('Yazının sonuna geldin'); return; }
      if (last !== null) {
        position = Math.min(end, position + Math.min(now - last, 64) / 1000 * Number(speed.value) * 12);
        window.scrollTo({ top: position, behavior: 'instant' });
      }
      last = now;
      frame = requestAnimationFrame(tick);
    }
    toggle.addEventListener('click', () => {
      const open = controls.hidden;
      controls.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Otomatik kaydır · Kapat' : 'Otomatik kaydır';
      if (!open) { pause(); status.hidden = true; }
    });
    play.addEventListener('click', () => {
      if (running) { pause(); return; }
      running = true;
      position = scrollY;
      last = null;
      play.textContent = '⏸ Duraklat';
      play.setAttribute('aria-pressed', 'true');
      status.textContent = 'Kaydırılıyor';
      status.hidden = false;
      frame = requestAnimationFrame(tick);
    });
    speed.addEventListener('input', () => {
      showSpeed();
      try { localStorage.setItem(key, speed.value); } catch { /* Keep the current speed. */ }
    });
    const manual = event => { if (running && !panel.contains(event.target)) pause('Elle kaydırma nedeniyle duraklatıldı'); };
    window.addEventListener('wheel', manual, { passive: true });
    window.addEventListener('touchstart', manual, { passive: true });
    window.addEventListener('pointerdown', manual, { passive: true });
    window.addEventListener('keydown', event => {
      if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) manual(event);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && running) pause(); });
    window.addEventListener('pagehide', () => { if (running) pause(); });
    window.addEventListener('resize', () => { position = scrollY; last = null; showSpeed(); }, { passive: true });
  });
})();
