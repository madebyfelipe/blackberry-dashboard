/*
 * Cache das URLs assinadas do Blob privado (issue #39).
 *
 * Cada imagem na tela passa por `GET /api/media/<id>`, que redireciona para
 * uma URL assinada. Assinar não é de graça: `issueSignedToken` é um POST na
 * API do Blob. E, com uma URL nova a cada pedido, o navegador nunca reusava a
 * imagem que já tinha baixado — abrir um lote de 20 peças eram 20 funções, 20
 * idas à API do Blob e 20 downloads inteiros, toda vez que a tela voltava.
 *
 * Aqui a URL de cada pathname é reaproveitada enquanto ainda tem folga de
 * validade, e pedidos simultâneos do mesmo pathname esperam a mesma
 * assinatura. Quem chama recebe também até quando a URL vale, para dizer ao
 * navegador por quanto tempo guardar o redirect (e, com ele, a imagem).
 */

export type Signed = { url: string; validUntil: number };

export type SignedCacheOptions = {
  /** Validade de cada URL assinada. */
  ttlMs: number;
  /** Abaixo desta folga a URL não é mais entregue: assina-se outra. */
  minRemainingMs: number;
  /** Teto de entradas — as mais antigas saem primeiro. */
  maxEntries: number;
};

export function createSignedUrlCache(
  sign: (pathname: string, validUntil: number) => Promise<string>,
  { ttlMs, minRemainingMs, maxEntries }: SignedCacheOptions,
) {
  const entries = new Map<string, Promise<Signed>>();
  const settled = new Map<string, Signed>();

  return async function get(pathname: string, now = Date.now()): Promise<Signed> {
    const ready = settled.get(pathname);
    if (ready && ready.validUntil - now >= minRemainingMs) {
      // Reinsere no fim: a ordem do Map vira a ordem de uso.
      const hit = entries.get(pathname)!;
      entries.delete(pathname);
      entries.set(pathname, hit);
      return ready;
    }

    const inFlight = entries.get(pathname);
    if (inFlight && !ready) return inFlight;

    const validUntil = now + ttlMs;
    const pending = sign(pathname, validUntil).then(
      (url) => {
        const value = { url, validUntil };
        if (entries.get(pathname) === pending) settled.set(pathname, value);
        return value;
      },
      (err) => {
        if (entries.get(pathname) === pending) entries.delete(pathname);
        throw err;
      },
    );

    entries.delete(pathname);
    settled.delete(pathname);
    entries.set(pathname, pending);
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value as string;
      entries.delete(oldest);
      settled.delete(oldest);
    }
    return pending;
  };
}

/**
 * Por quanto tempo, em segundos, o navegador pode guardar o redirect para
 * `signed`: o que falta da validade menos uma margem, para a imagem nunca ser
 * pedida com uma URL que expira no meio do download.
 */
export function redirectMaxAge(signed: Signed, marginMs: number, now = Date.now()): number {
  return Math.max(0, Math.floor((signed.validUntil - now - marginMs) / 1000));
}
