// study-room.js — clean rewrite, handles both short and full question keys
(function(){
'use strict';
var token    = localStorage.getItem('lc_token');
var username = localStorage.getItem('lc_username');
var nickname = localStorage.getItem('lc_nickname') || username;
if(!token){ location.href='/index.html'; return; }

var params   = new URLSearchParams(location.search);
var roomId   = params.get('id');
var isHost   = params.get('host') === '1';
var category = params.get('cat') || 'dsa';
if(!roomId){ location.href='/study-rooms.html'; return; }

// ── Question bank (loaded from /data/questions.js) ──────────────
var Q = window.BM_QUESTIONS;
if(!Q){ console.error('BM_QUESTIONS not loaded!'); }

// ── State ────────────────────────────────────────────────────────
var state = {
  round: 1, qIndex: 0, completed: {},
  handRaised: false, micOn: true, camOn: true,
  pomoRunning: false, pomoIsStudy: true,
  pomoSeconds: 25*60, pomoTimer: null
};
var peers = {}, localStream = null, socket = null;
var codeTimer = null, codeSecs = 15;
var ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

function el(id){ return document.getElementById(id); }
function esc(s){ var d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

// ── Get current question list ─────────────────────────────────────
function getQuestions(){
  if(!Q) return [];
  if(category==='dsa'){ var r=Q.DSA_ROUNDS[state.round]; return r ? r.questions : []; }
  if(category==='java') return Q.JAVA||[];
  return Q.C||[];
}

// ── Render one question ───────────────────────────────────────────
function renderQuestion(){
  var qs = getQuestions();
  var total = qs.length;
  var q = qs[state.qIndex] || {};

  // Support BOTH short keys (t,d,tp,s,e,c) AND full keys (title,diff,topic,etc.)
  var title       = q.title      || q.t  || '(no title)';
  var diff        = q.diff       || q.d  || 'Easy';
  var topic       = q.topic      || q.tp || '';
  var statement   = q.statement  || q.s  || '(no statement)';
  var examples    = q.examples   || q.e  || [];
  var constraintsList = q.constraints || (q.c ? [q.c] : []);
  var qtext       = q.q          || title;   // Java/C use q.q
  var hint        = q.hint       || '';

  // Update header
  var prog = el('progressText');
  if(prog) prog.textContent = 'Question ' + (state.qIndex+1) + '/' + total;

  if(category === 'dsa'){
    var round = Q && Q.DSA_ROUNDS[state.round];
    var rb = el('roundBadge'); if(rb) rb.textContent = 'Round ' + state.round;
    var rl = el('roundLabel'); if(rl) rl.textContent = round ? round.label : '';
    var db = el('diffBadge');
    if(db){ db.textContent = diff; db.className = 'diff-badge ' + diff; }

    // Problem content
    var qId = el('qId'); if(qId) qId.textContent = 'Problem #' + ((state.round-1)*50 + state.qIndex+1);
    var qTitleEl = el('qTitle'); if(qTitleEl) qTitleEl.textContent = title;
    var qTags = el('qTags');
    if(qTags){
      qTags.innerHTML = '';
      [topic, diff].filter(Boolean).forEach(function(t){
        var sp = document.createElement('span'); sp.className = 'q-tag'; sp.textContent = t; qTags.appendChild(sp);
      });
    }
    var qStmt = el('qStatement'); if(qStmt) qStmt.textContent = statement;

    var wrap = el('qExamplesWrap');
    if(wrap){
      wrap.innerHTML = '';
      examples.forEach(function(ex, i){
        var inp = ex.input  || ex.i || '';
        var out = ex.output || ex.o || '';
        var exp = ex.explain|| ex.e || '';
        var div = document.createElement('div'); div.className = 'q-example';
        div.innerHTML = '<div class="ex-label">Example ' + (i+1) + '</div>'
          + '<code>Input: '  + esc(inp) + '</code>'
          + '<code>Output: ' + esc(out) + '</code>'
          + (exp ? '<code>Explanation: ' + esc(exp) + '</code>' : '');
        wrap.appendChild(div);
      });
    }
    var cl = el('qConstraintsLabel');
    var cv = el('qConstraints');
    var hasCons = constraintsList.length > 0;
    if(cl) cl.style.display = hasCons ? '' : 'none';
    if(cv){
      cv.style.display = hasCons ? '' : 'none';
      cv.innerHTML = '';
      constraintsList.forEach(function(c){
        var li = document.createElement('li'); li.textContent = c; cv.appendChild(li);
      });
    }
  } else {
    // Java / C
    var rb2 = el('roundBadge'); if(rb2) rb2.textContent = 'Q ' + (state.qIndex+1);
    var rl2 = el('roundLabel'); if(rl2) rl2.textContent = category==='java' ? '100 Java Questions' : '50 C Questions';
    var db2 = el('diffBadge'); if(db2){ db2.textContent=''; db2.className='diff-badge'; }
    var jn = el('jcQNum');    if(jn) jn.textContent = 'Q' + (state.qIndex+1) + ' / ' + total;
    var jt = el('jcQTitle');  if(jt) jt.textContent = qtext;
    var jp = el('jcTopic');   if(jp) jp.textContent = topic;
    var ht = el('hintText');  if(ht) ht.textContent = hint;
    var hb = el('hintBox');   if(hb) hb.style.display = 'none';
    var hbtn = el('hintToggleBtn'); if(hbtn) hbtn.textContent = 'Show Hint';
  }

  // Mark done state
  var key = state.round + '-' + state.qIndex;
  var done = !!state.completed[key];
  var mdb = el('markDoneBtn');
  if(mdb){ mdb.textContent = done ? '✓ Marked Done' : '☐ Mark Done'; mdb.className = 'mark-done-btn' + (done ? ' done' : ''); }

  // Nav button states
  var pBtn = el('prevBtn'), nBtn = el('nextBtn');
  if(pBtn) pBtn.disabled = (state.qIndex === 0) && (category !== 'dsa' || state.round === 1);
  if(nBtn) nBtn.disabled = (state.qIndex === total-1) && (category !== 'dsa' || state.round === 3);

  // Round pills active state
  document.querySelectorAll('.round-pill').forEach(function(p){
    p.classList.toggle('active', String(p.getAttribute('data-round')) === String(state.round));
  });
}

// ── Setup UI ──────────────────────────────────────────────────────
var CAT = { dsa:'DSA', java:'Java', c:'C' };
var chip = el('topbarCatChip');
if(chip){ chip.textContent = CAT[category] || category.toUpperCase(); chip.className = 'cat-chip ' + category; }

if(category==='dsa'){
  var da = el('dsaArea'); if(da) da.style.display = '';
  var ja = el('jcArea');  if(ja) ja.style.display = 'none';
} else {
  var da2 = el('dsaArea'); if(da2) da2.style.display = 'none';
  var ja2 = el('jcArea');  if(ja2) ja2.style.display = '';
}

if(isHost){
  var nb = el('navBtns');       if(nb) nb.style.display = 'flex';
  var rs = el('roundSelector'); if(rs) rs.style.display = category==='dsa' ? 'flex' : 'none';
  var hw = el('hostCodeWidget');if(hw) hw.style.display = 'flex';
  var wo = el('waitingOverlay');if(wo) wo.style.display = 'flex';
} else {
  var nb2 = el('navBtns');       if(nb2) nb2.style.display = 'none';
  var rs2 = el('roundSelector'); if(rs2) rs2.style.display = 'none';
  var hw2 = el('hostCodeWidget');if(hw2) hw2.style.display = 'none';
  var wo2 = el('waitingOverlay');if(wo2) wo2.style.display = 'none';
}

el('waitingStartBtn') && el('waitingStartBtn').addEventListener('click', function(){
  var w = el('waitingOverlay'); if(w) w.style.display = 'none';
});

el('copyCodeBtn') && el('copyCodeBtn').addEventListener('click', function(){
  var code = el('hostCodeDisplay'); if(!code) return;
  try{ navigator.clipboard.writeText(code.textContent); }catch(e){}
  el('copyCodeBtn').textContent = '✓';
  setTimeout(function(){ el('copyCodeBtn').textContent = '📋'; }, 1500);
});

// ── Navigation (host only) ────────────────────────────────────────
function emitQ(){ if(socket) socket.emit('study:next-question', { round: state.round, qIndex: state.qIndex }); }

if(isHost){
  el('nextBtn') && el('nextBtn').addEventListener('click', function(){
    var qs = getQuestions();
    if(state.qIndex < qs.length-1) state.qIndex++;
    else if(category==='dsa' && state.round < 3){ state.round++; state.qIndex = 0; }
    renderQuestion(); emitQ();
  });
  el('prevBtn') && el('prevBtn').addEventListener('click', function(){
    if(state.qIndex > 0) state.qIndex--;
    else if(category==='dsa' && state.round > 1){ state.round--; state.qIndex = getQuestions().length-1; }
    renderQuestion(); emitQ();
  });
  document.querySelectorAll('.round-pill').forEach(function(pill){
    pill.addEventListener('click', function(){
      state.round  = parseInt(pill.getAttribute('data-round'), 10);
      state.qIndex = 0;
      renderQuestion(); emitQ();
    });
  });
}

el('markDoneBtn') && el('markDoneBtn').addEventListener('click', function(){
  var key = state.round + '-' + state.qIndex;
  state.completed[key] = !state.completed[key];
  renderQuestion();
  if(socket) socket.emit('study:mark-complete', { round: state.round, questionIndex: state.qIndex, done: state.completed[key] });
});

el('hintToggleBtn') && el('hintToggleBtn').addEventListener('click', function(){
  var hb = el('hintBox');
  if(!hb) return;
  var showing = hb.style.display !== 'none';
  hb.style.display = showing ? 'none' : '';
  el('hintToggleBtn').textContent = showing ? 'Show Hint' : 'Hide Hint';
});

// ── Tabs ──────────────────────────────────────────────────────────
el('tabChat') && el('tabChat').addEventListener('click', function(){
  el('tabChat').classList.add('active');
  el('tabNotes').classList.remove('active');
  el('chatBody').style.display = '';
  el('notesBody').style.display = 'none';
});
el('tabNotes') && el('tabNotes').addEventListener('click', function(){
  el('tabNotes').classList.add('active');
  el('tabChat').classList.remove('active');
  el('notesBody').style.display = 'flex';
  el('chatBody').style.display = 'none';
});
var notesKey = 'bm_notes_' + roomId;
var nt = el('notesTextarea');
if(nt){ nt.value = localStorage.getItem(notesKey)||''; nt.addEventListener('input', function(){ localStorage.setItem(notesKey, nt.value); }); }

// ── Pomodoro ──────────────────────────────────────────────────────
function fmtTime(s){ var m=Math.floor(s/60),sc=s%60; return (m<10?'0':'')+m+':'+(sc<10?'0':'')+sc; }
function pomoTick(){
  if(!state.pomoRunning) return;
  state.pomoSeconds--;
  var pt = el('pomoTime'); if(pt) pt.textContent = fmtTime(state.pomoSeconds);
  if(state.pomoSeconds <= 0){
    state.pomoIsStudy = !state.pomoIsStudy;
    state.pomoSeconds = state.pomoIsStudy ? 25*60 : 5*60;
    var pp = el('pomoPhase'); if(pp) pp.textContent = state.pomoIsStudy ? 'STUDY' : 'BREAK';
    if(pt) pt.classList.toggle('break', !state.pomoIsStudy);
  }
}
el('pomoToggleBtn') && el('pomoToggleBtn').addEventListener('click', function(){
  state.pomoRunning = !state.pomoRunning;
  el('pomoToggleBtn').textContent = state.pomoRunning ? '⏸' : '▶';
  if(state.pomoRunning && !state.pomoTimer) state.pomoTimer = setInterval(pomoTick, 1000);
  else if(!state.pomoRunning){ clearInterval(state.pomoTimer); state.pomoTimer = null; }
});

// ── Code countdown ────────────────────────────────────────────────
function startCodeCountdown(){
  codeSecs = 15; updateCodeCountdown();
  if(codeTimer) clearInterval(codeTimer);
  codeTimer = setInterval(function(){ codeSecs--; if(codeSecs<=0) codeSecs=15; updateCodeCountdown(); }, 1000);
}
function updateCodeCountdown(){ var cc = el('codeCountdown'); if(cc) cc.textContent = codeSecs + 's'; }

// ── Video tiles ───────────────────────────────────────────────────
function addLocalTile(stream){
  if(el('tile-local')) return;
  var tile = document.createElement('div'); tile.className='study-video-tile'; tile.id='tile-local';
  var vid  = document.createElement('video'); vid.autoplay=true; vid.muted=true; vid.playsInline=true;
  if(stream) vid.srcObject = stream;
  var lbl  = document.createElement('div'); lbl.className='tile-name';
  lbl.innerHTML = (isHost ? '<span>👑</span> ' : '') + esc(nickname||'You');
  var hand = document.createElement('div'); hand.className='raised-hand-badge'; hand.textContent='✋';
  tile.appendChild(vid); tile.appendChild(lbl); tile.appendChild(hand);
  var vr = el('videoRow'); if(vr) vr.appendChild(tile);
}
function addRemoteTile(sid, name, stream){
  if(el('tile-'+sid)) return;
  var tile = document.createElement('div'); tile.className='study-video-tile'; tile.id='tile-'+sid;
  var vid  = document.createElement('video'); vid.autoplay=true; vid.playsInline=true; vid.srcObject=stream;
  var lbl  = document.createElement('div'); lbl.className='tile-name'; lbl.textContent=name||'Guest';
  var hand = document.createElement('div'); hand.className='raised-hand-badge'; hand.textContent='✋';
  tile.appendChild(vid); tile.appendChild(lbl); tile.appendChild(hand);
  var vr = el('videoRow'); if(vr) vr.appendChild(tile);
  updateCount();
}
function removeTile(sid){ var t=el('tile-'+sid); if(t) t.remove(); updateCount(); }
function updateCount(){
  var n = Object.keys(peers).length + 1;
  var ab = el('activityBadge');
  if(ab){ ab.textContent = n>1?'Active':'Waiting'; ab.className='activity-badge '+(n>1?'active':'waiting'); }
  if(isHost && n>1){ var wo=el('waitingOverlay'); if(wo) wo.style.display='none'; }
}

// ── WebRTC ────────────────────────────────────────────────────────
function createPeer(sid, name, initiator){
  var pc = new RTCPeerConnection({ iceServers: ICE });
  peers[sid] = { pc: pc };
  if(localStream) localStream.getTracks().forEach(function(t){ pc.addTrack(t, localStream); });
  pc.onicecandidate = function(e){ if(e.candidate && socket) socket.emit('study:signal', { to: sid, signalData: { type: 'candidate', candidate: e.candidate } }); };
  pc.ontrack = function(e){ addRemoteTile(sid, name, e.streams[0]); };
  pc.onconnectionstatechange = function(){ if(['disconnected','failed','closed'].indexOf(pc.connectionState)!==-1){ delete peers[sid]; removeTile(sid); } };
  if(initiator){ pc.onnegotiationneeded = async function(){
    try{ var o=await pc.createOffer(); await pc.setLocalDescription(o); socket&&socket.emit('study:signal',{to:sid,signalData:{type:'offer',sdp:pc.localDescription}}); }catch(e){}
  }; }
  return pc;
}

// ── Chat ──────────────────────────────────────────────────────────
function addChatMsg(who, msg, mine){
  var log = el('srChatLog'); if(!log) return;
  var wrap = document.createElement('div'); wrap.className='chat-msg'+(mine?' own':'');
  var av   = document.createElement('div'); av.className='chat-msg-av'; av.textContent=(who||'?').charAt(0).toUpperCase();
  var body = document.createElement('div'); body.className='chat-msg-body';
  var whe  = document.createElement('div'); whe.className='who'+(mine?' me':'');
  whe.innerHTML = esc(mine?'You':(who||'Guest')) + '<span class="time">'+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</span>';
  var bdy  = document.createElement('div'); bdy.className='body'; bdy.textContent=msg;
  body.appendChild(whe); body.appendChild(bdy); wrap.appendChild(av); wrap.appendChild(body);
  log.appendChild(wrap); log.scrollTop=log.scrollHeight;
}
var cf = el('srChatForm');
if(cf) cf.addEventListener('submit', function(e){
  e.preventDefault();
  var inp = el('srChatInput'); var msg = inp&&inp.value.trim(); if(!msg||!socket) return;
  socket.emit('study:chat-message', { message: msg }); addChatMsg(nickname, msg, true); inp.value='';
});

// ── Controls ──────────────────────────────────────────────────────
el('micBtn') && el('micBtn').addEventListener('click', function(){
  state.micOn=!state.micOn; if(localStream) localStream.getAudioTracks().forEach(function(t){t.enabled=state.micOn;});
  el('micBtn').classList.toggle('muted-state',!state.micOn); el('micBtn').textContent=state.micOn?'🎙️':'🔇';
});
el('camBtn') && el('camBtn').addEventListener('click', function(){
  state.camOn=!state.camOn; if(localStream) localStream.getVideoTracks().forEach(function(t){t.enabled=state.camOn;});
  el('camBtn').classList.toggle('muted-state',!state.camOn); el('camBtn').textContent=state.camOn?'📷':'🚫';
});
el('raiseHandBtn') && el('raiseHandBtn').addEventListener('click', function(){
  state.handRaised=!state.handRaised; el('raiseHandBtn').classList.toggle('active-state',state.handRaised);
  var lt=el('tile-local'); if(lt) lt.classList.toggle('hand-raised',state.handRaised);
  if(socket) socket.emit('study:raise-hand',{raised:state.handRaised});
});
var panelOpen=false;
el('panelToggleBtn') && el('panelToggleBtn').addEventListener('click', function(){
  panelOpen=!panelOpen; var rp=el('rightPanel'); if(rp) rp.classList.toggle('mobile-open',panelOpen);
});
el('leaveBtn') && el('leaveBtn').addEventListener('click', leaveRoom);
window.addEventListener('beforeunload', function(){ if(socket) socket.emit('study:leave'); });

function leaveRoom(){
  clearInterval(state.pomoTimer); clearInterval(codeTimer);
  if(socket){ socket.emit('study:leave'); socket.disconnect(); }
  Object.values(peers).forEach(function(p){ p.pc.close(); });
  if(localStream) localStream.getTracks().forEach(function(t){ t.stop(); });
  location.href = '/study-rooms.html';
}

// ── Socket events ─────────────────────────────────────────────────
async function init(){
  try{ localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true}); }
  catch(e){ localStream = null; }
  addLocalTile(localStream || new MediaStream());

  socket = io({ auth: { token: token } });
  socket.on('connect_error', function(e){ console.error('Socket error:', e.message); });
  socket.on('connect', function(){ socket.emit('study:join', { roomId: roomId, isHost: isHost }); });

  socket.on('study:joined', function(d){
    var rn = el('topbarRoomName'); if(rn) rn.textContent = d.roomName || 'Study Room';
    document.title = 'BlinkMeet — ' + (d.roomName||'Study Room');
    if(d.questionState){ state.round = d.questionState.round||1; state.qIndex = d.questionState.qIndex||0; }
    renderQuestion();
    if(isHost && d.code){
      var hc = el('hostCodeDisplay'); if(hc) hc.textContent = d.code;
      var wc = el('waitingCodeDisplay'); if(wc) wc.textContent = d.code;
      startCodeCountdown();
    }
    if(d.participants) d.participants.forEach(function(p){ createPeer(p.socketId, p.nickname||p.username, true); });
    updateCount();
  });

  socket.on('study:code-update', function(d){
    if(!isHost) return;
    var hc=el('hostCodeDisplay'); if(hc) hc.textContent=d.code;
    var wc=el('waitingCodeDisplay'); if(wc) wc.textContent=d.code;
    codeSecs=15; updateCodeCountdown();
  });

  socket.on('study:you-are-host', function(d){
    isHost=true;
    var hw=el('hostCodeWidget'); if(hw) hw.style.display='flex';
    var nb=el('navBtns'); if(nb) nb.style.display='flex';
    if(category==='dsa'){ var rs=el('roundSelector'); if(rs) rs.style.display='flex'; }
    if(d.code){ var hc=el('hostCodeDisplay'); if(hc) hc.textContent=d.code; startCodeCountdown(); }
  });

  socket.on('study:participant-joined', function(d){
    createPeer(d.socketId, d.nickname||d.username, false);
    if(isHost){ var wo=el('waitingOverlay'); if(wo) wo.style.display='none'; }
  });
  socket.on('study:participant-left', function(d){
    var p=peers[d.socketId]; if(p){ p.pc.close(); delete peers[d.socketId]; } removeTile(d.socketId);
  });

  socket.on('study:signal', async function(d){
    var from=d.from, sig=d.signalData, name=d.nickname||d.username||'Guest';
    if(!peers[from]) createPeer(from, name, false);
    var pc=peers[from].pc;
    try{
      if(sig.type==='offer'){ await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp)); var a=await pc.createAnswer(); await pc.setLocalDescription(a); socket.emit('study:signal',{to:from,signalData:{type:'answer',sdp:pc.localDescription}}); }
      else if(sig.type==='answer') await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
      else if(sig.type==='candidate') await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
    }catch(e){}
  });

  socket.on('study:question-update', function(d){
    if(isHost) return;
    if(d.round  !== undefined) state.round  = d.round;
    if(d.qIndex !== undefined) state.qIndex = d.qIndex;
    renderQuestion();
  });

  socket.on('study:hands-update', function(d){
    var hands=d.hands||[];
    document.querySelectorAll('.study-video-tile').forEach(function(t){ t.classList.remove('hand-raised'); });
    hands.forEach(function(h){ var t=el('tile-'+h.socketId); if(t&&h.raised) t.classList.add('hand-raised'); });
    var raised=hands.filter(function(h){return h.raised;}).map(function(h){return h.nickname||h.username;});
    var ht=el('handsToast');
    if(raised.length&&ht){ ht.textContent='✋ '+raised.join(', ')+' raised hand'; ht.style.display=''; setTimeout(function(){ht.style.display='none';},4000); }
  });

  socket.on('study:chat-message', function(d){ addChatMsg(d.nickname||d.username||'Guest', d.message, false); });
  socket.on('study:error', function(d){ alert(d.message||'Study room error.'); location.href='/study-rooms.html'; });
  socket.on('study:meta-update', function(d){
    var ab=el('activityBadge'); if(ab){ var n=d.participantCount||1; ab.textContent=n>1?'Active':'Waiting'; ab.className='activity-badge '+(n>1?'active':'waiting'); }
  });
}

init();
})();
