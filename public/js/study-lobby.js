// study-lobby.js — redesign
(function(){
  var token=localStorage.getItem('lc_token');
  var nickname=localStorage.getItem('lc_nickname')||localStorage.getItem('lc_username')||'?';
  if(!token){location.href='/index.html';return;}

  var sa=document.getElementById('sidebarAvatar'),sn=document.getElementById('sidebarName');
  if(sa) sa.textContent=nickname.charAt(0).toUpperCase();
  if(sn) sn.textContent=nickname;

  ['homeNav','meetingsNav','gameRoomsNav','historyNav','settingsNav'].forEach(function(id){
    var urls={homeNav:'/home.html',meetingsNav:'/home.html',gameRoomsNav:'/game-rooms.html',historyNav:'/history.html',settingsNav:'/settings.html'};
    var el=document.getElementById(id);if(el)el.addEventListener('click',function(){location.href=urls[id];});
  });

  var CAT_LABELS={dsa:'DSA Room',java:'Java Room',c:'C Programming Room'};
  var selectedCat=null;

  // Category buttons
  document.querySelectorAll('[data-cat][data-action]').forEach(function(btn){
    btn.addEventListener('click',function(){
      selectedCat=btn.getAttribute('data-cat');
      var action=btn.getAttribute('data-action');
      if(action==='host') openHostModal(selectedCat);
      else openJoinModal(selectedCat);
    });
  });

  // Host modal
  var hostModal=document.getElementById('hostModal');
  var hostError=document.getElementById('hostError');
  function openHostModal(cat){
    var t=document.getElementById('hostModalTitle');
    if(t) t.textContent='Host '+CAT_LABELS[cat];
    var rn=document.getElementById('hostRoomName');
    if(rn) rn.value='';
    hostError&&hostError.classList.remove('show');
    hostModal&&hostModal.classList.add('open');
  }
  document.getElementById('hostModalClose')&&document.getElementById('hostModalClose').addEventListener('click',function(){hostModal.classList.remove('open');});
  hostModal&&hostModal.addEventListener('click',function(e){if(e.target===hostModal)hostModal.classList.remove('open');});

  document.getElementById('startHostBtn')&&document.getElementById('startHostBtn').addEventListener('click',async function(){
    var roomName=(document.getElementById('hostRoomName').value||'').trim()||CAT_LABELS[selectedCat]+' — '+nickname;
    var btn=this; btn.disabled=true; btn.textContent='Creating…';
    hostError&&hostError.classList.remove('show');
    try{
      var res=await fetch('/api/study-rooms',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({category:selectedCat,roomName:roomName})});
      var d=await res.json();
      if(!res.ok){if(hostError){hostError.textContent=d.error||'Could not create room.';hostError.classList.add('show');}return;}
      location.href='/study-room.html?id='+d.roomId+'&host=1&cat='+selectedCat;
    } catch(e){if(hostError){hostError.textContent='Server error.';hostError.classList.add('show');}}
    finally{btn.disabled=false;btn.textContent='Create Room';}
  });

  // Join modal
  var joinModal=document.getElementById('joinModal');
  var joinError=document.getElementById('joinModalError');
  function openJoinModal(cat){
    var t=document.getElementById('joinModalTitle');
    if(t) t.textContent='Join '+CAT_LABELS[cat];
    var jc=document.getElementById('joinModalCode');
    if(jc) jc.value='';
    joinError&&joinError.classList.remove('show');
    joinModal&&joinModal.classList.add('open');
    setTimeout(function(){jc&&jc.focus();},100);
  }
  document.getElementById('joinModalClose')&&document.getElementById('joinModalClose').addEventListener('click',function(){joinModal.classList.remove('open');});
  joinModal&&joinModal.addEventListener('click',function(e){if(e.target===joinModal)joinModal.classList.remove('open');});

  document.getElementById('doJoinBtn')&&document.getElementById('doJoinBtn').addEventListener('click',async function(){
    var code=(document.getElementById('joinModalCode').value||'').trim().toUpperCase();
    if(!code)return;
    await doJoin(code,joinError);
  });

  // Join by code form
  var jcf=document.getElementById('joinCodeForm');
  if(jcf) jcf.addEventListener('submit',async function(e){
    e.preventDefault();
    var code=(document.getElementById('joinCodeInput').value||'').trim().toUpperCase();
    if(!code)return;
    await doJoin(code,document.getElementById('joinError'));
  });

  async function doJoin(code,errEl){
    errEl&&errEl.classList.remove('show');
    try{
      var res=await fetch('/api/study-rooms/join',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({code:code})});
      var d=await res.json();
      if(!res.ok){if(errEl){errEl.textContent=d.error||'Room not found.';errEl.classList.add('show');}return;}
      location.href='/study-room.html?id='+d.roomId+'&cat='+d.category;
    } catch(e2){if(errEl){errEl.textContent='Server error. Try again.';errEl.classList.add('show');}}
  }

  // Live rooms
  async function loadLiveRooms(){
    var list=document.getElementById('liveRoomsList');if(!list)return;
    try{
      var res=await fetch('/api/study-rooms',{headers:{Authorization:'Bearer '+token}});
      if(!res.ok)return;
      var d=await res.json();
      var rooms=d.rooms||[];
      if(!rooms.length){list.innerHTML='<div class="card" style="text-align:center;padding:28px;color:var(--text2)">No rooms active right now. Be the first to host one!</div>';return;}
      list.innerHTML='';
      rooms.forEach(function(r){
        var card=document.createElement('div');card.className='live-room-card';
        card.innerHTML='<div class="live-dot"></div>'
          +'<div class="live-room-info"><div class="live-room-name">'+esc(r.name)+'</div>'
          +'<div class="live-room-meta">'+catLabel(r.category)+' · Host: '+esc(r.hostNickname)+' · '+r.participantCount+'/4</div></div>'
          +'<button class="btn btn-ghost btn-sm">Join</button>';
        card.querySelector('button').addEventListener('click',function(){
          selectedCat=r.category; openJoinModal(r.category);
        });
        list.appendChild(card);
      });
    } catch(e){}
  }

  function catLabel(c){return CAT_LABELS[c]||c;}
  function esc(s){var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;}
  loadLiveRooms();
  setInterval(loadLiveRooms,8000);
})();
