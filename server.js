// server.js
// Backend for BlinkMeet: auth (register/login) + Socket.io signaling
// for WebRTC video calls, text chat, and screen share.

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const {
  findUserByUsername,
  createUser,
  updateNickname,
  updateAvatar,
  getCallsForUser,
  insertCall,
  clearCallsForUser,
  getContacts,
  addContact,
  removeContact,
  setContactBlocked,
} = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- auth helper ----------
function getUsernameFromReq(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET).username;
  } catch {
    return null;
  }
}

// ---------- auth routes ----------
app.post('/api/register', async (req, res) => {
  const { username, nickname, password } = req.body || {};
  if (!username || !password || username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: 'Username (3+ chars) and password (4+ chars) required.' });
  }

  if (findUserByUsername(username)) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  const cleanNickname = (nickname || '').trim().slice(0, 40) || username;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: nanoid(8), username, nickname: cleanNickname, passwordHash };
  createUser(user);

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username, nickname: cleanNickname, avatar: null });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = findUserByUsername(username || '');
  if (!user) return res.status(401).json({ error: 'Invalid username or password.' });

  const ok = await bcrypt.compare(password || '', user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid username or password.' });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username, nickname: user.nickname || user.username, avatar: user.avatar || null });
});

app.get('/api/me', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });
  const user = findUserByUsername(username);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ username: user.username, nickname: user.nickname || user.username, avatar: user.avatar || null });
});

app.patch('/api/me', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });

  const { nickname, avatar } = req.body || {};

  if (nickname !== undefined) {
    const cleanNickname = (nickname || '').trim().slice(0, 40);
    if (!cleanNickname) return res.status(400).json({ error: 'Nickname cannot be empty.' });
    updateNickname(username, cleanNickname);
  }

  if (avatar !== undefined) {
    if (avatar !== null && (typeof avatar !== 'string' || !avatar.startsWith('data:image/'))) {
      return res.status(400).json({ error: 'Invalid photo format.' });
    }
    if (avatar && avatar.length > 700_000) {
      return res.status(413).json({ error: 'Photo is too large. Try a smaller image.' });
    }
    updateAvatar(username, avatar);
  }

  const user = findUserByUsername(username);
  res.json({ username, nickname: user.nickname || username, avatar: user.avatar || null });
});

app.get('/api/calls', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });

  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const calls = getCallsForUser(username, limit);

  res.json({ calls });
});

app.delete('/api/calls', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });

  const deleted = clearCallsForUser(username);
  res.json({ deleted });
});

// ---------- contacts ----------
app.get('/api/contacts', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });
  res.json({ contacts: getContacts(username) });
});

app.post('/api/contacts', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });

  const contactUsername = (req.body?.username || '').trim();
  if (!contactUsername) return res.status(400).json({ error: 'Username required.' });
  if (contactUsername.toLowerCase() === username.toLowerCase()) {
    return res.status(400).json({ error: "You can't add yourself." });
  }
  if (!findUserByUsername(contactUsername)) {
    return res.status(404).json({ error: 'No user found with that username.' });
  }

  addContact({ id: nanoid(8), owner: username, contactUsername });
  res.json({ contacts: getContacts(username) });
});

app.delete('/api/contacts/:username', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });

  removeContact(username, req.params.username);
  res.json({ contacts: getContacts(username) });
});

app.post('/api/contacts/:username/block', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });

  setContactBlocked({
    id: nanoid(8),
    owner: username,
    contactUsername: req.params.username,
    blocked: true,
  });
  res.json({ contacts: getContacts(username) });
});

app.post('/api/contacts/:username/unblock', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });

  setContactBlocked({
    id: nanoid(8),
    owner: username,
    contactUsername: req.params.username,
    blocked: false,
  });
  res.json({ contacts: getContacts(username) });
});

// ---------- Study Rooms ----------
// how many questions are in each round, per category
const ROUND_SIZES = {
  dsa:  [20, 20, 20],   // 3 rounds of 20 (arrays, strings, recursion)
  java: [100],          // single list of 100
  c:    [50],           // single list of 50
};

// studyRooms: roomId -> room state (in-memory; rooms are ephemeral study sessions)
const studyRooms = new Map();

function randomStudyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function rotateStudyCode(room) {
  room.prevCode = room.currentCode;
  room.currentCode = randomStudyCode();
  room.codeUpdatedAt = Date.now();
  if (room.hostSocketId) {
    io.to(room.hostSocketId).emit('study:code-update', { code: room.currentCode });
  }
}

function tickStudyTimer(room) {
  if (!room.timer.endsAt) return;
  if (Date.now() >= room.timer.endsAt) {
    const nextMode = room.timer.mode === 'study' ? 'break' : 'study';
    const durationMs = nextMode === 'study' ? 25 * 60 * 1000 : 5 * 60 * 1000;
    room.timer = { mode: nextMode, endsAt: Date.now() + durationMs };
    io.to('study:' + room.id).emit('study:timer-update', room.timer);
  }
}

function broadcastStudyMeta(room) {
  io.to('study:' + room.id).emit('study:meta-update', {
    participantCount: room.participants.size,
    maxParticipants: room.maxParticipants,
    hostUsername: room.hostUsername,
    hostNickname: room.hostNickname,
  });
}

function closeStudyRoom(roomId) {
  const room = studyRooms.get(roomId);
  if (!room) return;
  clearInterval(room.codeInterval);
  clearInterval(room.timerInterval);
  studyRooms.delete(roomId);
}

// ---------- study rooms ----------
app.get('/api/study-rooms', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });

  const rooms = Array.from(studyRooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    hostNickname: r.hostNickname,
    participantCount: r.participants.size,
    maxParticipants: r.maxParticipants,
  }));

  res.json({ rooms });
});

app.post('/api/study-rooms', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });

  const { roomName, category } = req.body || {};
  if (!ROUND_SIZES[category]) return res.status(400).json({ error: 'Invalid category.' });

  const user = findUserByUsername(username);
  const roomId = nanoid(10);
  const name = (roomName || '').trim().slice(0, 60) || `${category.toUpperCase()} Study Room`;

  studyRooms.set(roomId, {
    id: roomId,
    name,
    category,
    hostUsername: username,
    hostNickname: (user && user.nickname) || username,
    hostSocketId: null,
    createdAt: Date.now(),
    currentCode: randomStudyCode(),
    prevCode: null,
    codeUpdatedAt: Date.now(),
    codeInterval: null,
    timerInterval: null,
    participants: new Map(),
    maxParticipants: 4,
    round: 1,
    questionIndex: 0,
    completed: new Map(),
    raisedHands: new Set(),
    timer: { mode: 'study', endsAt: null },
  });

  res.json({ roomId, category });
});

app.post('/api/study-rooms/join', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Invalid or expired token.' });

  const code = (req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Enter a room code.' });

  const room = Array.from(studyRooms.values()).find((r) => r.currentCode === code || r.prevCode === code);
  if (!room) {
    return res.status(404).json({
      error: 'No active room found with that code. It refreshes every 15s — ask the host for the latest one.',
    });
  }
  if (room.participants.size >= room.maxParticipants) {
    return res.status(403).json({ error: 'This room is full (max 4 participants).' });
  }

  res.json({ roomId: room.id, category: room.category, roomName: room.name });
});

// ═══════════════════════════════════════════════════════════════
// GAME ROOMS
// ═══════════════════════════════════════════════════════════════
const { createGameState, applyGameAction } = require('./game-engine');

const gameRooms = new Map(); // roomCode -> room

function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return gameRooms.has(code) ? generateGameCode() : code;
}

const GAME_CONFIG = {
  ludo:      { min: 2, max: 4, label: 'Ludo' },
  uno:       { min: 2, max: 8, label: 'UNO' },
  tictactoe: { min: 2, max: 2, label: 'Tic-Tac-Toe' },
  skribbl:   { min: 2, max: 8, label: 'Draw & Guess' },
  tod:       { min: 2, max: 8, label: 'Truth or Dare' },
  nhie:      { min: 2, max: 10, label: 'Never Have I Ever' },
};

app.post('/api/game-rooms', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Unauthorized.' });
  const { game } = req.body || {};
  if (!GAME_CONFIG[game]) return res.status(400).json({ error: 'Invalid game type.' });
  const user = findUserByUsername(username);
  const code = generateGameCode();
  gameRooms.set(code, {
    code, game,
    hostUsername: username,
    hostNickname: (user && user.nickname) || username,
    players: new Map(),      // socketId -> { username, nickname, avatar, color }
    spectators: new Set(),
    state: null,             // null = lobby, object = in game
    phase: 'lobby',          // lobby | playing | ended
    scores: new Map(),       // username -> score
    chatLog: [],
    createdAt: Date.now(),
  });
  res.json({ code, game });
});

app.get('/api/game-rooms/:code', (req, res) => {
  const username = getUsernameFromReq(req);
  if (!username) return res.status(401).json({ error: 'Unauthorized.' });
  const room = gameRooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found. Check the code and try again.' });
  const cfg = GAME_CONFIG[room.game];
  if (room.players.size >= cfg.max && room.phase === 'playing')
    return res.status(403).json({ error: 'Game already in progress and room is full.' });
  res.json({ code: room.code, game: room.game, phase: room.phase, playerCount: room.players.size, maxPlayers: cfg.max });
});

// ── Game Socket Events ──────────────────────────────────────────────────────

const PLAYER_COLORS = ['#e8463a','#4c9fe8','#5fd99a','#f0c048','#c86de8','#f07850','#52d8e8','#e8a23d'];

function broadcastRoomState(room) {
  const players = Array.from(room.players.entries()).map(([sid, p]) => ({
    socketId: sid, username: p.username, nickname: p.nickname,
    avatar: p.avatar, color: p.color, score: room.scores.get(p.username) || 0,
  }));
  io.to('game:' + room.code).emit('game:room-state', {
    code: room.code, game: room.game, phase: room.phase,
    hostUsername: room.hostUsername, players,
    gameState: room.state,
    canStart: room.players.size >= GAME_CONFIG[room.game].min,
  });
}

// rooms: roomId -> Map(socketId -> username)
const rooms = new Map();
// roomSessions: roomId -> { startTime, participants: Set<username> } — used to log call history
const roomSessions = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No auth token'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.username = payload.username;
    const user = findUserByUsername(payload.username);
    socket.nickname = (user && user.nickname) || payload.username;
    socket.avatar   = (user && user.avatar)   || null;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentStudyRoom = null;

  socket.on('join-room', (roomId) => {
    if (!roomId) return;
    currentRoom = roomId;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Map(),       // socketId -> { username, nickname }
        hostUsername: null,
        coHosts: new Set(),     // usernames
        waiting: new Map(),     // socketId -> { username, nickname }
      });
    }
    const room = rooms.get(roomId);

    if (!roomSessions.has(roomId)) {
      roomSessions.set(roomId, { startTime: Date.now(), participants: new Set() });
    }
    roomSessions.get(roomId).participants.add(socket.username);

    // First person in becomes host automatically
    const isFirstPerson = room.users.size === 0 && room.waiting.size === 0;
    if (isFirstPerson) room.hostUsername = socket.username;

    const isHostOrCoHost = socket.username === room.hostUsername || room.coHosts.has(socket.username);

    if (isFirstPerson || isHostOrCoHost) {
      admitToRoom(roomId, room, socket);
    } else {
      // Put in waiting room; ask host + co-hosts to approve
      room.waiting.set(socket.id, { username: socket.username, nickname: socket.nickname });
      socket.join('lobby:' + roomId);
      socket.emit('waiting-for-approval', { roomId });

      const approverSocketIds = approverSocketIdsFor(roomId, room);
      approverSocketIds.forEach((sid) => {
        io.to(sid).emit('join-request', {
          socketId: socket.id,
          username: socket.username,
          nickname: socket.nickname,
        });
      });
    }
  });

  function approverSocketIdsFor(roomId, room) {
    const ids = [];
    room.users.forEach((u, sid) => {
      if (u.username === room.hostUsername || room.coHosts.has(u.username)) ids.push(sid);
    });
    return ids;
  }

  function admitToRoom(roomId, room, targetSocket) {
    targetSocket.join(roomId);

    const existing = Array.from(room.users.entries()).map(([id, u]) => ({
      socketId: id,
      username: u.username,
      nickname: u.nickname,
      isHost: u.username === room.hostUsername,
      isCoHost: room.coHosts.has(u.username),
    }));
    targetSocket.emit('room-users', existing);
    targetSocket.emit('role-update', {
      isHost: targetSocket.username === room.hostUsername,
      isCoHost: room.coHosts.has(targetSocket.username),
    });

    room.users.set(targetSocket.id, { username: targetSocket.username, nickname: targetSocket.nickname });

    targetSocket.to(roomId).emit('user-joined', {
      socketId: targetSocket.id,
      username: targetSocket.username,
      nickname: targetSocket.nickname,
      isHost: targetSocket.username === room.hostUsername,
      isCoHost: room.coHosts.has(targetSocket.username),
    });
  }

  // Host/co-host approves a waiting user
  socket.on('approve-join', ({ socketId } = {}) => {
    if (!currentRoom || !socketId) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const isApprover = socket.username === room.hostUsername || room.coHosts.has(socket.username);
    if (!isApprover) return;

    const waitingEntry = room.waiting.get(socketId);
    if (!waitingEntry) return;
    room.waiting.delete(socketId);

    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) return;
    targetSocket.leave('lobby:' + currentRoom);
    admitToRoom(currentRoom, room, targetSocket);
  });

  // Host/co-host denies a waiting user
  socket.on('deny-join', ({ socketId } = {}) => {
    if (!currentRoom || !socketId) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const isApprover = socket.username === room.hostUsername || room.coHosts.has(socket.username);
    if (!isApprover) return;

    room.waiting.delete(socketId);
    io.to(socketId).emit('join-denied');
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket) targetSocket.leave('lobby:' + currentRoom);
  });

  // Host promotes a participant to co-host
  socket.on('make-co-host', ({ targetUsername } = {}) => {
    if (!currentRoom || !targetUsername) return;
    const room = rooms.get(currentRoom);
    if (!room || socket.username !== room.hostUsername) return; // only host can promote
    room.coHosts.add(targetUsername);

    room.users.forEach((u, sid) => {
      if (u.username === targetUsername) {
        io.to(sid).emit('role-update', { isHost: false, isCoHost: true });
      }
    });
    io.to(currentRoom).emit('co-host-update', { username: targetUsername, isCoHost: true });
  });

  // Host revokes co-host status
  socket.on('revoke-co-host', ({ targetUsername } = {}) => {
    if (!currentRoom || !targetUsername) return;
    const room = rooms.get(currentRoom);
    if (!room || socket.username !== room.hostUsername) return;
    room.coHosts.delete(targetUsername);

    room.users.forEach((u, sid) => {
      if (u.username === targetUsername) {
        io.to(sid).emit('role-update', { isHost: false, isCoHost: false });
      }
    });
    io.to(currentRoom).emit('co-host-update', { username: targetUsername, isCoHost: false });
  });

  // generic relay for offer / answer / ice-candidate
  socket.on('signal', ({ to, signalData }) => {
    if (!to) return;
    io.to(to).emit('signal', { from: socket.id, username: socket.username, nickname: socket.nickname, signalData });
  });

  socket.on('chat-message', ({ roomId, message }) => {
    if (!roomId || !message) return;
    socket.to(roomId).emit('chat-message', {
      username: socket.username,
      nickname: socket.nickname,
      message: String(message).slice(0, 1000),
      timestamp: Date.now(),
    });
  });

  socket.on('leave-room', () => {
    leaveCurrentRoom();
  });

  // ---------- study rooms ----------
  socket.on('study:join', ({ roomId, isHost }) => {
    const room = studyRooms.get(roomId);
    if (!room) {
      socket.emit('study:error', { message: 'This study room no longer exists.' });
      return;
    }
    if (room.participants.size >= room.maxParticipants) {
      socket.emit('study:error', { message: 'Room is full (max 4 participants).' });
      return;
    }

    currentStudyRoom = roomId;
    socket.join('study:' + roomId);

    const existing = Array.from(room.participants.entries()).map(([id, u]) => ({
      socketId: id,
      username: u.username,
      nickname: u.nickname,
    }));

    room.participants.set(socket.id, { username: socket.username, nickname: socket.nickname });

    // first participant to connect becomes (or remains) the acting host
    if (!room.hostSocketId && (isHost || room.hostUsername === socket.username)) {
      room.hostSocketId = socket.id;
      room.hostUsername = socket.username;
      room.hostNickname = socket.nickname;
    } else if (!room.hostSocketId) {
      room.hostSocketId = socket.id;
      room.hostUsername = socket.username;
      room.hostNickname = socket.nickname;
    }

    if (!room.codeInterval) {
      room.codeInterval = setInterval(() => rotateStudyCode(room), 15000);
    }
    if (!room.timer.endsAt) {
      room.timer = { mode: 'study', endsAt: Date.now() + 25 * 60 * 1000 };
    }
    if (!room.timerInterval) {
      room.timerInterval = setInterval(() => tickStudyTimer(room), 1000);
    }

    const amHost = room.hostSocketId === socket.id;
    const completedForMe = Array.from(room.completed.get(socket.username) || []);

    socket.emit('study:joined', {
      roomName: room.name,
      category: room.category,
      hostUsername: room.hostUsername,
      hostNickname: room.hostNickname,
      code: amHost ? room.currentCode : undefined,
      participants: existing,
      isHost: amHost,
      questionState: { round: room.round, qIndex: room.questionIndex },
      completed: completedForMe,
      raisedHands: Array.from(room.raisedHands),
      timer: room.timer,
    });

    socket.to('study:' + roomId).emit('study:participant-joined', {
      socketId: socket.id,
      username: socket.username,
      nickname: socket.nickname,
    });

    broadcastStudyMeta(room);
  });

  socket.on('study:next-question', ({ round, qIndex } = {}) => {
    const room = studyRooms.get(currentStudyRoom);
    if (!room || room.hostSocketId !== socket.id) return;
    // trust the client's round/qIndex (client has the question bank)
    if (round !== undefined) room.round = round;
    if (qIndex !== undefined) room.questionIndex = qIndex;
    io.to('study:' + currentStudyRoom).emit('study:question-update', {
      round: room.round,
      qIndex: room.questionIndex,
    });
  });

  socket.on('study:prev-question', ({ round, qIndex } = {}) => {
    const room = studyRooms.get(currentStudyRoom);
    if (!room || room.hostSocketId !== socket.id) return;
    if (round !== undefined) room.round = round;
    if (qIndex !== undefined) room.questionIndex = qIndex;
    io.to('study:' + currentStudyRoom).emit('study:question-update', {
      round: room.round,
      qIndex: room.questionIndex,
    });
  });

  socket.on('study:mark-complete', ({ round, questionIndex, done }) => {
    const room = studyRooms.get(currentStudyRoom);
    if (!room) return;
    if (!room.completed.has(socket.username)) room.completed.set(socket.username, new Set());
    const key = round + '-' + questionIndex;
    const set = room.completed.get(socket.username);
    if (done) set.add(key); else set.delete(key);
    socket.emit('study:complete-ack', { key, done });
  });

  socket.on('study:raise-hand', ({ raised } = {}) => {
    const room = studyRooms.get(currentStudyRoom);
    if (!room) return;
    const isRaised = raised !== undefined ? !!raised : !room.raisedHands.has(socket.username);
    if (isRaised) room.raisedHands.add(socket.username);
    else room.raisedHands.delete(socket.username);
    const hands = Array.from(room.participants.entries())
      .map(([sid, u]) => ({ socketId: sid, username: u.username, nickname: u.nickname, raised: room.raisedHands.has(u.username) }));
    io.to('study:' + currentStudyRoom).emit('study:hands-update', { hands });
  });

  socket.on('study:signal', ({ to, signalData }) => {
    if (!to) return;
    io.to(to).emit('study:signal', {
      from: socket.id,
      username: socket.username,
      nickname: socket.nickname,
      signalData,
    });
  });

  socket.on('study:chat-message', ({ message }) => {
    if (!currentStudyRoom || !message) return;
    socket.to('study:' + currentStudyRoom).emit('study:chat-message', {
      username: socket.username,
      nickname: socket.nickname,
      message: String(message).slice(0, 1000),
      timestamp: Date.now(),
    });
  });

  socket.on('study:leave', () => { leaveCurrentStudyRoom(); });

  // ── Game room socket events ─────────────────────────────────
  let currentGameRoom = null;

  socket.on('game:join', ({ code }) => {
    const room = gameRooms.get((code || '').toUpperCase());
    if (!room) { socket.emit('game:error', { message: 'Room not found. Double-check the code.' }); return; }
    const cfg = GAME_CONFIG[room.game];
    if (room.players.size >= cfg.max && !room.players.has(socket.id)) {
      socket.emit('game:error', { message: 'Room is full!' }); return;
    }
    currentGameRoom = room.code;
    socket.join('game:' + room.code);
    const colorIndex = room.players.size % PLAYER_COLORS.length;
    room.players.set(socket.id, {
      username: socket.username,
      nickname: socket.nickname,
      avatar: socket.avatar || null,
      color: PLAYER_COLORS[colorIndex],
    });
    if (!room.scores.has(socket.username)) room.scores.set(socket.username, 0);
    socket.emit('game:joined', { code: room.code, game: room.game, isHost: room.hostUsername === socket.username });
    broadcastRoomState(room);
    // send recent chat
    if (room.chatLog.length) socket.emit('game:chat-history', room.chatLog.slice(-30));
  });

  socket.on('game:start', () => {
    if (!currentGameRoom) return;
    const room = gameRooms.get(currentGameRoom);
    if (!room || room.hostUsername !== socket.username) return;
    const cfg = GAME_CONFIG[room.game];
    if (room.players.size < cfg.min) {
      socket.emit('game:error', { message: `Need at least ${cfg.min} players to start.` });
      return;
    }
    try {
      const playerList = Array.from(room.players.values()).map((p, i) => ({ ...p, index: i }));
      room.state = createGameState(room.game, playerList);
      room.phase = 'playing';
      broadcastRoomState(room);
    } catch (e) {
      console.error('game:start error:', e);
      socket.emit('game:error', { message: 'Failed to start game: ' + (e.message || 'Unknown error') });
    }
  });

  socket.on('game:action', ({ action, payload }) => {
    if (!currentGameRoom) return;
    const room = gameRooms.get(currentGameRoom);
    if (!room || room.phase !== 'playing') return;
    const player = room.players.get(socket.id);
    if (!player) return;
    try {
      const result = applyGameAction(room.game, room.state, { action, payload, username: player.username, socketId: socket.id });
      if (result.error) { socket.emit('game:action-error', { message: result.error }); return; }
      room.state = result.state;
      if (result.winners) {
        room.phase = 'ended';
        result.winners.forEach(w => { room.scores.set(w, (room.scores.get(w) || 0) + 1); });
        io.to('game:' + room.code).emit('game:ended', { winners: result.winners, scores: Object.fromEntries(room.scores) });
      }
      broadcastRoomState(room);
    } catch (e) {
      socket.emit('game:action-error', { message: 'Invalid move.' });
    }
  });

  socket.on('game:play-again', () => {
    if (!currentGameRoom) return;
    const room = gameRooms.get(currentGameRoom);
    if (!room || room.hostUsername !== socket.username) return;
    try {
      const playerList = Array.from(room.players.values()).map((p, i) => ({ ...p, index: i }));
      room.state = createGameState(room.game, playerList);
      room.phase = 'playing';
      broadcastRoomState(room);
    } catch (e) {
      console.error('game:play-again error:', e);
      socket.emit('game:error', { message: 'Could not restart: ' + (e.message || 'Unknown error') });
    }
  });

  socket.on('game:chat', ({ message }) => {
    if (!currentGameRoom || !message) return;
    const room = gameRooms.get(currentGameRoom);
    if (!room) return;
    const player = room.players.get(socket.id);
    const entry = { nickname: (player && player.nickname) || socket.nickname, message: String(message).slice(0, 300), ts: Date.now() };
    room.chatLog.push(entry);
    if (room.chatLog.length > 200) room.chatLog = room.chatLog.slice(-200);
    io.to('game:' + room.code).emit('game:chat', entry);
  });

  socket.on('game:react', ({ emoji }) => {
    if (!currentGameRoom) return;
    const SAFE = ['👍','😂','🔥','😮','❤️','💀','🎉','👏'];
    if (!SAFE.includes(emoji)) return;
    io.to('game:' + currentGameRoom).emit('game:react', { nickname: socket.nickname, emoji });
  });

  socket.on('game:leave', () => { leaveCurrentGameRoom(); });

  function leaveCurrentGameRoom() {
    if (!currentGameRoom) return;
    const room = gameRooms.get(currentGameRoom);
    if (room) {
      room.players.delete(socket.id);
      if (room.players.size === 0) {
        gameRooms.delete(currentGameRoom);
      } else {
        if (room.hostUsername === socket.username) {
          const next = room.players.values().next().value;
          if (next) room.hostUsername = next.username;
        }
        broadcastRoomState(room);
      }
    }
    socket.leave('game:' + currentGameRoom);
    currentGameRoom = null;
  }

  socket.on('disconnect', () => {
    leaveCurrentRoom();
    leaveCurrentStudyRoom();
    leaveCurrentGameRoom();
  });

  function leaveCurrentStudyRoom() {
    if (!currentStudyRoom) return;
    const room = studyRooms.get(currentStudyRoom);
    if (room) {
      room.participants.delete(socket.id);
      room.raisedHands.delete(socket.username);

      if (room.hostSocketId === socket.id) {
        const next = room.participants.keys().next();
        if (next.done) {
          room.hostSocketId = null;
        } else {
          room.hostSocketId = next.value;
          const nextUser = room.participants.get(next.value);
          room.hostUsername = nextUser.username;
          room.hostNickname = nextUser.nickname;
          io.to(next.value).emit('study:you-are-host', { code: room.currentCode });
        }
      }

      if (room.participants.size === 0) {
        closeStudyRoom(currentStudyRoom);
      } else {
        socket.to('study:' + currentStudyRoom).emit('study:participant-left', { socketId: socket.id });
        broadcastStudyMeta(room);
      }
    }
    socket.leave('study:' + currentStudyRoom);
    currentStudyRoom = null;
  }

  function leaveCurrentRoom() {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (room) {
      const wasInRoom = room.users.has(socket.id);
      room.users.delete(socket.id);
      room.waiting.delete(socket.id);
      room.coHosts.delete(socket.username);

      // If the host left, hand host role to the oldest remaining co-host, else oldest participant
      if (wasInRoom && socket.username === room.hostUsername) {
        let nextHost = null;
        room.users.forEach((u) => { if (!nextHost && room.coHosts.has(u.username)) nextHost = u.username; });
        if (!nextHost) {
          const first = room.users.values().next();
          if (!first.done) nextHost = first.value.username;
        }
        room.hostUsername = nextHost;
        if (nextHost) {
          room.coHosts.delete(nextHost);
          room.users.forEach((u, sid) => {
            if (u.username === nextHost) io.to(sid).emit('role-update', { isHost: true, isCoHost: false });
          });
          io.to(currentRoom).emit('host-update', { username: nextHost });
        }
      }

      if (room.users.size === 0 && room.waiting.size === 0) {
        rooms.delete(currentRoom);
        finalizeRoomSession(currentRoom);
      }
    }
    socket.to(currentRoom).emit('user-left', { socketId: socket.id });
    socket.to('lobby:' + currentRoom).emit('join-cancelled', { socketId: socket.id });
    socket.leave(currentRoom);
    socket.leave('lobby:' + currentRoom);
    currentRoom = null;
  }
});

function finalizeRoomSession(roomId) {
  const session = roomSessions.get(roomId);
  if (!session) return;
  roomSessions.delete(roomId);

  const durationSec = Math.max(1, Math.round((Date.now() - session.startTime) / 1000));
  const participants = Array.from(session.participants);
  if (participants.length === 0) return;

  participants.forEach((owner) => {
    insertCall({
      id: nanoid(8),
      owner,
      roomId,
      participants: participants.filter((p) => p !== owner),
      startTime: session.startTime,
      durationSec,
    });
  });
}

server.listen(PORT, () => {
  console.log(`BlinkMeet server running at http://localhost:${PORT}`);
});
