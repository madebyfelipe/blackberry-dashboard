import type { NextConfig } from "next";

/*
 * Cabeçalhos de segurança (issue #109). `next.config.ts` estava vazio: nada
 * de CSP, `frame-ancestors`, `nosniff` fora de `/api/media` ou
 * `Referrer-Policy` saía em produção. O mais direto de explorar é o link
 * público (`/a/<token>`): sem `frame-ancestors`/`X-Frame-Options`, qualquer
 * site podia embuti-lo num `<iframe>` e sobrepor botões por cima dos de
 * "aprovar"/"pedir ajuste" (clickjacking).
 *
 * Content-Security-Policy entra só como `-Report-Only`: Ably, LiveKit e o
 * Vercel Blob são serviços de terceiro cujo domínio final depende de
 * variável de ambiente (`LIVEKIT_URL`, o `ABLY_API_KEY`, o Blob store) — não
 * dá para travar `connect-src`/`img-src` num domínio fixo sem já saber qual
 * é. Relatório primeiro: o navegador manda a violação para o console sem
 * bloquear nada, o que dá para apertar o `connect-src`/`script-src` depois de
 * olhar o relatório de verdade em produção, sem arriscar derrubar a chamada
 * ou o Inbox em tempo real no meio do caminho.
 *
 * Os outros cabeçalhos já valem de cara, porque nenhum bloqueia nada que o
 * produto use: `X-Frame-Options`/`frame-ancestors` (ninguém embute o próprio
 * app), `nosniff`, `Referrer-Policy` (só encolhe o que vai no `Referer` entre
 * origens) e `Permissions-Policy` — que precisa **liberar**, não negar,
 * câmera/microfone/compartilhar tela/tela cheia/área de transferência para a
 * própria origem, porque é exatamente isso que a Chamada e o botão de copiar
 * link usam.
 */
const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",
  // Sem nonce (exigiria renderização dinâmica em toda rota — ver o guia de
  // CSP do Next): 'unsafe-inline' é o que já vale hoje, só reportado.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // blob: — preview de upload antes de enviar; data: — ícones/avatares inline.
  "img-src 'self' blob: data: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  // https/wss: genérico porque Ably, LiveKit e o Blob são domínio de
  // variável de ambiente — ver o comentário acima. Aperta depois do relatório.
  "connect-src 'self' https: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: cspDirectives },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=(self)",
      "display-capture=(self)",
      "fullscreen=(self)",
      "clipboard-write=(self)",
      "geolocation=()",
      "browsing-topics=()",
    ].join(", "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
