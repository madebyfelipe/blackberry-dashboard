import Link from "next/link";
import { AuroraBackdrop } from "./AuroraBackdrop";

/*
 * Moldura das telas de entrada (login, criar conta, recuperar senha): fundo
 * iridescente + card de vidro.
 *
 * Movimento: o card sobe uma vez (`animate-rise-in`) e cada bloco interno
 * entra em cascata — a view passa `--d` por filho via `.stagger-item`. A íris
 * do fundo tem a própria entrada, mais lenta, então o card chega primeiro e a
 * luz se acomoda atrás dele.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <AuroraBackdrop />

      <div className="relative z-10 flex w-full max-w-[400px] animate-rise-in flex-col gap-6 rounded-card border border-white/10 bg-surface/70 p-8 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-10">
        {/* Marca */}
        <Link
          href="/login"
          style={{ ["--d" as string]: 0 }}
          className="stagger-item flex h-11 w-11 items-center justify-center rounded-mark bg-primary transition-transform duration-200 hover:scale-105"
          aria-label="black berry"
        >
          <span className="text-[20px] font-bold text-on-primary">B</span>
        </Link>

        <header
          style={{ ["--d" as string]: 1 }}
          className="stagger-item flex flex-col gap-2"
        >
          <h1 className="text-[20px] font-semibold text-fg">{title}</h1>
          <p className="text-[13px] text-muted">{subtitle}</p>
        </header>

        <div
          style={{ ["--d" as string]: 2 }}
          className="stagger-item flex flex-col gap-6"
        >
          {children}
        </div>

        {footer && (
          <div style={{ ["--d" as string]: 3 }} className="stagger-item">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}

/** Aviso de erro do formulário — entra com um empurrãozinho, não pisca. */
export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="animate-rise-in-sm rounded-panel border border-white/12 bg-black/45 px-3.5 py-2.5 text-[12px] text-fg-soft"
    >
      {message}
    </p>
  );
}

/** Campo rotulado das telas de entrada. */
export function AuthField({
  label,
  htmlFor,
  right,
  children,
}: {
  label: string;
  htmlFor: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-[12px] font-medium text-fg-3">
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}
