/*
 * O domínio da agência (`@estudionorte.com`): quem se cadastra com um e-mail
 * dele ganha um convite automático para o time — que entra como pedido e
 * precisa da aprovação de um Admin ou Gerente (ver `requestJoin`).
 *
 * Por que aprovação, e não entrada direta: o produto não confirma e-mail.
 * Sem isso, qualquer um que digitasse `algo@estudionorte.com` no cadastro
 * leria os clientes da agência. O convite automático poupa o trabalho de
 * convidar um por um; a aprovação é o clique que confirma que a pessoa é
 * mesmo do time.
 *
 * Funções puras, testadas em `tests/inbox-domain.test.ts`.
 */

/** Domínios de e-mail pessoal: nenhum deles identifica uma agência. */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "ig.com.br",
]);

/** "@EstudioNorte.com " → "estudionorte.com"; o que não parece domínio vira "". */
export function normalizeDomain(raw: string): string {
  const d = raw.trim().toLowerCase().replace(/^.*@/, "").replace(/^\.+|\.+$/g, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : "";
}

/** O domínio de um e-mail, normalizado. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : normalizeDomain(email.slice(at + 1));
}

/**
 * O domínio pode ser o da agência? Devolve a mensagem de erro, ou `null`.
 * Quem configura precisa ter e-mail nele — é a única prova de posse que o
 * produto consegue pedir sem mandar e-mail.
 */
export function domainProblem(domain: string, adminEmail: string): string | null {
  if (!domain) return "Isso não parece um domínio (ex.: estudionorte.com).";
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return `${domain} é de e-mail pessoal — use o domínio próprio da agência.`;
  }
  if (emailDomain(adminEmail) !== domain) {
    return `Só dá para usar um domínio do seu próprio e-mail (o seu é @${emailDomain(adminEmail) || "?"}).`;
  }
  return null;
}
