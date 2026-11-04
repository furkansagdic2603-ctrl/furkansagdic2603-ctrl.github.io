'use strict';
const form = document.getElementById('etimoloji-form');
const field = document.getElementById('kelime');
const status = document.getElementById('durum');
const entry = document.getElementById('madde');
const wiki = 'https://tr.wiktionary.org';
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

async function parse(params, signal) {
  const url = new URL('/w/api.php', wiki);
  url.search = new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', origin: '*', redirects: '1', ...params });
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Vikisözlük bağlantısı başarısız.');
  return (await response.json()).parse;
}

async function lookup(word) {
  active?.abort();
  const controller = new AbortController();
  active = controller;
  const timeout = setTimeout(() => controller.abort(), 9000);
  entry.replaceChildren();
  entry.hidden = true;
  status.textContent = 'Köken bilgisi aranıyor…';
  let notes = [];
  let revision;
  let sourcePage = word === 'kitap' ? 'كتاب' : word;
  let message = '';
  try {
    if (examples.has(word)) {
      notes = [examples.get(word)];
    } else {
      const index = await parse({ page: word, prop: 'sections|revid' }, controller.signal);
      const sections = index?.sections ?? [];
      const language = sections.findIndex(section => Number(section.level) === 2 && section.anchor === 'Türkçe');
      const roots = [];
      for (let i = language + 1; language >= 0 && i < sections.length && Number(sections[i].level) > 2; i++) {
        if (/^(?:Köken|Etimoloji)(?:[ _]\d+)?$/i.test(sections[i].anchor)) roots.push(sections[i]);
      }
      if (roots.length) {
        sourcePage = index.title;
        revision = index.revid;
        const bodies = await Promise.all(roots.map(section =>
          parse({ oldid: revision, section: section.index, prop: 'text', disableeditsection: '1' }, controller.signal)
        ));
        notes = bodies.flatMap(body => {
          const doc = new DOMParser().parseFromString(body?.text ?? '', 'text/html');
          return [...doc.querySelectorAll('p, dl, ul, ol')].filter(node =>
            !node.parentElement.closest('p, dl, ul, ol') && !node.matches('.references')
          ).map(node => node.textContent.trim()).filter(Boolean);
        });
      }
      if (!notes.length) message = 'Bu yazımla Türkçe köken bölümü bulunamadı.';
    }
  } catch {
    message = 'Çevrimiçi sözlüğe ulaşılamadı. Kaynak bağlantısından yeniden deneyebilirsin.';
  } finally {
    clearTimeout(timeout);
  }
  if (active !== controller) return;
  entry.hidden = false;
  status.textContent = message || 'Köken bilgisi bulundu.';
  add('h2', word);
  for (const note of notes) add('p', note);
  const sources = add('p', 'Kaynak · ');
  const link = add('a', 'Türkçe Vikisözlük', sources);
  link.href = revision ? wiki + '/w/index.php?oldid=' + revision : wiki + '/wiki/' + encodeURIComponent(sourcePage);
}

function readQuery() {
  const word = field.value.trim().normalize('NFC').toLocaleLowerCase('tr');
  if (!word) return;
  const url = new URL(location.href);
  url.searchParams.set('q', word);
  history.replaceState(null, '', url);
  lookup(word);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  readQuery();
});
field.value = (new URLSearchParams(location.search).get('q') ?? '').slice(0, 80);
if (field.value.trim()) readQuery();
