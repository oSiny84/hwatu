'use strict';
/* The same message protocol is used by in-process transport and PeerJS DataConnections.
   Only the host creates Game or reads the authoritative deck. */
(function(root,factory){let api=factory(typeof module!=='undefined'&&module.exports?require('./multi-engine.js'):root.Hwatu);if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.HwatuOnline=api})(typeof window!=='undefined'?window:undefined,function(Hwatu){
 const clone=x=>JSON.parse(JSON.stringify(x));
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
   this.players=players===2?2:3;this.code=code;this.gameOptions={players:this.players,pointWon,bonus,missions, ...(seed===undefined?{}:{seed})};this.seats=Array.from({length:this.players},(_,i)=>i===0?{name,token:null,ai:false,connected:true}:{name:'빈자리',token:null,ai:false,connected:false});this.channels=new Map();this.game=null;this.version=0;this.paused=false;this.timeout=[0,30,60].includes(timeout)?timeout:0;this.deadline=0;this.onState=()=>{};this.onNotice=()=>{};
  }
  exportSession(){return clone({format:2,players:this.players,code:this.code,gameOptions:this.gameOptions,seats:this.seats.map(s=>({...s,connected:false})),state:this.game?.toJSON()||null,version:this.version,timeout:this.timeout})}
  static fromSession(saved){const h=new RoomHost({players:saved.players,code:saved.code,timeout:saved.timeout});h.gameOptions=clone(saved.gameOptions);h.seats=clone(saved.seats);h.seats[0].connected=true;for(let i=1;i<h.seats.length;i++)if(!h.seats[i].ai)h.seats[i].connected=false;h.game=saved.state?Hwatu.Game.fromJSON(saved.state):null;h.version=saved.version||0;h.paused=h.seats.some((s,i)=>i>0&&s.token&&!s.ai&&!s.connected);h.setDeadline();return h}
  setDeadline(){this.deadline=this.timeout&&this.game&&this.game.phase!=='ended'&&!this.paused?Date.now()+this.timeout*1000:0}
  attach(channel){channel.onMessage(msg=>this.receive(channel,msg));channel.onClose(()=>this.disconnect(channel))}
  receive(channel,msg){if(!msg||typeof msg!=='object'||Array.isArray(msg))return;if(msg.type==='join'){return this.join(channel,msg)}const seat=this.channels.get(channel);if(seat===undefined){channel.send({type:'reject',reason:'인증되지 않은 연결'});return}if(msg.type==='action'){const a=msg.action;if(!a||typeof a!=='object'||a.player!==seat||a.type==='newRound'&&seat!==0){channel.send({type:'reject',reason:'자리 또는 권한 불일치'});return}if(!this.act(a,seat))channel.send({type:'reject',reason:'현재 차례 또는 규칙에 맞지 않음'});return}}
  join(channel,msg){if(msg.code!==this.code){channel.send({type:'reject',reason:'방 코드가 틀림'});return}let i=-1;const token=typeof msg.token==='string'?msg.token:'';if(token)i=this.seats.findIndex((s,j)=>j>0&&s.token===token&&!s.ai);if(i<0)i=this.seats.findIndex((s,j)=>j>0&&!s.token&&!s.ai);if(i<0){channel.send({type:'reject',reason:'빈자리가 없음'});return}const s=this.seats[i];if(s.token&&s.connected){const previous=[...this.channels].find(([,j])=>j===i);if(previous){this.channels.delete(previous[0]);previous[0].close()}}if(!s.token){s.token=secureToken();s.name=String(msg.name||`참가자 ${i}`).trim().slice(0,18)||`참가자 ${i}`}s.connected=true;this.channels.set(channel,i);channel.send({type:'welcome',seat:i,token:s.token,roomCode:this.code});this.paused=this.seats.some((seat,j)=>j>0&&seat.token&&!seat.ai&&!seat.connected);this.tryStart();this.broadcast();}
  tryStart(){if(!this.game&&this.seats.every((s,i)=>i===0||s.ai||s.connected)){this.gameOptions.humanSeats=this.seats.flatMap((s,i)=>s.ai?[]:[i]);this.game=new Hwatu.Game(this.gameOptions);this.version++;this.setDeadline()}}
  disconnect(channel){const i=this.channels.get(channel);if(i===undefined)return;this.channels.delete(channel);this.seats[i].connected=false;if(this.game?.phase!=='ended'){this.paused=true;this.onNotice(`${this.seats[i].name} 연결 끊김`)}this.broadcast()}
  useAI(seat){if(!Number.isInteger(seat)||seat<=0||seat>=this.players)return false;const old=[...this.channels].find(([,i])=>i===seat);if(old)this.channels.delete(old[0]);this.seats[seat]={name:`컴퓨터 ${seat}`,token:null,ai:true,connected:true};if(this.game){this.game.options.humanSeats=(this.game.options.humanSeats||[]).filter(i=>i!==seat)}if(this.gameOptions.humanSeats)this.gameOptions.humanSeats=this.gameOptions.humanSeats.filter(i=>i!==seat);this.paused=this.seats.some((s,i)=>i>0&&s.token&&!s.ai&&!s.connected);this.tryStart();this.broadcast();return true}
  act(a,actor=0){if(!this.game||this.paused)return false;if(!a||!Number.isInteger(a.player)||a.player!==actor)return false;if(a.type==='newRound'){if(actor!==0)return false} else if(a.player!==this.game.active)return false;
   const previous=this.game.toJSON();let ok=false;try{ok=this.game.dispatch(a)}catch(e){this.game=Hwatu.Game.fromJSON(previous);return false}if(!ok)return false;this.version++;this.setDeadline();this.broadcast();return true}
  timeoutStep(now=Date.now()){if(!this.timeout||!this.deadline||now<this.deadline||this.paused||!this.game||this.game.phase==='ended')return false;const a=this.game.aiAction();if(!a)return false;a.player=this.game.active;return this.act(a,a.player)}
  hostView(){if(!this.game)return null;return this.game.viewFor(0)}
  snapshot(seat){return{type:'snapshot',roomCode:this.code,seat,version:this.version,paused:this.paused,roster:this.seats.map(s=>({name:s.name,ai:s.ai,connected:s.connected})),timeout:this.timeout,deadline:this.deadline,view:this.game?this.game.viewFor(seat):null}}
  broadcast(){const own=this.snapshot(0);this.onState(clone(own));for(const[ch,seat]of this.channels)ch.send(this.snapshot(seat))}
 }
 class RoomClient{
  constructor({code,name='참가자',token=null}={}){this.code=code;this.name=name;this.token=token;this.seat=null;this.view=null;this.roster=[];this.version=0;this.paused=false;this.received=[];this.onState=()=>{};this.onWelcome=()=>{};this.onReject=()=>{};this.channel=null}
  connect(channel){this.channel=channel;channel.onMessage(m=>this.receive(m));channel.onClose(()=>{this.paused=true;this.onState(this)});channel.send({type:'join',code:this.code,name:this.name,token:this.token})}
  receive(msg){this.received.push(clone(msg));if(msg.type==='welcome'){this.seat=msg.seat;this.token=msg.token;this.onWelcome(this);return}if(msg.type==='reject'){this.onReject(msg.reason);return}if(msg.type==='snapshot'){this.view=msg.view;this.version=msg.version;this.roster=msg.roster;this.paused=msg.paused;this.timeout=msg.timeout;this.deadline=msg.deadline;this.onState(this)}}
  act(action){if(this.seat===null||!this.channel)return false;return this.channel.send({type:'action',action:{...action,player:this.seat}})}
 }
 return{RoomHost,RoomClient,MemoryEndpoint,memoryPair,secureToken,roomCode};
});
