// Read and save through the authenticated gateway, avoiding stale published data.
export function createAbout({ $: byId, callAdmin, page = 'about', label = 'Hakkımda' }) {
  const $ = id => byId(id.replace(/^about-/, page + '-'));
  const text = $('about-text'), status = $('about-status');
  const save = $('about-save'), reload = $('about-reload');
  let sha = null, savedText = '', loaded = false, busy = false;
  function preview() {
    $('about-preview').replaceChildren(...text.value.trim().split(/\n\s*\n/).filter(Boolean).map(value => {
      const p = document.createElement('p');
      p.dir = 'auto';
      p.style.whiteSpace = 'pre-line';
      p.textContent = value;
      return p;
    }));
  }
  function controls() {
    text.disabled = busy || !loaded;
    save.disabled = busy || !loaded;
    reload.disabled = busy;
  }
  async function load() {
    if (busy) return;
    busy = true; controls(); status.textContent = 'Kayıtlı metin yükleniyor…';
    try {
      const data = await callAdmin('load_' + page);
      text.value = data.text; sha = data.sha; savedText = data.text; loaded = true;
      preview(); status.textContent = 'Kayıtlı metin yüklendi.';
    } catch (err) { status.textContent = 'Metin yüklenemedi: ' + err.message; }
    finally { busy = false; controls(); }
  }
  text.addEventListener('input', () => {
    preview();
    status.textContent = text.value === savedText ? 'Kayıtlı metin.' : 'Kaydedilmemiş değişiklikler var.';
  });
  reload.addEventListener('click', () => {
    if (text.value !== savedText && !window.confirm('Kaydedilmemiş değişikliklerin yerine kayıtlı metin yüklensin mi?')) return;
    load();
  });
  $('about-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !loaded) return;
    const value = text.value.trim();
    if (!value || value.length > 30000) { status.textContent = '1–30.000 karakter arasında bir metin yaz.'; return; }
    busy = true; controls(); status.textContent = 'Metin kaydediliyor…';
    try {
      const data = await callAdmin('save_' + page, { text: value, sha });
      sha = data.sha; savedText = data.text; text.value = data.text; preview();
      status.textContent = 'Kaydedildi. ' + label + ' sayfasına yansıması birkaç dakika sürebilir.';
    } catch (err) { status.textContent = 'Kaydedilemedi: ' + err.message; }
    finally { busy = false; controls(); }
  });
  window.addEventListener('beforeunload', event => {
    if (loaded && text.value !== savedText) { event.preventDefault(); event.returnValue = ''; }
  });
  return { load };
}
