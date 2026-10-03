(() => {
  const books = [...document.querySelectorAll('.cinema-book')];
  if (!books.length) return;
  let selected = 0;
  function select(index) {
    selected = (index + books.length) % books.length;
    books.forEach((book, i) => {
      let offset = i - selected;
      if (offset > books.length / 2) offset -= books.length;
      if (offset < -books.length / 2) offset += books.length;
      book.style.setProperty('--offset', offset);
      book.style.setProperty('--distance', Math.abs(offset));
      book.style.zIndex = String(20 - Math.abs(offset));
      book.classList.toggle('is-selected', i === selected);
      book.classList.toggle('out-of-frame', Math.abs(offset) > 2);
      book.setAttribute('aria-pressed', String(i === selected));
      book.tabIndex = Math.abs(offset) > 2 ? -1 : 0;
    });
    const b = books[selected].dataset;
    document.getElementById('book-selected-title').textContent = b.title;
    document.getElementById('book-selected-meta').textContent = [b.author, b.count].filter(Boolean).join(' · ');
    document.getElementById('book-open').href = b.url;
    document.getElementById('book-prev').disabled = books.length < 2;
    document.getElementById('book-next').disabled = books.length < 2;
  }
  books.forEach((b, i) => b.addEventListener('click', () => {
    if (selected === i) document.getElementById('book-open').click();
    else select(i);
  }));
  document.getElementById('book-prev').onclick = () => select(selected - 1);
  document.getElementById('book-next').onclick = () => select(selected + 1);
  const stage = document.querySelector('.book-stage');
  stage.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); select(selected + (e.key === 'ArrowRight' ? 1 : -1)); books[selected].focus();
  });
  let start = null;
  stage.addEventListener('pointerdown', e => { start = e.clientX; });
  stage.addEventListener('pointerup', e => {
    if (start !== null && Math.abs(e.clientX-start) > 45) select(selected + (e.clientX < start ? 1 : -1));
    start = null;
  });
  stage.addEventListener('pointercancel', () => { start = null; });
  document.querySelectorAll('a[href^="#book-chapters-"]').forEach(a => a.addEventListener('click', () => {
    const details = document.querySelector(a.getAttribute('href')); if (details) details.open = true;
  }));
  select(0);
})();
