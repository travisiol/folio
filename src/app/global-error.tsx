"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#141411", color: "#F4F0E6", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 480, padding: 32, background: "#23221E", border: "1px solid #3A3831", borderRadius: 28 }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px", fontWeight: 900 }}>Something went wrong.</h1>
          <p style={{ color: "#CFC9BB", fontSize: 16, lineHeight: 1.5 }}>{error.message || "An unexpected error interrupted the page."}</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, background: "#F4F0E6", color: "#141411", border: 0, padding: "14px 24px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 16 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
