(() => {
  'use strict';
  const VERSION='0.4.2', STORE='house-five-ludo:v4';
  const launchParams=new URLSearchParams(location.search);
  let HOST_NAME=String(launchParams.get('player')||'House member').trim().slice(0,40)||'House member';
  let HOUSE_USER=null,realtimeGeneration=0,realtimeSeq=null;
  const HOUSE_ORIGIN=location.origin;
  const COLORS=['red','green','yellow','blue'];
  const COLOR_NAMES={red:'Red',green:'Green',yellow:'Yellow',blue:'Blue'};
  const START={red:0,green:13,yellow:26,blue:39};
  const SAFE=new Set([0,8,13,21,26,34,39,47]);
  const DICE=['⚀','⚁','⚂','⚃','⚄','⚅'];
  const track=[
    [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
    [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
    [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]
  ];
  const lanes={
    red:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    green:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    yellow:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    blue:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
  };
  const bases={
    red:[[2,2],[2,4],[4,2],[4,4]],green:[[2,10],[2,12],[4,10],[4,12]],
    yellow:[[10,10],[10,12],[12,10],[12,12]],blue:[[10,2],[10,4],[12,2],[12,4]]
  };
  const $=s=>document.querySelector(s);
  const els={
    home:$('#homeScreen'),setup:$('#setupScreen'),play:$('#playScreen'),board:$('#board'),tokens:$('#tokenLayer'),
    roomCode:$('#roomCode'),activeRoomBox:$('#activeRoomBox'),roomStatus:$('#roomStatus'),joinCode:$('#joinCodeInput'),
    lobbyPlayers:$('#lobbyPlayers'),playerCount:$('#playerCountLabel'),start:$('#startGameBtn'),leaveRoom:$('#leaveRoomBtn'),
    housemateActions:$('#housemateActions'),botActions:$('#botActions'),housematesTab:$('#housematesTab'),botsTab:$('#botsTab'),
    setupTitle:$('#setupTitle'),setupEyebrow:$('#setupEyebrow'),modeName:$('#modeName'),modeDescription:$('#modeDescription'),
    cornerPlayers:$('#cornerPlayers'),dice:$('#diceBtn'),face:$('#diceFace'),turnName:$('#turnName'),status:$('#gameStatus'),
    playModeTitle:$('#playModeTitle'),rematch:$('#rematchBtn'),drawer:$('#rulesDrawer'),scrim:$('#drawerScrim'),toast:$('#toast')
  };

  const defaultRules={extraSix:true,extraCapture:true,threeSixes:true,exactFinish:true,safeSquares:true,stackProtection:true};
  function freshState(){return {room:null,roomId:null,online:false,serverVersion:0,serverStatus:null,meEmail:null,phase:'home',setupMode:'housemates',botCount:3,players:[],turn:0,dice:null,rolled:false,sixes:0,winner:null,rules:{...defaultRules},pieces:{red:[-1,-1,-1,-1],green:[-1,-1,-1,-1],yellow:[-1,-1,-1,-1],blue:[-1,-1,-1,-1]}}}
  function load(){try{const s=JSON.parse(localStorage.getItem(STORE)||'null');return s&&s.rules?s:freshState()}catch{return freshState()}}
  let state=load(),botTimer=null;
  if(!['home','setup','playing'].includes(state.phase))state=freshState();
  function save(){localStorage.setItem(STORE,JSON.stringify(state))}
  function current(){return state.players[state.turn]||null}
  function toast(t){els.toast.textContent=t;els.toast.classList.remove('hidden');clearTimeout(toast._t);toast._t=setTimeout(()=>els.toast.classList.add('hidden'),1800)}
  function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function showScreen(name){els.home.classList.toggle('hidden',name!=='home');els.setup.classList.toggle('hidden',name!=='setup');els.play.classList.toggle('hidden',name!=='playing');state.phase=name;save()}
  function setRoomStatus(text,kind=''){els.roomStatus.textContent=text;els.roomStatus.className='room-status'+(kind?' '+kind:'')}
  async function api(action,payload={}){
    const res=await fetch(new URL('/api/app',HOUSE_ORIGIN).href,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
    let body={};try{body=await res.json()}catch{}
    if(!res.ok)throw new Error(body.error||('House Five request failed ('+res.status+')'));
    return body;
  }
  async function ensureHouseUser({silent=false}={}){
    if(HOUSE_USER)return HOUSE_USER;
    try{
      const res=await fetch(new URL('/api/session',HOUSE_ORIGIN).href,{credentials:'include',cache:'no-store'});
      const body=await res.json().catch(()=>({}));
      if(!res.ok||body.status!=='approved'||!body.user)throw new Error(body.error||'Open Ludo from your signed-in House Five app.');
      HOUSE_USER=body.user;HOST_NAME=body.user.name||body.user.email||HOST_NAME;state.meEmail=String(body.user.email||'').toLowerCase();$('#profileName').textContent=HOST_NAME;save();return HOUSE_USER;
    }catch(err){if(!silent)toast(err.message||'House Five sign-in is required.');throw err}
  }

  function baseClass(r,c){if(r<=5&&c<=5)return'red';if(r<=5&&c>=9)return'green';if(r>=9&&c>=9)return'yellow';if(r>=9&&c<=5)return'blue';return null}
  const trackIndex=new Map(track.map((p,i)=>[p.join(','),i]));
  function laneColor(r,c){for(const color of COLORS)if(lanes[color].some(p=>p[0]===r&&p[1]===c))return color;return null}
  function isInnerBaseCell(r,c,color){return bases[color]?.some(p=>Math.abs(p[0]-r)<=1&&Math.abs(p[1]-c)<=1)}
  function buildBoard(){
    let html='';
    for(let r=0;r<15;r++)for(let c=0;c<15;c++){
      const base=baseClass(r,c),ti=trackIndex.get(`${r},${c}`),lane=laneColor(r,c),center=r===7&&c===7;let classes=['cell'];
      if(base)classes.push(`base-${base}`);if(base&&isInnerBaseCell(r,c,base))classes.push('inner-base');
      if(ti!==undefined){classes.push('track');if(SAFE.has(ti))classes.push('safe');for(const color of COLORS)if(START[color]===ti)classes.push(`${color}-start`)}
      if(lane)classes.push(`${lane}-lane`);if(center)classes.push('center');html+=`<div class="${classes.join(' ')}" role="gridcell"></div>`;
    }
    els.board.innerHTML=html;
  }
  function coordFor(color,index,progress){if(progress<0)return bases[color][index];if(progress<=51)return track[(START[color]+progress)%52];if(progress<=57)return progress===57?[7,7]:lanes[color][progress-52];return[7,7]}
  function globalTrackIndex(color,progress){return progress>=0&&progress<=51?(START[color]+progress)%52:null}
  function movablePieces(player,roll){
    if(!player)return[];return state.pieces[player.color].map((p,i)=>({p,i})).filter(({p})=>{if(p===57)return false;if(p<0)return roll===6;if(state.rules.exactFinish)return p+roll<=57;return true}).map(x=>x.i)
  }
  function stackOffsets(color,progress,index){const peers=state.pieces[color].map((p,i)=>({p,i})).filter(x=>x.p===progress),pos=peers.findIndex(x=>x.i===index),n=peers.length;if(n<=1)return[0,0];const a=(Math.PI*2*pos/n)-Math.PI/2;return[Math.cos(a)*1.3,Math.sin(a)*1.3]}
  function canCurrentUserAct(player){
    if(!player)return false;
    if(state.online)return String(player.email||'').toLowerCase()===String(state.meEmail||HOUSE_USER?.email||'').toLowerCase();
    return !player.bot;
  }
  function renderTokens(){
    const player=current(),moves=state.phase==='playing'&&state.rolled?movablePieces(player,state.dice):[],canAct=canCurrentUserAct(player);let html='';
    for(const color of COLORS)state.pieces[color].forEach((progress,i)=>{
      const [r,c]=coordFor(color,i,progress),[ox,oy]=stackOffsets(color,progress,i),left=(c+.5)/15*100+ox,top=(r+.5)/15*100+oy;
      const movable=canAct&&player?.color===color&&moves.includes(i);
      html+=`<button class="token ${color} ${movable?'movable':''} ${progress===57?'finished':''}" type="button" data-piece="${i}" style="left:${left}%;top:${top}%" aria-label="${COLOR_NAMES[color]} piece ${i+1}"></button>`;
    });
    els.tokens.innerHTML=html;els.tokens.querySelectorAll('.movable').forEach(b=>b.addEventListener('click',()=>movePiece(Number(b.dataset.piece))));
  }
  function finishedCount(color){return state.pieces[color].filter(x=>x===57).length}
  function renderLobbyPlayers(){
    const slots=[];
    for(let i=0;i<4;i++){
      const p=state.players.find(x=>Number(x.seat??state.players.indexOf(x))===i)||state.players[i],color=p?.color||COLORS[i];
      if(p){
        const status=state.online?`<span class="connection-dot ${p.connected?'online':''}"></span>${p.connected?'Connected':'Away'}`:(p.bot?'Bot player':i===0?'You':'Player');
        slots.push(`<div class="player-slot"><span class="slot-avatar ${color}">${escapeHtml((p.name||'?').slice(0,1).toUpperCase())}</span><span><b>${escapeHtml(p.name)}${p.host?'<span class="host-crown">♛</span>':''}</b><small>${status}</small></span></div>`);
      }else slots.push(`<div class="player-slot empty"><span class="slot-avatar">＋</span><span><b>Waiting</b><small>Open housemate slot</small></span></div>`);
    }
    els.lobbyPlayers.innerHTML=slots.join('');els.playerCount.textContent=`${state.players.length} / 4`;
    const me=state.players.find(p=>String(p.email||'').toLowerCase()===String(state.meEmail||'').toLowerCase());
    const canStart=state.online?Boolean(state.room&&me?.host&&state.players.length>=2):state.players.length>=2;
    els.start.disabled=!canStart;
    els.start.innerHTML=state.online&&state.room&&!me?.host?'Waiting for Host': 'Start Game <span>›</span>';
    els.leaveRoom.disabled=!(state.online&&state.room);
  }
  function renderCornerPlayers(){
    els.cornerPlayers.innerHTML=state.players.map((p,i)=>{
      const done=finishedCount(p.color),dots=Array.from({length:4},(_,d)=>`<i class="${d<done?'done':''}"></i>`).join('');
      return `<div class="corner-player ${p.color} ${i===state.turn?'active':''}"><span class="corner-avatar">${escapeHtml((p.name||'?').slice(0,1).toUpperCase())}</span><span class="corner-copy"><b>${escapeHtml(p.name)}</b><small>${state.online?(p.connected?'ONLINE':'AWAY'):(p.bot?'BOT':'PLAYER')}</small><span class="home-dots">${dots}</span></span></div>`;
    }).join('');
  }
  function renderSetup(){
    const botMode=state.setupMode==='bots';
    els.housematesTab.classList.toggle('active',!botMode);els.botsTab.classList.toggle('active',botMode);els.housemateActions.classList.toggle('hidden',botMode);els.botActions.classList.toggle('hidden',!botMode);$('#roomPanel').classList.toggle('hidden',botMode);
    els.setupTitle.textContent=botMode?'Play with Bots':'Play with Housemates';els.setupEyebrow.textContent=botMode?'OFFLINE MODE':'REAL MULTIPLAYER';
    els.modeName.textContent=botMode?'Bot Match':'Housemates';els.modeDescription.textContent=botMode?'Choose how many bots you want to face.':'Create a room or join a housemate on another phone.';
    els.roomCode.textContent=state.room||'------';els.activeRoomBox.classList.toggle('hidden',!(state.online&&state.room));
    document.querySelectorAll('[data-bots]').forEach(b=>b.classList.toggle('active',Number(b.dataset.bots)===(state.botCount||3)));
    if(!botMode){
      if(state.online&&state.room)setRoomStatus(`Room ${state.room} is live. Share the code with approved House Five members.`,'live');
      else setRoomStatus('Create a room or enter a housemate\'s code.');
    }
    renderLobbyPlayers();
  }
  function renderTurn(){
    const p=current();if(!p)return;
    if(state.winner){
      const me=state.players.find(x=>String(x.email||'').toLowerCase()===String(state.meEmail||'').toLowerCase());
      const canRematch=!state.online||Boolean(me?.host);
      els.turnName.textContent=`${state.winner.name} Wins!`;
      els.status.textContent=state.online?(canRematch?'Start a rematch when everyone is ready.':'Waiting for the host to start a rematch.'):'Game complete';
      els.dice.disabled=true;els.dice.classList.add('hidden');els.rematch.classList.toggle('hidden',!canRematch);return
    }
    els.dice.classList.remove('hidden');els.rematch.classList.add('hidden');
    const mine=canCurrentUserAct(p);
    els.turnName.textContent=mine?'Your Turn':`${p.name}'s Turn`;
    els.status.textContent=state.rolled?(mine?`Rolled ${state.dice} · choose a token`:`${p.name} rolled ${state.dice}`):(mine?'Tap the dice to roll':state.online?'Waiting for their move…':'Bot is rolling…');
    els.face.textContent=DICE[(state.dice||5)-1];els.dice.disabled=!mine||state.rolled;
  }
  function render(){
    $('#profileName').textContent=HOST_NAME;
    if(state.phase==='setup')renderSetup();
    if(state.phase==='playing'){renderTokens();renderCornerPlayers();renderTurn();els.playModeTitle.textContent=state.online?'House Match':'Bot Match'}
    document.querySelectorAll('[data-rule]').forEach(i=>i.checked=Boolean(state.rules[i.dataset.rule]));save();maybeRunBot();
  }

  function resetPieces(){state.pieces={red:[-1,-1,-1,-1],green:[-1,-1,-1,-1],yellow:[-1,-1,-1,-1],blue:[-1,-1,-1,-1]};state.turn=0;state.dice=null;state.rolled=false;state.sixes=0;state.winner=null}
  function stopRealtime(){realtimeGeneration++;realtimeSeq=null}
  function openSetup(mode){
    clearTimeout(botTimer);if(mode==='bots')stopRealtime();
    state.setupMode=mode;state.online=false;state.room=null;state.roomId=null;state.serverStatus=null;state.players=[{id:'host',name:HOST_NAME,color:'red',seat:0,bot:false}];
    if(mode==='bots')syncBots();resetPieces();showScreen('setup');render();if(mode==='housemates')ensureHouseUser({silent:true}).then(()=>render()).catch(()=>{});
  }
  function syncBots(){const count=Math.max(1,Math.min(3,Number(state.botCount)||3)),names=['Lakhey','Yeti','Kumari'];state.players=[{id:'host',name:HOST_NAME,color:'red',seat:0,bot:false}];for(let i=0;i<count;i++)state.players.push({id:`bot${i+1}`,name:names[i],color:COLORS[i+1],seat:i+1,bot:true})}
  function chooseBotCount(n){state.botCount=n;syncBots();renderSetup();save()}
  function applyServerRoom(room,{startWatch=true}={}){
    if(!room)return;
    state.online=true;state.setupMode='housemates';state.room=room.code;state.roomId=room.id;state.serverVersion=Number(room.version||0);state.serverStatus=room.status;state.meEmail=room.meEmail||state.meEmail||HOUSE_USER?.email||null;
    state.players=(room.players||[]).map(p=>({id:p.email,email:p.email,name:p.name,color:p.color,seat:Number(p.seat),bot:false,connected:Boolean(p.connected),host:Boolean(p.isHost),picture:p.picture||''}));
    state.rules={...defaultRules,...(room.rules||{})};state.pieces=room.game?.pieces||state.pieces;state.dice=room.game?.dice??null;state.rolled=Boolean(room.game?.rolled);state.sixes=Number(room.game?.sixes||0);
    const turnSeat=Number(room.game?.turnSeat||0),idx=state.players.findIndex(p=>Number(p.seat)===turnSeat);state.turn=idx>=0?idx:0;
    state.winner=room.game?.winnerEmail?state.players.find(p=>String(p.email).toLowerCase()===String(room.game.winnerEmail).toLowerCase())||{name:'Housemate',email:room.game.winnerEmail}:null;
    showScreen(room.status==='playing'||room.status==='finished'?'playing':'setup');render();if(startWatch)startRealtimeWatch();
  }
  async function createOnlineRoom(){
    try{
      await ensureHouseUser();setRoomStatus('Creating secure House Five room…');
      if(state.online&&state.room)await leaveOnlineRoom({quiet:true});
      const result=await api('ludo-create-room',{rules:state.rules});applyServerRoom(result.room);toast(`Room ${result.room.code} created`);
    }catch(err){setRoomStatus(err.message,'error');toast(err.message)}
  }
  async function joinOnlineRoom(){
    const code=String(els.joinCode.value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(code.length<4){setRoomStatus('Enter the room code your housemate shared.','error');return}
    try{
      await ensureHouseUser();setRoomStatus('Joining room…');
      if(state.online&&state.room&&state.room!==code)await leaveOnlineRoom({quiet:true});
      const result=await api('ludo-join-room',{code});els.joinCode.value='';applyServerRoom(result.room);toast(`Joined ${result.room.code}`);
    }catch(err){setRoomStatus(err.message,'error');toast(err.message)}
  }
  async function refreshOnlineRoom({quiet=false,startWatch=false}={}){
    if(!state.online||!state.room)return;
    try{const result=await api('ludo-room-state',{code:state.room});applyServerRoom(result.room,{startWatch});}
    catch(err){if(!quiet)toast(err.message);if(/not found|join this/i.test(err.message||'')){stopRealtime();state.online=false;state.room=null;showScreen('setup');render()}}
  }
  async function startOnlineGame(){
    try{const result=await api('ludo-start',{code:state.room});applyServerRoom(result.room);toast('Match started')}
    catch(err){toast(err.message)}
  }
  async function leaveOnlineRoom({quiet=false}={}){
    if(!state.online||!state.room)return;
    const code=state.room;stopRealtime();
    try{await api('ludo-leave',{code})}catch(err){if(!quiet)toast(err.message)}
    state.online=false;state.room=null;state.roomId=null;state.serverStatus=null;state.players=[{id:'host',name:HOST_NAME,color:'red',seat:0,bot:false}];resetPieces();showScreen('setup');render();
  }
  async function startRealtimeWatch(){
    if(!state.online||!state.room)return;
    const generation=++realtimeGeneration,code=state.room,roomId=state.roomId;
    try{
      const head=await api('realtime-wait',{afterSeq:null,limit:50,waitMs:0});realtimeSeq=Number(head.latestSeq||0);
      while(generation===realtimeGeneration&&state.online&&state.room===code){
        const feed=await api('realtime-wait',{afterSeq:realtimeSeq,limit:100,waitMs:9000});realtimeSeq=Number(feed.latestSeq??realtimeSeq??0);
        if(generation!==realtimeGeneration||state.room!==code)break;
        const changed=(feed.items||[]).some(e=>e.entityType==='ludo_room'&&(e.entityId===roomId||e.payload?.code===code));
        if(changed||!(feed.items||[]).length)await refreshOnlineRoom({quiet:true,startWatch:false});
      }
    }catch(err){
      if(generation===realtimeGeneration&&state.online&&state.room===code)setTimeout(()=>{if(generation===realtimeGeneration)startRealtimeWatch()},1300);
    }
  }

  function startGame(){
    if(state.online){startOnlineGame();return}
    if(state.players.length<2){toast('Add at least one more player.');return}
    resetPieces();showScreen('playing');render();
  }
  function goHome(){clearTimeout(botTimer);if(state.online){leaveOnlineRoom({quiet:true});return}showScreen('home');render()}
  function leaveGame(){clearTimeout(botTimer);if(state.online){leaveOnlineRoom();return}showScreen('setup');render()}
  async function rematchGame(){
    if(!state.winner)return;
    if(state.online){
      try{const result=await api('ludo-rematch',{code:state.room});applyServerRoom(result.room);toast('Rematch started')}
      catch(err){toast(err.message)}
      return;
    }
    resetPieces();showScreen('playing');render();toast('New bot match started');
  }
  async function rollDice(){
    const p=current();if(state.phase!=='playing'||state.rolled||!canCurrentUserAct(p)||state.winner)return;
    if(state.online){
      els.dice.disabled=true;
      try{const result=await api('ludo-roll',{code:state.room});applyServerRoom(result.room)}catch(err){toast(err.message);renderTurn()}
      return;
    }
    animateRoll(()=>resolveRoll(randomRoll()));
  }
  function randomRoll(){return 1+Math.floor(Math.random()*6)}
  function animateRoll(done){els.dice.classList.add('rolling');let ticks=0;const timer=setInterval(()=>{els.face.textContent=DICE[Math.floor(Math.random()*6)];if(++ticks>=7){clearInterval(timer);els.dice.classList.remove('rolling');done()}},55)}
  function resolveRoll(roll){
    state.dice=roll;state.rolled=true;state.sixes=roll===6?state.sixes+1:0;
    if(state.rules.threeSixes&&state.sixes>=3){toast('Three sixes. Turn lost.');state.sixes=0;state.rolled=false;state.dice=null;advanceTurn();return}
    const moves=movablePieces(current(),roll);if(!moves.length){render();setTimeout(()=>{state.rolled=false;if(roll===6&&state.rules.extraSix){state.dice=null;render()}else advanceTurn()},420);return}
    if(moves.length===1)setTimeout(()=>movePiece(moves[0]),380);render();
  }
  async function movePiece(index){
    if(state.phase!=='playing'||!state.rolled||state.winner)return;
    const p=current();if(!canCurrentUserAct(p))return;
    if(state.online){
      try{const result=await api('ludo-move',{code:state.room,pieceIndex:index});applyServerRoom(result.room)}catch(err){toast(err.message);await refreshOnlineRoom({quiet:true})}
      return;
    }
    const roll=state.dice,moves=movablePieces(p,roll);if(!moves.includes(index))return;
    let progress=state.pieces[p.color][index];progress=progress<0?0:progress+roll;if(progress>57)progress=57;state.pieces[p.color][index]=progress;
    const captured=captureAt(p.color,progress);state.rolled=false;state.dice=null;
    if(finishedCount(p.color)===4){state.winner=p;render();toast(`${p.name} wins!`);return}
    const extra=(roll===6&&state.rules.extraSix)||(captured&&state.rules.extraCapture);if(!extra)state.sixes=0;render();setTimeout(()=>{if(extra){toast(captured?'Capture! Roll again.':'Six! Roll again.');render()}else advanceTurn()},360);
  }
  function captureAt(color,progress){
    const g=globalTrackIndex(color,progress);if(g===null)return false;if(state.rules.safeSquares&&SAFE.has(g))return false;let captured=false;
    for(const other of state.players.filter(p=>p.color!==color)){const matching=state.pieces[other.color].map((pr,i)=>({pr,i,g:globalTrackIndex(other.color,pr)})).filter(x=>x.g===g);if(state.rules.stackProtection&&matching.length>=2)continue;matching.forEach(x=>{state.pieces[other.color][x.i]=-1;captured=true})}
    return captured;
  }
  function advanceTurn(){if(state.winner)return;state.turn=(state.turn+1)%state.players.length;state.rolled=false;state.dice=null;state.sixes=0;render()}
  function maybeRunBot(){
    clearTimeout(botTimer);if(state.online||state.phase!=='playing'||state.winner)return;const p=current();if(!p?.bot)return;
    botTimer=setTimeout(()=>animateRoll(()=>{
      const roll=randomRoll();state.dice=roll;state.rolled=true;state.sixes=roll===6?state.sixes+1:0;const moves=movablePieces(p,roll);render();
      if(state.rules.threeSixes&&state.sixes>=3){state.sixes=0;setTimeout(advanceTurn,600);return}
      if(!moves.length){setTimeout(()=>{state.rolled=false;if(roll===6&&state.rules.extraSix){state.dice=null;render()}else advanceTurn()},650);return}
      setTimeout(()=>movePiece(chooseBotMove(p,moves,roll)),700)
    }),700);
  }
  function chooseBotMove(p,moves,roll){
    const finish=moves.find(i=>state.pieces[p.color][i]>=0&&state.pieces[p.color][i]+roll===57);if(finish!==undefined)return finish;
    const capture=moves.find(i=>{const pr=state.pieces[p.color][i]<0?0:state.pieces[p.color][i]+roll,g=globalTrackIndex(p.color,pr);return g!==null&&state.players.some(o=>o.color!==p.color&&state.pieces[o.color].some(x=>globalTrackIndex(o.color,x)===g))});if(capture!==undefined)return capture;
    return moves.sort((a,b)=>state.pieces[p.color][b]-state.pieces[p.color][a])[0];
  }

  function openRules(){els.drawer.classList.add('open');els.scrim.classList.remove('hidden')}
  function closeRules(){els.drawer.classList.remove('open');els.scrim.classList.add('hidden')}
  function resetAll(){clearTimeout(botTimer);stopRealtime();localStorage.removeItem(STORE);state=freshState();closeRules();showScreen('home');render();toast('Game data reset')}
  function returnHouseFive(){stopRealtime();location.assign(new URL('/',location.href).href)}

  buildBoard();showScreen(state.phase);render();ensureHouseUser({silent:true}).then(async()=>{
    $('#profileName').textContent=HOST_NAME;
    if(state.online&&state.room){try{await refreshOnlineRoom({quiet:true,startWatch:true})}catch{}}
  }).catch(()=>{});
  window.addEventListener('focus',()=>{if(state.online&&state.room)refreshOnlineRoom({quiet:true})});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.online&&state.room)refreshOnlineRoom({quiet:true})});

  $('#homeBtn').addEventListener('click',returnHouseFive);
  $('#rulesBtnHome').addEventListener('click',openRules);$('#rulesBtnSetup').addEventListener('click',openRules);$('#rulesBtnPlay').addEventListener('click',openRules);$('#navRules').addEventListener('click',openRules);
  $('#closeRulesBtn').addEventListener('click',closeRules);els.scrim.addEventListener('click',closeRules);$('#resetGameBtn').addEventListener('click',resetAll);
  $('#housematesBtn').addEventListener('click',()=>openSetup('housemates'));$('#botsBtn').addEventListener('click',()=>openSetup('bots'));$('#quickClassicBtn').addEventListener('click',()=>{state.botCount=3;openSetup('bots');startGame()});
  $('#navHousemates').addEventListener('click',()=>openSetup('housemates'));$('#setupBackBtn').addEventListener('click',goHome);$('#playBackBtn').addEventListener('click',leaveGame);
  els.housematesTab.addEventListener('click',()=>openSetup('housemates'));els.botsTab.addEventListener('click',()=>openSetup('bots'));
  $('#createRoomBtn').addEventListener('click',createOnlineRoom);$('#joinRoomBtn').addEventListener('click',joinOnlineRoom);els.joinCode.addEventListener('keydown',e=>{if(e.key==='Enter')joinOnlineRoom()});
  els.leaveRoom.addEventListener('click',()=>leaveOnlineRoom());els.start.addEventListener('click',startGame);$('#startBotGameBtn').addEventListener('click',startGame);
  document.querySelectorAll('[data-bots]').forEach(b=>b.addEventListener('click',()=>chooseBotCount(Number(b.dataset.bots))));
  els.dice.addEventListener('click',rollDice);els.rematch.addEventListener('click',rematchGame);
  $('#copyCodeBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.room||'');toast('Room code copied')}catch{toast(`Room: ${state.room||'------'}`)}});
  $('#chatStubBtn').addEventListener('click',()=>toast(state.online?'House match chat is coming next.':'Chat is available in House Five.'));
  $('#emojiStubBtn').addEventListener('click',()=>toast('🙂  😂  🔥  🎲'));
  document.querySelectorAll('[data-rule]').forEach(input=>input.addEventListener('change',()=>{state.rules[input.dataset.rule]=input.checked;save()}));
  window.HouseFiveLudo={version:VERSION,getState:()=>JSON.parse(JSON.stringify(state)),openSetup,refresh:()=>refreshOnlineRoom(),reset:resetAll};
})();
