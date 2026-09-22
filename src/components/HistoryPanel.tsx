export function HistoryPanel() {
  return (
    <div className="card">
      <div className="empty-state" style={{ padding: "28px 14px" }}>
        <p style={{ marginBottom: 8 }}>
          <strong style={{ color: "var(--text-primary)" }}>Not available yet.</strong>
        </p>
        <p style={{ maxWidth: "40ch", margin: "0 auto 8px" }}>
          A real history of what your portfolio was worth over time — and what it actually returned — needs transaction and
          price data pulled from your exchanges, brokers and bank, not typed in by hand.
        </p>
        <p style={{ maxWidth: "40ch", margin: "0 auto" }}>
          This tab is reserved for that once platform integrations exist. Manually-entered "history" would just be guessing
          backwards, so there's nothing faked here.
        </p>
      </div>
    </div>
  );
}
