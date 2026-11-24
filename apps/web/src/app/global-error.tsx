'use client';

/** Last-resort boundary when the root layout itself fails. Keeps styling self-contained. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f8f5ee',
          color: '#24342d',
          fontFamily: 'system-ui, sans-serif',
          padding: '1.5rem',
        }}
      >
        <main style={{ maxWidth: 440, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '1.75rem', margin: '0 0 .5rem' }}>
            Something went wrong
          </h1>
          <p style={{ lineHeight: 1.6, margin: '0 0 1.5rem', color: '#4f5f57' }}>
            Please try again.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: '#2f5d4b',
              color: '#fff',
              border: 0,
              borderRadius: 10,
              padding: '.75rem 1.25rem',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
