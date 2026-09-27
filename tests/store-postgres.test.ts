import assert from "node:assert/strict";
import { createServer, type AddressInfo, type Socket } from "node:net";
import test, { describe } from "node:test";

/*
 * Verificações do backend de Postgres (issue #11). Sem `DATABASE_URL` o CI
 * pula o primeiro bloco — nenhum teste da suíte depende de banco — mas
 * quem tiver um Postgres à mão (`DATABASE_URL=postgres://...`) pode rodar
 * `npm test` e validar o `createPostgresStore` de verdade, inclusive o lock
 * de linha (`SELECT ... FOR UPDATE`) que substitui a checagem por mtime do
 * arquivo. O segundo bloco (queda de conexão, issue #75) roda sempre, contra
 * um servidor falso.
 */
const DATABASE_URL = process.env.DATABASE_URL;

describe("createPostgresStore", { skip: !DATABASE_URL && "requer DATABASE_URL" }, async () => {
  const { createPostgresStore } = await import("../src/lib/store/postgres");

  function novaChave(): string {
    return `teste-${Math.random().toString(36).slice(2)}`;
  }

  await test("semeia na primeira leitura", async () => {
    const store = createPostgresStore<{ n: number }>({
      key: novaChave(),
      seed: () => ({ n: 0 }),
    });
    assert.deepEqual(await store.read(), { n: 0 });
  });

  await test("transaction muta e persiste", async () => {
    const store = createPostgresStore<{ n: number }>({
      key: novaChave(),
      seed: () => ({ n: 0 }),
    });
    await store.transaction((data) => {
      data.n += 1;
    });
    assert.deepEqual(await store.read(), { n: 1 });
  });

  await test("read() nunca devolve a referência viva", async () => {
    const store = createPostgresStore<{ items: string[] }>({
      key: novaChave(),
      seed: () => ({ items: [] }),
    });
    const lido = await store.read();
    lido.items.push("mutação local");
    assert.deepEqual((await store.read()).items, []);
  });

  await test("transactions concorrentes não perdem update (lock de linha)", async () => {
    const store = createPostgresStore<{ items: string[] }>({
      key: novaChave(),
      seed: () => ({ items: [] }),
    });
    await Promise.all(
      Array.from({ length: 20 }, () =>
        store.transaction((data) => {
          data.items.push("x");
        }),
      ),
    );
    assert.equal((await store.read()).items.length, 20);
  });

  /*
   * Issue #75, contra o banco de verdade: o servidor derrubando as conexões do
   * app (o que o Neon faz ao suspender o compute) não pode encerrar o processo,
   * e a próxima leitura abre conexão nova sozinha.
   */
  await test("conexões derrubadas pelo servidor não encerram o processo", async (t) => {
    const logado = t.mock.method(console, "error", () => undefined);
    const store = createPostgresStore<{ n: number }>({
      key: novaChave(),
      seed: () => ({ n: 7 }),
    });
    await store.read(); // deixa conexão ociosa no pool

    const { Client } = await import("pg");
    const admin = new Client({ connectionString: DATABASE_URL });
    await admin.connect();
    try {
      const { rows } = await admin.query(
        `SELECT pg_terminate_backend(pid) AS ok FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid()
            AND backend_type = 'client backend'`,
      );
      assert.ok(rows.length > 0, "havia conexão do app para derrubar");
    } finally {
      await admin.end();
    }
    await new Promise((r) => setTimeout(r, 200));

    assert.ok(logado.mock.callCount() > 0, "a queda foi registrada no log");
    assert.deepEqual(await store.read(), { n: 7 }, "e a leitura seguinte reconecta");
  });
});

/*
 * Issue #75 sem depender de banco — roda também no CI. Um servidor falso fala o
 * mínimo do protocolo do Postgres (autenticação sem senha e "tudo certo, zero
 * linhas" para qualquer consulta): basta para o `pg` abrir conexão, rodar o
 * `CREATE TABLE` do `ensureSchema` e devolver o cliente ao pool, ocioso.
 */
type ServidorFalso = {
  porta: number;
  /** SQL de cada consulta recebida, na ordem. */
  consultas: string[];
  /** Fecha as conexões abertas, como o Neon ao suspender o compute. */
  derrubarConexoes(): void;
  fechar(): Promise<void>;
};

function mensagem(tipo: string, corpo: Buffer = Buffer.alloc(0)): Buffer {
  const cabecalho = Buffer.alloc(5);
  cabecalho.write(tipo, 0, "latin1");
  cabecalho.writeInt32BE(corpo.length + 4, 1);
  return Buffer.concat([cabecalho, corpo]);
}

const PRONTO = mensagem("Z", Buffer.from("I"));
const RESPOSTAS: Record<string, Buffer> = {
  Q: Buffer.concat([mensagem("C", Buffer.from("OK\0")), PRONTO]), // consulta simples
  P: mensagem("1"), // Parse
  B: mensagem("2"), // Bind
  D: mensagem("n"), // Describe → sem linhas
  E: mensagem("C", Buffer.from("OK\0")), // Execute
  S: PRONTO, // Sync
};

async function servidorFalso(porta = 0): Promise<ServidorFalso> {
  const consultas: string[] = [];
  const sockets = new Set<Socket>();
  const servidor = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    let pendente = Buffer.alloc(0);
    let iniciou = false;
    socket.on("data", (pedaco) => {
      pendente = Buffer.concat([pendente, pedaco]);
      for (;;) {
        if (!iniciou) {
          // StartupMessage: sem byte de tipo. Responde AuthenticationOk + pronto.
          if (pendente.length < 4 || pendente.length < pendente.readInt32BE(0)) return;
          pendente = pendente.subarray(pendente.readInt32BE(0));
          iniciou = true;
          socket.write(Buffer.concat([mensagem("R", Buffer.alloc(4)), PRONTO]));
          continue;
        }
        if (pendente.length < 5) return;
        const tamanho = pendente.readInt32BE(1) + 1;
        if (pendente.length < tamanho) return;
        const tipo = String.fromCharCode(pendente[0]);
        const corpo = pendente.subarray(5, tamanho);
        pendente = pendente.subarray(tamanho);
        if (tipo === "Q") consultas.push(corpo.toString("utf8").split("\0")[0]);
        if (tipo === "P") consultas.push(corpo.toString("utf8").split("\0")[1]);
        if (tipo === "X") {
          socket.end();
          return;
        }
        if (RESPOSTAS[tipo]) socket.write(RESPOSTAS[tipo]);
      }
    });
  });
  await new Promise<void>((ok) => servidor.listen(porta, "127.0.0.1", ok));
  return {
    porta: (servidor.address() as AddressInfo).port,
    consultas,
    derrubarConexoes() {
      for (const socket of sockets) socket.destroy();
    },
    async fechar() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((ok) => servidor.close(() => ok()));
      // Dá tempo de o pool ouvir a queda ainda dentro do teste (com o
      // `console.error` silenciado), e não depois dele.
      await new Promise((r) => setTimeout(r, 50));
    },
  };
}

/** Uma porta em que ninguém escuta (ainda): o "banco fora do ar". */
async function portaLivre(): Promise<number> {
  const s = await servidorFalso();
  await s.fechar();
  return s.porta;
}

type ModuloPostgres = typeof import("../src/lib/store/postgres");
let instancias = 0;

/**
 * Carrega uma cópia nova do módulo (pool e `ensureSchema` são estado de
 * módulo) e cria um store cujo pool aponta para `url`. O pool nasce na
 * primeira leitura — síncrona até o primeiro `await` —, então basta a
 * variável valer durante essa chamada.
 */
async function storeApontandoPara(url: string) {
  const especificador = `../src/lib/store/postgres.ts?instancia=${instancias++}`;
  const { createPostgresStore } = (await import(especificador)) as ModuloPostgres;
  const store = createPostgresStore<{ n: number }>({ key: "k", seed: () => ({ n: 1 }) });
  let primeira = true;
  return {
    read(): Promise<{ n: number }> {
      if (!primeira) return store.read();
      primeira = false;
      const antes = process.env.DATABASE_URL;
      process.env.DATABASE_URL = url;
      try {
        return store.read();
      } finally {
        if (antes === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = antes;
      }
    },
  };
}

describe("createPostgresStore — resiliência da conexão (#75)", () => {
  test("banco fora do ar na primeira chamada: volta sozinho quando o banco volta", async (t) => {
    t.mock.method(console, "error", () => undefined);
    const porta = await portaLivre();
    const store = await storeApontandoPara(`postgres://app@127.0.0.1:${porta}/app`);

    await assert.rejects(() => store.read(), /ECONNREFUSED/, "banco parado");

    const banco = await servidorFalso(porta);
    try {
      assert.deepEqual(await store.read(), { n: 1 }, "banco de volta: a leitura funciona");
      assert.ok(
        banco.consultas.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS kv_store")),
        "o ensureSchema tentou de novo em vez de devolver o erro antigo",
      );
    } finally {
      await banco.fechar();
    }
  });

  test("conexão ociosa derrubada pelo servidor não encerra o processo", async (t) => {
    const logado = t.mock.method(console, "error", () => undefined);
    const banco = await servidorFalso();
    try {
      const store = await storeApontandoPara(`postgres://app@127.0.0.1:${banco.porta}/app`);
      assert.deepEqual(await store.read(), { n: 1 }); // cliente volta ao pool, ocioso

      // Sem `pool.on("error")`, isto vira "Unhandled error event" e o processo
      // do teste morre aqui mesmo.
      banco.derrubarConexoes();
      await new Promise((r) => setTimeout(r, 100));

      assert.ok(logado.mock.callCount() > 0, "a queda foi registrada no log");
      assert.deepEqual(await store.read(), { n: 1 }, "e a leitura seguinte reconecta");
    } finally {
      await banco.fechar();
    }
  });
});
