"use client";

import { useState } from "react";

export default function Form({ lobbyId = "", matchCount = 6, maxTeams = 12, multiGroup = false }: { lobbyId?: string; matchCount?: number; maxTeams?: number; multiGroup?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ code: string; whatsappUrl?: string; group_name?: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setCopied(false);

    const data = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          game: "Free Fire",
          lobbyId: lobbyId || data.lobbyId || "",
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        setError(json.error || "Registration failed.");
        return;
      }

      setResult({ code: json.code, whatsappUrl: json.whatsappUrl, group_name: json.group_name });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!result?.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (result) {
    return (
      <div className="registration-success">
        <div className="success-icon">✓</div>
        <span className="eyebrow">REGISTRATION RECEIVED</span>
        <h2>Keep this code safe</h2>
        <p className="muted">
          Your Free Fire squad registration has been submitted. Use this code anytime to check your registration status.
        </p>

        <div className="reference-box">
          <small>YOUR REFERENCE CODE</small>
          <strong>{result.code}</strong>
          <button type="button" className="btn" onClick={copyCode}>
            {copied ? "✓ Copied" : "Copy Code"}
          </button>
        </div>

        {result.group_name && (
          <div className="notice groupAssigned"><b>GROUP ASSIGNED:</b> {result.group_name}<br/><span className="small">Groups fill in order: Group 1 → Group 2 → Group 3 and so on.</span></div>
        )}

        <div className="success-actions">
          <a className="btn primary check-status-btn" href={`/status?code=${encodeURIComponent(result.code)}`}>
            CHECK STATUS
          </a>
          {result.whatsappUrl && result.whatsappUrl !== "#" && (
            <a className="btn" href={result.whatsappUrl} target="_blank" rel="noreferrer">
              WhatsApp Support
            </a>
          )}
        </div>

        <p className="small muted">
          Your status starts as <b>Pending</b>. Your tournament group is assigned automatically in registration order. If the registration is rejected, that group slot becomes available again.
        </p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="notice">
        <b>Free Fire only.</b> This is a Free Fire {multiGroup ? "multi-group event" : "squad scrim"} with {matchCount} planned matches and {maxTeams} total slots. Maps are announced by the admin before each match.
      </div>

      {error && <div className="notice danger">{error}</div>}

      <label>
        Team name
        <input name="teamName" required placeholder="Your squad/team name" />
      </label>

      <label>
        Captain name
        <input name="captainName" required placeholder="Team captain name" />
      </label>

      <label>
        Contact number
        <input name="contactNo" required inputMode="tel" pattern="[0-9]{10}" maxLength={10} placeholder="10-digit mobile number" />
      </label>

      <input type="hidden" name="lobbyId" value={lobbyId} />
      <button className="btn primary" disabled={loading}>
        {loading ? "Creating..." : "Register for Free Fire Scrim"}
      </button>

      <p className="small muted">Only these 3 details are required. No Free Fire UID is needed.{multiGroup && " Group assignment is handled by ScrimForge after registration."}</p>
    </form>
  );
}
