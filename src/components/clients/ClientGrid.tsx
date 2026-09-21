"use client";

import type { Client } from "@/lib/clients/types";
import {
  CLIENT_STATUS_BY_ID,
  billingLabel,
  servicesLabel,
} from "@/lib/clients/constants";
import { Badge } from "@/components/ui/Badge";
import { CardField, CardRow, EntityCard } from "@/components/ui/EntityCard";
import { PersonChip } from "@/components/ui/Mark";
import { ActionMenu } from "@/components/tasks/ActionMenu";
import { PencilIcon, TrashIcon } from "@/components/icons";

/*
 * Clientes · Grade (export "Clientes · Painel (Grade)"): quatro cards por
 * linha, 16px de espaço e 16px de respiro em volta.
 *
 * O card é o `ui/EntityCard` — o mesmo do Quadro de tarefas — com SERVIÇOS
 * como bloco e FATURAMENTO como linha.
 */
export function ClientGrid({
  clients,
  onOpen,
  onDelete,
}: {
  clients: Client[];
  onOpen: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  return (
    <div className="h-full min-h-0 overflow-y-auto p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {clients.map((c, i) => {
          const status = CLIENT_STATUS_BY_ID[c.status];
          return (
            <EntityCard
              key={c.id}
              index={i}
              name={c.name}
              sub={c.segment}
              onClick={() => onOpen(c)}
              badge={
                <Badge
                  label={status.label}
                  bg={status.badgeBg}
                  fg={status.badgeFg}
                />
              }
              footer={
                <>
                  <PersonChip name={c.owner} size={24} />
                  <div
                    className="flex h-6 w-7 shrink-0 items-center justify-center opacity-60 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ActionMenu
                      items={[
                        {
                          label: "Editar",
                          icon: <PencilIcon size={15} />,
                          onSelect: () => onOpen(c),
                        },
                        {
                          label: "Excluir",
                          icon: <TrashIcon size={15} />,
                          danger: true,
                          onSelect: () => onDelete(c),
                        },
                      ]}
                    />
                  </div>
                </>
              }
            >
              <CardField label="Serviços">
                {servicesLabel(c.services, 3)}
              </CardField>
              <CardRow label="Faturamento">{billingLabel(c.billingDay)}</CardRow>
            </EntityCard>
          );
        })}
      </div>
    </div>
  );
}
