import { promises as fs } from "node:fs";
import path from "node:path";

/*
 * Store de arquivo JSON — a base dos `store.ts` de tarefas, aprovação, contas
 * e índice de mídia. O app continua falando só com `repository.ts`, que fala
 * só com o `store.ts` da sua área; o que muda aqui muda para todos.
 *
 * Duas coisas que a versão anterior (uma cópia por área) não fazia:
 *
 * 1. Revalidar pelo mtime. O `next start` roda mais de um worker: quem grava
 *    (route handler) e quem renderiza a tela podem ser processos diferentes.
 *    Com o cache preso na memória, o segundo servia dados velhos — uma arte
 *    recém-enviada sumia da grade do lote. Agora toda leitura confere o mtime
 *    do arquivo e relê quando ele mudou.
 *
 * 2. Reler dentro da transação, pelo mesmo motivo: a gravação parte do estado
 *    atual do disco, não do que este processo viu por último.
 *
 * Segue valendo o modo memória para disco somente-leitura (serverless): sem
 * conseguir gravar, o processo passa a ser a fonte da verdade — e é por isso
 * que o próximo passo do roadmap é trocar este módulo por um banco.
 */

const DATA_DIR = path.join(process.cwd(), "data");

export type JsonStore<T> = {
  /** Cópia do estado atual — nunca a estrutura viva. */
  read(): Promise<T>;
  /**
   * Seção crítica em processo: `mutate` recebe o estado vivo e o que ele
   * devolver volta para quem chamou; a gravação acontece depois.
   */
  transaction<R>(mutate: (data: T) => R): Promise<R>;
};

export function createJsonStore<T>(options: {
  /** Nome do arquivo dentro de `data/` (ex.: "tasks.json"). */
  file: string;
  /** Estado inicial quando o arquivo ainda não existe. */
  seed: () => T;
  /** Migração de leitura — campos novos em arquivos antigos. */
  revive?: (raw: unknown) => T;
}): JsonStore<T> {
  const filePath = path.join(DATA_DIR, options.file);

  let cache: T | null = null;
  let cacheMtimeMs: number | null = null;
  let canPersist = true;

  async function mtime(): Promise<number | null> {
    try {
      return (await fs.stat(filePath)).mtimeMs;
    } catch {
      return null;
    }
  }

  async function persist(data: T): Promise<void> {
    if (!canPersist) return;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = filePath + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
      await fs.rename(tmp, filePath);
      cacheMtimeMs = await mtime();
    } catch {
      // Disco somente-leitura: daqui em diante vale a memória do processo.
      canPersist = false;
    }
  }

  async function load(): Promise<T> {
    // Sem disco, o cache é tudo o que existe.
    if (!canPersist && cache) return cache;

    const current = await mtime();
    if (cache !== null && current !== null && current === cacheMtimeMs) {
      return cache;
    }

    if (current === null) {
      // Arquivo ainda não existe: semeia (e grava, se der).
      if (cache !== null) return cache;
      cache = options.seed();
      await persist(cache);
      return cache;
    }

    try {
      const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
      cache = options.revive ? options.revive(raw) : (raw as T);
      cacheMtimeMs = current;
    } catch {
      // Arquivo ilegível (corrompido ou gravação a meio caminho): mantém o que
      // já estava em memória em vez de zerar os dados de quem está usando.
      if (cache === null) {
        cache = options.seed();
        await persist(cache);
      }
    }
    return cache;
  }

  let chain: Promise<unknown> = Promise.resolve();

  function transaction<R>(mutate: (data: T) => R): Promise<R> {
    const run = async (): Promise<R> => {
      const data = await load();
      const result = mutate(data);
      await persist(data);
      return result;
    };
    const next = chain.then(run, run);
    chain = next.catch(() => undefined);
    return next;
  }

  return {
    async read() {
      return structuredClone(await load());
    },
    transaction,
  };
}
