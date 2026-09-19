import { createJsonStore } from "@/lib/store/json-file";
import type { User } from "./types";
import { seedUsers } from "./seed";

/*
 * Contas. Mesma mecânica dos outros stores (`lib/store/json-file.ts`) — e o
 * primeiro candidato a virar tabela quando entrar o multi-tenant.
 */

const store = createJsonStore<User[]>({
  file: "users.json",
  seed: seedUsers,
});

export const read = store.read;
export const transaction = store.transaction;
