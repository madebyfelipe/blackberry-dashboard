"use client";

import type { Client, ClientStatus } from "@/lib/clients/types";
import { CLIENT_STATUSES } from "@/lib/clients/constants";
import {
  CLIENT_COLUMN_OPTIONS,
  CLIENT_GROUP_OPTIONS,
  CLIENT_SORT_OPTIONS,
  distinctServices,
  distinctValues,
  toggleClientColumn,
  type ClientDisplay,
  type ClientFilters,
  type ClientGroupKey,
  type ClientSortKey,
} from "@/lib/clients/view";
import {
  ArrowDownWideNarrowIcon,
  ArrowUpDownIcon,
  CheckIcon,
  LayoutGridIcon,
  ListIcon,
} from "@/components/icons";
import {
  MenuChip,
  MenuDivider,
  MenuDropdown,
  MenuPanel,
  MenuRow,
  MenuSegButton,
  MenuSegmented,
  MenuTitle,
  MenuToggle,
} from "@/components/ui/MenuPanel";
import { cn } from "@/lib/cn";

/*
 * Os dois menus da barra de ferramentas de Clientes, com a forma dos menus do
 * produto (raio 10, fundo `surface-2`, linhas de raio 6).
 *
 * Eles filtram pelas colunas que a lista realmente tem — status, segmento,
 * responsável e serviço. Nenhuma dimensão inventada: o menu de Tarefas tem
 * filtros que só avisam porque o campo existe no desenho antigo; aqui não há
 * esse débito e não se cria um.
 */

const panel =
  "w-[264px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]";

export function ClientFilterMenu({
  clients,
  filters,
  onChange,
  onClose,
}: {
  clients: Client[];
  filters: ClientFilters;
  onChange: (next: ClientFilters) => void;
  onClose: () => void;
}) {
  const segments = distinctValues(clients, "segment");
  const owners = distinctValues(clients, "owner");
  const services = distinctServices(clients);

  function toggle<K extends keyof ClientFilters>(key: K, value: string) {
    const list = filters[key] as string[];
    const next = list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
    onChange({ ...filters, [key]: next } as ClientFilters);
  }

  const active =
    filters.status.length +
    filters.segment.length +
    filters.owner.length +
    filters.service.length;

  return (
    <div className={cn(panel, "max-h-[420px] overflow-y-auto")}>
      <Group title="Status">
        {CLIENT_STATUSES.map((s) => (
          <Option
            key={s.id}
            label={s.label}
            checked={filters.status.includes(s.id)}
            onClick={() => toggle("status", s.id)}
            dot={s.badgeFg}
          />
        ))}
      </Group>

      {segments.length > 0 && (
        <Group title="Segmento">
          {segments.map((v) => (
            <Option
              key={v}
              label={v}
              checked={filters.segment.includes(v)}
              onClick={() => toggle("segment", v)}
            />
          ))}
        </Group>
      )}

      {owners.length > 0 && (
        <Group title="Responsável">
          {owners.map((v) => (
            <Option
              key={v}
              label={v}
              checked={filters.owner.includes(v)}
              onClick={() => toggle("owner", v)}
            />
          ))}
        </Group>
      )}

      {services.length > 0 && (
        <Group title="Serviço">
          {services.map((v) => (
            <Option
              key={v}
              label={v}
              checked={filters.service.includes(v)}
              onClick={() => toggle("service", v)}
            />
          ))}
        </Group>
      )}

      {active > 0 && (
        <>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={() => {
              onChange({ status: [], segment: [], owner: [], service: [] });
              onClose();
            }}
            className="w-full rounded-mark px-2.5 py-2 text-left text-[13px] text-muted transition-colors hover:bg-border hover:text-fg-soft"
          >
            Limpar filtros ({active})
          </button>
        </>
      )}
    </div>
  );
}

/*
 * Menu de visualização de Clientes — fiel ao export "Menu de Visualização"
 * (painel de 300px: Filtros, seletor Lista/Grade, Organização, Opções da lista
 * e os chips de colunas).
 *
 * A seção "Filtros" do desenho é um atalho de status: o menu de Filtros da
 * barra continua sendo o lugar de cruzar dimensões (segmento, responsável,
 * serviço), e aqui se escolhe um degrau da régua de saúde de uma vez. Com mais
 * de um status marcado lá, a pílula mostra a contagem em vez de fingir que só
 * há um.
 */
export function ClientDisplayMenu({
  display,
  onChange,
  filters,
  onFiltersChange,
}: {
  display: ClientDisplay;
  onChange: (next: ClientDisplay) => void;
  filters: ClientFilters;
  onFiltersChange: (next: ClientFilters) => void;
}) {
  const set = <K extends keyof ClientDisplay>(key: K, value: ClientDisplay[K]) =>
    onChange({ ...display, [key]: value });

  const statusValue = filters.status.length === 1 ? filters.status[0] : "todos";
  const statusOptions = [
    {
      id: "todos",
      label:
        filters.status.length > 1 ? `${filters.status.length} status` : "Todos",
    },
    ...CLIENT_STATUSES.map((s) => ({ id: s.id, label: s.label })),
  ];

  return (
    <MenuPanel>
      <MenuTitle first>Filtros</MenuTitle>

      <MenuRow label="Status">
        <ArrowUpDownIcon size={14} className="text-muted" />
        <MenuDropdown
          label="Filtrar por status"
          value={statusValue}
          options={statusOptions}
          onSelect={(v) =>
            onFiltersChange({
              ...filters,
              status: v === "todos" ? [] : [v as ClientStatus],
            })
          }
        />
      </MenuRow>

      <MenuSegmented>
        <MenuSegButton
          active={display.view === "lista"}
          onClick={() => set("view", "lista")}
          icon={<ListIcon size={14} />}
          label="Lista"
        />
        <MenuSegButton
          active={display.view === "grade"}
          onClick={() => set("view", "grade")}
          icon={<LayoutGridIcon size={14} />}
          label="Grade"
        />
      </MenuSegmented>

      <MenuDivider />

      <MenuTitle>Organização</MenuTitle>

      <MenuRow label="Agrupamento">
        <ArrowUpDownIcon size={14} className="text-muted" />
        <MenuDropdown
          label="Agrupamento"
          value={display.group}
          options={CLIENT_GROUP_OPTIONS}
          onSelect={(v) => set("group", v as ClientGroupKey)}
        />
      </MenuRow>

      <MenuRow label="Ordenação">
        <ArrowDownWideNarrowIcon size={14} className="text-muted" />
        <MenuDropdown
          label="Ordenação"
          value={display.sort}
          options={CLIENT_SORT_OPTIONS}
          onSelect={(v) => set("sort", v as ClientSortKey)}
        />
      </MenuRow>

      <MenuDivider />

      <MenuTitle>Opções da lista</MenuTitle>

      <MenuRow label="Mostrar arquivados">
        <MenuToggle
          on={display.showArchived}
          onClick={() => set("showArchived", !display.showArchived)}
          label="Mostrar arquivados"
        />
      </MenuRow>

      <MenuRow label="Mostrar grupos vazios">
        <MenuToggle
          on={display.showEmptyGroups}
          onClick={() => set("showEmptyGroups", !display.showEmptyGroups)}
          label="Mostrar grupos vazios"
        />
      </MenuRow>

      <MenuDivider />

      <MenuTitle>Colunas</MenuTitle>

      <div className="flex flex-wrap gap-2 px-3 pb-0.5 pt-1.5">
        {CLIENT_COLUMN_OPTIONS.map((c) => (
          <MenuChip
            key={c.id}
            label={c.label}
            on={display.columns.includes(c.id)}
            onClick={() =>
              set("columns", toggleClientColumn(display.columns, c.id))
            }
          />
        ))}
      </div>
    </MenuPanel>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-label">
        {title}
      </p>
      {children}
    </section>
  );
}

function Option({
  label,
  checked,
  onClick,
  dot,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-mark px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-border",
        checked ? "text-fg-soft" : "text-fg-3",
      )}
    >
      {dot && (
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
        />
      )}
      <span className="flex-1 truncate">{label}</span>
      <CheckIcon
        size={14}
        className={cn("text-muted", checked ? "opacity-100" : "opacity-0")}
      />
    </button>
  );
}
