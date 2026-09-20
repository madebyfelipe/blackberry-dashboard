import type { NextConfig } from "next";
import { assertAuthSecret } from "./src/lib/auth/token";

/*
 * Este arquivo é lido no `next build` e no `next start` (nos dois, NODE_ENV é
 * "production") — é o ponto mais cedo em que dá para recusar um deploy sem
 * AUTH_SECRET. Sem isso, o app subia calado assinando a sessão com o segredo
 * de desenvolvimento, que está no repositório.
 *
 * O `next dev` também passa por aqui, mas em desenvolvimento a checagem não
 * reclama de nada.
 */
assertAuthSecret();

const nextConfig: NextConfig = {};

export default nextConfig;
