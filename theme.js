// Apply the reader's choice before CSS paints to avoid a light flash during navigation.
(() => {
  const key = 'furkan-color-mode-v1';
  let mode = 'light';
  try { if (localStorage.getItem(key) === 'dark') mode = 'dark'; } catch { /* Private browsing may block storage. */ }
  document.documentElement.dataset.theme = mode;
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    function update() {
      const dark = document.documentElement.dataset.theme === 'dark';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Açık temaya geç' : 'Koyu temaya geç');
      button.textContent = dark ? '☀ Açık' : '☾ Koyu';
    }
    update();
    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(key, next); } catch { /* Choice still applies to this page. */ }
      update();
    });
  });
})();
