import { Pool, type PoolClient } from "pg";

/*
 * Store de Postgres — mesma interface de `lib/store/json-file.ts`
 * (`read`/`transaction`), trocando arquivo por linha de banco. Ver
 * `lib/store/index.ts`: é ele quem decide, por `DATABASE_URL`, qual dos dois
 * usar — nenhum `store.ts` de área fala com este arquivo direto.
 *
 * Cada área guarda o `T` inteiro (o mesmo JSON que ia para o arquivo) numa
 * única linha `kv_store`, coluna `jsonb`. É o menor passo que tira a
 * dependência do disco: sem reescrever `repository.ts` nem view nenhuma,
 * exatamente como o issue pede. Multi-tenant continua filtrado em
 * `repository.ts`; RLS por linha só faz sentido quando cada área virar tabela
 * própria — fica para depois, junto da migração de schema de verdade.
 *
 * `transaction` tranca a linha (`SELECT ... FOR UPDATE`) para a leitura e a
 * escrita dentro da mesma conexão: dois workers do `next start` mutando ao
 * mesmo tempo esperam a vez um do outro, em vez da corrida que o mtime do
 * arquivo só detectava depois do fato.
 */

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS kv_store (
           key TEXT PRIMARY KEY,
           data JSONB NOT NULL,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      )
      .then(() => undefined);
  }
  return schemaReady;
}

type Queryable = Pick<Pool | PoolClient, "query">;

export function createPostgresStore<T>(options: {
  /** Linha desta área dentro de `kv_store` (ex.: "tasks"). */
  key: string;
  seed: () => T;
  revive?: (raw: unknown) => T;
}) {
  function parse(raw: unknown): T {
    return options.revive ? options.revive(raw) : (raw as T);
  }

  /** Lê a linha; semeia (com `ON CONFLICT DO NOTHING`) se ainda não existir. */
  async function load(client: Queryable, forUpdate: boolean): Promise<T> {
    const { rows } = await client.query(
      `SELECT data FROM kv_store WHERE key = $1${forUpdate ? " FOR UPDATE" : ""}`,
      [options.key],
    );
    if (rows.length > 0) return parse(rows[0].data);

    const seeded = options.seed();
    await client.query(
      `INSERT INTO kv_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [options.key, JSON.stringify(seeded)],
    );
    if (!forUpdate) return seeded;
    // Dentro da transação, outra conexão pode ter semeado primeiro: relê sob o lock.
    const { rows: after } = await client.query(
      `SELECT data FROM kv_store WHERE key = $1 FOR UPDATE`,
      [options.key],
    );
    return after.length > 0 ? parse(after[0].data) : seeded;
  }

  /*
   * O último valor lido, com a versão da linha (`updated_at` em texto, exato
   * até o microssegundo). A leitura sempre pergunta a versão ao banco — então
   * continua valendo entre instâncias —, mas só traz e revive o JSON inteiro
   * quando ela mudou. Uma tela lê a mesma área várias vezes (sessão, acesso,
   * time…); antes, cada leitura transferia e reprocessava o arquivo todo.
   * Quem recebe ganha uma cópia, como no store de arquivo: mexer no retorno
   * não pode estragar o que está guardado.
   */
  let cached: { version: string; value: T } | null = null;

  async function readCached(): Promise<T> {
    const { rows } = await getPool().query(
      `SELECT updated_at::text AS version,
              CASE WHEN updated_at::text = $2 THEN NULL ELSE data END AS data
         FROM kv_store WHERE key = $1`,
      [options.key, cached?.version ?? ""],
    );
    if (rows.length === 0) return load(getPool(), false);
    const row = rows[0] as { version: string; data: unknown };
    if (row.data === null && cached && cached.version === row.version) {
      return structuredClone(cached.value);
    }
    const value = parse(row.data);
    cached = { version: row.version, value };
    return structuredClone(value);
  }

  return {
    async read(): Promise<T> {
      await ensureSchema();
      return readCached();
    },

    async transaction<R>(mutate: (data: T) => R): Promise<R> {
      await ensureSchema();
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        const data = await load(client, true);
        const result = mutate(data);
        await client.query(
          `UPDATE kv_store SET data = $2, updated_at = now() WHERE key = $1`,
          [options.key, JSON.stringify(data)],
        );
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
