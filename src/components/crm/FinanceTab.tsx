"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import type { Client } from "@/lib/clients/types";
import { CONTRACT_CYCLES, paymentLabel } from "@/lib/crm/constants";
import type { ClientAccount, Invoice, PaymentKind } from "@/lib/crm/types";
import {
  clientSince,
  competenceLabel,
  dayMonth,
  daysBetween,
  formatMoney,
  formatMoneyCompact,
  invoiceBadge,
  invoiceBadgeMeta,
  invoicesCsv,
  monthlyTotal,
  monthsAsClient,
  monthYear,
  mrrDelta,
  nextAdjustment,
  nextInvoice,
  openInvoices,
  parseDateKey,
  receivedInYear,
  sortInvoices,
} from "@/lib/crm/view";
import {
  BarcodeIcon,
  CalendarIcon,
  CheckCircleIcon,
  Clock3Icon,
  CreditCardIcon,
  DownloadIcon,
  GemIcon,
  PencilIcon,
  TrendingUpIcon,
  ZapIcon,
} from "@/components/icons";
import { crmApi } from "./api";
import { ContractModal, PaymentModal } from "./modals";
import { KpiCard, Pill } from "./parts";
import { RowMenu } from "./RowMenu";

/** Financeiro — o terceiro quadro do export: o que entra, o que falta e o contrato. */
export function FinanceTab({
  client,
  account,
  now,
  onChange,
}: {
  client: Client;
  account: ClientAccount;
  now: Date;
  onChange: (a: ClientAccount) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"contrato" | "pagamento" | null>(null);

  const mrr = monthlyTotal(account.services);
  const delta = mrrDelta(mrr, account.invoices, now);
  const received = receivedInYear(account.invoices, now.getFullYear());
  const open = openInvoices(account.invoices, now);
  const months = monthsAsClient(clientSince(account.contract, client.createdAt).toISOString(), now);
  const next = nextInvoice(account.invoices, mrr, client.billingDay, now);
  const invoices = sortInvoices(account.invoices);

  async function run(fn: () => Promise<ClientAccount>, done: string) {
    setBusy(true);
    try {
      onChange(await fn());
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Algo deu errado.", "error");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    // BOM: o Excel abre o CSV em UTF-8 com acento certo.
    const blob = new Blob(["﻿" + invoicesCsv(account.invoices, now)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faturas-${client.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const dueIn = next.dueDate ? daysBetween(now, next.dueDate) : null;
  const dueText =
    next.dueDate === null
      ? null
      : `Vence em ${dayMonth(next.dueDate)} · ${
          dueIn === 0 ? "hoje" : dueIn === 1 ? "amanhã" : dueIn! < 0 ? `há ${-dueIn!} dias` : `em ${dueIn} dias`
        }`;
  const adjustment = nextAdjustment(account.contract, now);
  const start = parseDateKey(account.contract.startDate);

  return (
    <div className="@container flex flex-col gap-4 xl:min-h-full">
      <div className="grid shrink-0 grid-cols-2 gap-3 @3xl:grid-cols-4">
        <KpiCard
          label="Receita mensal (MRR)"
          value={formatMoney(mrr)}
          sub={delta === null ? "Sem fatura no mês anterior" : `${delta >= 0 ? "+" : ""}${delta}% vs. mês anterior`}
          subTone={delta !== null && delta > 0 ? "good" : delta !== null && delta < 0 ? "bad" : "muted"}
          icon={<TrendingUpIcon size={14} />}
        />
        <KpiCard
          label={`Recebido em ${now.getFullYear()}`}
          value={formatMoney(received.cents)}
          sub={`${received.count} ${received.count === 1 ? "fatura paga" : "faturas pagas"}`}
          icon={<CheckCircleIcon size={14} />}
        />
        <KpiCard
          label="Em aberto"
          value={formatMoney(open.cents)}
          sub={
            open.count === 0
              ? "Nenhuma pendência"
              : open.overdue
                ? `${open.overdue} ${open.overdue === 1 ? "fatura atrasada" : "faturas atrasadas"}`
                : `${open.count} ${open.count === 1 ? "fatura a vencer" : "faturas a vencer"}`
          }
          subTone={open.overdue ? "bad" : "muted"}
          icon={<Clock3Icon size={14} />}
        />
        <KpiCard
          label="LTV estimado"
          value={formatMoneyCompact(mrr * months)}
          sub={`Cliente há ${months} ${months === 1 ? "mês" : "meses"}`}
          icon={<GemIcon size={14} />}
        />
      </div>

      <div className="flex flex-col gap-4 xl:min-h-0 xl:flex-1 xl:flex-row">
        {/* Histórico de faturas */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-tile border border-rule bg-flow-btn xl:flex-1">
          <div className="flex items-center justify-between gap-3 border-b border-rule px-4 pb-3.5 pt-4">
            <h2 className="text-[14px] font-semibold text-fg-soft">Histórico de faturas</h2>
            <button
              type="button"
              onClick={exportCsv}
              disabled={invoices.length === 0}
              className="flex items-center gap-[7px] text-[12.5px] font-medium text-fg-3 transition-colors hover:text-fg-soft disabled:opacity-40"
            >
              <DownloadIcon size={14} />
              Exportar
            </button>
          </div>
          {invoices.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">
              Nenhuma fatura ainda — “Gerar cobrança” cria a do próximo mês.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="h-[37.5px] border-b border-rule text-[11px] uppercase tracking-[0.6px] text-label">
                    <th className="px-4 font-semibold">Competência</th>
                    <th className="w-[110px] pr-4 font-semibold">Vencimento</th>
                    <th className="w-[160px] pr-4 font-semibold">Método</th>
                    <th className="w-[110px] pr-4 font-semibold">Valor</th>
                    <th className="w-[110px] pr-4 font-semibold">Status</th>
                    <th className="w-10 pr-2" aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <InvoiceRow
                      key={inv.id}
                      invoice={inv}
                      now={now}
                      busy={busy}
                      onPaid={(paid) =>
                        void run(
                          () => crmApi.setInvoiceStatus(client.id, inv.id, paid ? "pago" : "aberto"),
                          paid ? "Fatura marcada como paga." : "Fatura reaberta.",
                        )
                      }
                      onRemove={() => void run(() => crmApi.removeInvoice(client.id, inv.id), "Fatura excluída.")}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Lateral: próxima fatura, pagamento, contrato */}
        <div className="flex w-full shrink-0 flex-col gap-4 xl:w-[320px]">
          <section className="flex flex-col gap-2.5 rounded-tile border border-rule bg-flow-btn p-[18px]">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.6px] text-label">Próxima fatura</h2>
            <p className="text-[30px] font-bold leading-tight text-fg">{formatMoney(next.amount)}</p>
            {dueText ? (
              <p
                className={cn(
                  "flex items-center gap-1.5 text-[12.5px]",
                  dueIn !== null && dueIn < 0 ? "text-client-risco-fg" : "text-crm-amber",
                )}
              >
                <CalendarIcon size={13} />
                {dueText}
              </p>
            ) : (
              <p className="text-[12.5px] text-muted">Defina o dia do faturamento na ficha (lápis, no topo).</p>
            )}
            {next.existing ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() => crmApi.setInvoiceStatus(client.id, next.existing!.id, "pago"), "Fatura marcada como paga.")
                }
                className="tap mt-1.5 w-full rounded-mark bg-primary py-2.5 text-[13px] font-semibold text-on-primary transition-colors hover:bg-white disabled:opacity-60"
              >
                Marcar como paga
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => crmApi.generateInvoice(client.id), "Cobrança gerada.")}
                className="tap mt-1.5 w-full rounded-mark bg-primary py-2.5 text-[13px] font-semibold text-on-primary transition-colors hover:bg-white disabled:opacity-60"
              >
                Gerar cobrança
              </button>
            )}
          </section>

          <section className="flex flex-col gap-3.5 rounded-tile border border-rule bg-flow-btn p-[18px]">
            <h2 className="text-[14px] font-semibold text-fg-soft">Método de pagamento</h2>
            <button
              type="button"
              onClick={() => setModal("pagamento")}
              className="group flex items-center gap-3 rounded-menu bg-surface-2 p-3 text-left transition-colors hover:bg-border"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-divider text-fg-3">
                <PaymentGlyph kind={account.payment?.kind ?? "cartao"} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-[13px] font-medium text-fg-soft">
                  {!account.payment
                    ? "Nenhum definido"
                    : account.payment.kind === "cartao"
                      ? `${account.payment.brand || "Cartão"}${account.payment.last4 ? ` •••• ${account.payment.last4}` : ""}`
                      : paymentLabel(account.payment.kind)}
                </span>
                <span className="truncate text-[12px] text-muted">
                  {!account.payment
                    ? "Toque para definir"
                    : account.payment.kind === "cartao" && account.payment.expires
                      ? `Expira ${account.payment.expires}`
                      : "Cobranças novas saem nesta forma"}
                </span>
              </span>
              <PencilIcon size={14} className="text-muted group-hover:text-fg-soft" />
            </button>
          </section>

          <section className="flex flex-col gap-3 rounded-tile border border-rule bg-flow-btn p-[18px] xl:flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-semibold text-fg-soft">Resumo do contrato</h2>
              <button
                type="button"
                aria-label="Editar contrato"
                title="Editar contrato"
                onClick={() => setModal("contrato")}
                className="tap flex h-7 w-7 items-center justify-center rounded-mark text-muted transition-colors hover:bg-border hover:text-fg-soft"
              >
                <PencilIcon size={13} />
              </button>
            </div>
            <dl className="flex flex-col gap-3 text-[12.5px]">
              <Row label="Valor mensal" value={formatMoney(mrr)} />
              <Row label="Ciclo" value={CONTRACT_CYCLES.find((c) => c.id === account.contract.cycle)?.label ?? "—"} />
              <Row
                label="Reajuste"
                value={
                  account.contract.adjustmentIndex
                    ? `${account.contract.adjustmentIndex}${adjustment ? ` · ${monthYear(adjustment)}` : ""}`
                    : "—"
                }
              />
              <Row label="Início" value={start ? monthYear(start) : "—"} />
              <Row
                label="Fidelidade"
                value={account.contract.fidelityMonths ? `${account.contract.fidelityMonths} meses` : "—"}
              />
            </dl>
          </section>
        </div>
      </div>

      {modal === "contrato" && (
        <ContractModal
          clientName={client.name}
          contract={account.contract}
          onClose={() => setModal(null)}
          onSave={async (contract) => {
            try {
              onChange(await crmApi.updateContract(client.id, { contract }));
              setModal(null);
              toast("Contrato atualizado.");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
            }
          }}
        />
      )}
      {modal === "pagamento" && (
        <PaymentModal
          clientName={client.name}
          payment={account.payment}
          onClose={() => setModal(null)}
          onSave={async (payment) => {
            try {
              onChange(await crmApi.updateContract(client.id, { payment }));
              setModal(null);
              toast(payment ? "Forma de pagamento salva." : "Forma de pagamento removida.");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
            }
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-fg-soft">{value}</dd>
    </div>
  );
}

function PaymentGlyph({ kind, size = 16 }: { kind: PaymentKind; size?: number }) {
  if (kind === "pix") return <ZapIcon size={size} />;
  if (kind === "boleto") return <BarcodeIcon size={size} />;
  return <CreditCardIcon size={size} />;
}

function InvoiceRow({
  invoice,
  now,
  busy,
  onPaid,
  onRemove,
}: {
  invoice: Invoice;
  now: Date;
  busy: boolean;
  onPaid: (paid: boolean) => void;
  onRemove: () => void;
}) {
  const badge = invoiceBadgeMeta(invoice, now);
  const due = parseDateKey(invoice.dueDate);
  const paid = invoiceBadge(invoice, now) === "pago";
  return (
    <tr className="h-[47.5px] border-b border-rule-soft last:border-b-0">
      <td className="px-4 text-[13px] font-medium text-fg-soft">{competenceLabel(invoice.competence)}</td>
      <td className="pr-4 text-[13px] text-muted">{due ? dayMonth(due) : "—"}</td>
      <td className="pr-4">
        <span className="flex items-center gap-2 text-[13px] text-fg-3">
          <PaymentGlyph kind={invoice.method} size={14} />
          {paymentLabel(invoice.method)}
        </span>
      </td>
      <td className="pr-4 text-[13px] text-fg-3">{formatMoney(invoice.amount)}</td>
      <td className="pr-4">
        <Pill bg={badge.bg} fg={badge.fg}>
          {badge.label}
        </Pill>
      </td>
      <td className="pr-2">
        <RowMenu
          label={`Ações da fatura de ${competenceLabel(invoice.competence)}`}
          items={[
            { label: paid ? "Reabrir fatura" : "Marcar como paga", onSelect: () => onPaid(!paid) },
            { label: "Excluir fatura", onSelect: onRemove, danger: true },
          ]}
          className={busy ? "pointer-events-none opacity-40" : undefined}
        />
      </td>
    </tr>
  );
}
