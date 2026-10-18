(() => {
  const KEY='furkan-site-music';
  const state={volume:.12,muted:false,playing:false,source:'',title:'Sükûnet',track:0,position:0,startedAt:0,ctx:null,timer:null,audio:null};
  try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{}
  const currentPosition=()=>{if(state.source&&state.audio)return state.audio.currentTime||0;if(state.playing&&state.startedAt)return state.position+(performance.now()-state.startedAt)/1000;return state.position||0;};
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({volume:state.volume,muted:state.muted,track:state.track,position:currentPosition(),playing:state.playing,savedAt:Date.now()}))}catch{}};
  const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
  const root=document.createElement('aside');root.className='site-music';root.setAttribute('aria-label','Site müziği');
  root.innerHTML='<button class="site-music-main" type="button" aria-label="Müziği aç veya durdur"><span class="site-music-disc" aria-hidden="true"><i>♪</i></span><span class="site-music-copy"><small>MECLİSİN SESİ</small><strong>Sükûnet</strong></span><span class="site-music-bars" aria-hidden="true"><i></i><i></i><i></i></span></button><div class="site-music-panel"><button class="site-music-prev" type="button" aria-label="Önceki müzik">‹</button><button class="site-music-next" type="button" aria-label="Sonraki müzik">›</button><button class="site-music-mute" type="button" aria-label="Sesi kapat">♬</button><input class="site-music-volume" type="range" min="0" max="100" value="12" aria-label="Müzik sesi"><output>12%</output></div>';
  document.body.append(root);
  const main=root.querySelector('.site-music-main'),range=root.querySelector('.site-music-volume'),mute=root.querySelector('.site-music-mute'),prev=root.querySelector('.site-music-prev'),next=root.querySelector('.site-music-next'),out=root.querySelector('output'),title=root.querySelector('strong');
  const tracks=[{title:'Sükûnet',notes:[[293.66,0,4.8,.7],[440,1.7,4.2,.35],[369.99,4.4,5,.55],[329.63,7.8,4.8,.42],[493.88,10.8,4.5,.28],[369.99,13.8,5.5,.45]]},{title:'Gece Divanı',notes:[[220,0,5,.7],[329.63,2.1,4,.32],[277.18,4.8,5,.52],[246.94,8,4.5,.4],[369.99,11,4,.3],[277.18,14,5,.46]]},{title:'Eski Defter',notes:[[261.63,0,4.5,.62],[392,1.6,4,.28],[311.13,4.2,5,.55],[349.23,7.4,4.5,.34],[293.66,10.4,4.8,.5],[261.63,14,5,.38]]}];
  const sync=()=>{range.value=String(Math.round(state.volume*100));out.textContent=Math.round(state.volume*100)+'%';root.classList.toggle('is-playing',state.playing&&!state.muted);root.classList.toggle('is-muted',state.muted);mute.textContent=state.muted?'♩':'♬';if(state.audio){state.audio.volume=state.muted?0:state.volume;}};
  function stopProcedural(){if(state.timer){clearTimeout(state.timer);state.timer=null;}if(state.ctx){state.ctx.close().catch(()=>{});state.ctx=null;}}
  function tone(freq,when,duration,gain){const ctx=state.ctx;if(!ctx)return;const osc=ctx.createOscillator(),g=ctx.createGain(),filter=ctx.createBiquadFilter();osc.type='sine';osc.frequency.value=freq;filter.type='lowpass';filter.frequency.value=1200;g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),when+.35);g.gain.exponentialRampToValueAtTime(.0001,when+duration);osc.connect(filter).connect(g).connect(ctx.destination);osc.start(when);osc.stop(when+duration+.1);}
  function schedule(){if(!state.ctx||!state.playing)return;const now=state.ctx.currentTime+.08,base=(state.muted?0:state.volume)*.16;tracks[state.track%tracks.length].notes.forEach(([f,t,d,g])=>tone(f,now+t,d,base*g));state.timer=setTimeout(schedule,17500);}
  async function play(){
    if(state.source){if(!state.audio){state.audio=new Audio(state.source);state.audio.loop=true;state.audio.preload='auto';state.audio.currentTime=Math.max(0,state.position||0);}state.audio.volume=state.muted?0:state.volume;await state.audio.play();}
    else{if(!state.ctx){state.ctx=new (window.AudioContext||window.webkitAudioContext)();}if(state.ctx.state==='suspended')await state.ctx.resume();state.playing=true;state.startedAt=performance.now();schedule();sync();save();return;}
    state.playing=true;state.startedAt=performance.now();sync();save();
  }
  function pause(){state.position=currentPosition();state.startedAt=0;state.playing=false;if(state.audio)state.audio.pause();stopProcedural();sync();save();}
  function changeTrack(dir){const was=state.playing;pause();state.source='';state.audio=null;state.position=0;state.track=(state.track+dir+tracks.length)%tracks.length;state.title=tracks[state.track].title;title.textContent=state.title;save();if(was)play().catch(()=>{});}
  prev.addEventListener('click',()=>changeTrack(-1));
  next.addEventListener('click',()=>changeTrack(1));
  main.addEventListener('click',()=>state.playing?pause():play().catch(()=>{}));
  range.addEventListener('input',()=>{state.volume=clamp(range.value/100);state.muted=false;save();sync();if(state.playing&&!state.source){pause();play().catch(()=>{});}});
  mute.addEventListener('click',()=>{state.muted=!state.muted;save();sync();if(state.playing&&!state.source){pause();play().catch(()=>{});}});
  fetch('/data/site-music.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(cfg=>{if(!cfg)return;state.source=cfg.src||'';state.title=cfg.title||tracks[state.track].title;title.textContent=state.source?state.title:tracks[state.track].title;if(Number.isFinite(cfg.defaultVolume)&&!localStorage.getItem(KEY))state.volume=clamp(cfg.defaultVolume);sync();}).catch(()=>{});
  sync();
  // Persist playback across normal page navigations. A browser reload destroys the
  // audio element, so restore the same track and timeline on the next page.
  let restored=null;try{restored=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
  if(restored){state.track=Math.max(0,Number(restored.track)||0)%tracks.length;state.position=Math.max(0,Number(restored.position)||0);if(restored.playing&&restored.savedAt)state.position+=(Date.now()-Number(restored.savedAt))/1000;title.textContent=state.source?state.title:tracks[state.track].title;}
  addEventListener('pagehide',()=>{save();},{capture:true});
  // Browsers block audible autoplay. Start softly on the visitor's first interaction.
  const awaken=()=>{if(!state.playing)play().catch(()=>{});removeEventListener('pointerdown',awaken,true);removeEventListener('keydown',awaken,true);};
  addEventListener('pointerdown',awaken,true);addEventListener('keydown',awaken,true);
})();