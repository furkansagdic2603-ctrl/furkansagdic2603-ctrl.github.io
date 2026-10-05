export function enlargePdfViewer(frame, container, published = false) {
  if (!document.getElementById('pdf-layout-style')) {
    const style = document.createElement('style');
    style.id = 'pdf-layout-style';
    style.textContent = `
      main.pdf-wide-main {max-width:1600px!important;width:100%;padding-left:24px!important;padding-right:24px!important}
      article.prose.pdf-wide-article {max-width:none!important;width:100%;padding:0!important;white-space:normal}
      .pdf-document {width:100%;max-width:none;clear:both}
      .pdf-large-frame {width:100%!important;height:calc(100dvh - 110px)!important;min-height:720px!important;display:block;border:1px solid #aaa;background:white}
      .pdf-fullscreen-button {display:inline-block;margin:12px 0;padding:10px 18px;font:600 15px system-ui;cursor:pointer}
      .pdf-document:fullscreen,.article-pdf-preview:fullscreen {width:100vw;height:100dvh;background:var(--paper,#fff);overflow:auto;padding:12px}
      :fullscreen .pdf-large-frame {height:calc(100dvh - 110px)!important;min-height:0!important}
      @media(max-width:700px){main.pdf-wide-main{padding-left:6px!important;padding-right:6px!important}.pdf-large-frame{height:85dvh!important;min-height:540px!important}}
    `;
    document.head.append(style);
  }
  frame.classList.add('pdf-large-frame');
  frame.src = frame.src.split('#')[0] + '#view=FitH&zoom=page-width';
  if (published) {
    container.closest('main')?.classList.add('pdf-wide-main');
    container.closest('article')?.classList.add('pdf-wide-article');
  }
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'pdf-fullscreen-button';
  button.textContent = '⛶ Tam ekran oku';
  button.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (container.requestFullscreen) await container.requestFullscreen();
      else window.open(frame.src, '_blank', 'noopener');
    } catch { window.open(frame.src, '_blank', 'noopener'); }
  });
  frame.before(button);
}
