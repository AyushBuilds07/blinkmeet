// game-engine.js — BlinkMeet Game Rooms (clean rewrite)
// Exports: createGameState(game, players) -> state
//          applyGameAction(game, state, ctx) -> { state, winners?, error? }
'use strict';

function createGameState(game, players) {
  switch (game) {
    case 'ludo':      return initLudo(players);
    case 'uno':       return initUno(players);
    case 'tictactoe': return initTTT(players);
    case 'skribbl':   return initSkribbl(players);
    case 'tod':       return initTOD(players);
    case 'nhie':      return initNHIE(players);
    default: throw new Error('Unknown game: ' + game);
  }
}

function applyGameAction(game, state, ctx) {
  const s = deepClone(state);
  try {
    switch (game) {
      case 'ludo':      return ludoAction(s, ctx);
      case 'uno':       return unoAction(s, ctx);
      case 'tictactoe': return tttAction(s, ctx);
      case 'skribbl':   return skribblAction(s, ctx);
      case 'tod':       return todAction(s, ctx);
      case 'nhie':      return nhieAction(s, ctx);
      default: return { error: 'Unknown game', state: s };
    }
  } catch (e) {
    return { error: e.message || 'Game error', state: s };
  }
}

function ok(state, extra)  { return { state, ...(extra || {}) }; }
function fail(msg, state)  { return { error: msg, state }; }
function deepClone(obj)    { return JSON.parse(JSON.stringify(obj)); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════════════════════════
// LUDO
// ═══════════════════════════════════════════════════════════
const LUDO_COLORS  = ['red', 'blue', 'green', 'yellow'];
const LUDO_ENTRY   = { red: 0, blue: 13, green: 26, yellow: 39 };
const LUDO_SAFE    = new Set([0,8,13,21,26,34,39,47]);

function initLudo(players) {
  const colors = LUDO_COLORS.slice(0, players.length);
  const tokens = {};
  colors.forEach(c => {
    tokens[c] = [{ pos:-1 },{ pos:-1 },{ pos:-1 },{ pos:-1 }];
  });
  return {
    game: 'ludo',
    colors,
    playerMap: players.map((p, i) => ({ username: p.username, nickname: p.nickname || p.username, color: colors[i] })),
    tokens,
    currentColorIndex: 0,
    dice: null,
    diceRolled: false,
    winners: [],
  };
}

function ludoAction(s, { action, payload, username }) {
  const current = s.playerMap[s.currentColorIndex];
  if (!current) return fail('No current player', s);

  if (action === 'roll-dice') {
    if (s.diceRolled) return fail('Already rolled', s);
    if (current.username !== username) return fail('Not your turn', s);
    s.dice = Math.floor(Math.random() * 6) + 1;
    s.diceRolled = true;
    const color = current.color;
    const hasMove = s.tokens[color].some(t => {
      if (t.pos === 58) return false;
      if (t.pos === -1) return s.dice === 6;
      return true;
    });
    if (!hasMove && s.dice !== 6) { s.diceRolled = false; advanceLudo(s); }
    return ok(s);
  }

  if (action === 'move-token') {
    if (current.username !== username) return fail('Not your turn', s);
    if (!s.diceRolled) return fail('Roll first', s);
    const { tokenIndex } = payload || {};
    const color = current.color;
    const token = s.tokens[color][tokenIndex];
    if (!token) return fail('Invalid token', s);
    if (token.pos === 58) return fail('Already home', s);
    if (token.pos === -1 && s.dice !== 6) return fail('Need 6 to enter', s);

    if (token.pos === -1) {
      token.pos = LUDO_ENTRY[color];
    } else {
      token.pos = ludoMove(token.pos, s.dice, color);
    }

    // Capture
    if (token.pos < 52 && !LUDO_SAFE.has(token.pos)) {
      s.colors.forEach(c => {
        if (c === color) return;
        s.tokens[c].forEach(t => { if (t.pos === token.pos) t.pos = -1; });
      });
    }

    // Win check
    const allHome = s.tokens[color].every(t => t.pos === 58);
    if (allHome) {
      s.winners.push(color);
      if (s.winners.length >= s.colors.length - 1) {
        return ok(s, { winners: [current.username] });
      }
    }

    if (s.dice === 6) { s.diceRolled = false; }
    else { s.diceRolled = false; advanceLudo(s); }
    return ok(s);
  }
  return fail('Unknown action', s);
}

function ludoMove(pos, steps, color) {
  const homeEntry = (LUDO_ENTRY[color] + 50) % 52;
  if (pos < 52) {
    const dist = (homeEntry - pos + 52) % 52;
    if (steps <= dist) return (pos + steps) % 52;
    const over = steps - dist;
    if (over > 6) return pos;
    if (over === 6) return 58;
    return 51 + over;
  }
  const next = pos + steps;
  if (next > 57) return pos;
  if (next === 57) return 58;
  return next;
}

function advanceLudo(s) {
  let tries = 0;
  do {
    s.currentColorIndex = (s.currentColorIndex + 1) % s.colors.length;
    tries++;
  } while (tries < s.colors.length && s.winners.includes(s.playerMap[s.currentColorIndex].color));
}

// ═══════════════════════════════════════════════════════════
// UNO
// ═══════════════════════════════════════════════════════════
const UNO_COLS  = ['red','blue','green','yellow'];
const UNO_NUMS  = ['0','1','1','2','2','3','3','4','4','5','5','6','6','7','7','8','8','9','9'];
const UNO_ACTS  = ['skip','skip','reverse','reverse','draw2','draw2'];

function buildDeck() {
  const deck = [];
  let id = 0;
  UNO_COLS.forEach(color => {
    UNO_NUMS.forEach(v  => deck.push({ id: id++, color, type:'number', value:v }));
    UNO_ACTS.forEach(a  => deck.push({ id: id++, color, type:a, value:a }));
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ id: id++, color:'wild', type:'wild', value:'wild' });
    deck.push({ id: id++, color:'wild', type:'wild4', value:'wild4' });
  }
  return shuffle(deck);
}

function initUno(players) {
  let deck = buildDeck();
  const hands = {};
  players.forEach(p => { hands[p.username] = deck.splice(0, 7); });
  let top;
  do { top = deck.splice(0,1)[0]; if (top.type !== 'number') deck.push(top); }
  while (top.type !== 'number');
  return {
    game:'uno', players: players.map(p => p.username),
    currentIndex:0, direction:1,
    hands, drawPile:deck, discardPile:[top], topCard:top,
    pendingDraw:0, wildColor:null, winners:[],
  };
}

function unoAction(s, { action, payload, username }) {
  const current = s.players[s.currentIndex];
  if (action === 'play-card') {
    if (current !== username) return fail('Not your turn', s);
    const { cardId, chosenColor } = payload || {};
    const idx = s.hands[username].findIndex(c => c.id === cardId);
    if (idx === -1) return fail('Card not in hand', s);
    const card = s.hands[username][idx];
    if (!unoPlayable(card, s)) return fail('Card not playable', s);
    s.hands[username].splice(idx, 1);
    s.discardPile.push(card);
    s.topCard = card;
    s.wildColor = card.color === 'wild' ? (chosenColor || 'red') : null;
    if (s.hands[username].length === 0) {
      s.winners.push(username);
      return ok(s, { winners: [username] });
    }
    applyUnoCard(s, card);
    return ok(s);
  }
  if (action === 'draw-card') {
    if (current !== username) return fail('Not your turn', s);
    unoReplenish(s);
    const n = s.pendingDraw > 0 ? s.pendingDraw : 1;
    s.pendingDraw = 0;
    for (let i = 0; i < n; i++) {
      unoReplenish(s);
      if (s.drawPile.length > 0) s.hands[username].push(s.drawPile.pop());
    }
    unoAdvance(s);
    return ok(s);
  }
  return fail('Unknown action', s);
}

function unoPlayable(card, s) {
  if (s.pendingDraw > 0) return card.type === 'draw2' || card.type === 'wild4';
  if (card.color === 'wild') return true;
  const active = s.wildColor || s.topCard.color;
  return card.color === active || card.value === s.topCard.value;
}

function applyUnoCard(s, card) {
  if (card.type === 'skip')    { unoAdvance(s); unoAdvance(s); return; }
  if (card.type === 'reverse') {
    s.direction *= -1;
    if (s.players.length === 2) { unoAdvance(s); unoAdvance(s); return; }
  }
  if (card.type === 'draw2')   { s.pendingDraw += 2; unoAdvance(s); return; }
  if (card.type === 'wild4')   { s.pendingDraw += 4; unoAdvance(s); return; }
  unoAdvance(s);
}

function unoAdvance(s) {
  s.currentIndex = ((s.currentIndex + s.direction) % s.players.length + s.players.length) % s.players.length;
}

function unoReplenish(s) {
  if (s.drawPile.length < 5 && s.discardPile.length > 1) {
    const top = s.discardPile.pop();
    s.drawPile = shuffle(s.discardPile);
    s.discardPile = [top];
  }
}

// ═══════════════════════════════════════════════════════════
// TIC-TAC-TOE
// ═══════════════════════════════════════════════════════════
function initTTT(players) {
  return {
    game:'ttt',
    players: [players[0].username, players[1].username],
    board: Array(9).fill(null),
    currentIndex: 0,
    winner: null, draw: false, moveCount: 0,
  };
}

const TTT_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function tttAction(s, { action, payload, username }) {
  if (action === 'place') {
    if (s.players[s.currentIndex] !== username) return fail('Not your turn', s);
    const { cell } = payload || {};
    if (s.board[cell] !== null || s.winner) return fail('Invalid move', s);
    s.board[cell] = s.currentIndex === 0 ? 'X' : 'O';
    s.moveCount++;
    for (const [a,b,c] of TTT_LINES) {
      if (s.board[a] && s.board[a] === s.board[b] && s.board[a] === s.board[c]) {
        s.winner = username;
        return ok(s, { winners: [username] });
      }
    }
    if (s.moveCount === 9) { s.draw = true; return ok(s, { winners: [] }); }
    s.currentIndex = 1 - s.currentIndex;
    return ok(s);
  }
  return fail('Unknown action', s);
}

// ═══════════════════════════════════════════════════════════
// SKRIBBL
// ═══════════════════════════════════════════════════════════
const WORDS = [
  'airplane','anchor','apple','balloon','banana','beach','bicycle','bridge','butterfly','camera',
  'candle','castle','cat','chair','cloud','coffee','computer','crown','diamond','dinosaur',
  'doctor','dog','dolphin','dragon','elephant','fire','fish','flower','football','forest',
  'ghost','guitar','hammer','headphones','helicopter','house','icecream','island','jellyfish',
  'keyboard','kite','lamp','laptop','lighthouse','lion','magnet','mountain','mushroom','octopus',
  'penguin','phone','piano','pizza','planet','rainbow','robot','rocket','saxophone','shark',
  'skateboard','snowflake','spider','star','submarine','sun','sunflower','sword','telescope',
  'tornado','trophy','truck','umbrella','unicorn','volcano','waterfall','whale','wizard','zebra',
];

function pickWords(used) {
  const available = WORDS.filter(w => !used.includes(w));
  const pool = available.length >= 3 ? available : WORDS;
  return shuffle(pool).slice(0, 3);
}

function initSkribbl(players) {
  const usernames = shuffle(players.map(p => p.username));
  return {
    game:'skribbl',
    players: usernames,
    scores: Object.fromEntries(players.map(p => [p.username, 0])),
    currentDrawerIndex: 0,
    round: 1,
    totalRounds: Math.min(3, Math.max(1, Math.ceil(12 / players.length))),
    currentWord: null,
    wordOptions: pickWords([]),
    usedWords: [],
    phase: 'choosing',
    guessedBy: [],
    drawData: [],
    timeLeft: 80,
  };
}

function skribblAction(s, { action, payload, username }) {
  const drawer = s.players[s.currentDrawerIndex];

  if (action === 'choose-word') {
    if (drawer !== username) return fail('Not drawer', s);
    if (!s.wordOptions.includes(payload.word)) return fail('Invalid word', s);
    s.currentWord = payload.word;
    s.usedWords.push(payload.word);
    s.phase = 'drawing';
    s.guessedBy = []; s.drawData = []; s.timeLeft = 80;
    return ok(s);
  }
  if (action === 'draw') {
    if (drawer !== username) return fail('Only drawer', s);
    s.drawData.push(payload);
    return ok(s);
  }
  if (action === 'clear-canvas') {
    if (drawer !== username) return fail('Only drawer', s);
    s.drawData = [];
    return ok(s);
  }
  if (action === 'guess') {
    if (drawer === username || s.phase !== 'drawing') return ok(s, { wrongGuess: true });
    if (s.guessedBy.includes(username)) return ok(s);
    const guess = (payload.guess || '').trim().toLowerCase();
    if (guess === (s.currentWord || '').toLowerCase()) {
      s.guessedBy.push(username);
      const pts = Math.max(10, 50 - (s.guessedBy.length - 1) * 8);
      s.scores[username] = (s.scores[username] || 0) + pts;
      s.scores[drawer]   = (s.scores[drawer]   || 0) + 10;
      const remaining = s.players.filter(p => p !== drawer && !s.guessedBy.includes(p));
      if (remaining.length === 0) return advanceSkribbl(s);
      return ok(s, { correctGuess: true, guesser: username });
    }
    return ok(s, { wrongGuess: true, guesser: username, guess: payload.guess });
  }
  if (action === 'time-up') {
    return advanceSkribbl(s);
  }
  return fail('Unknown action', s);
}

function advanceSkribbl(s) {
  s.currentDrawerIndex = (s.currentDrawerIndex + 1) % s.players.length;
  if (s.currentDrawerIndex === 0) s.round++;
  if (s.round > s.totalRounds) {
    const winner = Object.entries(s.scores).sort((a,b) => b[1]-a[1])[0][0];
    return ok(s, { winners: [winner] });
  }
  s.wordOptions = pickWords(s.usedWords);
  s.currentWord = null;
  s.phase = 'choosing';
  s.drawData = []; s.guessedBy = []; s.timeLeft = 80;
  return ok(s);
}

// ═══════════════════════════════════════════════════════════
// TRUTH OR DARE
// ═══════════════════════════════════════════════════════════
const TRUTHS = [
  "What's the most embarrassing thing you've ever done?",
  "Have you ever lied to get out of plans?",
  "What's a secret you've never told anyone?",
  "Who was your first crush?",
  "What's the weirdest dream you've ever had?",
  "Have you ever cheated on a test?",
  "What's something you pretend to like but actually hate?",
  "What's the biggest lie you've ever told?",
  "Do you have a hidden talent you're embarrassed about?",
  "What's the most childish thing you still do?",
  "Have you ever accidentally sent a text to the wrong person?",
  "What's the most ridiculous thing you've ever cried at?",
  "Have you ever pretended to be sick to skip something?",
  "What's your most irrational fear?",
  "Have you ever broken something and blamed someone else?",
  "What's the laziest thing you've ever done?",
  "Have you ever fallen asleep in class?",
  "What's something you've done that was actually cringe?",
  "Have you ever Googled yourself?",
  "What's a guilty pleasure you have?",
  "What's the worst grade you ever got?",
  "Have you ever re-read a text 10+ times before sending?",
  "What's the most embarrassing thing in your search history?",
  "Have you ever stalked an ex's social media?",
  "What's one app you'd be embarrassed if people saw?",
];

const DARES = [
  "Do your best celebrity impression for 30 seconds.",
  "Text your most recent contact: 'I think about you every day 💭'",
  "Speak in an accent for the next 3 turns.",
  "Do 15 pushups right now.",
  "Change your profile picture to a selfie taken right now, for 10 minutes.",
  "Talk without closing your mouth for 1 minute.",
  "Call a friend and sing happy birthday to them.",
  "Do your best robot dance for 30 seconds.",
  "Show the last 5 photos in your camera roll.",
  "Let someone in the group post a story on your behalf.",
  "Say the alphabet backwards as fast as you can.",
  "Attempt to lick your elbow.",
  "Post a story saying 'I'm having the time of my life 🎉'",
  "Send a voice note to someone saying 'I missed you so much recently'.",
  "Do your best T-Rex impression.",
  "Narrate everything you do for the next 2 minutes like a documentary.",
  "Draw a portrait of the person across from you in 60 seconds.",
  "Stand up and do a fashion show walk for 1 minute.",
  "Do 10 jumping jacks while counting backwards from 20.",
  "Talk only in questions for the next 2 minutes.",
  "Act out a movie scene without saying any words.",
  "Do your best impression of each player in the room.",
  "Speak only in rhymes for the next 2 rounds.",
  "Do a dramatic reading of the last text you sent.",
  "Make up a 30-second ad for a random object nearby.",
];

function initTOD(players) {
  return {
    game:'tod',
    players: shuffle(players.map(p => p.username)),
    currentIndex: 0,
    phase: 'choosing',
    currentPrompt: null,
    promptType: null,
    usedTruths: [],
    usedDares: [],
  };
}

function todAction(s, { action, payload, username }) {
  const current = s.players[s.currentIndex];
  if (action === 'choose') {
    if (current !== username) return fail('Not your turn', s);
    const type = payload.type;
    const pool  = type === 'truth' ? TRUTHS : DARES;
    const used  = type === 'truth' ? s.usedTruths : s.usedDares;
    const avail = pool.map((_, i) => i).filter(i => !used.includes(i));
    const pool2 = avail.length > 0 ? avail : pool.map((_,i)=>i);
    if (type === 'truth') s.usedTruths = []; else s.usedDares = [];
    const idx = pool2[Math.floor(Math.random() * pool2.length)];
    if (type === 'truth') s.usedTruths.push(idx); else s.usedDares.push(idx);
    s.currentPrompt = pool[idx];
    s.promptType = type;
    s.phase = 'prompt';
    return ok(s);
  }
  if (action === 'next') {
    s.currentIndex = (s.currentIndex + 1) % s.players.length;
    s.currentPrompt = null; s.promptType = null; s.phase = 'choosing';
    return ok(s);
  }
  return fail('Unknown action', s);
}

// ═══════════════════════════════════════════════════════════
// NEVER HAVE I EVER
// ═══════════════════════════════════════════════════════════
const NHIE_LIST = [
  "Never have I ever stayed awake for 24+ hours.",
  "Never have I ever eaten an entire pizza by myself.",
  "Never have I ever cried during a movie.",
  "Never have I ever texted someone and immediately regretted it.",
  "Never have I ever pulled an all-nighter before an exam.",
  "Never have I ever said 'I'm 5 minutes away' while still at home.",
  "Never have I ever pretended to be busy to avoid someone.",
  "Never have I ever skipped an entire week of classes.",
  "Never have I ever binge-watched an entire show in one day.",
  "Never have I ever ghosted someone.",
  "Never have I ever fallen off a chair in public.",
  "Never have I ever cried from laughing so hard.",
  "Never have I ever sent a meme to the wrong chat.",
  "Never have I ever re-read a text 10+ times before sending.",
  "Never have I ever lied about my age.",
  "Never have I ever stalked an ex's social media.",
  "Never have I ever lied on my resume or application.",
  "Never have I ever had a crush on a teacher or professor.",
  "Never have I ever broken a bone.",
  "Never have I ever met a celebrity.",
  "Never have I ever sung in the shower at full volume.",
  "Never have I ever made a purchase I instantly regretted.",
  "Never have I ever been locked out of my house.",
  "Never have I ever talked to myself in the mirror.",
  "Never have I ever deleted a text conversation out of embarrassment.",
  "Never have I ever screenshot someone's story without them knowing.",
  "Never have I ever fallen asleep in class or a meeting.",
  "Never have I ever done something embarrassing on a dare.",
  "Never have I ever pretended not to see a message.",
  "Never have I ever laughed at the wrong moment in a serious situation.",
];

function initNHIE(players) {
  return {
    game:'nhie',
    players: players.map(p => p.username),
    usedPrompts: [],
    currentPrompt: null,
    votes: {},
    round: 0,
    totalRounds: 10,
    phase: 'prompt',
    results: null,
  };
}

function nhieAction(s, { action, username }) {
  if (action === 'next-prompt') {
    if (s.round >= s.totalRounds) return ok(s, { winners: [] });
    const avail = NHIE_LIST.map((_,i)=>i).filter(i=>!s.usedPrompts.includes(i));
    const pool2 = avail.length > 0 ? avail : NHIE_LIST.map((_,i)=>i);
    const idx = pool2[Math.floor(Math.random() * pool2.length)];
    s.usedPrompts.push(idx);
    s.currentPrompt = NHIE_LIST[idx];
    s.votes = {}; s.round++; s.phase = 'voting'; s.results = null;
    return ok(s);
  }
  if (action === 'vote') {
    if (!['have','havenot'].includes(s.votes === undefined ? null : action)) {}
    s.votes[username] = action === 'vote' ? undefined : action;
    return fail('use vote payload', s);
  }
  // correct vote path handled separately
  return fail('Unknown action', s);
}

// Fix: nhie vote needs payload
function nhieActionFixed(s, { action, payload, username }) {
  if (action === 'next-prompt') {
    if (s.round >= s.totalRounds) return ok(s, { winners: [] });
    const avail = NHIE_LIST.map((_,i)=>i).filter(i=>!s.usedPrompts.includes(i));
    const pool2 = avail.length > 0 ? avail : NHIE_LIST.map((_,i)=>i);
    const idx = pool2[Math.floor(Math.random() * pool2.length)];
    s.usedPrompts.push(idx);
    s.currentPrompt = NHIE_LIST[idx];
    s.votes = {}; s.round++; s.phase = 'voting'; s.results = null;
    return ok(s);
  }
  if (action === 'vote') {
    const v = (payload || {}).vote;
    if (!['have','havenot'].includes(v)) return fail('Invalid vote', s);
    s.votes[username] = v;
    if (Object.keys(s.votes).length >= s.players.length) {
      s.phase = 'results';
      s.results = {
        have:    s.players.filter(p => s.votes[p] === 'have'),
        havenot: s.players.filter(p => s.votes[p] === 'havenot'),
      };
    }
    return ok(s);
  }
  return fail('Unknown action', s);
}

// Override with fixed version
const _nhieFixed = nhieActionFixed;

// Patch applyGameAction to use fixed nhie
function applyGameActionFixed(game, state, ctx) {
  const s = deepClone(state);
  try {
    switch (game) {
      case 'ludo':      return ludoAction(s, ctx);
      case 'uno':       return unoAction(s, ctx);
      case 'tictactoe': return tttAction(s, ctx);
      case 'skribbl':   return skribblAction(s, ctx);
      case 'tod':       return todAction(s, ctx);
      case 'nhie':      return _nhieFixed(s, ctx);
      default: return { error: 'Unknown game', state: s };
    }
  } catch (e) {
    return { error: e.message || 'Game error', state: s };
  }
}

module.exports = {
  createGameState,
  applyGameAction: applyGameActionFixed,
};
