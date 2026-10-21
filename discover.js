(()=>{'use strict';
const button=document.getElementById('discover-button');if(!button)return;
let items=null,last=-1;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pop=document.createElement('div');pop.className='discover-popover';pop.id='discover-popover';pop.hidden=true;document.body.append(pop);
function position(){const r=button.getBoundingClientRect();pop.style.top=(r.bottom+10+scrollY)+'px';pop.style.right=Math.max(12,innerWidth-r.right)+'px'}
function render(item){
 pop.innerHTML='<div class="discover-head"><span>✦ RASTGELE KEŞİF</span><button type="button" aria-label="Kapat">×</button></div><div class="discover-type">'+esc(item.type)+'</div><h3>'+esc(item.title)+'</h3><p>'+esc(String(item.description||'').slice(0,260))+'</p><div class="discover-actions"><a href="'+esc(item.url)+'">Aç →</a><button type="button" data-again>Başka getir</button></div>';
 pop.hidden=false;position();
 pop.querySelector('.discover-head button').onclick=()=>pop.hidden=true;
 pop.querySelector('[data-again]').onclick=pick;
}
function pick(){
 if(!items?.length)return;
 let i=Math.floor(Math.random()*items.length);if(items.length>1&&i===last)i=(i+1)%items.length;last=i;render(items[i]);
}
button.addEventListener('click',async()=>{
 if(!items){button.disabled=true;try{const r=await fetch('/data/discover.json',{cache:'no-store'});items=await r.json()}catch{items=[]}finally{button.disabled=false}}
 if(items.length)pick();
});
addEventListener('resize',()=>{if(!pop.hidden)position()});
document.addEventListener('click',e=>{if(!pop.hidden&&!pop.contains(e.target)&&e.target!==button)pop.hidden=true});
})();