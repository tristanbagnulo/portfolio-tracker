import { useRef } from "react";
import { LoadIssue } from "../context/PortfolioContext";

export function LoadIssueBanner({
  issue,
  onDismiss,
  onImport,
}: {
  issue: LoadIssue;
  onDismiss: () => void;
  onImport: (text: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImport(String(reader.result));
      } catch (err) {
        alert(err instanceof Error ? err.message : "Import failed");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function copyRaw() {
    if (issue.unparseable) navigator.clipboard?.writeText(issue.unparseable).catch(() => {});
    textareaRef.current?.select();
  }

  if (issue.recoveredFromBackup) {
    return (
      <div className="banner" style={{ borderColor: "var(--critical)" }}>
        <strong>Your primary save looked corrupted</strong> — recovered from an automatic backup copy instead, so nothing
        should be missing. Worth exporting a fresh backup now just in case.{" "}
        <button className="link-btn" onClick={onDismiss}>
          Got it
        </button>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2 style={{ color: "var(--critical)" }}>Couldn't read your saved data</h2>
        <p>
          Something in this browser's storage for Portfolio Tracker got corrupted, and no automatic backup copy was
          available either. <strong>Nothing has been deleted yet</strong> — the raw (broken) data is still shown below so you
          can copy it out before doing anything else.
        </p>
        {issue.unparseable && (
          <div className="form-field span-2">
            <label>Raw data found (likely truncated or malformed)</label>
            <textarea
              ref={textareaRef}
              readOnly
              value={issue.unparseable}
              style={{ minHeight: 140, fontFamily: "monospace", fontSize: 11 }}
              onClick={(e) => e.currentTarget.select()}
            />
            <button type="button" className="link-btn" style={{ marginTop: 4, textAlign: "left" }} onClick={copyRaw}>
              Copy to clipboard
            </button>
          </div>
        )}
        <p className="help">
          If you have an exported backup file from before, use Import instead of starting fresh — it'll restore everything
          and this message goes away.
        </p>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChange} />
        <div className="modal-actions">
          <button onClick={() => fileInputRef.current?.click()}>Import a backup file instead</button>
          <button
            className="danger"
            onClick={() => {
              if (confirm("Start fresh? This gives up on recovering the data above — it will be overwritten permanently.")) {
                onDismiss();
              }
            }}
          >
            Give up and start fresh
          </button>
        </div>
      </div>
    </div>
  );
}
