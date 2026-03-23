"use client";

export default function NotFound() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '20px',
            textAlign: 'center'
        }}>
            <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Page Not Found</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                The page you're looking for doesn't exist.
            </p>
            <a
                href="/"
                style={{
                    padding: '10px 20px',
                    fontSize: '1rem',
                    backgroundColor: '#0070f3',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '5px'
                }}
            >
                Go Home
            </a>
        </div>
    );
}
