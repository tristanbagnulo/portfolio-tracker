import { useAuth } from "../context/AuthContext";

// Persistent, unobtrusive sign-in control for the optional Firebase sync (see
// context/AuthContext.tsx, context/PortfolioContext.tsx). Signing in is never
// required — everything works local-only (localStorage) without it, exactly as
// before this existed. It's the recommended path though: it's what makes data
// survive a wiped/corrupted browser, and follows you across devices.
export function CloudSyncBar() {
  const { user, signInError, signIn, signOut } = useAuth();

  if (user === undefined) return null; // initial auth check in flight — avoid a flash

  if (user === null) {
    return (
      <div className="toolbar" style={{ justifyContent: "flex-end", marginBottom: 4 }}>
        <button className="link-btn" onClick={() => signIn()}>
          Sign in with Google to back up to the cloud
        </button>
        {signInError && <span style={{ color: "var(--critical)", fontSize: 12 }}>{signInError}</span>}
      </div>
    );
  }

  return (
    <div className="toolbar" style={{ justifyContent: "flex-end", marginBottom: 4, alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Synced as {user.displayName ?? user.email}
      </span>
      <button className="link-btn" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}
