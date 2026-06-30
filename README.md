# BlinkMeet

Ek real-time video calling web app — login/register, video call (WebRTC), in-call chat, aur screen share ke saath.

## Features

- Username/password login & register, with a separate **nickname** (display name shown to others) — passwords bcrypt se hashed, JWT session token
- Room code generate karke call shuru karo ya kisi ka code daal kar join karo
- Real-time video + audio call (WebRTC, peer-to-peer)
- Multiple log ek hi room mein (mesh connection — 2-4 logon ke liye sahi se chalega)
- In-call text chat
- Screen share (camera se switch karke, native "Stop sharing" button se wapas bhi)
- Mic / camera mute-unmute toggle
- **Contacts** — username se add karo, ek-click call, block/unblock, remove
- **Call history** — kis ke saath, kab, kitni der; "clear history" se delete bhi kar sakte ho
- **Settings** — nickname edit, dark/light appearance toggle, blocked users manage, history clear
- Light/Dark **appearance** toggle (call screen hamesha dark rehta hai, video contrast ke liye)
- Poora app **responsive** hai — phone par sidebar ek **hamburger menu** (☰) ban jaata hai jo tap karne par slide-in drawer khulta hai

## Tech stack

- Backend: Node.js, Express, Socket.io (signaling ke liye), JWT + bcryptjs (auth)
- Frontend: Plain HTML/CSS/JS (koi build step nahi chahiye)
- Database: **SQLite** (`better-sqlite3` ke through) — ek single file (`blinkmeet.db`), koi alag database server install/run nahi karna padta

## Setup (apne computer par)

1. **Node.js install karo** (agar nahi hai) — version 18 ya usse upar. https://nodejs.org

2. Project folder mein terminal khol kar dependencies install karo:
   ```bash
   npm install
   ```

3. Server start karo:
   ```bash
   npm start
   ```

4. Browser mein kholo: **http://localhost:3000**

5. Test karne ke liye **do alag browser tabs/windows** (ya ek incognito mein) kholo, dono mein alag-alag account banao, ek room create karo, doosre tab mein wahi room code daal kar join karo.

## Database setup — step by step

App **SQLite** use karta hai (`better-sqlite3` library ke through). Yeh ek **single file database** hai — koi alag database server (jaise MySQL/MongoDB) install ya run nahi karna padta, sab kuch automatically ho jaata hai.

**Step 1 — Dependency install**
Jab tum `npm install` chalate ho (Setup ke Step 2 mein), `better-sqlite3` bhi saath mein install ho jaata hai. Isme ek chhota native module compile hota hai — pehli baar thoda time le sakta hai, normal hai.

**Step 2 — Database file automatic ban jaati hai**
Jaise hi `npm start` chalate ho, `db.js` file check karti hai ki `blinkmeet.db` (project ke root mein) exist karti hai ya nahi. Agar nahi hai, to khud bana deti hai — saath hi do tables bhi:
- `users` — username, hashed password
- `calls` — har call ka record (kis ke saath, room code, time, duration)

Koi manual SQL command chalane ki zaroorat nahi — bas server start karo.

**Step 3 — Verify karo**
Server start karne ke baad, project folder mein dekho — ek `blinkmeet.db` file dikhni chahiye (saath mein `blinkmeet.db-wal` aur `blinkmeet.db-shm` bhi, yeh normal hai, journal files hain).

**Step 4 — (Optional) Database ko visually dekhna**
Agar dekhna ho ki andar data kaisa store ho raha hai:
1. [DB Browser for SQLite](https://sqlitebrowser.org/) download karo (free tool)
2. Install karke kholo
3. "Open Database" se apni `blinkmeet.db` file select karo
4. "Browse Data" tab mein `users` aur `calls` tables ka data dekh sakte ho

**Step 5 — (Optional) Purana data migrate karna**
Agar tumne pehle wale (JSON-file) version se already kuch accounts bana liye the (`users.json` / `calls.json` files), to ek baar yeh chalao taaki wo data naye database mein aa jaaye:
```bash
node migrate-json-to-sqlite.js
```
Dobara chalana bhi safe hai — already-migrated data dobara nahi judega.

**Troubleshooting**: agar `npm install` ke time `better-sqlite3` install hote hue error aaye (compiler-related), to:
- Confirm karo Node.js version 18+ hai (`node -v`)
- Windows par "Visual Studio Build Tools" install karna pad sakta hai; Mac par Xcode command line tools (`xcode-select --install`)
- Ya phir `npm install` dobara try karo — zyada cases mein prebuilt binary download ho jaati hai, compile karne ki zaroorat hi nahi padti.

## Important notes

- **Camera/mic permission**: Browser pehli baar permission maangega — allow karna zaroori hai.
- **Same network par test karna** sabse aasan hai. Agar alag networks (jaise tumhara dost kisi aur WiFi/mobile data par) se connect karna hai, to sirf STUN server (jo already config hai) kaafi nahi hoga agar dono taraf strict NAT/firewall ho — us case mein ek **TURN server** chahiye hoga (jaise [coturn](https://github.com/coturn/coturn) khud host karo, ya koi paid TURN service). Yeh production deployment ka common requirement hai.
- **HTTPS for production**: Camera/mic browser APIs (`getUserMedia`) sirf `localhost` ya HTTPS par kaam karte hain. Agar isse internet par deploy karte ho (jaise Render, Railway, VPS), to HTTPS zaroor lagao.
- `JWT_SECRET` environment variable production mein zaroor change karo (default sirf dev ke liye hai):
  ```bash
  JWT_SECRET=apna-secret-yaha-daalo npm start
  ```
- **Contacts / Block ka scope**: room-code based architecture hone ki wajah se "Block" abhi sirf tumhari Contacts list mein effect karta hai (blocked user hide/marked ho jaata hai). Koi bhi room code ke saath join kar sakta hai jis tarah pehle se app kaam karta hai — agar tum chahte ho ki block kiya hua user room join hi na kar paaye, to woh ek bigger feature hoga (per-room invite list jaisa), abhi ke scope mein nahi hai.

## Project structure

```
videocall-app/
├── server.js              # Express + Socket.io backend, auth, contacts, signaling
├── db.js                   # SQLite setup (better-sqlite3) — auto-creates tables
├── migrate-json-to-sqlite.js  # optional one-time migration from old JSON storage
├── package.json
├── public/
│   ├── index.html          # Login / Register (with nickname field)
│   ├── home.html            # Home — sidebar nav, new/join call, recent calls
│   ├── history.html         # Full call history
│   ├── contacts.html        # Contacts — add/remove/block/call
│   ├── settings.html        # Nickname, appearance, blocked users, clear history
│   ├── room.html            # Call screen
│   ├── favicon.svg / favicon.ico / favicon-64.png / apple-touch-icon.png
│   ├── css/style.css
│   └── js/
│       ├── auth.js
│       ├── theme.js          # applies saved light/dark preference
│       ├── home.js
│       ├── history.js
│       ├── contacts.js
│       ├── settings.js
│       └── room.js          # WebRTC mesh logic + chat + screen share
└── blinkmeet.db             # auto-created on first run (SQLite database)
```

## Scaling beyond a few people

Yeh app **mesh architecture** use karta hai — har user directly har doosre user se connect hota hai. 2-4 logon ke liye theek chalega, lekin usse zyada logon ke liye (jaise 10+) ek **SFU** (Selective Forwarding Unit, jaise mediasoup ya LiveKit) chahiye hoga, jo bandwidth aur CPU load kam karta hai.
