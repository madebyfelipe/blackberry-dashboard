"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ClientSummary } from "@/lib/approval/clients";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { RoundIconButton } from "./RoundIconButton";
import { useToast } from "@/components/ui/Toast";
import {
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  SlidersIcon,
} from "@/components/icons";

/**
 * Clientes — primeiro passo do Social media, export "Clínica Aurora -
 * Clientes".
 *
 * O fluxo é cliente › lote › peças: aqui se escolhe de quem são os lotes. O
 * cliente ainda não é entidade (sai do texto de `batch.client`, ver
 * `lib/approval/clients.ts`), então esta tela é o seletor do fluxo de
 * aprovação — não a ficha do cliente da Fase 3.
 */
export function ClientsView({ clients }: { clients: ClientSummary[] }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, search]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto px-1 py-5 md:py-6 md:pl-2 md:pr-6">
      {/* Header Row — trilha à esquerda, ações à direita */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "black berry", href: "/tarefas" },
            { label: "Social media" },
            { label: "Clientes" },
          ]}
        />

        <div className="flex items-center gap-2.5">
          {/* Busca — abre por cima, o botão não sai do lugar */}
          <div className="relative shrink-0">
            {showSearch && (
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => !search && setShowSearch(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearch("");
                    setShowSearch(false);
                  }
                }}
                placeholder="Buscar cliente…"
                className="absolute left-0 top-1/2 h-10 w-[240px] max-w-[calc(100vw-32px)] -translate-y-1/2 animate-fade-in rounded-pill border border-border bg-surface pl-4 pr-12 text-[13px] text-fg-soft placeholder:text-muted focus:border-border-strong focus:outline-none md:left-auto md:right-0"
              />
            )}
            <RoundIconButton
              label="Buscar cliente"
              onClick={() => setShowSearch((v) => !v)}
              active={showSearch || !!search}
            >
              <SearchIcon size={18} />
            </RoundIconButton>
          </div>

          {/*
           * Filtrar e organizar dependem de propriedades que o cliente ainda
           * não tem (segmento, contrato, responsável) — avisam em vez de
           * fingir que filtram, como os filtros sem recurso das Tarefas.
           */}
          <RoundIconButton
            label="Filtrar clientes"
            onClick={() => toast("Os filtros chegam com a ficha do cliente.", "info")}
          >
            <SlidersIcon size={18} />
          </RoundIconButton>
          <RoundIconButton
            label="Organizar clientes"
            onClick={() => toast("Organizar chega com a ficha do cliente.", "info")}
          >
            <Settings2Icon size={18} />
          </RoundIconButton>

          <RoundIconButton
            tone="primary"
            label="Novo cliente"
            onClick={() =>
              toast("Um cliente nasce junto com o primeiro lote dele.", "info")
            }
          >
            <PlusIcon size={18} />
          </RoundIconButton>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-card border border-border px-5 py-8 text-center text-[13px] text-muted">
          {clients.length === 0
            ? "Nenhum cliente ainda — o primeiro aparece aqui quando você criar um lote para ele."
            : "Nenhum cliente com esse nome."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client, i) => (
            <ClientCard key={client.slug} client={client} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({ client, index }: { client: ClientSummary; index: number }) {
  return (
    <Link
      href={`/social/${client.slug}`}
      style={{ ["--d" as string]: index }}
      className="stagger-item group flex flex-col gap-3.5 rounded-card border border-border p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
    >
      {/* Card Head */}
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-thumb border border-border bg-surface-2 text-[14px] font-semibold text-fg-soft transition-transform duration-200 group-hover:scale-105">
          {client.initials}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[14px] font-semibold text-fg-soft">
            {client.name}
          </span>
        </div>
        {/*
         * O selo do export marca um estado só ("Pendente"), então ele só
         * aparece quando há peça esperando o cliente — inventar o rótulo do
         * estado oposto seria inventar tela.
         */}
        {client.pendentes > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-pill bg-surface-2 px-2.5 py-1 inset-ring-1 inset-ring-border">
            <span className="h-[7px] w-[7px] rounded-full bg-fg-soft" />
            <span className="text-[11px] text-fg-soft">Pendente</span>
          </span>
        )}
      </div>

      <div className="h-px w-full bg-border" />

      {/* Card Foot */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-end gap-3">
          <Stat value={client.lotes} label={client.lotes === 1 ? "Lote" : "Lotes"} />
          <Stat value={client.pecas} label={client.pecas === 1 ? "Peça" : "Peças"} />
          <Stat value={client.pendentes} label="Pendentes" />
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-fg-soft">
          Ver lotes
          <ChevronRightIcon
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[16px] font-semibold text-fg-soft">{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </span>
  );
}
