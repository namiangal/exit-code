import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { browserSessionPersistence, getAuth, setPersistence, signInWithCustomToken, signOut }
  from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { doc, getFirestore, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

const firebase = initializeApp(window.EXIT_CODE_FIREBASE);
const auth = getAuth(firebase);
const db = getFirestore(firebase);
const authReady = setPersistence(auth, browserSessionPersistence).then(() => auth.authStateReady());
let unsubscribe;
let subscribedUid;

window.EXIT_CODE_REQUEST = async (action, args) => {
  await authReady;
  const token = action === 'login' ? undefined : await auth.currentUser?.getIdToken();
  const response = await fetch(window.EXIT_CODE_API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args, token }), signal: AbortSignal.timeout(35000)
  });
  const result = await response.json();
  if (result.ok && action === 'login') {
    await signInWithCustomToken(auth, result.data.customToken);
    delete result.data.customToken;
  }
  if (action === 'logout' || result.code === 'SESSION') {
    window.EXIT_CODE_WATCH(false);
    await signOut(auth);
  }
  return result;
};

window.EXIT_CODE_WATCH = (enabled, refresh) => {
  const uid = enabled ? auth.currentUser?.uid : undefined;
  if (uid === subscribedUid) return;
  unsubscribe?.();
  subscribedUid = uid;
  if (!uid) return;
  let observed;
  unsubscribe = onSnapshot(doc(db, 'studentUpdates', uid), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    const timestamp = snapshot.data()?.changedAt;
    const current = timestamp ? timestamp.seconds + ':' + timestamp.nanoseconds : '';
    if (current !== observed) {
      observed = current;
      refresh();
    }
  }, () => { subscribedUid = undefined; });
};

await import('./app.js?v=3');
