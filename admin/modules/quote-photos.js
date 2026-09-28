// Publish photos directly to the İktibas / Alıntılar gallery without an article.
export function initQuotePhotos({ $, callAdmin }) {
  const input = $('quote-photo-file');
  const button = $('quote-photo-upload');
  const preview = $('quote-photo-preview');
  const status = $('quote-photo-status');
  let previewUrl;

  input.addEventListener('change', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = input.files[0];
    preview.hidden = !file;
    if (file) {
      previewUrl = URL.createObjectURL(file);
      preview.src = previewUrl;
      status.textContent = `${file.name} seçildi.`;
    } else {
      preview.removeAttribute('src');
      status.textContent = '';
    }
  });

  button.addEventListener('click', async () => {
    const file = input.files[0];
    if (!file) { status.textContent = 'Önce bir fotoğraf seç.'; return; }
    if (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      status.textContent = 'JPEG, PNG, GIF veya WebP fotoğraf seç (en fazla 2 MB).';
      return;
    }
    button.disabled = true;
    status.textContent = 'Fotoğraf yükleniyor…';
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Fotoğraf okunamadı.'));
        reader.readAsDataURL(file);
      });
      await callAdmin('upload_image', { filename: file.name, mime: file.type, data: dataUrl.split(',')[1], gallery: 'iktibas-alintilar' });
      input.value = '';
      preview.hidden = true;
      preview.removeAttribute('src');
      URL.revokeObjectURL(previewUrl);
      previewUrl = undefined;
      status.replaceChildren('Fotoğraf eklendi. Galeride görünmesi birkaç dakika sürebilir. ', Object.assign(document.createElement('a'), { href: '/iktibas-alintilar/', textContent: 'Galeriyi aç →' }));
    } catch (err) { status.textContent = err.message; }
    finally { button.disabled = false; }
  });
}
