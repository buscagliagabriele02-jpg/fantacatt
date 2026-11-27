// Collegamento a Firebase: login Google + database Firestore.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, OWNER_EMAILS } from './config.js';

const owners = OWNER_EMAILS.map(e => e.trim().toLowerCase());
const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('INSERISCI');
let backend;

if (!configured) {
  backend = {
    isOwner: () => false,
    onUser: cb => cb(null),
    signIn: () => Promise.reject(new Error('sito non ancora configurato (config.js)')),
    signOut: () => {}
  };
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  auth.languageCode = 'it';
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  backend = {
    isOwner: email => owners.includes(email),
    onUser: cb => onAuthStateChanged(auth, cb),
    async signIn() {
      try { await signInWithPopup(auth, provider); }
      catch (err) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(err.code)) return signInWithRedirect(auth, provider);
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
        throw err;
      }
    },
    signOut: () => signOut(auth),
    async getMember(email) {
      const s = await getDoc(doc(db, 'users', email));
      return s.exists() ? s.data() : null;
    },
    watchLeague(cb, onErr) {
      const L = {}, seen = { current: false, old: false };
      const emit = () => { if (seen.current && seen.old) cb({ ...L }); };
      const subs = ['current', 'old'].map(k => onSnapshot(doc(db, 'league', k), s => {
        seen[k] = true; if (s.exists()) L[k] = s.data(); else delete L[k]; emit();
      }, err => { console.error(err); onErr && onErr(err); }));
      return () => subs.forEach(u => u());
    },
    saveLeague: (k, v) => setDoc(doc(db, 'league', k), { ...v, updatedAt: serverTimestamp() }),
    async listUsers() {
      const q = await getDocs(collection(db, 'users'));
      return q.docs.map(d => ({ email: d.id, ...d.data() }));
    },
    setUser: (email, v) => setDoc(doc(db, 'users', email.trim().toLowerCase()), { team: v.team || null, admin: !!v.admin }),
    delUser: email => deleteDoc(doc(db, 'users', email))
  };
}

window.FCBackend = backend;
window.dispatchEvent(new Event('fc-backend'));
