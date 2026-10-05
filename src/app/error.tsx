'use client';
export default function ErrorPage({reset}: {reset: () => void}) { return <><h1>Reference library unavailable</h1><p>Check that local PostgreSQL is running, then try again.</p><button onClick={reset}>Try again</button></>; }
