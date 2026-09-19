"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthError, AuthField, AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

export default function CriarContaPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, agency, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível criar a conta.");
      router.replace("/tarefas");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível criar a conta.",
      );
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Sua agência em um lugar só: tarefas, aprovação e carteira."
      footer={
        <p className="flex justify-center gap-1 text-[13px]">
          <span className="text-muted">Já tem uma conta?</span>
          <Link
            href="/login"
            className="font-semibold text-fg underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        {error && <AuthError message={error} />}

        <AuthField label="Seu nome" htmlFor="name">
          <Input
            id="name"
            required
            autoComplete="name"
            placeholder="Felipe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-white/15 bg-black/45"
          />
        </AuthField>

        <AuthField label="Agência" htmlFor="agency">
          <Input
            id="agency"
            autoComplete="organization"
            placeholder="Estúdio Norte"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            className="border-white/15 bg-black/45"
          />
        </AuthField>

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

        <AuthField label="Senha" htmlFor="password">
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="mínimo de 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-white/15 bg-black/45"
          />
        </AuthField>

        <Button type="submit" disabled={loading} className="tap w-full">
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Criando…
            </span>
          ) : (
            "Criar conta"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
