// game-room.js — clean rewrite
(function(){
'use strict';
var token    = localStorage.getItem('lc_token');
var username = localStorage.getItem('lc_username');
var nickname = localStorage.getItem('lc_nickname') || username;
if(!token){ location.href='/index.html'; return; }

var params = new URLSearchParams(location.search);
var code   = (params.get('code')||'').toUpperCase();
var game   = params.get('game')||'';
var isHost = params.get('host')==='1';
if(!code){ location.href='/game-rooms.html'; return; }

function el(id){ return document.getElementById(id); }
function esc(s){ var d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

// ── Game metadata ─────────────────────────────────────────────────
var GAME_META = {
  ludo:      {icon:'🎲', label:'Ludo'},
  uno:       {icon:'🃏', label:'UNO'},
  tictactoe: {icon:'⭕', label:'Tic-Tac-Toe'},
  skribbl:   {icon:'🎨', label:'Draw & Guess'},
  tod:       {icon:'🎤', label:'Truth or Dare'},
  nhie:      {icon:'🙋', label:'Never Have I Ever'},
};
var meta = GAME_META[game] || {icon:'🎮', label:'Game'};

// ── Set topbar immediately from URL params ─────────────────────────
var topGameName = el('topbarGame'); if(topGameName) topGameName.textContent = meta.label;
var topCode     = el('topbarCode'); if(topCode)     topCode.textContent     = code;
var lobbyIcon   = el('lobbyIcon');  if(lobbyIcon)   lobbyIcon.textContent   = meta.icon;
var lobbyTitle  = el('lobbyTitle'); if(lobbyTitle)  lobbyTitle.textContent  = meta.label + ' Room';
document.title  = 'BlinkMeet — ' + meta.label;

// ── Refs ──────────────────────────────────────────────────────────
var lobbyScreen   = el('lobbyScreen');
var lobbySubtitle = el('lobbySubtitle');
var playerGrid    = el('playerGrid');
var startBtn      = el('startBtn');
var startHint     = el('startHint');
var gameLayout    = el('gameLayout');
var gameArea      = el('gameArea');
var chatLog       = el('chatLog');
var chatForm      = el('chatForm');
var chatInput     = el('chatInput');
var chatCol       = el('chatCol');
var chatToggleBtn = el('chatToggleBtn');
var leaveBtn      = el('leaveBtn');
var winnerOverlay = el('winnerOverlay');
var winnerEmoji   = el('winnerEmoji');
var winnerTitle   = el('winnerTitle');
var winnerNames   = el('winnerNames');
var playAgainBtn  = el('playAgainBtn');
var newGameBtn    = el('newGameBtn');
var colorPicker   = el('colorPicker');
var copyCodeBtn   = el('copyCodeBtn');

var MIN_PLAYERS   = {ludo:2,uno:2,tictactoe:2,skribbl:2,tod:2,nhie:2};
var MAX_SLOTS     = {ludo:4,uno:8,tictactoe:2,skribbl:8,tod:8,nhie:10};

// ── Socket ────────────────────────────────────────────────────────
var socket = io({ auth: { token: token } });
socket.on('connect_error', function(e){ console.error('Socket:', e.message); });
socket.on('connect', function(){ socket.emit('game:join', { code: code }); });

socket.on('game:error', function(d){
  alert(d.message || 'Room error.'); location.href='/game-rooms.html';
});

socket.on('game:joined', function(d){
  if(d.isHost) isHost = true;
});

socket.on('game:chat-history', function(history){
  history.forEach(function(m){ addChat(m.nickname, m.message, false); });
});

// Single game:room-state handler — handles lobby AND playing
socket.on('game:room-state', function(state){
  if(state.phase === 'lobby'){
    renderLobby(state);
  } else if(state.phase === 'playing'){
    if(!gameLayout.classList.contains('visible')){
      // First time: render full game
      showGame(state);
    } else {
      // Already in game: update state only
      if(window.BM_GAMES && window.BM_GAMES[game] && window.BM_GAMES[game].update){
        window.BM_GAMES[game].update(state.gameState, makeCtx(state.players));
      }
    }
  }
});

socket.on('game:ended', function(d){
  var names = d.winners && d.winners.length ? d.winners.join(' & ') : "It's a draw!";
  if(winnerEmoji) winnerEmoji.textContent = (d.winners&&d.winners.length) ? '🏆' : '🤝';
  if(winnerTitle) winnerTitle.textContent = (d.winners&&d.winners.length>1) ? 'Draw!' : (d.winners&&d.winners.length ? 'Winner!' : "Draw!");
  if(winnerNames) winnerNames.textContent = names;
  if(isHost && playAgainBtn) playAgainBtn.style.display = 'inline-block';
  if(winnerOverlay) winnerOverlay.classList.add('show');
  spawnConfetti();
  if(window.BM_GAMES && window.BM_GAMES[game] && window.BM_GAMES[game].onEnded) window.BM_GAMES[game].onEnded(d);
});

socket.on('game:chat', function(d){ addChat(d.nickname, d.message, d.nickname===nickname); });
socket.on('game:react', function(d){ spawnReaction(d.emoji); });

// ── Lobby rendering ───────────────────────────────────────────────
function renderLobby(state){
  if(lobbyScreen) lobbyScreen.style.display = '';
  if(gameLayout)  gameLayout.classList.remove('visible');
  if(winnerOverlay) winnerOverlay.classList.remove('show');

  var players = state.players || [];
  var canStart = state.canStart && isHost;
  if(startBtn) startBtn.disabled = !canStart;
  var min = MIN_PLAYERS[game]||2, max = MAX_SLOTS[game]||8;
  if(startHint) startHint.textContent = canStart ? 'You can start now!' : 'Need '+min+' players minimum. '+players.length+' joined so far.';
  if(lobbySubtitle) lobbySubtitle.textContent = players.length+'/'+max+' players joined · Code: '+code;

  // Player slots
  if(playerGrid){
    playerGrid.innerHTML = '';
    for(var i=0; i<max; i++){
      var p = players[i];
      var slot = document.createElement('div');
      slot.className = 'player-slot' + (p ? ' filled' : '');
      if(p){
        slot.style.borderColor = p.color||'var(--blue)';
        var av = document.createElement('div'); av.className='player-av';
        av.style.cssText = 'background:'+((p.color||'#7c3aed')+'33')+';color:'+(p.color||'#7c3aed');
        if(p.avatar){ var img=document.createElement('img');img.src=p.avatar;av.appendChild(img); }
        else av.textContent = (p.nickname||'?').charAt(0).toUpperCase();
        var nm = document.createElement('div'); nm.className='player-name'; nm.textContent=p.nickname||p.username;
        slot.appendChild(av); slot.appendChild(nm);
        if(p.username===state.hostUsername){
          var cr=document.createElement('div');cr.className='player-crown';cr.textContent='👑 Host';slot.appendChild(cr);
        }
      } else {
        slot.innerHTML = '<div style="font-size:22px;color:var(--border)">+</div><div style="font-size:11px;color:var(--text2)">Waiting</div>';
      }
      playerGrid.appendChild(slot);
    }
  }
}

// ── Game area ──────────────────────────────────────────────────────
function makeCtx(players){
  return {
    username: username, nickname: nickname, isHost: isHost, players: players||[],
    emit: function(action, payload){ socket.emit('game:action',{action:action,payload:payload||{}}); },
  };
}

function showGame(state){
  if(lobbyScreen) lobbyScreen.style.display = 'none';
  if(gameLayout)  gameLayout.classList.add('visible');
  if(winnerOverlay) winnerOverlay.classList.remove('show');
  if(gameArea) gameArea.innerHTML = '';
  if(window.BM_GAMES && window.BM_GAMES[game] && window.BM_GAMES[game].render){
    window.BM_GAMES[game].render(gameArea, state, makeCtx(state.players));
  } else {
    if(gameArea) gameArea.innerHTML='<p style="color:var(--text2);text-align:center;margin-top:40px">Game renderer not loaded.</p>';
  }
}

// ── Controls ──────────────────────────────────────────────────────
startBtn    && startBtn.addEventListener('click', function(){ socket.emit('game:start'); });
playAgainBtn&& playAgainBtn.addEventListener('click', function(){ if(winnerOverlay)winnerOverlay.classList.remove('show'); socket.emit('game:play-again'); });
newGameBtn  && newGameBtn.addEventListener('click',  function(){ socket.emit('game:leave'); location.href='/game-rooms.html'; });
leaveBtn    && leaveBtn.addEventListener('click',    function(){ socket.emit('game:leave'); location.href='/game-rooms.html'; });
window.addEventListener('beforeunload', function(){ socket.emit('game:leave'); });

copyCodeBtn && copyCodeBtn.addEventListener('click', function(){
  try{ navigator.clipboard.writeText(code); }catch(e){}
  copyCodeBtn.textContent='✓'; setTimeout(function(){ copyCodeBtn.textContent='📋'; },1500);
});

// Chat
chatForm && chatForm.addEventListener('submit', function(e){
  e.preventDefault(); var msg=chatInput&&chatInput.value.trim(); if(!msg) return;
  socket.emit('game:chat',{message:msg}); addChat(nickname,msg,true); if(chatInput)chatInput.value='';
});

var chatOpen = false;
chatToggleBtn && chatToggleBtn.addEventListener('click', function(){
  chatOpen=!chatOpen;
  if(chatCol) chatCol.classList.toggle('hidden', !chatOpen);
  chatToggleBtn.classList.toggle('active-state', chatOpen);
});

// Emoji reactions
document.querySelectorAll('.reaction-btn[data-emoji]').forEach(function(btn){
  btn.addEventListener('click', function(){ var e=btn.getAttribute('data-emoji'); socket.emit('game:react',{emoji:e}); spawnReaction(e); });
});

// UNO color picker (global callback)
window.BM_COLOR_PICK = function(cb){
  if(colorPicker) colorPicker.classList.remove('hidden');
  document.querySelectorAll('.cp-btn').forEach(function(btn){
    btn.onclick = function(){
      if(colorPicker) colorPicker.classList.add('hidden');
      cb(btn.getAttribute('data-color'));
    };
  });
};

// ── Chat messages ──────────────────────────────────────────────────
function addChat(who, msg, mine){
  if(!chatLog) return;
  var wrap=document.createElement('div'); wrap.className='chat-msg'+(mine?' own':'');
  var av=document.createElement('div'); av.className='chat-msg-av'; av.textContent=(who||'?').charAt(0).toUpperCase();
  var body=document.createElement('div'); body.className='chat-msg-body';
  var whe=document.createElement('div'); whe.className='who'+(mine?' me':''); whe.textContent=mine?'You':(who||'Guest');
  var bdy=document.createElement('div'); bdy.className='body'; bdy.textContent=msg;
  body.appendChild(whe); body.appendChild(bdy); wrap.appendChild(av); wrap.appendChild(body);
  chatLog.appendChild(wrap); chatLog.scrollTop=chatLog.scrollHeight;
}

// ── Floating reactions ─────────────────────────────────────────────
function spawnReaction(emoji){
  var span=document.createElement('span'); span.className='floating-react'; span.textContent=emoji;
  span.style.left=(15+Math.random()*70)+'vw'; span.style.bottom='80px';
  document.body.appendChild(span); setTimeout(function(){span.remove();},1900);
}

// ── Confetti ───────────────────────────────────────────────────────
function spawnConfetti(){
  var colors=['#e8463a','#4c9fe8','#5fd99a','#f0c048','#c86de8','#f07850'];
  for(var i=0;i<60;i++){
    (function(i){
      setTimeout(function(){
        var c=document.createElement('div'); c.className='confetti-piece';
        c.style.cssText='left:'+Math.random()*100+'vw;background:'+colors[Math.floor(Math.random()*colors.length)]+';animation-duration:'+(1.5+Math.random())+'s;animation-delay:'+Math.random()*0.5+'s;transform:rotate('+Math.random()*360+'deg)';
        document.body.appendChild(c); setTimeout(function(){c.remove();},3000);
      }, i*30);
    })(i);
  }
}
})();
