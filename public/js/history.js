// history.js — redesign
(function(){
  var token=localStorage.getItem('lc_token');
  var nickname=localStorage.getItem('lc_nickname')||localStorage.getItem('lc_username')||'?';
  if(!token){location.href='/index.html';return;}

  var sa=document.getElementById('sidebarAvatar'),sn=document.getElementById('sidebarName');
  if(sa) sa.textContent=nickname.charAt(0).toUpperCase();
  if(sn) sn.textContent=nickname;

  ['homeNav','meetingsNav','gameRoomsNav','studyRoomsNav','settingsNav'].forEach(function(id){
    var urls={homeNav:'/home.html',meetingsNav:'/home.html',gameRoomsNav:'/game-rooms.html',studyRoomsNav:'/study-rooms.html',settingsNav:'/settings.html'};
    var el=document.getElementById(id); if(el) el.addEventListener('click',function(){location.href=urls[id];});
  });

  var clearBtn=document.getElementById('clearHistoryBtn');
  if(clearBtn) clearBtn.addEventListener('click',async function(){
    if(!confirm('Delete all call history?')) return;
    await fetch('/api/calls',{method:'DELETE',headers:{Authorization:'Bearer '+token}});
    loadHistory();
  });

  async function loadHistory(){
    var list=document.getElementById('historyList');
    if(!list) return;
    try{
      var res=await fetch('/api/calls?limit=100',{headers:{Authorization:'Bearer '+token}});
      var data=await res.json();
      var calls=data.calls||[];
      if(!calls.length){ list.innerHTML='<div class="empty-state"><div class="empty-icon">📞</div><p>No calls yet.</p></div>'; return; }
      list.innerHTML='';
      calls.forEach(function(c){
        var p=c.participants&&c.participants.length?c.participants.join(' & '):'Solo call';
        var init=(p||'?').charAt(0).toUpperCase();
        var dur=c.durationSec<60?(c.durationSec+'s'):Math.round(c.durationSec/60)+'m';
        var ago=relTime(c.startTime);
        var row=document.createElement('div'); row.className='recent-row';
        row.innerHTML='<div class="recent-avatar" style="background:var(--purple)">'+init+'</div>'
          +'<div class="recent-info"><div class="recent-name">'+esc(p)+'</div><div class="recent-meta">Room '+esc(c.roomId)+' · '+ago+'</div></div>'
          +'<div class="recent-dur">⏱ '+dur+'</div>';
        list.appendChild(row);
      });
    } catch(e){ list.innerHTML='<div class="empty-state">Could not load history.</div>'; }
  }

  function relTime(ms){
    var d=Date.now()-ms,m=Math.floor(d/60000);
    if(m<1)return'just now';if(m<60)return m+'m ago';
    var h=Math.floor(m/60);if(h<24)return h+'h ago';
    var dy=Math.floor(h/24);return dy===1?'yesterday':dy+'d ago';
  }
  function esc(s){var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;}
  loadHistory();
})();
