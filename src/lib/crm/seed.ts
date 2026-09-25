import { LEGACY_AGENCY_ID } from "@/lib/agency/id";
import { NO_CONTRACT } from "./defaults";
import type { ClientAccount, ClientService, Invoice, PaymentKind } from "./types";

/*
 * A ficha que o export "Clientes · Detalhe" desenha por inteiro: a Clínica
 * Aurora (`c05` no seed de clientes), com os cinco serviços, o contrato, o
 * cartão, o histórico de faturas e a agenda do desenho. Os outros clientes
 * abrem com a ficha em branco — o desenho não mostra a deles.
 *
 * As datas do desenho são de 2024; aqui elas andam junto com o dia em que o
 * seed roda (a próxima fatura é a do mês que vem, as pagas são as dos meses
 * anteriores), senão a demonstração já nasceria com fatura atrasada. Os
 * responsáveis do desenho (Marcos, Fernanda, Juliana) não existem no time
 * semeado; cada serviço vai para alguém do squad da Aurora (Ana, Marina,
 * Felipe), e o e-mail marketing fica com a Camila, como no desenho. Arquivo
 * nenhum é semeado: arquivo de mentira quebraria no download.
 */

function service(row: Omit<ClientService, "createdAt" | "deliveredMonth"> & { thisMonth?: boolean }, now: Date): ClientService {
  const { thisMonth = true, ...rest } = row;
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return { ...rest, deliveredMonth: thisMonth ? month : "", createdAt: now.toISOString() };
}

function monthOffset(now: Date, delta: number): Date {
  return new Date(now.getFullYear(), now.getMonth() + delta, 1);
}

function key(d: Date, day?: number): string {
  const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return day ? `${m}-${String(day).padStart(2, "0")}` : m;
}

function invoice(now: Date, delta: number, cents: number, method: PaymentKind, paid: boolean): Invoice {
  const month = monthOffset(now, delta);
  const created = new Date(month.getFullYear(), month.getMonth() - 1, 25, 9);
  return {
    id: `inv-${key(month)}`,
    competence: key(month),
    dueDate: key(month, 5),
    amount: cents,
    method,
    status: paid ? "pago" : "aberto",
    paidAt: paid ? new Date(month.getFullYear(), month.getMonth(), 4, 11, 5).toISOString() : null,
    createdAt: created.toISOString(),
  };
}

export function seedAccounts(now: Date = new Date()): ClientAccount[] {
  const at = (days: number, h: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h);
    return d.toISOString();
  };
  const start = monthOffset(now, -20);
  return [
    {
      clientId: "c05",
      agencyId: LEGACY_AGENCY_ID,
      contract: {
        ...NO_CONTRACT,
        startDate: key(start, 1),
        fidelityMonths: 12,
        cycle: "mensal",
        adjustmentIndex: "IPCA",
      },
      payment: { kind: "cartao", brand: "Visa", last4: "4821", expires: "08/28" },
      services: [
        service({ id: "s-instagram", name: "Gestão de Instagram", kind: "instagram", scope: "12 posts + stories", responsibleId: "marina", monthlyValue: 320000, status: "ativo", quota: 12, unit: "posts", delivered: 10, stage: "" }, now),
        service({ id: "s-blog", name: "Blog & SEO", kind: "blog", scope: "4 artigos/mês", responsibleId: "ana", monthlyValue: 210000, status: "ativo", quota: 4, unit: "artigos", delivered: 3, stage: "" }, now),
        service({ id: "s-trafego", name: "Tráfego pago", kind: "trafego", scope: "Meta Ads · R$ 5k", responsibleId: "felipe", monthlyValue: 240000, status: "ativo", quota: null, unit: "", delivered: 0, stage: "Em veiculação" }, now),
        service({ id: "s-producao", name: "Produção de conteúdo", kind: "producao", scope: "1 diária/mês", responsibleId: "ana", monthlyValue: 80000, status: "setup", quota: null, unit: "", delivered: 0, stage: "Agendada" }, now),
        service({ id: "s-email", name: "E-mail marketing", kind: "email", scope: "2 campanhas/mês", responsibleId: "camila", monthlyValue: 0, status: "pausado", quota: null, unit: "", delivered: 0, stage: "Pausado p/ ajuste", thisMonth: false }, now),
      ],
      invoices: [
        invoice(now, 1, 850000, "pix", false),
        invoice(now, 0, 850000, "cartao", true),
        invoice(now, -1, 850000, "cartao", true),
        invoice(now, -2, 790000, "boleto", true),
        invoice(now, -3, 790000, "cartao", true),
        invoice(now, -4, 790000, "cartao", true),
      ],
      files: [],
      events: [
        { id: "ev-planejamento", kind: "reuniao", title: "Reunião de planejamento mensal", at: at(-3, 15), place: "Online", createdBy: "Felipe", createdAt: at(-10, 9) },
        { id: "ev-gravacao", kind: "gravacao", title: "Gravação de conteúdo", at: at(13, 14), place: "Estúdio", createdBy: "Ana", createdAt: at(-2, 10) },
        { id: "ev-resultados", kind: "reuniao", title: "Reunião de resultados", at: at(19, 10), place: "Online", createdBy: "Felipe", createdAt: at(-2, 10) },
      ],
    },
  ];
}
