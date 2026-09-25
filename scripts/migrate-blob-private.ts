/*
 * Copia as mídias do Blob store público antigo para o store privado novo
 * (issue #39) — ver `src/lib/maintenance/migrate-blob-private.ts`.
 *
 * Rodar DEPOIS de criar o store privado na Vercel, com o ambiente de produção:
 *
 *   BLOB_READ_WRITE_TOKEN=<token do store NOVO> DATABASE_URL=<o de produção> \
 *     npm run migrate:blob-private -- --dry-run   # só lista
 *   BLOB_READ_WRITE_TOKEN=... DATABASE_URL=... npm run migrate:blob-private
 *
 * Idempotente: o que já está no store novo é pulado; se cair no meio, é só
 * rodar de novo.
 */
import { put } from "@vercel/blob";
import { migrateBlobToPrivate, storeIdFromToken } from "../src/lib/maintenance/migrate-blob-private";
import { readMediaIndex, transactionMediaIndex } from "../src/lib/media/store";
import { BLOB_ACCESS } from "../src/lib/media/constants";

const storeId = storeIdFromToken(process.env.BLOB_READ_WRITE_TOKEN);
if (!storeId) {
  console.error("Defina BLOB_READ_WRITE_TOKEN com o token do store NOVO (privado).");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.warn("Sem DATABASE_URL: vai mexer no data/media.json local, não no de produção.");
}
const dryRun = process.argv.includes("--dry-run");

const result = await migrateBlobToPrivate(
  {
    storeId,
    readIndex: readMediaIndex,
    updateAsset: (id, patch) =>
      transactionMediaIndex((map) => {
        if (map[id]) Object.assign(map[id], patch);
      }),
    download: async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`store antigo respondeu ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    upload: (pathname, bytes, contentType) =>
      put(pathname, Buffer.from(bytes), {
        access: BLOB_ACCESS,
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
      }),
    log: (line) => console.log(line),
  },
  { dryRun },
);

console.log(`${dryRun ? "Copiaria" : "Copiadas"}: ${result.copied}`);
console.log(`Já no store novo: ${result.alreadyThere}`);
if (result.failed.length) {
  console.log(`Falharam: ${result.failed.length}`);
  for (const f of result.failed) console.log(`  ${f.id}: ${f.reason}`);
}
// O pool do Postgres mantém conexão aberta; sem isto o comando não termina.
process.exit(result.failed.length ? 1 : 0);
