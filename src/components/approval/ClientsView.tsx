"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientSummary } from "@/lib/approval/clients";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Screen, ScreenAction, ScreenHeader } from "@/components/ui/Screen";
import { TabStrip } from "@/components/ui/Tabs";
import { Toolbar, ToolbarSearch } from "@/components/ui/Toolbar";
import { EntityCard } from "@/components/ui/EntityCard";
import { Badge } from "@/components/ui/Badge";
import { ChevronRightIcon } from "@/components/icons";

/**
 * Clientes — primeiro passo do Social media, export "Clínica Aurora -
 * Clientes", redesenhado no vocabulário v3 (painel, abas, barra de
 * ferramentas e o card de 14px das outras telas).
 *
 * O fluxo é cliente › lote › peças: aqui se escolhe de quem são os lotes. O
 * cliente ainda não é entidade (sai do texto de `batch.client`, ver
 * `lib/approval/clients.ts`), então esta tela é o seletor do fluxo de
 * aprovação — não a ficha do cliente da Fase 3.
 */
export function ClientsView({ clients }: { clients: ClientSummary[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"todos" | "pendentes">("todos");

  const pendentes = clients.filter((c) => c.pendentes > 0).length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => tab === "todos" || c.pendentes > 0)
      .filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [clients, search, tab]);

  return (
    <Screen gap="md">
      <Breadcrumb
        items={[
          { label: "black berry", href: "/tarefas" },
          { label: "Social media" },
        ]}
      />

      <ScreenHeader
        actions={
          // Cliente se cadastra num lugar só: a lista de Clientes.
          <ScreenAction onClick={() => router.push("/clientes?novo=1")}>Novo cliente</ScreenAction>
        }
      >
        <TabStrip
          tabs={[
            { id: "todos", label: "Todos", count: clients.length },
            { id: "pendentes", label: "Com pendentes", count: pendentes },
          ]}
          active={tab}
          onSelect={(id) => setTab(id as "todos" | "pendentes")}
        />
      </ScreenHeader>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
        <Toolbar>
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Buscar cliente" />
        </Toolbar>

        <div className="min-h-0 flex-1 overflow-y-auto pt-4">
          {filtered.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-muted">
              {clients.length === 0
                ? "Nenhum cliente ainda — cadastre o primeiro em Clientes."
                : tab === "pendentes" && !search
                  ? "Nenhum cliente com peça esperando aprovação."
                  : "Nenhum cliente com esse nome."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((client, i) => (
                <EntityCard
                  key={client.slug}
                  index={i}
                  name={client.name}
                  sub={client.lotes === 0 ? "Sem lote ainda" : `${client.lotes} ${client.lotes === 1 ? "lote" : "lotes"}`}
                  onClick={() => router.push(`/social/${client.slug}`)}
                  badge={
                    client.pendentes > 0 ? <Badge label="Pendente" size="sm" /> : undefined
                  }
                  footer={
                    <>
                      <span className="flex items-end gap-4">
                        <Stat value={client.pecas} label={client.pecas === 1 ? "Peça" : "Peças"} />
                        <Stat value={client.pendentes} label="Pendentes" />
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-fg-3 transition-colors group-hover:text-fg-soft">
                        Ver lotes
                        <ChevronRightIcon size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[15px] font-semibold text-fg-soft">{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </span>
  );
}
