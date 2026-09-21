"use client";

import type { Client } from "@/lib/clients/types";
import {
  CLIENT_STATUS_BY_ID,
  billingLabel,
  servicesLabel,
} from "@/lib/clients/constants";
import { Badge } from "@/components/ui/Badge";
import {
  Checkbox,
  TableBody,
  TableFrame,
  TableHead,
  TableRow,
} from "@/components/ui/DataTable";
import { EntityMark, PersonChip } from "@/components/ui/Mark";
import { FieldLabel } from "@/components/ui/Screen";
import { ChevronDownIcon } from "@/components/icons";

/*
 * Clientes · Lista (export "Clientes · Painel (Lista)").
 *
 * Mesma tabela das Tarefas — mesma altura de linha, mesmas réguas, mesma
 * caixa de seleção — com as colunas do desenho: CLIENTE (cresce), SEGMENTO
 * 150, SERVIÇOS 180, RESPONSÁVEL 150, FATURAMENTO 110 e STATUS 130.
 */
export function ClientTable({
  clients,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
  someSelected,
  onOpen,
}: {
  clients: Client[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (next: boolean) => void;
  allSelected: boolean;
  someSelected: boolean;
  onOpen: (c: Client) => void;
}) {
  return (
    /* 32 (respiro) + 18 (seleção) + 16 + 240 (CLIENTE) + 150+180+150+110+130
       das colunas do export + 16px antes de cada uma. */
    <TableFrame minWidth={1066}>
      <TableHead>
        <Checkbox
          label="Selecionar todos os clientes"
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          onChange={onToggleAll}
        />
        <div className="flex min-w-0 flex-1 items-center gap-[5px]">
          <FieldLabel>Cliente</FieldLabel>
          <ChevronDownIcon size={13} className="text-label" />
        </div>
        <div className="w-[150px] shrink-0">
          <FieldLabel>Segmento</FieldLabel>
        </div>
        <div className="w-[180px] shrink-0">
          <FieldLabel>Serviços</FieldLabel>
        </div>
        <div className="w-[150px] shrink-0">
          <FieldLabel>Responsável</FieldLabel>
        </div>
        <div className="w-[110px] shrink-0">
          <FieldLabel>Faturamento</FieldLabel>
        </div>
        <div className="w-[130px] shrink-0">
          <FieldLabel>Status</FieldLabel>
        </div>
      </TableHead>

      <TableBody>
        {clients.map((c, i) => {
          const status = CLIENT_STATUS_BY_ID[c.status];
          return (
            <TableRow
              key={c.id}
              index={i}
              selected={selected.has(c.id)}
              onClick={() => onOpen(c)}
            >
              <Checkbox
                label={`Selecionar ${c.name}`}
                checked={selected.has(c.id)}
                onChange={() => onToggle(c.id)}
              />

              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <EntityMark name={c.name} />
                <span className="truncate text-[13px] font-medium text-fg">
                  {c.name}
                </span>
              </div>

              <span className="w-[150px] shrink-0 truncate text-[13px] text-muted">
                {c.segment || "—"}
              </span>
              <span className="w-[180px] shrink-0 truncate text-[13px] text-muted">
                {servicesLabel(c.services)}
              </span>
              <div className="w-[150px] shrink-0">
                <PersonChip name={c.owner} />
              </div>
              <span className="w-[110px] shrink-0 truncate text-[13px] text-muted">
                {billingLabel(c.billingDay)}
              </span>
              <div className="w-[130px] shrink-0">
                <Badge
                  label={status.label}
                  bg={status.badgeBg}
                  fg={status.badgeFg}
                  size="md"
                />
              </div>
            </TableRow>
          );
        })}
      </TableBody>
    </TableFrame>
  );
}
