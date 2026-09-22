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
const firebaseConfig = {
  apiKey: "AIzaSyBvbj-oO6aVaAM9g8VpulUqt7ycJhhr5Ck",
  authDomain: "portfolio-tracker-c25ec.firebaseapp.com",
  projectId: "portfolio-tracker-c25ec",
  storageBucket: "portfolio-tracker-c25ec.firebasestorage.app",
  messagingSenderId: "117903443864",
  appId: "1:117903443864:web:a3ff07ab6d389d34f98ded",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Persistent local cache (IndexedDB) means reads/writes work offline and sync
// automatically once back online. Multi-tab manager keeps multiple open tabs in sync
// with each other.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
