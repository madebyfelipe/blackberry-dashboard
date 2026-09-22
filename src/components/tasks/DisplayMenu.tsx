"use client";

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

/*
 * Menu de visualização — fiel ao export "Menu de Filtros" (painel de 300px:
 * seletor Lista/Quadro, agrupamento, ordenação, opções da lista e chips de
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
    <MenuPanel>
      {/* Seletor Lista/Quadro */}
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
          // O export v3 chama esta visão de "Quadro" — o id interno segue
          // "grade" (é o que `lib/tasks/view.ts` grava), só o rótulo muda.
          label="Quadro"
        />
      </MenuSegmented>

      <MenuRow label="Agrupamento">
        <ArrowUpDownIcon size={14} className="text-muted" />
        <MenuDropdown
          label="Agrupamento"
          value={display.group}
          options={GROUP_OPTIONS}
          onSelect={(v) => set("group", v as GroupKey)}
        />
      </MenuRow>

      <MenuRow label="Sub-agrupamento">
        <MenuDropdown
          label="Sub-agrupamento"
          value={display.subgroup}
          options={GROUP_OPTIONS}
          onSelect={(v) => set("subgroup", v as GroupKey)}
        />
      </MenuRow>

      <MenuRow label="Ordenação">
        <ArrowDownWideNarrowIcon size={14} className="text-muted" />
        <MenuDropdown
          label="Ordenação"
          value={display.sort}
          options={SORT_OPTIONS}
          onSelect={(v) => set("sort", v as SortKey)}
        />
      </MenuRow>

      <MenuRow label="Ordenar em dia por recência">
        <MenuToggle
          on={display.recencyTiebreak}
          onClick={() => set("recencyTiebreak", !display.recencyTiebreak)}
          label="Ordenar em dia por recência"
        />
      </MenuRow>

      <MenuDivider />

      <MenuRow label="Mostrar arquivadas">
        <MenuToggle
          on={display.showArchived}
          onClick={() => set("showArchived", !display.showArchived)}
          label="Mostrar arquivadas"
        />
      </MenuRow>

      <MenuDivider />

      <MenuTitle>Opções da lista</MenuTitle>

      <MenuRow label="Tarefas por grupo">
        <MenuDropdown
          label="Tarefas por grupo"
          value={String(display.perGroup)}
          options={PER_GROUP_OPTIONS.map((o) => ({
            id: String(o.id),
            label: o.label,
          }))}
          onSelect={(v) => set("perGroup", v === "todas" ? "todas" : Number(v))}
        />
      </MenuRow>

      <MenuRow label="Mostrar grupos vazios">
        <MenuToggle
          on={display.showEmptyGroups}
          onClick={() => set("showEmptyGroups", !display.showEmptyGroups)}
          label="Mostrar grupos vazios"
        />
      </MenuRow>

      <div className="px-3 pb-0.5 pt-2">
        <p className="text-[12px] text-muted">Propriedades visíveis</p>
      </div>

      <div className="flex flex-wrap gap-2 px-3 pb-0.5 pt-1.5">
        {COLUMN_OPTIONS.map((c) => (
          <MenuChip
            key={c.id}
            label={c.label}
            on={display.columns.includes(c.id)}
            onClick={() => set("columns", toggleIn<ColumnKey>(display.columns, c.id))}
          />
        ))}
      </div>
    </MenuPanel>
  );
}
