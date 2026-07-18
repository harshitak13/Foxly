import Link from "next/link";

export function FoxlyLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white font-display text-xl font-bold">
        🦊
      </div>
      <span className="font-display text-2xl font-bold tracking-normal">Foxly</span>
    </div>
  );
}

export function AuthShell({
  children,
  eyebrow = "Foxly security",
  navLabel = "Sign up",
  navHref = "/sign-up/details",
}: {
  children: React.ReactNode;
  eyebrow?: string;
  navLabel?: string;
  navHref?: string;
}) {
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <FoxlyLogo />
          <Link className="text-sm font-semibold text-primary" href={navHref}>
            {navLabel}
          </Link>
        </header>
        <section className="grid flex-1 place-items-center py-10">
          <div className="w-full max-w-[440px] rounded-lg border border-outline-variant bg-white p-8 auth-card-shadow">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-primary">
              {eyebrow}
            </p>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

export function Button({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`mt-6 h-12 w-full rounded bg-primary px-5 text-sm font-semibold text-white transition enabled:hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="mt-2 h-12 w-full rounded border border-outline-variant bg-surface-container-low px-4 text-on-surface outline-none focus:border-primary"
    />
  );
}

