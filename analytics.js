(() => {
  const config = window.COMMENTS_CONFIG;
  if (!config?.url || !config?.publishableKey) return;
  if (/\/admin(?:\/|$)/.test(location.pathname) || /bot|crawl|spider|preview/i.test(navigator.userAgent)) return;
  const path = location.pathname.replace(/\/?$/, '/');
  if (!/^\/[a-z0-9/-]*$/.test(path) || path.length > 240) return;
  try {
    const key = `furkan-view-v1:${path}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch { /* Session storage is optional. */ }
  fetch(`${config.url.replace(/\/$/, '')}/rest/v1/site_page_views`, {
    method: 'POST',
    headers: { apikey: config.publishableKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ page_path: path }),
    keepalive: true,
  }).catch(() => {});
})();
