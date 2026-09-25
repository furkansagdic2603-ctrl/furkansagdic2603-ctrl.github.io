// Private statistics widget.
export function createStats({ $, callAdmin, getArticles }) {
  async function fetchStats() {
    $('stats-status').textContent = 'İstatistikler yükleniyor…';
    const data = await callAdmin('stats');
    $('stats-summary').textContent = `Bugün ${data.today} · Son 30 gün ${data.total} sayfa görüntüleme${data.truncated ? ' (ilk 10.000 kayıt)' : ''}`;
    const daily = new Map(data.daily);
    const max = Math.max(1, ...daily.values());
    const chart = $('stats-chart'); chart.replaceChildren();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
      const count = daily.get(date) || 0;
      const bar = document.createElement('div'); bar.className = 'stats-bar';
      bar.title = `${date}: ${count} görüntüleme`;
      bar.style.height = `${Math.max(3, count / max * 100)}%`;
      chart.append(bar);
    }
    const top = $('stats-top'); top.replaceChildren();
    for (const [path, count] of data.top) {
      const row = document.createElement('li');
      const link = document.createElement('a'); link.href = /^\/[a-z0-9/-]*$/.test(path) ? path : '/';
      link.textContent = getArticles().find(article => article.url === path)?.title || path;
      row.append(link, ` — ${count}`); top.append(row);
    }
    $('stats-status').textContent = 'Sayfa görüntülemeleri; ziyaretçi kimliği tutulmaz. Sayfa başına oturumda bir kez sayılır.';
  }
  $('refresh-stats').addEventListener('click', () => fetchStats().catch(err => { $('stats-status').textContent = err.message; }));
  return { fetchStats };
}
