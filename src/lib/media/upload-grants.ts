import { createStore } from "@/lib/store";

/*
 * Quem pediu cada upload direto para o Blob (issue #73).
 *
 * O pathname de um blob não é segredo: ele aparece no `Location` do 307 de
 * `/api/media/<id>`, porque a URL assinada é `<store>/<pathname>?…`. Então
 * "o objeto existe no Blob" não prova nada sobre de quem ele é — sem isto,
 * qualquer conta registrava o pathname da arte de outra agência como mídia
 * sua e, ao apagar, levava junto o arquivo da vítima.
 *
 * A rota `/token` anota aqui o pathname que autorizou e para quem (agência,
 * pessoa e onde o arquivo vai entrar); o registro (`saveBlobMedia`) só aceita
 * pathname que tenha nascido de uma permissão dessas, para o mesmo dono. O
 * pathname pedido traz um nonce aleatório (`blobPathnameFor`), então dois
 * envios nunca disputam a mesma permissão — e uma permissão já dada a alguém
 * não é dada a outra pessoa.
 */

/** Para quem o upload foi autorizado. `target` diz onde o arquivo vai entrar. */
export type UploadGrantOwner = {
  agencyId: string;
  uploaderId: string;
  target: string;
};

type UploadGrant = UploadGrantOwner & { expiresAt: number };

/** Os destinos de cada porta de upload — a rota do token e a do registro usam o mesmo. */
export const UPLOAD_TARGET = {
  peca: (batchId: string, pieceId: string) => `peca:${batchId}/${pieceId}`,
  conversa: (conversationId: string) => `conversa:${conversationId}`,
  cliente: (clientId: string) => `cliente:${clientId}`,
};

/**
 * O token do Blob vale 1 hora (padrão do `handleUpload`) e o navegador
 * registra o arquivo assim que o upload termina. Duas horas é folga, não
 * expectativa; depois disso a permissão some e o envio precisa recomeçar.
 */
const GRANT_TTL_MS = 2 * 60 * 60 * 1000;

const grants = createStore<Record<string, UploadGrant>>({
  file: "media-upload-grants.json",
  seed: () => ({}),
});

function sameOwner(a: UploadGrantOwner, b: UploadGrantOwner): boolean {
  return a.agencyId === b.agencyId && a.uploaderId === b.uploaderId && a.target === b.target;
}

/**
 * O pathname que o navegador pediu, a partir do que o Blob devolveu: o
 * `addRandomSuffix` acrescenta `-<letras e números>` antes da extensão.
 * `undefined` quando não há sufixo — um pathname assim não saiu de um token.
 */
export function requestedPathnameOf(pathname: string): string | undefined {
  const match = /^(.+)-[A-Za-z0-9]+(\.[a-z0-9]{2,4})$/.exec(pathname);
  return match ? `${match[1]}${match[2]}` : undefined;
}

/**
 * Anota a permissão de subir `pathname` (o pedido, antes do sufixo do Blob).
 * Recusa (`false`) se esse pathname já foi autorizado para outra pessoa ou
 * outro destino — pedir de novo para o mesmo dono só renova o prazo.
 */
export async function issueUploadGrant(
  pathname: string,
  owner: UploadGrantOwner,
): Promise<boolean> {
  const now = Date.now();
  return grants.transaction((map) => {
    for (const [key, grant] of Object.entries(map)) {
      if (grant.expiresAt <= now) delete map[key];
    }
    const existing = map[pathname];
    if (existing && !sameOwner(existing, owner)) return false;
    map[pathname] = {
      agencyId: owner.agencyId,
      uploaderId: owner.uploaderId,
      target: owner.target,
      expiresAt: now + GRANT_TTL_MS,
    };
    return true;
  });
}

/** Se o pathname final (com o sufixo do Blob) saiu de uma permissão deste dono, ainda válida. */
export async function hasUploadGrant(
  pathname: string,
  owner: UploadGrantOwner,
): Promise<boolean> {
  const requested = requestedPathnameOf(pathname);
  if (!requested) return false;
  const grant = (await grants.read())[requested];
  return !!grant && grant.expiresAt > Date.now() && sameOwner(grant, owner);
}

/** Gasta a permissão depois do registro: um token, uma mídia. */
export async function releaseUploadGrant(pathname: string): Promise<void> {
  const requested = requestedPathnameOf(pathname);
  if (!requested) return;
  await grants.transaction((map) => {
    delete map[requested];
  });
}
