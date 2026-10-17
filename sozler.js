document.addEventListener('DOMContentLoaded', () => {
  const q = document.getElementById('soz-search');
  const grid = document.getElementById('sozler-grid');
  const buttons = [...document.querySelectorAll('.soz-view-controls button')];
  if (q) q.addEventListener('input', () => {
    const term = q.value.toLocaleLowerCase('tr');
    document.querySelectorAll('.soz-card').forEach(card => {
      card.hidden = !card.textContent.toLocaleLowerCase('tr').includes(term);
    });
  });
  const apply = value => {
    const n = Math.max(1, Math.min(3, Number(value) || 2));
    if (grid) grid.style.setProperty('--soz-cols', n);
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.cols) === n)));
    try { localStorage.setItem('sozler-columns', String(n)); } catch (_) {}
  };
  let saved = 2;
  try { saved = localStorage.getItem('sozler-columns') || 2; } catch (_) {}
  apply(saved);
  buttons.forEach(button => button.addEventListener('click', () => apply(button.dataset.cols)));
});
