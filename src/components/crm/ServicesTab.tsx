"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Client } from "@/lib/clients/types";
import { serviceStatus } from "@/lib/crm/constants";
import type { ClientAccount, ClientService } from "@/lib/crm/types";
import {
  formatMoney,
  isBilled,
  monthDeliveries,
  monthlyTotal,
  nextDelivery,
  serviceProgress,
  type ActivityTask,
} from "@/lib/crm/view";
import type { ServiceInput } from "@/lib/crm/repository";
import { CalendarClockIcon, PackageIcon, PlusIcon, WalletIcon } from "@/components/icons";
import { crmApi } from "./api";
import { ServiceModal } from "./modals";
import { Initials, KpiCard, Pill, ProgressBar, ServiceGlyph } from "./parts";
import type { TeamMember } from "./ClientDetail";

const MONTHS_LONG = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Serviços — o segundo quadro do export: o que o cliente contratou, e como vai cada um no mês. */
export function ServicesTab({
  client,
  account,
  team,
  tasks,
  now,
  onChange,
}: {
  client: Client;
  account: ClientAccount;
  team: TeamMember[];
  tasks: ActivityTask[];
  now: Date;
  onChange: (a: ClientAccount) => void;
}) {
  const { toast } = useToast();
  const [modal, setModal] = useState<{ service: ClientService | null } | null>(null);

  const total = monthlyTotal(account.services);
  const recurring = account.services.filter(isBilled).length;
  const deliveries = monthDeliveries(account.services, now);
  const next = nextDelivery(tasks, now);
  const personName = (id: string | null) => team.find((m) => m.id === id)?.name ?? null;

  async function save(input: ServiceInput) {
    try {
      const account = modal?.service
        ? await crmApi.updateService(client.id, modal.service.id, input)
        : await crmApi.addService(client.id, input);
      onChange(account);
      setModal(null);
      toast(modal?.service ? "Serviço atualizado." : "Serviço adicionado.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar o serviço.", "error");
    }
  }

  async function remove(service: ClientService) {
    try {
      onChange(await crmApi.removeService(client.id, service.id));
      setModal(null);
      toast(`${service.name} saiu dos serviços.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível remover.", "error");
    }
  }

  return (
    <div className="@container flex flex-col gap-4 xl:min-h-full">
      <div className="grid shrink-0 grid-cols-1 gap-3 @xl:grid-cols-3">
        <KpiCard
          label="Total mensal"
          value={formatMoney(total)}
          sub={`${recurring} ${recurring === 1 ? "serviço recorrente" : "serviços recorrentes"}`}
          icon={<WalletIcon size={14} />}
        />
        <KpiCard
          label="Entregas no mês"
          value={deliveries.total ? `${deliveries.done} / ${deliveries.total}` : "—"}
          sub={
            deliveries.total
              ? `${MONTHS_LONG[now.getMonth()]} · ${Math.round((deliveries.done / deliveries.total) * 100)}% concluído`
              : "Nenhum serviço com meta de entregas"
          }
          icon={<PackageIcon size={14} />}
        />
        <KpiCard
          label="Próxima entrega"
          value={next?.label ?? "—"}
          sub={next?.sub ?? "Nenhuma tarefa com prazo"}
          subTone={next?.label === "Atrasada" ? "bad" : "muted"}
          icon={<CalendarClockIcon size={14} />}
        />
      </div>

      <section className="flex min-w-0 flex-col overflow-hidden rounded-tile border border-rule bg-flow-btn xl:flex-1">
        <div className="flex items-center justify-between gap-3 border-b border-rule px-4 pb-3.5 pt-4">
          <h2 className="text-[14px] font-semibold text-fg-soft">Serviços contratados</h2>
          <button
            type="button"
            onClick={() => setModal({ service: null })}
            className="tap flex items-center gap-[7px] rounded-mark border border-panel-ring bg-border px-3.5 py-2 text-[12.5px] font-medium text-fg transition-colors hover:bg-border-strong"
          >
            <PlusIcon size={14} />
            Adicionar serviço
          </button>
        </div>

        {account.services.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted">
            Nenhum serviço ainda. Adicione o que a agência entrega para {client.name} — o valor entra no faturamento.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="h-[39.5px] border-b border-rule text-[11px] font-semibold uppercase tracking-[0.6px] text-label">
                  <th className="px-4 font-semibold">Serviço</th>
                  <th className="w-[210px] pr-4 font-semibold">Escopo</th>
                  <th className="w-[150px] pr-4 font-semibold">Responsável</th>
                  <th className="w-[150px] pr-4 font-semibold">Progresso</th>
                  <th className="w-[100px] pr-4 font-semibold">Valor</th>
                  <th className="w-[110px] pr-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {account.services.map((s) => {
                  const progress = serviceProgress(s, now);
                  const st = serviceStatus(s.status);
                  const who = personName(s.responsibleId);
                  return (
                    <tr
                      key={s.id}
                      tabIndex={0}
                      onClick={() => setModal({ service: s })}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setModal({ service: s }))}
                      aria-label={`Editar ${s.name}`}
                      className="h-[55.5px] cursor-pointer border-b border-rule-soft transition-colors last:border-b-0 hover:bg-row-raised focus-visible:bg-row-raised focus-visible:outline-none"
                    >
                      <td className="px-4">
                        <span className="flex items-center gap-[11px]">
                          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-chip bg-badge-neutral text-fg-3">
                            <ServiceGlyph kind={s.kind} />
                          </span>
                          <span className="truncate text-[13px] font-medium text-fg">{s.name}</span>
                        </span>
                      </td>
                      <td className="pr-4 text-[13px] text-muted">{s.scope || "—"}</td>
                      <td className="pr-4">
                        {who ? (
                          <span className="flex items-center gap-2">
                            <Initials name={who} size={22} />
                            <span className="truncate text-[13px] text-fg-3">{who}</span>
                          </span>
                        ) : (
                          <span className="text-[13px] text-muted">—</span>
                        )}
                      </td>
                      <td className="pr-4">
                        <span className="flex flex-col gap-[5px]">
                          <ProgressBar ratio={progress.ratio} />
                          <span className="truncate text-[11px] text-muted">{progress.label}</span>
                        </span>
                      </td>
                      <td className="pr-4 text-[13px] font-medium text-fg-3">
                        {s.monthlyValue > 0 ? formatMoney(s.monthlyValue) : "—"}
                      </td>
                      <td className="pr-4">
                        <Pill bg={st.bg} fg={st.fg}>
                          {st.label}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && (
        <ServiceModal
          clientName={client.name}
          service={modal.service}
          team={team}
          now={now}
          onClose={() => setModal(null)}
          onSave={save}
          onRemove={modal.service ? () => void remove(modal.service!) : undefined}
        />
      )}
    </div>
  );
}
