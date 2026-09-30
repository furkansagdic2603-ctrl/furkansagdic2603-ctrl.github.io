// Site palette settings.
export function createTheme({ $, callAdmin }) {
  const presets = [{"id":"tezhip","name":"Tezhipli Yazma Eser","accent":"#a34830","paper":"#faf8f3","ink":"#123c50"},{"id":"iznik","name":"İznik Çinisi","accent":"#b46f48","paper":"#edf3f0","ink":"#173e46"},{"id":"cilt","name":"Osmanlı Cilt Kapağı","accent":"#ad853c","paper":"#fbf5e9","ink":"#492324"}];
  const setColors = theme => {
    $('theme-accent').value = theme.accent;
    $('theme-paper').value = theme.paper;
    $('theme-ink').value = theme.ink;
  };
  const selectedPreset = () => presets.find(p => p.id === document.querySelector('input[name="hero-design"]:checked')?.value) || presets[0];
  $('save-hero-design').addEventListener('click', async () => {
    const button = $('save-hero-design');
    button.disabled = true;
    $('hero-design-feedback').textContent = 'Tasarım yayımlanıyor…';
    const preset = selectedPreset();
    try {
      await callAdmin('save_theme', { theme: { accent: preset.accent, paper: preset.paper, ink: preset.ink } });
      setColors(preset);
      $('hero-design-feedback').textContent = preset.name + ' kaydedildi. Sitede görünmesi birkaç dakika sürebilir.';
    } catch (err) { $('hero-design-feedback').textContent = err.message; }
    finally { button.disabled = false; }
  });
  $('save-theme').addEventListener('click', async () => {
    const button = $('save-theme'); button.disabled = true;
    $('theme-feedback').textContent = 'Renkler kaydediliyor…';
    try {
      // Keep the chosen preset's identifying accent when editing other colors.
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
      const active = presets.find(p => p.accent === theme.accent?.toLowerCase()) || presets[0];
      document.querySelector('input[name="hero-design"][value="' + active.id + '"]').checked = true;
      $('theme-accent').value = theme.accent || '#8b3d2e';
      $('theme-paper').value = theme.paper || '#faf8f3';
      $('theme-ink').value = theme.ink || '#22221e';
    } catch { /* Use built-in colors if unavailable. */ }
  }};
}
