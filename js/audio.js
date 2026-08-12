/* ============================================================
   音乐引擎：二选一选歌（薛之谦 / 方大同）+ 播放控制
   ============================================================ */
(function(){
  "use strict";
  const btn = document.getElementById("musicBtn");
  let ctx=null, master=null;
  let audioEl=null, playing=false, currentKey="";
  let scheduler=null, step=0, startedAmbient=false;

  const SCALE=[57,60,62,64,67,69,72,74,76,79];
  const CHORDS=[[57,60,64,67],[53,57,60,64],[52,55,59,62],[55,59,62,66]];
  function freq(m){ return 440*Math.pow(2,(m-69)/12); }
  function ensureCtx(){
    if(ctx) return;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return;
    ctx=new AC(); master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
  }
  function resumeCtx(){ ensureCtx(); if(ctx&&ctx.state==="suspended") ctx.resume(); }

  function note(m,t,dur,vol,type){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type||"sine"; o.frequency.value=freq(m);
    g.gain.setValueAtTime(.0001,t);
    g.gain.linearRampToValueAtTime(vol,t+.18);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.1);
  }
  function padChord(midis,t,dur){ for(const m of midis){ note(m,t,dur,.026,"sine"); note(m+12,t,dur,.012,"sine"); } }
  function arpeggio(midis,t,stepSec,vol){ for(let i=0;i<midis.length;i++) note(midis[i]+12,t+i*stepSec,1.6,vol,"triangle"); }
  function scheduleAmbient(){
    const BAR=7.4, t0=ctx.currentTime+.1;
    for(let i=0;i<4;i++){
      const ch=CHORDS[(step+i)%CHORDS.length], t=t0+i*BAR;
      padChord(ch,t,BAR*1.05); note(ch[0]-12,t,BAR*.9,.03,"sine");
      arpeggio(ch,t+.4,.9,.026);
    }
    step+=4;
  }
  function startAmbient(){
    ensureCtx(); if(!ctx) return; resumeCtx();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value,ctx.currentTime);
    master.gain.linearRampToValueAtTime(.13,ctx.currentTime+2);
    if(!scheduler){ scheduler=setInterval(()=>{ if(ctx.state==="running") scheduleAmbient(); },6200); scheduleAmbient(); }
    startedAmbient=true; playing=true; btn.classList.add("playing");
  }
  function stopAmbient(){
    if(ctx&&master){ master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value,ctx.currentTime); master.gain.linearRampToValueAtTime(.0001,ctx.currentTime+1); }
    if(scheduler){ clearInterval(scheduler); scheduler=null; }
    startedAmbient=false;
  }
  function stopFile(){
    if(audioEl){ audioEl.pause(); audioEl.currentTime=0; audioEl=null; }
  }

  function setPlayingUI(on){ playing=on; if(on) btn.classList.add("playing"); else btn.classList.remove("playing"); }

  const Engine = {
    get playing(){ return playing; },
    get currentKey(){ return currentKey; },
    /* 打开页面就预载默认歌曲，选完秒响 */
    warmup(){
      try{
        const def=SITE.songs&&SITE.songs.xue;
        if(!def||this.preloaded) return;
        const a=new Audio("assets/music/"+def.file);
        a.preload="auto"; a.volume=.72;
        this.preloaded=a; this.preloadedKey="xue";
        a.load();
      }catch(e){}
    },
    /* 选一首歌播放（选谁播谁，另一首自然不播） */
    playSong(key){
      const song=(SITE.songs&&SITE.songs[key]);
      if(!song) return;
      currentKey=key;
      stopAmbient(); stopFile();
      ensureCtx(); resumeCtx();
      /* 若已预载该歌，直接使用（秒响） */
      if(this.preloaded&&this.preloadedKey===key){
        audioEl=this.preloaded;
        audioEl.loop=true;
        audioEl.play().catch(()=>{});
      } else {
        audioEl=new Audio("assets/music/"+song.file);
        audioEl.loop=true; audioEl.volume=.72;
        audioEl.preload="auto";
        audioEl.play().catch(()=>{});
      }
      const fire=(st)=>{ try{ window.dispatchEvent(new CustomEvent("kxmusic",{detail:{state:st,key}})); }catch(e){} };
      audioEl.addEventListener("playing",()=>fire("playing"),{once:true});
      audioEl.addEventListener("error",()=>fire("error"),{once:true});
      audioEl.addEventListener("stalled",()=>{ /* 网络慢，等待即可 */ });
      setPlayingUI(true);
      fire("loading");
    },
    start(){ /* 恢复当前选择 */ if(currentKey){ this.playSong(currentKey); } else if(!playing){ startAmbient(); } },
    resume(){ if(currentKey&&audioEl){ audioEl.play().catch(()=>{}); setPlayingUI(true); } else if(startedAmbient){ resumeCtx(); setPlayingUI(true); } },
    pause(){
      if(audioEl){ audioEl.pause(); setPlayingUI(false); }
      else { stopAmbient(); setPlayingUI(false); }
    },
    toggle(){
      if(playing){ this.pause(); }
      else {
        if(currentKey&&audioEl){ audioEl.play().catch(()=>{}); setPlayingUI(true); }
        else if(currentKey){ this.playSong(currentKey); }
        else if(startedAmbient){ resumeCtx(); setPlayingUI(true); }
        else { startAmbient(); }
      }
    }
  };
  btn.addEventListener("click",e=>{ e.stopPropagation(); Engine.toggle(); });
  /* 页面加载后立即预载默认歌曲 */
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>Engine.warmup());
  else Engine.warmup();
  window.AudioEngine=Engine;
})();
