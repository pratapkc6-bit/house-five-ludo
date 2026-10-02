(() => {
  'use strict';
  const VERSION='0.3.0', STORE='house-five-ludo:v3';
  const launchParams=new URLSearchParams(location.search);
  const HOST_NAME=String(launchParams.get('player')||'House member').trim().slice(0,40)||'House member';
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
    roomCode:$('#roomCode'),lobbyPlayers:$('#lobbyPlayers'),playerCount:$('#playerCountLabel'),start:$('#startGameBtn'),
    housemateActions:$('#housemateActions'),botActions:$('#botActions'),housematesTab:$('#housematesTab'),botsTab:$('#botsTab'),
    setupTitle:$('#setupTitle'),setupEyebrow:$('#setupEyebrow'),modeName:$('#modeName'),modeDescription:$('#modeDescription'),
    cornerPlayers:$('#cornerPlayers'),dice:$('#diceBtn'),face:$('#diceFace'),turnName:$('#turnName'),status:$('#gameStatus'),
    playModeTitle:$('#playModeTitle'),drawer:$('#rulesDrawer'),scrim:$('#drawerScrim'),toast:$('#toast')
  };

  const defaultRules={extraSix:true,extraCapture:true,threeSixes:true,exactFinish:true,safeSquares:true,stackProtection:true};
  function freshState(){return {room:null,phase:'home',setupMode:'housemates',botCount:3,players:[],turn:0,dice:null,rolled:false,sixes:0,winner:null,rules:{...defaultRules},pieces:{red:[-1,-1,-1,-1],green:[-1,-1,-1,-1],yellow:[-1,-1,-1,-1],blue:[-1,-1,-1,-1]}}}
  function load(){try{const s=JSON.parse(localStorage.getItem(STORE)||'null');return s&&s.rules?s:freshState()}catch{return freshState()}}
  let state=load(),botTimer=null;
  if(!['home','setup','playing'].includes(state.phase))state=freshState();
  function save(){localStorage.setItem(STORE,JSON.stringify(state))}
  function current(){return state.players[state.turn]}
  function roomCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
  function toast(t){els.toast.textContent=t;els.toast.classList.remove('hidden');clearTimeout(toast._t);toast._t=setTimeout(()=>els.toast.classList.add('hidden'),1600)}
  function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function showScreen(name){
    els.home.classList.toggle('hidden',name!=='home');els.setup.classList.toggle('hidden',name!=='setup');els.play.classList.toggle('hidden',name!=='playing');
    state.phase=name;save();
  }
  function baseClass(r,c){if(r<=5&&c<=5)return'red';if(r<=5&&c>=9)return'green';if(r>=9&&c>=9)return'yellow';if(r>=9&&c<=5)return'blue';return null}
  const trackIndex=new Map(track.map((p,i)=>[p.join(','),i]));
  function laneColor(r,c){for(const color of COLORS)if(lanes[color].some(p=>p[0]===r&&p[1]===c))return color;return null}
  function isInnerBaseCell(r,c,color){return bases[color]?.some(p=>Math.abs(p[0]-r)<=1&&Math.abs(p[1]-c)<=1)}

  function buildBoard(){
    let html='';
    for(let r=0;r<15;r++)for(let c=0;c<15;c++){
      const base=baseClass(r,c),ti=trackIndex.get(`${r},${c}`),lane=laneColor(r,c),center=r===7&&c===7;
      let classes=['cell'];
      if(base)classes.push(`base-${base}`);
      if(base&&isInnerBaseCell(r,c,base))classes.push('inner-base');
      if(ti!==undefined){classes.push('track');if(SAFE.has(ti))classes.push('safe');for(const color of COLORS)if(START[color]===ti)classes.push(`${color}-start`)}
      if(lane)classes.push(`${lane}-lane`);if(center)classes.push('center');
      html+=`<div class="${classes.join(' ')}" role="gridcell"></div>`;
    }
    els.board.innerHTML=html;
  }
  function coordFor(color,index,progress){if(progress<0)return bases[color][index];if(progress<=51)return track[(START[color]+progress)%52];if(progress<=57)return progress===57?[7,7]:lanes[color][progress-52];return[7,7]}
  function globalTrackIndex(color,progress){return progress>=0&&progress<=51?(START[color]+progress)%52:null}
  function movablePieces(player,roll){
    if(!player)return[];
    return state.pieces[player.color].map((p,i)=>({p,i})).filter(({p})=>{
      if(p===57)return false;if(p<0)return roll===6;if(state.rules.exactFinish)return p+roll<=57;return true;
    }).map(x=>x.i)
  }
  function stackOffsets(color,progress,index){
    const peers=state.pieces[color].map((p,i)=>({p,i})).filter(x=>x.p===progress),pos=peers.findIndex(x=>x.i===index),n=peers.length;
    if(n<=1)return[0,0];const a=(Math.PI*2*pos/n)-Math.PI/2;return[Math.cos(a)*1.3,Math.sin(a)*1.3]
  }
  function renderTokens(){
    const player=current(),moves=state.phase==='playing'&&state.rolled?movablePieces(player,state.dice):[];
    let html='';
    for(const color of COLORS)state.pieces[color].forEach((progress,i)=>{
      const [r,c]=coordFor(color,i,progress),[ox,oy]=stackOffsets(color,progress,i),left=(c+.5)/15*100+ox,top=(r+.5)/15*100+oy;
      const movable=player?.color===color&&moves.includes(i);
      html+=`<button class="token ${color} ${movable?'movable':''} ${progress===57?'finished':''}" type="button" data-piece="${i}" style="left:${left}%;top:${top}%" aria-label="${COLOR_NAMES[color]} piece ${i+1}"></button>`;
    });
    els.tokens.innerHTML=html;
    els.tokens.querySelectorAll('.movable').forEach(b=>b.addEventListener('click',()=>movePiece(Number(b.dataset.piece))));
  }
  function finishedCount(color){return state.pieces[color].filter(x=>x===57).length}
  function renderLobbyPlayers(){
    const slots=[];
    for(let i=0;i<4;i++){
      const p=state.players[i],color=COLORS[i];
      if(p)slots.push(`<div class="player-slot"><span class="slot-avatar ${color}">${escapeHtml((p.name||'?').slice(0,1).toUpperCase())}</span><span><b>${escapeHtml(p.name)}</b><small>${p.bot?'Bot player':i===0?'Host · You':'Local housemate'}</small></span></div>`);
      else slots.push(`<div class="player-slot empty"><span class="slot-avatar">＋</span><span><b>Waiting</b><small>Open player slot</small></span></div>`);
    }
    els.lobbyPlayers.innerHTML=slots.join('');
    els.playerCount.textContent=`${state.players.length} / 4`;
    els.start.disabled=state.players.length<2;
  }
  function renderCornerPlayers(){
    els.cornerPlayers.innerHTML=state.players.map((p,i)=>{
      const done=finishedCount(p.color),dots=Array.from({length:4},(_,d)=>`<i class="${d<done?'done':''}"></i>`).join('');
      return `<div class="corner-player ${p.color} ${i===state.turn?'active':''}"><span class="corner-avatar">${escapeHtml((p.name||'?').slice(0,1).toUpperCase())}</span><span class="corner-copy"><b>${escapeHtml(p.name)}</b><small>${p.bot?'BOT':'HOUSEMATE'}</small><span class="home-dots">${dots}</span></span></div>`;
    }).join('');
  }
  function renderSetup(){
    const botMode=state.setupMode==='bots';
    els.housematesTab.classList.toggle('active',!botMode);els.botsTab.classList.toggle('active',botMode);
    els.housemateActions.classList.toggle('hidden',botMode);els.botActions.classList.toggle('hidden',!botMode);
    $('#roomPanel').classList.toggle('hidden',botMode);
    els.setupTitle.textContent=botMode?'Play with Bots':'Play with Housemates';
    els.setupEyebrow.textContent=botMode?'OFFLINE MODE':'HOUSE FIVE ROOM';
    els.modeName.textContent=botMode?'Bot Match':'Housemates';
    els.modeDescription.textContent=botMode?'Choose how many bots you want to face.':'Create a room and add people playing with you.';
    els.roomCode.textContent=state.room||'------';
    document.querySelectorAll('[data-bots]').forEach(b=>b.classList.toggle('active',Number(b.dataset.bots)===(state.botCount||3)));
    renderLobbyPlayers();
  }
  function renderTurn(){
    const p=current();if(!p)return;
    if(state.winner){els.turnName.textContent=`${state.winner.name} Wins!`;els.status.textContent='Game complete';els.dice.disabled=true;return}
    els.turnName.textContent=p.bot?`${p.name}'s Turn`:(p.id==='host'?'Your Turn':`${p.name}'s Turn`);
    els.status.textContent=state.rolled?`Rolled ${state.dice} · choose a token`:(p.bot?'Bot is rolling…':'Tap the dice to roll');
    els.face.textContent=DICE[(state.dice||5)-1];els.dice.disabled=Boolean(p.bot)||state.rolled;
  }
  function render(){
    $('#profileName').textContent=HOST_NAME;
    if(state.phase==='setup')renderSetup();
    if(state.phase==='playing'){renderTokens();renderCornerPlayers();renderTurn();els.playModeTitle.textContent=state.setupMode==='bots'?'Bot Match':'House Match'}
    document.querySelectorAll('[data-rule]').forEach(i=>i.checked=Boolean(state.rules[i.dataset.rule]));
    save();maybeRunBot();
  }

  function resetPieces(){state.pieces={red:[-1,-1,-1,-1],green:[-1,-1,-1,-1],yellow:[-1,-1,-1,-1],blue:[-1,-1,-1,-1]};state.turn=0;state.dice=null;state.rolled=false;state.sixes=0;state.winner=null}
  function openSetup(mode){
    clearTimeout(botTimer);state.setupMode=mode;state.room=mode==='housemates'?(state.room||roomCode()):null;
    state.players=[{id:'host',name:HOST_NAME,color:'red',bot:false}];
    if(mode==='bots')syncBots();
    resetPieces();showScreen('setup');render();
  }
  function syncBots(){
    const count=Math.max(1,Math.min(3,Number(state.botCount)||3)),names=['Lakhey','Yeti','Kumari'];
    state.players=[{id:'host',name:HOST_NAME,color:'red',bot:false}];
    for(let i=0;i<count;i++)state.players.push({id:`bot${i+1}`,name:names[i],color:COLORS[i+1],bot:true});
  }
  function addLocalHousemate(){
    if(state.players.length>=4){toast('All four seats are filled.');return}
    const i=state.players.length;
    state.players.push({id:`local${i}`,name:`Housemate ${i+1}`,color:COLORS[i],bot:false});renderSetup();save();
  }
  function createNewRoom(){state.room=roomCode();els.roomCode.textContent=state.room;save();toast('New room created')}
  function startGame(){
    if(state.players.length<2){toast('Add at least one more player.');return}
    resetPieces();showScreen('playing');render();
  }
  function chooseBotCount(n){state.botCount=n;syncBots();renderSetup();save()}
  function goHome(){clearTimeout(botTimer);showScreen('home');render()}
  function leaveGame(){clearTimeout(botTimer);showScreen('setup');render()}

  function rollDice(){
    const p=current();if(state.phase!=='playing'||state.rolled||p?.bot||state.winner)return;
    animateRoll(()=>resolveRoll(randomRoll()))
  }
  function randomRoll(){return 1+Math.floor(Math.random()*6)}
  function animateRoll(done){
    els.dice.classList.add('rolling');let ticks=0;const timer=setInterval(()=>{els.face.textContent=DICE[Math.floor(Math.random()*6)];if(++ticks>=7){clearInterval(timer);els.dice.classList.remove('rolling');done()}},55)
  }
  function resolveRoll(roll){
    state.dice=roll;state.rolled=true;state.sixes=roll===6?state.sixes+1:0;
    if(state.rules.threeSixes&&state.sixes>=3){toast('Three sixes. Turn lost.');state.sixes=0;state.rolled=false;state.dice=null;advanceTurn();return}
    const moves=movablePieces(current(),roll);
    if(!moves.length){render();setTimeout(()=>{state.rolled=false;if(roll===6&&state.rules.extraSix){state.dice=null;render()}else advanceTurn()},420);return}
    if(moves.length===1)setTimeout(()=>movePiece(moves[0]),380);
    render();
  }
  function movePiece(index){
    if(state.phase!=='playing'||!state.rolled||state.winner)return;
    const p=current(),roll=state.dice,moves=movablePieces(p,roll);if(!moves.includes(index))return;
    let progress=state.pieces[p.color][index];progress=progress<0?0:progress+roll;if(progress>57)progress=57;state.pieces[p.color][index]=progress;
    const captured=captureAt(p.color,progress);state.rolled=false;state.dice=null;
    if(finishedCount(p.color)===4){state.winner=p;render();toast(`${p.name} wins!`);return}
    const extra=(roll===6&&state.rules.extraSix)||(captured&&state.rules.extraCapture);if(!extra)state.sixes=0;render();
    setTimeout(()=>{if(extra){toast(captured?'Capture! Roll again.':'Six! Roll again.');render()}else advanceTurn()},360)
  }
  function captureAt(color,progress){
    const g=globalTrackIndex(color,progress);if(g===null)return false;if(state.rules.safeSquares&&SAFE.has(g))return false;
    let captured=false;
    for(const other of state.players.filter(p=>p.color!==color)){
      const matching=state.pieces[other.color].map((pr,i)=>({pr,i,g:globalTrackIndex(other.color,pr)})).filter(x=>x.g===g);
      if(state.rules.stackProtection&&matching.length>=2)continue;
      matching.forEach(x=>{state.pieces[other.color][x.i]=-1;captured=true})
    }
    return captured
  }
  function advanceTurn(){if(state.winner)return;state.turn=(state.turn+1)%state.players.length;state.rolled=false;state.dice=null;state.sixes=0;render()}
  function maybeRunBot(){
    clearTimeout(botTimer);if(state.phase!=='playing'||state.winner)return;const p=current();if(!p?.bot)return;
    botTimer=setTimeout(()=>animateRoll(()=>{
      const roll=randomRoll();state.dice=roll;state.rolled=true;state.sixes=roll===6?state.sixes+1:0;const moves=movablePieces(p,roll);render();
      if(state.rules.threeSixes&&state.sixes>=3){state.sixes=0;setTimeout(advanceTurn,600);return}
      if(!moves.length){setTimeout(()=>{state.rolled=false;if(roll===6&&state.rules.extraSix){state.dice=null;render()}else advanceTurn()},650);return}
      setTimeout(()=>movePiece(chooseBotMove(p,moves,roll)),700)
    }),700)
  }
  function chooseBotMove(p,moves,roll){
    const finish=moves.find(i=>state.pieces[p.color][i]>=0&&state.pieces[p.color][i]+roll===57);if(finish!==undefined)return finish;
    const capture=moves.find(i=>{const pr=state.pieces[p.color][i]<0?0:state.pieces[p.color][i]+roll,g=globalTrackIndex(p.color,pr);return g!==null&&state.players.some(o=>o.color!==p.color&&state.pieces[o.color].some(x=>globalTrackIndex(o.color,x)===g))});if(capture!==undefined)return capture;
    return moves.sort((a,b)=>state.pieces[p.color][b]-state.pieces[p.color][a])[0]
  }

  function openRules(){els.drawer.classList.add('open');els.scrim.classList.remove('hidden')}
  function closeRules(){els.drawer.classList.remove('open');els.scrim.classList.add('hidden')}
  function resetAll(){clearTimeout(botTimer);localStorage.removeItem(STORE);state=freshState();closeRules();showScreen('home');render();toast('Game data reset')}
  function returnHouseFive(){location.assign(new URL('/',location.href).href)}

  buildBoard();
  if(state.phase==='playing'&&state.players.length<2)state=freshState();
  showScreen(state.phase);render();

  $('#homeBtn').addEventListener('click',returnHouseFive);
  $('#rulesBtnHome').addEventListener('click',openRules);$('#rulesBtnSetup').addEventListener('click',openRules);$('#rulesBtnPlay').addEventListener('click',openRules);$('#navRules').addEventListener('click',openRules);
  $('#closeRulesBtn').addEventListener('click',closeRules);els.scrim.addEventListener('click',closeRules);$('#resetGameBtn').addEventListener('click',resetAll);
  $('#housematesBtn').addEventListener('click',()=>openSetup('housemates'));$('#botsBtn').addEventListener('click',()=>openSetup('bots'));$('#quickClassicBtn').addEventListener('click',()=>{state.botCount=3;openSetup('bots');startGame()});
  $('#navHousemates').addEventListener('click',()=>openSetup('housemates'));$('#setupBackBtn').addEventListener('click',goHome);$('#playBackBtn').addEventListener('click',leaveGame);
  els.housematesTab.addEventListener('click',()=>openSetup('housemates'));els.botsTab.addEventListener('click',()=>openSetup('bots'));
  $('#createRoomBtn').addEventListener('click',createNewRoom);$('#addHousemateBtn').addEventListener('click',addLocalHousemate);els.start.addEventListener('click',startGame);$('#startBotGameBtn').addEventListener('click',startGame);
  document.querySelectorAll('[data-bots]').forEach(b=>b.addEventListener('click',()=>chooseBotCount(Number(b.dataset.bots))));
  els.dice.addEventListener('click',rollDice);
  $('#copyCodeBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.room||'');toast('Room code copied')}catch{toast(`Room: ${state.room||'------'}`)}});
  $('#chatStubBtn').addEventListener('click',()=>toast('House game chat is ready for the multiplayer backend stage.'));
  $('#emojiStubBtn').addEventListener('click',()=>toast('🙂  😂  🔥  🎲'));
  document.querySelectorAll('[data-rule]').forEach(input=>input.addEventListener('change',()=>{state.rules[input.dataset.rule]=input.checked;save()}));
  window.HouseFiveLudo={version:VERSION,getState:()=>JSON.parse(JSON.stringify(state)),openSetup,reset:resetAll};
})();
