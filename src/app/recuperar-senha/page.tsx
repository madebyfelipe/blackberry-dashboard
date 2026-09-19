"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthError, AuthField, AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { CheckIcon } from "@/components/icons";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/recuperar-senha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível continuar.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviamos um link de redefinição para o e-mail da conta."
      footer={
        <p className="flex justify-center gap-1 text-[13px]">
          <span className="text-muted">Lembrou?</span>
          <Link
            href="/login"
            className="font-semibold text-fg underline-offset-4 hover:underline"
          >
            Voltar para o login
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="flex animate-rise-in flex-col gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
            <CheckIcon size={18} />
          </span>
          <p className="text-[13px] text-fg-soft">
            Se existir uma conta com <strong className="text-fg">{email}</strong>,
            o link chega em instantes.
          </p>
          <p className="text-[12px] text-dim">
            O disparo de e-mail ainda não está ligado nesta instalação — o pedido
            fica registrado e a redefinição pode ser feita pela coordenação.
          </p>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {error && <AuthError message={error} />}

          <AuthField label="E-mail da conta" htmlFor="email">
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

          <Button type="submit" disabled={loading} className="tap w-full">
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner /> Enviando…
              </span>
            ) : (
              "Enviar link"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
