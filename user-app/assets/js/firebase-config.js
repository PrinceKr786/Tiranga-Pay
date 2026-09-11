/* =====================================================
   TIRANGA PAY - USER WEB APP
   FIREBASE CONFIG + INIT (Independent for user side)
   Uses Firebase Realtime Database + Analytics (compat)
   Load AFTER the firebase*-compat.js SDK scripts
   ===================================================== */
const TP_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD9hHDcTFh0a-3eSsXJ-sdD4_U78bsagYA",
  authDomain: "prince-hacks-test.firebaseapp.com",
  databaseURL: "https://prince-hacks-test-default-rtdb.firebaseio.com",
  projectId: "prince-hacks-test",
  storageBucket: "prince-hacks-test.firebasestorage.app",
  messagingSenderId: "1070897490445",
  appId: "1:1070897490445:web:17b1cb1461fd76bb888344",
  measurementId: "G-8HF61FHCWN"
};

if (typeof firebase !== 'undefined') {
  firebase.initializeApp(TP_FIREBASE_CONFIG);
}

const tpDB = (typeof firebase !== 'undefined') ? firebase.database() : null;

if (typeof firebase !== 'undefined' && typeof firebase.analytics === 'function') {
  try { firebase.analytics(); } catch (e) { }
}

/* ---------- Firebase Auth (email/password) ---------- */
const tpAuth = (typeof firebase !== 'undefined' && typeof firebase.auth === 'function') ? firebase.auth() : null;

/* Resolves once with the signed-in user (or null). Use before reading protected data. */
let tpAuthResolved = null;
const tpAuthReady = new Promise(resolve => {
  if (!tpAuth) { resolve(null); return; }
  tpAuth.onAuthStateChanged(u => { tpAuthResolved = u; resolve(u); });
});

function tpWaitAuth() {
  return tpAuthReady.then(() => tpAuthResolved);
}

/* Generate a unique referral code for new accounts */
function tpRefCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

const TP_REFERRAL_DEFAULT = 'GET20';
const TP_REGISTER_BONUS = 80;
const TP_REFERRAL_BONUS = 20;
const TP_REFERRAL_COMMISSION = 0.04; // 4%

/* ---------- Platform settings (admin-controlled) ---------- */
let tpPlatformSettingsCache = null;

const TP_PLATFORM_DEFAULTS = {
  upi_id: '',
  usdt_addr: '',
  deposit_min: 100,
  deposit_max: 100000,
  withdraw_min: 100,
  withdraw_max: 50000,
  register_bonus: 80,
  referral_bonus: 20,
  referral_commission: 4,       // percent
  banner1: '',
  banner2: '',
  banner3: '',
  usdt_rate: 111
};

/** Load admin-controlled settings from RTDB `settings` node (cached) */
async function tpLoadPlatformSettings(force) {
  if (tpPlatformSettingsCache && !force) return tpPlatformSettingsCache;
  try {
    const snap = await tpRef('settings').once('value');
    const raw = (snap && snap.val()) || {};
    tpPlatformSettingsCache = Object.assign({}, TP_PLATFORM_DEFAULTS, raw);
  } catch (e) {
    tpPlatformSettingsCache = Object.assign({}, TP_PLATFORM_DEFAULTS);
  }
  return tpPlatformSettingsCache;
}

/* ---------- Shared helpers ---------- */

/* =====================================================
   SVG ICON SYSTEM
   Replace emojis everywhere with stroke-based SVG icons.
   Usage: HTML <span data-ic="home"></span> then call applyIcons();
   or JS: IC_svg('home')
   ===================================================== */
const TP_ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  spark: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  diamond: '<path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
  receive: '<path d="M12 5v14M19 12l-7-7-7 7"/>',
  send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  broadcast: '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/>',
  quota: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M7 7V5a5 5 0 0 1 10 0v2"/>',
  ledger: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  bank: '<line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 2 19 6"/><line x1="3" y1="21" x2="21" y2="21"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  headset: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  pencil: '<path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  upi: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="8" y1="9" x2="8" y2="15"/><line x1="16" y1="9" x2="16" y2="15"/><circle cx="16" cy="9" r="1"/><polyline points="8 13 12 12 16 13"/>',
  coin: '<circle cx="9" cy="9" r="7"/><path d="M17 17l3 3"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  attach: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  send2: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  quota2: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  arrowIn: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowOut: '<path d="M12 5v14M19 12l-7-7-7 7"/>',
  mug: '<path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zM6 1v3M10 1v3M14 1v3"/>'
};

function IC_svg(name, cls) {
  const p = TP_ICONS[name] || '<circle cx="12" cy="12" r="10"/>';
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${cls ? ' class="' + cls + '"' : ''}>${p}</svg>`;
}

function applyIcons(root) {
  (root || document).querySelectorAll('[data-ic]').forEach(el => {
    el.innerHTML = IC_svg(el.getAttribute('data-ic'));
  });
}

function tpRef(path) {
  return tpDB.ref(path);
}

function tpNow() {
  return Date.now();
}

function tpId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function tpHashPassword(password) {
  const data = new TextEncoder().encode('tp-user-' + String(password));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function tpEmailKey(email) {
  return String(email || '').trim().toLowerCase().replace(/[.\/#$[\]]/g, '_');
}

function tpFormatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* Session helpers — now backed by Firebase Auth (uid). localStorage is only a
   display cache; all authorization comes from the real Firebase token. */
function tpSetSession(email, name, uid) {
  localStorage.setItem('tp_user_email', email);
  localStorage.setItem('tp_user_name', name || '');
  if (uid) localStorage.setItem('tp_user_uid', uid);
}

function tpGetSession() {
  return {
    token: (tpAuthResolved && tpAuthResolved.uid) || localStorage.getItem('tp_user_uid') || '',
    email: (tpAuthResolved && tpAuthResolved.email) || localStorage.getItem('tp_user_email') || '',
    name: localStorage.getItem('tp_user_name') || ''
  };
}

/** Await Firebase Auth, return { uid, email, name } (or {}) for the signed-in user. */
async function tpGetSessionAsync() {
  const u = await tpWaitAuth();
  if (!u) return {};
  return {
    uid: u.uid,
    email: u.email || '',
    name: u.displayName || localStorage.getItem('tp_user_name') || ''
  };
}

function tpClearSession() {
  localStorage.removeItem('tp_session_token');
  localStorage.removeItem('tp_user_email');
  localStorage.removeItem('tp_user_name');
  localStorage.removeItem('tp_user_uid');
  if (tpAuth) { try { tpAuth.signOut(); } catch (e) { } }
}

/* Central per-user MPIN hasher (kept client-side; salted per user via uid). */
async function tpHashMpin(mpin, salt) {
  const data = new TextEncoder().encode('tp-mpin-' + (salt || '') + String(mpin));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}