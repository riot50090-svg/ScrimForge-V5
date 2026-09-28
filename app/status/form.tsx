"use client";

import { useState } from "react";

export default function Form({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const cleanCode = code.trim().toUpperCase();
      const response = await fetch(`/api/status?code=${encodeURIComponent(cleanCode)}`);
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Registration not found.");
        return;
      }
      setCode(json.code || cleanCode);
      setResult(json);
    } catch {
      setError("Could not check the status. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const status = String(result?.status || "").toUpperCase();
  const statusClass = status.toLowerCase();

  return (
    <div>
      <form className="form inline" onSubmit={check}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="SF-..."
          required
          aria-label="Registration reference code"
        />
        <button className="btn primary" disabled={loading}>
          {loading ? "Checking..." : "Check Status"}
        </button>
      </form>

      {error && <div className="notice danger">{error}</div>}

      {result && (
        <div className="card status-result">
          <div className="row">
            <div>
              <small className="muted">REFERENCE CODE</small>
              <h3>{result.code}</h3>
            </div>
            <span className={`status status-${statusClass}`}>{status || "PENDING"}</span>
          </div>

          <h3>{result.team_name}</h3>
          <p className="muted">Captain: {result.player_name} · {result.game}</p>

          <div className="stats">
            <div><small>STATUS</small><b>{status || "PENDING"}</b></div>
            <div><small>PAYMENT</small><b>{result.payment_status || "UNPAID"}</b></div>
            <div><small>SCRIM</small><b>{result.lobby_title || "Awaiting assignment"}</b></div>
            <div><small>CONTACT</small><b>{result.whatsapp || "—"}</b></div>
          </div>

          {status === "PENDING" && (
            <div className="notice">Your registration is received and waiting for admin confirmation.</div>
          )}
          {status === "CONFIRMED" && (
            <div className="notice">Your team is confirmed. Keep checking this page for the latest scrim information.</div>
          )}
          {status === "REJECTED" && (
            <div className="notice danger">This registration was rejected. Please contact ScrimForge support if you need help.</div>
          )}
        </div>
      )}
    </div>
  );
}
