// home.js — redesign
(function(){
  var token    = localStorage.getItem('lc_token');
  var username = localStorage.getItem('lc_username');
  var nickname = localStorage.getItem('lc_nickname') || username;

  if(!token){ location.href='/index.html'; return; }

  // Sidebar / topbar
  var sa = document.getElementById('sidebarAvatar');
  var sn = document.getElementById('sidebarName');
  if(sa) sa.textContent=(nickname||'?').charAt(0).toUpperCase();
  if(sn) sn.textContent=nickname||username;

  // Greet
  var h = new Date().getHours();
  var greet = h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  var gt = document.getElementById('greetTitle');
  var gs = document.getElementById('greetSub');
  if(gt) gt.textContent=greet+' '+nickname+' 👋';
  if(gs) gs.textContent='Ready to connect?';

  // nav
  function nav(id,url){ var el=document.getElementById(id); if(el) el.addEventListener('click',function(){ location.href=url; }); }
  nav('homeNav','/home.html'); nav('meetingsNav','/home.html');
  nav('gameRoomsNav','/game-rooms.html'); nav('studyRoomsNav','/study-rooms.html');
  nav('historyNav','/history.html'); nav('settingsNav','/settings.html');

  // Quick cards
  function qc(id,fn){ var el=document.getElementById(id); if(el) el.addEventListener('click',fn); }
  qc('qcNewMeeting',function(){ openMeetingLinkModal(); });
  qc('newMeetingBtn',function(){ openMeetingLinkModal(); });
  qc('qcJoinRoom',function(){
    var box=document.getElementById('joinCodeBox');
    if(box){ box.style.display=''; document.getElementById('joinCodeInput').focus(); }
  });
  qc('qcGameRooms',function(){ location.href='/game-rooms.html'; });
  qc('qcStudyRooms',function(){ location.href='/study-rooms.html'; });
  qc('cancelJoin',function(){ document.getElementById('joinCodeBox').style.display='none'; });

  // ── Meeting link creation + share ─────────────────────────────
  var meetingLinkModal = document.getElementById('meetingLinkModal');
  var meetingLinkInput = document.getElementById('meetingLinkInput');
  var pendingMeetingCode = null;

  function openMeetingLinkModal(){
    pendingMeetingCode = rnd();
    var link = location.origin + '/room.html?room=' + pendingMeetingCode;
    if(meetingLinkInput) meetingLinkInput.value = link;

    var shareText = encodeURIComponent('Join my BlinkMeet meeting: ' + link);
    var wa = document.getElementById('shareWhatsapp');
    var em = document.getElementById('shareEmail');
    var sms = document.getElementById('shareSMS');
    if(wa)  wa.href  = 'https://wa.me/?text=' + shareText;
    if(em)  em.href  = 'mailto:?subject=' + encodeURIComponent('Join my BlinkMeet meeting') + '&body=' + shareText;
    if(sms) sms.href = 'sms:?body=' + shareText;

    var toast = document.getElementById('copyLinkToast');
    if(toast) toast.classList.remove('show');
    if(meetingLinkModal) meetingLinkModal.classList.add('open');
  }

  qc('createMeetingLinkBtn', openMeetingLinkModal);
  qc('qcNewMeetingLink', openMeetingLinkModal); // safety alias if used elsewhere

  qc('meetingLinkModalClose', function(){ meetingLinkModal && meetingLinkModal.classList.remove('open'); });
  if(meetingLinkModal) meetingLinkModal.addEventListener('click', function(e){
    if(e.target === meetingLinkModal) meetingLinkModal.classList.remove('open');
  });

  qc('copyMeetingLinkBtn', async function(){
    try{ await navigator.clipboard.writeText(meetingLinkInput.value); }catch(e){
      meetingLinkInput.select(); document.execCommand('copy');
    }
    var toast = document.getElementById('copyLinkToast');
    if(toast){ toast.classList.add('show'); setTimeout(function(){toast.classList.remove('show');},2500); }
  });

  qc('joinCreatedMeetingBtn', function(){
    if(pendingMeetingCode) location.href = '/room.html?room=' + pendingMeetingCode;
  });

  var jf = document.getElementById('joinCodeForm');
  if(jf) jf.addEventListener('submit',function(e){
    e.preventDefault();
    var code=document.getElementById('joinCodeInput').value.trim().toUpperCase();
    if(code) location.href='/room.html?room='+code;
  });

  function rnd(){
    var c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',s='';
    for(var i=0;i<5;i++) s+=c[Math.floor(Math.random()*c.length)];
    return s;
  }

  // Refresh nickname from server
  fetch('/api/me',{headers:{Authorization:'Bearer '+token}})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){
      if(!d) return;
      if(d.nickname){ nickname=d.nickname; localStorage.setItem('lc_nickname',nickname); if(sn) sn.textContent=nickname; if(sa) sa.textContent=nickname.charAt(0).toUpperCase(); }
      if(d.avatar){ localStorage.setItem('lc_avatar',d.avatar); if(sa&&d.avatar){ sa.style.background='none'; sa.innerHTML='<img src="'+d.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>'; } }
    }).catch(function(){});

  // Recent calls
  (async function(){
    var list=document.getElementById('recentList');
    if(!list) return;
    try{
      var res=await fetch('/api/calls?limit=5',{headers:{Authorization:'Bearer '+token}});
      var data=await res.json();
      var calls=data.calls||[];
      if(!calls.length){ list.innerHTML='<div class="empty-state"><div class="empty-icon">📞</div>No calls yet — start one above!</div>'; return; }
      list.innerHTML='';
      calls.forEach(function(c){
        var p=c.participants&&c.participants.length?c.participants[0]:'Solo call';
        var init=p.charAt(0).toUpperCase();
        var dur=c.durationSec<60?(c.durationSec+'s'):Math.round(c.durationSec/60)+'m';
        var ago=relTime(c.startTime);
        var row=document.createElement('div'); row.className='recent-row';
        row.innerHTML='<div class="recent-avatar" style="background:var(--purple)">'+init+'</div>'
          +'<div class="recent-info"><div class="recent-name">'+esc(p)+'</div><div class="recent-meta">Room '+esc(c.roomId)+' · '+ago+'</div></div>'
          +'<div class="recent-dur">⏱ '+dur+'</div>';
        list.appendChild(row);
      });
    } catch(e){ list.innerHTML='<div class="empty-state">Could not load recent calls.</div>'; }
  })();

  function relTime(ms){
    var d=Date.now()-ms,m=Math.floor(d/60000);
    if(m<1) return 'just now'; if(m<60) return m+'m ago';
    var h=Math.floor(m/60); if(h<24) return h+'h ago';
    var dy=Math.floor(h/24); return dy===1?'yesterday':dy+'d ago';
  }
  function esc(s){ var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; }
})();
