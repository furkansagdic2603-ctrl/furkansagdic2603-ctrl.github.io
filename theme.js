// Apply the reader's choice before CSS paints to avoid a light flash during navigation.
(() => {
  const key = 'furkan-color-mode-v1';
  let mode = 'light';
  try { if (localStorage.getItem(key) === 'dark') mode = 'dark'; } catch { /* Private browsing may block storage. */ }
  document.documentElement.dataset.theme = mode;

  document.addEventListener('DOMContentLoaded', () => {
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
