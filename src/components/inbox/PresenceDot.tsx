import { useId } from "react";
import { PRESENCE_BY_ID } from "@/lib/inbox/constants";
import type { Presence } from "@/lib/inbox/types";
import { cn } from "@/lib/cn";

/*
 * O símbolo de disponibilidade da equipe.
 *
 * Os quatro degraus se distinguem pela **forma**, não pela cor: disco cheio
 * (disponível), disco com um corte (ocupado), meia-lua (ausente) e anel
 * vazado (offline). É o que mantém o produto monocromático e, de quebra, o
 * que faz o estado continuar legível para quem não distingue os cinzas — um
 * ponto que só muda de tom não diz nada nessas condições.
 *
 * O recorte é feito por máscara SVG (e não por um retângulo da cor do fundo)
 * porque o mesmo símbolo aparece sobre superfícies diferentes: a linha da
 * lista muda de fundo quando está ativa.
 */
export function PresenceDot({
  presence,
  size = 10,
  className,
}: {
  presence: Presence;
  size?: number;
  className?: string;
}) {
  const uid = useId();
  const mask = `presence-${uid}`;
  const meta = PRESENCE_BY_ID[presence];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      role="img"
      aria-label={meta.label}
      className={cn("shrink-0", className)}
    >
      <title>{meta.label}</title>
      {presence === "offline" ? (
        <circle
          cx="6"
          cy="6"
          r="4.1"
          fill="none"
          stroke={meta.color}
          strokeWidth="1.8"
        />
      ) : (
        <>
          <mask id={mask}>
            <circle cx="6" cy="6" r="5" fill="#fff" />
            {presence === "ocupado" && (
              <rect x="2.2" y="5" width="7.6" height="2" rx="1" fill="#000" />
            )}
            {presence === "ausente" && (
              <circle cx="3.1" cy="3.1" r="4.4" fill="#000" />
            )}
          </mask>
          <circle cx="6" cy="6" r="5" fill={meta.color} mask={`url(#${mask})`} />
        </>
      )}
    </svg>
  );
}

/**
 * O mesmo símbolo colado no canto de um avatar. O anel é da cor da superfície
 * embaixo — por isso ele vem de fora, como classe.
 */
export function PresenceBadge({
  presence,
  ring = "bg-surface",
  size = 10,
}: {
  presence: Presence;
  /** Classe de fundo do anel: a superfície sobre a qual o avatar está. */
  ring?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "absolute -bottom-px -right-px flex items-center justify-center rounded-pill p-[2px]",
        ring,
      )}
    >
      <PresenceDot presence={presence} size={size} />
    </span>
  );
}
