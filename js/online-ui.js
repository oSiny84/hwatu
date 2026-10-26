'use strict';
/* Online orchestration only. The actual table, cards, keyboard and animations are js/ui.js. */
(()=>{
 const $=id=>document.getElementById(id),Online=HwatuOnline;
 let host=null,client=null,peer=null,current=null,snapshot=null,aiTimer=null,aiTicket=0,retryTimer=null,retryCount=0,reconnecting=false,manualDisconnect=false;
 const STORAGE_NAME='hwatu_online_name_v2';
 const normalizeCode=s=>String(s||'').trim().toUpperCase();
 function announce(msg,bad=false){$('status').textContent=msg;$('status').style.color=bad?'#ffa8a8':'';if(snapshot){$('roomInfo').textContent=msg}}
 function saveName(){const name=$('nickname').value.trim().slice(0,18)||'가족';localStorage.setItem(STORAGE_NAME,name);return name}
 const urlForRoom=code=>{const u=new URL('online.html',document.baseURI);u.searchParams.set('room',code);return u.href};
 function renderRoom(s){snapshot=s;if(!s)return;$('onlineLobby').hidden=true;$('onlineRoom').hidden=false;
  const roster=s.roster||[];$('roomTitle').textContent=`${s.roomCode} · ${roster.length}인`;
  $('roomInfo').textContent=s.paused?'대국 일시 정지':s.view?`${roster[s.view.active]?.name||'참가자'} 차례`:'입장 기다리는 중';
  $('shareUrl').value=urlForRoom(s.roomCode);$('hostControls').hidden=!host;
  $('roster').replaceChildren();for(let i=0;i<roster.length;i++){const r=roster[i],row=document.createElement('div');row.textContent=`${i+1}번 ${r.name} ${r.ai?'(AI)':r.connected?'●':'○'} ${s.seat===i?'· 나':''}`;$('roster').append(row)}
  for(const b of $('hostControls').querySelectorAll('[data-ai]')){const i=Number(b.dataset.ai);if(i>=roster.length){b.hidden=true;continue}b.hidden=roster[i].ai;b.disabled=!!roster[i].connected&&!roster[i].ai}
  if(s.view){HwatuUI.updateOnline(s,action=>host?host.act(action,0):client?.act(action));}
 }
 function saveHost(){if(host){try{localStorage.setItem('hwatu_online_host_v1',JSON.stringify(host.exportSession()))}catch(e){announce('브라우저 저장소 사용 불가',true)}}}
 function nextAI(s){const ticket=++aiTicket;clearTimeout(aiTimer);if(!host?.game||host.paused||host.game.phase==='ended')return;const p=host.game.active;
  if(host.seats[p]?.ai){Promise.resolve(HwatuUI.whenIdle()).then(()=>{
   if(ticket!==aiTicket||!host?.game||host.paused||host.game.active!==p)return;
   aiTimer=setTimeout(()=>{if(ticket!==aiTicket||!host?.game||host.paused||host.game.active!==p)return;
    const action=host.game.aiAction();if(action){action.player=p;host.act(action,p)}},120);
  })}}
 function onHostState(s){renderRoom(s);if(s.roster?.every((r,i)=>i===0||r.ai||r.connected)){$('status').textContent=`방 ${s.roomCode} 연결됨`;$('status').style.color='';}saveHost();nextAI(s)}
 function newHost(saved){host=saved?Online.RoomHost.fromSession(saved):new Online.RoomHost({players:Number($('players').value),name:saveName()});host.onState=onHostState;host.onNotice=msg=>announce(msg);return host}
 async function createRoom(resume=false){try{cancelRetry();announce('방을 연결하고 있습니다...');const saved=resume?JSON.parse(localStorage.getItem('hwatu_online_host_v1')):null;const h=newHost(saved);peer=await HwatuPeer.openHost(h.code,ch=>h.attach(ch));$('roomCode').value=h.code;$('turnLimit').value=String(h.timeout);h.broadcast();announce(`방 ${h.code} 생성 완료`)}catch(e){host=null;announce('방 만들기 실패: '+e.message,true)}}
 const getSaved=(code)=>{try{return JSON.parse(localStorage.getItem('hwatu_online_seat_'+code)||'null')}catch(e){return null}};
 function scheduleRetry(){if(manualDisconnect||host||retryTimer||!current)return;const delay=Math.min(9000,1800+retryCount*1400);retryCount++;announce('방장 연결 끊김 · 다시 연결 중');retryTimer=setTimeout(()=>{retryTimer=null;joinRoom(true)},delay)}
 function cancelRetry(){clearTimeout(retryTimer);retryTimer=null;retryCount=0;reconnecting=false}
 async function joinRoom(auto=false){const code=normalizeCode($('roomCode').value);if(!/^[0-9A-F]{8}$/.test(code)){if(!auto)announce('방 코드 8자리를 입력하세요.',true);return}if(reconnecting)return;reconnecting=true;current=code;manualDisconnect=false;saveName();if(!auto)announce('방에 접속하는 중...');
  try{const connection=await HwatuPeer.openGuest(code);const oldPeer=peer;peer=connection.peer;if(oldPeer&&oldPeer!==peer){try{oldPeer.destroy()}catch(e){}}
   const saved=getSaved(code);client=new Online.RoomClient({code,name:$('nickname').value.trim()||'가족',token:saved?.token||null});const currentClient=client;
   client.onWelcome=c=>{if(c!==client)return;const returning=!!saved?.token;localStorage.setItem('hwatu_online_seat_'+code,JSON.stringify({token:c.token,seat:c.seat,name:$('nickname').value.trim()}));cancelRetry();announce(`${c.seat+1}번 자리로 ${returning?'재입장':'입장'}했습니다.`)};
   client.onState=c=>{if(c!==client)return;if(!c.view&&c.paused){scheduleRetry();return}renderRoom({roomCode:code,seat:c.seat,view:c.view,version:c.version,roster:c.roster,paused:c.paused,timeout:c.timeout,deadline:c.deadline})};
   client.onReject=reason=>{announce('입장 거부: '+reason,true);if(/빈자리|코드/.test(reason))manualDisconnect=true;else scheduleRetry()};
   connection.channel.onClose(()=>{if(currentClient!==client)return;scheduleRetry()});
   client.connect(connection.channel);
  }catch(e){announce('방장 연결 끊김 · 다시 연결 중 ('+e.message+')',true);scheduleRetry()}finally{reconnecting=false}
 }
 const fromUrl=normalizeCode(new URLSearchParams(location.search).get('room'));if(fromUrl)$('roomCode').value=fromUrl;
 $('nickname').value=localStorage.getItem(STORAGE_NAME)||'가족';
 $('nickname').onchange=saveName;
 $('create').onclick=()=>createRoom(false);$('resume').onclick=()=>createRoom(true);$('join').onclick=()=>joinRoom(false);
 $('reconnect').onclick=()=>{cancelRetry();joinRoom(false)};$('onlineReconnect').onclick=()=>{cancelRetry();if(host)host.broadcast();else joinRoom(false)};
 $('copyLink').onclick=async()=>{try{await navigator.clipboard.writeText($('shareUrl').value);announce('입장 링크 복사 완료')}catch(e){$('shareUrl').select();announce('주소를 선택했어. 복사해 줘.')}};
 $('roomToggle').onclick=()=>{const e=$('roomExpanded');e.hidden=!e.hidden;$('roomToggle').setAttribute('aria-expanded',String(!e.hidden))};
 $('hostControls').querySelectorAll('[data-ai]').forEach(b=>b.onclick=()=>host?.useAI(Number(b.dataset.ai)));
 $('turnLimit').onchange=()=>{if(host){host.timeout=Number($('turnLimit').value);host.setDeadline();host.broadcast()}};
 setInterval(()=>{host?.timeoutStep();const d=snapshot?.deadline;$('timer').textContent=d&&snapshot?.timeout?`${Math.max(0,Math.ceil((d-Date.now())/1000))}초`:''},1000);
 try{if(JSON.parse(localStorage.getItem('hwatu_online_host_v1')||'null')?.code)$('resume').hidden=false}catch(e){}
 if(fromUrl&&getSaved(fromUrl)?.token){announce('저장된 자리로 자동 재접속 중');setTimeout(()=>joinRoom(true),50)}
 window.__hwatuOnlineDev={host:()=>host,client:()=>client,state:()=>snapshot,render:()=>renderRoom(snapshot),join:joinRoom};
})();
