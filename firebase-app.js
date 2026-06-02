// ════════════════════════════════════════════════════
// firebase-app.js — Deutsch Lernen · Firebase Integration
// ════════════════════════════════════════════════════
//
// ⚙️  REPLACE THE VALUES BELOW WITH YOUR FIREBASE CONFIG
//  1. Go to https://console.firebase.google.com
//  2. Your project → Project Settings → Your apps → SDK setup
//  3. Copy the firebaseConfig object and paste here
//
// ════════════════════════════════════════════════════

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut }
                                 from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp }
                                 from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── 🔧 REPLACE WITH YOUR FIREBASE CONFIG ───────────
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
// ────────────────────────────────────────────────────

// Check if config is filled in
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

if (!isConfigured) {
  // Config not set — hide overlay and let app run without auth
  console.warn('[firebase-app.js] Firebase config not set — running without auth');
  const overlay = document.getElementById('authOverlay');
  if (overlay) overlay.style.display = 'none';
} else {
  // Config is set — initialize Firebase
  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  const SYNC_KEYS = [
    'wortschatz_known_v1','verben_known_v1',
    'wortschatz_custom_v1','verben_custom_v1',
    'wortschatz_custom_cats_v1','dt_tasks_v3','dt_level','deutsch_theme'
  ];

  function showOverlay()  {
    const o = document.getElementById('authOverlay');
    const l = document.getElementById('authLoading');
    if (o) o.style.display = 'flex';
    if (l) l.style.display = 'none';
  }
  function hideOverlay()  {
    const o = document.getElementById('authOverlay');
    if (o) { o.classList.add('hiding'); setTimeout(()=>{ o.style.display='none'; o.classList.remove('hiding'); }, 350); }
  }
  function showLoading() {
    const l = document.getElementById('authLoading');
    if (l) l.style.display = 'block';
  }

  function setUser(user) {
    const wrap  = document.getElementById('userAvatarWrap');
    const img   = document.getElementById('userAvatar');
    const name  = document.getElementById('userName');
    const email = document.getElementById('userEmail');
    if (!wrap) return;
    if (user) {
      wrap.style.display = 'block';
      img.src   = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||'U')}&background=2f7d8a&color=fff&size=64`;
      if (name)  name.textContent  = user.displayName || 'مستخدم';
      if (email) email.textContent = user.email || '';
    } else {
      wrap.style.display = 'none';
    }
  }

  function buildSnapshot() {
    const snap = { updatedAt: new Date().toISOString() };
    SYNC_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) snap[k] = v; });
    return snap;
  }

  function applySnapshot(snap) {
    if (!snap) return;
    SYNC_KEYS.forEach(k => { if (snap[k] !== undefined) { try { localStorage.setItem(k, snap[k]); } catch(e){} } });
  }

  let _syncUid = null;

  async function uploadProgress(uid) {
    const badge = document.getElementById('syncBadge');
    try {
      await setDoc(doc(db,'users',uid), { ...buildSnapshot(), updatedAt: serverTimestamp() }, { merge:true });
      if (badge) { badge.style.display='inline'; badge.textContent='✓ متزامن'; }
    } catch(e) {
      console.warn('Upload failed:', e);
      if (badge) { badge.style.display='inline'; badge.textContent='⚠ خطأ'; }
    }
  }

  async function downloadProgress(uid) {
    try {
      const snap = await getDoc(doc(db,'users',uid));
      if (snap.exists()) {
        const localTheme = localStorage.getItem('deutsch_theme');
        applySnapshot(snap.data());
        if (localTheme) localStorage.setItem('deutsch_theme', localTheme);
      }
    } catch(e) { console.warn('Download failed:', e); }
  }

  function startAutoSync(uid) {
    _syncUid = uid;
    setInterval(() => { if (_syncUid) uploadProgress(_syncUid); }, 3 * 60 * 1000);
  }

  // Patch localStorage to auto-sync on writes
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (_syncUid && SYNC_KEYS.includes(key)) {
      clearTimeout(localStorage._syncTimer);
      localStorage._syncTimer = setTimeout(() => uploadProgress(_syncUid), 2000);
    }
  };

  // Auth state listener
  showLoading();
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      setUser(user);
      await downloadProgress(user.uid);
      if (typeof applyTheme === 'function') applyTheme();
      if (typeof render    === 'function') render();
      hideOverlay();
      startAutoSync(user.uid);
    } else {
      _syncUid = null;
      setUser(null);
      showOverlay();
    }
  });

  window.authSignIn = async () => {
    const errEl = document.getElementById('authErr');
    if (errEl) errEl.style.display = 'none';
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      await signInWithPopup(auth, provider);
    } catch(e) {
      console.error('Sign-in error:', e);
      if (errEl) { errEl.style.display='block'; errEl.textContent = 'خطأ: ' + (e.message||'حاول مجدداً'); }
    }
  };

  window.authSignOut = async () => {
    if (!confirm('هل تريد تسجيل الخروج؟')) return;
    if (_syncUid) await uploadProgress(_syncUid);
    _syncUid = null;
    await signOut(auth);
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.remove('open');
  };

  window.syncNow = async () => {
    if (!_syncUid) return;
    const badge = document.getElementById('syncBadge');
    if (badge) { badge.style.display='inline'; badge.textContent='⏳'; }
    await uploadProgress(_syncUid);
  };

  window.toggleUserMenu = () => {
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.toggle('open');
  };

  document.addEventListener('click', e => {
    const wrap = document.getElementById('userAvatarWrap');
    if (wrap && !wrap.contains(e.target)) {
      const menu = document.getElementById('userMenu');
      if (menu) menu.classList.remove('open');
    }
  });
}
