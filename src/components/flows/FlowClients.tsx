"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PlusIcon, SearchIcon, XIcon } from "@/components/icons";
import { initialsOf } from "@/lib/inbox/view";
import type { Flow } from "@/lib/flows/types";

/*
 * Os clientes do fluxo: quem está aqui tem as tarefas novas entrando neste
 * fluxo sozinhas — o criativo do lote e também a tarefa criada na mão para
 * o cliente (ver `enterClientFlow` em `lib/flows/automation.ts`).
 *
 * É o mesmo campo "Fluxo" da ficha do cliente (`Client.flowId`), visto do
 * lado do fluxo: atribuir aqui troca lá, e um cliente fica em um fluxo só —
 * escolher um cliente que estava em outro fluxo o traz para este.
 */

export type FlowClient = { id: string; name: string; flowId: string | null };

export function FlowClients({
  flow,
  flows,
  clients,
  onAssign,
}: {
  flow: Flow;
  flows: Flow[];
  clients: FlowClient[];
  /** `null` tira o cliente do fluxo. */
  onAssign: (clientId: string, flowId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mine = clients.filter((c) => c.flowId === flow.id);
  const flowName = (id: string | null) => flows.find((f) => f.id === id)?.name;

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => c.flowId !== flow.id && (!q || c.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [clients, flow.id, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-label">CLIENTES DO FLUXO</span>
          <span className="rounded-pill bg-row-raised px-[7px] py-0.5 text-[10px] font-semibold text-muted">
            {mine.length}
          </span>
        </div>
        <p className="text-[11px] text-muted">
          {flow.status === "ativo"
            ? "Tarefas novas destes clientes já entram neste fluxo, na etapa de início."
            : "O fluxo está desligado: ligue-o para as tarefas destes clientes entrarem nele."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {mine.map((c) => (
          <span
            key={c.id}
            className="flex items-center gap-1.5 rounded-pill bg-surface py-1 pl-1 pr-1.5 text-[12px] text-fg-soft"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-border text-[9px] font-semibold text-fg-3">
              {initialsOf(c.name)}
            </span>
            {c.name}
            <button
              type="button"
              onClick={() => onAssign(c.id, null)}
              aria-label={`Tirar ${c.name} do fluxo`}
              title="Tirar do fluxo"
              className="tap flex h-4 w-4 items-center justify-center rounded-pill text-muted transition-colors hover:bg-border hover:text-fg-soft"
            >
              <XIcon size={11} />
            </button>
          </span>
        ))}

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              "tap flex items-center gap-1.5 rounded-pill border border-dashed border-border px-2.5 py-1 text-[12px] font-medium transition-colors",
              open ? "bg-flow-btn text-fg-soft" : "text-muted hover:bg-flow-btn hover:text-fg-soft",
            )}
          >
            <PlusIcon size={12} />
            Atribuir cliente
          </button>

          {open && (
            <div className="absolute left-0 top-[calc(100%+6px)] z-50 flex w-[280px] animate-pop-in flex-col overflow-hidden rounded-menu border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <label className="flex h-8 items-center gap-2 rounded-mark bg-flow-well px-2.5">
                <SearchIcon size={13} className="text-label" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar cliente"
                  aria-label="Buscar cliente"
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-fg-soft placeholder:text-label focus:outline-none"
                />
              </label>
              <ul role="listbox" className="mt-1 max-h-[240px] overflow-y-auto">
                {options.length === 0 && (
                  <li className="px-2.5 py-2 text-[12px] text-muted">
                    {clients.length === 0
                      ? "Nenhum cliente cadastrado ainda."
                      : query
                        ? "Nenhum cliente com esse nome."
                        : "Todos os clientes já estão neste fluxo."}
                  </li>
                )}
                {options.map((c) => {
                  const other = c.flowId ? flowName(c.flowId) : undefined;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => {
                          onAssign(c.id, flow.id);
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-2 rounded-mark px-2.5 py-[7px] text-left text-[12px] transition-colors hover:bg-row-raised"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-border text-[9px] font-semibold text-fg-3">
                          {initialsOf(c.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-fg-soft">{c.name}</span>
                        {other && <span className="shrink-0 truncate text-[11px] text-muted">em {other}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
