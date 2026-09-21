import { LEGACY_AGENCY_ID } from "@/lib/agency/id";
import type { Client, ClientStatus } from "./types";

type SeedRow = {
  id: string;
  name: string;
  segment: string;
  services: string[];
  owner: string;
  billingDay: number;
  status: ClientStatus;
};

/**
 * A carteira do export "Clientes · Painel" — mesmos nomes, segmentos,
 * serviços, responsáveis, dias de faturamento e status do desenho. Vale a
 * mesma regra do `tasks/seed.ts`: é o que faz a tela abrir viva na primeira
 * execução, e nenhum dado aqui foi inventado por fora do desenho.
 */
const ROWS: SeedRow[] = [
  { id: "c01", name: "Auto Peças União", segment: "Automotivo", services: ["Google Ads"], owner: "Marcos", billingDay: 12, status: "pausado" },
  { id: "c02", name: "Bela Vita Odonto", segment: "Odontologia", services: ["Instagram", "Blog", "E-mail"], owner: "Camila", billingDay: 20, status: "ativo" },
  { id: "c03", name: "Café Raízes", segment: "Alimentação", services: ["Instagram", "Influencers"], owner: "Fernanda", billingDay: 8, status: "risco" },
  { id: "c04", name: "Casa Bloom", segment: "Decoração", services: ["Pinterest", "Blog"], owner: "Juliana", billingDay: 3, status: "ativo" },
  { id: "c05", name: "Clínica Aurora", segment: "Estética facial", services: ["Instagram", "Blog", "Meta Ads"], owner: "Fernanda", billingDay: 5, status: "ativo" },
  { id: "c06", name: "Doce Lar Imóveis", segment: "Imobiliária", services: ["Meta Ads", "Site"], owner: "Rafael", billingDay: 25, status: "novo" },
  { id: "c07", name: "Fit Prime", segment: "Academia", services: ["Instagram", "TikTok"], owner: "Marcos", billingDay: 10, status: "ativo" },
  { id: "c08", name: "Grupo Ventura", segment: "Varejo de moda", services: ["Facebook Ads", "Google Ads"], owner: "Marcos", billingDay: 10, status: "risco" },
  { id: "c09", name: "Lex Advogados", segment: "Jurídico", services: ["LinkedIn", "Blog"], owner: "Camila", billingDay: 15, status: "renovacao" },
  { id: "c10", name: "Mar Azul Turismo", segment: "Turismo", services: ["Instagram", "E-mail", "Site", "Blog"], owner: "Juliana", billingDay: 18, status: "ativo" },
  { id: "c11", name: "Nutrindo Bem", segment: "Nutrição clínica", services: ["Instagram", "TikTok"], owner: "Fernanda", billingDay: 15, status: "ativo" },
  { id: "c12", name: "Óptica Lumen", segment: "Óptica", services: ["Google Ads", "Site"], owner: "Rafael", billingDay: 22, status: "novo" },
  { id: "c13", name: "Pet Vida", segment: "Pet shop", services: ["Instagram", "Blog"], owner: "Juliana", billingDay: 7, status: "ativo" },
  { id: "c14", name: "Studio Raiz", segment: "Arquitetura", services: ["Site", "SEO", "Blog", "Pinterest"], owner: "Camila", billingDay: 1, status: "renovacao" },
  { id: "c15", name: "Tech Norte", segment: "Tecnologia", services: ["LinkedIn", "Ads", "Site"], owner: "Rafael", billingDay: 28, status: "vip" },
  { id: "c16", name: "Vértice Contábil", segment: "Contabilidade", services: ["Site", "E-mail"], owner: "Marcos", billingDay: 30, status: "pausado" },
];

export function seedClients(): Client[] {
  const base = new Date("2026-09-01T09:00:00.000Z").getTime();
  return ROWS.map((row, i) => ({
    ...row,
    // A demonstração é da agência semeada — a que abre o app na primeira vez.
    agencyId: LEGACY_AGENCY_ID,
    createdAt: new Date(base + i * 3_600_000).toISOString(),
  }));
}
