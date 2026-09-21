"use client";

import type { Client } from "@/lib/clients/types";
import { CLIENT_STATUSES } from "@/lib/clients/constants";
import {
  CLIENT_SORT_OPTIONS,
  distinctServices,
  distinctValues,
  type ClientDisplay,
  type ClientFilters,
} from "@/lib/clients/view";
import { CheckIcon, LayoutGridIcon, ListIcon } from "@/components/icons";
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

export function ClientDisplayMenu({
  display,
  onChange,
}: {
  display: ClientDisplay;
  onChange: (next: ClientDisplay) => void;
}) {
  return (
    <div className={panel}>
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.6px] text-label">
        Visualização
      </p>
      <div className="flex gap-1.5 p-1">
        <ViewButton
          icon={<ListIcon size={15} />}
          label="Lista"
          active={display.view === "lista"}
          onClick={() => onChange({ ...display, view: "lista" })}
        />
        <ViewButton
          icon={<LayoutGridIcon size={15} />}
          label="Grade"
          active={display.view === "grade"}
          onClick={() => onChange({ ...display, view: "grade" })}
        />
      </div>

      <div className="my-1 h-px bg-border" />

      <Group title="Ordenar por">
        {CLIENT_SORT_OPTIONS.map((o) => (
          <Option
            key={o.id}
            label={o.label}
            checked={display.sort === o.id}
            onClick={() => onChange({ ...display, sort: o.id })}
          />
        ))}
      </Group>
    </div>
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

function ViewButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "tap flex flex-1 items-center justify-center gap-2 rounded-mark px-3 py-2 text-[13px] transition-colors",
        active
          ? "bg-border-strong text-fg"
          : "bg-surface text-fg-3 hover:bg-border",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
