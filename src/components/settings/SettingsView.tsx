"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/auth/types";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { ChevronRightIcon, GitBranchIcon, LockIcon, UserCircleIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/*
 * Configurações — conta e acesso.
 *
 * É a primeira parte de Configurações com função real: sai do placeholder o
 * que já existe no produto (perfil e senha da sessão). Preferências do
 * workspace, papéis e notificações continuam esperando desenho (ROADMAP).
 */

const ROLE_LABEL: Record<PublicUser["role"], string> = {
  coordenacao: "Coordenação",
  social: "Social media",
  designer: "Designer",
};

export function SettingsView({ user, handle }: { user: PublicUser; handle: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto px-1 py-5 md:py-6 md:pl-2 md:pr-6">
      <Breadcrumb
        items={[{ label: "black berry", href: "/tarefas" }, { label: "Configurações" }]}
      />

      <header className="flex flex-col gap-1.5">
        <h1 className="text-[20px] font-semibold text-fg">Configurações</h1>
        <p className="text-[13px] text-muted">
          Sua conta e o acesso ao black berry.
        </p>
      </header>

      <div className="flex max-w-[760px] flex-col gap-4">
        <ProfileCard user={user} handle={handle} />
        <FlowsLink />
        <PasswordCard />
        <SessionCard user={user} />
      </div>
    </div>
  );
}

function Card({
  title,
  note,
  icon,
  index,
  children,
}: {
  title: string;
  note: string;
  icon?: React.ReactNode;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{ ["--d" as string]: index }}
      className="stagger-item flex flex-col gap-5 rounded-card border border-border bg-surface-2 p-6"
    >
      <header className="flex items-start gap-3">
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-border text-fg-3">
            {icon}
          </span>
        )}
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-fg-soft">{title}</h2>
          <p className="text-[12px] text-muted">{note}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-fg-3">
        {label}
      </label>
      {children}
      {hint && <span className="text-[11px] text-dim">{hint}</span>}
    </div>
  );
}

function SaveButton({
  saving,
  disabled,
  children = "Salvar",
}: {
  saving: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      className="tap w-fit rounded-field bg-primary px-4 py-2.5 text-[14px] font-medium text-on-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {saving ? (
        <span className="flex items-center gap-2">
          <Spinner /> Salvando…
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/** A porta para "Fluxos e Processos" — a esteira que as tarefas seguem. */
function FlowsLink() {
  return (
    <Link
      href="/configuracoes/fluxos"
      style={{ ["--d" as string]: 1 }}
      className="stagger-item tap flex items-center gap-3 rounded-card border border-border bg-surface-2 p-6 transition-colors hover:bg-row-raised"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-border text-fg-3">
        <GitBranchIcon size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-semibold text-fg-soft">Fluxos e Processos</span>
        <span className="text-[12px] text-muted">
          A sequência de trabalho: quem toca cada etapa e para quem a tarefa vai depois.
        </span>
      </span>
      <ChevronRightIcon size={16} className="text-muted" />
    </Link>
  );
}

function ProfileCard({ user, handle: savedHandle }: { user: PublicUser; handle: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [agency, setAgency] = useState(user.agency);
  const [handle, setHandle] = useState(savedHandle);
  const [saving, setSaving] = useState(false);

  const handleDirty = handle.replace(/^@+/, "") !== savedHandle;
  const dirty = name !== user.name || agency !== user.agency || handleDirty;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (name !== user.name || agency !== user.agency) {
        const res = await fetch("/api/auth/perfil", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, agency }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar.");
      }
      if (handleDirty) {
        const res = await fetch("/api/inbox/handle", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ handle }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar o @.");
        setHandle(data.me.handle);
      }
      toast("Perfil atualizado.");
      // A sidebar é renderizada no servidor com o usuário da sessão.
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      index={0}
      title="Perfil"
      note="Como seu nome aparece para o time e nos registros de aprovação."
      icon={<UserCircleIcon size={18} />}
    >
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <div className="flex flex-wrap gap-4">
          <Field label="Nome" htmlFor="name">
            <Input
              id="name"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Agência" htmlFor="agency">
            <Input
              id="agency"
              value={agency}
              required
              onChange={(e) => setAgency(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Seu @"
          htmlFor="handle"
          hint="É por ele que o time te menciona e te atribui tarefas. Único na agência."
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted">
              @
            </span>
            <Input
              id="handle"
              value={handle}
              required
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setHandle(e.target.value.replace(/^@+/, "").toLowerCase())}
              className="pl-7"
            />
          </div>
        </Field>
        <div className="flex flex-wrap gap-4">
          <Field label="E-mail" htmlFor="email" hint="O e-mail de acesso não muda por aqui.">
            <Input id="email" value={user.email} readOnly disabled />
          </Field>
          <Field
            label="Papel"
            htmlFor="role"
            hint="Papéis e permissões chegam com o multi-tenant."
          >
            <Input id="role" value={ROLE_LABEL[user.role]} readOnly disabled />
          </Field>
        </div>
        <SaveButton saving={saving} disabled={!dirty} />
      </form>
    </Card>
  );
}

function PasswordCard() {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/senha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, nextPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível trocar a senha.");
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Senha alterada.");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Não foi possível trocar a senha.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      index={1}
      title="Senha"
      note="Mínimo de 8 caracteres. Este aparelho segue conectado; os outros são desconectados."
      icon={<LockIcon size={18} />}
    >
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <div className="flex flex-wrap gap-4">
          <Field label="Senha atual" htmlFor="current">
            <Input
              id="current"
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="Nova senha" htmlFor="next">
            <Input
              id="next"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Confirmar nova senha" htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={cn(mismatch && "border-fg-3")}
            />
          </Field>
        </div>
        {mismatch && (
          <p className="animate-rise-in-sm text-[12px] text-fg-soft">
            As senhas novas não são iguais.
          </p>
        )}
        <SaveButton saving={saving} disabled={!current || next.length < 8 || mismatch}>
          Trocar senha
        </SaveButton>
      </form>
    </Card>
  );
}

function SessionCard({ user }: { user: PublicUser }) {
  const { toast } = useToast();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setLeaving(false);
      toast("Não foi possível sair.", "error");
    }
  }

  return (
    <Card
      index={2}
      title="Sessão"
      note={`Conectado como ${user.email} desde a criação da conta em ${new Date(
        user.createdAt,
      ).toLocaleDateString("pt-BR")}.`}
    >
      <button
        type="button"
        onClick={signOut}
        disabled={leaving}
        className="tap w-fit rounded-field border border-border bg-surface px-4 py-2.5 text-[14px] font-medium text-fg-soft transition-colors hover:bg-surface-2 disabled:opacity-60"
      >
        {leaving ? "Saindo…" : "Sair desta conta"}
      </button>
    </Card>
  );
}
