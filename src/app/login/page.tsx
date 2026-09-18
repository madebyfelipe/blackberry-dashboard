"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Foundation stage: no real auth yet. Land on the app shell.
    router.push("/tarefas");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-card border border-border bg-surface p-10">
        {/* Brand mark */}
        <div className="flex h-11 w-11 items-center justify-center rounded-mark bg-primary">
          <span className="text-[20px] font-bold text-on-primary">B</span>
        </div>

        {/* Header */}
        <header className="flex flex-col gap-2">
          <h1 className="text-[20px] font-semibold text-fg">
            Bem-vindo de volta
          </h1>
          <p className="text-[13px] text-muted">
            Acesse sua conta para continuar no black berry
          </p>
        </header>

        {/* Form */}
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-[12px] font-medium text-fg-3">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-[12px] font-medium text-fg-3"
              >
                Senha
              </label>
              <Link
                href="/recuperar-senha"
                className="text-[12px] font-medium text-fg-soft hover:text-fg"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 appearance-none rounded-mark border border-border-strong bg-transparent checked:bg-primary checked:border-primary"
            />
            <span className="text-[13px] text-fg-soft">Lembrar de mim</span>
          </label>

          <Button type="submit">Entrar</Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[12px] text-muted">ou</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* SSO */}
        <Button variant="secondary" type="button">
          Continuar com SSO
        </Button>

        {/* Footer */}
        <p className="flex justify-center gap-1 text-[13px]">
          <span className="text-muted">Não tem uma conta?</span>
          <Link href="/criar-conta" className="font-semibold text-fg">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
