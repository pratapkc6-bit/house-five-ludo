(() => {
  'use strict';
  const VERSION='0.2.1', STORE='house-five-ludo:v2';\n  const launchParams=new URLSearchParams(location.search);\n  const HOST_NAME=String(launchParams.get('player')||'You').trim().slice(0,40)||'You';
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
  const els={board:$('#board'),tokens:$('#tokenLayer'),lobby:$('#lobby'),waiting:$('#waitingRoom'),lobbyStart:$('#lobbyStart'),roomCode:$('#roomCode'),roomLabel:$('#roomLabel'),lobbyPlayers:$('#lobbyPlayers'),players:$('#playersBar'),start:$('#startGameBtn'),addBot:$('#addBotBtn'),dock:$('#turnDock'),dice:$('#diceBtn'),face:$('#diceFace'),turnName:$('#turnName'),status:$('#gameStatus'),kicker:$('#turnKicker'),drawer:$('#rulesDrawer'),scrim:$('#drawerScrim'),toast:$('#toast')};

  const defaultRules={extraSix:true,extraCapture:true,threeSixes:true,exactFinish:true,safeSquares:true,stackProtection:true};
  function freshState(){return {room:null,phase:'lobby',players:[],turn:0,dice:null,rolled:false,sixes:0,winner:null,rules:{...defaultRules},pieces:{red:[-1,-1,-1,-1],green:[-1,-1,-1,-1],yellow:[-1,-1,-1,-1],blue:[-1,-1,-1,-1]}}}
  function load(){try{const s=JSON.parse(localStorage.getItem(STORE)||'null');return s&&s.rules?s:freshState()}catch{return freshState()}}
  let state=load(), botTimer=null;
  function save(){localStorage.setItem(STORE,JSON.stringify(state))}
  function current(){return state.players[state.turn]}
  function roomCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
  function toast(t){els.toast.textContent=t;els.toast.classList.remove('hidden');clearTimeout(toast._t);toast._t=setTimeout(()=>els.toast.classList.add('hidden'),1500)}
  function baseClass(r,c){if(r<=5&&c<=5)return'red';if(r<=5&&c>=9)return'green';if(r>=9&&c>=9)return'yellow';if(r>=9&&c<=5)return'blue';return null}
  const trackIndex=new Map(track.map((p,i)=>[p.join(','),i]));
  function laneColor(r,c){for(const color of COLORS)if(lanes[color].some(p=>p[0]===r&&p[1]===c))return color;return null}
  function isInnerBaseCell(r,c,color){return bases[color]?.some(p=>Math.abs(p[0]-r)<=1&&Math.abs(p[1]-c)<=1)}

  function buildBoard(){
    let html='';
    for(let r=0;r<15;r++)for(let c=0;c<15;c++){
      const base=baseClass(r,c),ti=trackIndex.get(`${r},${c}`),lane=laneColor(r,c),center=r===7&&c===7;
      let classes=['cell'];
      if(base) classes.push(`base-${base}`);
      if(base&&isInnerBaseCell(r,c,base))classes.push('inner-base');
      if(ti!==undefined){classes.push('track');if(SAFE.has(ti))classes.push('safe');for(const color of COLORS)if(START[color]===ti)classes.push(`${color}-start`)}
      if(lane)classes.push(`${lane}-lane`);
      if(center)classes.push('center');
      html+=`<div class="${classes.join(' ')}" role="gridcell" data-r="${r}" data-c="${c}"></div>`;
    }
    els.board.innerHTML=html;
  }

  function coordFor(color,index,progress){
    if(progress<0)return bases[color][index];
    if(progress<=51)return track[(START[color]+progress)%52];
    if(progress<=57)return progress===57?[7,7]:lanes[color][progress-52];
    return [7,7];
  }
  function globalTrackIndex(color,progress){return progress>=0&&progress<=51?(START[color]+progress)%52:null}
  function movablePieces(player,roll){
    if(!player)return[];
    return state.pieces[player.color].map((p,i)=>({p,i})).filter(({p})=>{
      if(p===57)return false;
      if(p<0)return roll===6;
      if(state.rules.exactFinish)return p+roll<=57;
      return true;
    }).map(x=>x.i);
  }
  function stackOffsets(color,progress,index){
    const peers=state.pieces[color].map((p,i)=>({p,i})).filter(x=>x.p===progress);
    const pos=peers.findIndex(x=>x.i===index),n=peers.length;
    if(n<=1)return[0,0]; const a=(Math.PI*2*pos/n)-Math.PI/2; return[Math.cos(a)*1.3,Math.sin(a)*1.3];
  }
  function renderTokens(){
    const player=current(), moves=state.phase==='playing'&&state.rolled?movablePieces(player,state.dice):[];
    let html='';
    for(const color of COLORS){state.pieces[color].forEach((progress,i)=>{
      const [r,c]=coordFor(color,i,progress),[ox,oy]=stackOffsets(color,progress,i),left=(c+.5)/15*100+ox,top=(r+.5)/15*100+oy;
      const mine=player?.color===color, movable=mine&&moves.includes(i);
      html+=`<button class="token ${color} ${movable?'movable':''} ${progress===57?'finished':''}" type="button" data-color="${color}" data-piece="${i}" style="left:${left}%;top:${top}%" aria-label="${COLOR_NAMES[color]} piece ${i+1}${movable?', can move':''}"></button>`;
    })}
    els.tokens.innerHTML=html;
    els.tokens.querySelectorAll('.movable').forEach(b=>b.addEventListener('click',()=>movePiece(Number(b.dataset.piece))));
  }
  function renderPlayers(){
    els.players.innerHTML=state.players.map((p,i)=>`<div class="player-chip ${state.phase==='playing'&&i===state.turn?'active':''}"><i class="player-dot ${p.color}"></i><span><b>${escapeHtml(p.name)}</b><small>${p.bot?'BOT':'HOUSE MEMBER'} · ${finishedCount(p.color)}/4 home</small></span></div>`).join('');
    els.lobbyPlayers.innerHTML=state.players.map(p=>`<div class="lobby-player"><i class="player-dot ${p.color}"></i><span><b>${escapeHtml(p.name)}</b><small>${p.bot?'bot ready':'host ready'}</small></span></div>`).join('');
    els.start.disabled=state.players.length<2;
    els.addBot.disabled=state.players.length>=4;
  }
  function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function finishedCount(color){return state.pieces[color].filter(x=>x===57).length}
  function renderTurn(){
    if(state.phase!=='playing'){els.dock.classList.add('hidden');return}
    els.dock.classList.remove('hidden'); const p=current();
    els.turnName.textContent=p?.name||'Player'; els.kicker.textContent=p?.bot?'BOT TURN':'YOUR TURN';
    if(state.winner){els.status.textContent=`${state.winner.name} wins`;els.dice.disabled=true;return}
    els.status.textContent=state.rolled?`Rolled ${state.dice} · choose a piece`:'Roll the dice';
    els.face.textContent=DICE[(state.dice||5)-1]; els.dice.disabled=Boolean(p?.bot)||state.rolled;
  }
  function renderLobby(){
    const created=Boolean(state.room); els.roomLabel.textContent=state.room||'LOCAL';
    els.roomCode.textContent=state.room||'------'; els.lobbyStart.classList.toggle('hidden',created); els.waiting.classList.toggle('hidden',!created);
    els.lobby.classList.toggle('hidden',state.phase==='playing');
  }
  function renderRules(){document.querySelectorAll('[data-rule]').forEach(i=>i.checked=Boolean(state.rules[i.dataset.rule]))}
  function render(){renderLobby();renderPlayers();renderTokens();renderTurn();renderRules();save();maybeRunBot()}

  function createRoom(quick=false){
    state=freshState();state.room=roomCode();state.players=[{id:'host',name:HOST_NAME,color:'red',bot:false}];
    if(quick){state.players.push({id:'bot1',name:'Lakhey',color:'green',bot:true},{id:'bot2',name:'Yeti',color:'yellow',bot:true},{id:'bot3',name:'Kumari',color:'blue',bot:true});startGame();return}
    render();
  }
  function addBot(){if(state.players.length>=4)return;const names=['Lakhey','Yeti','Kumari'],color=COLORS[state.players.length],i=state.players.length-1;state.players.push({id:`bot${i+1}`,name:names[i]||`Bot ${i+1}`,color,bot:true});render()}
  function startGame(){if(state.players.length<2)return;state.phase='playing';state.turn=0;state.dice=null;state.rolled=false;state.sixes=0;state.winner=null;render()}
  function rollDice(){
    const p=current();if(state.phase!=='playing'||state.rolled||p?.bot||state.winner)return;
    animateRoll(()=>resolveRoll(randomRoll()));
  }
  function randomRoll(){return 1+Math.floor(Math.random()*6)}
  function animateRoll(done){
    els.dice.classList.add('rolling');let ticks=0;const timer=setInterval(()=>{els.face.textContent=DICE[Math.floor(Math.random()*6)];if(++ticks>=7){clearInterval(timer);els.dice.classList.remove('rolling');done()}},55)
  }
  function resolveRoll(roll){
    state.dice=roll;state.rolled=true;state.sixes=roll===6?state.sixes+1:0;
    if(state.rules.threeSixes&&state.sixes>=3){toast('Three sixes. Turn lost.');state.sixes=0;state.rolled=false;state.dice=null;advanceTurn();return}
    const moves=movablePieces(current(),roll);
    if(!moves.length){state.rolled=false;setTimeout(()=>{ if(roll===6&&state.rules.extraSix){render(); if(current()?.bot)maybeRunBot()} else advanceTurn(); },350);render();return}
    if(moves.length===1){setTimeout(()=>movePiece(moves[0]),350)}
    render();
  }
  function movePiece(index){
    if(state.phase!=='playing'||!state.rolled||state.winner)return;
    const p=current(),roll=state.dice,moves=movablePieces(p,roll);if(!moves.includes(index))return;
    let progress=state.pieces[p.color][index];progress=progress<0?0:progress+roll;if(progress>57)progress=57;state.pieces[p.color][index]=progress;
    const captured=captureAt(p.color,progress);const finished=progress===57;
    state.rolled=false;state.dice=null;
    if(finishedCount(p.color)===4){state.winner=p;els.status.textContent=`${p.name} wins!`;toast(`${p.name} wins the game`);render();return}
    const extra=(roll===6&&state.rules.extraSix)||(captured&&state.rules.extraCapture);
    if(!extra)state.sixes=0;
    render();
    setTimeout(()=>{if(extra){toast(captured?'Capture! Roll again.':'Six! Roll again.');render();}else advanceTurn()},360);
  }
  function captureAt(color,progress){
    const g=globalTrackIndex(color,progress);if(g===null)return false;if(state.rules.safeSquares&&SAFE.has(g))return false;
    let captured=false;
    for(const other of state.players.filter(p=>p.color!==color)){
      const matching=state.pieces[other.color].map((pr,i)=>({pr,i,g:globalTrackIndex(other.color,pr)})).filter(x=>x.g===g);
      if(state.rules.stackProtection&&matching.length>=2)continue;
      matching.forEach(x=>{state.pieces[other.color][x.i]=-1;captured=true});
    }
    return captured;
  }
  function advanceTurn(){if(state.winner)return;state.turn=(state.turn+1)%state.players.length;state.rolled=false;state.dice=null;state.sixes=0;render()}
  function maybeRunBot(){
    clearTimeout(botTimer);if(state.phase!=='playing'||state.winner)return;const p=current();if(!p?.bot)return;
    botTimer=setTimeout(()=>{
      animateRoll(()=>{
        const roll=randomRoll();state.dice=roll;state.rolled=true;state.sixes=roll===6?state.sixes+1:0;
        const moves=movablePieces(p,roll);render();
        if(state.rules.threeSixes&&state.sixes>=3){state.sixes=0;setTimeout(advanceTurn,550);return}
        if(!moves.length){setTimeout(()=>roll===6&&state.rules.extraSix?maybeRunBot():advanceTurn(),600);return}
        const chosen=chooseBotMove(p,moves,roll);setTimeout(()=>movePiece(chosen),650)
      })
    },650)
  }
  function chooseBotMove(p,moves,roll){
    const canFinish=moves.find(i=>state.pieces[p.color][i]>=0&&state.pieces[p.color][i]+roll===57);if(canFinish!==undefined)return canFinish;
    const canCapture=moves.find(i=>{const pr=state.pieces[p.color][i]<0?0:state.pieces[p.color][i]+roll,g=globalTrackIndex(p.color,pr);if(g===null)return false;return state.players.some(o=>o.color!==p.color&&state.pieces[o.color].some(x=>globalTrackIndex(o.color,x)===g))});if(canCapture!==undefined)return canCapture;
    return moves.sort((a,b)=>state.pieces[p.color][b]-state.pieces[p.color][a])[0];
  }
  function openRules(){els.drawer.classList.add('open');els.scrim.classList.remove('hidden')}
  function closeRules(){els.drawer.classList.remove('open');els.scrim.classList.add('hidden')}
  function reset(){clearTimeout(botTimer);localStorage.removeItem(STORE);state=freshState();closeRules();render();toast('Local game reset')}
  function returnHome(){const target=launchParams.get('return');location.href=(target&&target.startsWith('/')&&!target.startsWith('//'))?target:'/'}

  buildBoard();render();
  $('#homeBtn').addEventListener('click',returnHome);$('#rulesBtn').addEventListener('click',openRules);$('#closeRulesBtn').addEventListener('click',closeRules);els.scrim.addEventListener('click',closeRules);
  $('#createRoomBtn').addEventListener('click',()=>createRoom(false));$('#quickPlayBtn').addEventListener('click',()=>createRoom(true));$('#addBotBtn').addEventListener('click',addBot);$('#startGameBtn').addEventListener('click',startGame);els.dice.addEventListener('click',rollDice);$('#resetGameBtn').addEventListener('click',reset);
  $('#copyCodeBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.room||'');toast('Room code copied')}catch{toast(`Room: ${state.room}`)}});
  document.querySelectorAll('[data-rule]').forEach(input=>input.addEventListener('change',()=>{state.rules[input.dataset.rule]=input.checked;save()}));
  window.HouseFiveLudo={version:VERSION,mode:location.hostname==='house-five-ludo.vercel.app'?'standalone-or-proxied':'preview',hostName:HOST_NAME,getState:()=>JSON.parse(JSON.stringify(state)),reset};
})();
