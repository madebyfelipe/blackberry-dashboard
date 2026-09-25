import { cn } from "@/lib/cn";
import { ACTIVITY_TONES, FILE_TONES } from "@/lib/crm/constants";
import { fileTone } from "@/lib/crm/view";
import type { ActivityKind, ServiceKind } from "@/lib/crm/types";
import {
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  FileCodeIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  InstagramIcon,
  MailIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PenToolIcon,
  SheetIcon,
  UploadIcon,
  VideoIcon,
  WalletIcon,
  ZapIcon,
} from "@/components/icons";

/*
 * As peças que as cinco abas da ficha do cliente repetem (export "Clientes ·
 * Detalhe"): o cartão de número de cima, o cartão de seção, o selo, a barra
 * de progresso e os ícones de serviço, arquivo e atividade.
 */

/** O cartão de número ("FATURAMENTO MENSAL", "R$ 8.500", "+12% vs. mês anterior"). */
export function KpiCard({
  label,
  value,
  sub,
  subTone = "muted",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "muted" | "good" | "warn" | "bad";
  icon?: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5 rounded-tile border border-rule bg-flow-btn p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 text-[11.5px] font-medium uppercase leading-[14px] tracking-[0.3px] text-muted">{label}</h3>
        {icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-badge-neutral text-fg-3">
            {icon}
          </span>
        )}
      </div>
      <p className="truncate text-[22px] font-semibold text-fg">{value}</p>
      {sub && (
        <p
          className={cn(
            "text-[12px] font-medium leading-4",
            subTone === "good"
              ? "text-crm-green"
              : subTone === "warn"
                ? "text-crm-amber"
                : subTone === "bad"
                  ? "text-client-risco-fg"
                  : "text-muted",
          )}
        >
          {sub}
        </p>
      )}
    </section>
  );
}

/** O cartão de seção: título à esquerda, contagem ou link à direita. */
export function Panel({
  title,
  aside,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-tile border border-rule bg-flow-btn p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-[14px] font-semibold text-fg-soft">{title}</h2>
        {aside && <div className="shrink-0 text-[12px] font-medium text-muted">{aside}</div>}
      </div>
      <div className={cn("min-h-0", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Selo de fundo e texto ("Ativo", "Em setup", "Pago", "A vencer"). */
export function Pill({ bg, fg, dot, children }: { bg: string; fg: string; dot?: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-mark px-[9px] py-1 text-[11.5px] font-medium"
      style={{ background: bg, color: fg }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {children}
    </span>
  );
}

/** A barra de 110px da coluna PROGRESSO. */
export function ProgressBar({ ratio, className }: { ratio: number; className?: string }) {
  return (
    <span
      className={cn("block h-1.5 w-[110px] overflow-hidden rounded-pill bg-divider", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
    >
      <span className="block h-full rounded-pill bg-primary" style={{ width: `${Math.round(ratio * 100)}%` }} />
    </span>
  );
}

/** Iniciais num círculo — pessoa do time, cliente. */
export function Initials({ name, size = 32, className }: { name: string; size?: 18 | 20 | 22 | 32; className?: string }) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "—";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-pill bg-border font-semibold text-initials-strong",
        size === 32 ? "h-8 w-8 text-[11px]" : size === 22 ? "h-[22px] w-[22px] text-[9.5px]" : size === 20 ? "h-5 w-5 text-[9px]" : "h-[18px] w-[18px] text-[8px]",
        className,
      )}
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}

export function ServiceGlyph({ kind, size = 16 }: { kind: ServiceKind; size?: number }) {
  switch (kind) {
    case "instagram":
      return <InstagramIcon size={size} />;
    case "blog":
      return <FileTextIcon size={size} />;
    case "trafego":
      return <MegaphoneIcon size={size} />;
    case "producao":
      return <CameraIcon size={size} />;
    case "email":
      return <MailIcon size={size} />;
    case "site":
      return <GlobeIcon size={size} />;
    case "design":
      return <PenToolIcon size={size} />;
    default:
      return <ZapIcon size={size} />;
  }
}

/** O ícone do arquivo pelo tipo, com a cor do cartão. */
export function FileGlyph({ mime, name, size = 16, tinted = true }: { mime: string; name: string; size?: number; tinted?: boolean }) {
  const tone = fileTone(mime, name);
  const icon =
    tone === "imagem" ? (
      <ImageIcon size={size} />
    ) : tone === "video" ? (
      <VideoIcon size={size} />
    ) : tone === "planilha" ? (
      <SheetIcon size={size} />
    ) : tone === "codigo" ? (
      <FileCodeIcon size={size} />
    ) : (
      <FileTextIcon size={size} />
    );
  return tinted ? <span style={{ color: FILE_TONES[tone].fg }}>{icon}</span> : icon;
}

export function ActivityGlyph({ kind, size = 15 }: { kind: ActivityKind; size?: number }) {
  if (kind === "aprovacao") return <CheckIcon size={size} />;
  if (kind === "comentario") return <MessageSquareIcon size={size} />;
  if (kind === "arquivo") return <UploadIcon size={size} />;
  if (kind === "financeiro") return <WalletIcon size={size} />;
  return <CalendarIcon size={size} />;
}

/** O ladrilho colorido da atividade (aba Atividades). */
export function ActivityTile({ kind }: { kind: ActivityKind }) {
  const tone = ACTIVITY_TONES[kind];
  return (
    <span
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-chip"
      style={{ background: tone.bg, color: tone.fg }}
      aria-hidden="true"
    >
      <ActivityGlyph kind={kind} size={16} />
    </span>
  );
}

/** A bolinha cinza da linha do tempo da Visão geral. */
export function ActivityDot({ kind }: { kind: ActivityKind }) {
  return (
    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-pill border border-border-soft bg-surface-2 text-fg-3">
      <ActivityGlyph kind={kind} size={13} />
    </span>
  );
}

/** Texto da seção em caixa alta ("PASTAS", "HOJE"). */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-[11px] font-semibold uppercase tracking-[0.6px] text-label", className)}>{children}</h3>
  );
}
