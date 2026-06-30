// settings.js — redesign
(function(){
  var token    = localStorage.getItem('lc_token');
  var username = localStorage.getItem('lc_username');
  var nickname = localStorage.getItem('lc_nickname') || username;
  var avatar   = localStorage.getItem('lc_avatar');

  if(!token){ location.href='/index.html'; return; }

  // sidebar user
  var sa=document.getElementById('sidebarAvatar'), sn=document.getElementById('sidebarName');
  if(sa) sa.textContent=(nickname||'?').charAt(0).toUpperCase();
  if(sn) sn.textContent=nickname||username;

  // nav
  ['homeNav','meetingsNav','gameRoomsNav','studyRoomsNav','historyNav'].forEach(function(id){
    var urls={homeNav:'/home.html',meetingsNav:'/home.html',gameRoomsNav:'/game-rooms.html',studyRoomsNav:'/study-rooms.html',historyNav:'/history.html'};
    var el=document.getElementById(id); if(el) el.addEventListener('click',function(){ location.href=urls[id]; });
  });

  var un=document.getElementById('usernameHint'); if(un) un.textContent='@'+(username||'');
  var ni=document.getElementById('nicknameInput'); if(ni) ni.value=nickname||'';
  var pp=document.getElementById('photoPreview');
  function updatePreview(av){
    if(!pp) return;
    if(av){ pp.innerHTML='<img src="'+av+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>'; }
    else { pp.textContent=(nickname||'?').charAt(0).toUpperCase(); pp.style.background='var(--purple)'; }
  }
  updatePreview(avatar);

  // Photo upload
  var pi=document.getElementById('photoInput');
  if(pi) pi.addEventListener('change',async function(){
    var file=pi.files[0]; if(!file) return;
    if(file.size>2*1024*1024){ alert('Image must be under 2MB'); return; }
    var reader=new FileReader();
    reader.onload=async function(e){
      var dataUrl=e.target.result;
      updatePreview(dataUrl);
      try{
        var res=await fetch('/api/me',{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({avatar:dataUrl})});
        var d=await res.json();
        if(res.ok){ localStorage.setItem('lc_avatar',dataUrl); showToast('photoToast','Photo updated!'); }
      } catch(e){}
    };
    reader.readAsDataURL(file);
  });
  var rb=document.getElementById('removePhotoBtn');
  if(rb) rb.addEventListener('click',async function(){
    updatePreview(null); localStorage.removeItem('lc_avatar');
    try{ await fetch('/api/me',{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({avatar:null})}); } catch(e){}
    showToast('photoToast','Photo removed.');
  });

  // Nickname save
  var snb=document.getElementById('saveNicknameBtn');
  if(snb) snb.addEventListener('click',async function(){
    var v=(ni.value||'').trim(); if(!v) return;
    try{
      var res=await fetch('/api/me',{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({nickname:v})});
      var d=await res.json();
      if(res.ok){ localStorage.setItem('lc_nickname',d.nickname); showToast('nickToast','Nickname saved!'); }
    } catch(e){}
  });

  // Theme
  var td=document.getElementById('themeDark'), tl=document.getElementById('themeLight');
  var saved=localStorage.getItem('lc_theme')||'dark';
  if(saved==='light'){ tl&&tl.classList.add('active'); td&&td.classList.remove('active'); }
  if(td) td.addEventListener('click',function(){ localStorage.setItem('lc_theme','dark'); document.documentElement.removeAttribute('data-theme'); td.classList.add('active'); tl&&tl.classList.remove('active'); });
  if(tl) tl.addEventListener('click',function(){ localStorage.setItem('lc_theme','light'); document.documentElement.setAttribute('data-theme','light'); tl.classList.add('active'); td&&td.classList.remove('active'); });

  // Blocked users
  (async function(){
    var bl=document.getElementById('blockedList'); if(!bl) return;
    try{
      var res=await fetch('/api/contacts',{headers:{Authorization:'Bearer '+token}});
      var d=await res.json();
      var blocked=(d.contacts||[]).filter(function(c){return c.blocked;});
      if(!blocked.length){ bl.innerHTML='<p style="color:var(--text2);font-size:13px">No blocked users.</p>'; return; }
      bl.innerHTML='';
      blocked.forEach(function(c){
        var row=document.createElement('div'); row.className='settings-row';
        row.innerHTML='<div class="settings-row-label"><h3>'+esc(c.nickname||c.username)+'</h3><p class="badge badge-red">Blocked</p></div>'
          +'<button class="btn btn-ghost btn-sm" data-u="'+esc(c.username)+'">Unblock</button>';
        row.querySelector('button').addEventListener('click',async function(){
          var u=this.getAttribute('data-u');
          await fetch('/api/contacts/'+u+'/unblock',{method:'POST',headers:{Authorization:'Bearer '+token}});
          location.reload();
        });
        bl.appendChild(row);
      });
    } catch(e){}
  })();

  // Clear history
  var ch=document.getElementById('clearHistoryBtn');
  if(ch) ch.addEventListener('click',async function(){
    if(!confirm('Delete all call history?')) return;
    try{ await fetch('/api/calls',{method:'DELETE',headers:{Authorization:'Bearer '+token}}); showToast('dangerToast','Call history cleared.'); } catch(e){}
  });

  // Logout
  var lo=document.getElementById('logoutBtn');
  if(lo) lo.addEventListener('click',function(){
    ['lc_token','lc_username','lc_nickname','lc_avatar'].forEach(function(k){localStorage.removeItem(k);});
    location.href='/index.html';
  });

  function showToast(id,msg){
    var el=document.getElementById(id); if(!el) return;
    el.textContent=msg; el.classList.add('show');
    setTimeout(function(){el.classList.remove('show');},3000);
  }
  function esc(s){ var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; }
})();
