'use strict'
// Sound effects from assets/sounds/*.wav (user-supplied procedural set, see assets/sounds/README.md).
// Over http(s) the files are fetched once and decoded into Web Audio buffers: they play without delay and
// keep working on phones once the first touch/key has unlocked audio. file:// blocks fetch, so a plain
// <audio> element is used there instead.
;(()=>{
 const FILES={play:'01_card_play',stack:'02_card_stack',flip:'03_deck_flip',collect:'04_card_collect',turn:'05_your_turn',puk:'06_ppuk',pukRecovery:'07_ppuk_recovery',jjok:'08_jjok',ttadak:'09_ttadak',sweep:'10_sweep',steal:'11_steal_pi',shake:'12_shake',bomb:'13_bomb',tong:'14_chongtong',bonus:'15_bonus',deal:'16_deal',dealer:'17_choose_first',go1:'18_go_1',go2:'19_go_2',go3:'20_go_3',win:'21_stop_win',lose:'22_lose',nagari:'23_nagari',money:'24_money_transfer',settle:'25_final_settlement',button:'26_ui_button',warning:'27_dialog_warning',join:'28_user_join',leave:'29_user_leave',disconnect:'30_disconnect'}
 const AudioCtx=window.AudioContext||window.webkitAudioContext
 const webAudio=location.protocol!=='file:'&&!!AudioCtx&&!!window.fetch
 const url=name=>new URL('assets/sounds/'+FILES[name]+'.wav',document.baseURI).href
 let enabled=true,volume=.7,ctx=null,gain=null
 const raw={},buffers={}
 function decode(name){const bytes=raw[name];if(!bytes||!ctx)return;delete raw[name];ctx.decodeAudioData(bytes).then(buf=>{buffers[name]=buf}).catch(()=>{})}
 if(webAudio)for(const name of Object.keys(FILES))fetch(url(name)).then(r=>r.ok?r.arrayBuffer():null).then(bytes=>{if(!bytes)return;raw[name]=bytes;decode(name)}).catch(()=>{})
 // Browsers only allow audio after the user has touched the page, so the context is created on the first input.
 function unlock(){if(!webAudio)return;if(!ctx){try{ctx=new AudioCtx();gain=ctx.createGain();gain.gain.value=volume;gain.connect(ctx.destination);Object.keys(raw).forEach(decode)}catch(e){ctx=null;return}}if(ctx.state==='suspended')ctx.resume().catch(()=>{})}
 for(const type of ['pointerdown','touchend','keydown','click'])document.addEventListener(type,unlock,{capture:true,passive:true})
 function play(name,delay=0){if(!enabled||!FILES[name]||document.hidden)return
  if(webAudio){const buf=buffers[name];if(!ctx||ctx.state!=='running'||!buf)return;const src=ctx.createBufferSource();src.buffer=buf;src.connect(gain);src.start(ctx.currentTime+Math.max(0,delay)/1000);return}
  const el=new Audio(url(name));el.volume=volume;const go=()=>el.play().catch(()=>{});if(delay>0)setTimeout(go,delay);else go()}
 window.HwatuSfx={play,names:()=>Object.keys(FILES),url,
  setEnabled:value=>{enabled=!!value},
  setVolume:value=>{volume=Math.max(0,Math.min(1,value));if(gain)gain.gain.value=volume},
  status:()=>({webAudio,state:ctx?ctx.state:'none',loaded:Object.keys(buffers).length,total:Object.keys(FILES).length,enabled,volume})}
})()
