import type { ClientAccount, ClientEvent, Contract, FileFolder, PaymentMethod } from "@/lib/crm/types";
import type { ServiceInput } from "@/lib/crm/repository";

/*
 * As chamadas da ficha do cliente. Toda rota devolve a conta inteira depois
 * da mudança — a tela troca a dela pela do servidor, sem remendar à mão.
 */

async function parse(res: Response): Promise<ClientAccount> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Algo deu errado. Tente de novo.");
  return data.account as ClientAccount;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const base = (clientId: string) => `/api/clients/${clientId}`;

export const crmApi = {
  addService: (clientId: string, input: ServiceInput) =>
    fetch(`${base(clientId)}/servicos`, json("POST", input)).then(parse),
  updateService: (clientId: string, id: string, patch: ServiceInput) =>
    fetch(`${base(clientId)}/servicos/${id}`, json("PATCH", patch)).then(parse),
  removeService: (clientId: string, id: string) =>
    fetch(`${base(clientId)}/servicos/${id}`, { method: "DELETE" }).then(parse),

  generateInvoice: (clientId: string) => fetch(`${base(clientId)}/faturas`, { method: "POST" }).then(parse),
  setInvoiceStatus: (clientId: string, id: string, status: "pago" | "aberto") =>
    fetch(`${base(clientId)}/faturas/${id}`, json("PATCH", { status })).then(parse),
  removeInvoice: (clientId: string, id: string) =>
    fetch(`${base(clientId)}/faturas/${id}`, { method: "DELETE" }).then(parse),

  updateContract: (clientId: string, patch: { contract?: Partial<Contract>; payment?: Partial<PaymentMethod> | null }) =>
    fetch(`${base(clientId)}/contrato`, json("PATCH", patch)).then(parse),

  moveFile: (clientId: string, id: string, folder: FileFolder) =>
    fetch(`${base(clientId)}/arquivos/${id}`, json("PATCH", { folder })).then(parse),
  removeFile: (clientId: string, id: string) =>
    fetch(`${base(clientId)}/arquivos/${id}`, { method: "DELETE" }).then(parse),

  addEvent: (clientId: string, input: Pick<ClientEvent, "kind" | "title" | "at" | "place">) =>
    fetch(`${base(clientId)}/eventos`, json("POST", input)).then(parse),
  removeEvent: (clientId: string, id: string) =>
    fetch(`${base(clientId)}/eventos/${id}`, { method: "DELETE" }).then(parse),

  /**
   * Sobe um arquivo para a pasta. Com Blob configurado (produção) ele vai
   * direto do navegador para o store — é o que deixa passar arquivo acima de
   * 4,5 MB, o corte da Vercel no corpo da requisição. Sem Blob, multipart.
   */
  async uploadFile(clientId: string, file: File, folder: FileFolder, blobUploads: boolean): Promise<ClientAccount> {
    const endpoint = `${base(clientId)}/arquivos`;
    if (blobUploads) {
      const [{ upload }, { blobPathnameFor, BLOB_CLIENT_FILE_PREFIX, BLOB_MULTIPART_THRESHOLD, baseMime }] =
        await Promise.all([import("@vercel/blob/client"), import("@/lib/media/constants")]);
      const type = baseMime(file.type);
      const blob = await upload(blobPathnameFor(file.name, type, BLOB_CLIENT_FILE_PREFIX), file, {
        access: "public",
        contentType: type,
        handleUploadUrl: `${endpoint}/token`,
        multipart: file.size > BLOB_MULTIPART_THRESHOLD,
      });
      return fetch(endpoint, json("POST", { pathname: blob.pathname, name: file.name, folder })).then(parse);
    }
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    return fetch(endpoint, { method: "POST", body: form }).then(parse);
  },
};
