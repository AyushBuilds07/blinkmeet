// db.js
// SQLite database setup for BlinkMeet using better-sqlite3.
// The database file (blinkmeet.db) is created automatically the first
// time the server runs — no manual setup, no separate DB server needed.

const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = path.join(__dirname, 'blinkmeet.db');
const db = new Database(DB_FILE);

// WAL mode = better performance and safer concurrent reads/writes
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    nickname TEXT,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    room_id TEXT NOT NULL,
    participants TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    contact_username TEXT NOT NULL,
    blocked INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    UNIQUE(owner, contact_username)
  );

  CREATE INDEX IF NOT EXISTS idx_calls_owner_time ON calls(owner, start_time DESC);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner);
`);

// migration-safe: older blinkmeet.db files (created before nicknames/avatars
// existed) won't have these columns yet — add if missing, ignore if already there.
try {
  db.exec('ALTER TABLE users ADD COLUMN nickname TEXT');
} catch {
  // column already exists — fine
}
try {
  db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
} catch {
  // column already exists — fine
}

// ---------- users ----------
function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
}

function createUser({ id, username, nickname, passwordHash }) {
  db.prepare(
    'INSERT INTO users (id, username, nickname, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, nickname || username, passwordHash, Date.now());
}

function updateNickname(username, nickname) {
  db.prepare('UPDATE users SET nickname = ? WHERE username = ? COLLATE NOCASE').run(nickname, username);
}

function updateAvatar(username, avatarDataUrl) {
  db.prepare('UPDATE users SET avatar = ? WHERE username = ? COLLATE NOCASE').run(avatarDataUrl, username);
}

// ---------- calls ----------
function getCallsForUser(username, limit) {
  const rows = db
    .prepare('SELECT * FROM calls WHERE owner = ? ORDER BY start_time DESC LIMIT ?')
    .all(username, limit);

  return rows.map((row) => ({
    id: row.id,
    owner: row.owner,
    roomId: row.room_id,
    participants: JSON.parse(row.participants),
    startTime: row.start_time,
    durationSec: row.duration_sec,
  }));
}

function insertCall({ id, owner, roomId, participants, startTime, durationSec }) {
  db.prepare(
    'INSERT INTO calls (id, owner, room_id, participants, start_time, duration_sec) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, owner, roomId, JSON.stringify(participants), startTime, durationSec);
}

function clearCallsForUser(owner) {
  const result = db.prepare('DELETE FROM calls WHERE owner = ?').run(owner);
  return result.changes;
}

// ---------- contacts ----------
function getContacts(owner) {
  const rows = db
    .prepare(
      `SELECT c.id, c.contact_username, c.blocked, c.created_at, u.nickname, u.avatar
       FROM contacts c
       LEFT JOIN users u ON u.username = c.contact_username COLLATE NOCASE
       WHERE c.owner = ?
       ORDER BY c.created_at DESC`
    )
    .all(owner);

  return rows.map((row) => ({
    id: row.id,
    username: row.contact_username,
    nickname: row.nickname || row.contact_username,
    avatar: row.avatar || null,
    blocked: !!row.blocked,
    createdAt: row.created_at,
  }));
}

function addContact({ id, owner, contactUsername }) {
  db.prepare(
    `INSERT INTO contacts (id, owner, contact_username, blocked, created_at)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(owner, contact_username) DO NOTHING`
  ).run(id, owner, contactUsername, Date.now());
}

function removeContact(owner, contactUsername) {
  db.prepare('DELETE FROM contacts WHERE owner = ? AND contact_username = ? COLLATE NOCASE').run(
    owner,
    contactUsername
  );
}

function setContactBlocked({ id, owner, contactUsername, blocked }) {
  db.prepare(
    `INSERT INTO contacts (id, owner, contact_username, blocked, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(owner, contact_username) DO UPDATE SET blocked = excluded.blocked`
  ).run(id, owner, contactUsername, blocked ? 1 : 0, Date.now());
}

function isBlockedBy(owner, otherUsername) {
  const row = db
    .prepare(
      'SELECT blocked FROM contacts WHERE owner = ? AND contact_username = ? COLLATE NOCASE'
    )
    .get(owner, otherUsername);
  return !!(row && row.blocked);
}

module.exports = {
  db,
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
  isBlockedBy,
};
