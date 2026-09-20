import { batchProgress } from "./constants";
import type { Batch } from "./types";

/*
 * O cliente do fluxo de aprovação.
 *
 * Ele ainda não é entidade: o lote guarda o nome como texto livre
 * (`batch.client`), e é desse texto que sai tudo aqui. É o suficiente para o
 * primeiro passo do fluxo — escolher de quem são os lotes — sem esperar a
 * ficha do cliente da Fase 3 (contrato, valor, health score), que é quem vai
 * trazer o id de verdade.
 *
 * Quando o id existir, é este arquivo que sai: as telas falam com
 * `ClientSummary`, não com `batch.client`.
 */

export type ClientSummary = {
  /** Nome como o lote o guarda — texto livre, do jeito que a agência digitou. */
  name: string;
  /** Pedaço de URL (`/social/clinica-aurora`). */
  slug: string;
  /** Marca do card: até duas letras. */
  initials: string;
  lotes: number;
  pecas: number;
  pendentes: number;
};

/** Texto qualquer → pedaço de URL: sem acento, sem maiúscula, sem espaço. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "Clínica Aurora" → "CA"; "Montê bar" → "MB"; "aurora" → "A". */
export function clientInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.slice(0, 2).map((w) => w.charAt(0));
  return letters.join("").toUpperCase();
}

/**
 * Um card por cliente, com o que o card mostra: quantos lotes, quantas peças e
 * quantas ainda esperam o cliente decidir.
 *
 * Agrupa pelo slug, e não pelo texto cru: "Montê bar" e "montê bar" são o
 * mesmo cliente para quem está olhando a tela, e seriam dois cards se o
 * agrupamento fosse literal. O nome exibido é o do lote mais antigo do grupo —
 * o primeiro jeito de escrever que a agência usou.
 */
export function listClientSummaries(batches: Batch[]): ClientSummary[] {
  const groups = new Map<string, { name: string; batches: Batch[] }>();

  for (const batch of batches) {
    const slug = slugify(batch.client);
    if (!slug) continue;
    const group = groups.get(slug);
    if (group) group.batches.push(batch);
    else groups.set(slug, { name: batch.client, batches: [batch] });
  }

  return [...groups.entries()]
    .map(([slug, group]) => {
      const progress = group.batches.map(batchProgress);
      return {
        name: group.name,
        slug,
        initials: clientInitials(group.name),
        lotes: group.batches.length,
        pecas: progress.reduce((sum, p) => sum + p.total, 0),
        pendentes: progress.reduce((sum, p) => sum + p.pendentes, 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Os lotes de um cliente, na ordem em que o repositório os devolve. */
export function batchesOfClient(batches: Batch[], slug: string): Batch[] {
  return batches.filter((b) => slugify(b.client) === slug);
}

/** O nome a exibir para um slug — `undefined` quando a agência não tem esse cliente. */
export function clientNameFromSlug(
  batches: Batch[],
  slug: string,
): string | undefined {
  return batches.find((b) => slugify(b.client) === slug)?.client;
}
