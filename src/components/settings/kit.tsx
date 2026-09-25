"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Screen, ScreenHeader } from "@/components/ui/Screen";
import { TabStrip } from "@/components/ui/Tabs";
import { Switch } from "@/components/flows/Switch";
import { ChevronDownIcon, LockIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/*
 * As peças das três abas de Configurações (exports "Configurações ·
 * Pessoal", "· Agência" e "· Painel da agência"). O desenho repete o mesmo
 * vocabulário nas três: cartão de seção com cabeçalho, faixa de subtítulo em
 * caixa alta, fileira "rótulo + ajuda à esquerda, controle à direita", chave
 * liga-desliga, seletor segmentado e o selo com ponto.
 *
 * A trilha e as abas vêm das telas já construídas (`Breadcrumb`, `TabStrip`):
 * no arquivo do desenho elas são um componente de biblioteca que não veio
 * junto no link, e são as mesmas das outras telas do shell.
 */

export type SettingsTab = "pessoal" | "agencia" | "painel";

const TABS: { id: SettingsTab; label: string; href: string }[] = [
  { id: "pessoal", label: "Pessoal", href: "/configuracoes" },
  { id: "agencia", label: "Agência", href: "/configuracoes/agencia" },
  { id: "painel", label: "Painel da agência", href: "/configuracoes/painel" },
];

/**
 * A moldura: trilha, abas (só as que a pessoa pode abrir) e as ações da aba
 * à direita. `dirty` avisa antes de trocar de aba com alteração por salvar.
 */
export function SettingsShell({
  tab,
  tabs,
  actions,
  dirty = false,
  children,
}: {
  tab: SettingsTab;
  /** As abas que esta pessoa vê — a Pessoal sempre. */
  tabs: SettingsTab[];
  actions?: React.ReactNode;
  dirty?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const current = TABS.find((t) => t.id === tab)!;
  const visible = TABS.filter((t) => t.id === "pessoal" || tabs.includes(t.id));

  // Fechar a aba do navegador com alteração por salvar também pergunta.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  return (
    <Screen gap="md">
      <Breadcrumb
        items={[
          { label: "black berry", href: "/tarefas" },
          { label: "Configurações", href: "/configuracoes" },
          { label: current.label },
        ]}
      />
      <ScreenHeader actions={actions}>
        {visible.length > 1 ? (
          <TabStrip
            tabs={visible.map((t) => ({ id: t.id, label: t.label }))}
            active={tab}
            onSelect={(id) => {
              if (id === tab) return;
              if (dirty && !window.confirm("Há alterações não salvas. Sair assim mesmo?")) return;
              router.push(TABS.find((t) => t.id === id)!.href);
            }}
          />
        ) : (
          <h1 className="text-[15px] font-semibold text-fg-soft">Configurações</h1>
        )}
      </ScreenHeader>
      <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 md:-mx-7 md:px-7" data-settings-scroll>
        {children}
      </div>
    </Screen>
  );
}

/** O corpo com o índice "Nesta página" à esquerda (só no desktop largo). */
export function SettingsBody({
  nav,
  children,
}: {
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-6 pb-6">
      {nav}
      <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
    </div>
  );
}

export type NavItem = { id: string; label: string; icon: React.ReactNode; danger?: boolean };

/**
 * "Nesta página": a seção que está à vista fica acesa, e o clique rola até
 * ela. Some abaixo de `lg` — no celular as seções já vêm uma embaixo da outra.
 */
export function PageNav({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-settings-scroll]");
    if (!root) return;
    const onScroll = () => {
      const top = root.getBoundingClientRect().top;
      let current = items[0]?.id;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top - top <= 120) current = item.id;
      }
      // No fim da rolagem a última seção é a da vez, mesmo curta.
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = items[items.length - 1]?.id;
      setActive(current);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [items]);

  return (
    <nav aria-label="Nesta página" className="sticky top-0 hidden w-[200px] shrink-0 flex-col gap-0.5 lg:flex">
      <span className="pb-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-faint">Nesta página</span>
      {items.map((item) => {
        const on = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            aria-current={on ? "location" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-chip border px-2.5 py-2 text-left text-[13px] transition-colors",
              on ? "border-border bg-surface-2 font-medium text-fg" : "border-transparent hover:bg-surface-2/60",
              !on && (item.danger ? "text-bad-label" : "text-fg-3"),
            )}
          >
            <span className={cn("shrink-0", on ? "text-fg-soft" : item.danger ? "text-bad-icon" : "text-muted")}>
              {item.icon}
            </span>
            {item.label}
          </button>
        );
      })}
      {footer && <div className="pt-3">{footer}</div>}
    </nav>
  );
}

/** O cartão de uma seção, com o título e a frase do desenho. */
export function Section({
  id,
  title,
  note,
  aside,
  danger = false,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  aside?: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-2 overflow-hidden rounded-[20px] border bg-flow-panel",
        danger ? "border-bad-line" : "border-rule",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3 border-b px-5 pb-4 pt-[18px]",
          danger ? "border-bad-line" : "border-rule",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <h2 className={cn("text-[15px] font-semibold", danger ? "text-bad-fg" : "text-fg")}>{title}</h2>
          {note && <p className="text-[12px] text-muted">{note}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** A faixa de subtítulo em caixa alta ("O QUE AVISAR", "SESSÃO"). */
export function Sub({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-set-line bg-set-sub px-5 py-[9px]">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.7px] text-set-hint">{label}</span>
      {right && <span className="text-[11px] text-set-hint">{right}</span>}
    </div>
  );
}

/**
 * A fileira: ícone e rótulo com a ajuda embaixo, controle à direita. No
 * celular o controle desce para baixo do texto — segmentado de cinco opções
 * não cabe ao lado de nada em 390px.
 */
export function Row({
  icon,
  label,
  help,
  extra,
  children,
  className,
}: {
  icon?: React.ReactNode;
  label: string;
  help?: React.ReactNode;
  /** O que vai embaixo da ajuda (o medidor de nível do microfone). */
  extra?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-set-line px-5 py-3.5 last:border-b-0 md:flex-row md:items-center md:gap-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-center gap-2 text-[13px] font-medium text-fg-soft">
          {icon && <span className="shrink-0 text-muted">{icon}</span>}
          {label}
        </span>
        {help && <span className="text-[12px] text-muted">{help}</span>}
        {extra}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** A chave liga-desliga (34×20), a mesma dos Fluxos. */
export function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="tap rounded-pill focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3 disabled:opacity-50"
    >
      <Switch on={on} size="md" />
    </button>
  );
}

/** O seletor segmentado: a opção ativa ganha fundo e contorno, as outras ficam no cinza. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { id: T; label: string; dot?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex max-w-full flex-wrap items-center gap-0.5 rounded-[9px] border border-border bg-flow-btn p-[3px]",
        className,
      )}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex items-center justify-center gap-[7px] rounded-mark border px-3 py-1.5 text-[12px] transition-colors",
              on
                ? "border-border-strong bg-border font-semibold text-fg"
                : "border-transparent text-muted hover:text-fg-3",
            )}
          >
            {o.dot && <span className="h-[7px] w-[7px] rounded-full" style={{ background: o.dot }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type PillTone = "ok" | "warn" | "bad" | "neutral";

const PILL: Record<PillTone, string> = {
  ok: "bg-ok-bg border-ok-ring text-ok-fg",
  warn: "bg-warn-bg border-warn-ring text-warn-fg",
  bad: "bg-bad-bg border-bad-ring text-bad-fg",
  neutral: "bg-surface-2 border-border text-fg-3",
};

const DOT: Record<PillTone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  neutral: "bg-set-hint",
};

/** O selo com ponto: "Configurado", "Ligado", "há 4 dias", "Atual". */
export function Pill({
  tone = "ok",
  dot = true,
  children,
}: {
  tone?: PillTone;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-2 py-[3px] text-[11px] font-semibold",
        PILL[tone],
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOT[tone])} />}
      {children}
    </span>
  );
}

/** O botão pequeno das fileiras ("Enviar foto", "Tirar silêncio", "Sair"). */
export function SmallButton({
  icon,
  variant = "default",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
  variant?: "default" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      className={cn(
        "tap flex shrink-0 items-center gap-1.5 rounded-chip px-3 py-2 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-primary text-set-ink hover:bg-white",
        variant === "default" && "border border-border bg-flow-btn text-fg-soft hover:bg-surface-2",
        variant === "danger" && "border border-bad-ring bg-bad-bg text-bad-fg hover:brightness-125",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

/** Os dois botões do cabeçalho: "Descartar" e "Salvar alterações". */
export function HeaderButton({
  primary = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "tap flex shrink-0 items-center gap-2 rounded-mark px-[18px] py-2.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "bg-primary font-semibold text-set-ink hover:bg-white"
          : "border border-border bg-flow-btn font-medium text-fg-soft hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Rótulo + controle + ajuda, empilhados (os campos de Perfil e dos padrões). */
export function Field({
  label,
  htmlFor,
  help,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  help?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-[7px]", className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-fg-3">
        {label}
      </label>
      {children}
      {help && <span className="text-[11.5px] text-set-hint">{help}</span>}
    </div>
  );
}

/**
 * A caixa do campo: ícone à esquerda, o controle no meio e o que vier depois
 * (selo, cadeado, chevron). `locked` é o campo que não se edita aqui — fundo
 * do cartão e cadeado, como "E-mail" e "Papel".
 */
export function FieldBox({
  icon,
  trailing,
  locked = false,
  className,
  children,
}: {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  locked?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 items-center gap-2 rounded-chip border px-3 py-2.5 text-[13px] transition-colors",
        locked
          ? "border-rule bg-flow-panel text-muted"
          : "border-border bg-flow-btn text-fg-soft focus-within:border-border-strong",
        className,
      )}
    >
      {icon && <span className="shrink-0 text-muted">{icon}</span>}
      {children}
      {trailing}
      {locked && <LockIcon size={13} className="shrink-0 text-faint" />}
    </div>
  );
}

/** O `<input>` de dentro de `FieldBox`: sem borda, herda a caixa. */
export function BareInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-w-0 flex-1 bg-transparent text-[16px] text-fg-soft outline-none placeholder:text-set-hint md:text-[13px]",
        props.readOnly && "text-muted",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A lista de escolha com o chevron do desenho. É o `<select>` do navegador
 * por baixo (teclado, leitor de tela e a folha nativa no celular vêm de graça),
 * transparente sobre a caixa.
 */
export function SelectBox<T extends string>({
  icon,
  value,
  onChange,
  options,
  label,
  className,
  disabled,
}: {
  icon?: React.ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <FieldBox icon={icon} className={cn("cursor-pointer", className)}>
      <span className="min-w-0 flex-1 truncate">{current?.label ?? "—"}</span>
      <ChevronDownIcon size={14} className="shrink-0 text-muted" />
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldBox>
  );
}

/** O quadrado de ícone das fileiras de integração, sessão e atalhos. */
export function IconBox({ size = 36, children }: { size?: 32 | 36 | 40; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border border-border text-fg-soft",
        size === 40 ? "h-10 w-10 rounded-[10px] bg-surface-2" : size === 36 ? "h-9 w-9 rounded-[9px] bg-surface-2" : "h-8 w-8 rounded-chip bg-badge-neutral",
      )}
    >
      {children}
    </span>
  );
}
