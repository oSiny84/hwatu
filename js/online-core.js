'use strict';
/* The same message protocol is used by in-process transport and PeerJS DataConnections.
   Only the host creates Game or reads the authoritative deck. */
(function(root,factory){let api=factory(typeof module!=='undefined'&&module.exports?require('./multi-engine.js'):root.Hwatu);if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.HwatuOnline=api})(typeof window!=='undefined'?window:undefined,function(Hwatu){
 const clone=x=>JSON.parse(JSON.stringify(x));
 // Korean particles for Hangul player names. Non-Hangul names use the no-final form.
 function withParticle(value,pair='이/가'){
  const name=String(value??'');const ch=name.codePointAt(name.length-1);
  const hasFinal=ch>=0xAC00&&ch<=0xD7A3&&(ch-0xAC00)%28!==0;
  const endings={'이/가':['이','가'],'은/는':['은','는'],'을/를':['을','를']};
  const choices=endings[pair];return name+(choices?choices[hasFinal?0:1]:'');
 }
 function secureToken(){let bytes;if(typeof globalThis!=='undefined'&&globalThis.crypto?.getRandomValues){bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes)}else if(typeof require==='function'){bytes=require('node:crypto').randomBytes(16)}else throw Error('Secure RNG unavailable');return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
 function roomCode(){return secureToken().slice(0,8).toUpperCase()}
 class MemoryEndpoint{
  constructor(){this.remote=null;this.handlers=[];this.closers=[];this.sent=[];this.closed=false}
  onMessage(f){this.handlers.push(f)}onClose(f){this.closers.push(f)}
  send(msg){if(this.closed)return false;const m=clone(msg);this.sent.push(m);const r=this.remote;queueMicrotask(()=>{if(!r.closed)r.handlers.forEach(f=>f(clone(m)))});return true}
  close(){if(this.closed)return;this.closed=true;this.closers.forEach(f=>f());if(this.remote&&!this.remote.closed)this.remote.close()}
 }
 function memoryPair(){const a=new MemoryEndpoint(),b=new MemoryEndpoint();a.remote=b;b.remote=a;return[a,b]}
 class RoomHost{
  constructor({players=3,code=roomCode(),name='방장',pointWon=100,bonus=true,missions=true,seed,timeout=0}={}){
   this.players=players===2?2:3;this.code=code;this.closed=false;this.initialWallet=Array(this.players).fill(100000);this.finishedRounds=0;this.nagariRounds=0;this.lastCountedRound=0;this.recharges=Array(this.players).fill(0);this.pauseNotice="";this.gameOptions={players:this.players,pointWon,bonus,missions, ...(seed===undefined?{}:{seed})};this.seats=Array.from({length:this.players},(_,i)=>i===0?{name,token:null,ai:false,connected:true}:{name:'빈자리',token:null,ai:false,connected:false});this.channels=new Map();this.game=null;this.version=0;this.paused=false;this.timeout=[0,30,60].includes(timeout)?timeout:0;this.deadline=0;this.onState=()=>{};this.onNotice=()=>{};
  }
  exportSession(){return clone({format:2,players:this.players,code:this.code,gameOptions:this.gameOptions,seats:this.seats.map(s=>({...s,connected:false})),state:this.game?.toJSON()||null,version:this.version,timeout:this.timeout,initialWallet:this.initialWallet,finishedRounds:this.finishedRounds,nagariRounds:this.nagariRounds,lastCountedRound:this.lastCountedRound,recharges:this.recharges,pauseNotice:this.pauseNotice})}
  static fromSession(saved){const h=new RoomHost({players:saved.players,code:saved.code,timeout:saved.timeout});h.gameOptions=clone(saved.gameOptions);h.seats=clone(saved.seats);h.seats[0].connected=true;for(let i=1;i<h.seats.length;i++)if(!h.seats[i].ai)h.seats[i].connected=false;h.initialWallet=saved.initialWallet||Array(h.players).fill(saved.gameOptions?.startMoney||100000);h.finishedRounds=saved.finishedRounds??Math.max(0,(saved.state?.round||0)-(saved.state?.phase==='ended'?0:1));h.nagariRounds=saved.nagariRounds??(saved.state?.records||[]).filter(x=>x.nagari).length;h.game=saved.state?Hwatu.Game.fromJSON(saved.state):null;h.lastCountedRound=saved.lastCountedRound??(h.game?.phase==='ended'?h.game.round:Math.max(0,(h.game?.round||1)-1));h.recharges=Array.isArray(saved.recharges)?saved.recharges.slice():Array(h.players).fill(0);h.pauseNotice=saved.pauseNotice||"";h.version=saved.version||0;h.paused=h.needsPeople();h.setDeadline();return h}
  needsPeople(){return this.seats.some((s,i)=>i>0&&!s.ai&&!s.connected&&(!!this.game||!!s.token))}
  recordCompletedRound(){if(!this.game||this.game.phase!=='ended'||this.game.round<=this.lastCountedRound)return false;this.lastCountedRound=this.game.round;this.finishedRounds++;if(this.game.result?.nagari)this.nagariRounds++;return true}
  setDeadline(){this.deadline=this.timeout&&this.game&&this.game.phase!=='ended'&&!this.paused?Date.now()+this.timeout*1000:0}
  attach(channel){channel.onMessage(msg=>this.receive(channel,msg));channel.onClose(()=>this.disconnect(channel))}
  receive(channel,msg){if(!msg||typeof msg!=='object'||Array.isArray(msg))return;if(msg.type==='join'){return this.join(channel,msg)}const seat=this.channels.get(channel);if(seat===undefined){channel.send({type:'reject',reason:'인증되지 않은 연결'});return}if(msg.type==='leave'){channel.send({type:'left'});return this.disconnect(channel,true)}if(msg.type==='action'){const a=msg.action;if(!a||typeof a!=='object'||a.player!==seat||a.type==='newRound'&&seat!==0){channel.send({type:'reject',reason:'자리 또는 권한 불일치'});return}if(!this.act(a,seat))channel.send({type:'reject',reason:'현재 차례 또는 규칙에 맞지 않음'});return}}
  notify(message){this.onNotice(message);for(const [channel] of this.channels)channel.send({type:'notice',message})}
  join(channel,msg){if(this.closed){channel.send({type:'reject',reason:'종료된 방'});return}if(msg.code!==this.code){channel.send({type:'reject',reason:'방 코드가 틀림'});return}let i=-1;const token=typeof msg.token==='string'?msg.token:'';if(token)i=this.seats.findIndex((s,j)=>j>0&&s.token===token&&!s.ai);if(i<0)i=this.seats.findIndex((s,j)=>j>0&&!s.token&&!s.ai);if(i<0){channel.send({type:'reject',reason:'빈자리가 없음'});return}const s=this.seats[i];const returning=!!s.token;if(s.token&&s.connected){const previous=[...this.channels].find(([,j])=>j===i);if(previous){this.channels.delete(previous[0]);previous[0].close()}}if(!s.token){s.token=secureToken();s.name=String(msg.name||`참가자 ${i}`).trim().slice(0,18)||`참가자 ${i}`}s.connected=true;this.channels.set(channel,i);channel.send({type:'welcome',seat:i,token:s.token,roomCode:this.code});this.paused=this.needsPeople();if(!this.paused)this.pauseNotice="";const started=this.tryStart();this.notify(`${withParticle(s.name)} ${returning?'다시 들어왔습니다':'들어왔습니다'} (${this.seats.filter((z,j)=>j===0||z.ai||z.connected).length}/${this.players})`);if(started)this.notify('모두 모였습니다 · 게임 시작');this.broadcast();}
  tryStart(){if(!this.game&&this.seats.every((s,i)=>i===0||s.ai||s.connected)){this.gameOptions.humanSeats=this.seats.flatMap((s,i)=>s.ai?[]:[i]);this.game=new Hwatu.Game(this.gameOptions);this.initialWallet=this.game.wallet.slice();this.version++;this.recordCompletedRound();this.setDeadline();return true}return false}
  disconnect(channel,voluntary=false){const i=this.channels.get(channel);if(i===undefined)return;this.channels.delete(channel);const name=this.seats[i].name;this.seats[i].connected=false;if(voluntary){this.seats[i]={name:'빈자리',token:null,ai:false,connected:false};this.pauseNotice=`${withParticle(name)} 나갔습니다 · 새로 들어오거나 방장이 AI로 채우면 계속`;}else this.pauseNotice=`${name} 연결 끊김 · 기다리는 중`;this.paused=this.needsPeople();this.setDeadline();this.notify(voluntary?`${withParticle(name)} 나갔습니다`:`${name} 연결 끊김 · 기다리는 중`);this.broadcast()}
  useAI(seat,{confirmKick=false}={}){
   if(!Number.isInteger(seat)||seat<=0||seat>=this.players)return false;
   const previous=this.seats[seat];if(previous.ai)return false;
   // A connected human cannot be displaced by the ordinary "fill empty seat" action.
   if(previous.connected&&!confirmKick)return false;
   const previousName=previous.name;
   const old=[...this.channels].find(([,i])=>i===seat)?.[0];
   if(old){
    // Send a terminal message before closing the transport. The guest closes it upon
    // receipt; a host-side fallback prevents a stale connection from remaining open.
    old.send({type:'removed',reason:'방장이 이 자리를 컴퓨터로 바꿨습니다'});
    this.channels.delete(old);
    setTimeout(()=>{try{old.close()}catch(e){}},900);
   }
   this.seats[seat]={name:`컴퓨터 ${seat}`,token:null,ai:true,connected:true};
   if(this.game){this.game.options.humanSeats=(this.game.options.humanSeats||[]).filter(i=>i!==seat)}
   if(this.gameOptions.humanSeats)this.gameOptions.humanSeats=this.gameOptions.humanSeats.filter(i=>i!==seat);
   this.paused=this.needsPeople();if(!this.paused)this.pauseNotice="";
   const started=this.tryStart();
   this.notify(previous.connected?`${withParticle(previousName,'을/를')} 내보내고 ${seat+1}번 자리를 AI로 바꿨습니다`:previous.token?`${previousName} 님의 ${seat+1}번 자리를 AI로 채웠습니다`:`${seat+1}번 자리를 AI로 채웠습니다`);
   if(started)this.notify('모두 모였습니다 · 게임 시작');this.broadcast();return true;
  }
  settlement(){const money=this.game?.wallet||this.initialWallet;return {type:'sessionEnded',roomCode:this.code,rounds:this.finishedRounds,nagari:this.nagariRounds,people:this.seats.map((s,i)=>({seat:i,name:s.name,initial:this.initialWallet[i],final:money[i],change:money[i]-this.initialWallet[i],recharge:s.ai?(this.recharges[i]||0):0})).sort((a,b)=>b.change-a.change||a.seat-b.seat)}}
  finishSession(){if(this.closed)return null;this.closed=true;const summary=this.settlement();this.notify('방장이 대국을 종료했습니다 · 최종 정산');for(const [ch] of this.channels){ch.send(summary);setTimeout(()=>{try{ch.close()}catch(e){}},900)}this.channels.clear();return summary}
  act(a,actor=0){if(this.closed||!this.game||this.paused)return false;if(!a||!Number.isInteger(a.player)||a.player!==actor)return false;if(a.type==='newRound'){if(actor!==0)return false} else if(a.player!==this.game.active)return false;
   const previous=this.game.toJSON();let ok=false;try{ok=this.game.dispatch(a)}catch(e){this.game=Hwatu.Game.fromJSON(previous);return false}if(!ok)return false;if(a.type==='newRound'){for(let i=0;i<this.players;i++){const increase=this.game.wallet[i]-previous.wallet[i];if(this.seats[i].ai&&increase>0)this.recharges[i]=(this.recharges[i]||0)+increase;}}this.version++;this.recordCompletedRound();this.setDeadline();this.broadcast();return true}
  timeoutStep(now=Date.now()){if(!this.timeout||!this.deadline||now<this.deadline||this.paused||!this.game||this.game.phase==='ended')return false;const a=this.game.aiAction();if(!a)return false;a.player=this.game.active;return this.act(a,a.player)}
  hostView(){if(!this.game)return null;return this.game.viewFor(0)}
  snapshot(seat){return{type:'snapshot',roomCode:this.code,seat,version:this.version,paused:this.paused,startingWallet:this.initialWallet.slice(),finishedRounds:this.finishedRounds,nagariRounds:this.nagariRounds,pauseNotice:this.pauseNotice,recharges:this.recharges.slice(),roster:this.seats.map(s=>({name:s.name,ai:s.ai,connected:s.connected})),timeout:this.timeout,deadline:this.deadline,view:this.game?this.game.viewFor(seat):null}}
  broadcast(){const own=this.snapshot(0);this.onState(clone(own));for(const[ch,seat]of this.channels)ch.send(this.snapshot(seat))}
 }
 class RoomClient{
  constructor({code,name='참가자',token=null}={}){this.code=code;this.name=name;this.token=token;this.seat=null;this.view=null;this.roster=[];this.version=0;this.paused=false;this.received=[];this.onState=()=>{};this.onWelcome=()=>{};this.onReject=()=>{};this.onNotice=()=>{};this.onRemoved=()=>{};this.onSessionEnded=()=>{};this.removed=false;this.channel=null}
  connect(channel){this.channel=channel;channel.onMessage(m=>this.receive(m));channel.onClose(()=>{if(this.removed)return;this.channel=null;this.paused=true;this.onState(this)});channel.send({type:'join',code:this.code,name:this.name,token:this.token})}
  leaveRoom(){if(!this.channel)return false;this.removed=true;this.channel.send({type:'leave'});return true}
  receive(msg){this.received.push(clone(msg));if(msg.type==='left'){this.removed=true;this.onRemoved('방에서 나갔습니다.');this.channel?.close();this.channel=null;return}if(msg.type==='sessionEnded'){this.removed=true;this.onSessionEnded(msg);this.channel?.close();this.channel=null;return}if(msg.type==='removed'){this.removed=true;this.seat=null;this.token=null;this.view=null;this.roster=[];this.onRemoved(String(msg.reason||'방장이 이 자리를 컴퓨터로 바꿨습니다'));this.channel?.close();this.channel=null;return}if(msg.type==='welcome'){this.seat=msg.seat;this.token=msg.token;this.onWelcome(this);return}if(msg.type==='reject'){this.onReject(msg.reason);return}if(msg.type==='notice'){this.onNotice(msg.message);return}if(msg.type==='snapshot'){this.view=msg.view;this.version=msg.version;this.roster=msg.roster;this.paused=msg.paused;this.timeout=msg.timeout;this.deadline=msg.deadline;this.startingWallet=msg.startingWallet;this.finishedRounds=msg.finishedRounds;this.nagariRounds=msg.nagariRounds;this.onState(this)}}
  act(action){if(this.seat===null||!this.channel)return false;return this.channel.send({type:'action',action:{...action,player:this.seat}})}
 }
 return{RoomHost,RoomClient,MemoryEndpoint,memoryPair,secureToken,roomCode,withParticle};
});
