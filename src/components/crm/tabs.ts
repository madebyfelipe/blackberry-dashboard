/** As abas da ficha do cliente, na ordem do export. Sem "use client": a página (servidor) também lê. */
export type DetailTab = "visao" | "servicos" | "financeiro" | "arquivos" | "atividades";

export const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "visao", label: "Visão geral" },
  { id: "servicos", label: "Serviços" },
  { id: "financeiro", label: "Financeiro" },
  { id: "arquivos", label: "Arquivos" },
  { id: "atividades", label: "Atividades" },
];

export function isDetailTab(v: unknown): v is DetailTab {
  return DETAIL_TABS.some((t) => t.id === v);
}
