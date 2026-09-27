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
 * A tentativa conta **antes** de a senha ser conferida (`reserve`), para
 * que requisições em paralelo também esbarrem no limite.
 *
 * Função pura sobre um mapa injetável, testada em `tests/auth-attempts.test.ts`.
 * O link público de aprovação usa o mesmo freio, com outro teto (`limits`).
 */

export const MAX_ATTEMPTS = 8;
export const WINDOW_MS = 10 * 60_000;

type Entry = { count: number; since: number };

export function createAttempts(
  now: () => number = Date.now,
  limits: { max: number; windowMs: number } = { max: MAX_ATTEMPTS, windowMs: WINDOW_MS },
) {
  const map = new Map<string, Entry>();

  function live(key: string): Entry | undefined {
    const e = map.get(key);
    if (e && now() - e.since > limits.windowMs) {
      map.delete(key);
      return undefined;
    }
    return e;
  }

  function blockedFor(key: string): number {
    const e = live(key);
    if (!e || e.count < limits.max) return 0;
    return Math.ceil((limits.windowMs - (now() - e.since)) / 1000);
  }

  return {
    /** Segundos até poder tentar de novo; 0 = pode. */
    blockedFor,
    /**
     * Confere o freio e, se liberado, já conta a tentativa — tudo síncrono,
     * antes de qualquer `await` da rota. Contar só depois de conferir a senha
     * deixava N requisições paralelas passarem pelo freio antes de a primeira
     * errar: cada uma testava uma senha e o limite não segurava nada.
     *
     * Devolve os segundos de bloqueio (> 0, sem contar) ou 0 com a vaga
     * reservada. Quem acerta chama `succeed`; erro de senha não faz nada
     * (a vaga já contou); falha que não é da pessoa devolve com `release`.
     */
    reserve(key: string): number {
      const wait = blockedFor(key);
      if (wait > 0) return wait;
      const e = live(key);
      if (e) e.count++;
      else map.set(key, { count: 1, since: now() });
      // O mapa não cresce sem fim: limpa o que já venceu de tempos em tempos.
      if (map.size > 5000) for (const k of [...map.keys()]) live(k);
      return 0;
    },
    /** Devolve uma vaga reservada — a tentativa não chegou a testar a senha. */
    release(key: string) {
      const e = live(key);
      if (!e) return;
      if (e.count <= 1) map.delete(key);
      else e.count--;
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
