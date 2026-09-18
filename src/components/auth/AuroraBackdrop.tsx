/**
 * AuroraBackdrop — fundo da tela de login.
 *
 * Referência (apenas o fundo): shot "Sign up / sing in / login / registration
 * modal screen", de Robin Holesinsky no Dribbble. Preto absoluto com uma fita
 * de luz iridescente: um leque espectral (vermelho → âmbar → verde → ciano →
 * violeta) descendo pela direita, atrás do card, e uma varredura azul elétrico
 * entrando pelo canto inferior esquerdo.
 *
 * Recriado 100% em CSS — nenhum asset do shot é usado. A fita é um disco com
 * conic-gradient recortado em arco por duas máscaras (radial = espessura da
 * faixa, cônica = trecho angular visível) e desfocado. O leque vem em duas
 * camadas: `bloom` (largo e difuso) e `core` (fino e saturado).
 *
 * As medidas foram calibradas em 1440×900 e convertidas para unidades de
 * viewport, então o arco acompanha a tela sem reposicionamento manual.
 *
 * Movimento: cada camada mora num invólucro `inset-0` só para receber a
 * animação (`.iris-sweep`, `.iris-fan`, `.iris-rays`, `.iris-core` em
 * globals.css) — os `transform: translate(-50%, -50%)` das camadas internas
 * continuam intactos, e o giro acontece em torno do centro dos arcos
 * (`transform-origin: 30% 50%`). Os keyframes terminam no neutro, então a
 * composição calibrada aqui é sempre o estado final. Não anime blur/máscara:
 * só transform e opacity.
 */

// ---- Leque espectral (direita) --------------------------------------------

// O arco é dimensionado pela LARGURA: é ela que decide onde a faixa cruza a
// tela (borda direita do card). Amarrar à altura faria o leque fugir para fora
// em viewports estreitas e altas. O piso em px segura a composição no celular.
const FAN_SIZE = "max(87vw, 420px)";

const FAN_GRADIENT = `conic-gradient(from 0deg,
  #000000 0deg,
  #04060f 24deg,
  #0b1436 38deg,
  #1d2a63 50deg,
  #3a1030 58deg,
  #7a1018 64deg,
  #d0341f 70deg,
  #ff8a45 76deg,
  #f6e58a 82deg,
  #b6e58a 88deg,
  #46a05a 95deg,
  #35c9c2 102deg,
  #4f86ff 110deg,
  #7a44ff 120deg,
  #2a1052 132deg,
  #080814 145deg,
  #000000 160deg,
  #000000 360deg)`;

// Máscara radial recorta a espessura da faixa; a cônica, o trecho visível.
const FAN_MASK = [
  "radial-gradient(closest-side, transparent 0 66%, #000 74%, #000 80%, transparent 93%)",
  "conic-gradient(from 0deg, transparent 0deg 32deg, #000 50deg 122deg, transparent 144deg 360deg)",
].join(", ");

const RAYS_MASK = [
  "radial-gradient(closest-side, transparent 0 68%, #000 76%, transparent 95%)",
  "conic-gradient(from 0deg, transparent 0deg 46deg, #000 60deg 116deg, transparent 134deg 360deg)",
].join(", ");

// ---- Varredura azul (canto inferior esquerdo) ------------------------------

const SWEEP_SIZE = "max(82vw, 400px)";

const SWEEP_GRADIENT = `conic-gradient(from 0deg,
  #000000 0deg,
  #000000 180deg,
  #071038 196deg,
  #1f5cff 214deg,
  #4da3ff 232deg,
  #a6dcff 248deg,
  #4f86ff 262deg,
  #6b3cff 276deg,
  #1a1050 288deg,
  #04050f 302deg,
  #000000 320deg,
  #000000 360deg)`;

const SWEEP_MASK = [
  "radial-gradient(closest-side, transparent 0 60%, #000 72%, #000 84%, transparent 100%)",
  "conic-gradient(from 0deg, transparent 0deg 182deg, #000 202deg 282deg, transparent 306deg 360deg)",
].join(", ");

// Centro comum dos dois arcos: o leque passa por trás da borda direita do card.
const arc = {
  left: "30%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
} as const;

export function AuroraBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-bg"
    >
      {/* Varredura azul, ao fundo de tudo. */}
      <div className="iris-sweep absolute inset-0">
        <div
          className="absolute"
          style={{
            ...arc,
            width: SWEEP_SIZE,
            height: SWEEP_SIZE,
            backgroundImage: SWEEP_GRADIENT,
            maskImage: SWEEP_MASK,
            WebkitMaskImage: SWEEP_MASK,
            filter: "blur(64px) saturate(1.15)",
            opacity: 0.92,
          }}
        />
      </div>

      {/* Leque: bloom + core no mesmo invólucro, para derivarem como uma peça. */}
      <div className="iris-fan absolute inset-0">
        {/* Camada difusa (o brilho que vaza para o preto). */}
        <div
          className="absolute"
          style={{
            ...arc,
            width: FAN_SIZE,
            height: FAN_SIZE,
            backgroundImage: FAN_GRADIENT,
            maskImage: FAN_MASK,
            WebkitMaskImage: FAN_MASK,
            filter: "blur(85px) saturate(1.1)",
            opacity: 0.55,
          }}
        />

        {/* Camada nítida (a linha de cor dentro do brilho). */}
        <div
          className="absolute"
          style={{
            ...arc,
            width: FAN_SIZE,
            height: FAN_SIZE,
            backgroundImage: FAN_GRADIENT,
            maskImage: FAN_MASK,
            WebkitMaskImage: FAN_MASK,
            filter: "blur(26px) saturate(1.25)",
            opacity: 0.85,
          }}
        />
      </div>

      {/* Estrias: os raios finos da dispersão, só dentro do leque. */}
      <div className="iris-rays absolute inset-0">
        <div
          className="absolute"
          style={{
            ...arc,
            width: FAN_SIZE,
            height: FAN_SIZE,
            backgroundImage:
              "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.18) 0deg 0.6deg, transparent 0.6deg 2.2deg)",
            maskImage: RAYS_MASK,
            WebkitMaskImage: RAYS_MASK,
            filter: "blur(5px)",
            opacity: 0.45,
          }}
        />
      </div>

      {/* Núcleo quente: o ponto branco de onde a luz se abre. */}
      <div
        className="iris-core absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(clamp(180px, 16vw, 280px) clamp(240px, 37vh, 380px) at 66% 38%, rgba(255,248,235,0.45), rgba(255,225,180,0.10) 44%, transparent 74%)",
          filter: "blur(28px)",
        }}
      />

      {/* Canto superior esquerdo volta ao preto absoluto. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(62vw 69vh at 6% 14%, #000 0 34%, transparent 76%)",
        }}
      />
    </div>
  );
}
