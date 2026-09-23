/*
 * Freio de tentativas do login: depois de `MAX` erros para o mesmo e-mail
 * vindos do mesmo IP numa janela de `WINDOW_MS`, a rota responde 429 até a
 * janela passar. Sem isso, dava para testar senhas sem limite.
 *
 * Fica na memória da instância — na Vercel, cada instância conta por si,
 * então é um freio parcial (sobe o custo do ataque, não o impede). O
 * definitivo mora no firewall da plataforma; isto fecha o caso óbvio sem
 * depender de configuração.
 *
 * Função pura sobre um mapa injetável, testada em `tests/auth-attempts.test.ts`.
 */

export const MAX_ATTEMPTS = 8;
export const WINDOW_MS = 10 * 60_000;

type Entry = { count: number; since: number };

export function createAttempts(now: () => number = Date.now) {
  const map = new Map<string, Entry>();

  function live(key: string): Entry | undefined {
    const e = map.get(key);
    if (e && now() - e.since > WINDOW_MS) {
      map.delete(key);
      return undefined;
    }
    return e;
  }

  return {
    /** Segundos até poder tentar de novo; 0 = pode. */
    blockedFor(key: string): number {
      const e = live(key);
      if (!e || e.count < MAX_ATTEMPTS) return 0;
      return Math.ceil((WINDOW_MS - (now() - e.since)) / 1000);
    },
    fail(key: string) {
      const e = live(key);
      if (e) e.count++;
      else map.set(key, { count: 1, since: now() });
      // O mapa não cresce sem fim: limpa o que já venceu de tempos em tempos.
      if (map.size > 5000) for (const k of [...map.keys()]) live(k);
    },
    succeed(key: string) {
      map.delete(key);
    },
  };
}

/** A chave: e-mail normalizado + IP de quem pede. */
export function attemptKey(email: string, ip: string | null): string {
  return `${email.trim().toLowerCase()}|${ip ?? "?"}`;
}
