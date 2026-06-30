// migrate-json-to-sqlite.js
// One-time helper: agar tumhare paas pehle se users.json / calls.json hai
// (purane file-based version se), to yeh script unka data blinkmeet.db
// (naye SQLite database) mein copy kar deta hai.
//
// Run karo: node migrate-json-to-sqlite.js
// Safe hai dobara chalana — already-migrated records skip ho jaate hain.

const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const USERS_FILE = path.join(__dirname, 'users.json');
const CALLS_FILE = path.join(__dirname, 'calls.json');

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function migrateUsers() {
  const users = readJson(USERS_FILE);
  if (users.length === 0) {
    console.log('users.json nahi mila ya khaali hai — kuch skip kar diya.');
    return;
  }

  const insert = db.prepare(
    'INSERT OR IGNORE INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'
  );

  let count = 0;
  users.forEach((u) => {
    const result = insert.run(u.id, u.username, u.passwordHash, Date.now());
    if (result.changes > 0) count++;
  });
  console.log(`${count} user(s) migrate ho gaye (${users.length - count} pehle se the, skip).`);
}

function migrateCalls() {
  const calls = readJson(CALLS_FILE);
  if (calls.length === 0) {
    console.log('calls.json nahi mila ya khaali hai — kuch skip kar diya.');
    return;
  }

  const insert = db.prepare(
    'INSERT OR IGNORE INTO calls (id, owner, room_id, participants, start_time, duration_sec) VALUES (?, ?, ?, ?, ?, ?)'
  );

  let count = 0;
  calls.forEach((c) => {
    const result = insert.run(
      c.id,
      c.owner,
      c.roomId,
      JSON.stringify(c.participants || []),
      c.startTime,
      c.durationSec
    );
    if (result.changes > 0) count++;
  });
  console.log(`${count} call record(s) migrate ho gaye (${calls.length - count} pehle se the, skip).`);
}

migrateUsers();
migrateCalls();
console.log('Migration complete. Ab blinkmeet.db use ho raha hai.');
