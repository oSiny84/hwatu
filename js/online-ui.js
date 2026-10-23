'use strict';
/* Browser controls for the authoritative RoomHost + seat-specific RoomClient. */
(()=>{
 const $=id=>document.getElementById(id),C=Hwatu.card,Online=HwatuOnline;
 let peer=null,host=null,client=null,seat=0,snapshot=null,selected=null,running=false,aiTimer=null,lastVersion=-1;
 const names=()=>snapshot?.roster||[];
 const fmt=n=>Number(n||0).toLocaleString('ko-KR');
 const style=()=>{try{return JSON.parse(localStorage.getItem('hwatu_config_v8'))?.style||'item-default'}catch(e){return 'item-default'}};
 const setupLook=()=>{document.documentElement.style.setProperty('--online-ratio',String(ASSET_MANIFEST.styles[style()].ratio));let cfg={};try{cfg=JSON.parse(localStorage.getItem('hwatu_config_v8'))||{}}catch(e){}const board=cfg.board==='navy'?'navy':'green';document.querySelector('.surface').style.backgroundImage=`linear-gradient(#0b2b2788,#0b2b2788),url("${new URL('assets/boards/'+board+'.webp',document.baseURI).href}")`};
 const cardSrc=id=>id>=48?`assets/bonus/${style()}/${id===48?4:id===49?5:6}.webp`:`assets/cards/${style()}/${String(id).padStart(2,'0')}.webp`;
 const backSrc=()=>{let cfg={};try{cfg=JSON.parse(localStorage.getItem('hwatu_config_v8'))||{}}catch(e){}return `assets/backs/${style()}/${cfg.back||1}.webp`};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const notice=(s,error=false)=>{const el=$('status');el.textContent=s;el.classList.toggle('error',error);$('logMessage').textContent=s};
 function makeCard(id,click,back=false){const b=document.createElement('button');b.className='card'+(back?' back':'');b.type='button';if(back){b.style.backgroundImage=`url('${new URL(backSrc(),document.baseURI).href}')`;b.setAttribute('aria-label','비공개 화투패');b.disabled=true;}else{const img=document.createElement('img');img.src=cardSrc(id);img.alt=id>=48?'보너스패':`${C[id].month}월 화투패`;b.append(img);if(click)b.onclick=click;else b.disabled=true}return b}
 const cardName=id=>id>=48?(id===50?'삼피':'보너스 쌍피'):`${C[id].month}월 ${({bright:'광',animal:'열끗',ribbon:'띠',pi:'피'})[C[id].type]}`;
 function send(action){if(!snapshot||snapshot.paused){notice('대국이 일시 정지되어 있습니다.');return}const who=seat;if(client){client.act(action)}else if(host){const a={...action,player:who};if(!host.act(a,who))notice('지금은 그 행동을 할 수 없습니다.',true)}selected=null}
 function choose(type,extra={},label='선택'){const b=document.createElement('button');b.textContent=label;b.onclick=()=>send({type,...extra});$('choices').append(b)}
 function render(){if(!snapshot)return;setupLook();const {view,paused,roster,roomCode,timeout,deadline}=snapshot;seat=snapshot.seat;
 $('roomTitle').textContent=`방 코드 ${roomCode} · ${roster.length}인 ${roster.length===3?'고스톱':'맞고'}`;
 $('roomInfo').textContent=paused?'연결 끊김 · 대국 일시 정지':view?(view.phase==='ended'?'판 종료':`${roster[view.active]?.name||'참가자'} 차례`):'참가자 기다리는 중';
 $('roster').replaceChildren();roster.forEach((s,i)=>{const d=document.createElement('div');d.className='seat'+(!s.connected?' offline':'');d.textContent=`${i+1}번 ${s.name} ${s.ai?'(AI)':s.connected?'●':'○'} ${i===seat?'· 나':''}`;$('roster').append(d)});
 $('shareUrl').value=urlForRoom(roomCode);$('shareUrl').parentElement.hidden=!host;$('room').hidden=false;$('lobby').hidden=true;
 $('hostControls').hidden=!host;
 if(host){for(const b of $('hostControls').querySelectorAll('[data-ai]')){const i=Number(b.dataset.ai);b.hidden=i>=roster.length||roster[i].ai;b.disabled=!roster[i].ai&&roster[i].connected}}
 if(!view){$('turnTitle').textContent='참가자가 모두 입장하면 시작합니다.';$('oppArea').replaceChildren();$('fieldArea').replaceChildren();$('myHand').replaceChildren();$('captured').replaceChildren();$('choices').replaceChildren();$('pileCount').textContent='';return}
 $('turnTitle').textContent=view.phase==='ended'?'대국 결과':paused?'연결을 기다리는 중':`${roster[view.active]?.name||'참가자'} 차례`;
 const opp=$('oppArea');opp.replaceChildren();for(let i=0;i<roster.length;i++){if(i===seat)continue;const block=document.createElement('div');block.className='opponent';const title=document.createElement('h3');title.textContent=`${roster[i].name} · ${view.hands[i].count}장 · ${Hwatu.totalScore(view.caps[i],view.cup[i]).total}점 · ${view.wallet[i].toLocaleString()}원`;block.append(title);const faces=document.createElement('div');faces.className='opponentHand';for(let j=0;j<view.hands[i].count;j++)faces.append(makeCard(null,null,true));block.append(faces);opp.append(block)}
 const table=$('fieldArea');table.replaceChildren();view.field.forEach(id=>{const b=makeCard(id,view.phase==='choice'&&view.pending?.who===seat&&view.pending.options.includes(id)?()=>send({type:'pickFloor',cardId:id}):null);if(view.pending?.options?.includes(id))b.classList.add('matched');table.append(b)});
 $('pileCount').textContent=`더미 ${view.deck.count}장 · 바닥 ${view.field.length}장`;
 $('myStats').textContent=`${roster[seat].name} · ${view.wallet[seat].toLocaleString()}원 · ${Hwatu.totalScore(view.caps[seat],view.cup[seat]).total}점`;
 const hand=$('myHand');hand.replaceChildren();const cards=view.hands[seat]||[];for(const id of cards){const enabled=!paused&&view.phase==='play'&&view.active===seat;const b=makeCard(id,enabled?()=>{if(selected===id){send({type:'play',cardId:id})}else{selected=id;render()}}:null);if(selected===id)b.classList.add('select');if(view.field.some(fid=>C[fid].month===C[id].month)&&id<48)b.classList.add('matched');b.title=cardName(id);hand.append(b)}
 const caps=$('captured');caps.replaceChildren();for(const id of view.caps[seat])caps.append(makeCard(id,null));
 const actions=$('choices');actions.replaceChildren();if(paused){const d=document.createElement('div');d.className='result';d.textContent='다른 참가자의 재접속을 기다리는 중입니다. 방장은 끊긴 자리를 AI로 전환할 수 있습니다.';actions.append(d);return}
 if(view.phase==='ended'){const r=view.result||{};const d=document.createElement('div');d.className='result';d.textContent=r.nagari?'나가리':`${roster[r.winner]?.name||'참가자'} 승리 · ${r.common}점 · ${(r.breakdown||[]).join(' · ')} / ${(r.payments||[]).map(p=>`${roster[p.actualPayer].name} ${fmt(p.paid)}원 지급`).join(', ')}`;actions.append(d);if(host)choose('newRound',{},'다음 판 시작');return}
 if(view.phase==='dealer'){if(seat===0){for(let i=0;i<12;i++)choose('dealer',{index:i},`${i+1}번 뒷면`)}else actions.textContent='방장이 첫 판 선을 정하고 있습니다.';return}
 if(view.active!==seat){actions.textContent='다른 참가자 차례입니다.';return}
 if(view.phase==='go'){choose('go',{},'고');choose('stop',{},'스톱');return}
 if(view.phase==='cup'){choose('gookjin',{asPi:false},'국진 열끗');choose('gookjin',{asPi:true},'국진 쌍피');return}
 if(view.phase==='tong'){choose('tong',{stop:true},'총통 스톱');choose('tong',{stop:false},'계속');return}
 if(view.phase==='choice'){view.pending?.options?.forEach((id,i)=>choose('pickFloor',{cardId:id},`${i+1}. ${cardName(id)}`));return}
 if(view.phase==='play'){if(view.skip[seat]||!cards.length)choose('flip',{},'더미 뒤집기');else{if(selected!==null)choose('play',{cardId:selected},`${cardName(selected)} 내기`);choose('bomb',{},'폭탄');choose('shake',{},'흔들기')}}
 }
 function saveHost(){if(host){try{localStorage.setItem('hwatu_online_host_v1',JSON.stringify(host.exportSession()))}catch(e){notice('저장소가 비활성화되어 방 복구가 제한됩니다.',true)}}}
 function hostState(s){snapshot=s;render();saveHost();clearTimeout(aiTimer);if(host?.game&&!host.paused){const p=host.game.active;if(host.game.phase==='play'||host.game.phase==='go'||host.game.phase==='cup'||host.game.phase==='choice'||host.game.phase==='tong'){if(host.seats[p]?.ai){aiTimer=setTimeout(()=>{if(!host||host.paused)return;const a=host.game.aiAction();if(a){a.player=p;host.act(a,p)}},650)}}}}
 function urlForRoom(code){const u=new URL('online.html',document.baseURI);u.searchParams.set('room',code);return u.href}
 async function createRoom(recover=false){try{notice('PeerJS 신호 서버에 연결 중...');if(recover){const saved=JSON.parse(localStorage.getItem('hwatu_online_host_v1'));host=Online.RoomHost.fromSession(saved)}else{host=new Online.RoomHost({players:Number($('players').value),name:$('nickname').value||'방장'})}host.onState=hostState;host.onNotice=txt=>notice(txt);peer=await HwatuPeer.openHost(host.code,channel=>host.attach(channel));$('shareUrl').value=urlForRoom(host.code);$('turnLimit').value=String(host.timeout);$('roomCode').value=host.code;host.broadcast();notice(`방 ${host.code} 생성 완료. 입장 링크를 공유하세요.`)}catch(e){notice('방 만들기 실패: '+e.message,true);host=null}}
 async function joinRoom(){const code=$('roomCode').value.trim().toUpperCase();if(!/^[0-9A-F]{8}$/.test(code)){notice('방 코드 8자리를 입력하세요.',true);return}try{notice('방에 접속하는 중...');const connection=await HwatuPeer.openGuest(code);peer=connection.peer;const saved=JSON.parse(localStorage.getItem('hwatu_online_seat_'+code)||'null');client=new Online.RoomClient({code,name:$('nickname').value||'가족',token:saved?.token||null});client.onWelcome=c=>{localStorage.setItem('hwatu_online_seat_'+code,JSON.stringify({token:c.token,seat:c.seat}));notice(`${c.seat+1}번 자리로 입장했습니다.`)};client.onState=c=>{snapshot={roomCode:code,seat:c.seat,view:c.view,roster:c.roster,paused:c.paused,timeout:c.timeout,deadline:c.deadline};render()};client.onReject=err=>notice('입장 거부: '+err,true);client.connect(connection.channel)}catch(e){notice('입장 실패: '+e.message,true)}}
 $('create').onclick=()=>createRoom(false);$('resume').onclick=()=>createRoom(true);$('join').onclick=joinRoom;$('copyLink').onclick=async()=>{try{await navigator.clipboard.writeText($('shareUrl').value);notice('입장 링크 복사됨')}catch(e){$('shareUrl').select();notice('링크를 선택했으니 복사하세요.')}};
 $('hostControls').querySelectorAll('[data-ai]').forEach(b=>b.onclick=()=>host?.useAI(Number(b.dataset.ai)));
 $('turnLimit').onchange=()=>{if(host){host.timeout=Number($('turnLimit').value);host.setDeadline();host.broadcast()}};
 setInterval(()=>{if(host)host.timeoutStep();const d=snapshot?.deadline;$('timer').textContent=d&&snapshot?.timeout?`남은 시간 ${Math.max(0,Math.ceil((d-Date.now())/1000))}초`:''},1000);
 const existing=localStorage.getItem('hwatu_online_host_v1');if(existing){try{const saved=JSON.parse(existing);if(saved?.code)$('resume').hidden=false}catch(e){}}
 const query=new URLSearchParams(location.search);if(query.has('room'))$('roomCode').value=query.get('room').toUpperCase();
 window.__hwatuOnlineDev={host:()=>host,client:()=>client,state:()=>snapshot,render};
})();
