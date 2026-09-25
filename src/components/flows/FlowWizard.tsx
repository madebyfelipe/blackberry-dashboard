"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Screen } from "@/components/ui/Screen";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import { initialsOf } from "@/lib/inbox/view";
import {
  FLOW_CATEGORIES,
  FLOW_COLORS,
  FLOW_DESCRIPTION_MAX,
  FLOW_ICONS,
  FLOW_NAME_MAX,
  flowCategory,
  flowColorValue,
} from "@/lib/flows/constants";
import { FLOW_TEMPLATES, flowTemplate, templateBlurb, templateStepCount } from "@/lib/flows/templates";
import {
  clientColor,
  clientsHint,
  draftError,
  draftFor,
  draftFromFlow,
  switchTemplate,
  toggleClient,
  type FlowDraft,
} from "@/lib/flows/wizard";
import type { Flow, FlowIcon, FlowStep } from "@/lib/flows/types";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FilePlusIcon,
  GitBranchIcon,
  InfoIcon,
  PencilIcon,
  SaveIcon,
  SearchIcon,
} from "@/components/icons";
import { FlowGlyph } from "./FlowGlyph";
import { StepGlyph } from "./StepGlyph";
import { Switch } from "./Switch";

/*
 * Novo fluxo — exports "Novo Fluxo · 1. Modelo", "2. Detalhes" e
 * "3. Revisão". Substitui o "Novo fluxo" provisório (um fluxo desligado com
 * uma etapa, renomeado no título) e o "Editar" que só renomeava.
 *
 * - **Criar** (`/configuracoes/fluxos/novo`): os três passos. Nada vai para o
 *   servidor antes de "Criar fluxo" ou "Salvar rascunho" — voltar e trocar de
 *   modelo não deixa fluxo pela metade gravado.
 * - **Editar** (`/configuracoes/fluxos/<id>/editar`, o "Editar" do cabeçalho
 *   do fluxo): só o passo "Detalhes", com "Salvar" no lugar de "Continuar".
 *   Modelo não se troca depois de criado — as etapas se mexem no editor.
 *
 * A régua (o rascunho, a troca de modelo, o que impede de seguir) é função
 * pura em `lib/flows/wizard.ts`.
 */

export type WizardClient = { id: string; name: string; segment: string; flowId: string | null };

type Step = 0 | 1 | 2;

const STEPS = ["Modelo", "Detalhes", "Revisão"] as const;

const TITLES: Record<Step, { title: string; sub: string }> = {
  0: {
    title: "Como você quer começar?",
    sub: "Escolha um modelo pronto ou crie do zero. Você pode ajustar tudo depois.",
  },
  1: {
    title: "Detalhes do fluxo",
    sub: "Dê um nome, escolha o cliente e o ícone. Nada disso é definitivo.",
  },
  2: {
    title: "Confira e crie o fluxo",
    sub: "Revise as informações. As etapas podem ser editadas a qualquer momento.",
  },
};

const ICON_LABEL: Record<FlowIcon, string> = {
  megaphone: "Megafone",
  "pen-line": "Caneta",
  target: "Alvo",
  palette: "Paleta",
  clapperboard: "Claquete",
  send: "Enviar",
  zap: "Raio",
  "chart-line": "Gráfico",
  calendar: "Calendário",
  users: "Pessoas",
  "file-text": "Documento",
  "git-branch": "Ramificação",
};

export function FlowWizard({
  flow,
  clients,
  flows,
}: {
  /** Presente = edição do fluxo; ausente = Novo fluxo. */
  flow?: Flow;
  clients: WizardClient[];
  /** Os fluxos da agência — para o "em <fluxo>" do cliente que já tem um. */
  flows: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const editing = !!flow;
  const [step, setStep] = useState<Step>(editing ? 1 : 0);
  const [draft, setDraft] = useState<FlowDraft>(() =>
    flow
      ? draftFromFlow(flow, clients.filter((c) => c.flowId === flow.id).map((c) => c.id))
      : draftFor("social-media"),
  );
  const [error, setError] = useState<ReturnType<typeof draftError>>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const exitHref = flow ? `/configuracoes/fluxos?fluxo=${flow.id}` : "/configuracoes/fluxos";
  const template = flowTemplate(draft.template);

  function patch(p: Partial<FlowDraft>) {
    setDraft((d) => ({ ...d, ...p }));
    setError(null);
  }

  function goBack() {
    if (!editing && step > 0) setStep((step - 1) as Step);
    else router.push(exitHref);
  }

  function next() {
    if (step === 0) return setStep(1);
    const e = draftError(draft);
    if (e) {
      setError(e);
      if (e.field === "name") nameRef.current?.focus();
      return;
    }
    if (editing) return void save();
    setStep(2);
  }

  /** "Criar fluxo", "Salvar rascunho" e o "Editar etapas" (que salva rascunho e abre o editor). */
  async function create(status: "ativo" | "inativo" | "rascunho", message: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template: draft.template,
          name: draft.name.trim(),
          description: draft.description.trim(),
          category: draft.category,
          icon: draft.icon,
          color: draft.color,
          appliesTo: draft.appliesTo,
          clientIds: draft.appliesTo === "especificos" ? draft.clientIds : [],
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível criar o fluxo.");
      toast(message);
      router.push(`/configuracoes/fluxos?fluxo=${data.flow.id}`);
    } catch (err) {
      setBusy(false);
      toast(err instanceof Error ? err.message : "Não foi possível criar o fluxo.", "error");
    }
  }

  async function save() {
    if (!flow || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/flows/${flow.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          description: draft.description.trim(),
          category: draft.category,
          icon: draft.icon,
          color: draft.color,
          appliesTo: draft.appliesTo,
          // Em "Todos os clientes" quem já estava atribuído continua — só a lista explícita mexe neles.
          ...(draft.appliesTo === "especificos" ? { clientIds: draft.clientIds } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar o fluxo.");
      toast("Fluxo atualizado.");
      router.push(exitHref);
    } catch (err) {
      setBusy(false);
      toast(err instanceof Error ? err.message : "Não foi possível salvar o fluxo.", "error");
    }
  }

  const heading = TITLES[step];

  return (
    <Screen className="md:gap-6">
      {/* Voltar · passos */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          className="group flex items-center gap-2 text-[13px] font-medium text-fg-soft"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-mark border border-border bg-flow-btn transition-colors group-hover:bg-row-raised">
            <ArrowLeftIcon size={14} />
          </span>
          Voltar
        </button>
        {!editing && <Stepper step={step} onGo={setStep} />}
      </div>

      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 md:gap-6">
        <header className={cn("flex shrink-0 flex-col gap-1", step === 0 && "items-center text-center")}>
          <h1 className="text-[20px] font-bold text-fg md:text-[22px]">{heading.title}</h1>
          <p className="text-[13px] text-muted">{heading.sub}</p>
        </header>

        {step === 0 && (
          <div
            role="radiogroup"
            aria-label="Modelo do fluxo"
            className="grid shrink-0 grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
          >
            {FLOW_TEMPLATES.map((t) => {
              const on = draft.template === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDraft((d) => switchTemplate(d, t.id))}
                  onDoubleClick={() => {
                    setDraft((d) => switchTemplate(d, t.id));
                    setStep(1);
                  }}
                  className={cn(
                    "flex flex-col gap-3.5 rounded-tile border p-[18px] text-left transition-colors",
                    on ? "border-primary bg-flow-picked" : "border-rule bg-flow-panel hover:bg-flow-picked",
                  )}
                >
                  <span className="flex w-full items-start justify-between">
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-thumb",
                        t.id === "zero" ? "bg-border text-fg-soft" : "text-fg",
                      )}
                      style={t.id === "zero" ? undefined : { background: flowColorValue(t.color) }}
                    >
                      {t.id === "zero" ? <FilePlusIcon size={20} /> : <FlowGlyph icon={t.icon} size={20} />}
                    </span>
                    {on ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-primary text-on-primary">
                        <CheckIcon size={12} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="h-[18px] w-[18px] rounded-full border border-border" aria-hidden="true" />
                    )}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className={cn("text-[15px] font-semibold", on ? "text-fg" : "text-fg-soft")}>
                      {t.label}
                    </span>
                    <span className="text-[12px] leading-[15px] text-muted">{templateBlurb(t)}</span>
                  </span>
                  <span className="w-fit rounded-pill bg-row-raised px-2 py-0.5 text-[10px] font-semibold text-muted">
                    {templateStepCount(t)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4 xl:min-h-0 xl:flex-1 xl:flex-row">
            <section
              aria-label="Detalhes"
              className="flex min-w-0 flex-col gap-4 rounded-thumb border border-rule bg-flow-panel p-4 sm:p-5 xl:flex-1"
            >
              <Field label="Nome do fluxo" required htmlFor="flow-name">
                <input
                  id="flow-name"
                  ref={nameRef}
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  maxLength={FLOW_NAME_MAX}
                  placeholder="Ex: Social Media - Padrão"
                  aria-invalid={error?.field === "name"}
                  autoFocus={editing || !draft.name}
                  className={cn(
                    "h-10 w-full rounded-mark border bg-surface px-3 text-[13px] text-fg-soft placeholder:text-flow-hint focus:outline-none",
                    error?.field === "name" ? "border-flow-danger" : "border-field-line focus:border-muted",
                  )}
                />
              </Field>
              <Field label="Descrição" htmlFor="flow-desc">
                <textarea
                  id="flow-desc"
                  value={draft.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  maxLength={FLOW_DESCRIPTION_MAX}
                  placeholder="Descreva quando usar este fluxo. Ex: pautas mensais de social media para clientes ativos."
                  className="h-20 w-full resize-none rounded-mark border border-border bg-surface p-3 text-[12px] text-fg-soft placeholder:text-flow-hint focus:border-field-line focus:outline-none"
                />
              </Field>
              {/* O campo de ícone tem a largura do conteúdo; a categoria fica com o resto e desce quando falta espaço. */}
              <div className="flex flex-wrap items-start gap-3">
                <Field label="Categoria" htmlFor="flow-cat" className="min-w-[200px] flex-1">
                  <CategoryPicker value={draft.category} onPick={(category) => patch({ category })} />
                </Field>
                <Field label="Ícone e cor" className="max-w-full">
                  <IconAndColor draft={draft} onPatch={patch} />
                </Field>
              </div>
            </section>

            <ClientPicker
              draft={draft}
              clients={clients}
              flows={flows}
              selfId={flow?.id ?? null}
              invalid={error?.field === "clients"}
              onPatch={patch}
            />
          </div>
        )}

        {step === 2 && (
          <Review
            draft={draft}
            clients={clients}
            steps={template.steps()}
            busy={busy}
            onToggleActivate={() => patch({ activate: !draft.activate })}
            onEditDetails={() => setStep(1)}
            onEditSteps={() =>
              void create("rascunho", "Rascunho salvo — monte as etapas e ligue o fluxo quando estiver pronto.")
            }
          />
        )}
      </div>

      {/* Pé: o resumo do passo e as ações */}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-rule pt-4">
        {/* No celular o resumo sai (não cabe ao lado dos botões); o erro fica, numa linha só dele. */}
        {error ? (
          <p role="alert" className="min-w-0 basis-full text-[11px] text-flow-danger sm:basis-auto sm:truncate">
            {error.message}
          </p>
        ) : step === 2 ? (
          <p className="hidden min-w-0 items-center gap-2 text-[11px] text-label sm:flex">
            <InfoIcon size={12} />
            <span className="truncate">Tudo pode ser ajustado depois no editor do fluxo</span>
          </p>
        ) : (
          <p className="hidden min-w-0 truncate text-[11px] text-label sm:block">
            {step === 0 ? `Modelo selecionado: ${template.label}` : clientsHint(draft)}
          </p>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {step < 2 ? (
            <>
              <Link
                href={exitHref}
                className="tap rounded-mark px-3 py-2.5 text-[13px] font-medium text-muted transition-colors hover:text-fg-soft sm:px-4"
              >
                Cancelar
              </Link>
              <button
                type="button"
                onClick={next}
                disabled={busy}
                className="tap flex items-center gap-2 rounded-mark bg-primary px-5 py-2.5 text-[13px] font-semibold text-on-primary transition-colors hover:bg-white disabled:opacity-60"
              >
                {editing ? (
                  <>
                    <CheckIcon size={14} strokeWidth={2.5} />
                    Salvar
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRightIcon size={14} />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void create("rascunho", "Rascunho salvo — o fluxo fica desligado até você ativar.")}
                className="tap flex items-center gap-1.5 rounded-mark border border-border bg-flow-btn px-4 py-2.5 text-[13px] font-medium text-fg-soft transition-colors hover:bg-row-raised disabled:opacity-60"
              >
                <SaveIcon size={13} />
                Salvar rascunho
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void create(
                    draft.activate ? "ativo" : "inativo",
                    draft.activate ? "Fluxo criado e ativo." : "Fluxo criado — desligado até você ativar.",
                  )
                }
                className="tap flex items-center gap-2 rounded-mark bg-primary px-[22px] py-2.5 text-[13px] font-bold text-on-primary transition-colors hover:bg-white disabled:opacity-60"
              >
                <CheckIcon size={14} strokeWidth={2.5} />
                Criar fluxo
              </button>
            </>
          )}
        </div>
      </footer>
    </Screen>
  );
}

/* ================================================================== passos */

function Stepper({ step, onGo }: { step: Step; onGo: (s: Step) => void }) {
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Passos do novo fluxo">
      {STEPS.map((label, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <li key={label} className="flex items-center gap-1.5 sm:gap-2">
            {i > 0 && <span className="h-px w-3 bg-border sm:w-5" aria-hidden="true" />}
            <button
              type="button"
              disabled={state !== "done"}
              onClick={() => onGo(i as Step)}
              aria-current={state === "current" ? "step" : undefined}
              aria-label={state === "current" ? undefined : `${label}${state === "done" ? " (voltar)" : ""}`}
              className={cn(
                "flex items-center gap-2 rounded-pill border px-2 py-[5px] transition-colors sm:px-3",
                state === "current"
                  ? "border-primary bg-primary"
                  : state === "done"
                    ? "border-border bg-row-raised hover:bg-border"
                    : "border-border bg-surface",
              )}
            >
              <span
                className={cn(
                  "flex h-[18px] w-[18px] items-center justify-center rounded-pill text-[10px] font-bold",
                  state === "current" ? "bg-on-primary text-fg-soft" : "bg-border",
                  state === "done" && "text-fg-soft",
                  state === "todo" && "text-muted",
                )}
              >
                {state === "done" ? <CheckIcon size={11} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[12px] font-semibold",
                  state === "current" ? "text-on-primary" : "hidden sm:inline",
                  state === "done" && "text-fg-soft",
                  state === "todo" && "text-label",
                )}
              >
                {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  required,
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="flex w-fit items-center gap-1 text-[11px] font-medium text-muted">
        {label}
        {required && (
          <span className="font-semibold text-flow-danger" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

/** Esc fecha o menu aberto, esteja o foco onde estiver. */
function useEscape(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
}

const MENU = "animate-pop-in rounded-menu border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]";

function CategoryPicker({ value, onPick }: { value: FlowDraft["category"]; onPick: (v: FlowDraft["category"]) => void }) {
  const [open, setOpen] = useState(false);
  const close = useRef(() => setOpen(false)).current;
  useEscape(open, close);
  const current = flowCategory(value);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="left"
      trigger={
        <button
          id="flow-cat"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-mark border border-field-line bg-surface px-3 text-left transition-colors hover:border-border-strong"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: current.dot }} />
            <span className="truncate text-[13px] text-fg-soft">{current.label}</span>
          </span>
          <ChevronDownIcon size={14} className="text-muted" />
        </button>
      }
    >
      <ul
        role="listbox"
        aria-label="Categoria"
        className={cn("w-[240px]", MENU)}
      >
        {FLOW_CATEGORIES.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              role="option"
              aria-selected={c.id === value}
              onClick={() => {
                onPick(c.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-mark px-2.5 py-[7px] text-left text-[12px] text-fg-soft transition-colors hover:bg-row-raised"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.dot }} />
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              {c.id === value && <CheckIcon size={12} className="text-fg-3" />}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

function IconAndColor({ draft, onPatch }: { draft: FlowDraft; onPatch: (p: Partial<FlowDraft>) => void }) {
  const [open, setOpen] = useState(false);
  const close = useRef(() => setOpen(false)).current;
  useEscape(open, close);
  const color = flowColorValue(draft.color);
  return (
    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap" role="group" aria-label="Ícone e cor">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip text-fg"
        style={{ background: color }}
        aria-hidden="true"
      >
        <FlowGlyph icon={draft.icon} size={16} />
      </span>
      {FLOW_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-label={`Cor ${c.label}`}
          aria-pressed={draft.color === c.id}
          title={c.label}
          onClick={() => onPatch({ color: c.id })}
          className={cn(
            "h-[22px] w-[22px] shrink-0 rounded-pill transition-transform hover:scale-110",
            draft.color === c.id && "border-2 border-fg",
          )}
          style={{ background: c.value }}
        />
      ))}
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        align="right"
        trigger={
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-[5px] rounded-mark border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-fg-soft"
          >
            <PencilIcon size={11} />
            Trocar
          </button>
        }
      >
        <div
          role="listbox"
          aria-label="Ícone do fluxo"
            className={cn("grid w-[188px] grid-cols-4 gap-1 p-1.5", MENU)}
        >
          {FLOW_ICONS.map((i) => {
            const on = i === draft.icon;
            return (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={on}
                aria-label={ICON_LABEL[i]}
                title={ICON_LABEL[i]}
                onClick={() => {
                  onPatch({ icon: i });
                  setOpen(false);
                }}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-mark transition-colors",
                  on ? "text-fg" : "text-fg-3 hover:bg-row-raised hover:text-fg-soft",
                )}
                style={on ? { background: color } : undefined}
              >
                <FlowGlyph icon={i} size={16} />
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}

/* ================================================================ clientes */

function ClientPicker({
  draft,
  clients,
  flows,
  selfId,
  invalid,
  onPatch,
}: {
  draft: FlowDraft;
  clients: WizardClient[];
  flows: { id: string; name: string }[];
  /** O fluxo em edição — "em <fluxo>" não vale para ele mesmo. */
  selfId: string | null;
  invalid: boolean;
  onPatch: (p: Partial<FlowDraft>) => void;
}) {
  const [query, setQuery] = useState("");
  const specific = draft.appliesTo === "especificos";
  const selected = draft.clientIds.length;
  const flowName = (id: string | null) => (id && id !== selfId ? flows.find((f) => f.id === id)?.name : undefined);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.segment.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [clients, query]);

  const withoutFlow = clients.filter((c) => !c.flowId || c.flowId === selfId).length;

  return (
    <section
      aria-label="Cliente"
      className={cn(
        "flex flex-col gap-3.5 rounded-thumb border bg-flow-panel p-4 sm:p-5 xl:min-h-0 xl:w-[420px] xl:shrink-0",
        invalid ? "border-flow-danger" : "border-rule",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Building2Icon size={14} className="text-fg-3" />
          <h2 className="text-[14px] font-semibold text-fg-soft">Cliente</h2>
          <span className="text-[12px] font-semibold text-flow-danger" aria-hidden="true">
            *
          </span>
        </span>
        <span className="rounded-pill border border-flow-wait-ring bg-flow-wait-bg px-2 py-0.5 text-[10px] font-semibold text-flow-wait-fg">
          {specific ? (selected === 1 ? "1 selecionado" : `${selected} selecionados`) : "Todos"}
        </span>
      </div>
      <p className="text-[11px] text-label">
        {specific
          ? "Este fluxo será aplicado apenas aos clientes selecionados."
          : "Este fluxo será aplicado a todos os clientes que não têm um fluxo próprio."}
      </p>

      <div
        role="radiogroup"
        aria-label="A quem o fluxo vale"
        className="flex gap-[3px] rounded-chip border border-border bg-flow-btn p-[3px]"
      >
        {(
          [
            ["todos", "Todos os clientes"],
            ["especificos", "Clientes específicos"],
          ] as const
        ).map(([id, label]) => {
          const on = draft.appliesTo === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPatch({ appliesTo: id })}
              className={cn(
                "h-[30px] flex-1 rounded-mark px-2 text-[12px] transition-colors",
                on ? "bg-border font-semibold text-fg" : "font-medium text-muted hover:text-fg-soft",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {specific ? (
        <>
          <label className="flex h-[34px] shrink-0 items-center gap-2 rounded-mark border border-border bg-surface px-2.5">
            <SearchIcon size={14} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente..."
              aria-label="Buscar cliente"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-fg-soft placeholder:text-flow-hint focus:outline-none"
            />
          </label>
          <ul
            aria-label="Clientes"
            className="-mx-1 flex max-h-[340px] flex-col gap-1 overflow-y-auto px-1 xl:max-h-none xl:min-h-0 xl:flex-1"
          >
            {visible.length === 0 && (
              <li className="px-2.5 py-2 text-[12px] text-muted">
                {clients.length === 0
                  ? "Nenhum cliente cadastrado ainda — cadastre em Clientes, ou use todos os clientes."
                  : "Nenhum cliente com esse nome."}
              </li>
            )}
            {visible.map((c) => {
              const on = draft.clientIds.includes(c.id);
              const other = flowName(c.flowId);
              const sub = [c.segment, other && `em ${other}`].filter(Boolean).join(" · ");
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => onPatch({ clientIds: toggleClient(draft.clientIds, c.id) })}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-chip px-2.5 py-2 text-left transition-colors",
                      on ? "bg-row-raised" : "hover:bg-row-raised/60",
                    )}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-[10px] font-bold text-fg"
                      style={{ background: clientColor(c.id) }}
                    >
                      {initialsOf(c.name)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="truncate text-[13px] font-medium text-fg-soft">{c.name}</span>
                      {sub && <span className="truncate text-[10px] text-label">{sub}</span>}
                    </span>
                    <span
                      className={cn(
                        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-check border",
                        on ? "border-primary bg-primary text-on-primary" : "border-field-line",
                      )}
                    >
                      {on && <CheckIcon size={11} strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="rounded-chip bg-flow-well px-3 py-2.5 text-[12px] leading-[18px] text-muted">
          {withoutFlow === 1 ? "1 cliente sem fluxo próprio segue" : `${withoutFlow} clientes sem fluxo próprio seguem`}{" "}
          este fluxo. Quem já tem um fluxo escolhido na ficha continua nele.
        </p>
      )}
    </section>
  );
}

/* ================================================================= revisão */

function whoInitials(s: FlowStep): { initials: string; name: string } {
  if (s.assignee.kind === "cliente") return { initials: "CL", name: "Cliente" };
  if (s.assignee.kind === "squad") return { initials: "SQ", name: "Squad do cliente" };
  return { initials: "?", name: "Pessoa do time" };
}

function Review({
  draft,
  clients,
  steps,
  busy,
  onToggleActivate,
  onEditDetails,
  onEditSteps,
}: {
  draft: FlowDraft;
  clients: WizardClient[];
  steps: FlowStep[];
  busy: boolean;
  onToggleActivate: () => void;
  onEditDetails: () => void;
  onEditSteps: () => void;
}) {
  const cat = flowCategory(draft.category);
  const chosen = clients.filter((c) => draft.clientIds.includes(c.id));
  const shown = chosen.slice(0, 6);

  return (
    <>
      <section className="flex shrink-0 flex-col gap-4 rounded-tile border border-rule bg-flow-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-tile text-fg"
              style={{ background: flowColorValue(draft.color) }}
            >
              <FlowGlyph icon={draft.icon} size={24} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                <h2 className="min-w-0 truncate text-[18px] font-bold text-fg">{draft.name.trim()}</h2>
                <span className="flex shrink-0 items-center gap-[5px] rounded-pill border border-border bg-row-raised px-2 py-0.5 text-[11px] font-medium text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.dot }} />
                  {cat.label}
                </span>
              </div>
              <p className="text-[12px] text-muted">{draft.description.trim() || "Sem descrição."}</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.activate}
            onClick={onToggleActivate}
            className="flex shrink-0 items-center gap-2 self-start text-[12px] text-fg-soft sm:self-auto"
          >
            Ativar ao criar
            <Switch on={draft.activate} size="md" />
          </button>
        </div>
        <div className="h-px bg-rule" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-[10px] font-semibold tracking-[0.6px] text-label">CLIENTES</span>
            {draft.appliesTo === "todos" ? (
              <span className="rounded-pill border border-border bg-row-raised px-2.5 py-[3px] text-[12px] font-medium text-fg-soft">
                Todos os clientes sem fluxo próprio
              </span>
            ) : (
              <>
                {shown.map((c) => (
                  <span
                    key={c.id}
                    className="flex items-center gap-1.5 rounded-pill border border-border bg-row-raised py-[3px] pl-[3px] pr-2.5"
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-pill text-[9px] font-bold text-fg"
                      style={{ background: clientColor(c.id) }}
                    >
                      {initialsOf(c.name)}
                    </span>
                    <span className="text-[12px] font-medium text-fg-soft">{c.name}</span>
                  </span>
                ))}
                {chosen.length > shown.length && (
                  <span className="rounded-pill bg-row-raised px-2 py-[3px] text-[11px] font-semibold text-muted">
                    +{chosen.length - shown.length}
                  </span>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onEditDetails}
            className="flex shrink-0 items-center gap-[5px] py-1 text-[12px] font-medium text-muted transition-colors hover:text-fg-soft"
          >
            <PencilIcon size={11} />
            Editar
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3.5 rounded-tile border border-rule bg-flow-panel p-4 sm:p-5 lg:min-h-0 lg:flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-2">
            <GitBranchIcon size={14} className="text-fg-3" />
            <h2 className="whitespace-nowrap text-[14px] font-semibold text-fg-soft">Etapas do fluxo</h2>
            <span className="whitespace-nowrap rounded-pill bg-row-raised px-2 py-0.5 text-[10px] font-semibold text-muted">
              {steps.length === 0 ? "Sem etapas" : `${steps.length} ${steps.length === 1 ? "etapa" : "etapas"}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onEditSteps}
            disabled={busy}
            title="Salva como rascunho e abre o editor do fluxo"
            className="flex shrink-0 items-center gap-[5px] text-[12px] font-medium text-muted transition-colors hover:text-fg-soft disabled:opacity-60"
          >
            <PencilIcon size={11} />
            Editar etapas
          </button>
        </div>

        {steps.length === 0 ? (
          <p className="rounded-menu border border-dashed border-border px-4 py-6 text-center text-[12px] leading-[18px] text-muted">
            Nenhuma etapa ainda. Depois de criar, monte a esteira no editor do fluxo, em “Adicionar etapa”.
          </p>
        ) : (
          <ol className="-mx-1 flex overflow-x-auto px-1 pb-1" aria-label="Etapas do fluxo">
            {steps.map((s, i) => {
              const who = whoInitials(s);
              return (
                <Fragment key={s.id}>
                  <li className="flex min-h-[126px] min-w-[112px] flex-1 flex-col gap-2.5 rounded-menu border border-rule bg-surface p-3">
                    <span className="w-fit rounded-tag bg-border px-1.5 py-0.5 text-[10px] font-bold text-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-chip border border-border bg-flow-well text-fg-3">
                      <StepGlyph icon={s.icon} size={14} />
                    </span>
                    <span className="shrink-0 truncate text-[12px] font-semibold leading-[15px] text-fg-soft">{s.name}</span>
                    <span className="mt-auto flex shrink-0 items-center justify-between gap-1">
                      <span
                        title={who.name}
                        className="flex h-[18px] w-[18px] items-center justify-center rounded-pill bg-border text-[8px] font-bold text-fg-soft"
                      >
                        {who.initials}
                      </span>
                      <span className="text-[10px] font-semibold text-muted">{s.slaDays ? `${s.slaDays}d` : "—"}</span>
                    </span>
                  </li>
                  {i < steps.length - 1 && (
                    <li className="flex w-4 shrink-0 items-center justify-center text-dim" aria-hidden="true">
                      <ChevronRightIcon size={14} />
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
