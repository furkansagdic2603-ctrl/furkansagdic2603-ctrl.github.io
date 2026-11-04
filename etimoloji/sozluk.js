'use strict';
const form = document.getElementById('etimoloji-form');
const field = document.getElementById('kelime');
const status = document.getElementById('durum');
const entry = document.getElementById('madde');
const languageField = document.getElementById('dil');
const languages = new Map([
  ['tr', { wiki: 'https://tr.wiktionary.org', heading: 'Türkçe', source: 'Türkçe Vikisözlük' }],
  ['ar', { wiki: 'https://en.wiktionary.org', heading: 'Arabic', source: 'Wiktionary · Arapça madde' }],
  ['en', { wiki: 'https://en.wiktionary.org', heading: 'English', source: 'Wiktionary · İngilizce madde' }]
]);
const examples = new Map([
  ['mecmua', 'Türkçe mecmua, Osmanlı Türkçesindeki مجموعه biçimi üzerinden Arapça majmūʿa kelimesinden gelir.'],
  ['kitap', 'Türkçe kitap, Osmanlı Türkçesindeki kitâb biçimi üzerinden Arapça kitāb kelimesinden gelir.'],
  ['etimoloji', 'Türkçeye Fransızca étymologie biçiminden geçmiştir. Fransızca kelimenin gerisinde Latince etymologia ve Eski Yunanca etumología bulunur.']
]);
let active;

function add(tag, text, parent = entry) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}

async function parse(wiki, params, signal) {
  const url = new URL('/w/api.php', wiki);
  url.search = new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', origin: '*', redirects: '1', ...params });
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Vikisözlük bağlantısı başarısız.');
  return (await response.json()).parse;
}

async function lookup(word, code) {
  const { wiki, heading, source } = languages.get(code);
  active?.abort();
  const controller = new AbortController();
  active = controller;
  const timeout = setTimeout(() => controller.abort(), 9000);
  entry.replaceChildren();
  entry.hidden = true;
  status.textContent = 'Köken bilgisi aranıyor…';
  let notes = [];
  let revision;
  let sourcePage = code === 'tr' && word === 'kitap' ? 'كتاب' : word;
  let message = '';
  try {
    if (code === 'tr' && examples.has(word)) {
      notes = [examples.get(word)];
    } else {
      const index = await parse(wiki, { page: word, prop: 'sections|revid' }, controller.signal);
      const sections = index?.sections ?? [];
      const language = sections.findIndex(section => Number(section.level) === 2 && section.anchor === heading);
      const roots = [];
      for (let i = language + 1; language >= 0 && i < sections.length && Number(sections[i].level) > 2; i++) {
        if (/^(?:Köken|Etimoloji|Etymology)(?:[ _]\d+)?$/i.test(sections[i].anchor)) roots.push(sections[i]);
      }
      if (roots.length) {
        sourcePage = index.title;
        revision = index.revid;
        const bodies = await Promise.all(roots.map(section =>
          parse(wiki, { oldid: revision, section: section.index, prop: 'text', disableeditsection: '1' }, controller.signal)
        ));
        notes = bodies.flatMap(body => {
          const doc = new DOMParser().parseFromString(body?.text ?? '', 'text/html');
          const headings = [...doc.querySelectorAll('h2,h3,h4,h5,h6')];
          const boundary = headings[1];
          return [...doc.querySelectorAll('p, dl, ul, ol')].filter(node =>
            (!boundary || Boolean(node.compareDocumentPosition(boundary) & Node.DOCUMENT_POSITION_FOLLOWING)) && !node.parentElement.closest('p, dl, ul, ol') && !node.matches('.references')
          ).map(node => node.textContent.trim()).filter(Boolean);
        });
      }
      if (!notes.length) message = 'Bu yazımla seçilen dilde köken bölümü bulunamadı.';
    }
  } catch {
    message = 'Çevrimiçi sözlüğe ulaşılamadı. Kaynak bağlantısından yeniden deneyebilirsin.';
  } finally {
    clearTimeout(timeout);
  }
  if (active !== controller) return;
  entry.hidden = false;
  status.textContent = message || 'Köken bilgisi bulundu.';
  const title = add('h2', word);
  title.lang = code;
  if (code === 'ar') title.dir = 'rtl';
  for (const note of notes) add('p', note);
  const sources = add('p', 'Kaynak · ');
  const link = add('a', source, sources);
  link.href = revision ? wiki + '/w/index.php?oldid=' + revision : wiki + '/wiki/' + encodeURIComponent(sourcePage);
}

function readQuery() {
  const code = languageField.value;
  const input = field.value.trim().normalize('NFC');
  const word = code === 'ar' ? input.replace(/[\u0640\u064B-\u065F\u0670]/g, '') : input.toLocaleLowerCase(code);
  if (!word) return;
  const url = new URL(location.href);
  url.searchParams.set('q', word);
  url.searchParams.set('dil', code);
  history.replaceState(null, '', url);
  lookup(word, code);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  readQuery();
});
const query = new URLSearchParams(location.search);
languageField.value = languages.has(query.get('dil')) ? query.get('dil') : 'tr';
function updateInput() {
  field.dir = languageField.value === 'ar' ? 'rtl' : 'ltr';
  field.lang = languageField.value;
  field.placeholder = { tr: 'Ör. mecmua', ar: 'كتاب', en: 'Ör. bridge' }[languageField.value];
}
languageField.addEventListener('change', updateInput);
updateInput();
field.value = (query.get('q') ?? '').slice(0, 80);
if (field.value.trim()) readQuery();
