// ════════════════════════════════════════════════════
// firebase-app.js — Deutsch Lernen · Firebase Integration
// ════════════════════════════════════════════════════
//
// ⚙️  HOW TO CONFIGURE:
//  1. Go to https://console.firebase.google.com
//  2. Create a project → Add a Web App → Copy the firebaseConfig object
//  3. Replace the placeholder values below with your real config
//  4. Enable Authentication → Sign-in method → Google
//  5. Enable Firestore Database → Start in production mode
//
// ════════════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── 🔧 REPLACE WITH YOUR FIREBASE CONFIG ───────────
const firebaseConfig = {

  apiKey: "AIzaSyBQk2i8GNKbuk1gh2wY1kYKBayZ4WaC74A",

  authDomain: "deutsch-lernen-e8378.firebaseapp.com",

  projectId: "deutsch-lernen-e8378",

  storageBucket: "deutsch-lernen-e8378.firebasestorage.app",

  messagingSenderId: "433288128367",

  appId: "1:433288128367:web:6fdeac64188b332d58ea9a",

  measurementId: "G-HM22161E4J"
// ────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Keys we sync to Firestore ──────────────────────
const SYNC_KEYS = [
  'wortschatz_known_v1',
  'verben_known_v1',
  'wortschatz_custom_v1',
  'verben_custom_v1',
  'wortschatz_custom_cats_v1',
  'dt_tasks_v3',
  'dt_level',
  'deutsch_theme'
];

// ── Helpers ────────────────────────────────────────
function showOverlay()  { const o=document.getElementById('authOverlay'); if(o) o.style.display='flex'; }
function hideOverlay()  {
  const o=document.getElementById('authOverlay');
  if(o){ o.classList.add('hiding'); setTimeout(()=>{ o.style.display='none'; o.classList.remove('hiding'); }, 350); }
}

function setUser(user) {
  const wrap  = document.getElementById('userAvatarWrap');
  const img   = document.getElementById('userAvatar');
  const name  = document.getElementById('userName');
  const email = document.getElementById('userEmail');
  if(!wrap) return;
  if(user) {
    wrap.style.display = 'block';
    img.src   = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||'U')}&background=2f7d8a&color=fff&size=64`;
    name.textContent  = user.displayName || 'مستخدم';
    email.textContent = user.email || '';
  } else {
    wrap.style.display = 'none';
  }
}

// ── Build snapshot from localStorage ──────────────
function buildSnapshot() {
  const snap = { updatedAt: new Date().toISOString() };
  SYNC_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if(v !== null) snap[k] = v;
  });
  return snap;
}

// ── Restore snapshot to localStorage ──────────────
function applySnapshot(snap) {
  if(!snap) return;
  SYNC_KEYS.forEach(k => {
    if(snap[k] !== undefined) {
      try { localStorage.setItem(k, snap[k]); } catch(e) {}
    }
  });
}

// ── Upload progress to Firestore ──────────────────
async function uploadProgress(uid) {
  const badge = document.getElementById('syncBadge');
  try {
    const ref = doc(db, 'users', uid);
    await setDoc(ref, { ...buildSnapshot(), updatedAt: serverTimestamp() }, { merge: true });
    if(badge){ badge.style.display='inline'; badge.textContent='✓ متزامن'; }
  } catch(e) {
    console.warn('Upload failed:', e);
    if(badge){ badge.style.display='inline'; badge.textContent='⚠ خطأ'; }
  }
}

// ── Download progress from Firestore ─────────────
async function downloadProgress(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if(snap.exists()) {
      const data = snap.data();
      // Merge: cloud wins for progress, local wins for theme
      const localTheme = localStorage.getItem('deutsch_theme');
      applySnapshot(data);
      if(localTheme) localStorage.setItem('deutsch_theme', localTheme);
    }
  } catch(e) {
    console.warn('Download failed:', e);
  }
}

// ── Auto-sync every 3 minutes ─────────────────────
let _syncUid = null;
function startAutoSync(uid) {
  _syncUid = uid;
  setInterval(() => { if(_syncUid) uploadProgress(_syncUid); }, 3 * 60 * 1000);
}

// ── Sync on localStorage writes (patch saveW / saveV) ──
const _origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
  _origSetItem(key, value);
  if(_syncUid && SYNC_KEYS.includes(key)) {
    // debounce: wait 2s after last write then sync
    clearTimeout(localStorage._syncTimer);
    localStorage._syncTimer = setTimeout(() => uploadProgress(_syncUid), 2000);
  }
};

// ── Auth state listener ────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if(user) {
    // Logged in
    setUser(user);
    await downloadProgress(user.uid);
    // Re-render the app with fresh data
    if(typeof applyTheme === 'function') applyTheme();
    if(typeof render    === 'function') render();
    hideOverlay();
    startAutoSync(user.uid);
  } else {
    // Logged out
    _syncUid = null;
    setUser(null);
    showOverlay();
  }
});

// ── Exposed to window ────────────────────────────
window.authSignIn = async () => {
  const errEl = document.getElementById('authErr');
  if(errEl) errEl.style.display = 'none';
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    await signInWithPopup(auth, provider);
  } catch(e) {
    console.error('Sign-in error:', e);
    if(errEl) { errEl.style.display = 'block'; errEl.textContent = 'خطأ: ' + (e.message || 'حاول مجدداً'); }
  }
};

window.authSignOut = async () => {
  if(!confirm('هل تريد تسجيل الخروج؟')) return;
  if(_syncUid) await uploadProgress(_syncUid);
  _syncUid = null;
  await signOut(auth);
  const menu = document.getElementById('userMenu');
  if(menu) menu.classList.remove('open');
};

window.syncNow = async () => {
  if(!_syncUid) return;
  const badge = document.getElementById('syncBadge');
  if(badge){ badge.style.display='inline'; badge.textContent='⏳'; }
  await uploadProgress(_syncUid);
};

window.toggleUserMenu = () => {
  const menu = document.getElementById('userMenu');
  if(menu) menu.classList.toggle('open');
};

// Close menu on outside click
document.addEventListener('click', e => {
  const wrap = document.getElementById('userAvatarWrap');
  if(wrap && !wrap.contains(e.target)){
    const menu = document.getElementById('userMenu');
    if(menu) menu.classList.remove('open');
  }
});
