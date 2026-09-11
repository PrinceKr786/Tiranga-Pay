/**
 * Tiranga Pay - ADMIN Panel Firebase Config (RTDB) - Independent setup
 * Load AFTER the Firebase compat CDN scripts.
 */

const TP_ADMIN_CONFIG = {
    apiKey: "AIzaSyD9hHDcTFh0a-3eSsXJ-sdD4_U78bsagYA",
    authDomain: "prince-hacks-test.firebaseapp.com",
    databaseURL: "https://prince-hacks-test-default-rtdb.firebaseio.com",
    projectId: "prince-hacks-test",
    storageBucket: "prince-hacks-test.firebasestorage.app",
    messagingSenderId: "1070897490445",
    appId: "1:1070897490445:web:17b1cb1461fd76bb888344",
    measurementId: "G-8HF61FHCWN"
};

firebase.initializeApp(TP_ADMIN_CONFIG, 'tpAdminApp');
const tpAdminDB = firebase.database(firebase.app('tpAdminApp'));

/* Default platform config (overridden by RTDB `settings` node) */
const TP_ADMIN_DEFAULTS = {
    upi_id: '',
    usdt_addr: '',
    deposit_min: 100,
    deposit_max: 100000,
    withdraw_min: 100,
    withdraw_max: 50000,
    register_bonus: 80,
    referral_bonus: 20,
    referral_commission: 4,      // percent
    banner1: '',
    banner2: '',
    banner3: ''
};

let tpAdminSettingsCache = null;

/** Load platform settings from RTDB `settings` node */
async function tpAdminLoadSettings(force) {
    if (tpAdminSettingsCache && !force) return tpAdminSettingsCache;
    try {
        const snap = await tpAdminRef('settings').once('value');
        const raw = (snap && snap.val()) || {};
        tpAdminSettingsCache = Object.assign({}, TP_ADMIN_DEFAULTS, raw);
    } catch (e) {
        tpAdminSettingsCache = Object.assign({}, TP_ADMIN_DEFAULTS);
    }
    return tpAdminSettingsCache;
}

/** Sync current bonus/commission constants with settings */
async function tpAdminSyncRewards() {
    const s = await tpAdminLoadSettings();
    TP_ADMIN_BONUS = Number(s.register_bonus) || 0;
    TP_REFERRAL_BONUS = Number(s.referral_bonus) || 0;
    TP_REFERRAL_COMMISSION = (Number(s.referral_commission) || 0) / 100;
    return s;
}

/** Bonus credited on admin approval of new user (from settings) */
let TP_ADMIN_BONUS = 80;

/** Referrer bonus credited when a referred user is approved */
let TP_REFERRAL_BONUS = 20;

/** Referrer commission % on every approved deposit of a referred member */
let TP_REFERRAL_COMMISSION = 0.04; // 4%

/** Get a typed DB ref: tpAdminRef('users/9999999999') */
function tpAdminRef(path) {
    return tpAdminDB.ref(path);
}

/** Current unix timestamp (seconds) */
function tpAdminNow() {
    return Math.floor(Date.now() / 1000);
}

/** Random unique push-key style id */
function tpAdminId() {
    return tpAdminDB.ref().push().key;
}

/** SHA-256 hash for admin passwords (crypto.subtle needs secure context) */
async function tpAdminHashPassword(password) {
    const data = new TextEncoder().encode('tp-admin-' + password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Current admin session from localStorage */
function tpAdminGetSession() {
    return {
        username: localStorage.getItem('tp_admin_user') || '',
        token: localStorage.getItem('tp_admin_token') || ''
    };
}