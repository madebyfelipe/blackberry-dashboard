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

/**
 * Domínios de e-mail pessoal: nenhum deles identifica uma agência. Quem se
 * cadastra com um deles pode ser qualquer pessoa, então nenhum vira domínio
 * do convite automático (issue #92).
 */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "hotmail.co.uk",
  "hotmail.es",
  "hotmail.fr",
  "outlook.com",
  "outlook.com.br",
  "outlook.es",
  "outlook.pt",
  "live.com",
  "live.co.uk",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "yahoo.co.uk",
  "yahoo.es",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "tutanota.com",
  "tuta.io",
  "fastmail.com",
  "hey.com",
  "zoho.com",
  "zohomail.com",
  "yandex.com",
  "yandex.ru",
  "mail.com",
  "mail.ru",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "web.de",
  "qq.com",
  "163.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
  "globomail.com",
  "r7.com",
  "zipmail.com.br",
  "oi.com.br",
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
 * Alguém de **outra** agência já usa este domínio no e-mail? Então ele não é
 * só desta, e o convite automático não pode ser dela: com o primeiro a
 * reivindicar levando o domínio inteiro, bastaria a um estranho cadastrar
 * `qualquer@bigcorp.com` para puxar para a agência dele quem chegasse depois
 * com o e-mail da BigCorp (issue #92).
 */
export function domainUsedElsewhere(
  domain: string,
  agencyId: string,
  members: { agencyId: string; email: string }[],
): boolean {
  return members.some((m) => m.agencyId !== agencyId && emailDomain(m.email) === domain);
}

/**
 * O domínio pode ser o da agência? Devolve a mensagem de erro, ou `null`.
 * Quem configura precisa ter e-mail nele — é a única prova de posse que o
 * produto consegue pedir sem mandar e-mail, e é fraca: o cadastro não confirma
 * o e-mail. A prova de verdade (confirmação por e-mail ou TXT no DNS) espera
 * o provedor de e-mail (issues #13 e #92); até lá, `setTeamDomain` também
 * recusa domínio que já tem gente em outra agência (`domainUsedElsewhere`).
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
