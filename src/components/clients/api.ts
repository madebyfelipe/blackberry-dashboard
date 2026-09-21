import type { Client, ClientPatch, NewClient } from "@/lib/clients/types";

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Algo deu errado. Tente de novo.");
  }
  return data;
}

export async function apiListClients(): Promise<Client[]> {
  const data = await parse(await fetch("/api/clients", { cache: "no-store" }));
  return data.clients as Client[];
}

export async function apiCreateClient(input: NewClient): Promise<Client> {
  const data = await parse(
    await fetch("/api/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return data.client as Client;
}

export async function apiUpdateClient(
  id: string,
  patch: ClientPatch,
): Promise<Client> {
  const data = await parse(
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
  return data.client as Client;
}

export async function apiDeleteClient(id: string): Promise<void> {
  await parse(await fetch(`/api/clients/${id}`, { method: "DELETE" }));
}
