"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/Spinner";
import {
  BoxIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  Clock3Icon,
  CreditCardIcon,
  MapPinIcon,
  PackageIcon,
  TagIcon,
  TrashIcon,
  UserCircleIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";
import {
  CONTRACT_CYCLES,
  EVENT_KINDS,
  PAYMENT_KINDS,
  SERVICE_KINDS,
  SERVICE_STATUSES,
} from "@/lib/crm/constants";
import { deliveredThisMonth, formatMoney, parseMoney } from "@/lib/crm/view";
import type {
  ClientEvent,
  ClientService,
  Contract,
  PaymentMethod,
  ServiceKind,
  ServiceStatus,
} from "@/lib/crm/types";
import type { ServiceInput } from "@/lib/crm/repository";
import { ServiceGlyph } from "./parts";

/*
 * Os formulários da ficha do cliente. Não há desenho deles no export — ele
 * mostra os botões ("Adicionar serviço", o lápis do cartão), não o que abre.
 * Então eles são o padrão de criação que o produto já tem (`ClientModal`,
 * `TaskModal`): trilha no topo, título grande como primeiro campo, tira de
 * chips que viram campo ao clicar, rodapé com a ação. Nenhuma tela nova —
 * quando o Felipe desenhar estes formulários, é aqui que trocam.
 */

export type TeamOption = { id: string; name: string };

/* ================================================================== casca */

function ModalShell({
  trail,
  onClose,
  onSubmit,
  saving,
  submitLabel,
  canSubmit = true,
  danger,
  children,
}: {
  trail: string[];
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitLabel: string;
  canSubmit?: boolean;
  danger?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/80 backdrop-blur-[2px]" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit && !saving) onSubmit();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={trail[trail.length - 1]}
        className="relative flex max-h-[90vh] w-full max-w-[660px] animate-scale-in flex-col overflow-hidden rounded-card border border-border bg-surface shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-mark bg-dim text-[11px] font-bold text-fg">
              b
            </span>
            {trail.map((t, i) => (
              <span key={i} className="flex min-w-0 items-center gap-2">
                {i > 0 && <ChevronRightIcon size={16} className="shrink-0 text-dim" />}
                <span
                  className={cn(
                    "truncate text-[14px]",
                    i === trail.length - 1 ? "font-semibold text-fg-soft" : "text-dim",
                  )}
                >
                  {t}
                </span>
              </span>
            ))}
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

        <div className="overflow-y-auto">{children}</div>

        <div className="h-px w-full bg-border" />
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          {danger ? (
            <button
              type="button"
              onClick={danger.onClick}
              className="tap flex items-center gap-1.5 rounded-field px-3 py-2 text-[13px] text-danger transition-colors hover:bg-border"
            >
              <TrashIcon size={14} />
              {danger.label}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="tap rounded-field bg-primary px-4 py-2.5 text-[14px] font-medium text-on-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner /> Salvando…
              </span>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

const chipBase =
  "tap flex items-center gap-1.5 rounded-pill px-4 py-2 text-[13px] inset-ring-1 transition-colors";

/**
 * Chip que vira campo ao clicar — texto, número, data, hora ou dinheiro.
 * `format` desenha o valor no chip; `parse` devolve `undefined` para recusar
 * (o chip volta ao valor anterior).
 */
function ChipInput<T>({
  icon,
  placeholder,
  value,
  onChange,
  format,
  parse,
  toDraft,
  type = "text",
  width = "w-28",
  prefix,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  parse: (raw: string) => T | undefined;
  toDraft: (v: T) => string;
  type?: "text" | "number" | "date" | "time";
  width?: string;
  prefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toDraft(value));

  function commit() {
    const next = parse(draft);
    if (next !== undefined) onChange(next);
    setOpen(false);
  }

  if (open) {
    return (
      <span className="flex items-center gap-1.5 rounded-pill px-4 py-2 inset-ring-1 inset-ring-border-strong">
        <span className="text-muted">{icon}</span>
        {prefix && <span className="text-[13px] text-muted">{prefix}</span>}
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              setDraft(toDraft(value));
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className={cn(width, "bg-transparent text-[13px] text-fg-soft placeholder:text-muted focus:outline-none [color-scheme:dark]")}
        />
      </span>
    );
  }

  const shown = format(value);
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(toDraft(value));
        setOpen(true);
      }}
      className={cn(chipBase, shown ? "text-fg-soft inset-ring-border-strong" : "text-fg-3 inset-ring-border", "hover:bg-border")}
    >
      <span className="text-muted">{icon}</span>
      {shown || placeholder}
    </button>
  );
}

const text = (v: string) => v;
const textParse = (raw: string) => raw.trim();

function ChipText(props: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; width?: string }) {
  return <ChipInput {...props} format={text} parse={textParse} toDraft={text} />;
}

function ChipSelect<T extends string>({
  icon,
  value,
  options,
  onChange,
  label,
}: {
  icon: React.ReactNode | ((v: T) => React.ReactNode);
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  const current = options.find((o) => o.id === value);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={cn(chipBase, "text-fg-soft inset-ring-border-strong hover:bg-border")}
      >
        <span className="text-muted">{typeof icon === "function" ? icon(value) : icon}</span>
        {current?.label ?? label}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-[260px] w-[220px] animate-pop-in overflow-y-auto rounded-menu border border-border bg-surface p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
        >
          {options.map((o) => (
            <button
              key={o.id || "nenhum"}
              type="button"
              role="option"
              aria-selected={o.id === value}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-mark px-2.5 py-1.5 text-left text-[13px] text-fg-soft transition-colors hover:bg-surface-2"
            >
              <span className="truncate">{o.label}</span>
              <CheckIcon size={14} className={o.id === value ? "text-fg-soft" : "invisible"} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipMoney({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder: string }) {
  return (
    <ChipInput
      icon={<WalletIcon size={14} />}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      format={(v) => (v > 0 ? `${formatMoney(v)}/mês` : "")}
      parse={(raw) => (raw.trim() === "" ? 0 : (parseMoney(raw) ?? undefined))}
      toDraft={(v) => (v > 0 ? (v / 100).toLocaleString("pt-BR") : "")}
      prefix="R$"
      width="w-24"
    />
  );
}

function ChipCount({
  icon,
  value,
  onChange,
  placeholder,
  format,
  max = 999,
}: {
  icon: React.ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
  format: (v: number) => string;
  max?: number;
}) {
  return (
    <ChipInput
      icon={icon}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      format={(v) => (v === null ? "" : format(v))}
      parse={(raw) => {
        if (raw.trim() === "") return null;
        const n = Number(raw);
        return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined;
      }}
      toDraft={(v) => (v === null ? "" : String(v))}
      type="number"
      width="w-16"
    />
  );
}

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[13px] leading-[19px] text-muted">{children}</p>
);

const TitleInput = (props: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <input
    autoFocus
    value={props.value}
    onChange={(e) => props.onChange(e.target.value)}
    placeholder={props.placeholder}
    maxLength={80}
    className="w-full bg-transparent text-[20px] font-semibold text-fg placeholder:text-muted focus:outline-none"
  />
);

/* =============================================================== serviço */

export function ServiceModal({
  clientName,
  service,
  team,
  now,
  onClose,
  onSave,
  onRemove,
}: {
  clientName: string;
  /** Presente = edição. */
  service: ClientService | null;
  team: TeamOption[];
  now: Date;
  onClose: () => void;
  onSave: (input: ServiceInput) => Promise<void>;
  onRemove?: () => void;
}) {
  const [name, setName] = useState(service?.name ?? "");
  const [kind, setKind] = useState<ServiceKind>(service?.kind ?? "instagram");
  const [scope, setScope] = useState(service?.scope ?? "");
  const [responsibleId, setResponsibleId] = useState(service?.responsibleId ?? "");
  const [monthlyValue, setMonthlyValue] = useState(service?.monthlyValue ?? 0);
  const [status, setStatus] = useState<ServiceStatus>(service?.status ?? "ativo");
  const [quota, setQuota] = useState<number | null>(service?.quota ?? null);
  const [unit, setUnit] = useState(service?.unit ?? "");
  const [delivered, setDelivered] = useState<number | null>(service ? deliveredThisMonth(service, now) : 0);
  const [stage, setStage] = useState(service?.stage ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        kind,
        scope,
        responsibleId: responsibleId || null,
        monthlyValue,
        status,
        quota,
        unit,
        delivered: delivered ?? 0,
        stage,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      trail={["black berry", clientName, service ? "Editar serviço" : "Novo serviço"]}
      onClose={onClose}
      onSubmit={() => void submit()}
      saving={saving}
      canSubmit={!!name.trim()}
      submitLabel={service ? "Salvar" : "Adicionar serviço"}
      danger={service && onRemove ? { label: "Remover serviço", onClick: onRemove } : undefined}
    >
      <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
        <TitleInput value={name} onChange={setName} placeholder="Nome do serviço" />
        <Hint>
          O valor entra no faturamento enquanto o serviço está ativo ou em setup. Com meta, o progresso é
          “entregues / meta” do mês; sem meta, é a situação escrita.
        </Hint>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
        <ChipSelect
          label="Tipo"
          icon={(v: ServiceKind) => <ServiceGlyph kind={v} size={14} />}
          value={kind}
          options={SERVICE_KINDS}
          onChange={setKind}
        />
        <ChipText icon={<BoxIcon size={14} />} placeholder="Escopo" value={scope} onChange={setScope} width="w-40" />
        <ChipSelect
          label="Responsável"
          icon={<UserCircleIcon size={14} />}
          value={responsibleId}
          options={[{ id: "", label: "Sem responsável" }, ...team.map((p) => ({ id: p.id, label: p.name }))]}
          onChange={setResponsibleId}
        />
        <ChipMoney value={monthlyValue} onChange={setMonthlyValue} placeholder="Valor mensal" />
        <ChipSelect
          label="Status"
          icon={<TagIcon size={14} />}
          value={status}
          options={SERVICE_STATUSES.map((s) => ({ id: s.id, label: s.label }))}
          onChange={setStatus}
        />
        <ChipCount
          icon={<PackageIcon size={14} />}
          placeholder="Meta do mês"
          value={quota}
          onChange={setQuota}
          format={(v) => `Meta ${v}`}
        />
        {quota ? (
          <>
            <ChipText icon={<TagIcon size={14} />} placeholder="Unidade (posts)" value={unit} onChange={setUnit} />
            <ChipCount
              icon={<CheckIcon size={14} />}
              placeholder="Entregues no mês"
              value={delivered}
              onChange={setDelivered}
              format={(v) => `${v} entregues`}
            />
          </>
        ) : (
          <ChipText icon={<Clock3Icon size={14} />} placeholder="Situação" value={stage} onChange={setStage} width="w-36" />
        )}
      </div>
    </ModalShell>
  );
}

/* ================================================================ evento */

export function EventModal({
  clientName,
  onClose,
  onSave,
}: {
  clientName: string;
  onClose: () => void;
  onSave: (input: Pick<ClientEvent, "kind" | "title" | "at" | "place">) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ClientEvent["kind"]>("reuniao");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("10:00");
  const [place, setPlace] = useState("");
  const [saving, setSaving] = useState(false);
  const at = day && time ? new Date(`${day}T${time}`) : null;
  const valid = !!title.trim() && !!at && !Number.isNaN(at.getTime());

  return (
    <ModalShell
      trail={["black berry", clientName, "Novo evento"]}
      onClose={onClose}
      onSubmit={async () => {
        if (!at) return;
        setSaving(true);
        try {
          await onSave({ title: title.trim(), kind, at: at.toISOString(), place });
        } finally {
          setSaving(false);
        }
      }}
      saving={saving}
      canSubmit={valid}
      submitLabel="Marcar evento"
    >
      <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
        <TitleInput value={title} onChange={setTitle} placeholder="Título do evento" />
        <Hint>Aparece em “Próximos eventos” e, depois que passa, na linha do tempo do cliente.</Hint>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
        <ChipSelect label="Tipo" icon={<TagIcon size={14} />} value={kind} options={EVENT_KINDS} onChange={setKind} />
        <ChipInput
          icon={<CalendarIcon size={14} />}
          placeholder="Dia"
          value={day}
          onChange={setDay}
          format={(v) => (v ? v.split("-").reverse().join("/") : "")}
          parse={(raw) => raw}
          toDraft={(v) => v}
          type="date"
          width="w-36"
        />
        <ChipInput
          icon={<Clock3Icon size={14} />}
          placeholder="Hora"
          value={time}
          onChange={setTime}
          format={(v) => v}
          parse={(raw) => raw}
          toDraft={(v) => v}
          type="time"
          width="w-24"
        />
        <ChipText icon={<MapPinIcon size={14} />} placeholder="Local" value={place} onChange={setPlace} />
      </div>
    </ModalShell>
  );
}

/* ======================================================= contrato e pagamento */

export function ContractModal({
  clientName,
  contract,
  onClose,
  onSave,
}: {
  clientName: string;
  contract: Contract;
  onClose: () => void;
  onSave: (contract: Contract) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Contract>(contract);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<Contract>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <ModalShell
      trail={["black berry", clientName, "Resumo do contrato"]}
      onClose={onClose}
      onSubmit={async () => {
        setSaving(true);
        try {
          await onSave(draft);
        } finally {
          setSaving(false);
        }
      }}
      saving={saving}
      submitLabel="Salvar"
    >
      <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
        <p className="text-[20px] font-semibold text-fg">Contrato</p>
        <Hint>
          O início define o “Cliente desde”, a renovação e o reajuste anual. O valor mensal é a soma dos serviços, e
          o dia do faturamento fica na ficha do cliente.
        </Hint>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
        <ChipInput
          icon={<CalendarIcon size={14} />}
          placeholder="Início"
          value={draft.startDate ?? ""}
          onChange={(v) => set({ startDate: v || null })}
          format={(v) => (v ? `Início ${v.split("-").reverse().join("/")}` : "")}
          parse={(raw) => raw}
          toDraft={(v) => v}
          type="date"
          width="w-36"
        />
        <ChipCount
          icon={<Clock3Icon size={14} />}
          placeholder="Fidelidade (meses)"
          value={draft.fidelityMonths}
          onChange={(v) => set({ fidelityMonths: v || null })}
          format={(v) => `${v} ${v === 1 ? "mês" : "meses"} de fidelidade`}
          max={120}
        />
        <ChipSelect label="Ciclo" icon={<CalendarIcon size={14} />} value={draft.cycle} options={CONTRACT_CYCLES} onChange={(v) => set({ cycle: v })} />
        <ChipText
          icon={<TagIcon size={14} />}
          placeholder="Índice de reajuste"
          value={draft.adjustmentIndex}
          onChange={(v) => set({ adjustmentIndex: v })}
        />
      </div>
    </ModalShell>
  );
}

export function PaymentModal({
  clientName,
  payment,
  onClose,
  onSave,
}: {
  clientName: string;
  payment: PaymentMethod | null;
  onClose: () => void;
  onSave: (payment: PaymentMethod | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PaymentMethod>(
    payment ?? { kind: "cartao", brand: "", last4: "", expires: "" },
  );
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<PaymentMethod>) => setDraft((d) => ({ ...d, ...p }));
  const card = draft.kind === "cartao";

  async function save(value: PaymentMethod | null) {
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      trail={["black berry", clientName, "Método de pagamento"]}
      onClose={onClose}
      onSubmit={() => void save(draft)}
      saving={saving}
      submitLabel="Salvar"
      danger={payment ? { label: "Remover", onClick: () => void save(null) } : undefined}
    >
      <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
        <p className="text-[20px] font-semibold text-fg">Método de pagamento</p>
        <Hint>
          Do cartão ficam só a bandeira, os 4 últimos dígitos e a validade — o número inteiro nunca é guardado. As
          cobranças novas saem nesta forma.
        </Hint>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
        <ChipSelect label="Forma" icon={<CreditCardIcon size={14} />} value={draft.kind} options={PAYMENT_KINDS} onChange={(v) => set({ kind: v })} />
        {card && (
          <>
            <ChipText icon={<TagIcon size={14} />} placeholder="Bandeira" value={draft.brand} onChange={(v) => set({ brand: v })} />
            <ChipInput
              icon={<CreditCardIcon size={14} />}
              placeholder="4 últimos dígitos"
              value={draft.last4}
              onChange={(v) => set({ last4: v })}
              format={(v) => (v ? `•••• ${v}` : "")}
              parse={(raw) => {
                const d = raw.replace(/\D/g, "");
                return d.length === 4 ? d : raw.trim() === "" ? "" : undefined;
              }}
              toDraft={(v) => v}
              width="w-20"
            />
            <ChipInput
              icon={<CalendarIcon size={14} />}
              placeholder="Validade (MM/AA)"
              value={draft.expires}
              onChange={(v) => set({ expires: v })}
              format={(v) => (v ? `Expira ${v}` : "")}
              parse={(raw) => {
                const m = /^(\d{1,2})\s*\/\s*(\d{2})$/.exec(raw.trim());
                if (!m) return raw.trim() === "" ? "" : undefined;
                const mm = Number(m[1]);
                return mm >= 1 && mm <= 12 ? `${String(mm).padStart(2, "0")}/${m[2]}` : undefined;
              }}
              toDraft={(v) => v}
              width="w-20"
            />
          </>
        )}
      </div>
    </ModalShell>
  );
}
