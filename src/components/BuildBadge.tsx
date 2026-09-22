// A tiny, always-present build fingerprint — the only reliable way to tell whether a
// deploy has actually reached this device versus an old cached PWA bundle still being
// served. Rendered once at the App root in a shared row with CloudSyncBar (see
// App.tsx), outside all tab switching, so it's on screen no matter what tab is active.
// __BUILD_SHA__/__BUILD_TIME__ are injected at build time — see vite.config.ts.
export function BuildBadge() {
  const built = new Date(__BUILD_TIME__);
  const stamp = `${built.getMonth() + 1}/${built.getDate()} ${String(built.getHours()).padStart(2, "0")}:${String(
    built.getMinutes(),
  ).padStart(2, "0")}`;

  return (
    <div
      style={{
        flexShrink: 0,
        fontSize: 11,
        fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
        color: "var(--text-muted)",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {__BUILD_SHA__} · {stamp}
    </div>
  );
}
