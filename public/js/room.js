// room.js — WebRTC mesh calling, chat, invite-share, waiting-room approval, co-host
(function () {
  'use strict';
  const token       = localStorage.getItem('lc_token');
  const myUsername   = localStorage.getItem('lc_username');
  const myNickname   = localStorage.getItem('lc_nickname') || myUsername;
  if (!token) { window.location.href = '/index.html'; return; }

  const roomId = new URLSearchParams(window.location.search).get('room');
  if (!roomId) { window.location.href = '/home.html'; return; }

  const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

  let localStream  = null;
  let micOn = true, camOn = true, screenSharing = false;
  let isHost = false, isCoHost = false;
  const peers = {}; // socketId -> { pc, displayName }

  function el(id) { return document.getElementById(id); }
  function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

  el('roomLabel').textContent = 'Room ' + roomId;

  // ── Copy room code ─────────────────────────────────────────────
  const copyCodeBtn = el('copyCodeBtn');
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(roomId); copyCodeBtn.textContent = 'Copied!'; copyCodeBtn.classList.add('copied'); }
      catch { copyCodeBtn.textContent = roomId; }
      setTimeout(() => { copyCodeBtn.textContent = 'Copy code'; copyCodeBtn.classList.remove('copied'); }, 1800);
    });
  }

  // ── Invite / share modal ────────────────────────────────────────
  const inviteBtn       = el('inviteBtn');
  const inviteModal      = el('inviteModal');
  const inviteLinkInput = el('inviteLinkInput');
  const inviteCopyToast = el('inviteCopyToast');

  function openInviteModal() {
    const link = window.location.origin + '/room.html?room=' + roomId;
    if (inviteLinkInput) inviteLinkInput.value = link;
    const shareText = encodeURIComponent('Join my BlinkMeet meeting: ' + link);
    const wa = el('inviteWhatsapp'), em = el('inviteEmail'), sms = el('inviteSMS');
    if (wa)  wa.href  = 'https://wa.me/?text=' + shareText;
    if (em)  em.href  = 'mailto:?subject=' + encodeURIComponent('Join my BlinkMeet meeting') + '&body=' + shareText;
    if (sms) sms.href = 'sms:?body=' + shareText;
    if (inviteCopyToast) inviteCopyToast.classList.remove('show');
    if (inviteModal) inviteModal.classList.add('open');
  }
  if (inviteBtn) inviteBtn.addEventListener('click', openInviteModal);
  const inviteModalClose = el('inviteModalClose');
  if (inviteModalClose) inviteModalClose.addEventListener('click', () => inviteModal.classList.remove('open'));
  if (inviteModal) inviteModal.addEventListener('click', (e) => { if (e.target === inviteModal) inviteModal.classList.remove('open'); });

  const copyInviteLinkBtn = el('copyInviteLinkBtn');
  if (copyInviteLinkBtn) copyInviteLinkBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(inviteLinkInput.value); }
    catch { inviteLinkInput.select(); document.execCommand('copy'); }
    if (inviteCopyToast) { inviteCopyToast.classList.add('show'); setTimeout(() => inviteCopyToast.classList.remove('show'), 2500); }
  });

  // ── DOM refs ────────────────────────────────────────────────────
  const videoGrid         = el('videoGrid');
  const emptyNote         = el('emptyNote');
  const participantCount  = el('participantCount');
  const chatPanel         = el('chatPanel');
  const chatLog           = el('chatLog');
  const chatForm          = el('chatForm');
  const chatInput         = el('chatInput');
  const micBtn            = el('micBtn');
  const camBtn            = el('camBtn');
  const shareBtn          = el('shareBtn');
  const chatBtn           = el('chatBtn');
  const leaveBtn          = el('leaveBtn');
  const waitingOverlay    = el('waitingApprovalOverlay');
  const deniedOverlay     = el('joinDeniedOverlay');
  const joinRequestsPanel = el('joinRequestsPanel');
  const joinRequestsList  = el('joinRequestsList');
  const joinRequestsCount = el('joinRequestsCount');

  // ── Video tiles (new design classes) ─────────────────────────────
  function addLocalTile() {
    if (emptyNote) emptyNote.style.display = 'none';
    const tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = 'tile-local';

    const video = document.createElement('video');
    video.id = 'video-local';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    if (localStream) video.srcObject = localStream;

    const label = document.createElement('div');
    label.className = 'video-tile-label';
    label.id = 'label-local';
    label.innerHTML = '👤 You' + (isHost ? ' <span style="color:var(--yellow)">👑 Host</span>' : isCoHost ? ' <span style="color:var(--purple)">⭐ Co-Host</span>' : '');

    tile.appendChild(video);
    tile.appendChild(label);
    videoGrid.appendChild(tile);
  }

  function addRemoteTile(socketId, displayName, stream, roleInfo) {
    if (document.getElementById('tile-' + socketId)) return;
    if (emptyNote) emptyNote.style.display = 'none';

    const tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = 'tile-' + socketId;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;

    const label = document.createElement('div');
    label.className = 'video-tile-label';
    label.id = 'label-' + socketId;
    label.innerHTML = renderRoleBadge(displayName, roleInfo);

    tile.appendChild(video);
    tile.appendChild(label);

    // Host/co-host can click a participant tile to manage co-host role
    if (isHost) {
      tile.style.cursor = 'pointer';
      tile.title = 'Click to manage this participant';
      tile.addEventListener('click', () => openParticipantMenu(socketId, displayName, roleInfo));
    }

    videoGrid.appendChild(tile);
    updateParticipantCount();
  }

  function renderRoleBadge(displayName, roleInfo) {
    let badge = '';
    if (roleInfo && roleInfo.isHost) badge = ' <span style="color:var(--yellow)">👑 Host</span>';
    else if (roleInfo && roleInfo.isCoHost) badge = ' <span style="color:var(--purple)">⭐ Co-Host</span>';
    return '👤 ' + esc(displayName || 'Guest') + badge;
  }

  function removeRemoteTile(socketId) {
    const tile = document.getElementById('tile-' + socketId);
    if (tile) tile.remove();
    updateParticipantCount();
  }

  function updateParticipantCount() {
    const count = Object.keys(peers).length + 1;
    if (participantCount) participantCount.textContent = count + (count === 1 ? ' participant' : ' participants');
    if (emptyNote) emptyNote.style.display = count === 1 ? 'block' : 'none';
  }

  // ── Participant management menu (host only) ──────────────────────
  function openParticipantMenu(socketId, displayName, roleInfo) {
    const peer = peers[socketId];
    const username = peer && peer.username;
    if (!username || username === myUsername) return;

    const alreadyCoHost = roleInfo && roleInfo.isCoHost;
    const action = alreadyCoHost ? 'Remove as Co-Host' : 'Make Co-Host';
    if (!confirm(displayName + '\n\n' + action + '?')) return;

    if (alreadyCoHost) socket.emit('revoke-co-host', { targetUsername: username });
    else socket.emit('make-co-host', { targetUsername: username });
  }

  // ── WebRTC peer connection ─────────────────────────────────────
  function createPeerConnection(socketId, displayName, isInitiator, username, roleInfo) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peers[socketId] = { pc, displayName, username, roleInfo: roleInfo || {} };

    if (localStream) localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('signal', { to: socketId, signalData: { type: 'candidate', candidate: e.candidate } });
    };

    pc.ontrack = (e) => { addRemoteTile(socketId, displayName, e.streams[0], roleInfo); };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        removeRemoteTile(socketId);
        delete peers[socketId];
      }
    };

    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('signal', { to: socketId, signalData: { type: 'offer', sdp: pc.localDescription } });
        } catch (e) {}
      };
    }
    return pc;
  }

  // ── Chat ────────────────────────────────────────────────────────
  function appendChat(who, msg, isMe) {
    if (!chatLog) return;
    const wrap = document.createElement('div'); wrap.className = 'chat-msg' + (isMe ? ' own' : '');
    const av = document.createElement('div'); av.className = 'chat-msg-av'; av.textContent = (who || '?').charAt(0).toUpperCase();
    const body = document.createElement('div'); body.className = 'chat-msg-body';
    const whoEl = document.createElement('div'); whoEl.className = 'who' + (isMe ? ' me' : '');
    whoEl.innerHTML = esc(isMe ? 'You' : (who || 'Guest')) + '<span class="time">' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span>';
    const bodyEl = document.createElement('div'); bodyEl.className = 'body'; bodyEl.textContent = msg;
    body.appendChild(whoEl); body.appendChild(bodyEl);
    wrap.appendChild(av); wrap.appendChild(body);
    chatLog.appendChild(wrap); chatLog.scrollTop = chatLog.scrollHeight;
  }

  if (chatForm) chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg) return;
    socket.emit('chat-message', { roomId, message: msg });
    appendChat(myNickname, msg, true);
    chatInput.value = '';
  });

  // ── Controls ────────────────────────────────────────────────────
  if (micBtn) micBtn.addEventListener('click', () => {
    micOn = !micOn;
    if (localStream) localStream.getAudioTracks().forEach((t) => (t.enabled = micOn));
    micBtn.classList.toggle('muted-state', !micOn);
    micBtn.textContent = micOn ? '🎙️' : '🔇';
  });

  if (camBtn) camBtn.addEventListener('click', () => {
    camOn = !camOn;
    if (localStream) localStream.getVideoTracks().forEach((t) => (t.enabled = camOn));
    camBtn.classList.toggle('muted-state', !camOn);
    camBtn.textContent = camOn ? '📷' : '🚫';
  });

  if (shareBtn) shareBtn.addEventListener('click', async () => {
    try {
      if (!screenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        Object.values(peers).forEach(({ pc }) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });
        const localVideo = el('video-local');
        if (localVideo) localVideo.srcObject = screenStream;
        screenTrack.onended = () => stopScreenShare();
        screenSharing = true;
        shareBtn.classList.add('active-state');
      } else {
        stopScreenShare();
      }
    } catch (e) {}
  });

  function stopScreenShare() {
    if (!localStream) return;
    const camTrack = localStream.getVideoTracks()[0];
    Object.values(peers).forEach(({ pc }) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender && camTrack) sender.replaceTrack(camTrack);
    });
    const localVideo = el('video-local');
    if (localVideo) localVideo.srcObject = localStream;
    screenSharing = false;
    if (shareBtn) shareBtn.classList.remove('active-state');
  }

  let chatOpen = false;
  if (chatBtn) chatBtn.addEventListener('click', () => {
    chatOpen = !chatOpen;
    if (chatPanel) chatPanel.classList.toggle('hidden', !chatOpen);
    chatBtn.classList.toggle('active-state', chatOpen);
  });

  function leaveRoom() {
    socket.emit('leave-room');
    Object.values(peers).forEach(({ pc }) => pc.close());
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    window.location.href = '/home.html';
  }
  if (leaveBtn) leaveBtn.addEventListener('click', leaveRoom);
  window.addEventListener('beforeunload', () => { try { socket.emit('leave-room'); } catch (e) {} });

  // ── Join requests panel (host/co-host) ────────────────────────────
  const pendingRequests = {}; // socketId -> {username, nickname}

  function renderJoinRequests() {
    if (!joinRequestsPanel) return;
    const ids = Object.keys(pendingRequests);
    joinRequestsPanel.style.display = ids.length ? 'block' : 'none';
    if (joinRequestsCount) joinRequestsCount.textContent = ids.length;
    if (!joinRequestsList) return;
    joinRequestsList.innerHTML = '';
    ids.forEach((sid) => {
      const req = pendingRequests[sid];
      const row = document.createElement('div');
      row.style.cssText = 'padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px';
      row.innerHTML = '<div class="recent-avatar" style="background:var(--purple);width:30px;height:30px;font-size:12px">' + (req.nickname || '?').charAt(0).toUpperCase() + '</div>'
        + '<div style="flex:1;min-width:0;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(req.nickname || req.username) + '</div>'
        + '<button class="btn btn-primary btn-sm" data-act="approve" data-sid="' + sid + '" style="padding:5px 10px">✓</button>'
        + '<button class="btn btn-danger btn-sm" data-act="deny" data-sid="' + sid + '" style="padding:5px 10px">✕</button>';
      row.querySelector('[data-act="approve"]').addEventListener('click', () => {
        socket.emit('approve-join', { socketId: sid });
        delete pendingRequests[sid];
        renderJoinRequests();
      });
      row.querySelector('[data-act="deny"]').addEventListener('click', () => {
        socket.emit('deny-join', { socketId: sid });
        delete pendingRequests[sid];
        renderJoinRequests();
      });
      joinRequestsList.appendChild(row);
    });
  }

  // ── Socket setup ───────────────────────────────────────────────
  const socket = io({ auth: { token } });

  socket.on('connect_error', (e) => console.error('Socket error:', e.message));

  socket.on('connect', async () => {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (e) {
      localStream = null;
    }
    addLocalTile();
    socket.emit('join-room', roomId);
  });

  // Waiting room — I am waiting for host approval
  socket.on('waiting-for-approval', () => {
    if (waitingOverlay) waitingOverlay.classList.add('open');
  });

  // Host/co-host approved me — start receiving room state
  socket.on('room-users', (users) => {
    if (waitingOverlay) waitingOverlay.classList.remove('open');
    users.forEach((u) => createPeerConnection(u.socketId, u.nickname || u.username, true, u.username, { isHost: u.isHost, isCoHost: u.isCoHost }));
  });

  socket.on('role-update', ({ isHost: h, isCoHost: c }) => {
    isHost = h; isCoHost = c;
    const localLabel = el('label-local');
    if (localLabel) localLabel.innerHTML = '👤 You' + (isHost ? ' <span style="color:var(--yellow)">👑 Host</span>' : isCoHost ? ' <span style="color:var(--purple)">⭐ Co-Host</span>' : '');
    if (!isHost && joinRequestsPanel) joinRequestsPanel.style.display = 'none';
  });

  socket.on('host-update', ({ username }) => {
    Object.keys(peers).forEach((sid) => {
      const p = peers[sid];
      if (p.username === username) p.roleInfo = { isHost: true, isCoHost: false };
      const lbl = el('label-' + sid);
      if (lbl && p.username === username) lbl.innerHTML = renderRoleBadge(p.displayName, p.roleInfo);
    });
  });

  socket.on('co-host-update', ({ username, isCoHost: c }) => {
    Object.keys(peers).forEach((sid) => {
      const p = peers[sid];
      if (p.username === username) {
        p.roleInfo = { isHost: false, isCoHost: c };
        const lbl = el('label-' + sid);
        if (lbl) lbl.innerHTML = renderRoleBadge(p.displayName, p.roleInfo);
      }
    });
  });

  socket.on('user-joined', (data) => {
    createPeerConnection(data.socketId, data.nickname || data.username, false, data.username, { isHost: data.isHost, isCoHost: data.isCoHost });
  });

  socket.on('user-left', (data) => {
    const p = peers[data.socketId];
    if (p) { p.pc.close(); delete peers[data.socketId]; }
    removeRemoteTile(data.socketId);
  });

  socket.on('signal', async (data) => {
    const from = data.from;
    const sig = data.signalData;
    const name = data.nickname || data.username || 'Guest';
    if (!peers[from]) createPeerConnection(from, name, false, data.username, {});
    const pc = peers[from].pc;
    try {
      if (sig.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, signalData: { type: 'answer', sdp: pc.localDescription } });
      } else if (sig.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
      } else if (sig.type === 'candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
      }
    } catch (e) {}
  });

  socket.on('chat-message', (data) => { appendChat(data.nickname || data.username || 'Guest', data.message, false); });

  // Host/co-host: someone is waiting to join
  socket.on('join-request', (data) => {
    pendingRequests[data.socketId] = { username: data.username, nickname: data.nickname };
    renderJoinRequests();
  });

  // The waiting user left before being approved
  socket.on('join-cancelled', (data) => {
    delete pendingRequests[data.socketId];
    renderJoinRequests();
  });

  // I was denied entry
  socket.on('join-denied', () => {
    if (waitingOverlay) waitingOverlay.classList.remove('open');
    if (deniedOverlay) deniedOverlay.classList.add('open');
  });
})();
