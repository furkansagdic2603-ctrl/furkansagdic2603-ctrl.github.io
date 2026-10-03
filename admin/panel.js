import { createAuth } from './modules/auth.js';
import { createCategories } from './modules/categories.js?v=20261003-booknotes3';
import { createArticles } from './modules/articles.js?v=20261003-booknotes3';
import { createComments } from './modules/comments.js';
import { createStats } from './modules/stats.js';
import { createTheme } from './modules/theme.js';
import { initImages } from './modules/images.js';
import { initQuotePhotos } from './modules/quote-photos.js';
import { initNavigation } from './modules/navigation.js?v=20260930-panel1';

const $ = id => document.getElementById(id);
const navigation = initNavigation();
const feedback = message => { $('feedback').textContent = message; };
const auth = createAuth(window.COMMENTS_CONFIG);
const callAdmin = auth.callAdmin;
const categories = createCategories({ $, callAdmin, feedback });
const articles = createArticles({ $, callAdmin, feedback });
const comments = createComments({ $, callAdmin, getArticles: articles.getArticles });
const stats = createStats({ $, callAdmin, getArticles: articles.getArticles });
const theme = createTheme({ $, callAdmin });
initImages({ $, callAdmin, feedback });
initQuotePhotos({ $, callAdmin });

async function showPanel() {
  await callAdmin('whoami');
  await theme.loadTheme();
  await categories.loadCategories();
  await articles.loadArticles();
  try {
    const { initBooks } = await import('./modules/books.js?v=20261003-safe2');
    const books = initBooks({ $, callAdmin, feedback });
    await books.loadCategories();
    await books.loadLibrary();
  } catch (err) {
    console.error('Kitap yönetimi yüklenemedi:', err);
    const status = $('book-create-status');
    if (status) status.textContent = 'Kitap yönetimi yüklenemedi: ' + err.message;
  }
  navigation.updateCounts();
  navigation.showView('overview', false);
  $('admin-login').hidden = true;
  $('admin-panel').hidden = false;
  comments.fetchComments(true).catch(err => { $('comment-admin-status').textContent = err.message; });
  stats.fetchStats().catch(err => { $('stats-status').textContent = err.message; });
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  button.disabled = true;
  $('login-feedback').textContent = 'Giriş yapılıyor…';
  try {
    await auth.signIn(form.elements.namedItem('email').value, form.elements.namedItem('password').value);
    form.elements.namedItem('password').value = '';
    await showPanel();
    $('login-feedback').textContent = '';
  } catch (err) { $('login-feedback').textContent = err.message; }
  finally { button.disabled = false; }
});
$('logout').addEventListener('click', () => {
  auth.clear();
  $('admin-panel').hidden = true; $('admin-login').hidden = false;
});
if (auth.signedIn) showPanel().catch(err => {
  auth.clear(); $('login-feedback').textContent = err.message;
});
