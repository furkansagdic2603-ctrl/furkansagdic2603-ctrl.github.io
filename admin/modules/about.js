// Read and save through the authenticated gateway, avoiding stale published data.
export function createAbout({ $: byId, callAdmin, page = 'about', label = 'Hakkımda' }) {
  const $ = id => byId(id.replace(/^about-/, page + '-'));
  const text = $('about-text'), status = $('about-status');
  const save = $('about-save'), reload = $('about-reload');
  const supportsPhoto = page === 'about';
  const photoFile = supportsPhoto ? $('about-photo-file') : null;
  const photoPreview = supportsPhoto ? $('about-photo-preview') : null;
  const photoPlaceholder = supportsPhoto ? $('about-photo-placeholder') : null;
  const photoRemove = supportsPhoto ? $('about-photo-remove') : null;
  const photoNote = supportsPhoto ? $('about-photo-note') : null;
  let sha = null, savedText = '', loaded = false, busy = false;
  let photo = '', savedPhoto = '', selectedPhoto = null, localPhotoUrl = '';
  let photoRevision = '', photoRetry = 0, photoRetryTimer = null;

  function revokeLocalPhoto() {
    if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
    localPhotoUrl = '';
  }

  const readDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Fotoğraf okunamadı.'));
    reader.readAsDataURL(file);
  });

  async function preparePhotoUpload(file) {
    if (file.size <= 2 * 1024 * 1024) {
      const dataUrl = await readDataUrl(file);
      return { filename: file.name, mime: file.type, data: dataUrl.slice(dataUrl.indexOf(',') + 1), compressed: false };
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Fotoğraf sıkıştırmak için açılamadı.'));
        img.src = objectUrl;
      });

      const maxWidth = 1800, maxHeight = 2200;
      let scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
      let width = Math.max(1, Math.round(image.naturalWidth * scale));
      let height = Math.max(1, Math.round(image.naturalHeight * scale));
      let quality = 0.9;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Fotoğraf işlenemedi.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob) throw new Error('Fotoğraf sıkıştırılamadı.');
        if (blob.size <= 1.9 * 1024 * 1024) {
          const dataUrl = await readDataUrl(blob);
          const base = file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'hakkimda-fotografi';
          return { filename: base + '.jpg', mime: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1), compressed: true };
        }
        if (quality > 0.66) quality -= 0.08;
        else { width = Math.max(900, Math.round(width * 0.82)); height = Math.max(1100, Math.round(height * 0.82)); }
      }
      throw new Error('Fotoğraf otomatik olarak yeterince küçültülemedi.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function isDirty() {
    return loaded && (text.value !== savedText || (supportsPhoto && (photo !== savedPhoto || Boolean(selectedPhoto))));
  }

  function displayPhotoSource(extra = '') {
    if (!supportsPhoto) return '';
    if (localPhotoUrl) return localPhotoUrl;
    if (!photo) return '';
    const join = photo.includes('?') ? '&' : '?';
    const token = encodeURIComponent([photoRevision || sha || 'preview', extra].filter(Boolean).join('-'));
    return photo + join + 'adminPreview=' + token;
  }

  function previewText() {
    const root = $('about-preview');
    const copy = document.createElement('div');
    copy.className = 'about-preview-copy';
    const paragraphs = text.value.trim().split(/\n\s*\n/).filter(Boolean).map(value => {
      const p = document.createElement('p');
      p.dir = 'auto';
      p.style.whiteSpace = 'pre-line';
      p.textContent = value;
      return p;
    });
    copy.replaceChildren(...paragraphs);

    if (!supportsPhoto || !(localPhotoUrl || photo)) {
      root.replaceChildren(copy);
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'about-preview-layout';
    const figure = document.createElement('figure');
    figure.className = 'about-preview-portrait';
    const img = document.createElement('img');
    img.alt = 'Hakkımda fotoğrafı önizlemesi';
    img.src = displayPhotoSource('bottom');
    img.addEventListener('error', () => {
      figure.classList.add('is-loading');
      img.hidden = true;
      const note = document.createElement('span');
      note.textContent = 'Fotoğraf yayına hazırlanıyor…';
      figure.replaceChildren(note);
    }, { once: true });
    figure.appendChild(img);
    layout.append(figure, copy);
    root.replaceChildren(layout);
  }

  function previewPhoto() {
    if (!supportsPhoto) return;
    const source = displayPhotoSource();
    photoRemove.hidden = !(localPhotoUrl || photo);

    if (!source) {
      if (photoRetryTimer) clearTimeout(photoRetryTimer);
      photoRetryTimer = null;
      photoRetry = 0;
      photoPreview.hidden = true;
      photoPlaceholder.hidden = false;
      photoPlaceholder.textContent = 'Fotoğraf yok';
      photoPreview.removeAttribute('src');
      photoNote.textContent = 'Henüz fotoğraf eklenmedi.';
      previewText();
      return;
    }

    photoPreview.hidden = false;
    photoPlaceholder.hidden = true;
    if (photoPreview.getAttribute('src') !== source) photoPreview.src = source;
    photoNote.textContent = selectedPhoto
      ? 'Yeni fotoğraf seçildi. “Kaydet ve yayımla” ile siteye gönderilecek.'
      : localPhotoUrl
        ? 'Fotoğraf kaydedildi. Yerel önizleme gösteriliyor; site yayını hazırlanıyor.'
        : 'Kayıtlı fotoğraf. Yeni bir fotoğraf seçebilir veya kaldırabilirsin.';
    previewText();
  }

  function controls() {
    text.disabled = busy || !loaded;
    save.disabled = busy || !loaded;
    reload.disabled = busy;
    if (supportsPhoto) {
      photoFile.disabled = busy || !loaded;
      photoRemove.disabled = busy || !loaded;
    }
  }

  async function load() {
    if (busy) return;
    busy = true; controls(); status.textContent = 'Kayıtlı içerik yükleniyor…';
    try {
      const data = await callAdmin('load_' + page);
      text.value = data.text; sha = data.sha; savedText = data.text; loaded = true;
      if (supportsPhoto) {
        revokeLocalPhoto();
        selectedPhoto = null;
        photo = typeof data.photo === 'string' ? data.photo : '';
        savedPhoto = photo;
        photoRevision = data.sha || String(Date.now());
        photoRetry = 0;
        previewPhoto();
      }
      previewText(); status.textContent = 'Kayıtlı içerik yüklendi.';
    } catch (err) { status.textContent = 'İçerik yüklenemedi: ' + err.message; }
    finally { busy = false; controls(); }
  }

  text.addEventListener('input', () => {
    previewText();
    status.textContent = isDirty() ? 'Kaydedilmemiş değişiklikler var.' : 'Kayıtlı içerik.';
  });

  if (supportsPhoto) {
    photoFile.addEventListener('change', event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const allowed = ['image/jpeg','image/png','image/webp'];
      if (!allowed.includes(file.type) || file.size > 12 * 1024 * 1024) {
        status.textContent = 'JPEG, PNG veya WebP seç; kaynak fotoğraf en fazla 12 MB olabilir.';
        return;
      }
      revokeLocalPhoto();
      selectedPhoto = file;
      localPhotoUrl = URL.createObjectURL(file);
      previewPhoto();
      status.textContent = 'Yeni fotoğraf seçildi. Kaydet ve yayımla.';
    });

    photoRemove.addEventListener('click', () => {
      revokeLocalPhoto();
      selectedPhoto = null;
      photo = '';
      previewPhoto();
      status.textContent = 'Fotoğraf kaldırılacak. Değişikliği yayımlamak için kaydet.';
    });

    photoPreview.addEventListener('load', () => {
      photoRetry = 0;
      if (photoRetryTimer) clearTimeout(photoRetryTimer);
      photoRetryTimer = null;
      photoPreview.hidden = false;
      photoPlaceholder.hidden = true;
      if (!selectedPhoto && !localPhotoUrl && photo) {
        photoNote.textContent = 'Kayıtlı fotoğraf hazır.';
      }
      previewText();
    });

    photoPreview.addEventListener('error', () => {
      if (selectedPhoto || localPhotoUrl || !photo) return;
      photoPreview.hidden = true;
      photoPlaceholder.hidden = false;
      photoPlaceholder.textContent = 'Fotoğraf yayına hazırlanıyor…';
      photoNote.textContent = 'Fotoğraf dosyası kayıtlı. Yayın önizlemesi yeniden deneniyor…';
      if (photoRetry < 4) {
        photoRetry += 1;
        if (photoRetryTimer) clearTimeout(photoRetryTimer);
        photoRetryTimer = setTimeout(() => {
          if (!photo || localPhotoUrl || selectedPhoto) return;
          const source = displayPhotoSource('retry-' + photoRetry + '-' + Date.now());
          photoPreview.hidden = false;
          photoPlaceholder.hidden = true;
          photoPreview.src = source;
          previewText();
        }, 1200 * photoRetry);
      } else {
        photoPlaceholder.textContent = 'Fotoğraf kayıtlı';
        photoNote.textContent = 'Fotoğraf dosyası mevcut; sayfa yayını tamamlandığında görünecek.';
      }
    });
  }

  reload.addEventListener('click', () => {
    if (isDirty() && !window.confirm('Kaydedilmemiş değişikliklerin yerine kayıtlı içerik yüklensin mi?')) return;
    load();
  });

  $('about-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !loaded) return;
    const value = text.value.trim();
    if (!value || value.length > 30000) { status.textContent = '1–30.000 karakter arasında bir metin yaz.'; return; }

    busy = true; controls(); status.textContent = supportsPhoto && selectedPhoto ? 'Fotoğraf yükleniyor…' : 'İçerik kaydediliyor…';
    try {
      let photoToSave = photo;
      if (supportsPhoto && selectedPhoto) {
        status.textContent = selectedPhoto.size > 2 * 1024 * 1024 ? 'Fotoğraf otomatik küçültülüyor…' : 'Fotoğraf hazırlanıyor…';
        const prepared = await preparePhotoUpload(selectedPhoto);
        status.textContent = prepared.compressed ? 'Fotoğraf küçültüldü ve yükleniyor…' : 'Fotoğraf yükleniyor…';
        const uploaded = await callAdmin('upload_image', { filename: prepared.filename, mime: prepared.mime, data: prepared.data });
        if (!uploaded.url) throw new Error('Fotoğraf yüklenemedi.');
        photoToSave = uploaded.url;
        status.textContent = 'Fotoğraf yüklendi. Hakkımda sayfası kaydediliyor…';
      }

      const payload = { text: value, sha };
      if (supportsPhoto) payload.photo = photoToSave;
      const data = await callAdmin('save_' + page, payload);
      sha = data.sha; savedText = data.text; text.value = data.text;
      if (supportsPhoto) {
        selectedPhoto = null;
        photo = typeof data.photo === 'string' ? data.photo : photoToSave;
        savedPhoto = photo;
        photoRevision = data.sha || String(Date.now());
        photoRetry = 0;
        previewPhoto();
      }
      previewText();
      status.textContent = 'Kaydedildi. ' + label + ' sayfasına yansıması birkaç dakika sürebilir.';
    } catch (err) { status.textContent = 'Kaydedilemedi: ' + err.message; }
    finally { busy = false; controls(); }
  });

  window.addEventListener('beforeunload', event => {
    if (isDirty()) { event.preventDefault(); event.returnValue = ''; }
    if (!isDirty()) revokeLocalPhoto();
  });
  return { load };
}
