"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message || "The page could not be shown. Your local notes are still in this browser."}</p>
        <button className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={() => reset()}>Try again</button>
      </div>
    </main>
  );
}
