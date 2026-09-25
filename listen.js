(() => {
  const panel = document.querySelector('.listen-panel');
  const article = document.querySelector('article.yazi-icerik');
  if (!panel || !article) return;
  const audio = panel.querySelector('audio');
  const button = panel.querySelector('.browser-voice');
  const status = panel.querySelector('.listen-status');
  const config = window.COMMENTS_CONFIG;
  const prefix = location.pathname.replace(/^\/+|\/+$/g, '');
  const base = config?.url?.replace(/\/$/, '');
  let parts = 0, part = 0, version = '';
  const objectUrl = path => `${base}/storage/v1/object/public/article-audio/${path}`;
  if (base && prefix) {
    fetch(objectUrl(`${prefix}/manifest.json`), { cache: 'no-store' }).then(async response => {
      if (!response.ok) return;
      const manifest = await response.json();
      if (!Number.isSafeInteger(manifest.parts) || manifest.parts < 1 || manifest.parts > 300 || !/^[a-f0-9]{12}$/.test(manifest.version)) return;
      parts = manifest.parts; version = manifest.version;
      audio.src = objectUrl(`${prefix}/${version}/part-000.mp3`);
      audio.hidden = false;
      status.textContent = 'Yapay zekâ tarafından seslendirilmiştir.';
    }).catch(() => {});
  }
  audio.addEventListener('ended', () => {
    if (++part >= parts) { part = 0; audio.src = objectUrl(`${prefix}/${version}/part-000.mp3`); return; }
    audio.src = objectUrl(`${prefix}/${version}/part-${String(part).padStart(3, '0')}.mp3`);
    audio.play().catch(() => { status.textContent = 'Sonraki ses parçasını başlatmak için oynat düğmesine bas.'; });
  });
  if (!('speechSynthesis' in window)) { button.hidden = true; return; }
  let speaking = false;
  const text = article.textContent.replace(/\s+/g, ' ').trim();
  const segments = text.match(/.{1,180}(?:\s|$)/g) || [text];
  let segment = 0;
  function next() {
    if (!speaking || segment >= segments.length) {
      speaking = false; button.textContent = 'Tarayıcı sesiyle dinle';
      if (!audio.hidden) status.textContent = 'Yapay zekâ tarafından seslendirilmiştir.';
      return;
    }
    const utterance = new SpeechSynthesisUtterance(segments[segment++]);
    utterance.lang = 'tr-TR'; utterance.rate = 1;
    utterance.onend = next;
    utterance.onerror = () => { speaking = false; button.textContent = 'Tarayıcı sesiyle dinle'; status.textContent = 'Tarayıcı sesi başlatılamadı.'; };
    speechSynthesis.speak(utterance);
  }
  button.addEventListener('click', () => {
    if (speaking) { speaking = false; speechSynthesis.cancel(); button.textContent = 'Tarayıcı sesiyle dinle'; return; }
    audio.pause(); speaking = true; segment = 0;
    button.textContent = 'Dinlemeyi durdur'; status.textContent = 'Tarayıcının Türkçe sesiyle okunuyor.';
    speechSynthesis.cancel(); next();
  });
  window.addEventListener('pagehide', () => { if (speaking) speechSynthesis.cancel(); });
})();
