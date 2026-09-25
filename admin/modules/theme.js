// Site palette settings.
export function createTheme({ $, callAdmin }) {
  $('save-theme').addEventListener('click', async () => {
    const button = $('save-theme'); button.disabled = true;
    $('theme-feedback').textContent = 'Renkler kaydediliyor…';
    try {
      await callAdmin('save_theme', { theme: {
        accent: $('theme-accent').value,
        paper: $('theme-paper').value,
        ink: $('theme-ink').value
      }});
      $('theme-feedback').textContent = 'Renkler kaydedildi. Sitede görünmesi birkaç dakika sürebilir.';
    } catch (err) { $('theme-feedback').textContent = err.message; }
    finally { button.disabled = false; }
  });
  return { async loadTheme() {
    try {
      const themeRes = await fetch('/data/theme.json', { cache: 'no-store' });
      const theme = themeRes.ok ? await themeRes.json() : {};
      $('theme-accent').value = theme.accent || '#8b3d2e';
      $('theme-paper').value = theme.paper || '#faf8f3';
      $('theme-ink').value = theme.ink || '#22221e';
    } catch { /* Use built-in colors if unavailable. */ }
  }};
}
