import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  DEFAULT_CLIENT_DEFAULTS,
  AgencySettingsError,
  agencyInitials,
  contractFromDefaults,
  normalizeAgencySettings,
  normalizeClientDefaults,
  withClientDefaults,
} from "../src/lib/agency/settings";
import { cityLabel, deviceLabel, passwordStrength } from "../src/lib/auth/device";
import { DEFAULT_NOTIFY_PREFS, alertRoute, normalizeNotifyPrefs } from "../src/lib/inbox/notifyPrefs";
import { parseAudioPrefs } from "../src/lib/inbox/audioPrefs";
import { canSeeDashboard, canSeeFinance, isAdmin } from "../src/lib/inbox/users";

/*
 * As réguas das Configurações que não dependem de tela: quem avisa e por
 * onde, os padrões para cliente novo, força da senha e o nome do aparelho,
 * e quem vê o quê no painel.
 */

describe("avisos: o que avisar e por onde", () => {
  test("arquivo velho, sem avisos gravados, fica com tudo ligado e o som de sempre", () => {
    assert.deepEqual(normalizeNotifyPrefs(undefined), DEFAULT_NOTIFY_PREFS);
    assert.equal(DEFAULT_NOTIFY_PREFS.sound, "blackberry");
  });

  test("valor torto vira o padrão, o resto fica", () => {
    const p = normalizeNotifyPrefs({ kinds: { mensagem: false, mencao: "sim" }, inApp: false, sound: "trombone" });
    assert.equal(p.kinds.mensagem, false);
    assert.equal(p.kinds.mencao, true);
    assert.equal(p.inApp, false);
    assert.equal(p.sound, "blackberry");
  });

  test("tipo desligado não avisa por lugar nenhum", () => {
    const p = normalizeNotifyPrefs({ kinds: { comentario: false } });
    assert.deepEqual(alertRoute(p, "disponivel", "comentario"), { inApp: false, system: false, sound: false });
    assert.deepEqual(alertRoute(p, "disponivel", "mencao"), { inApp: true, system: true, sound: true });
  });

  test("Ocupado: sem sistema e sem som; só a menção chega no app", () => {
    const p = DEFAULT_NOTIFY_PREFS;
    assert.deepEqual(alertRoute(p, "ocupado", "mencao"), { inApp: true, system: false, sound: false });
    assert.deepEqual(alertRoute(p, "ocupado", "mensagem"), { inApp: false, system: false, sound: false });
  });

  test("som 'Nenhum' cala o som e mantém o aviso", () => {
    const p = normalizeNotifyPrefs({ sound: "nenhum" });
    assert.deepEqual(alertRoute(p, "disponivel", "atribuicao"), { inApp: true, system: true, sound: false });
  });

  test("com os dois canais desligados, não há som órfão", () => {
    const p = normalizeNotifyPrefs({ inApp: false, system: false });
    assert.deepEqual(alertRoute(p, "disponivel", "mencao"), { inApp: false, system: false, sound: false });
  });
});

describe("áudio da chamada no navegador", () => {
  test("sem nada gravado: padrão do sistema e reduzir ruído ligado", () => {
    assert.deepEqual(parseAudioPrefs(null), { inputId: null, outputId: null, noiseSuppression: true });
  });
  test("guarda os aparelhos escolhidos", () => {
    assert.deepEqual(parseAudioPrefs({ inputId: "mic-2", outputId: "", noiseSuppression: false }), {
      inputId: "mic-2",
      outputId: null,
      noiseSuppression: false,
    });
  });
});

describe("padrões para cliente novo", () => {
  test("a leitura aceita qualquer coisa e cai no padrão calada", () => {
    assert.deepEqual(normalizeClientDefaults(undefined), DEFAULT_CLIENT_DEFAULTS);
    assert.deepEqual(normalizeClientDefaults({ billingDay: 40, cycle: "semanal", paymentKind: "cheque" }), DEFAULT_CLIENT_DEFAULTS);
  });

  test("a gravação recusa com mensagem", () => {
    assert.throws(() => normalizeClientDefaults({ billingDay: 0 }, true), AgencySettingsError);
    assert.throws(() => normalizeClientDefaults({ fidelityMonths: -1 }, true), AgencySettingsError);
    assert.throws(() => normalizeClientDefaults({ paymentKind: "cheque" }, true), AgencySettingsError);
    assert.throws(() => normalizeClientDefaults({ cycle: "semanal" }, true), AgencySettingsError);
  });

  test("valores bons passam, com o texto do índice limpo", () => {
    assert.deepEqual(
      normalizeClientDefaults(
        { billingDay: "10", adjustmentIndex: " IPCA ", fidelityMonths: 12, paymentKind: "pix", cycle: "trimestral", flowId: "f1" },
        true,
      ),
      { billingDay: 10, adjustmentIndex: "IPCA", fidelityMonths: 12, paymentKind: "pix", cycle: "trimestral", flowId: "f1" },
    );
  });

  test("o cadastro só recebe o padrão no que veio vazio", () => {
    const d = { ...DEFAULT_CLIENT_DEFAULTS, billingDay: 10, flowId: "f1" };
    assert.deepEqual(withClientDefaults({ name: "A" }, d), { name: "A", billingDay: 10, flowId: "f1" });
    assert.deepEqual(withClientDefaults({ name: "A", billingDay: 5, flowId: "f2" }, d), {
      name: "A",
      billingDay: 5,
      flowId: "f2",
    });
    assert.deepEqual(withClientDefaults({ name: "A", billingDay: null }, d).billingDay, 10);
  });

  test("sem padrão escolhido, a ficha nova nasce igual a antes", () => {
    assert.equal(contractFromDefaults(DEFAULT_CLIENT_DEFAULTS), null);
    assert.deepEqual(contractFromDefaults({ ...DEFAULT_CLIENT_DEFAULTS, fidelityMonths: 12, paymentKind: "boleto" }), {
      contract: { cycle: "mensal", fidelityMonths: 12, adjustmentIndex: "" },
      payment: { kind: "boleto" },
    });
  });

  test("o logo só pode ser mídia do próprio app", () => {
    assert.equal(normalizeAgencySettings({ logoUrl: "https://evil.com/x.png" }).logoUrl, null);
    const ok = "/api/media/" + "a".repeat(32);
    assert.equal(normalizeAgencySettings({ logoUrl: ok }).logoUrl, ok);
  });

  test("as iniciais do logo de quem não mandou um", () => {
    assert.equal(agencyInitials("Estúdio Norte"), "EN");
    assert.equal(agencyInitials("Pixel"), "PI");
    assert.equal(agencyInitials("  "), "—");
  });
});

describe("senha e sessão", () => {
  test("força da senha", () => {
    assert.equal(passwordStrength("").score, 0);
    assert.deepEqual(passwordStrength("abc"), { score: 0, label: "Curta" });
    assert.equal(passwordStrength("abcdefgh").label, "Fraca");
    assert.equal(passwordStrength("Abcdefg1").label, "Média");
    assert.equal(passwordStrength("Abcdefgh1234").label, "Forte");
    assert.equal(passwordStrength("Abcdefgh123!").label, "Muito forte");
  });

  test("nome do aparelho", () => {
    const chromeWin =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
    const safariIphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const edge = chromeWin + " Edg/128.0";
    const desktop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Electron/31 Safari/537.36";
    assert.equal(deviceLabel(chromeWin), "Chrome no Windows");
    assert.equal(deviceLabel(safariIphone), "Safari no iPhone");
    assert.equal(deviceLabel(edge), "Edge no Windows");
    assert.equal(deviceLabel(desktop), "App de desktop no macOS");
    assert.equal(deviceLabel(""), "Navegador");
  });

  test("cidade pelos cabeçalhos da Vercel", () => {
    assert.equal(cityLabel("S%C3%A3o%20Paulo", "SP"), "São Paulo, SP");
    assert.equal(cityLabel("Lisboa", "11"), "Lisboa");
    assert.equal(cityLabel(null, "SP"), null);
  });
});

describe("quem vê o quê", () => {
  test("painel: Admin, Gerente e Financeiro; dinheiro: Admin e Financeiro", () => {
    assert.equal(canSeeDashboard({ role: "admin" }), true);
    assert.equal(canSeeDashboard({ role: "gerente" }), true);
    assert.equal(canSeeDashboard({ role: "financeiro" }), true);
    assert.equal(canSeeDashboard({ role: "editor" }), false);
    assert.equal(canSeeFinance({ role: "gerente" }), false);
    assert.equal(canSeeFinance({ role: "financeiro" }), true);
    assert.equal(isAdmin({ role: "gerente" }), false);
  });
});
