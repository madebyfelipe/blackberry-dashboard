import { redirect } from "next/navigation";
import { redirectWithoutScope } from "@/lib/auth/session";
import { listBatches } from "@/lib/approval/repository";
import { listClients } from "@/lib/clients/repository";
import { listAccounts } from "@/lib/crm/repository";
import {
  agenda,
  approvalStats,
  deliveryStats,
  financeStats,
  operationStats,
  portfolioStats,
  recentMonths,
  teamStats,
  type DashboardInput,
} from "@/lib/dashboard/metrics";
import { monthKey } from "@/lib/crm/view";
import { listMembers } from "@/lib/inbox/repository";
import { canManageTeam, canSeeDashboard, canSeeFinance } from "@/lib/inbox/users";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { listTasks } from "@/lib/tasks/repository";
import { AgencyDashboard } from "@/components/settings/AgencyDashboard";
import type { SettingsTab } from "@/components/settings/kit";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configurações · Painel da agência" };

/*
 * Configurações › Painel da agência. Admin e Gerente veem; o Financeiro
 * também, porque o bloco de dinheiro é dele. Os números de dinheiro só são
 * calculados (e só saem do servidor) para Admin e Financeiro — o Gerente vê
 * o bloco trancado, sem valor nenhum no HTML.
 *
 * Os filtros moram na URL (`?mes=2026-09&cliente=<id>&pessoa=<nome>`): o link
 * do painel filtrado pode ser mandado para alguém.
 */
export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cliente?: string; pessoa?: string }>;
}) {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  if (!canSeeDashboard(session.me)) redirect("/configuracoes");

  const now = new Date();
  const params = await searchParams;
  const months = recentMonths(now);
  const month = params.mes && months.includes(params.mes) ? params.mes : monthKey(now);

  const [tasks, batches, clients, accounts, members] = await Promise.all([
    listTasks(session.scope),
    listBatches(session.scope),
    listClients(session.scope),
    listAccounts(session.scope),
    listMembers(session.scope),
  ]);
  const clientId = clients.some((c) => c.id === params.cliente) ? params.cliente! : null;
  const people = [...new Set(tasks.map((t) => t.assignee.trim()).filter((n) => n && n !== "—"))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const person = params.pessoa && people.includes(params.pessoa) ? params.pessoa : null;

  const input: DashboardInput = { tasks, batches, clients, accounts, members, month, clientId, person, now };
  const finance = canSeeFinance(session.me) ? financeStats(input) : null;
  const tabs: SettingsTab[] = [...(canManageTeam(session.me) ? (["agencia"] as const) : []), "painel"];

  return (
    <AgencyDashboard
      tabs={tabs}
      now={now.toISOString()}
      filters={{ month, clientId, person }}
      options={{
        months,
        clients: clients.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        people,
      }}
      operation={operationStats(input)}
      approval={approvalStats(input)}
      finance={finance}
      portfolio={portfolioStats(input)}
      delivery={deliveryStats(input)}
      team={teamStats(members)}
      agenda={agenda(input)}
      canManageTeam={canManageTeam(session.me)}
      memberPhotos={Object.fromEntries(members.filter((m) => m.photoUrl).map((m) => [m.name, m.photoUrl!]))}
    />
  );
}
