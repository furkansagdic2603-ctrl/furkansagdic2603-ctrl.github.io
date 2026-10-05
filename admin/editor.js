const $ = id => document.getElementById(id);
const editor = $('editor');
// Remove drafts saved by older versions. New sessions start with an empty editor.
try { localStorage.removeItem('furkan-editor-draft-v1'); } catch {}
$('title').value = '';
$('description').value = '';
editor.innerHTML = '';

let savedRange = null;
let selectedImage = null;
function rememberSelection() {
  const selection = getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
}
document.addEventListener('selectionchange', rememberSelection);
editor.addEventListener('keyup', rememberSelection);
editor.addEventListener('mouseup', rememberSelection);
const toolbar = document.querySelector('.toolbar');
toolbar.addEventListener('pointerdown', event => {
  rememberSelection();
  if (event.target.closest('button')) event.preventDefault();
});
function restoreSelection() {
  editor.focus();
  if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }
}
function format(command, value = null) {
  restoreSelection();
  document.execCommand(command, false, value);
  rememberSelection();
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}
document.querySelectorAll('[data-command]').forEach(button => {
  button.addEventListener('click', () => format(button.dataset.command));
});
$('block').addEventListener('change', event => format('formatBlock', event.target.value));
$('size').addEventListener('change', event => format('fontSize', event.target.value));
$('font-family').addEventListener('change', event => format('fontName', event.target.value));
$('color').addEventListener('input', event => format('foreColor', event.target.value));
$('link').addEventListener('click', () => {
  const url = prompt('Bağlantı adresi (https://…)');
  if (url && /^https?:\/\//i.test(url)) format('createLink', url);
});
$('image').addEventListener('click', () => $('image-file').click());

function updateImageControls() {
  const valid = selectedImage && editor.contains(selectedImage);
  document.querySelectorAll('[data-image-align]').forEach(button => {
    button.setAttribute('aria-pressed', String(!!valid && (
      button.dataset.imageAlign === 'center' ? selectedImage.style.float === 'none' && selectedImage.style.marginLeft === 'auto' : selectedImage.style.float === button.dataset.imageAlign
    )));
  });
}
editor.addEventListener('click', event => {
  selectedImage = event.target.closest('img');
  if (selectedImage && editor.contains(selectedImage)) {
    const range = document.createRange();
    range.selectNode(selectedImage);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange = range.cloneRange();
  }
  updateImageControls();
});
document.querySelectorAll('[data-image-align]').forEach(button => {
  button.addEventListener('click', () => {
    if (!selectedImage || !editor.contains(selectedImage)) {
      $('feedback').textContent = 'Önce editördeki görsele tıkla, ardından konumunu seç.';
      return;
    }
    const alignment = button.dataset.imageAlign;
    selectedImage.style.display = 'block';
    selectedImage.style.height = 'auto';
    selectedImage.style.float = alignment === 'center' ? 'none' : alignment;
    selectedImage.style.maxWidth = alignment === 'center' ? '100%' : '50%';
    selectedImage.style.margin = alignment === 'center' ? '16px auto' : alignment === 'left' ? '6px 20px 16px 0' : '6px 0 16px 20px';
    updateImageControls();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    $('feedback').textContent = alignment === 'center' ? 'Görsel ortalandı.' : alignment === 'left' ? 'Görsel sola yerleştirildi; metin sağından akacak.' : 'Görsel sağa yerleştirildi; metin solundan akacak.';
  });
});

const slug=s=>s.toLocaleLowerCase('tr').replaceAll('ı','i').replaceAll('ğ','g').replaceAll('ü','u').replaceAll('ş','s').replaceAll('ö','o').replaceAll('ç','c').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));$('download').onclick=()=>{const title=$('title').value.trim(),body=$('editor').innerHTML.trim();if(!title||!$('editor').textContent.trim()){$('feedback').textContent='Başlık ve yazı içeriği gerekli.';return}const cat=$('category').value,sub='',name=slug(title),path=[cat,name,'index.html'].join('/'),description=$('description').value.trim()||$('editor').textContent.trim().slice(0,160),date=new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric'}).format(new Date()),label=$('category').selectedOptions[0].textContent,page=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Furkan Sağdıç</title><meta name="description" content="${esc(description)}"><link rel="stylesheet" href="/style.css"></head><body><header class="masthead"><div class="topline"><a class="brand" href="/">Furkan Sağdıç</a></div></header><main><div class="article-head"><a class="back" href="/${cat}/">← ${label}</a><div class="eyebrow">${label} · ${date}</div><h1>${esc(title)}</h1></div><article class="prose yazi-icerik" data-article="true">${body}</article></main></body></html>`;const a=document.createElement('a'),blob=new Blob([page],{type:'text/html;charset=utf-8'});a.href=URL.createObjectURL(blob);a.download='index.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);$('feedback').textContent='İndirildi. GitHub dosya adı: '+path};


