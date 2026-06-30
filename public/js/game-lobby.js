// game-lobby.js — redesign
(function(){
  var token=localStorage.getItem('lc_token');
  var nickname=localStorage.getItem('lc_nickname')||localStorage.getItem('lc_username')||'?';
  if(!token){location.href='/index.html';return;}

  var sa=document.getElementById('sidebarAvatar'),sn=document.getElementById('sidebarName');
  if(sa) sa.textContent=nickname.charAt(0).toUpperCase();
  if(sn) sn.textContent=nickname;

  ['homeNav','meetingsNav','studyRoomsNav','historyNav','settingsNav'].forEach(function(id){
    var urls={homeNav:'/home.html',meetingsNav:'/home.html',studyRoomsNav:'/study-rooms.html',historyNav:'/history.html',settingsNav:'/settings.html'};
    var el=document.getElementById(id);if(el)el.addEventListener('click',function(){location.href=urls[id];});
  });

  var GAME_META={
    ludo:     {icon:'🎲',label:'Ludo',      rules:'2–4 players. Roll dice and move all 4 tokens home to win. Rolling 6 earns an extra turn. Land on enemy = send them back to base.'},
    uno:      {icon:'🃏',label:'UNO',       rules:'2–8 players. Match cards by color or number. First to empty hand wins. Special cards: Skip, Reverse, Draw 2, Wild, Wild Draw 4.'},
    tictactoe:{icon:'⭕',label:'Tic-Tac-Toe',rules:'2 players. X and O take turns. Get 3 in a row to win. Scoreboard tracks wins across rounds.'},
    skribbl:  {icon:'🎨',label:'Draw & Guess',rules:'2–8 players. Drawer picks a word from 3 options and draws. Others guess in chat. Faster guess = more points. Rotate artist each round.'},
    tod:      {icon:'🎤',label:'Truth or Dare',rules:'2–8 players. Current player picks Truth or Dare. Random prompt appears. Host can skip any prompt. Pass to next player when done.'},
    nhie:     {icon:'🙋',label:'Never Have I Ever',rules:'2–10 players. A statement appears for everyone. Vote: I Have or Never. See who\'s done what. 10 rounds per session.'},
  };

  var selectedGame=null;
  var createModal=document.getElementById('createModal');
  var createError=document.getElementById('createError');

  document.querySelectorAll('.gc-host-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      selectedGame=btn.getAttribute('data-game');
      var meta=GAME_META[selectedGame];
      var mi=document.getElementById('modalIcon'); if(mi) mi.textContent=meta.icon;
      var mt=document.getElementById('modalTitle'); if(mt) mt.textContent=meta.label;
      var mr=document.getElementById('modalRules'); if(mr) mr.textContent=meta.rules;
      createError&&createError.classList.remove('show');
      createModal&&createModal.classList.add('open');
    });
  });

  document.getElementById('createModalClose')&&document.getElementById('createModalClose').addEventListener('click',function(){createModal.classList.remove('open');});
  createModal&&createModal.addEventListener('click',function(e){if(e.target===createModal)createModal.classList.remove('open');});

  document.getElementById('createRoomBtn')&&document.getElementById('createRoomBtn').addEventListener('click',async function(){
    var btn=this; btn.disabled=true; btn.textContent='Creating…';
    createError&&createError.classList.remove('show');
    try{
      var res=await fetch('/api/game-rooms',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({game:selectedGame})});
      var d=await res.json();
      if(!res.ok){if(createError){createError.textContent=d.error||'Could not create room.';createError.classList.add('show');}return;}
      location.href='/game-room.html?code='+d.code+'&game='+d.game+'&host=1';
    } catch(e){if(createError){createError.textContent='Server error.';createError.classList.add('show');}}
    finally{btn.disabled=false;btn.textContent='Create Room';}
  });

  var joinForm=document.getElementById('joinCodeForm');
  var joinError=document.getElementById('joinError');
  if(joinForm) joinForm.addEventListener('submit',async function(e){
    e.preventDefault();
    var code=(document.getElementById('joinCodeInput').value||'').trim().toUpperCase();
    if(!code)return;
    joinError&&joinError.classList.remove('show');
    try{
      var res=await fetch('/api/game-rooms/'+code,{headers:{Authorization:'Bearer '+token}});
      var d=await res.json();
      if(!res.ok){if(joinError){joinError.textContent=d.error||'Room not found.';joinError.classList.add('show');}return;}
      location.href='/game-room.html?code='+d.code+'&game='+d.game;
    } catch(e2){if(joinError){joinError.textContent='Server error.';joinError.classList.add('show');}}
  });
})();
