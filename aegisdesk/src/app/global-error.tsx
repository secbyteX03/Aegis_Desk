"use client";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    fontFamily: 'system-ui, sans-serif',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <h1>Something went wrong!</h1>
                    <p>{error.message}</p>
                    <button onClick={() => reset()}>Try again</button>
                </div>
            </body>
        </html>
    );
}
