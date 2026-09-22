import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Auth, User } from "firebase/auth";

interface AuthContextValue {
  /** undefined while the initial auth check is in flight, null once resolved signed-out. */
  user: User | null | undefined;
  signInError: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Firebase errors carry a machine-readable `code` (e.g. "auth/invalid-credential") —
 * surfacing it directly is far more useful for diagnosing a sign-in failure on a phone
 * with no devtools than a generic message. */
function describeAuthError(err: unknown): string {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "unknown";
  return `Sign-in didn't go through (${code}) — please try again.`;
}

// This project's OAuth Web client ID — from Firebase Console → Authentication →
// Sign-in method → Google → "Web SDK configuration". Not a secret, same
// public/embeddable status as the apiKey in lib/firebase.ts.
const GOOGLE_CLIENT_ID = "117903443864-elg18dgre6a34domnpn0b3vr86ig6nv5.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

let gisLoadPromise: Promise<void> | null = null;

/** Loads Google Identity Services' own client script — a small, separate file fetched
 * directly by the browser from Google's CDN, not part of our JS bundle at all (unlike
 * the Firebase SDK, so this doesn't reopen the bundle-size problem solved by the
 * dynamic imports below). */
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis-load-failed"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

// Google Sign-In only — this is a personal app, and it avoids password management
// entirely by piggybacking on an account already owned. Signing in is optional: see
// context/PortfolioContext.tsx, which falls back to local-only localStorage (today's
// behavior) whenever `user` is null.
//
// This deliberately does NOT use Firebase's own signInWithPopup/signInWithRedirect.
// Both route through a cross-origin handshake between this app's domain
// (tristanbagnulo.github.io) and the Firebase authDomain (*.firebaseapp.com) — and as
// of Chrome 115+/Firefox 109+/Safari 16.1+, browsers block exactly that cross-origin
// storage access by default, so the handshake fails silently (no error, just no
// signed-in user). Firebase's own documented fixes for this (a custom domain on
// Firebase Hosting, or a server-side reverse proxy) both require infrastructure a
// static GitHub Pages site doesn't have. See
// https://firebase.google.com/docs/auth/web/redirect-best-practices and
// https://github.com/firebase/firebase-js-sdk/issues/7824 (the exact scenario).
//
// Instead: use Google Identity Services (Google's own sign-in library, loaded
// directly, not via Firebase) to get a token, then hand it to Firebase via
// signInWithCredential — a plain API call, not a redirect/popup dance, so it has no
// cross-origin dependency at all. The GIS token client is initialized as soon as this
// provider mounts (well before any click) so that signIn() can call
// requestAccessToken() perfectly synchronously.
//
// Every Firebase import is still dynamic so the ~700KB SDK stays out of the
// critical-path bundle for the (default, still fully supported) signed-out case.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [signInError, setSignInError] = useState<string | null>(null);
  const authRef = useRef<Auth | null>(null);
  const authModuleRef = useRef<typeof import("firebase/auth") | null>(null);
  const tokenClientRef = useRef<{ requestAccessToken: (opts?: { prompt?: string }) => void } | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function completeSignIn(accessToken: string) {
      const authModule = authModuleRef.current;
      const auth = authRef.current;
      if (!authModule || !auth) {
        setSignInError("Sign-in didn't go through (not-ready) — please try again.");
        return;
      }
      try {
        const credential = authModule.GoogleAuthProvider.credential(null, accessToken);
        await authModule.signInWithCredential(auth, credential);
        setSignInError(null);
      } catch (err) {
        setSignInError(describeAuthError(err));
      }
    }

    (async () => {
      const [{ auth }, authModule] = await Promise.all([import("../lib/firebase"), import("firebase/auth")]);
      if (cancelled) return;
      authRef.current = auth;
      authModuleRef.current = authModule;
      unsubscribe = authModule.onAuthStateChanged(auth, setUser);
    })();

    loadGis()
      .then(() => {
        if (cancelled || !window.google) return;
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "email profile",
          callback: (response) => {
            if (response.error || !response.access_token) {
              setSignInError(`Sign-in didn't go through (${response.error ?? "no-token"}) — please try again.`);
              return;
            }
            void completeSignIn(response.access_token);
          },
        });
      })
      .catch(() => {
        // signIn() surfaces a clear error itself if the token client never initialized.
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  function signIn() {
    setSignInError(null);
    if (!tokenClientRef.current) {
      setSignInError("Google Sign-In is still loading — please try again in a moment.");
      return;
    }
    tokenClientRef.current.requestAccessToken();
  }

  async function signOut() {
    const authModule = authModuleRef.current;
    const auth = authRef.current;
    if (authModule && auth) await authModule.signOut(auth);
  }

  return <AuthContext.Provider value={{ user, signInError, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
