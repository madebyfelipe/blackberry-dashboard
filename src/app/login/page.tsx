"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthError, AuthField, AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  /** Para onde o proxy queria levar a pessoa antes de exigir login. */
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível entrar.");
      router.replace(next);
      // O shell é renderizado no servidor e lê a sessão: precisa revalidar.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Acesse sua conta para continuar no black berry"
      footer={
        <p className="flex justify-center gap-1 text-[13px]">
          <span className="text-muted">Não tem uma conta?</span>
          <Link
            href="/criar-conta"
            className="font-semibold text-fg underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        {error && <AuthError message={error} />}

        <AuthField label="E-mail" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="voce@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-white/15 bg-black/45"
          />
        </AuthField>

        <AuthField
          label="Senha"
          htmlFor="password"
          right={
            <Link
              href="/recuperar-senha"
              className="text-[12px] font-medium text-fg-soft hover:text-fg"
            >
              Esqueceu a senha?
            </Link>
          }
        >
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-white/15 bg-black/45"
          />
        </AuthField>

        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input
            type="checkbox"
            name="lembrar"
            defaultChecked
            className="h-4 w-4 appearance-none rounded-mark border border-border-strong bg-transparent transition-colors checked:border-primary checked:bg-primary"
          />
          <span className="text-[13px] text-fg-soft">Lembrar de mim</span>
        </label>

        <Button type="submit" disabled={loading} className="tap">
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Entrando…
            </span>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/12" />
        <span className="text-[12px] text-muted">ou</span>
        <span className="h-px flex-1 bg-white/12" />
      </div>

      <Button
        variant="secondary"
        type="button"
        disabled
        title="SSO entra junto com o multi-tenant."
        className="tap border-white/12 bg-white/5 hover:bg-white/10"
      >
        Continuar com SSO
      </Button>
    </AuthShell>
  );
}

/** Só aceita caminho interno — evita redirect aberto via ?next=. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/tarefas";
  return value;
}
