"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Screen } from "@/components/ui/Screen";
import { useToast } from "@/components/ui/Toast";
import { CLIENT_STATUS_BY_ID } from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";
import { buildActivities, clientCode, clientSince, monthYear, type ActivityBatch, type ActivityTask } from "@/lib/crm/view";
import type { ClientAccount } from "@/lib/crm/types";
import {
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  SquareArrowOutUpRightIcon,
} from "@/components/icons";
import { ClientModal, type ClientModalValues } from "@/components/clients/ClientModal";
import { apiUpdateClient } from "@/components/clients/api";
import { TaskModal, type TaskModalValues } from "@/components/tasks/TaskModal";
import { apiCreateTask } from "@/components/tasks/api";
import { OverviewTab } from "./OverviewTab";
import { ServicesTab } from "./ServicesTab";
import { FinanceTab } from "./FinanceTab";
import { FilesTab, type CreativeFile } from "./FilesTab";
import { ActivityTab } from "./ActivityTab";
import { DETAIL_TABS as TABS, type DetailTab } from "./tabs";

export type { DetailTab };

/*
 * Ficha do cliente — export "Clientes · Detalhe" (Visão geral, Serviços,
 * Financeiro, Arquivos, Atividades). Abre pelo clique no cliente em
 * /clientes; a aba fica na URL (`?aba=`) para "Ver tudo" e link colado
 * abrirem direto nela.
 *
 * Tudo que a tela mostra sai de dado de verdade: a ficha (`lib/crm` —
 * serviços, faturas, contrato, arquivos, agenda), as tarefas e os lotes do
 * cliente. A linha do tempo é montada na hora (`buildActivities`), nunca
 * gravada. Cada mudança volta do servidor com a ficha inteira, e a tela
 * troca a dela por essa.
 *
 * O corpo espera montar no navegador para desenhar: data e hora dependem
 * do fuso de quem olha, e o servidor não sabe qual é.
 */

export type TeamMember = { id: string; name: string; handle: string; role: string };

export type DetailProps = {
  client: Client;
  account: ClientAccount;
  /** O time que trabalha — responsável de serviço, squad. */
  team: TeamMember[];
  tasks: ActivityTask[];
  batches: ActivityBatch[];
  /** As artes dos lotes do cliente — entram na pasta Criativos. */
  creatives: CreativeFile[];
  /** A conversa do Inbox com o nome do cliente, se existir. */
  conversationId: string | null;
  /** `/social/<cliente>` — os lotes do cliente ("Ver projetos"). */
  projectsHref: string;
  blobUploads: boolean;
  initialTab: DetailTab;
};

export function ClientDetail(props: DetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [client, setClient] = useState(props.client);
  const [account, setAccount] = useState(props.account);
  const [tab, setTab] = useState<DetailTab>(props.initialTab);
  const [now, setNow] = useState<Date | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  // Relógio da tela: monta no navegador e anda de minuto em minuto ("há 5 min").
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /** A ficha que voltou do servidor — e o relógio anda junto, para "há 1 min" não virar futuro. */
  function update(next: ClientAccount) {
    setAccount(next);
    setNow(new Date());
  }

  function go(next: DetailTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "visao") url.searchParams.delete("aba");
    else url.searchParams.set("aba", next);
    window.history.replaceState(null, "", url);
  }

  const activities = useMemo(
    () => (now ? buildActivities({ batches: props.batches, tasks: props.tasks, account, now }) : []),
    [props.batches, props.tasks, account, now],
  );

  const status = CLIENT_STATUS_BY_ID[client.status];
  const squad = client.squad
    .map((id) => props.team.find((m) => m.id === id))
    .filter((m): m is TeamMember => !!m);

  async function saveClient(values: ClientModalValues) {
    setSavingClient(true);
    try {
      setClient(await apiUpdateClient(client.id, values));
      setEditing(false);
      toast("Alterações salvas.");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSavingClient(false);
    }
  }

  async function createTask(values: TaskModalValues) {
    setSavingTask(true);
    try {
      const created = await apiCreateTask(values);
      setCreatingTask(false);
      toast("Tarefa criada.");
      // Como na lista de Tarefas: criar leva para a descrição, onde a tarefa ganha corpo.
      router.push(`/tarefas/${created.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível criar a tarefa.", "error");
      setSavingTask(false);
    }
  }

  const since = clientSince(account.contract, client.createdAt);
  const sub = [client.segment, `Cliente desde ${monthYear(since)}`, `ID #${clientCode(client)}`].filter(Boolean).join(" · ");
  const messageHref = props.conversationId
    ? `/inbox?conversa=${props.conversationId}`
    : client.email
      ? `mailto:${client.email}`
      : null;

  return (
    <Screen gap="md">
      <Breadcrumb
        items={[
          { label: "black berry", href: "/tarefas" },
          { label: "Clientes", href: "/clientes" },
          { label: client.name },
        ]}
      />

      {/* Cabeçalho */}
      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-pill border border-border-soft bg-surface-2 text-[17px] font-semibold text-initials-strong">
            {client.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-[5px]">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 truncate text-[20px] font-semibold text-fg md:text-[22px]">{client.name}</h1>
              <span
                className="flex shrink-0 items-center gap-1.5 rounded-mark px-[9px] py-1 text-[11.5px] font-medium"
                style={{ background: status.badgeBg, color: status.badgeFg }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.badgeFg }} />
                {status.label}
              </span>
            </div>
            <p className="truncate text-[13px] text-muted">{sub}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <IconAction label="Editar cliente" onClick={() => setEditing(true)}>
            <PencilIcon size={17} />
          </IconAction>
          {messageHref ? (
            <Link
              href={messageHref}
              aria-label={props.conversationId ? "Abrir a conversa do cliente no Inbox" : "Enviar e-mail"}
              title={props.conversationId ? "Conversa no Inbox" : `E-mail para ${client.email}`}
              className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-mark border border-panel-ring bg-surface-2 text-fg-3 transition-colors hover:bg-border hover:text-fg-soft"
            >
              <MessageSquareIcon size={17} />
            </Link>
          ) : (
            <IconAction label="Sem conversa nem e-mail — cadastre o e-mail na ficha" disabled>
              <MessageSquareIcon size={17} />
            </IconAction>
          )}
          <Link
            href={props.projectsHref}
            className="tap flex items-center gap-2 rounded-mark border border-panel-ring bg-border px-3 py-2.5 sm:px-4 text-[13px] font-medium text-fg transition-colors hover:bg-border-strong md:px-[18px]"
          >
            <SquareArrowOutUpRightIcon size={15} className="hidden sm:block" />
            <span className="whitespace-nowrap">Ver projetos</span>
          </Link>
          <button
            type="button"
            onClick={() => setCreatingTask(true)}
            className="tap flex items-center gap-2 rounded-mark bg-primary px-3 py-2.5 sm:px-4 text-[13px] font-semibold text-on-primary transition-colors hover:bg-white md:px-[18px]"
          >
            <PlusIcon size={15} strokeWidth={2.5} className="hidden sm:block" />
            <span className="whitespace-nowrap">Nova tarefa</span>
          </button>
        </div>
      </div>

      {/* Abas */}
      <div
        role="tablist"
        aria-label="Seções da ficha"
        className="-mx-1 flex shrink-0 gap-1 overflow-x-auto border-b border-rule px-1"
      >
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => go(t.id)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] transition-colors",
                on ? "border-primary font-semibold text-fg" : "border-transparent font-medium text-muted hover:text-fg-soft",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-1">
        {!now ? null : tab === "visao" ? (
          <OverviewTab
            client={client}
            account={account}
            squad={squad}
            activities={activities}
            now={now}
            onGo={go}
          />
        ) : tab === "servicos" ? (
          <ServicesTab
            client={client}
            account={account}
            team={props.team}
            tasks={props.tasks}
            now={now}
            onChange={update}
          />
        ) : tab === "financeiro" ? (
          <FinanceTab client={client} account={account} now={now} onChange={update} />
        ) : tab === "arquivos" ? (
          <FilesTab
            client={client}
            account={account}
            creatives={props.creatives}
            blobUploads={props.blobUploads}
            now={now}
            onChange={update}
          />
        ) : (
          <ActivityTab
            client={client}
            account={account}
            activities={activities}
            batches={props.batches}
            tasks={props.tasks}
            now={now}
            onChange={update}
          />
        )}
      </div>

      <ClientModal
        state={editing ? { mode: "edit", client } : null}
        onClose={() => setEditing(false)}
        onSubmit={(v) => void saveClient(v)}
        saving={savingClient}
      />
      <TaskModal
        state={creatingTask ? { mode: "create", client: client.name } : null}
        onClose={() => setCreatingTask(false)}
        onSubmit={(v) => void createTask(v)}
        saving={savingTask}
      />
    </Screen>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-mark border border-panel-ring bg-surface-2 text-fg-3 transition-colors hover:bg-border hover:text-fg-soft disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
