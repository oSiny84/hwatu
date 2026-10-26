'use strict';
(()=>{
 const $=id=>document.getElementById(id), C=Hwatu.card, STYLE={"item-default":"전통","item-2":"전통 위트","item-3":"네온"},BACK=['','빨강','무광 검정','남금','비단','빈티지','홀로그램'];
 const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch(e){return fallback}};
 let opts={style:'item-default',back:'1',backCustom:false,board:'green',speed:'normal',pointWon:100,startMoney:100000,bonus:true,missions:true,aiLevels:['normal','normal'],...load('hwatu_config_v8',{})};
 let tapSelected=null, mobileCapsOpen=true;let online=document.body.dataset.online==='true',mySeat=0,onlineSnapshot=null,onlineSend=null,lastOnlineVersion=-1,onlinePaused=false,onlineQueue=[],onlineProcessing=false,onlineIdleWaiters=[],lastEnqueuedVersion=-1;let mode=2,g=null,locked=false,skip=false,focus=0,keyboardCursor=false,dlgFocus=0,menu=false,history=[],aiHandle=null,roundHistory=[],flashTimer=null,settingIndex=0,freshTaken={},walletSeen=null,walletFlashTimers=[null,null,null],previousTurnKey=null,pendingTurnCallout=null;
 let offlineStartWallet=null,sessionHandlers={finish:null,leave:null},settlementVisible=false,settlementClose=null,settlementInert=[],confirmOpen=false;
 const subject=name=>window.HwatuOnline?.withParticle?.(name,'이/가')||name+'가';
 const names=()=>online&&onlineSnapshot?.roster?onlineSnapshot.roster.map((r,i)=>i===mySeat?'나':r.name):(mode===2?['나','컴퓨터']:['나','컴퓨터 A','컴퓨터 B']);
 const opponentSeats=()=>Array.from({length:mode},(_,i)=>i).filter(i=>i!==mySeat);
 const visualSlot=w=>w===mySeat?0:opponentSeats().indexOf(w)+1;
 const makeFacade=view=>{const v=JSON.parse(JSON.stringify(view));v.hands=v.hands.map(h=>Array.isArray(h)?h:Array(h.count).fill(null));v.deck=Array(v.deck.count);v.count=w=>Hwatu.totalScore(v.caps[w],v.cup[w]);v.compute=w=>v.estimates?.[w]||{breakdown:[],perPayer:[]};return v};
 const displayView=()=>{if(!g)return null;const original=online?onlineSnapshot?.view:g.viewFor(0);if(!original)return null;const v=JSON.parse(JSON.stringify(original));v.hands=v.hands.map((h,i)=>Array.isArray(h)?h:Array(h.count).fill(null));v.deck=Array(v.deck.count);v.count=w=>Hwatu.totalScore(v.caps[w],v.cup[w]);v.compute=w=>v.estimates?.[w]||{breakdown:[],perPayer:[]};return v};
 const touchUI=()=>window.matchMedia&&window.matchMedia('(pointer:coarse)').matches;
 function touchLabels(){if(!touchUI())return;const labels={playBtn:'패 내기',flipBtn:'뒤집기',bombBtn:'폭탄',shakeBtn:'흔들기',goBtn:'고',stopBtn:'스톱',nextBtn:g?.phase==='ended'?'다음 판':'새 판',historyBtn:'기록',configBtn:'설정'};for(const [id,value] of Object.entries(labels))$(id).textContent=value;const hint=$('hint');if(hint)hint.textContent=g?.phase==='go'?'고 또는 스톱을 선택':g?.phase==='choice'?'바닥패 고르기':g?.phase==='cup'?'국진 종류 선택':g?.skip?.[0]>0?'더미를 눌러 뒤집기':'손패를 두 번 눌러 내기';$('keyHelp').textContent=''}
 const save=()=>localStorage.setItem('hwatu_config_v8',JSON.stringify(opts));
 const asset=id=>id>=48?`assets/bonus/${opts.style}/${id===48?4:id===49?5:6}.webp`:`assets/cards/${opts.style}/${String(id).padStart(2,'0')}.webp`;
 const back=()=>`assets/backs/${opts.style}/${opts.back}.webp`;
 const format=n=>Number(n||0).toLocaleString('ko-KR');
 const koreanCardType=id=>id>=48?(id===50?'삼피':'쌍피'):{bright:'광',animal:id===29?'열끗(기러기)':'열끗',ribbon:({red:'홍단',blue:'청단',green:'초단'})[C[id].ribbon]||'비띠',pi:([41,47].includes(id)?'쌍피':'피')}[C[id].type]||'패';
 function applyTheme(){const ratio=ASSET_MANIFEST.styles[opts.style].ratio;const root=document.documentElement;root.style.setProperty('--ratio',String(ratio));root.style.setProperty('--board-image',`url("${new URL('assets/boards/'+opts.board+'.webp',document.baseURI).href}")`);root.style.setProperty('--back-image',`url("${new URL(back(),document.baseURI).href}")`);$('styleSelect').value=opts.style;$('backSelect').value=opts.back;$('boardSelect').value=opts.board;$('speedSelect').value=opts.speed;save()}
 function themeUpdate(field,value){opts[field]=value;if(field==='style'&&!opts.backCustom){opts.back=({'item-default':'1','item-2':'4','item-3':'6'})[value]}if(field==='back')opts.backCustom=true;applyTheme();render()}
 function button(id,click,idx){const b=document.createElement('button');b.type='button';b.className='card'+(id===null?' back':'');if(id!==null){b.dataset.cardId=String(id);const im=document.createElement('img');im.src=asset(id);im.alt=(id>=48?'보너스':C[id].month+'월 '+C[id].type);b.append(im)}if(idx!==undefined){let span=document.createElement('span');span.className='index';span.textContent=idx===9?'0':idx+1;b.append(span)}if(click)b.addEventListener('click',click);else b.disabled=true;return b}
 function capt(w,v,slot=w){const area=$('cap'+slot);if(!area)return;area.replaceChildren();for(const tp of ['bright','animal','ribbon','pi']){const wrap=document.createElement('div');wrap.className='capGroup';const label=document.createElement('span');label.className='capLabel';label.textContent=({bright:'광',animal:'열끗',ribbon:'띠',pi:'피'})[tp];wrap.append(label);const box=document.createElement('span');box.className='capCards';v.caps[w].filter(id=>(v.cup[w].includes(id)?'pi':C[id].type)===tp).forEach(id=>{const im=document.createElement('img');im.src=asset(id);im.title=id>=48?'보너스':C[id].month+'월 '+tp;box.append(im)});wrap.append(box);area.append(wrap)}}
 function showMoney(slot,w,view){const score=$('score'+slot);if(!score)return;score.replaceChildren();const pts=document.createElement('span');pts.className='scorePoints';pts.textContent=view.count(w).total+'점';const cash=document.createElement('strong');cash.className='moneyValue';cash.textContent=format(view.wallet[w])+'원';score.append(cash,pts)}
 function updateWalletFlashes(v){const key=(online?'online-':'offline-')+mode+'-'+mySeat;
  if(!walletSeen||walletSeen.key!==key||walletSeen.amounts.length!==v.wallet.length){walletSeen={key,amounts:v.wallet.slice()};return}
  for(let w=0;w<mode;w++){const diff=v.wallet[w]-walletSeen.amounts[w];if(!diff)continue;const slot=visualSlot(w),el=$('walletDelta'+slot);if(!el)continue;clearTimeout(walletFlashTimers[slot]);el.textContent=(diff>0?'+':'−')+format(Math.abs(diff))+'원';el.classList.toggle('gain',diff>0);el.classList.add('visible');walletFlashTimers[slot]=setTimeout(()=>el.classList.remove('visible'),2400)}walletSeen.amounts=v.wallet.slice();}
 function updateTurnDisplay(v){for(let slot=0;slot<3;slot++)$('playerInfo'+slot)?.classList.remove('turnActive');const name=names()[v.active]||'참가자';$('activeLabel').textContent=v.phase==='ended'?'대국 종료':name+' 차례';
  if(v.phase!=='ended')$('playerInfo'+visualSlot(v.active))?.classList.add('turnActive');
  const key=v.phase==='play'?mode+'-'+v.active:null;
  if(key&&previousTurnKey!==null&&key!==previousTurnKey)pendingTurnCallout=name+' 차례';
  if(key)previousTurnKey=key;
  if(!locked&&pendingTurnCallout){callout(pendingTurnCallout,850);pendingTurnCallout=null;}
 }
 function render(){clearLanded();if(!g)return;const v=displayView();if(!v)return;applyTheme();$('modeBtn').textContent=mode===2?(touchUI()?'2인 맞고':'2인 맞고 (M 전환)'):(touchUI()?'3인 고스톱':'3인 고스톱 (M 전환)');$('name1').textContent=names()[opponentSeats()[0]]||'컴퓨터';$('enemyB').classList.toggle('hide',mode===2);
 showMoney(0,mySeat,v);
 for(let slot=1;slot<3;slot++){const player=opponentSeats()[slot-1];const handEl=$('hand'+slot);handEl.replaceChildren();if(player===undefined)continue;const nameEl=$('name'+slot);if(nameEl)nameEl.textContent=names()[player];showMoney(slot,player,v);for(const _ of v.hands[player])handEl.append(button(null));capt(player,v,slot)}capt(mySeat,v,0);
  const field=$('field');field.replaceChildren();const shown=new Set();for(const id of v.field){const m=C[id].month,pk=v.puks[m];if(pk&&v.field.filter(z=>C[z].month===m).length===3){if(shown.has(m))continue;shown.add(m);const el=document.createElement('div');el.className='puk';v.field.filter(x=>C[x].month===m).forEach(x=>el.append(button(x,()=>chooseField(x))));const label=document.createElement('b');label.className='pukLabel';label.textContent=pk.who===mySeat?'내 뻑':names()[pk.who]+' 뻑';el.append(label);field.append(el)}else{const el=button(id,()=>chooseField(id));if(keyboardCursor&&v.active===mySeat&&v.phase==='play'&&v.hands[mySeat][focus]!==undefined&&C[id].month===C[v.hands[mySeat].slice().sort((a,b)=>C[a].month-C[b].month||a-b)[focus]].month)el.classList.add('floorTarget');field.append(el)}}
 const oldChoice=document.getElementById('choiceFloat');if(oldChoice)oldChoice.remove();if(v.phase==='choice'&&v.pending?.kind==='hand'&&v.pending.who===mySeat){const ghost=document.createElement('img');ghost.id='choiceFloat';ghost.className='choiceFloat';ghost.src=asset(v.pending.id);field.append(ghost)}$('fieldCount').textContent=v.field.length+'장';$('deckCount').textContent='더미 '+v.deck.length+'장';updateTurnDisplay(v);updateWalletFlashes(v);
 const hand=$('hand0');hand.replaceChildren();const sortedHand=v.hands[mySeat].slice().sort((a,b)=>C[a].month-C[b].month||a-b);sortedHand.forEach((id,i)=>{const el=button(id,()=>tapCard(id),i);if(keyboardCursor&&focus===i&&v.phase==='play'&&v.active===mySeat)el.classList.add('current');if(opts.badges!==false&&id<48&&v.field.some(x=>C[x].month===C[id].month))el.classList.add('matchable');hand.append(el)});
 $('handCount').textContent=v.hands[mySeat].length+'장';$('wallet').textContent=`나 ${format(v.wallet[mySeat])}원 · ${format(opts.pointWon)}원/점`;$('hint').textContent=v.phase==='go'?'고·스톱 선택':v.phase==='choice'?'바닥 1 / 2 선택':v.phase==='cup'?'국진 1 열끗 / 2 쌍피':v.skip[mySeat]>0?'Enter · 뒤집기':'숫자키 1~9 / 0';
 const canAct=v.phase==='play'&&v.active===mySeat&&!onlinePaused;const hm=v.hands[mySeat].filter(id=>id!==null).map(id=>C[id]?.month);const canBomb=hm.some(m=>m&&hm.filter(x=>x===m).length>= (mode===2?2:3)&&v.field.filter(id=>C[id].month===m).length===(mode===2&&hm.filter(x=>x===m).length===2?2:1));const canShake=hm.some(m=>m&&hm.filter(x=>x===m).length===3&&!v.field.some(id=>C[id].month===m)&&!v.shake[mySeat].includes(m));$('bombBtn').disabled=!canAct||!canBomb;$('shakeBtn').disabled=!canAct||!canShake;$('goBtn').disabled=onlinePaused||v.phase!=='go'||v.active!==mySeat;$('stopBtn').disabled=$('goBtn').disabled;$('flipBtn').disabled=onlinePaused||v.phase!=='play'||v.active!==mySeat||v.skip[mySeat]===0&&v.hands[mySeat].length>0;$('deck').classList.toggle('flash',v.phase==='play'&&v.active===mySeat&&(v.skip[mySeat]>0||v.hands[mySeat].length===0));$('playBtn').disabled=onlinePaused||v.phase!=='play'||v.active!==mySeat;$('nextBtn').textContent=v.phase==='ended'?'Enter 다음 판':'R 새 판';if(v.phase==='ended')$('keyHelp').textContent='Enter 다음 판 · Q 그만하기 · Tab 버튼 선택';$('nextBtn').hidden=online&&v.phase!=='ended';$('nextBtn').disabled=online&&(mySeat!==0||v.phase!=='ended');
 if(v.phase!=='ended')$('keyHelp').textContent=v.phase==='play'&&v.skip[mySeat]>0&&v.active===mySeat?'Enter · Space : 더미 뒤집기':'1~9/0 패 · ←→ Enter 선택 · G/S 고/스톱 · Esc 설정';updateHistory();touchLabels();if(!locked)showPhaseDialog();}
 function updateHistory(){$('historyBody').replaceChildren();for(const t of history.slice(0,8)){const row=document.createElement('div');row.className='logEntry';row.textContent=t;$('historyBody').append(row)}}
 function setMessage(s){$('message').textContent=s}
 function callout(s,ms=700){const el=$('callout');clearTimeout(flashTimer);el.textContent=s;el.classList.add('active');flashTimer=setTimeout(()=>el.classList.remove('active'),ms)}
 const openDialog=(title,desc,actions)=>{const prev=document.activeElement;const oldIndex=prev?.closest('#dialogBtns')?Array.from($('dialogBtns').children).indexOf(prev):-1;const wasHidden=$('overlay').classList.contains('hide');if(touchUI()){desc=desc.replace(/숫자 1~9, 0\(10번\), -\(11번\), =\(12번\) 또는 방향키 Enter/g,'카드를 터치해서 선택하세요').replace(/↑ ↓ 항목 이동 · ← → 값 변경 · Enter 완료/g,'항목을 터치하여 값을 변경하세요').replace(/1 또는 2를 선택하세요/g,'원하는 카드를 터치하세요');actions=actions.map(a=>({...a,text:a.text.replace(/^(?:Enter|Esc|G|S|B|H|C|R|L|1|2) · /,'')}))}const d=$('overlay');d.classList.remove('hide');$('dialogTitle').textContent=title;$('dialogDetail').innerHTML=desc;$('dialogBtns').replaceChildren();actions.forEach((a,i)=>{const b=document.createElement('button');b.textContent=a.text;b.classList.toggle('focus',i===dlgFocus);b.onclick=()=>a.fn();$('dialogBtns').append(b)});const btns=Array.from($('dialogBtns').querySelectorAll('button'));if(btns.length&&(wasHidden||oldIndex>=0)){dlgFocus=Math.min(Math.max(0,oldIndex),btns.length-1);btns[dlgFocus].focus({preventScroll:true})}};
 const closeDialog=()=>$('overlay').classList.add('hide');
 function showSettlement(summary,onClose){
  closeDialog();settlementVisible=true;settlementClose=null;
  let panel=$('sessionSettlement');if(!panel){panel=document.createElement('section');panel.id='sessionSettlement';panel.className='sessionSettlement';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');document.body.append(panel)}
  panel.replaceChildren();panel.hidden=false;settlementInert=Array.from(document.body.children).filter(e=>e!==panel).map(e=>[e,e.inert]);for(const [e] of settlementInert)e.inert=true;
  const title=document.createElement('h2');title.textContent=summary.partial?'잠정 정산 · 마지막 수신 기준':'최종 정산';panel.append(title);
  const count=document.createElement('p');count.className='sessionCount';count.textContent=`총 ${summary.rounds||0}판 · 나가리 ${summary.nagari||0}회 · 가상 게임머니`;panel.append(count);
  const people=(summary.people||[]).slice().sort((a,b)=>(b.change-(b.recharge||0))-(a.change-(a.recharge||0))||a.seat-b.seat);
  for(const person of people){const row=document.createElement('div');row.className='sessionPerson';const name=document.createElement('b');name.textContent=person.name;const balance=document.createElement('span');balance.textContent=`${format(person.initial)}원 → ${format(person.final)}원`;const net=person.change-(person.recharge||0);const gain=document.createElement('strong');gain.className='sessionChange'+(net>0?' win':net<0?' loss':'');gain.textContent=(net>0?'+':net<0?'−':'±')+format(Math.abs(net))+'원';row.append(name,balance,gain);if(person.recharge){const recharge=document.createElement('small');recharge.className='sessionRecharge';recharge.textContent=`자동 충전 +${format(person.recharge)}원 포함 · 충전 포함 ${person.change>0?'+':person.change<0?'−':'±'}${format(Math.abs(person.change))}원 · 위 손익은 충전 제외`;row.append(recharge)}panel.append(row)}
  const end=document.createElement('button');end.textContent=online?'온라인 첫 화면으로':'새 대국 시작';settlementClose=()=>{if(!settlementVisible)return;panel.hidden=true;settlementVisible=false;for(const [el,value] of settlementInert)el.inert=value;settlementInert=[];settlementClose=null;onClose?.()};end.onclick=settlementClose;panel.append(end);end.focus({preventScroll:true});
 }
 function quitOffline(){if(!g||g.phase!=='ended')return;const original=offlineStartWallet||Array(mode).fill(opts.startMoney),rounds=g.round||0;showSettlement({rounds,nagari:g.records.filter(x=>x.nagari).length,people:g.wallet.map((amount,seat)=>({seat,name:names()[seat],initial:original[seat],final:amount,change:amount-original[seat]}))},()=>startGame(mode))}
 function quitSession(){if(online){sessionHandlers.finish?.()}else quitOffline()}

 function showPhaseDialog(){if(menu)return;const v=displayView();if(!v)return;if(v.phase==='dealer'){if(v.active!==mySeat){closeDialog();setMessage(online?`${subject(names()[v.active])} 선 정하기 패를 고르는 중입니다.`:'상대가 선 정하기 패를 고르고 있습니다.');return}dlgFocus=0;const cards=Array.from({length:12},(_,i)=>({text:`${i+1}번 🎴`,fn:()=>perform({type:'dealer',player:mySeat,index:i})}));openDialog('첫 판 선 정하기','뒷면 12장 중 하나를 선택하세요. 월은 선택한 뒤 공개됩니다.<p>숫자 1~9, 0(10번), -(11번), =(12번) 또는 방향키 Enter</p>',cards);return}
 if(v.phase==='tong'&&v.active===mySeat){openDialog('총통!','같은 월 4장 · 7점 스톱 또는 계속 ×4',[{text:'S · 총통 스톱',fn:()=>perform({type:'tong',player:mySeat,stop:true})},{text:'C · 계속',fn:()=>perform({type:'tong',player:mySeat,stop:false})}]);return}
 if(v.phase==='go'&&v.active===mySeat){const s=v.compute(mySeat);openDialog('고 · 스톱 선택',`현재 ${v.count(mySeat).total}점 · 스톱 계산 ${s.perPayer.map(x=>x.points).join(' / ')}점<br>점수 내역: ${s.breakdown.join(' · ')}<br>스톱 예상 금액: ${s.perPayer.map(x=>format(x.points*opts.pointWon)+'원').join(' / ')}<br>점당 ${format(opts.pointWon)}원 · 더미 ${v.deck.length}장<br>고 선언 시 +1점, 3고부터 배수 적용`,[{text:'G · 고',fn:()=>perform({type:'go',player:mySeat})},{text:'S · 스톱',fn:()=>perform({type:'stop',player:mySeat})}]);return}
 if(v.phase==='cup'&&v.active===mySeat){openDialog('국진 선택','9월 국진을 열끗 또는 쌍피로 분류해 주세요',[{text:'1 · 열끗',fn:()=>perform({type:'gookjin',player:mySeat,asPi:false})},{text:'2 · 쌍피',fn:()=>perform({type:'gookjin',player:mySeat,asPi:true})}]);return}
 if(v.phase==='choice'&&v.pending?.who===mySeat){openDialog('바닥패 선택','같은 월 바닥패가 두 장입니다. 1 또는 2를 선택하세요.',v.pending.options.map((id,i)=>({text:`${i+1} · ${C[id].month}월 ${koreanCardType(id)}`,fn:()=>perform({type:'pickFloor',cardId:id})})));return}
 if(v.phase==='ended'){let r=v.result||{},details=r.nagari?'나가리 · 다음 판 '+v.nextNari+'배':`승자: ${(r.names||names())[r.winner]}<br>점수: ${r.common}점<br>점수 내역: ${(r.breakdown||[]).join(' · ')}<br>${(r.payments||[]).map(x=>`${(r.names||names())[x.actualPayer]} → ${(r.names||names())[r.winner]}: ${(x.reasons||[]).join(' · ')} ${x.reasons?.length?'→ ':''}기본 계산액 ${format(x.nominalDue)}원${x.exemptReason?' → '+x.exemptReason:''} → 실제 이동 ${format(x.paid)}원`).join('<br>')}`;openDialog('대국 결과',details,online&&mySeat!==0?[{text:'방장이 다음 판을 시작합니다',fn:()=>closeDialog()},{text:'방 나가기',fn:()=>sessionHandlers.leave?.()}]:[{text:'Enter · 다음 판',fn:()=>perform({type:'newRound',player:mySeat})},{text:'Q · 그만하기 · 정산',fn:quitSession},{text:'Esc · 설정',fn:()=>settings()}]);return}closeDialog()}
 const settingList=[
  {label:'게임 모드',get:()=>mode===2?'2인 맞고':'3인 고스톱', values:[2,3],apply:v=>startGame(v)},
  {label:'앞면 스타일',get:()=>STYLE[opts.style],values:['item-default','item-2','item-3'],key:'style'},
  {label:'카드 뒷면',get:()=>opts.back+' '+BACK[+opts.back],values:['1','2','3','4','5','6'],key:'back'},
  {label:'화투판',get:()=>opts.board==='green'?'녹색':'남색',values:['green','navy'],key:'board'},
  {label:'애니메이션',get:()=>({slow:'느림',normal:'보통',quick:'빠름',off:'끔'})[opts.speed],values:['slow','normal','quick','off'],key:'speed'},
  {label:'점당 금액',get:()=>format(opts.pointWon)+'원',values:[10,50,100,500,1000,5000,10000],key:'pointWon'},
  {label:'패 매칭 표시',get:()=>opts.badges===false?'끔':'켬',values:[true,false],key:'badges'},
  {label:'컴퓨터 A 난이도',get:()=>opts.aiLevels[0],values:['easy','normal','hard'],key:'ai0'},
  {label:'컴퓨터 B 난이도',get:()=>opts.aiLevels[1],values:['easy','normal','hard'],key:'ai1'},
  {label:'보너스패',get:()=>opts.bonus?'켬':'끔',values:[true,false],key:'bonus'},
  {label:'각패 미션(2인)',get:()=>opts.missions?'켬':'끔',values:[true,false],key:'missions'}
 ];
 function adjustSetting(delta){const s=settingList[settingIndex];const current=s.key==='ai0'?opts.aiLevels[0]:s.key==='ai1'?opts.aiLevels[1]:s.key?opts[s.key]:mode;const at=Math.max(0,s.values.indexOf(current));const v=s.values[(at+delta+s.values.length)%s.values.length];if(s.apply){confirmDiscard(`${modeLabel(v)} 바꿀까요?`,`${modeLabel(v)} 바꾸기`,()=>{s.apply(v);menu=true;applyTheme();renderSettings();save()},()=>{menu=true;renderSettings()});return}else if(s.key==='ai0'||s.key==='ai1'){opts.aiLevels[s.key==='ai0'?0:1]=v;g.options.aiLevels=opts.aiLevels.slice();}else{opts[s.key]=v;if(s.key==='back')opts.backCustom=true;if(s.key==='style'&&!opts.backCustom)opts.back=({'item-default':'1','item-2':'4','item-3':'6'})[v];if(s.key==='pointWon')g.options.pointWon=v;}
  applyTheme();renderSettings();save()}
 function renderSettings(){const image=(src,width)=>`<img src="${new URL(src,document.baseURI).href}" style="width:${width}px;height:auto;max-height:84px;object-fit:contain;border-radius:4px" alt="미리보기">`;
 const preview=`<div class="settingPreview">${image(asset(0),52)}${image(back(),52)}${image('assets/boards/'+opts.board+'.webp',112)}</div>`;
 const rows=settingList.map((it,i)=>`<div class="settingRow ${settingIndex===i?'settingActive':''}" data-setting-i="${i}"><span>${it.label}</span><b>${it.get()}</b></div>`).join('');
 openDialog('게임 설정',`<p>↑ ↓ 항목 이동 · ← → 값 변경 · Enter 완료</p>${rows}${preview}<small>점당 금액·보너스·미션 설정은 다음 판부터 적용될 수 있습니다.</small>`,[{text:'Enter · 완료',fn:()=>{menu=false;closeDialog();render()}},{text:'모드 전환',fn:()=>{menu=false;switchMode()}}]);
 document.querySelectorAll('[data-setting-i]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.settingI);if(settingIndex===i)adjustSetting(1);else{settingIndex=i;renderSettings()}})
 }
 function settings(){menu=true;settingIndex=0;renderSettings()}
 function playCard(id){if(locked||menu||g.active!==mySeat||g.phase!=='play')return;tapSelected=null;keyboardCursor=false;perform({type:'play',player:mySeat,cardId:id})}
 function tapCard(id){if(!window.matchMedia('(pointer:coarse)').matches){playCard(id);return;}if(locked||menu||g.phase!=='play'||g.active!==mySeat)return;if(tapSelected===id){playCard(id);return;}tapSelected=id;focus=g.hands[mySeat].slice().sort((a,b)=>C[a].month-C[b].month||a-b).indexOf(id);keyboardCursor=true;render();document.querySelector('#hand0 .card.current')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});setMessage(`${C[id].month}월 선택 · 한 번 더 누르면 패를 냅니다`)}
 function chooseField(id){if(locked||g.phase!=='choice'||g.pending.who!==mySeat)return;perform({type:'pickFloor',cardId:id})}
 function position(selector){const el=typeof selector==='string'?document.querySelector(selector):selector;const r=el?.getBoundingClientRect();if(!r)return null;return{x:r.left+r.width/2,y:r.top+r.height/2}}
 function freeFieldSlots(){const field=$('field');if(!field)return[];const ghost=document.createElement('button');ghost.className='card';ghost.disabled=true;ghost.style.visibility='hidden';ghost.style.pointerEvents='none';field.append(ghost);const result=[position(ghost)];field.removeChild(ghost);return result}
 function captureOrigins(){const v={hand:[],field:{},free:freeFieldSlots(),deck:position('#deck'),caps:[]};for(let w=0;w<mode;w++){v.hand[w]=position('#hand'+visualSlot(w));v.caps[w]=position('#cap'+visualSlot(w))}document.querySelectorAll('#field [data-card-id]').forEach(el=>v.field[el.dataset.cardId]=position(el));return v}
 function perform(action){if(locked||!g||onlinePaused)return false;if(online){const type=action?.type;if(type==='newRound'&&mySeat!==0)return false;const payload={...action,player:mySeat};if(!onlineSend)return false;onlineSend(payload);closeDialog();tapSelected=null;keyboardCursor=false;return true}tapSelected=null;const before=captureOrigins();const who=action.player??g.active;const ok=g.dispatch(action);if(!ok)return false;keyboardCursor=false;const evs=g.events.slice();if(['play','flip','bomb'].includes(action.type))freshTaken={};for(const ev of evs)if(ev.kind==='take'&&ev.ids?.length)freshTaken[ev.who]=ev.ids.slice();const label=names()[who]||'진행';const info=evs.map(ev=>({play:`낸 패 ${C[ev.id]?.month}월`,pair:ev.source==='flip'?'뒤집어서 짝':'낸 패로 짝',flip:`뒤집은 패 ${C[ev.id]?.month}월`,puk:'뻑! 3장 바닥',pukRecovery:ev.own?'자뻑':'뻑 회수',dealerResult:`선 정하기: 나 ${ev.mine}월 / 컴퓨터 ${ev.ai}월 → ${names()[ev.dealer]} 선`,dealerTie:'선 정하기 동률 · 다시 고르기',bonus:ev.id!==undefined?`보너스 ${ev.id===50?'삼피':'쌍피'} 획득`:'보너스',bonusHand:'손패 보너스 획득',take:ev.ids?.length?`획득 ${ev.ids.length}장`:null,end:'스톱',go:'고 선언',nagari:'나가리'}[ev.kind])).filter(Boolean).join(' → ');
 if(action.type==='newRound')setMessage('새 판 시작');else if(info){const line=`${label}: ${info}`;history.unshift(line);history=history.slice(0,70);setMessage(line)}else setMessage(action.type==='dealer'?'선 정하기 완료':`${label}: 진행`);
 if(g.phase==='ended'){try{localStorage.setItem('hwatu_wallet_'+mode,JSON.stringify(g.wallet));localStorage.setItem('hwatu_recent_'+mode,JSON.stringify(g.records.slice(0,20)))}catch(e){}}
 if(!window.__hwatuFast&&opts.speed!=='off'&&evs.length){locked=true;closeDialog();playSequence(evs,before).catch(err=>console.error('애니메이션',err)).finally(()=>{locked=false;render();scheduleAI()})}else{render();scheduleAI()}return true}
 const sleep=ms=>new Promise(r=>setTimeout(r,online&&document.hidden?0:ms));
 // A card that has flown stays where it landed (.landedCard) until it flies again or render() draws the turn's final screen;
 // otherwise it vanishes while the rest of the turn plays out on the previous screen. Its copy in the hand/field it left is
 // hidden for the same span so it is not seen twice; render() rebuilds those areas, which brings them back.
 function dropLanded(id){document.querySelectorAll('.landedCard').forEach(el=>{if(el.dataset.cardId===String(id))el.remove()});document.querySelectorAll(`[data-card-id="${id}"]:not(.movingCard)`).forEach(el=>{el.style.visibility='hidden'})}
 function clearLanded(){document.querySelectorAll('.landedCard').forEach(el=>el.remove())}
 async function cardFlight(id,from,to,ms,backFirst=false){if(id===undefined||id===null||!from||!to)return;dropLanded(id);const ghost=document.createElement('img');ghost.className='movingCard';ghost.dataset.cardId=String(id);ghost.src=backFirst?back():asset(id);ghost.style.left=(from.x-26)+'px';ghost.style.top=(from.y-40)+'px';$('board').append(ghost);let landed=false;
 const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 try{if(online&&document.hidden)return;const anim=ghost.animate([{transform:'translate(0,0) scale(1)',opacity:.7},{transform:`translate(${to.x-from.x}px,${to.y-from.y}px) scale(1.08)`,opacity:1}],{duration:reduce?120:ms,easing:'ease-in-out',fill:'forwards'});if(backFirst){setTimeout(()=>{if(ghost.isConnected)ghost.src=asset(id)},Math.max(20,ms*.38))}await Promise.race([anim.finished.catch(()=>{}),sleep(ms+500)]);anim.cancel();ghost.src=asset(id);ghost.style.left=(to.x-26)+'px';ghost.style.top=(to.y-40)+'px';ghost.classList.add('landedCard');landed=true}catch(e){}finally{if(!landed)ghost.remove()}}
 function landingFor(id,source,events,index,before,staged){
  const sameMonth=other=>other<48&&id<48&&C[other].month===C[id].month;
  const entries=Object.entries({...before.field,...staged}).filter(([cardId])=>sameMonth(Number(cardId)));
  const pair=events.slice(index+1).find(ev=>ev.kind==='pair'&&ev.source===source);
  const selected=pair?.ids?.find(x=>entries.some(([k])=>Number(k)===x));
  const anchor=(selected!==undefined?entries.find(([k])=>Number(k)===selected):entries[0])?.[1];
  if(anchor)return{x:anchor.x+7,y:anchor.y+5};
  const empty=before.free?.[0]||position('#field')||position('#board');
  const count=Object.keys(staged).length;
  return{x:empty.x+Math.min(count,2)*10,y:empty.y+Math.min(count,2)*4};
 }
 async function playSequence(events,before){const dur=opts.speed==='slow'?800:opts.speed==='quick'?280:500;skip=false;const center=position('#field')||position('#board');const sourceHand=w=>before.hand[w]||center;const destination=w=>before.caps[w]||center;
  const staged={};
 for(const [eventIndex,ev] of events.entries()){ if(skip||(online&&document.hidden))break;const ms=dur;let notice='';switch(ev.kind){
 case 'play':notice=names()[ev.who]+' · 패 내기';{const target=landingFor(ev.id,'hand',events,eventIndex,before,staged);staged[String(ev.id)]=target;await cardFlight(ev.id,sourceHand(ev.who),target,ms,ev.who!==mySeat)}break;
 case 'pair':notice=ev.source==='flip'?'뒤집어서 먹음':'낸 패로 먹음';callout(notice,ms);await sleep(ms);break;
 case 'flip':notice='더미 뒤집기';callout(notice,Math.round(ms*.8));await sleep(ms*.8);{const target=landingFor(ev.id,'flip',events,eventIndex,before,staged);staged[String(ev.id)]=target;await cardFlight(ev.id,before.deck,target,ms,true)}break;
 case 'take':for(const id of ev.first||[]){if(skip)break;callout('낸 패 짝 획득',ms);await cardFlight(id,before.field[String(id)]||staged[String(id)]||center,destination(ev.who),ms)}for(const id of ev.second||[]){if(skip)break;callout('뒤집은 패 짝 획득',ms);await cardFlight(id,before.field[String(id)]||staged[String(id)]||center,destination(ev.who),ms)}break;
 case 'steal':notice='피 빼앗기';callout(notice,ms);await cardFlight(ev.id,destination(ev.from),destination(ev.who),ms);break;
 case 'puk':notice='뻑! · '+C[ev.ids[0]].month+'월 3장';callout(notice,1250);await sleep(1250);break;
 case 'pukRecovery':notice=ev.own?'자뻑! 피 2장':'뻑 회수!';callout(notice,900);await sleep(900);break;
 case 'go':notice=names()[ev.who]+' '+ev.n+'고!';callout(notice,1100);await sleep(1100);break;
 case 'bomb':notice='폭탄!';callout(notice,850);await sleep(850);break;
 case 'shake':notice='흔들기!';callout(notice,800);await sleep(800);break;
 case 'end':notice=names()[ev.who]+' '+ev.points+'점 스톱!';callout(notice,1100);await sleep(1100);break;
 case 'bonus':notice='보너스!';callout(notice,700);await sleep(700);break;
 default:break;}
 if(skip)break;
 }
 $('callout').classList.remove('active');}
 function scheduleAI(){if(online)return;clearTimeout(aiHandle);if(locked||menu||!g||g.phase==='ended'||g.active===mySeat)return;aiHandle=setTimeout(()=>{if(!locked&&!menu&&g.active!==mySeat)perform(g.aiAction())},window.__hwatuFast?0:350)}
 function startGame(n=mode){if(online)return;settlementVisible=false;clearTimeout(aiHandle);mode=n;walletSeen=null;previousTurnKey=null;pendingTurnCallout=null;g=new Hwatu.Game({players:n,seed:Math.floor(Math.random()*4294967295),wallet:load('hwatu_wallet_'+n,null)||undefined,pointWon:opts.pointWon,startMoney:opts.startMoney,dealerHour:new Date().getHours(),bonus:opts.bonus,missions:opts.missions,aiLevels:opts.aiLevels});offlineStartWallet=g.wallet.slice();focus=0;keyboardCursor=false;tapSelected=null;locked=false;menu=false;confirmOpen=false;history=[];render();scheduleAI()}
 // Switching mode or starting over throws the round in progress away, so ask first. Nothing is lost while picking the dealer or after the result.
 function confirmDiscard(question,yesText,run,onCancel){if(online||!g||g.phase==='dealer'||g.phase==='ended'){run();return}menu=true;confirmOpen=true;const done=yes=>{confirmOpen=false;menu=false;if(yes){skip=true;run();return}if(onCancel)onCancel();else if(locked)closeDialog();else{render();scheduleAI()}};openDialog('진행 중인 판이 있습니다',`지금 판을 버리고 ${question}<br>이 판의 패와 점수는 남지 않습니다.${touchUI()?'':'<p>← → 로 고르고 Enter · Esc 계속하기</p>'}`,[{text:'계속하기',fn:()=>done(false)},{text:yesText,fn:()=>done(true)}]);dlgFocus=0;const buttons=Array.from($('dialogBtns').querySelectorAll('button'));buttons.forEach((b,i)=>b.classList.toggle('focus',i===0));buttons[0]?.focus({preventScroll:true})}
 function modeLabel(n){return n===2?'2인 맞고로':'3인 고스톱으로'}
 function switchMode(){if(online)return;const next=mode===2?3:2;confirmDiscard(`${modeLabel(next)} 바꿀까요?`,`${modeLabel(next)} 바꾸기`,()=>{menu=false;closeDialog();startGame(next)})}
 function chooseHandByIndex(i){const arr=g.hands[mySeat].slice().sort((a,b)=>C[a].month-C[b].month||a-b);if(arr[i]!==undefined)playCard(arr[i])}
 function keys(e){const code=e.code;if(settlementVisible){if(code==='Tab'){e.preventDefault();document.querySelector('#sessionSettlement button')?.focus({preventScroll:true});return}if(['Enter','Space','Escape'].includes(code)){e.preventDefault();settlementClose?.()}return}if(!g||online&&document.activeElement?.closest('#lobby'))return;const focused=document.activeElement;const dialogButton=focused?.closest('#dialogBtns')?.contains(focused)&&focused.tagName==='BUTTON';if(dialogButton&&(code==='Enter'||code==='Space'))return;if((!menu||confirmOpen)&&$('overlay')&&!$('overlay').classList.contains('hide')&&(code==='ArrowLeft'||code==='ArrowRight')){const buttons=Array.from($('dialogBtns').querySelectorAll('button'));if(buttons.length){e.preventDefault();dlgFocus=(buttons.indexOf(focused)+(code==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons.forEach((b,i)=>b.classList.toggle('focus',i===dlgFocus));buttons[dlgFocus].focus({preventScroll:true});return}}if(confirmOpen){if(code==='Escape'||code==='Enter'||code==='Space'){e.preventDefault();$('dialogBtns').querySelector('button')?.click()}return}const captured=/^(Digit\d|Numpad\d|Key[A-Z]|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Escape|Enter|Space|Minus|Equal|F1)$/.test(code);if(captured)e.preventDefault();if(locked){if(code==='Space')skip=true;return}if(code==='KeyL'){$('history').classList.toggle('hide');return}if(code==='F1'){menu=true;openDialog('키 안내','1~9/0 패 선택<br>← → 이동, Enter 내기<br>B 폭탄 / H 흔들기 / G 고 / S 스톱<br>L 진행 기록 / M 모드 / Esc 설정',[{text:'닫기',fn:()=>{menu=false;render()}}]);return}if(code==='Escape'){if(menu){menu=false;render()}else settings();return}if(menu){if(code==='ArrowUp'||code==='ArrowDown'){settingIndex=(settingIndex+(code==='ArrowDown'?1:-1)+settingList.length)%settingList.length;renderSettings()}else if(code==='ArrowLeft'||code==='ArrowRight')adjustSetting(code==='ArrowRight'?1:-1);else if(code==='Enter'){menu=false;render()}else if(code==='KeyM')switchMode();return}if(code==='KeyM'){if(!online)switchMode();return}if(code==='KeyR'&&!online&&g.phase!=='dealer'){if(g.phase==='ended')perform({type:'newRound'});else confirmDiscard('새 판을 시작할까요?','새 판 시작',()=>startGame(mode));return}
 if(code==='ArrowLeft'||code==='ArrowRight'){const count=g.phase==='choice'?2:g.phase==='go'?2:g.phase==='dealer'?12:g.hands[mySeat].length;const d=code==='ArrowRight'?1:-1;focus=(focus+d+Math.max(1,count))%Math.max(1,count);keyboardCursor=true;render();return}
 const digit=/^(Digit|Numpad)(\d)$/.exec(code);const n=digit?Number(digit[2]):null,idx=n===null?null:n===0?9:n-1;
 if(g.phase==='dealer'){if(g.active!==mySeat)return;if(idx!==null&&idx<12)perform({type:'dealer',player:mySeat,index:idx});else if(code==='Minus')perform({type:'dealer',player:mySeat,index:10});else if(code==='Equal')perform({type:'dealer',player:mySeat,index:11});else if(code==='Enter')perform({type:'dealer',player:mySeat,index:focus});return}
 if(g.phase==='tong'&&g.active===mySeat){if(code==='KeyS')perform({type:'tong',player:mySeat,stop:true});if(code==='KeyC')perform({type:'tong',player:mySeat,stop:false});return}
 if(g.phase==='go'&&g.active===mySeat){if(code==='KeyG')perform({type:'go',player:mySeat});else if(code==='KeyS')perform({type:'stop',player:mySeat});else if(code==='Enter')perform({type:focus===0?'go':'stop',player:mySeat});return}
 if(g.phase==='cup'&&g.active===mySeat){if(n===1||n===2)perform({type:'gookjin',player:mySeat,asPi:n===2});return}
 if(g.phase==='choice'&&g.active===mySeat){if(n===1||n===2)perform({type:'pickFloor',cardId:g.pending.options[n-1]});else if(code==='Enter')perform({type:'pickFloor',cardId:g.pending.options[focus%2]});return}
 if(g.phase==='ended'){if(code==='KeyQ'&&mySeat===0){e.preventDefault();quitSession();return}if(code==='Enter'&&mySeat===0)perform({type:'newRound'});return}
 if(g.phase!=='play'||g.active!==mySeat)return;if(g.skip[mySeat]||!g.hands[mySeat].length){if(code==='Enter'||code==='Space'||idx!==null)perform({type:'flip',player:mySeat});return}
 if(code==='KeyB'){perform({type:'bomb',player:mySeat});return}if(code==='KeyH'){perform({type:'shake',player:mySeat});return}if(idx!==null){chooseHandByIndex(idx);return}if(code==='Enter'||code==='Space')chooseHandByIndex(focus)
 }
 document.addEventListener('keydown',keys);
 [['styleSelect','style'],['backSelect','back'],['boardSelect','board'],['speedSelect','speed']].forEach(([id,key])=>$(id).onchange=e=>themeUpdate(key,e.target.value));
 $('captureToggle').onclick=()=>{mobileCapsOpen=!mobileCapsOpen;document.querySelector('.self').classList.toggle('captureCollapsed',!mobileCapsOpen);$('captureToggle').setAttribute('aria-expanded',String(mobileCapsOpen));$('captureToggle').textContent=mobileCapsOpen?'접기':'펼치기'};$('modeBtn').onclick=online?()=>settings():switchMode;$('configBtn').onclick=settings;$('historyBtn').onclick=()=>$('history').classList.toggle('hide');$('playBtn').onclick=()=>chooseHandByIndex(focus);$('flipBtn').onclick=()=>perform({type:'flip',player:0});$('deck').onclick=()=>$('flipBtn').click();$('goBtn').onclick=()=>perform({type:'go',player:0});$('stopBtn').onclick=()=>perform({type:'stop',player:0});$('shakeBtn').onclick=()=>perform({type:'shake',player:0});$('bombBtn').onclick=()=>perform({type:'bomb',player:0});$('nextBtn').onclick=()=>g.phase==='ended'?perform({type:'newRound',player:mySeat}):online?false:confirmDiscard('새 판을 시작할까요?','새 판 시작',()=>startGame(mode));document.querySelector('.onlineLink')?.addEventListener('click',e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey)return;e.preventDefault();const href=e.currentTarget.href;confirmDiscard('온라인 대전으로 갈까요?','온라인 대전으로 가기',()=>{location.href=href})});
 if(!online)startGame();
 function notify(message){const msg=String(message||'').trim();if(!msg)return;history.unshift(msg);history=history.slice(0,70);setMessage(msg);updateHistory();callout(msg,1650)}
 function whenIdle(){return onlineProcessing||locked?new Promise(resolve=>onlineIdleWaiters.push(resolve)):Promise.resolve()}
 function onlineMessage(evs,snapshot){
  const label=w=>w===snapshot.seat?'나':snapshot.roster?.[w]?.name||`참가자 ${w+1}`;
  let desc='';
  for(const ev of evs){if(ev.kind==='dealerAwait'){
    const chooser=snapshot.view?.active;
    desc=chooser===snapshot.seat?`${subject(label(0))} 골랐습니다 · 내가 고를 차례`:`${subject(label(chooser))} 선 정하기 패를 고르는 중`;
    break;
   }
   if(ev.kind==='dealerResult'){
    desc=`선 정하기: ${label(0)} ${ev.mine}월 / ${label(1)} ${ev.ai}월 → ${label(ev.dealer)} 선`;break;
   }
  }
  if(!desc){const details=evs.map(ev=>({play:`낸 패 ${C[ev.id]?.month}월`,flip:`뒤집은 패 ${C[ev.id]?.month}월`,pair:ev.source==='flip'?'뒤집어 먹음':'낸 패로 먹음',puk:'뻑! 3장 바닥',go:ev.n+'고',end:'스톱',steal:'피 빼앗기',take:ev.ids?.length?`${ev.ids.length}장 획득`:'',dealerTie:'선 정하기 동률 · 다시 고르기'}[ev.kind])).filter(Boolean).join(' → ');if(details)desc=`${label(evs.find(ev=>Number.isInteger(ev.who))?.who)}: ${details}`}
  if(desc){setMessage(desc);history.unshift(desc);history=history.slice(0,70);updateHistory()}
 }
 async function pumpOnline(){if(onlineProcessing)return;onlineProcessing=true;locked=true;
  try{while(onlineQueue.length){const next=onlineQueue.shift(),snapshot=next.snapshot,oldVersion=lastOnlineVersion;
   if(snapshot.version<oldVersion)continue;
   const changed=oldVersion>=0&&snapshot.version>oldVersion;
   const evs=changed?(snapshot.view?.events||[]):[];
   // Preserve the previous version's visible cards throughout its transition.
   // Never render a future snapshot before the earlier animation completes.
   const origins=changed?captureOrigins():null;
   if(changed&&evs.length&&!next.skipAnimation&&!document.hidden&&opts.speed!=='off'&&!window.__hwatuFast){await playSequence(evs,origins||captureOrigins())}
   onlineSnapshot=snapshot;mySeat=snapshot.seat;mode=snapshot.roster?.length||mode;onlineSend=next.send;onlinePaused=!!snapshot.paused;
   g=snapshot.view?makeFacade(snapshot.view):null;
   if(changed){onlineMessage(evs,snapshot);for(const ev of evs)if(ev.kind==='take'&&ev.ids?.length)freshTaken[ev.who]=ev.ids.slice()}
   lastOnlineVersion=Math.max(lastOnlineVersion,snapshot.version);render();
  }}catch(e){console.error('온라인 연출 처리',e)}finally{onlineProcessing=false;locked=false;render();if(onlineQueue.length)pumpOnline();else onlineIdleWaiters.splice(0).forEach(resolve=>resolve())}}
 function onlineUpdate(snapshot,send){online=true;onlineSend=send;
  if(!snapshot||!Number.isInteger(snapshot.version))return;
  if(snapshot.version<lastOnlineVersion||snapshot.version<lastEnqueuedVersion)return;
  if(snapshot.version===lastEnqueuedVersion&&onlineQueue.length){onlineQueue[onlineQueue.length-1]={snapshot,send};return}
  if(snapshot.version>lastEnqueuedVersion)lastEnqueuedVersion=snapshot.version;
  onlineQueue.push({snapshot,send});if(document.hidden||onlineQueue.length>3){const final=onlineQueue[onlineQueue.length-1];onlineQueue.length=0;onlineQueue.push({...final,skipAnimation:true});skip=true}pumpOnline();
 }
 document.addEventListener('visibilitychange',()=>{if(online&&document.hidden){skip=true;for(const anim of document.getAnimations()){try{anim.cancel()}catch(e){}}}});
 window.HwatuUI={setSessionHandlers:handlers=>{sessionHandlers={...sessionHandlers,...handlers}},showSettlement,updateOnline:onlineUpdate,whenIdle,notify,renderView:(view,seat,send,metadata={})=>onlineUpdate({...metadata,view,seat,roster:metadata.roster||Array.from({length:view.players},(_,i)=>({name:'참가자 '+(i+1)})),version:metadata.version??0},send),render:()=>render(),gameView:()=>displayView(),config:()=>opts,isLocked:()=>locked};
 window.__hwatuDev={state:()=>g,send:(action)=>perform(action),mode:(n)=>startGame(n),fast:(yes=true)=>{window.__hwatuFast=yes;opts.speed='off';render()},config:()=>opts,isLocked:()=>locked};
})();
