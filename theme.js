// Apply the reader's choice before CSS paints to avoid a light flash during navigation.
(() => {
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
