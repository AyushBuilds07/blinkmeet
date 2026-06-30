// contacts.js — redesign
(function(){
  var token=localStorage.getItem('lc_token');
  var nickname=localStorage.getItem('lc_nickname')||localStorage.getItem('lc_username')||'?';
  if(!token){location.href='/index.html';return;}

  var sa=document.getElementById('sidebarAvatar'),sn=document.getElementById('sidebarName');
  if(sa) sa.textContent=nickname.charAt(0).toUpperCase();
  if(sn) sn.textContent=nickname;

  ['homeNav','meetingsNav','gameRoomsNav','studyRoomsNav','historyNav','settingsNav'].forEach(function(id){
    var urls={homeNav:'/home.html',meetingsNav:'/home.html',gameRoomsNav:'/game-rooms.html',studyRoomsNav:'/study-rooms.html',historyNav:'/history.html',settingsNav:'/settings.html'};
    var el=document.getElementById(id); if(el) el.addEventListener('click',function(){location.href=urls[id];});
  });

  var addForm=document.getElementById('addContactForm');
  if(addForm) addForm.addEventListener('submit',async function(e){
    e.preventDefault();
    var u=document.getElementById('contactUsername').value.trim();
    if(!u) return;
    var err=document.getElementById('addContactError');
    err.classList.remove('show');
    try{
      var res=await fetch('/api/contacts',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({username:u})});
      var d=await res.json();
      if(!res.ok){err.textContent=d.error||'Could not add contact.';err.classList.add('show');return;}
      document.getElementById('contactUsername').value='';
      var t=document.getElementById('addContactToast');
      if(t){t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2500);}
      loadContacts();
    } catch(e2){err.textContent='Server error.';err.classList.add('show');}
  });

  async function loadContacts(){
    var list=document.getElementById('contactsList'); if(!list) return;
    try{
      var res=await fetch('/api/contacts',{headers:{Authorization:'Bearer '+token}});
      var d=await res.json();
      var contacts=d.contacts||[];
      if(!contacts.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">👥</div><p>No contacts yet. Add someone above.</p></div>';return;}
      list.innerHTML='';
      contacts.forEach(function(c){
        var init=(c.nickname||c.username||'?').charAt(0).toUpperCase();
        var card=document.createElement('div'); card.className='contact-card';
        card.innerHTML='<div class="recent-avatar" style="background:var(--purple)">'+init+'</div>'
          +'<div class="contact-info"><div class="contact-name">'+esc(c.nickname||c.username)+'</div><div class="contact-username">@'+esc(c.username)+'</div></div>'
          +(c.blocked?'<span class="badge badge-red">Blocked</span>':'')
          +'<div class="contact-actions">'
          +'<button class="btn btn-primary btn-sm call-btn" data-u="'+esc(c.username)+'">Call</button>'
          +(c.blocked
            ?'<button class="btn btn-ghost btn-sm" data-action="unblock" data-u="'+esc(c.username)+'">Unblock</button>'
            :'<button class="btn btn-ghost btn-sm" data-action="block" data-u="'+esc(c.username)+'">Block</button>')
          +'<button class="btn btn-ghost btn-sm" data-action="remove" data-u="'+esc(c.username)+'">Remove</button>'
          +'</div>';
        card.querySelector('.call-btn').addEventListener('click',function(){
          var code=rnd(); location.href='/room.html?room='+code;
        });
        card.querySelectorAll('[data-action]').forEach(function(btn){
          btn.addEventListener('click',async function(){
            var action=btn.getAttribute('data-action'); var u=btn.getAttribute('data-u');
            if(action==='block') await fetch('/api/contacts/'+u+'/block',{method:'POST',headers:{Authorization:'Bearer '+token}});
            else if(action==='unblock') await fetch('/api/contacts/'+u+'/unblock',{method:'POST',headers:{Authorization:'Bearer '+token}});
            else if(action==='remove') await fetch('/api/contacts/'+u,{method:'DELETE',headers:{Authorization:'Bearer '+token}});
            loadContacts();
          });
        });
        list.appendChild(card);
      });
    } catch(e){list.innerHTML='<div class="empty-state">Could not load contacts.</div>';}
  }

  function rnd(){var c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',s='';for(var i=0;i<5;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}
  function esc(s){var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;}
  loadContacts();
})();
