export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-8xl font-extrabold tracking-tight text-primary">404</h1>
      <p className="text-xl text-muted-foreground">Page not found</p>
      <a
        href="/"
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
      >
        Back to Dashboard
      </a>
    </div>
  );
}
