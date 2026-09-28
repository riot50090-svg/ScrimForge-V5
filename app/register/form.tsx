"use client";

import { useState } from "react";

export default function Form() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const data = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Registration failed.");
        setLoading(false);
        return;
      }

      setMessage(`Registration code: ${result.code}`);

      if (result.whatsappUrl) {
        window.location.href = result.whatsappUrl;
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Team Name
        <input
          name="teamName"
          required
          placeholder="Enter team name"
        />
      </label>

      <label>
        Captain Name
        <input
          name="captainName"
          required
          placeholder="Enter captain name"
        />
      </label>

      <label>
        Contact Number
        <input
          name="contactNumber"
          required
          inputMode="numeric"
          pattern="[0-9]{10}"
          maxLength={10}
          placeholder="10-digit mobile number"
        />
      </label>

      <button className="btn primary" disabled={loading}>
        {loading ? "Registering..." : "Register Team"}
      </button>

      {message && <div className="notice">{message}</div>}

      <p className="small muted">
        After registration, WhatsApp will open for the next step.
      </p>
    </form>
  );
}
