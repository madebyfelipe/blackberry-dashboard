"use client";

import type { Client } from "@/lib/clients/types";
import {
  CLIENT_STATUS_BY_ID,
  billingLabel,
  servicesLabel,
} from "@/lib/clients/constants";
import type { ClientColumnKey, ClientGroup } from "@/lib/clients/view";
import { formatShortDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import {
  Cell,
  Checkbox,
  ColumnsProvider,
  HeadCell,
  TableBody,
  TableFrame,
  TableHead,
  TableRow,
} from "@/components/ui/DataTable";
import { useColumnWidths } from "@/components/ui/useColumnWidths";
import { tableMinWidth, type ColumnSpec } from "@/lib/ui/columns";
import { EntityMark, PersonChip } from "@/components/ui/Mark";
import { FieldLabel } from "@/components/ui/Screen";
import { ChevronDownIcon } from "@/components/icons";
import { ClientHoverCard } from "./ClientHoverCard";

/*
 * Clientes · Lista (export "Clientes · Painel (Lista)").
 *
 * Mesma tabela das Tarefas — mesma altura de linha, mesmas réguas, mesma
 * caixa de seleção — com as colunas do desenho: CLIENTE (cresce), SEGMENTO
 * 150, SERVIÇOS 180, RESPONSÁVEL 150, FATURAMENTO 110 e STATUS 130.
 *
 * As medidas acima são o ponto de partida, não mais o fim: a divisória do
 * cabeçalho arrasta e a largura fica guardada no navegador (ver
 * `lib/ui/columns.ts`). Quais colunas aparecem vem do menu "Visualização", e
 * passar o ponteiro sobre o nome abre o cartão da ficha.
 */

const CLIENTE: ColumnSpec = {
  id: "cliente",
  label: "Cliente",
  width: 240,
  flex: true,
};

const COLUMNS: Record<ClientColumnKey, ColumnSpec> = {
  segment: { id: "segmento", label: "Segmento", width: 150 },
  services: { id: "servicos", label: "Serviços", width: 180 },
  owner: { id: "responsavel", label: "Responsável", width: 150 },
  billing: { id: "faturamento", label: "Faturamento", width: 110 },
  status: { id: "status", label: "Status", width: 130 },
  createdAt: { id: "criado", label: "Criado em", width: 110 },
};

/** Ordem do export; "Criado em" entra depois, onde o menu o oferece. */
const ORDER: ClientColumnKey[] = [
  "segment",
  "services",
  "owner",
  "billing",
  "status",
  "createdAt",
];

const ALL_SPECS: ColumnSpec[] = [CLIENTE, ...ORDER.map((c) => COLUMNS[c])];

export function ClientTable({
  groups,
  columns,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
  someSelected,
  onOpen,
}: {
  groups: ClientGroup[];
  columns: ClientColumnKey[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (next: boolean) => void;
  allSelected: boolean;
  someSelected: boolean;
  onOpen: (c: Client) => void;
}) {
  const api = useColumnWidths("clientes.lista", ALL_SPECS);
  const shown = ORDER.filter((c) => columns.includes(c));
  /* 32 (respiro das pontas) + 18 (seleção) + 16 antes da célula CLIENTE. */
  const minWidth = tableMinWidth(
    [CLIENTE, ...shown.map((c) => COLUMNS[c])],
    api.widths,
    32 + 18,
  );
  const grouped = groups.length > 1 || groups[0]?.key !== "todos";

  return (
    <ColumnsProvider value={api}>
      <TableFrame minWidth={minWidth}>
        <TableHead>
          <Checkbox
            label="Selecionar todos os clientes"
            checked={allSelected}
            indeterminate={!allSelected && someSelected}
            onChange={onToggleAll}
          />
          <HeadCell spec={CLIENTE}>
            <FieldLabel>Cliente</FieldLabel>
            <ChevronDownIcon size={13} className="text-label" />
          </HeadCell>
          {shown.map((c) => (
            <HeadCell key={c} spec={COLUMNS[c]}>
              <FieldLabel>{COLUMNS[c].label}</FieldLabel>
            </HeadCell>
          ))}
        </TableHead>

        <TableBody>
          {groups.map((g) => (
            <section key={g.key}>
              {grouped && (
                <header className="flex items-center gap-2 border-b border-rule-soft bg-surface-2/40 px-4 py-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.6px] text-fg-3">
                    {g.label}
                  </h3>
                  <span className="rounded-pill bg-border px-2 py-0.5 text-[11px] font-semibold text-fg-soft">
                    {g.clients.length}
                  </span>
                </header>
              )}

              {g.clients.length === 0 ? (
                <p className="border-b border-rule-soft px-4 py-3 text-[13px] text-muted">
                  Nenhum cliente neste grupo.
                </p>
              ) : (
                g.clients.map((c, i) => (
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

                    <Cell spec={CLIENTE}>
                      <ClientHoverCard client={c}>
                        <EntityMark name={c.name} />
                        <span className="truncate text-[13px] font-medium text-fg">
                          {c.name}
                        </span>
                      </ClientHoverCard>
                    </Cell>

                    {shown.map((col) => (
                      <Cell key={col} spec={COLUMNS[col]}>
                        <ClientCell column={col} client={c} />
                      </Cell>
                    ))}
                  </TableRow>
                ))
              )}
            </section>
          ))}
        </TableBody>
      </TableFrame>
    </ColumnsProvider>
  );
}

function ClientCell({
  column,
  client,
}: {
  column: ClientColumnKey;
  client: Client;
}) {
  switch (column) {
    case "segment":
      return (
        <span className="truncate text-[13px] text-muted">
          {client.segment || "—"}
        </span>
      );
    case "services":
      return (
        <span className="truncate text-[13px] text-muted">
          {servicesLabel(client.services)}
        </span>
      );
    case "owner":
      return <PersonChip name={client.owner} />;
    case "billing":
      return (
        <span className="truncate text-[13px] text-muted">
          {billingLabel(client.billingDay)}
        </span>
      );
    case "status": {
      const status = CLIENT_STATUS_BY_ID[client.status];
      return (
        <Badge
          label={status.label}
          bg={status.badgeBg}
          fg={status.badgeFg}
          size="md"
        />
      );
    }
    case "createdAt":
      return (
        <span className="truncate text-[13px] text-muted">
          {formatShortDate(client.createdAt)}
        </span>
      );
    default:
      return null;
  }
}
