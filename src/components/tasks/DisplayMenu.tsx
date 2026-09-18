"use client";

import { useState } from "react";
import {
  COLUMN_OPTIONS,
  GROUP_OPTIONS,
  PER_GROUP_OPTIONS,
  SORT_OPTIONS,
  toggleIn,
  type ColumnKey,
  type Display,
  type GroupKey,
  type SortKey,
} from "@/lib/tasks/view";
import {
  ArrowDownWideNarrowIcon,
  ArrowUpDownIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  ListIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

/*
 * Menu de visualização — fiel ao export "Menu de Filtros" (painel de 300px:
 * seletor Lista/Grade, agrupamento, ordenação, opções da lista e chips de
 * propriedades visíveis).
 */

export function DisplayMenu({
  display,
  onChange,
}: {
  display: Display;
  onChange: (next: Display) => void;
}) {
  const set = <K extends keyof Display>(key: K, value: Display[K]) =>
    onChange({ ...display, [key]: value });

  return (
    <div className="w-[300px] animate-pop-in overflow-hidden rounded-panel border border-border bg-surface pb-3 pt-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
      {/* Seletor Lista/Grade */}
      <div className="px-3 pb-2.5 pt-0.5">
        <div className="flex gap-1 rounded-pill bg-surface-2 p-1">
          <SegButton
            active={display.view === "lista"}
            onClick={() => set("view", "lista")}
            icon={<ListIcon size={14} />}
            label="Lista"
          />
          <SegButton
            active={display.view === "grade"}
            onClick={() => set("view", "grade")}
            icon={<LayoutGridIcon size={14} />}
            label="Grade"
          />
        </div>
      </div>

      <Row label="Agrupamento">
        <ArrowUpDownIcon size={14} className="text-muted" />
        <Dropdown
          value={display.group}
          options={GROUP_OPTIONS}
          onSelect={(v) => set("group", v as GroupKey)}
        />
      </Row>

      <Row label="Sub-agrupamento">
        <Dropdown
          value={display.subgroup}
          options={GROUP_OPTIONS}
          onSelect={(v) => set("subgroup", v as GroupKey)}
        />
      </Row>

      <Row label="Ordenação">
        <ArrowDownWideNarrowIcon size={14} className="text-muted" />
        <Dropdown
          value={display.sort}
          options={SORT_OPTIONS}
          onSelect={(v) => set("sort", v as SortKey)}
        />
      </Row>

      <Row label="Ordenar em dia por recência">
        <Toggle
          on={display.recencyTiebreak}
          onClick={() => set("recencyTiebreak", !display.recencyTiebreak)}
          label="Ordenar em dia por recência"
        />
      </Row>

      <Divider />

      <Row label="Mostrar arquivadas">
        <Toggle
          on={display.showArchived}
          onClick={() => set("showArchived", !display.showArchived)}
          label="Mostrar arquivadas"
        />
      </Row>

      <Divider />

      <div className="px-3 pb-0.5 pt-2.5">
        <p className="text-[13px] font-semibold text-fg-soft">Opções da lista</p>
      </div>

      <Row label="Tarefas por grupo">
        <Dropdown
          value={String(display.perGroup)}
          options={PER_GROUP_OPTIONS.map((o) => ({
            id: String(o.id),
            label: o.label,
          }))}
          onSelect={(v) => set("perGroup", v === "todas" ? "todas" : Number(v))}
        />
      </Row>

      <Row label="Mostrar grupos vazios">
        <Toggle
          on={display.showEmptyGroups}
          onClick={() => set("showEmptyGroups", !display.showEmptyGroups)}
          label="Mostrar grupos vazios"
        />
      </Row>

      <div className="px-3 pb-0.5 pt-2">
        <p className="text-[12px] text-muted">Propriedades visíveis</p>
      </div>

      <div className="flex flex-wrap gap-2 px-3 pb-0.5 pt-1.5">
        {COLUMN_OPTIONS.map((c) => {
          const on = display.columns.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => set("columns", toggleIn<ColumnKey>(display.columns, c.id))}
              className={cn(
                "rounded-pill px-3 py-1.5 text-[12px] transition-colors",
                on
                  ? "bg-border font-medium text-fg-soft"
                  : "border border-border text-muted hover:text-fg-soft",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SegButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-pill px-2 py-1.5 text-[13px] transition-colors",
        active ? "bg-border font-medium text-fg-soft" : "text-muted hover:text-fg-soft",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-[7px]">
      <span className="text-[13px] text-fg-3">{label}</span>
      <span className="flex shrink-0 items-center gap-2.5">{children}</span>
    </div>
  );
}

function Dropdown({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: { id: string | number; label: string }[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => String(o.id) === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-mark bg-border px-2.5 py-[5px] text-[13px] text-fg-soft transition-colors hover:bg-border-strong"
      >
        {current?.label ?? value}
        <ChevronDownIcon size={12} className="text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-[180px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onSelect(String(o.id));
                  setOpen(false);
                }}
                className={cn(
                  "block w-full rounded-mark px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2",
                  String(o.id) === value ? "text-fg-soft" : "text-fg-3",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-4 w-7 items-center rounded-pill p-0.5 transition-colors",
        on ? "justify-end bg-primary" : "justify-start border border-border-strong bg-border",
      )}
    >
      <span
        className={cn(
          "h-3 w-3 rounded-full transition-colors",
          on ? "bg-surface" : "bg-muted",
        )}
      />
    </button>
  );
}

function Divider() {
  return (
    <div className="py-1.5">
      <div className="h-px bg-border" />
    </div>
  );
}
