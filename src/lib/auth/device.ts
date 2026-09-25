/*
 * O que a tela de Configurações diz sobre a sessão: a força da senha nova e
 * "Chrome no Windows" a partir do navegador. Funções puras, sem Node nem
 * Next — rodam na tela e nos testes (`tests/auth-device.test.ts`).
 */

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string };

/**
 * Régua simples e honesta: comprimento conta mais que variedade. Abaixo de 8
 * não passa na troca (o servidor recusa), então é "Curta" e zero segmentos.
 */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < 8) return { score: 0, label: "Curta" };
  let points = 1;
  if (pw.length >= 12) points++;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (kinds >= 3) points++;
  if (pw.length >= 16 || (pw.length >= 12 && kinds === 4)) points++;
  const score = Math.min(4, points) as PasswordStrength["score"];
  const label = ["Curta", "Fraca", "Média", "Forte", "Muito forte"][score];
  return { score, label };
}

/** "Chrome no Windows", "Safari no iPhone", "App de desktop no macOS". */
export function deviceLabel(ua: string): string {
  const u = ua || "";
  const browser = /BlackBerryDesktop|Electron/.test(u)
    ? "App de desktop"
    : /Edg\//.test(u)
      ? "Edge"
      : /OPR\/|Opera/.test(u)
        ? "Opera"
        : /Firefox\//.test(u)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(u)
            ? "Chrome"
            : /Safari\//.test(u)
              ? "Safari"
              : "Navegador";
  const os = /iPhone/.test(u)
    ? "iPhone"
    : /iPad/.test(u)
      ? "iPad"
      : /Android/.test(u)
        ? "Android"
        : /Windows/.test(u)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(u)
            ? "macOS"
            : /Linux/.test(u)
              ? "Linux"
              : "";
  return os ? `${browser} no ${os}` : browser;
}

/**
 * "São Paulo, SP" a partir dos cabeçalhos de localização da Vercel (a cidade
 * vem codificada para URL). Fora da Vercel não há cabeçalho — sem cidade.
 */
export function cityLabel(city: string | null, region: string | null): string | null {
  let c = "";
  try {
    c = city ? decodeURIComponent(city) : "";
  } catch {
    c = city ?? "";
  }
  c = c.trim();
  const r = (region ?? "").trim().toUpperCase();
  if (!c) return null;
  return r && /^[A-Z]{2}$/.test(r) ? `${c}, ${r}` : c;
}
