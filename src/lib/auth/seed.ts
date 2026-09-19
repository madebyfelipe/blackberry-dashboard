import { hashPasswordSync } from "./password";
import type { User } from "./types";

/**
 * Conta de demonstração — o app precisa abrir logo depois de um `npm run dev`,
 * sem cadastro manual. Credenciais documentadas no README.
 *
 * A senha pode vir do ambiente (DEMO_PASSWORD) para quem subir uma instância
 * compartilhada; sem isso, vale o padrão de desenvolvimento.
 */
export function seedUsers(): User[] {
  const password = process.env.DEMO_PASSWORD || "blackberry";
  const now = new Date().toISOString();
  return [
    {
      id: "u1",
      name: "Felipe",
      email: "felipe@blackberry.app",
      role: "coordenacao",
      agency: "Estúdio Norte",
      passwordHash: hashPasswordSync(password),
      passwordVersion: 1,
      createdAt: now,
    },
  ];
}
