const DASHBOARD_STYLE_KEY='furkan-admin-dashboard-style';
function initDashboardStyle(){
 const welcome=document.querySelector('.admin-welcome[data-dashboard-style]');if(!welcome)return;
 let current='heritage';try{current=localStorage.getItem(DASHBOARD_STYLE_KEY)||current}catch{}
 const apply=style=>{if(!['heritage','emerald','burgundy'].includes(style))style='heritage';welcome.dataset.dashboardStyle=style;welcome.querySelectorAll('[data-dashboard-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dashboardTheme===style)));try{localStorage.setItem(DASHBOARD_STYLE_KEY,style)}catch{}};
 welcome.querySelectorAll('[data-dashboard-theme]').forEach(b=>b.addEventListener('click',()=>apply(b.dataset.dashboardTheme)));apply(current);
}
import { createAuth } from './modules/auth.js?v=20261005-widepdf';
import { createCategories } from './modules/categories.js?v=20261003-booknotes3';
import { createArticles } from './modules/articles.js?v=20261017-pastefix1';
import { createComments } from './modules/comments.js';
import { createStats } from './modules/stats.js';
import { createTheme } from './modules/theme.js';
import { initImages } from './modules/images.js';
import { initQuotePhotos } from './modules/quote-photos.js';
import { initNavigation } from './modules/navigation.js?v=20261017-notes1';

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

function initQuickNotes() {
  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const paragraphs = value => String(value).trim().split(/\n\s*\n/).map(p => '<p>'+escapeHtml(p).replace(/\n/g,'<br>')+'</p>').join('');
  const prepareEditor = (category, title, body) => {
    $('new-article').click();
    $('category').value = category;
    $('category').dispatchEvent(new Event('change',{bubbles:true}));
    $('title').value = title;
    $('description').value = body.trim().replace(/\s+/g,' ').slice(0,160);
    $('editor').innerHTML = paragraphs(body);
    $('generate-cover').checked = false;
    $('editor').dispatchEvent(new Event('input',{bubbles:true}));
  };
  const quoteTitle = body => {
    const clean=body.trim().replace(/\s+/g,' ');
    const words=clean.split(' ');
    return (words.slice(0,8).join(' ')+(words.length>8?'…':'')).slice(0,120);
  };
  async function quickPublish(kind, direct) {
    const isQuote=kind==='quote';
    const body=$(isQuote?'quick-quote-body':'quick-thought-body').value.trim();
    const title=isQuote?quoteTitle(body):$('quick-thought-title').value.trim();
    const status=$(isQuote?'quick-quote-status':'quick-thought-status');
    if(!body || !title){status.textContent=isQuote?'Önce sözünü yaz.':'Başlık ve not metni gerekli.';return;}
    prepareEditor(isQuote?'notlar/sozler':'notlar/dusunce-notlari',title,body);
    if(!direct){status.textContent='Gelişmiş editörde açıldı.';return;}
    status.textContent='Yayımlanıyor…';
    $('publish').click();
    const observer=new MutationObserver(()=>{
      const text=$('feedback').textContent||'';
      if(/kaydedildi|hata|gerekli|oluşturul/i.test(text)){
        status.textContent=text.includes('kaydedildi')?'Yayımlandı. ✓':text;
        if(text.includes('kaydedildi')){
          $(isQuote?'quick-quote-body':'quick-thought-body').value='';
          if(!isQuote)$('quick-thought-title').value='';
        }
        observer.disconnect();
      }
    });
    observer.observe($('feedback'),{childList:true,subtree:true,characterData:true});
  }
  $('quick-quote-publish')?.addEventListener('click',()=>quickPublish('quote',true));
  $('quick-quote-editor')?.addEventListener('click',()=>quickPublish('quote',false));
  $('quick-thought-publish')?.addEventListener('click',()=>quickPublish('thought',true));
  $('quick-thought-editor')?.addEventListener('click',()=>quickPublish('thought',false));
}
initQuickNotes();

async function showPanel() {
  await callAdmin('whoami');
  await theme.loadTheme();
  await categories.loadCategories();
  await articles.loadArticles();
  try {
    const { initBooks } = await import('./modules/books.js?v=20261018-isbn1');
    const books = initBooks({ $, callAdmin, feedback });
    await books.loadCategories();
    await books.loadLibrary();
  } catch (err) {
    console.error('Kitap yönetimi yüklenemedi:', err);
    const status = $('book-create-status');
    if (status) status.textContent = 'Kitap yönetimi yüklenemedi: ' + err.message;
  }
  try{const {initReadingDesk}=await import('./modules/reading-desk.js?v=20261014-six-designs');await initReadingDesk({$,callAdmin});}catch(e){$('desk-admin-status').textContent=e.message;}
  try{const {initSiteMusic}=await import('./modules/site-music.js?v=20261018-1');await initSiteMusic({$,callAdmin,feedback});}catch(e){const s=$('site-music-status');if(s)s.textContent=e.message;}
  try{const {initQuoteDesk}=await import('./modules/quote-desk.js?v=20261018-fix1');const quoteDesk=initQuoteDesk({$,callAdmin,feedback});await quoteDesk.load();}catch(e){const s=$('quote-entry-status');if(s)s.textContent=e.message;}
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
if (auth.signedIn) initDashboardStyle();
showPanel().catch(err => {
  auth.clear(); $('login-feedback').textContent = err.message;
});
