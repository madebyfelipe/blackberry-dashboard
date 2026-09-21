"use client";

import { useEffect, useRef, useState } from "react";
import type { Client, ClientStatus } from "@/lib/clients/types";
import { CLIENT_STATUSES, CLIENT_STATUS_BY_ID } from "@/lib/clients/constants";
import { Spinner } from "@/components/ui/Spinner";
import {
  BoxIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  TagIcon,
  UserCircleIcon,
  XIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

/*
 * Criação e edição de cliente.
 *
 * É deliberadamente a mesma tela de criação da tarefa (`tasks/TaskModal`):
 * mesma trilha no topo, mesmo título grande como primeiro campo, mesma tira
 * de chips que viram campo ao clicar, mesmo rodapé. O pedido foi "seguir o
 * padrão de criação que já existe, sem inventar lógica nova" — e esse padrão
 * é este. Uma página de criação inteira seria uma tela nova, e tela nova sai
 * do desenho do Felipe (ver `FLUXO.md`), não daqui.
 */

export type ClientModalValues = {
  name: string;
  segment: string;
  services: string[];
  owner: string;
  billingDay: number | null;
  status: ClientStatus;
};

export type ClientModalState =
  | { mode: "create" }
  | { mode: "edit"; client: Client };

export function ClientModal({
  state,
  onClose,
  onSubmit,
  saving,
}: {
  state: ClientModalState | null;
  onClose: () => void;
  onSubmit: (values: ClientModalValues) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [owner, setOwner] = useState("");
  const [billingDay, setBillingDay] = useState<number | null>(null);
  const [status, setStatus] = useState<ClientStatus>("novo");

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      const c = state.client;
      setName(c.name);
      setSegment(c.segment);
      setServices(c.services);
      setOwner(c.owner === "—" ? "" : c.owner);
      setBillingDay(c.billingDay);
      setStatus(c.status);
    } else {
      setName("");
      setSegment("");
      setServices([]);
      setOwner("");
      setBillingDay(null);
      setStatus("novo");
    }
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;
  const isEdit = state.mode === "edit";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name, segment, services, owner, billingDay, status });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-black/80 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Editar cliente" : "Novo cliente"}
        className="relative flex max-h-[90vh] w-full max-w-[660px] animate-scale-in flex-col overflow-hidden rounded-card border border-border bg-surface shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-mark bg-dim text-[11px] font-bold text-fg">
              b
            </span>
            <span className="text-[14px] text-dim">black berry</span>
            <ChevronRightIcon size={16} className="text-dim" />
            <span className="text-[14px] font-semibold text-fg-soft">
              {isEdit ? "Editar cliente" : "Novo cliente"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            title="Fechar"
            onClick={onClose}
            className="tap flex items-center justify-center rounded-full p-2.5 text-muted transition-colors hover:bg-border hover:text-fg-soft"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do cliente"
            className="w-full bg-transparent text-[20px] font-semibold text-fg placeholder:text-muted focus:outline-none"
          />
          <p className="text-[13px] text-muted">
            O briefing do cliente ganha tela própria — aqui entra só a ficha da
            carteira.
          </p>
        </div>

        {/* Tira de campos */}
        <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
          <StatusChip status={status} onSelect={setStatus} />

          <ChipField
            icon={<BoxIcon size={14} />}
            placeholder="Segmento"
            value={segment}
            onChange={setSegment}
          />

          <ServicesChip services={services} onChange={setServices} />

          <ChipField
            icon={<UserCircleIcon size={14} />}
            placeholder="Responsável"
            value={owner}
            onChange={setOwner}
          />

          <BillingChip value={billingDay} onChange={setBillingDay} />
        </div>

        <div className="h-px w-full bg-border" />

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="tap rounded-field bg-primary px-4 py-2.5 text-[14px] font-medium text-on-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner /> Salvando…
              </span>
            ) : isEdit ? (
              "Salvar"
            ) : (
              "Criar cliente"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

const chipBase =
  "tap flex items-center gap-1.5 rounded-pill px-4 py-2 text-[13px] inset-ring-1 transition-colors";

function StatusChip({
  status,
  onSelect,
}: {
  status: ClientStatus;
  onSelect: (s: ClientStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = CLIENT_STATUS_BY_ID[status];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(chipBase, "text-fg-soft inset-ring-border-strong")}
      >
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: meta.badgeFg }}
        />
        {meta.label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[190px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
        >
          {CLIENT_STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitemradio"
              aria-checked={s.id === status}
              onClick={() => {
                onSelect(s.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-mark px-2.5 py-1.5 text-left text-[13px] text-fg-soft transition-colors hover:bg-surface-2"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ backgroundColor: s.badgeFg }}
                />
                {s.label}
              </span>
              <CheckIcon
                size={14}
                className={cn(status === s.id ? "opacity-100" : "opacity-0")}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Serviços: digita, Enter adiciona; Backspace no vazio remove o último. */
function ServicesChip({
  services,
  onChange,
}: {
  services: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (value && !services.includes(value)) onChange([...services, value].slice(0, 8));
    setDraft("");
  }

  if (open) {
    return (
      <span className="flex flex-wrap items-center gap-1.5 rounded-pill px-4 py-2 inset-ring-1 inset-ring-border-strong">
        <span className="text-muted">
          <TagIcon size={14} />
        </span>
        {services.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(services.filter((x) => x !== s))}
            title={`Remover ${s}`}
            className="animate-scale-in rounded-pill bg-border px-2 py-0.5 text-[11px] text-fg-soft transition-colors hover:bg-border-strong"
          >
            {s} ×
          </button>
        ))}
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            add();
            setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && services.length) {
              onChange(services.slice(0, -1));
            } else if (e.key === "Escape") {
              setDraft("");
              setOpen(false);
            }
          }}
          placeholder="serviço"
          className="w-20 bg-transparent text-[13px] text-fg-soft placeholder:text-muted focus:outline-none"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        chipBase,
        services.length
          ? "text-fg-soft inset-ring-border-strong"
          : "text-fg-3 inset-ring-border hover:bg-border",
      )}
    >
      <span className="text-muted">
        <TagIcon size={14} />
      </span>
      {services.length ? services.join(", ") : "Serviços"}
    </button>
  );
}

/** Dia do faturamento — 1 a 31, o que a coluna FATURAMENTO mostra. */
function BillingChip({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);

  function commit() {
    const n = Number(draft);
    onChange(draft.trim() && Number.isInteger(n) && n >= 1 && n <= 31 ? n : null);
    setOpen(false);
  }

  if (open) {
    return (
      <span className="flex items-center gap-1.5 rounded-pill px-4 py-2 inset-ring-1 inset-ring-border-strong">
        <span className="text-muted">
          <CalendarIcon size={14} />
        </span>
        <span className="text-[13px] text-muted">Dia</span>
        <input
          autoFocus
          type="number"
          min={1}
          max={31}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft(value === null ? "" : String(value));
              setOpen(false);
            }
          }}
          className="w-12 bg-transparent text-[13px] text-fg-soft focus:outline-none"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        chipBase,
        value === null
          ? "text-fg-3 inset-ring-border hover:bg-border"
          : "text-fg-soft inset-ring-border-strong",
      )}
    >
      <span className="text-muted">
        <CalendarIcon size={14} />
      </span>
      {value === null ? "Faturamento" : `Dia ${String(value).padStart(2, "0")}`}
    </button>
  );
}

/** Chip que vira um campo de texto curto ao clicar. */
function ChipField({
  icon,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  function commit() {
    onChange(draft.trim());
    setOpen(false);
  }

  if (open) {
    return (
      <span className="flex items-center gap-1.5 rounded-pill px-4 py-2 inset-ring-1 inset-ring-border-strong">
        <span className="text-muted">{icon}</span>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft(value);
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="w-28 bg-transparent text-[13px] text-fg-soft placeholder:text-muted focus:outline-none"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        chipBase,
        value ? "text-fg-soft inset-ring-border" : "text-fg-3 inset-ring-border",
        "hover:bg-border",
      )}
    >
      <span className="text-muted">{icon}</span>
      {value || placeholder}
    </button>
  );
}
