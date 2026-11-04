"use client";

// The last-resort page when the root layout itself fails: no app styles or words load here, so
// it carries its own minimal styling and plain English.
export default function GlobalError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#F4EFE7",
          color: "#1F1B16",
          fontFamily: "system-ui, sans-serif",
          padding: 16,
        }}
      >
        <title>Beacon</title>
        <main style={{ maxWidth: 520 }}>
          <h1>Something went wrong</h1>
          <p>Your answers are still saved on this device.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: 0,
              background: "#1F1B16",
              color: "#F4EFE7",
              fontSize: 16,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
