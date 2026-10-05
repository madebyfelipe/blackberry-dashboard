import assert from "node:assert/strict";
import test, { describe } from "node:test";

/*
 * Issue #109: `next.config.ts` estava vazio — nada de CSP, `frame-ancestors`,
 * `nosniff` ou `Referrer-Policy` saía em produção, e o link público
 * (`/a/<token>`) podia ser embutido num `<iframe>` de outro site. `headers()`
 * não depende de nada do runtime do Next (só o tipo `NextConfig`, apagado em
 * tempo de execução), então dá para chamar e conferir a lista de verdade —
 * não só reler o arquivo.
 */
const { default: nextConfig } = await import("../next.config");

describe("cabeçalhos de segurança", () => {
  test("vale para toda rota, inclusive /a/<token>", async () => {
    const entries = await nextConfig.headers!();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].source, "/:path*");
  });

  function header(headers: { key: string; value: string }[], key: string): string {
    const found = headers.find((h) => h.key === key);
    assert.ok(found, `cabeçalho ${key} ausente`);
    return found.value;
  }

  test("clickjacking fechado: frame-ancestors 'none' e X-Frame-Options: DENY", async () => {
    const [{ headers }] = await nextConfig.headers!();
    assert.match(header(headers, "Content-Security-Policy-Report-Only"), /frame-ancestors 'none'/);
    assert.equal(header(headers, "X-Frame-Options"), "DENY");
  });

  test("nosniff e Referrer-Policy presentes", async () => {
    const [{ headers }] = await nextConfig.headers!();
    assert.equal(header(headers, "X-Content-Type-Options"), "nosniff");
    assert.equal(header(headers, "Referrer-Policy"), "strict-origin-when-cross-origin");
  });

  /*
   * O ponto fácil de quebrar sem perceber: Permissions-Policy **nega** por
   * padrão, e câmera/microfone/tela/tela cheia/copiar são exatamente o que a
   * Chamada e o botão de link usam. Negar por engano aqui derruba a Chamada
   * de verdade, não só um relatório no console.
   */
  test("Permissions-Policy libera câmera, microfone, tela e área de transferência para a própria origem", async () => {
    const [{ headers }] = await nextConfig.headers!();
    const policy = header(headers, "Permissions-Policy");
    for (const feature of ["camera", "microphone", "display-capture", "fullscreen", "clipboard-write"]) {
      assert.match(policy, new RegExp(`${feature}=\\(self\\)`), `${feature} devia valer para self`);
    }
    assert.match(policy, /geolocation=\(\)/);
  });

  test("CSP é Report-Only — nunca bloqueia, só relata", async () => {
    const [{ headers }] = await nextConfig.headers!();
    assert.ok(headers.some((h) => h.key === "Content-Security-Policy-Report-Only"));
    assert.ok(!headers.some((h) => h.key === "Content-Security-Policy"));
  });
});
