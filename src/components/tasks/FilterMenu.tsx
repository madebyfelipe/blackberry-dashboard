"use client";

import { useMemo, useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { STATUSES } from "@/lib/tasks/constants";
import {
  DATE_OPTIONS,
  distinct,
  toggleIn,
  type DateRange,
  type Filters,
} from "@/lib/tasks/view";
import {
  BellIcon,
  BotIcon,
  BoxIcon,
  BoxesIcon,
  CalendarIcon,
  ChartColumnIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  CircleXIcon,
  FileTextIcon,
  FlagIcon,
  Link2Icon,
  LinkIcon,
  LayoutTemplateIcon,
  SlidersIcon,
  SparklesIcon,
  SquareTerminalIcon,
  TagIcon,
  TagsIcon,
  UserIcon,
  UserPenIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

/*
 * Menu de filtros — fiel ao export "Filtros · Menu" (painel de 264px, linhas de
 * 13px com ícone à esquerda e chevron à direita).
 *
 * As linhas que o design lista e que ainda não têm campo no modelo de tarefas
 * (Agente, Prioridade, Etiquetas…) continuam visíveis, como no desenho, mas
 * avisam em vez de fingir que filtram.
 */

type RowId =
  | "ia"
  | "avancado"
  | "status"
  | "assignee"
  | "agente"
  | "sessao"
  | "criador"
  | "prioridade"
  | "etiquetas"
  | "relacoes"
  | "etiqueta-sugerida"
  | "datas"
  | "cliente"
  | "propriedades"
  | "inscritos"
  | "fonte"
  | "fechado"
  | "conteudo"
  | "links"
  | "modelo";

type Row = {
  id: RowId;
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactNode;
  /** Linhas com submenu abrem uma lista de valores; as demais avisam. */
  submenu?: "status" | "assignee" | "cliente" | "datas";
  chevron?: boolean;
  /** Divisor acima da linha, como no export. */
  divider?: boolean;
};

const ROWS: Row[] = [
  { id: "ia", label: "Filtro com IA", Icon: SparklesIcon },
  { id: "avancado", label: "Filtro avançado", Icon: SlidersIcon },
  { id: "status", label: "Status", Icon: CircleDashedIcon, submenu: "status", chevron: true, divider: true },
  { id: "assignee", label: "Responsável", Icon: UserIcon, submenu: "assignee", chevron: true },
  { id: "agente", label: "Agente", Icon: BotIcon, chevron: true },
  { id: "sessao", label: "Sessão do agente", Icon: SquareTerminalIcon, chevron: true },
  { id: "criador", label: "Criador", Icon: UserPenIcon, chevron: true },
  { id: "prioridade", label: "Prioridade", Icon: ChartColumnIcon, chevron: true },
  { id: "etiquetas", label: "Etiquetas", Icon: TagIcon, chevron: true },
  { id: "relacoes", label: "Relações", Icon: FlagIcon, chevron: true },
  { id: "etiqueta-sugerida", label: "Etiqueta sugerida", Icon: TagsIcon, chevron: true },
  { id: "datas", label: "Datas", Icon: CalendarIcon, submenu: "datas", chevron: true },
  { id: "cliente", label: "Cliente", Icon: BoxIcon, submenu: "cliente", chevron: true, divider: true },
  { id: "propriedades", label: "Propriedades do cliente", Icon: BoxesIcon, chevron: true },
  { id: "inscritos", label: "Inscritos", Icon: BellIcon, chevron: true, divider: true },
  { id: "fonte", label: "Fonte externa", Icon: LinkIcon, chevron: true, divider: true },
  { id: "fechado", label: "Fechado automaticamente", Icon: CircleXIcon, chevron: true },
  { id: "conteudo", label: "Conteúdo", Icon: FileTextIcon, chevron: true },
  { id: "links", label: "Links", Icon: Link2Icon, chevron: true },
  { id: "modelo", label: "Modelo", Icon: LayoutTemplateIcon, chevron: true },
];

export function FilterMenu({
  tasks,
  filters,
  onChange,
  onUnavailable,
  onClose,
}: {
  tasks: Task[];
  filters: Filters;
  onChange: (next: Filters) => void;
  onUnavailable: (label: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sub, setSub] = useState<Row["submenu"] | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ROWS;
    return ROWS.filter((r) => r.label.toLowerCase().includes(q)).map((r, i) => ({
      ...r,
      divider: i === 0 ? false : r.divider,
    }));
  }, [query]);

  const assignees = useMemo(() => distinct(tasks, "assignee"), [tasks]);
  const clients = useMemo(() => distinct(tasks, "client"), [tasks]);

  return (
    <div className="w-[264px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
      {sub ? (
        <SubMenu
          kind={sub}
          filters={filters}
          onChange={onChange}
          onBack={() => setSub(null)}
          assignees={assignees}
          clients={clients}
        />
      ) : (
        <>
          {/* Search Row */}
          <div className="flex items-center justify-between gap-2 px-2.5 py-[7px]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
              placeholder="Adicionar filtro..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-fg-soft placeholder:text-muted focus:outline-none"
            />
            <span className="rounded-mark border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
              F
            </span>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {rows.map((row) => (
              <div key={row.id}>
                {row.divider && <Divider />}
                <MenuRow
                  label={row.label}
                  icon={<row.Icon size={14} />}
                  chevron={row.chevron}
                  count={countFor(row.id, filters)}
                  onClick={() => {
                    if (row.submenu) setSub(row.submenu);
                    else onUnavailable(row.label);
                  }}
                />
              </div>
            ))}
            {rows.length === 0 && (
              <p className="px-2.5 py-3 text-[12px] text-muted">
                Nenhum filtro com esse nome.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function countFor(id: RowId, f: Filters): number {
  if (id === "status") return f.status.length;
  if (id === "assignee") return f.assignee.length;
  if (id === "cliente") return f.client.length;
  if (id === "datas") return f.created === "qualquer" ? 0 : 1;
  return 0;
}

function SubMenu({
  kind,
  filters,
  onChange,
  onBack,
  assignees,
  clients,
}: {
  kind: NonNullable<Row["submenu"]>;
  filters: Filters;
  onChange: (f: Filters) => void;
  onBack: () => void;
  assignees: string[];
  clients: string[];
}) {
  const title =
    kind === "status"
      ? "Status"
      : kind === "assignee"
        ? "Responsável"
        : kind === "cliente"
          ? "Cliente"
          : "Datas";

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="flex w-full items-center gap-2 rounded-mark px-2.5 py-[7px] text-left text-[13px] font-medium text-fg-soft hover:bg-surface-2"
      >
        <ChevronLeftIcon size={14} className="text-muted" />
        {title}
      </button>
      <Divider />
      <div className="max-h-[420px] overflow-y-auto">
        {kind === "status" &&
          STATUSES.map((s) => (
            <OptionRow
              key={s.id}
              label={s.label}
              selected={filters.status.includes(s.id)}
              dot={s.dot}
              onClick={() =>
                onChange({
                  ...filters,
                  status: toggleIn<TaskStatus>(filters.status, s.id),
                })
              }
            />
          ))}

        {kind === "assignee" &&
          assignees.map((a) => (
            <OptionRow
              key={a}
              label={a}
              selected={filters.assignee.includes(a)}
              onClick={() =>
                onChange({ ...filters, assignee: toggleIn(filters.assignee, a) })
              }
            />
          ))}

        {kind === "cliente" &&
          clients.map((c) => (
            <OptionRow
              key={c}
              label={c}
              selected={filters.client.includes(c)}
              onClick={() =>
                onChange({ ...filters, client: toggleIn(filters.client, c) })
              }
            />
          ))}

        {kind === "datas" &&
          DATE_OPTIONS.map((d) => (
            <OptionRow
              key={d.id}
              label={d.label}
              selected={filters.created === d.id}
              onClick={() =>
                onChange({ ...filters, created: d.id as DateRange })
              }
            />
          ))}
      </div>
    </>
  );
}

function MenuRow({
  label,
  icon,
  chevron,
  count,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  chevron?: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-mark px-2.5 py-1.5 text-left transition-colors hover:bg-surface-2"
    >
      <span className="flex items-center gap-2.5">
        <span className="text-muted">{icon}</span>
        <span className="text-[13px] text-fg-soft">{label}</span>
      </span>
      <span className="flex items-center gap-1.5">
        {!!count && (
          <span className="rounded-pill bg-border px-1.5 py-0.5 text-[10px] font-medium text-fg-soft">
            {count}
          </span>
        )}
        {chevron && <ChevronRightIcon size={14} className="text-muted" />}
      </span>
    </button>
  );
}

function OptionRow({
  label,
  selected,
  dot,
  onClick,
}: {
  label: string;
  selected: boolean;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-mark px-2.5 py-1.5 text-left transition-colors hover:bg-surface-2"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {dot ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: dot }}
          />
        ) : (
          <span className="h-2 w-2 shrink-0 rounded-full bg-border-strong" />
        )}
        <span className="truncate text-[13px] text-fg-soft">{label}</span>
      </span>
      <CheckIcon
        size={14}
        className={cn("text-fg-soft", selected ? "opacity-100" : "opacity-0")}
      />
    </button>
  );
}

function Divider() {
  return (
    <div className="p-1">
      <div className="h-px bg-border" />
    </div>
  );
}
