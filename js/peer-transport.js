'use strict';
/* PeerJS 1.5.5 is loaded ONLY after the user clicks an online action.
   See https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.HwatuPeer=api})(typeof window!=='undefined'?window:undefined,function(){
 const PEER_JS_URL='https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
 let promise=null;
 function load(){if(typeof window==='undefined')return Promise.reject(Error('PeerJS requires a browser'));if(window.Peer)return Promise.resolve(window.Peer);if(promise)return promise;promise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=PEER_JS_URL;s.async=true;s.onload=()=>window.Peer?resolve(window.Peer):reject(Error('PeerJS missing after load'));s.onerror=()=>reject(Error('PeerJS 1.5.5 다운로드 실패. 인터넷 연결을 확인하세요.'));document.head.append(s)});return promise}
 class PeerChannel{
  constructor(conn){this.conn=conn;this.messages=[];this.closeFns=[];conn.on('data',data=>this.messages.forEach(f=>f(data)));conn.on('close',()=>this.closeFns.forEach(f=>f()));conn.on('error',()=>this.closeFns.forEach(f=>f()))}
  onMessage(fn){this.messages.push(fn)}onClose(fn){this.closeFns.push(fn)}send(msg){if(!this.conn.open)return false;this.conn.send(msg);return true}close(){this.conn.close()}
 }
 async function openHost(code,onGuest){const Peer=await load();return new Promise((resolve,reject)=>{const peer=new Peer('hwatu-'+code,{debug:1});peer.on('open',()=>resolve(peer));peer.on('connection',conn=>{conn.on('open',()=>onGuest(new PeerChannel(conn)))});peer.on('error',err=>reject(err))})}
 async function openGuest(code){const Peer=await load();return new Promise((resolve,reject)=>{const peer=new Peer(undefined,{debug:1});peer.on('open',()=>{const conn=peer.connect('hwatu-'+code,{reliable:true,serialization:'json'});conn.on('open',()=>resolve({peer,channel:new PeerChannel(conn)}));conn.on('error',reject)});peer.on('error',reject)})}
 return{load,PeerChannel,openHost,openGuest,version:'1.5.5',url:PEER_JS_URL};
});
