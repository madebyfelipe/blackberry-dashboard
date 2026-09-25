import type { AgencyScope } from "./types";
import * as agency from "./store";
import * as approval from "@/lib/approval/store";
import * as clients from "@/lib/clients/store";
import * as crm from "@/lib/crm/store";
import * as flows from "@/lib/flows/store";
import * as inbox from "@/lib/inbox/store";
import * as notifications from "@/lib/notifications/store";
import * as tasks from "@/lib/tasks/store";
import { dropAgencyUsers } from "@/lib/auth/repository";
import { deleteMedia, listMediaIds } from "@/lib/media/store";

/*
 * "Excluir agência" (Configurações › Agência › Zona de perigo): tira a
 * agência de todo o produto, para todas as pessoas dela. Não tem volta.
 *
 * Quem pode (só Admin) e a confirmação (digitar o nome) são da rota. Aqui é
 * a faxina, área por área, sempre pelo `agencyId` do escopo da sessão — o
 * mesmo filtro que protege a leitura protege a exclusão: nada de outra
 * agência sai daqui.
 *
 * A ordem importa: primeiro junta os arquivos (artes dos lotes, arquivos das
 * fichas, anexos, fotos e logo), depois apaga os registros, e só no fim os
 * bytes — um arquivo apagado com o registro ainda de pé daria imagem
 * quebrada; o contrário, no pior caso, deixa um arquivo órfão.
 */

/** Mídias do sistema de arquivos que são desta agência, por onde quer que estejam. */
async function mediaOfAgency(agencyId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const batch of await approval.read()) {
    if (batch.agencyId !== agencyId) continue;
    for (const piece of batch.pieces) for (const m of piece.media ?? []) ids.add(m.id);
  }
  for (const account of await crm.read()) {
    if (account.agencyId !== agencyId) continue;
    for (const f of account.files) ids.add(f.mediaId);
  }
  const fromUrl = (url: string | null | undefined) => {
    const id = url?.match(/^\/api\/media\/([a-f0-9]{32})$/)?.[1];
    if (id) ids.add(id);
  };
  const data = await inbox.read();
  for (const m of data.members) if (m.agencyId === agencyId) fromUrl(m.photoUrl);
  for (const c of data.conversations) {
    if (c.agencyId !== agencyId) continue;
    for (const msg of c.messages) for (const a of msg.attachments) if (a.kind !== "gif") ids.add(a.id);
  }
  fromUrl((await agency.read())[agencyId]?.logoUrl);
  // Anexo que subiu e nunca foi enviado também é da agência (o dono diz).
  for (const id of await listMediaIds((asset) => asset.owner?.agencyId === agencyId)) ids.add(id);
  return ids;
}

function dropFrom<T extends { agencyId: string }>(list: T[], agencyId: string): number {
  const before = list.length;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].agencyId === agencyId) list.splice(i, 1);
  return before - list.length;
}

export type AgencyDeletion = { users: number; files: number };

export async function deleteAgency(scope: AgencyScope): Promise<AgencyDeletion> {
  const id = scope.agencyId;
  const files = await mediaOfAgency(id);

  await tasks.transaction((list) => dropFrom(list, id));
  await approval.transaction((list) => dropFrom(list, id));
  await crm.transaction((list) => dropFrom(list, id));
  await clients.transaction((list) => dropFrom(list, id));
  await flows.transaction((list) => dropFrom(list, id));
  await notifications.transaction((list) => dropFrom(list, id));
  await inbox.transaction((data) => {
    dropFrom(data.members, id);
    dropFrom(data.conversations, id);
    delete data.settings[id];
  });
  await agency.transaction((all) => {
    delete all[id];
  });
  // As contas por último: até aqui a sessão de quem pediu ainda existe.
  const users = await dropAgencyUsers(id);

  for (const mediaId of files) {
    try {
      await deleteMedia(mediaId);
    } catch {
      // Arquivo que não sai fica órfão no armazenamento — o dado já saiu.
    }
  }
  return { users, files: files.size };
}
