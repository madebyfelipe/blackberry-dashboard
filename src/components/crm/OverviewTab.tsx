"use client";

import { ROLE_LABEL } from "@/lib/inbox/users";
import type { Client } from "@/lib/clients/types";
import type { Activity, ClientAccount } from "@/lib/crm/types";
import {
  clientHealth,
  dayMonthShort,
  fileTypeLabel,
  formatMoney,
  isBilled,
  monthlyTotal,
  monthYear,
  mrrDelta,
  nextBillingDate,
  openInvoices,
  relativeAgo,
  renewalDate,
} from "@/lib/crm/view";
import { formatBytes } from "@/lib/media/constants";
import { DownloadIcon, MailIcon, MapPinIcon, PhoneIcon, UserIcon } from "@/components/icons";
import { ActivityDot, FileGlyph, Initials, KpiCard, Panel, ServiceGlyph } from "./parts";
import type { DetailTab, TeamMember } from "./ClientDetail";

/** Visão geral — o primeiro quadro do export "Clientes · Detalhe". */
export function OverviewTab({
  client,
  account,
  squad,
  activities,
  now,
  onGo,
}: {
  client: Client;
  account: ClientAccount;
  squad: TeamMember[];
  activities: Activity[];
  now: Date;
  onGo: (tab: DetailTab) => void;
}) {
  const mrr = monthlyTotal(account.services);
  const delta = mrrDelta(mrr, account.invoices, now);
  const renewal = renewalDate(account.contract, now);
  const billing = nextBillingDate(client.billingDay, now);
  const open = openInvoices(account.invoices, now);
  const health = clientHealth(client.status, client.nps, open.overdue);
  const billed = account.services.filter(isBilled);
  const docs = account.files
    .filter((f) => f.folder !== "criativos")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-4 xl:min-h-full xl:flex-row xl:gap-[18px]">
      {/* Coluna principal */}
      <div className="@container flex min-w-0 flex-1 flex-col gap-4">
        <div className="grid shrink-0 grid-cols-2 gap-3 @2xl:grid-cols-4">
          <KpiCard
            label="Faturamento mensal"
            value={formatMoney(mrr)}
            sub={delta === null ? `${billed.length} ${billed.length === 1 ? "serviço" : "serviços"} no mês` : `${delta >= 0 ? "+" : ""}${delta}% vs. mês anterior`}
            subTone={delta !== null && delta > 0 ? "good" : delta !== null && delta < 0 ? "bad" : "muted"}
          />
          <KpiCard
            label="Contrato"
            value={account.contract.fidelityMonths ? `${account.contract.fidelityMonths} meses` : "—"}
            sub={renewal ? `Renova em ${monthYear(renewal)}` : "Sem fidelidade definida"}
          />
          <KpiCard
            label="Faturamento"
            value={client.billingDay ? `Dia ${String(client.billingDay).padStart(2, "0")}` : "—"}
            sub={billing ? `Próx. cobrança ${dayMonthShort(billing)}` : "Dia não definido"}
          />
          <KpiCard
            label="Saúde do cliente"
            value={health.label}
            sub={health.sub}
            subTone={health.tone === "neutral" ? "muted" : health.tone}
          />
        </div>

        <Panel
          title="Serviços contratados"
          aside={`${billed.length} ${billed.length === 1 ? "ativo" : "ativos"}`}
          className="shrink-0 pb-2"
        >
          {billed.length === 0 ? (
            <EmptyLine action={{ label: "Adicionar serviço", onClick: () => onGo("servicos") }}>
              Nenhum serviço ativo.
            </EmptyLine>
          ) : (
            <ul className="flex flex-col pt-2">
              {billed.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onGo("servicos")}
                    className={`flex w-full items-center gap-3 py-3 text-left ${i < billed.length - 1 ? "border-b border-rule" : ""}`}
                  >
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-chip bg-badge-neutral text-fg-3">
                      <ServiceGlyph kind={s.kind} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[13px] font-medium text-fg">{s.name}</span>
                      {s.scope && <span className="truncate text-[12px] text-muted">{s.scope}</span>}
                    </span>
                    <span className="shrink-0 text-[13px] font-medium text-fg-3">{formatMoney(s.monthlyValue)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Atividades recentes"
          aside={
            <button type="button" onClick={() => onGo("atividades")} className="hover:text-fg-soft">
              Ver tudo
            </button>
          }
          className="pb-2 xl:min-h-[240px] xl:flex-1"
        >
          {activities.length === 0 ? (
            <EmptyLine>Nada aconteceu com este cliente ainda.</EmptyLine>
          ) : (
            <ol className="flex flex-col pt-2.5">
              {activities.slice(0, 5).map((a, i, list) => (
                <li key={a.id} className="flex gap-3 py-2.5">
                  <span className="flex w-[26px] shrink-0 flex-col items-center">
                    <ActivityDot kind={a.kind} />
                    {i < list.length - 1 && <span className="mt-0.5 h-[22px] w-px bg-crm-rail" aria-hidden="true" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px] pt-[3px]">
                    <span className="text-[13px] text-fg-soft">{a.title}</span>
                    <span className="text-[12px] text-muted">
                      {a.who} · {relativeAgo(a.at, now)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {/* Coluna lateral */}
      <div className="flex w-full shrink-0 flex-col gap-4 xl:w-[344px]">
        <Panel title="Informações de contato" bodyClassName="pt-3.5">
          <ul className="flex flex-col gap-3">
            <ContactRow icon={<UserIcon size={15} />} label="Contato principal" value={client.contactName} />
            <ContactRow
              icon={<PhoneIcon size={15} />}
              label="Telefone"
              value={client.phone}
              href={client.phone ? `tel:${client.phone.replace(/[^\d+]/g, "")}` : undefined}
            />
            <ContactRow
              icon={<MailIcon size={15} />}
              label="E-mail"
              value={client.email}
              href={client.email ? `mailto:${client.email}` : undefined}
            />
            <ContactRow icon={<MapPinIcon size={15} />} label="Localização" value={client.city} />
          </ul>
        </Panel>

        <Panel title="Equipe responsável" aside={String(squad.length)} bodyClassName="pt-3.5">
          {squad.length === 0 ? (
            <p className="text-[12px] text-muted">Ninguém no squad — defina na ficha (lápis, acima).</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {squad.map((m) => (
                <li key={m.id} className="flex items-center gap-[11px]">
                  <Initials name={m.name} />
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="truncate text-[13px] font-medium text-fg-soft">{m.name}</span>
                    <span className="truncate text-[12px] text-muted">
                      {ROLE_LABEL[m.role as keyof typeof ROLE_LABEL] ?? m.role}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Documentos"
          aside={
            <button type="button" onClick={() => onGo("arquivos")} className="hover:text-fg-soft">
              Ver todos
            </button>
          }
          bodyClassName="pt-3"
          className="xl:flex-1"
        >
          {docs.length === 0 ? (
            <EmptyLine action={{ label: "Enviar em Arquivos", onClick: () => onGo("arquivos") }}>
              Nenhum documento ainda.
            </EmptyLine>
          ) : (
            <ul className="flex flex-col gap-2">
              {docs.map((f) => (
                <li key={f.id}>
                  <a
                    href={`/api/media/${f.mediaId}`}
                    download={f.name}
                    className="group flex items-center gap-2.5 rounded-chip bg-surface-2 p-2.5 transition-colors hover:bg-border"
                  >
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-mark bg-divider text-fg-3">
                      <FileGlyph mime={f.mime} name={f.name} size={15} tinted={false} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="truncate text-[12.5px] font-medium text-fg-soft">{f.name}</span>
                      <span className="text-[11px] text-muted">
                        {fileTypeLabel(f.name)} · {formatBytes(f.size)}
                      </span>
                    </span>
                    <DownloadIcon size={15} className="text-muted group-hover:text-fg-soft" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ContactRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-badge-neutral text-fg-3">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="text-[11px] text-muted">{label}</span>
        <span className="truncate text-[13px] font-medium text-fg-soft">{value || "—"}</span>
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <a href={href} className="flex items-center gap-[11px] rounded-chip transition-colors hover:text-fg">
          {body}
        </a>
      ) : (
        <span className="flex items-center gap-[11px]">{body}</span>
      )}
    </li>
  );
}

export function EmptyLine({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 py-3 text-[12px] text-muted">
      {children}
      {action && (
        <button type="button" onClick={action.onClick} className="font-medium text-fg-soft underline-offset-2 hover:underline">
          {action.label}
        </button>
      )}
    </p>
  );
}
