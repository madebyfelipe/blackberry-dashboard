"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Client, ClientStatus } from "@/lib/clients/types";
import { CLIENT_STATUSES } from "@/lib/clients/constants";
import {
  applyClientFilters,
  countActiveClientFilters,
  groupClients,
  sortClients,
  DEFAULT_CLIENT_DISPLAY,
  EMPTY_CLIENT_FILTERS,
  type ClientDisplay,
  type ClientFilters,
} from "@/lib/clients/view";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import {
  Screen,
  ScreenAction,
  ScreenHeader,
  ScreenIconAction,
} from "@/components/ui/Screen";
import { TabStrip, type TabOption } from "@/components/ui/Tabs";
import {
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  ToolbarSearch,
} from "@/components/ui/Toolbar";
import { SelectionBar } from "@/components/ui/SelectionBar";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import {
  ArchiveIcon,
  EllipsisIcon,
  PanelsIcon,
  PlusIcon,
  ShareIcon,
  Settings2Icon,
  SlidersIcon,
  TrashIcon,
} from "@/components/icons";
import { ClientTable } from "./ClientTable";
import { ClientGrid } from "./ClientGrid";
import { ClientModal, type ClientModalState, type ClientModalValues } from "./ClientModal";
import { ClientDisplayMenu, ClientFilterMenu } from "./ClientMenus";
import { apiCreateClient, apiDeleteClient, apiUpdateClient } from "./api";

type StatusTab = ClientStatus | "todos";
type OpenMenu = "filtros" | "visualizacao" | null;

/*
 * Clientes — o ponto central de gestão da carteira da agência (exports
 * "Clientes · Painel (Lista)" e "(Grade)").
 *
 * Jornada: lista › "+ Novo cliente" › criação. A criação usa o mesmo modal
 * da tarefa (ver `ClientModal`). Clicar numa linha ou num card abre a ficha
 * do cliente (`/clientes/<id>`, export "Clientes · Detalhe"); o "Editar" do
 * menu do card continua abrindo o modal. O briefing do cliente tem tela
 * própria, ainda por desenhar — nada aqui o antecipa.
 *
 * As abas de cima são os degraus da régua de saúde; Pausado, Novo e VIP
 * ficam atrás do "..." do desenho.
 */
const VISIBLE_TAB_STATUSES = CLIENT_STATUSES.slice(0, 3);
const HIDDEN_TAB_STATUSES = CLIENT_STATUSES.slice(3);

export function ClientsView({ initialClients }: { initialClients: Client[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [display, setDisplay] = useState<ClientDisplay>(DEFAULT_CLIENT_DISPLAY);
  const [filters, setFilters] = useState<ClientFilters>(EMPTY_CLIENT_FILTERS);
  const [menu, setMenu] = useState<OpenMenu>(null);
  const [tab, setTab] = useState<StatusTab>("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ClientModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const isLista = display.view === "lista";

  // As ações rápidas da lateral levam para /clientes?novo=1.
  useEffect(() => {
    if (params.get("novo") !== "1") return;
    setModal({ mode: "create" });
    router.replace("/clientes");
  }, [params, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setMenu((m) => (m === "filtros" ? null : "filtros"));
      } else if (e.key === "Escape") {
        setMenu(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(() => {
    const base = applyClientFilters(clients, filters, deferredSearch, display);
    const byTab = tab === "todos" ? base : base.filter((c) => c.status === tab);
    return sortClients(byTab, display);
  }, [clients, filters, deferredSearch, tab, display]);

  // O agrupamento é o último passo: ele reparte o que já está filtrado e em ordem.
  const groups = useMemo(
    () =>
      groupClients(visible, display.group, {
        showEmpty: display.showEmptyGroups,
      }),
    [visible, display.group, display.showEmptyGroups],
  );

  const counts = useMemo(() => {
    const m = new Map<StatusTab, number>();
    m.set("todos", clients.length);
    for (const s of CLIENT_STATUSES) m.set(s.id, 0);
    for (const c of clients) m.set(c.status, (m.get(c.status) ?? 0) + 1);
    return m;
  }, [clients]);

  const activeFilters = countActiveClientFilters(filters);

  // A seleção só vale sobre o que está em tela — ver a mesma nota em TasksView.
  const visibleIds = useMemo(() => visible.map((c) => c.id), [visible]);
  const selectedVisible = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected],
  );
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(visibleIds.filter((id) => prev.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (next: boolean) => setSelected(next ? new Set(visibleIds) : new Set()),
    [visibleIds],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  /** Exclusão adiada com desfazer, como nas tarefas. */
  function removeMany(doomed: Client[]) {
    if (doomed.length === 0) return;
    const before = clients;
    const ids = new Set(doomed.map((c) => c.id));
    setClients((cs) => cs.filter((c) => !ids.has(c.id)));
    clearSelection();

    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      try {
        await Promise.all(doomed.map((c) => apiDeleteClient(c.id)));
      } catch (e) {
        setClients(before);
        toast(errMsg(e), "error");
      }
    }, 4200);

    toast(
      doomed.length === 1
        ? "Cliente excluído."
        : `${doomed.length} clientes excluídos.`,
      "success",
      {
        duration: 4000,
        action: {
          label: "Desfazer",
          onClick: () => {
            undone = true;
            clearTimeout(timer);
            setClients(before);
          },
        },
      },
    );
  }

  async function submitModal(values: ClientModalValues) {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.mode === "create") {
        const created = await apiCreateClient(values);
        setClients((cs) => [...cs, created]);
        toast("Cliente criado.");
      } else {
        const updated = await apiUpdateClient(modal.client.id, values);
        setClients((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
        toast("Alterações salvas.");
      }
      setModal(null);
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setSaving(false);
    }
  }

  const statusTabs: TabOption[] = [
    { id: "todos", label: "Todos", count: counts.get("todos") ?? 0 },
    ...VISIBLE_TAB_STATUSES.map((s) => ({
      id: s.id,
      // "A renovar" é como a aba chama o degrau "Renovação", como no export.
      label: s.id === "renovacao" ? "A renovar" : s.label,
      count: counts.get(s.id) ?? 0,
    })),
  ];
  const hiddenTabs: TabOption[] = HIDDEN_TAB_STATUSES.map((s) => ({
    id: s.id,
    label: s.label,
    count: counts.get(s.id) ?? 0,
  }));

  const soon = (what: string) =>
    toast(`"${what}" chega junto com o recurso no produto.`, "info");

  return (
    <Screen gap="md">
      <Breadcrumb
        items={[{ label: "black berry", href: "/tarefas" }, { label: "Clientes" }]}
      />

      <ScreenHeader
        actions={
          <>
            <ScreenAction onClick={() => setModal({ mode: "create" })}>
              Novo cliente
            </ScreenAction>
            <ScreenIconAction label="Mais ações" onClick={() => soon("Mais ações")}>
              <EllipsisIcon size={16} />
            </ScreenIconAction>
          </>
        }
      >
        <TabStrip
          tabs={statusTabs}
          overflow={hiddenTabs}
          active={tab}
          onSelect={(id) => setTab(id as StatusTab)}
          overflowLabel="Mais status"
        />
      </ScreenHeader>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
        <Toolbar
          right={
            <Popover
              open={menu === "visualizacao"}
              onClose={() => setMenu(null)}
              align="right"
              trigger={
                <ToolbarButton
                  icon={<Settings2Icon size={15} />}
                  label="Personalizar"
                  active={menu === "visualizacao"}
                  aria-haspopup="menu"
                  aria-expanded={menu === "visualizacao"}
                  onClick={() =>
                    setMenu((m) => (m === "visualizacao" ? null : "visualizacao"))
                  }
                />
              }
            >
              <ClientDisplayMenu
                display={display}
                onChange={setDisplay}
                filters={filters}
                onFiltersChange={setFilters}
              />
            </Popover>
          }
        >
          <Popover
            open={menu === "filtros"}
            onClose={() => setMenu(null)}
            align="left"
            trigger={
              <ToolbarButton
                icon={<SlidersIcon size={15} />}
                label="Filtros"
                active={menu === "filtros" || activeFilters > 0}
                badge={activeFilters || undefined}
                aria-haspopup="menu"
                aria-expanded={menu === "filtros"}
                onClick={() => setMenu((m) => (m === "filtros" ? null : "filtros"))}
              />
            }
          >
            <ClientFilterMenu
              clients={clients}
              filters={filters}
              onChange={setFilters}
              onClose={() => setMenu(null)}
            />
          </Popover>

          <ToolbarDivider />

          <ToolbarSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar clientes"
          />
        </Toolbar>

        <div className="min-h-0 flex-1">
          {visible.length === 0 ? (
            <EmptyState
              onAdd={() => setModal({ mode: "create" })}
              filtered={activeFilters > 0 || !!search.trim() || tab !== "todos"}
              onClear={() => {
                setFilters(EMPTY_CLIENT_FILTERS);
                setSearch("");
                setTab("todos");
              }}
            />
          ) : isLista ? (
            <ClientTable
              groups={groups}
              columns={display.columns}
              selected={selected}
              onToggle={toggleOne}
              onToggleAll={toggleAll}
              allSelected={
                visibleIds.length > 0 && selectedVisible.length === visibleIds.length
              }
              someSelected={selectedVisible.length > 0}
              onOpen={(c) => router.push(`/clientes/${c.id}`)}
            />
          ) : (
            <ClientGrid
              clients={visible}
              onOpen={(c) => router.push(`/clientes/${c.id}`)}
              onEdit={(c) => setModal({ mode: "edit", client: c })}
              onDelete={(c) => removeMany([c])}
            />
          )}
        </div>

        {isLista && (
          <SelectionBar
            count={selectedVisible.length}
            noun={["selecionado", "selecionados"]}
            onClear={clearSelection}
            actions={[
              {
                label: "Exportar",
                icon: <ShareIcon size={16} />,
                onSelect: () => soon("Exportar"),
              },
              {
                label: "Arquivar",
                icon: <ArchiveIcon size={16} />,
                onSelect: () => soon("Arquivar"),
              },
              {
                label: "Excluir",
                icon: <TrashIcon size={16} />,
                danger: true,
                onSelect: () =>
                  removeMany(clients.filter((c) => selected.has(c.id))),
              },
              {
                label: "Mais",
                icon: <EllipsisIcon size={16} />,
                onSelect: () => soon("Mais ações da seleção"),
              },
            ]}
          />
        )}
      </div>

      <ClientModal
        state={modal}
        onClose={() => setModal(null)}
        onSubmit={submitModal}
        saving={saving}
      />
    </Screen>
  );
}

function EmptyState({
  onAdd,
  filtered,
  onClear,
}: {
  onAdd: () => void;
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex h-full animate-rise-in flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-border text-muted">
        <PanelsIcon size={22} />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-fg-soft">
          Nenhum cliente por aqui
        </p>
        <p className="max-w-xs text-[13px] text-muted">
          {filtered
            ? "Nenhum cliente corresponde ao que está filtrado."
            : "Cadastre o primeiro cliente da carteira para começar."}
        </p>
      </div>
      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="tap rounded-pill border border-border px-4 py-2 text-[13px] text-fg-soft transition-colors hover:bg-surface-2"
        >
          Limpar filtros
        </button>
      ) : (
        <Button className="w-fit" onClick={onAdd}>
          <span className="flex items-center gap-1.5">
            <PlusIcon size={16} /> Novo cliente
          </span>
        </Button>
      )}
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Algo deu errado.";
}
