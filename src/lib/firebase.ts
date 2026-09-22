import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Portfolio Tracker's own Firebase project — deliberately separate from any other
// app's project, since this one holds real financial data. The apiKey below is not a
// secret (Firebase's actual security boundary is the Firestore rules deployed
// alongside this project, not hiding this value); it's meant to be shipped in client
// code exactly like this. See lib/cloudSync.ts for what's actually protected, and by
// what.
//
// These are PLACEHOLDER values. Swap in the real ones from Firebase Console →
// Project settings → General → "Your apps" → Web app (</> icon) once the project
// exists — nothing here works until they're real, but the app still runs fine signed
// out (localStorage-only, exactly as before) in the meantime.
const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_PROJECT_ID",
  storageBucket: "REPLACE_WITH_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "REPLACE_WITH_SENDER_ID",
  appId: "REPLACE_WITH_APP_ID",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Persistent local cache (IndexedDB) means reads/writes work offline and sync
// automatically once back online. Multi-tab manager keeps multiple open tabs in sync
// with each other.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
