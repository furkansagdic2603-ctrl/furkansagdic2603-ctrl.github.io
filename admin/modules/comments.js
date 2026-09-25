// Comment listing, searching, pagination, and deletion.
export function createComments({ $, callAdmin, getArticles }) {
  let managedComments = [];
  let commentOffset = 0;
  function renderComments() {
    const query = $('comment-search').value.trim().toLocaleLowerCase('tr');
    const visible = managedComments.filter(item => `${item.first_name} ${item.last_name} ${item.body} ${item.page_path}`.toLocaleLowerCase('tr').includes(query));
    const container = $('comment-admin-list');
    container.replaceChildren();
    for (const item of visible) {
      const row = document.createElement('article'); row.className = 'comment-admin-item';
      const header = document.createElement('header');
      const name = document.createElement('strong'); name.textContent = `${item.first_name} ${item.last_name}`;
      const time = document.createElement('time'); time.dateTime = item.created_at; time.textContent = new Date(item.created_at).toLocaleString('tr-TR');
      header.append(name, time);
      const body = document.createElement('p'); body.textContent = item.body;
      const page = document.createElement('a');
      const article = getArticles().find(entry => entry.url === item.page_path);
      page.href = /^\/[a-z0-9/-]+\/$/.test(item.page_path) ? item.page_path : '/arsiv/';
      page.textContent = article ? `Yazı: ${article.title} →` : `Yazı: ${item.page_path} →`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Yorumu sil';
      remove.addEventListener('click', async () => {
        if (prompt(`“${item.first_name} ${item.last_name}” yorumunu silmek için SİL yaz:`) !== 'SİL') return;
        remove.disabled = true;
        try {
          await callAdmin('delete_comment', { id: item.id });
          managedComments = managedComments.filter(comment => comment.id !== item.id);
          renderComments();
          $('comment-admin-status').textContent = 'Yorum silindi.';
        } catch (err) { $('comment-admin-status').textContent = err.message; remove.disabled = false; }
      });
      row.append(header, body, page, document.createTextNode(' '), remove);
      container.append(row);
    }
    if (!visible.length) container.textContent = query ? 'Eşleşen yorum yok.' : 'Henüz yorum yok.';
    $('comment-admin-status').textContent = `${visible.length} yorum gösteriliyor (${managedComments.length} yorum yüklendi).`;
  }
  async function fetchComments(reset = false) {
    if (reset) { commentOffset = 0; managedComments = []; }
    $('comment-admin-status').textContent = 'Yorumlar yükleniyor…';
    const data = await callAdmin('list_comments', { offset: commentOffset });
    managedComments.push(...data.comments);
    commentOffset += data.comments.length;
    $('more-comments').hidden = data.comments.length < 100;
    renderComments();
  }
  $('comment-search').addEventListener('input', renderComments);
  $('refresh-comments').addEventListener('click', () => fetchComments(true).catch(err => { $('comment-admin-status').textContent = err.message; }));
  $('more-comments').addEventListener('click', () => fetchComments().catch(err => { $('comment-admin-status').textContent = err.message; }));
  return { fetchComments };
}
