// Upload images into the current article editor.
export function initImages({ $, callAdmin, feedback }) {
  const escapeAttribute = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let imageRange = null;
  const rememberSelection = () => {
    const selection = getSelection();
    if (selection.rangeCount && $('editor').contains(selection.anchorNode)) imageRange = selection.getRangeAt(0).cloneRange();
  };
  $('editor').addEventListener('mouseup', rememberSelection);
  $('editor').addEventListener('keyup', rememberSelection);
  $('image-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    if (file.size > 2 * 1024 * 1024) { feedback('Görsel en fazla 2 MB olabilir.'); return; }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) { feedback('JPEG, PNG, GIF veya WebP görsel seç.'); return; }
    const button = $('image'); button.disabled = true; feedback('Görsel yükleniyor…');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Görsel okunamadı.'));
        reader.readAsDataURL(file);
      });
      const result = await callAdmin('upload_image', { filename: file.name, mime: file.type, data: dataUrl.split(',')[1] });
      $('editor').focus();
      if (imageRange && $('editor').contains(imageRange.commonAncestorContainer)) {
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(imageRange);
      }
      const alt = prompt('Görsel açıklaması (isteğe bağlı):') || '';
      document.execCommand('insertHTML', false, `<img src="${result.url}" alt="${escapeAttribute(alt)}">`);
      $('editor').dispatchEvent(new Event('input'));
      feedback('Görsel eklendi. Yazıyı kaydettiğinde sitede görünür.');
    } catch (err) { feedback(err.message); }
    finally { button.disabled = false; imageRange = null; }
  });
}
