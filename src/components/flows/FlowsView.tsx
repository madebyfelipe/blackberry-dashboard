"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Screen, ScreenHeader } from "@/components/ui/Screen";
import { TabStrip } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { initialsOf } from "@/lib/inbox/view";
import { AUTOMATIONS, blankStep } from "@/lib/flows/constants";
import type { AutomationId, Flow, FlowStatus, FlowStep, StepAssignee } from "@/lib/flows/types";
import {
  duplicateStep,
  FLOW_STATUS_LABEL,
  flowMeta,
  moveStep,
  nextStep,
  removeStep,
  startStep,
  stepNumber,
  stepPosition,
} from "@/lib/flows/view";
import {
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ArrowRightToLineIcon,
  BellIcon,
  CalendarClockIcon,
  ChevronRightIcon,
  Clock3Icon,
  CopyIcon,
  EllipsisIcon,
  FileCheckIcon,
  FlagIcon,
  GitBranchIcon,
  GripVerticalIcon,
  KanbanIcon,
  LinkIcon,
  ListIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  SearchIcon,
  ShieldCheckIcon,
  SquareArrowOutUpRightIcon,
  SquarePenIcon,
  TrashIcon,
  UserRoundIcon,
  XIcon,
  ZapIcon,
} from "@/components/icons";
import { StepGlyph } from "./StepGlyph";
import { Switch } from "./Switch";
import { FlowClients, type FlowClient } from "./FlowClients";
import { apiUpdateClient } from "@/components/clients/api";

/*
 * Fluxos e Processos — export "Fluxos e Processos" (Configurações).
 *
 * A lista de fluxos à esquerda e, à direita, o fluxo aberto: o pipeline de
 * etapas e a configuração da etapa escolhida. É daqui que sai a esteira que
 * as tarefas seguem (ver `lib/flows/automation.ts`): quem toca cada etapa,
 * em quanto tempo, e para onde a tarefa vai ao concluir.
 *
 * Toda mudança grava na hora — o pipeline é salvo inteiro a cada ajuste, e
 * a tela volta atrás se o servidor recusar.
 *
 * Criar e editar o fluxo (nome, descrição, categoria, ícone, cor e a quem
 * ele vale) é a tela própria dos exports "Novo Fluxo" (`FlowWizard`): "Novo
 * fluxo" abre os três passos, "Editar" abre o passo "Detalhes". Aqui fica a
 * esteira — etapas, responsáveis, prazos e automações.
 */

export type TeamPerson = { id: string; name: string; handle: string };

type Tab = "todos" | FlowStatus;

/** "Inativos" também mostra os rascunhos — os dois estão desligados. */
const TABS: { id: Tab; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "ativo", label: "Ativos" },
  { id: "inativo", label: "Inativos" },
  { id: "arquivado", label: "Arquivados" },
];

function makeId(): string {
  return "s" + Math.random().toString(36).slice(2, 9);
}

function relative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

function inTab(status: FlowStatus, tab: Tab): boolean {
  return tab === "inativo" ? status === "inativo" || status === "rascunho" : status === tab;
}

export function FlowsView({
  initialFlows,
  initialClients,
  team,
  initialFlowId,
  initialStepId,
}: {
  initialFlows: Flow[];
  /** A carteira — para o "Clientes do fluxo". */
  initialClients: FlowClient[];
  team: TeamPerson[];
  initialFlowId: string | null;
  initialStepId: string | null;
}) {
  const { toast } = useToast();
  const [flows, setFlows] = useState(initialFlows);
  const [clients, setClients] = useState(initialClients);

  /** Atribui (ou tira) o cliente do fluxo — o campo "Fluxo" da ficha dele. */
  async function assignClient(clientId: string, to: string | null) {
    const before = clients;
    const name = clients.find((c) => c.id === clientId)?.name ?? "O cliente";
    setClients((list) => list.map((c) => (c.id === clientId ? { ...c, flowId: to } : c)));
    try {
      await apiUpdateClient(clientId, { flowId: to });
      toast(to ? `${name} agora usa este fluxo.` : `${name} saiu do fluxo.`);
    } catch (err) {
      setClients(before);
      toast(err instanceof Error ? err.message : "Não deu para atribuir o cliente.", "error");
    }
  }
  const [tab, setTab] = useState<Tab>("todos");
  const [query, setQuery] = useState("");
  const [flowId, setFlowId] = useState<string | null>(
    initialFlows.find((f) => f.id === initialFlowId)?.id ?? initialFlows[0]?.id ?? null,
  );
  const flow = flows.find((f) => f.id === flowId) ?? null;
  const [stepId, setStepId] = useState<string | null>(() => {
    const f = initialFlows.find((x) => x.id === flowId);
    return f?.steps.find((s) => s.id === initialStepId)?.id ?? f?.steps[1]?.id ?? f?.steps[0]?.id ?? null;
  });
  const step = flow?.steps.find((s) => s.id === stepId) ?? null;

  // A etapa aberta acompanha a URL: "Copiar link da etapa" abre exatamente ela.
  useEffect(() => {
    if (!flowId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("fluxo", flowId);
    if (stepId) url.searchParams.set("etapa", stepId);
    else url.searchParams.delete("etapa");
    window.history.replaceState(null, "", url);
  }, [flowId, stepId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flows.filter(
      (f) =>
        (tab === "todos" ? f.status !== "arquivado" : inTab(f.status, tab)) &&
        (!q || f.name.toLowerCase().includes(q)),
    );
  }, [flows, tab, query]);

  const byId = (id: string) => team.find((p) => p.id === id);

  /** Grava o fluxo; a tela já mostra o novo, e volta atrás se o servidor recusar. */
  async function save(id: string, patch: Partial<Pick<Flow, "name" | "status" | "steps" | "startStepId">>) {
    const before = flows.find((f) => f.id === id);
    if (!before) return;
    setFlows((all) => all.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    try {
      const res = await fetch(`/api/flows/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar o fluxo.");
      setFlows((all) => all.map((f) => (f.id === id ? data.flow : f)));
    } catch (err) {
      setFlows((all) => all.map((f) => (f.id === id ? before : f)));
      toast(err instanceof Error ? err.message : "Não foi possível salvar o fluxo.", "error");
    }
  }

  function saveSteps(steps: FlowStep[], extra: Partial<Pick<Flow, "startStepId">> = {}) {
    if (flow) void save(flow.id, { steps, ...extra });
  }

  function patchStep(id: string, patch: Partial<FlowStep>) {
    if (!flow) return;
    saveSteps(flow.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function duplicateFlow() {
    if (!flow) return;
    try {
      const res = await fetch(`/api/flows/${flow.id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setFlows((all) => [...all, data.flow]);
      setFlowId(data.flow.id);
      toast("Fluxo duplicado — a cópia nasce desligada.");
    } catch {
      toast("Não foi possível duplicar o fluxo.", "error");
    }
  }

  /* ------------------------------------------- ações sobre as etapas */

  function addStep() {
    if (!flow) return;
    const s = blankStep(makeId());
    saveSteps([...flow.steps, s]);
    setStepId(s.id);
  }

  function duplicate(id: string) {
    if (!flow) return;
    const newId = makeId();
    saveSteps(duplicateStep(flow.steps, id, newId));
    setStepId(newId);
  }

  function remove(id: string) {
    if (!flow) return;
    if (flow.steps.length === 1) return toast("O fluxo precisa de pelo menos uma etapa.", "info");
    const i = flow.steps.findIndex((s) => s.id === id);
    const out = removeStep(flow, id);
    saveSteps(out.steps, { startStepId: out.startStepId });
    setStepId(out.steps[Math.max(0, i - 1)]?.id ?? null);
  }

  function move(id: string, dir: -1 | 1) {
    if (!flow) return;
    saveSteps(moveStep(flow.steps, id, dir));
  }

  function copyLink(id: string) {
    if (!flow) return;
    const url = `${window.location.origin}/configuracoes/fluxos?fluxo=${flow.id}&etapa=${id}`;
    void navigator.clipboard?.writeText(url).then(
      () => toast("Link da etapa copiado."),
      () => toast("Não deu para copiar o link.", "error"),
    );
  }

  const [menu, setMenu] = useState<{ stepId: string; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ stepId: string; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
   * O cartão de hover abre 8px abaixo da etapa. Fechar no instante em que o
   * mouse sai da etapa fazia o cartão sumir no caminho até ele — não dava
   * para clicar em nada lá dentro. Agora sair da etapa (ou do cartão) só
   * agenda o fechamento; entrar no cartão (ou voltar à etapa) cancela.
   */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepHover = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const leaveHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    keepHover();
    closeTimer.current = setTimeout(() => setHover(null), 300);
  };
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  const [dragging, setDragging] = useState<string | null>(null);

  // Os atalhos do menu de contexto valem com a etapa escolhida.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!step || !flow) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "ArrowLeft") {
        e.preventDefault();
        move(step.id, -1);
      } else if (mod && e.key === "ArrowRight") {
        e.preventDefault();
        move(step.id, 1);
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate(step.id);
      } else if (mod && e.key.toLowerCase() === "l") {
        e.preventDefault();
        copyLink(step.id);
      } else if (!mod && (e.key === "Backspace" || e.key === "Delete") && menu) {
        e.preventDefault();
        setMenu(null);
        remove(step.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const statusTab = (s: FlowStatus) => flows.filter((f) => inTab(f.status, s)).length;

  return (
    <Screen gap="md">
      <Breadcrumb
        items={[
          { label: "black berry", href: "/tarefas" },
          { label: "Configurações", href: "/configuracoes" },
          { label: "Fluxos e Processos" },
        ]}
      />

      <ScreenHeader
        actions={
          <>
            <Link
              href="/configuracoes/fluxos/novo"
              aria-label="Novo fluxo"
              className="tap flex items-center gap-2 rounded-mark bg-primary px-5 py-2.5 text-[13px] font-semibold text-on-primary transition-colors hover:bg-white"
            >
              <PlusIcon size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">Novo fluxo</span>
            </Link>
          </>
        }
      >
        <TabStrip
          tabs={TABS.map((t) => ({
            id: t.id,
            label: t.label,
            count: t.id === "todos" ? undefined : statusTab(t.id as FlowStatus),
          }))}
          active={tab}
          onSelect={(id) => setTab(id as Tab)}
        />
      </ScreenHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Meus fluxos */}
        <aside className="flex max-h-[280px] w-full shrink-0 flex-col overflow-hidden rounded-card bg-flow-panel lg:max-h-none lg:w-[260px]">
          <div className="flex flex-col gap-2.5 px-3.5 pb-2.5 pt-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-fg-soft">Meus fluxos</span>
              <span className="rounded-pill bg-row-raised px-2 py-0.5 text-[11px] font-semibold text-muted">
                {visible.length}
              </span>
            </div>
            <label className="flex h-8 items-center gap-2 rounded-mark bg-surface px-2.5">
              <SearchIcon size={14} className="text-label" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar fluxo"
                aria-label="Buscar fluxo"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-fg-soft placeholder:text-label focus:outline-none"
              />
            </label>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 && (
              <li className="px-3.5 py-3 text-[12px] text-muted">
                {query ? "Nenhum fluxo com esse nome." : "Nenhum fluxo aqui."}
              </li>
            )}
            {visible.map((f) => {
              const on = f.id === flowId;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFlowId(f.id);
                      setStepId(f.steps[0]?.id ?? null);
                    }}
                    className={cn(
                      "flex w-full flex-col gap-1.5 px-3.5 py-3 text-left transition-colors",
                      on ? "bg-row-raised" : "hover:bg-row-raised/60",
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          f.status === "ativo" ? "bg-flow-on" : "bg-status-paused",
                        )}
                        aria-hidden="true"
                      />
                      <span className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold", on ? "text-fg" : "text-fg-soft")}>
                        {f.name}
                      </span>
                      {on && <ChevronRightIcon size={14} className="text-muted" />}
                    </span>
                    <span className="text-[11px] text-label">{flowMeta(f)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* O fluxo aberto */}
        {flow ? (
          <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-card bg-flow-panel lg:overflow-y-auto">
            <FlowHeader
              flow={flow}
              onDuplicate={duplicateFlow}
              onToggle={() => void save(flow.id, { status: flow.status === "ativo" ? "inativo" : "ativo" })}
              onArchive={() => {
                void save(flow.id, { status: flow.status === "arquivado" ? "inativo" : "arquivado" });
                toast(flow.status === "arquivado" ? "Fluxo desarquivado." : "Fluxo arquivado — tarefas novas não entram mais nele.");
              }}
            />

            <FlowClients flow={flow} flows={flows} clients={clients} onAssign={(id, to) => void assignClient(id, to)} />

            {/* Pipeline */}
            <div className="flex flex-col gap-3.5 px-4 pb-4 pt-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold tracking-wide text-label">PIPELINE</span>
                  <span className="rounded-pill bg-row-raised px-[7px] py-0.5 text-[10px] font-semibold text-muted">
                    {flow.steps.length} {flow.steps.length === 1 ? "etapa" : "etapas"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 rounded-mark bg-flow-btn p-0.5" role="group" aria-label="Visualização">
                    <ViewMode label="Lista" active>
                      <ListIcon size={14} />
                    </ViewMode>
                    <ViewMode label="Quadro" onClick={() => toast("A vista em quadro chega com o desenho dela.", "info")}>
                      <KanbanIcon size={14} />
                    </ViewMode>
                    <ViewMode label="Ramificações" onClick={() => toast("A vista em ramos chega com o desenho dela.", "info")}>
                      <GitBranchIcon size={14} />
                    </ViewMode>
                  </div>
                  <button
                    type="button"
                    onClick={addStep}
                    className="tap flex items-center gap-1.5 rounded-mark px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-fg-soft transition-colors hover:bg-flow-btn"
                  >
                    <PlusIcon size={13} />
                    <span className="hidden sm:inline">Adicionar etapa</span>
                  </button>
                </div>
              </div>

              {flow.steps.length === 0 && (
                <p className="rounded-menu border border-dashed border-border px-4 py-5 text-center text-[12px] text-muted">
                  Nenhuma etapa ainda — use “Adicionar etapa” para montar a esteira.
                </p>
              )}
              <div className="-mx-1 flex overflow-x-auto px-1 pb-1" role="list" aria-label="Etapas do fluxo">
                {flow.steps.map((s, i) => (
                  <div key={s.id} className="flex shrink-0 items-stretch" role="listitem">
                    <StepCard
                      flow={flow}
                      step={s}
                      selected={s.id === stepId}
                      start={startStep(flow)?.id === s.id}
                      person={s.assignee.kind === "membro" ? byId(s.assignee.memberId) : undefined}
                      dragging={dragging === s.id}
                      onSelect={() => setStepId(s.id)}
                      onMenu={(x, y) => {
                        setStepId(s.id);
                        setHover(null);
                        setMenu({ stepId: s.id, x, y });
                      }}
                      onHover={(rect) => {
                        if (!rect) return leaveHover();
                        keepHover();
                        if (hoverTimer.current) clearTimeout(hoverTimer.current);
                        // Já aberto nesta etapa: fica. Em outra: troca sem esperar.
                        if (hover?.stepId === s.id) return;
                        hoverTimer.current = setTimeout(
                          () => setHover({ stepId: s.id, rect }),
                          hover ? 120 : 450,
                        );
                      }}
                      onDragStart={() => setDragging(s.id)}
                      onDragEnd={() => setDragging(null)}
                      onDropOn={() => {
                        if (!dragging || dragging === s.id) return;
                        const from = flow.steps.findIndex((x) => x.id === dragging);
                        const out = [...flow.steps];
                        const [moved] = out.splice(from, 1);
                        out.splice(i, 0, moved);
                        setDragging(null);
                        saveSteps(out);
                      }}
                    />
                    {i < flow.steps.length - 1 && (
                      <span className="flex w-5 items-center justify-center text-dim" aria-hidden="true">
                        <ChevronRightIcon size={14} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {step && (
              <StepDetails
                flow={flow}
                step={step}
                team={team}
                onPatch={(p) => patchStep(step.id, p)}
                onDuplicate={() => duplicate(step.id)}
                onRemove={() => remove(step.id)}
              />
            )}
          </section>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-card bg-flow-panel p-8">
            <div className="flex max-w-[320px] flex-col items-center gap-4 text-center">
              <p className="text-[13px] leading-[19px] text-muted">
                Nenhum fluxo ainda. É ele que diz por onde as tarefas passam e com quem — comece
                pelo modelo (Briefing → Redação → Design → Revisão → Aprovação → Publicação, tudo
                com o squad do cliente) ou monte um do zero.
              </p>
              <Link
                href="/configuracoes/fluxos/novo"
                className="tap rounded-mark bg-primary px-4 py-2.5 text-[13px] font-semibold text-on-primary hover:bg-white"
              >
                Novo fluxo
              </Link>
            </div>
          </div>
        )}
      </div>

      {menu && flow && (
        <StepMenu
          flow={flow}
          stepId={menu.stepId}
          at={menu}
          onClose={() => setMenu(null)}
          onEdit={() => setStepId(menu.stepId)}
          onDuplicate={() => duplicate(menu.stepId)}
          onStart={() => void save(flow.id, { startStepId: menu.stepId })}
          onMove={(dir) => move(menu.stepId, dir)}
          onForward={(to) => patchStep(menu.stepId, { nextStepId: to })}
          onCopyLink={() => copyLink(menu.stepId)}
          onToggle={() => {
            const s = flow.steps.find((x) => x.id === menu.stepId);
            if (s) patchStep(s.id, { disabled: !s.disabled });
          }}
          onRemove={() => remove(menu.stepId)}
        />
      )}

      {hover && flow && !menu && (
        <StepPopover
          flow={flow}
          step={flow.steps.find((s) => s.id === hover.stepId)!}
          rect={hover.rect}
          team={team}
          onOpen={() => {
            setStepId(hover.stepId);
            setHover(null);
          }}
          onMenu={(x, y) => {
            setStepId(hover.stepId);
            setMenu({ stepId: hover.stepId, x, y });
            setHover(null);
          }}
          onEnter={keepHover}
          onLeave={leaveHover}
        />
      )}
    </Screen>
  );
}

/* ================================================================ cabeçalho */

function FlowHeader({
  flow,
  onDuplicate,
  onToggle,
  onArchive,
}: {
  flow: Flow;
  onDuplicate: () => void;
  onToggle: () => void;
  onArchive: () => void;
}) {
  const [more, setMore] = useState(false);
  const active = flow.status === "ativo";
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-5 pb-4 pt-[18px]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-[16px] font-semibold text-fg">{flow.name}</h1>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-pill px-2 py-[3px] text-[11px] font-semibold",
              active ? "bg-flow-on-bg text-flow-on-fg" : "bg-row-raised text-muted",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-flow-on" : "bg-status-paused")} />
            {FLOW_STATUS_LABEL[flow.status]}
          </span>
        </div>
        <p className="text-[12px] text-muted">
          {flow.steps.length} {flow.steps.length === 1 ? "etapa" : "etapas"} · Última edição{" "}
          {relative(flow.updatedAt)} por {flow.updatedBy}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <HeaderButton onClick={onDuplicate} icon={<CopyIcon size={13} />}>
          Duplicar
        </HeaderButton>
        <HeaderButton href={`/configuracoes/fluxos/${flow.id}/editar`} icon={<PencilIcon size={13} />}>
          Editar
        </HeaderButton>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          onClick={onToggle}
          disabled={flow.status === "arquivado"}
          className="flex items-center gap-2 px-1 text-[12px] text-fg-soft disabled:opacity-40"
        >
          Ativo
          <Switch on={active} size="md" />
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="Mais opções do fluxo"
            onClick={() => setMore((m) => !m)}
            className="tap flex h-8 w-8 items-center justify-center rounded-mark bg-flow-btn text-fg-3 transition-colors hover:text-fg-soft"
          >
            <EllipsisIcon size={15} />
          </button>
          {more && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMore(false)} />
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[200px] animate-pop-in rounded-menu border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                <MenuItem
                  icon={<PowerIcon size={14} />}
                  label={flow.status === "arquivado" ? "Desarquivar fluxo" : "Arquivar fluxo"}
                  onClick={() => {
                    setMore(false);
                    onArchive();
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function HeaderButton({
  icon,
  onClick,
  href,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never })) {
  const className =
    "tap flex items-center gap-1.5 rounded-mark bg-flow-btn px-3 py-2 text-[12px] font-medium text-fg-soft transition-colors hover:bg-row-raised";
  const body = (
    <>
      <span className="text-fg-3">{icon}</span>
      <span className="hidden sm:inline">{children}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function ViewMode({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={!!active}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-6 w-7 items-center justify-center rounded-tag transition-colors",
        active ? "bg-border text-fg-soft" : "text-muted hover:text-fg-soft",
      )}
    >
      {children}
    </button>
  );
}

/* =================================================================== etapa */

function assigneeLabel(a: StepAssignee, person?: TeamPerson): { initials: string; name: string; role: string } {
  if (a.kind === "cliente") return { initials: "CL", name: "Cliente", role: "Aprovação externa" };
  if (a.kind === "squad") return { initials: "SQ", name: "Squad do cliente", role: "Quem cuida do cliente da tarefa" };
  return person
    ? { initials: initialsOf(person.name), name: person.name, role: `@${person.handle}` }
    : { initials: "?", name: "Ninguém", role: "A pessoa saiu do time" };
}

function StepCard({
  flow,
  step,
  selected,
  start,
  person,
  dragging,
  onSelect,
  onMenu,
  onHover,
  onDragStart,
  onDragEnd,
  onDropOn,
}: {
  flow: Flow;
  step: FlowStep;
  selected: boolean;
  start: boolean;
  person?: TeamPerson;
  dragging: boolean;
  onSelect: () => void;
  onMenu: (x: number, y: number) => void;
  onHover: (rect: DOMRect | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: () => void;
}) {
  const who = assigneeLabel(step.assignee, person);
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropOn();
      }}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e.clientX, e.clientY);
      }}
      onMouseEnter={(e) => onHover(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onHover(null)}
      aria-pressed={selected}
      aria-label={`Etapa ${stepNumber(flow, step.id)}: ${step.name}`}
      className={cn(
        "flex min-h-[120px] w-[136px] shrink-0 flex-col gap-2 rounded-menu p-3 text-left transition-colors",
        selected ? "bg-row-raised" : "bg-surface hover:bg-row-raised/70",
        step.disabled && "opacity-45",
        dragging && "opacity-40",
      )}
    >
      <span className="flex w-full items-center justify-between">
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "rounded-tag px-1.5 py-0.5 text-[10px] font-bold",
              selected ? "bg-primary text-on-primary" : "bg-border text-muted",
            )}
          >
            {stepNumber(flow, step.id)}
          </span>
          {start && <FlagIcon size={11} className="text-muted" aria-label="Início do fluxo" />}
        </span>
        <GripVerticalIcon size={14} className="cursor-grab text-dim" />
      </span>
      <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-flow-well text-fg-3">
        <StepGlyph icon={step.icon} size={16} />
      </span>
      <span className={cn("truncate text-[13px] font-semibold", selected ? "text-fg" : "text-fg-soft")}>
        {step.name}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          title={who.name}
          className="flex h-5 w-5 items-center justify-center rounded-pill bg-border text-[9px] font-semibold text-fg-soft"
        >
          {who.initials}
        </span>
        <span className="flex items-center gap-1 rounded-tag bg-flow-well px-1.5 py-0.5 text-[10px] font-semibold text-muted">
          <Clock3Icon size={10} />
          {step.slaDays ? `${step.slaDays}d` : "—"}
        </span>
      </span>
    </button>
  );
}

/* ================================================ configuração da etapa */

function StepDetails({
  flow,
  step,
  team,
  onPatch,
  onDuplicate,
  onRemove,
}: {
  flow: Flow;
  step: FlowStep;
  team: TeamPerson[];
  onPatch: (p: Partial<FlowStep>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const person = step.assignee.kind === "membro" ? team.find((p) => p.id === (step.assignee as { memberId: string }).memberId) : undefined;
  const who = assigneeLabel(step.assignee, person);
  const backup = step.backupId ? team.find((p) => p.id === step.backupId) : undefined;
  const next = nextStep(flow, step.id);
  const nextPerson = next?.assignee.kind === "membro" ? team.find((p) => p.id === (next.assignee as { memberId: string }).memberId) : undefined;
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const activeAutomations = AUTOMATIONS.filter((a) => step.automations[a.id]).length;

  const assigneeOptions: PickOption[] = [
    ...team.map((p) => ({ id: `m:${p.id}`, label: p.name, hint: `@${p.handle}` })),
    { id: "squad", label: "Squad do cliente", hint: "quem cuida do cliente" },
    { id: "cliente", label: "Cliente", hint: "aprovação externa" },
  ];

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[11px] font-semibold tracking-wide text-label">CONFIGURAÇÃO DA ETAPA</span>
          <span className="flex min-w-0 items-center gap-1.5 rounded-pill bg-row-raised px-2.5 py-[3px]">
            <span className="text-[10px] font-bold text-fg-soft">{stepNumber(flow, step.id)}</span>
            {editingName ? (
              <input
                autoFocus
                defaultValue={step.name}
                aria-label="Nome da etapa"
                onBlur={(e) => {
                  setEditingName(false);
                  if (e.target.value.trim() && e.target.value.trim() !== step.name) onPatch({ name: e.target.value.trim() });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="w-[140px] bg-transparent text-[12px] font-semibold text-fg focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                title="Renomear etapa"
                className="truncate text-[12px] font-semibold text-fg hover:underline"
              >
                {step.name}
              </button>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <SmallButton onClick={onDuplicate} icon={<CopyIcon size={12} />}>
            Duplicar etapa
          </SmallButton>
          <SmallButton onClick={onRemove} icon={<TrashIcon size={12} />} danger>
            Remover
          </SmallButton>
        </div>
      </div>

      {/* Responsável · Prazo · Próxima */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <Card label="RESPONSÁVEL" icon={<UserRoundIcon size={12} />}>
          <Picker
            options={assigneeOptions}
            value={step.assignee.kind === "membro" ? `m:${step.assignee.memberId}` : step.assignee.kind}
            onPick={(id) =>
              onPatch({
                assignee:
                  id === "squad"
                    ? { kind: "squad" }
                    : id === "cliente"
                      ? { kind: "cliente" }
                      : { kind: "membro", memberId: id.slice(2) },
              })
            }
            label="Responsável da etapa"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-border-strong text-[11px] font-semibold text-fg">
                {who.initials}
              </span>
              <span className="flex min-w-0 flex-col gap-px text-left">
                <span className="truncate text-[13px] font-semibold text-fg-soft">{who.name}</span>
                <span className="truncate text-[11px] text-muted">{who.role}</span>
              </span>
            </span>
          </Picker>
          <Picker
            options={[{ id: "", label: "Sem backup" }, ...team.map((p) => ({ id: p.id, label: p.name, hint: `@${p.handle}` }))]}
            value={step.backupId ?? ""}
            onPick={(id) => onPatch({ backupId: id || null })}
            label="Backup da etapa"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] text-flow-hint">Backup</span>
              <span className={cn("h-3 w-3 rounded-full", backup ? "bg-flow-wait" : "bg-border")} aria-hidden="true" />
              <span className="text-[11px] text-muted">{backup?.name ?? "ninguém"}</span>
            </span>
          </Picker>
        </Card>

        <Card label="PRAZO / SLA" icon={<Clock3Icon size={12} />}>
          <span className="flex items-baseline gap-1.5">
            <NumberField
              value={step.slaDays}
              onChange={(v) => onPatch({ slaDays: v })}
              label="Prazo em dias úteis"
              className="w-[52px] text-[26px] font-bold leading-[26px] text-fg-soft"
            />
            <span className="text-[12px] text-muted">{step.slaDays ? "dias úteis" : "sem prazo"}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <BellIcon size={12} />
            Alertar
            <NumberField
              value={step.alertDaysBefore}
              onChange={(v) => onPatch({ alertDaysBefore: v })}
              label="Alertar quantos dias antes"
              className="w-[26px] text-center text-[11px] text-fg-soft"
            />
            {step.alertDaysBefore ? "d antes" : "(sem alerta)"}
          </span>
        </Card>

        <Card label="PRÓXIMA ETAPA" icon={<ArrowRightToLineIcon size={12} />}>
          <Picker
            options={[
              { id: "", label: "Seguir a ordem do pipeline" },
              ...flow.steps.filter((s) => s.id !== step.id).map((s) => ({ id: s.id, label: s.name, hint: stepNumber(flow, s.id) })),
            ]}
            value={step.nextStepId ?? ""}
            onPick={(id) => onPatch({ nextStepId: id || null })}
            label="Próxima etapa"
          >
            {next ? (
              <span className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-flow-well text-fg-3">
                  <StepGlyph icon={next.icon} size={15} />
                </span>
                <span className="flex min-w-0 flex-col gap-px text-left">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-fg-soft">{next.name}</span>
                    <span className="rounded-tag bg-border px-[5px] py-px text-[9px] font-bold text-muted">
                      {stepNumber(flow, next.id)}
                    </span>
                  </span>
                  <span className="truncate text-[11px] text-muted">
                    {assigneeLabel(next.assignee, nextPerson).name}
                  </span>
                </span>
              </span>
            ) : (
              <span className="flex flex-col gap-px text-left">
                <span className="text-[13px] font-semibold text-fg-soft">Fim do fluxo</span>
                <span className="text-[11px] text-muted">A tarefa fica concluída aqui</span>
              </span>
            )}
          </Picker>
        </Card>
      </div>

      {/* Transição de status */}
      <section className="flex flex-col gap-3 rounded-menu bg-surface p-3.5">
        <div className="flex items-center justify-between">
          <CardLabel icon={<ArrowLeftRightIcon size={12} />}>TRANSIÇÃO DE STATUS</CardLabel>
          <button
            type="button"
            aria-label={editingStatus ? "Concluir edição" : "Editar transição"}
            onClick={() => setEditingStatus((v) => !v)}
            className="text-muted transition-colors hover:text-fg-soft"
          >
            {editingStatus ? <XIcon size={13} /> : <PencilIcon size={13} />}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="flex flex-col gap-[5px]">
            <span className="text-[9px] font-semibold text-flow-hint">AO ENTRAR NA ETAPA</span>
            <StatusBadge
              tone="wait"
              value={step.entryStatus}
              editing={editingStatus}
              placeholder="Aguardando…"
              onChange={(v) => onPatch({ entryStatus: v })}
            />
          </div>
          <ArrowRightIcon size={14} className="mb-2 text-dim" />
          <div className="flex flex-col gap-[5px]">
            <span className="text-[9px] font-semibold text-flow-hint">ETAPA</span>
            <span className="flex items-center gap-2 rounded-mark bg-row-raised px-3 py-[7px] text-[12px] font-semibold text-fg">
              <StepGlyph icon={step.icon} size={13} />
              {step.name}
            </span>
          </div>
          <ArrowRightIcon size={14} className="mb-2 text-dim" />
          <div className="flex flex-col gap-[5px]">
            <span className="text-[9px] font-semibold text-flow-hint">AO CONCLUIR A ETAPA</span>
            <StatusBadge
              tone="done"
              value={step.exitStatus}
              editing={editingStatus}
              placeholder="Pronto para…"
              onChange={(v) => onPatch({ exitStatus: v })}
            />
          </div>
        </div>
      </section>

      {/* Aprovações · Automações */}
      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-menu bg-surface p-3.5">
          <CardLabel icon={<ShieldCheckIcon size={12} />} count={String(step.approvers.length)}>
            APROVAÇÕES E REVISÕES
          </CardLabel>
          <ul className="flex flex-col gap-1.5">
            {step.approvers.length === 0 && (
              <li className="px-1 text-[11px] text-muted">Ninguém precisa aprovar esta etapa.</li>
            )}
            {step.approvers.map((a, i) => {
              const p = a.memberId ? team.find((x) => x.id === a.memberId) : undefined;
              const label = a.memberId ? p?.name ?? "Saiu do time" : "Cliente";
              return (
                <li key={a.memberId ?? "cliente"} className="group flex items-center gap-2 rounded-chip bg-flow-well px-2.5 py-2">
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-pill bg-border text-[9px] font-semibold text-fg-soft">
                    {a.memberId ? initialsOf(label) : "CL"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[12px] font-medium text-fg-soft">{label}</span>
                    <span className="truncate text-[10px] text-label">
                      {a.memberId ? (p ? `@${p.handle}` : "—") : "Aprovação externa"}
                    </span>
                  </span>
                  <button
                    type="button"
                    title="Trocar entre obrigatório e opcional"
                    onClick={() =>
                      onPatch({
                        approvers: step.approvers.map((x, j) => (j === i ? { ...x, required: !x.required } : x)),
                      })
                    }
                    className={cn(
                      "rounded-tag px-1.5 py-0.5 text-[10px] font-semibold",
                      a.required ? "bg-flow-wait-bg text-flow-wait-fg" : "bg-flow-panel text-muted",
                    )}
                  >
                    {a.required ? "Obrigatório" : "Opcional"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Tirar ${label} dos aprovadores`}
                    onClick={() => onPatch({ approvers: step.approvers.filter((_, j) => j !== i) })}
                    className="text-dim opacity-0 transition-opacity hover:text-fg-soft focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <XIcon size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
          <Picker
            options={[
              { id: "cliente", label: "Cliente", hint: "aprovação externa" },
              ...team.map((p) => ({ id: p.id, label: p.name, hint: `@${p.handle}` })),
            ].filter((o) => !step.approvers.some((a) => (a.memberId ?? "cliente") === o.id))}
            value=""
            onPick={(id) =>
              onPatch({ approvers: [...step.approvers, { memberId: id === "cliente" ? null : id, required: true }] })
            }
            label="Adicionar aprovador"
          >
            <span className="flex w-fit items-center gap-1.5 rounded-mark px-2.5 py-1.5 text-[11px] font-medium text-muted hover:bg-flow-btn">
              <PlusIcon size={12} />
              Adicionar aprovador
            </span>
          </Picker>
        </section>

        <section className="flex flex-col gap-3 rounded-menu bg-surface p-3.5">
          <CardLabel
            icon={<ZapIcon size={12} />}
            count={`${activeAutomations} ${activeAutomations === 1 ? "ativa" : "ativas"}`}
          >
            AÇÕES AUTOMÁTICAS
          </CardLabel>
          <ul className="flex flex-col gap-1.5">
            {AUTOMATIONS.map((a) => {
              const on = step.automations[a.id];
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => onPatch({ automations: { ...step.automations, [a.id]: !on } })}
                    className="flex w-full items-center gap-2 rounded-chip bg-flow-well px-2.5 py-2 text-left"
                  >
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-mark bg-row-raised text-fg-3">
                      <AutomationGlyph id={a.id} />
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate text-[11px]", on ? "text-fg-soft" : "text-muted")}>
                      {a.label}
                    </span>
                    <Switch on={on} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function AutomationGlyph({ id }: { id: AutomationId }) {
  if (id === "notificar") return <BellIcon size={12} />;
  if (id === "postar") return <MessageSquareIcon size={12} />;
  if (id === "historico") return <FileCheckIcon size={12} />;
  return <CalendarClockIcon size={12} />;
}

function CardLabel({
  icon,
  count,
  children,
}: {
  icon: React.ReactNode;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 text-label">
      {icon}
      <span className="text-[10px] font-semibold tracking-wide">{children}</span>
      {count !== undefined && (
        <span className="rounded-pill bg-row-raised px-[7px] py-px text-[10px] font-semibold text-muted">{count}</span>
      )}
    </span>
  );
}

function Card({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5 rounded-menu bg-surface p-3">
      <CardLabel icon={icon}>{label}</CardLabel>
      {children}
    </section>
  );
}

function SmallButton({
  icon,
  onClick,
  danger,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap flex items-center gap-[5px] rounded-mark bg-flow-btn px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-row-raised",
        danger ? "text-flow-danger" : "text-fg-soft",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function StatusBadge({
  tone,
  value,
  editing,
  placeholder,
  onChange,
}: {
  tone: "wait" | "done";
  value: string;
  editing: boolean;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 rounded-mark px-2.5 py-[7px]",
        tone === "wait" ? "bg-flow-wait-bg" : "bg-flow-done-bg",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", tone === "wait" ? "bg-flow-wait" : "bg-flow-on")} />
      {editing ? (
        <input
          defaultValue={value}
          placeholder={placeholder}
          aria-label={tone === "wait" ? "Status ao entrar" : "Status ao concluir"}
          onBlur={(e) => e.target.value.trim() !== value && onChange(e.target.value.trim())}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={cn(
            "w-[150px] bg-transparent text-[12px] font-medium focus:outline-none",
            tone === "wait" ? "text-flow-wait-fg" : "text-flow-on-fg",
          )}
        />
      ) : (
        <span className={cn("text-[12px] font-medium", tone === "wait" ? "text-flow-wait-fg" : "text-flow-on-fg")}>
          {value || "—"}
        </span>
      )}
    </span>
  );
}

function NumberField({
  value,
  onChange,
  label,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  className?: string;
}) {
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      defaultValue={value ?? ""}
      key={value ?? "vazio"}
      placeholder="—"
      onBlur={(e) => {
        const raw = e.target.value.trim();
        const n = raw === "" ? null : Math.max(0, Math.min(90, Math.floor(Number(raw))));
        const next = n === null || Number.isNaN(n) || n === 0 ? null : n;
        if (next !== value) onChange(next);
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={cn(
        "rounded-tag bg-transparent tabular-nums placeholder:text-dim hover:bg-flow-well focus:bg-flow-well focus:outline-none",
        className,
      )}
    />
  );
}

/* ================================================= escolha numa lista */

type PickOption = { id: string; label: string; hint?: string };

function Picker({
  options,
  value,
  onPick,
  label,
  children,
}: {
  options: PickOption[];
  value: string;
  onPick: (id: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-mark text-left transition-colors hover:bg-flow-well/60"
      >
        {children}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            aria-label={label}
            className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-[260px] w-[232px] animate-pop-in overflow-y-auto rounded-menu border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          >
            {options.map((o) => (
              <li key={o.id || "nenhum"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  onClick={() => {
                    setOpen(false);
                    if (o.id !== value || value === "") onPick(o.id);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-mark px-2.5 py-[7px] text-left text-[12px] transition-colors hover:bg-row-raised",
                    o.id === value ? "text-fg" : "text-fg-soft",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-[10px] text-flow-hint">{o.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ============================================ menu de contexto da etapa */

function MenuItem({
  icon,
  label,
  shortcut,
  danger,
  trailing,
  onClick,
  onMouseEnter,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  danger?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className="flex w-full items-center gap-2.5 rounded-mark px-2.5 py-[7px] text-left transition-colors hover:bg-row-raised focus-visible:bg-row-raised focus-visible:outline-none"
    >
      <span className={cn("flex h-4 w-4 items-center justify-center", danger ? "text-flow-danger" : "text-fg-3")}>
        {icon}
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-[12px]", danger ? "text-flow-danger" : "text-fg-soft")}>
        {label}
      </span>
      {shortcut && <span className="shrink-0 text-[10px] font-medium text-flow-hint">{shortcut}</span>}
      {trailing}
    </button>
  );
}

function MenuRule() {
  return <div className="my-0.5 h-px bg-rule" />;
}

function StepMenu({
  flow,
  stepId,
  at,
  onClose,
  onEdit,
  onDuplicate,
  onStart,
  onMove,
  onForward,
  onCopyLink,
  onToggle,
  onRemove,
}: {
  flow: Flow;
  stepId: string;
  at: { x: number; y: number };
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onStart: () => void;
  onMove: (dir: -1 | 1) => void;
  onForward: (to: string | null) => void;
  onCopyLink: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const step = flow.steps.find((s) => s.id === stepId);
  const [forward, setForward] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: at.x, top: at.y });

  // Não deixa o menu sair da tela: abre para cima/esquerda quando falta chão.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)),
    });
    el.querySelector<HTMLButtonElement>("button")?.focus();
  }, [at.x, at.y]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key.toLowerCase() === "e" && !e.metaKey && !e.ctrlKey) {
        onEdit();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onEdit]);

  if (!step || typeof document === "undefined") return null;
  const i = flow.steps.indexOf(step);
  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={ref}
        role="menu"
        aria-label={`Etapa ${step.name}`}
        style={{ left: pos.left, top: pos.top }}
        className="fixed z-[61] flex w-[232px] animate-pop-in flex-col gap-px rounded-menu border border-border bg-surface p-1 shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-2">
          <span className="text-[9px] font-semibold text-flow-hint">ETAPA</span>
          <span className="flex min-w-0 items-center gap-[5px] rounded-pill bg-row-raised px-[7px] py-px">
            <span className="text-[9px] font-bold text-fg-soft">{stepNumber(flow, step.id)}</span>
            <span className="truncate text-[10px] font-semibold text-fg-soft">{step.name}</span>
          </span>
        </div>
        <MenuRule />
        <MenuItem icon={<SquarePenIcon size={14} />} label="Editar etapa" shortcut="E" onClick={run(onEdit)} />
        <MenuItem icon={<CopyIcon size={14} />} label="Duplicar etapa" shortcut="⌘D" onClick={run(onDuplicate)} />
        <MenuItem icon={<FlagIcon size={14} />} label="Definir como início" onClick={run(onStart)} />
        <MenuRule />
        {i > 0 && <MenuItem icon={<ArrowLeftIcon size={14} />} label="Mover para esquerda" shortcut="⌘←" onClick={run(() => onMove(-1))} />}
        {i < flow.steps.length - 1 && (
          <MenuItem icon={<ArrowRightIcon size={14} />} label="Mover para direita" shortcut="⌘→" onClick={run(() => onMove(1))} />
        )}
        <MenuRule />
        <div className="relative" onMouseLeave={() => setForward(false)}>
          <MenuItem
            icon={<ArrowRightToLineIcon size={14} />}
            label="Encaminhar para…"
            trailing={<ChevronRightIcon size={13} className="text-muted" />}
            onClick={() => setForward((f) => !f)}
            onMouseEnter={() => setForward(true)}
          />
          {forward && (
            <div
              role="menu"
              aria-label="Encaminhar para"
              className="absolute left-[calc(100%+4px)] top-0 z-[62] flex w-[200px] flex-col gap-px rounded-menu border border-border bg-surface p-1 shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
            >
              <MenuItem
                icon={step.nextStepId === null ? <CheckDot /> : <span />}
                label="Seguir a ordem"
                onClick={run(() => onForward(null))}
              />
              {flow.steps
                .filter((s) => s.id !== step.id)
                .map((s) => (
                  <MenuItem
                    key={s.id}
                    icon={step.nextStepId === s.id ? <CheckDot /> : <StepGlyph icon={s.icon} size={13} />}
                    label={s.name}
                    shortcut={stepNumber(flow, s.id)}
                    onClick={run(() => onForward(s.id))}
                  />
                ))}
            </div>
          )}
        </div>
        <MenuItem icon={<LinkIcon size={14} />} label="Copiar link da etapa" shortcut="⌘L" onClick={run(onCopyLink)} />
        <MenuItem
          icon={<PowerIcon size={14} />}
          label={step.disabled ? "Ativar etapa" : "Desativar etapa"}
          onClick={run(onToggle)}
        />
        <MenuRule />
        <MenuItem icon={<TrashIcon size={14} />} label="Remover etapa" shortcut="⌫" danger onClick={run(onRemove)} />
      </div>
    </>,
    document.body,
  );
}

function CheckDot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-fg-soft" />;
}

/* ============================================= cartão de hover da etapa */

function StepPopover({
  flow,
  step,
  rect,
  team,
  onOpen,
  onMenu,
  onEnter,
  onLeave,
}: {
  flow: Flow;
  step: FlowStep;
  rect: DOMRect;
  team: TeamPerson[];
  onOpen: () => void;
  onMenu: (x: number, y: number) => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  if (!step || typeof document === "undefined") return null;
  const pos = stepPosition(flow, step.id);
  const person = step.assignee.kind === "membro" ? team.find((p) => p.id === (step.assignee as { memberId: string }).memberId) : undefined;
  const who = assigneeLabel(step.assignee, person);
  const next = nextStep(flow, step.id);
  const approvals = step.approvers.length;
  const autos = AUTOMATIONS.filter((a) => step.automations[a.id]).length;
  const width = 320;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const below = rect.bottom + 8;
  const top = below + 300 > window.innerHeight ? Math.max(8, rect.top - 8 - 300) : below;

  return createPortal(
    <div
      role="dialog"
      aria-label={`Etapa ${step.name}`}
      style={{ left, top, width }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="fixed z-[55] flex animate-pop-in flex-col gap-3 rounded-nav border border-border bg-surface p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-row-raised text-fg-3">
          <StepGlyph icon={step.icon} size={16} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-fg">{step.name}</span>
            <span className="rounded-tag bg-border px-[5px] py-px text-[9px] font-bold text-muted">
              {stepNumber(flow, step.id)}
            </span>
          </span>
          <span className="truncate text-[11px] text-label">
            Etapa {pos?.index} de {pos?.total} · {flow.name}
          </span>
        </span>
      </div>
      <div className="h-px bg-rule" />
      <dl className="flex flex-col gap-2">
        <PopRow icon={<UserRoundIcon size={13} />} k="Responsável">
          <span className="flex items-center gap-1.5">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-pill bg-border-strong text-[8px] font-bold text-fg">
              {who.initials}
            </span>
            <span className="truncate text-[12px] font-medium text-fg-soft">{who.name}</span>
          </span>
        </PopRow>
        <PopRow icon={<Clock3Icon size={13} />} k="Prazo">
          <span className="text-[12px] font-medium text-fg-soft">
            {step.slaDays ? `${step.slaDays} ${step.slaDays === 1 ? "dia útil" : "dias úteis"}` : "Sem prazo"}
          </span>
        </PopRow>
        <PopRow icon={<ArrowRightToLineIcon size={13} />} k="Próxima">
          <span className="text-[12px] font-medium text-fg-soft">
            {next ? `${next.name} (${stepNumber(flow, next.id)})` : "Fim do fluxo"}
          </span>
        </PopRow>
        <PopRow icon={<ArrowLeftRightIcon size={13} />} k="Status">
          <span className="flex items-center gap-1.5">
            <MiniStatus tone="wait">{step.entryStatus || "—"}</MiniStatus>
            <ArrowRightIcon size={11} className="text-dim" />
            <MiniStatus tone="done">{step.exitStatus || "—"}</MiniStatus>
          </span>
        </PopRow>
      </dl>
      <div className="flex gap-2">
        <span className="flex items-center gap-[5px] rounded-mark bg-flow-well px-2 py-[5px] text-[11px] font-medium text-muted">
          <ShieldCheckIcon size={12} />
          {approvals} {approvals === 1 ? "aprovador" : "aprovadores"}
        </span>
        <span className="flex items-center gap-[5px] rounded-mark bg-flow-well px-2 py-[5px] text-[11px] font-medium text-muted">
          <ZapIcon size={12} />
          {autos} {autos === 1 ? "automação" : "automações"}
        </span>
      </div>
      <div className="h-px bg-rule" />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onOpen}
          className="tap flex h-8 items-center gap-1.5 rounded-mark bg-primary px-3 text-[12px] font-semibold text-on-primary hover:bg-white"
        >
          <SquareArrowOutUpRightIcon size={13} />
          Abrir etapa
        </button>
        <button
          type="button"
          aria-label="Editar etapa"
          onClick={onOpen}
          className="tap flex h-8 w-8 items-center justify-center rounded-mark bg-row-raised text-fg-3 hover:text-fg-soft"
        >
          <PencilIcon size={13} />
        </button>
        <button
          type="button"
          aria-label="Mais opções da etapa"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onMenu(r.left, r.bottom + 6);
          }}
          className="tap flex h-8 w-8 items-center justify-center rounded-mark bg-row-raised text-fg-3 hover:text-fg-soft"
        >
          <EllipsisIcon size={14} />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function PopRow({ icon, k, children }: { icon: React.ReactNode; k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-label">{icon}</span>
      <dt className="w-[90px] shrink-0 text-[11px] text-muted">{k}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function MiniStatus({ tone, children }: { tone: "wait" | "done"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-tag px-1.5 py-0.5 text-[10px] font-semibold",
        tone === "wait" ? "bg-flow-wait-bg text-flow-wait-fg" : "bg-flow-done-bg text-flow-on-fg",
      )}
    >
      <span className={cn("h-[5px] w-[5px] rounded-full", tone === "wait" ? "bg-flow-wait" : "bg-flow-on")} />
      {children}
    </span>
  );
}
