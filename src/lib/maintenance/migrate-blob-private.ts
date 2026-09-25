import type { MediaAsset } from "@/lib/media/types";

/*
 * Leva os arquivos do Blob store público antigo para o store privado novo
 * (issue #39, passo 2 do README "Store privado").
 *
 * A Vercel não converte um store de público para privado: o store novo nasce
 * vazio, e cada mídia registrada continua apontando (`blobUrl`,
 * `blobPathname`) para o antigo. Isto copia os bytes — baixando pela URL
 * pública do store antigo, que ainda abre sem token — e grava no novo com o
 * **mesmo caminho**, como privado; só então troca o registro. Uma mídia por
 * vez, gravando o índice a cada uma: se cair no meio, rodar de novo continua
 * de onde parou.
 *
 * Quem é "do store antigo": toda mídia cuja `blobUrl` não é do store do
 * `BLOB_READ_WRITE_TOKEN` atual (o id do store está no token e no host da
 * URL). Então é idempotente — o que já foi copiado é do store novo e é pulado.
 *
 * As dependências (baixar, subir, ler e gravar o índice) entram por parâmetro:
 * o comando (`scripts/migrate-blob-private.ts`) passa as de verdade, e o teste
 * passa falsas.
 */

export type MigrationDeps = {
  /** O id do store novo — o pedaço do `BLOB_READ_WRITE_TOKEN` depois de `vercel_blob_rw_`. */
  storeId: string;
  readIndex: () => Promise<Record<string, MediaAsset>>;
  updateAsset: (id: string, patch: { blobUrl: string; blobPathname: string }) => Promise<void>;
  download: (url: string) => Promise<Uint8Array>;
  upload: (pathname: string, bytes: Uint8Array, contentType: string) => Promise<{ url: string; pathname: string }>;
  log?: (line: string) => void;
};

export type MigrationResult = {
  copied: number;
  alreadyThere: number;
  failed: { id: string; reason: string }[];
};

/** `vercel_blob_rw_<storeId>_<segredo>` → `<storeId>` (em minúsculas, como no host). */
export function storeIdFromToken(token: string | undefined): string | null {
  const m = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(token ?? "");
  return m ? m[1].toLowerCase() : null;
}

/** A mídia está no store `storeId`? O host da URL começa pelo id do store. */
export function isInStore(blobUrl: string, storeId: string): boolean {
  try {
    return new URL(blobUrl).hostname.toLowerCase().startsWith(`${storeId}.`);
  } catch {
    return false;
  }
}

/** O caminho do objeto: o gravado, ou o da própria URL (registro antigo sem `blobPathname`). */
export function pathnameOf(asset: MediaAsset): string | null {
  if (asset.blobPathname) return asset.blobPathname;
  try {
    return asset.blobUrl ? decodeURIComponent(new URL(asset.blobUrl).pathname.replace(/^\/+/, "")) : null;
  } catch {
    return null;
  }
}

export async function migrateBlobToPrivate(
  deps: MigrationDeps,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<MigrationResult> {
  const log = deps.log ?? (() => undefined);
  const result: MigrationResult = { copied: 0, alreadyThere: 0, failed: [] };
  const assets = Object.values(await deps.readIndex()).filter((a) => a.blobUrl);

  for (const asset of assets) {
    if (isInStore(asset.blobUrl!, deps.storeId)) {
      result.alreadyThere++;
      continue;
    }
    const pathname = pathnameOf(asset);
    if (!pathname) {
      result.failed.push({ id: asset.id, reason: "sem caminho no registro" });
      continue;
    }
    if (dryRun) {
      log(`copiaria ${asset.id} (${pathname})`);
      result.copied++;
      continue;
    }
    try {
      const bytes = await deps.download(asset.blobUrl!);
      const put = await deps.upload(pathname, bytes, asset.mime);
      await deps.updateAsset(asset.id, { blobUrl: put.url, blobPathname: put.pathname });
      result.copied++;
      log(`copiado ${asset.id} (${pathname})`);
    } catch (err) {
      result.failed.push({ id: asset.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}
