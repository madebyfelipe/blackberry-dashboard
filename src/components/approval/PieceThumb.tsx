"use client";

import { useState } from "react";
import type { PieceStatus } from "@/lib/approval/types";
import type { MediaAsset } from "@/lib/media/types";
import { StatusBadge } from "./StatusBadge";
import { ImageIcon, FilmIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Arte de uma peça. Com `media`, mostra a imagem (ou o vídeo) enviada; sem
 * ela, cai no placeholder com as dimensões — é o mesmo componente nos dois
 * estados, então nenhuma tela precisa saber se o upload já aconteceu.
 *
 * A mídia entra com um fade curto quando termina de carregar: sem isso a
 * imagem "aparece de estalo" e dá a impressão de recarregar a tela.
 */
export function PieceThumb({
  size,
  status,
  media,
  count,
  src,
  showBadge = true,
  plain = false,
  contain = false,
  className,
  children,
}: {
  size: string;
  status?: PieceStatus;
  media?: MediaAsset;
  /** Total de artes do carrossel — mostra "1/N" quando mais de uma. */
  count?: number;
  /** URL direta, quando não há um MediaAsset (compatibilidade). */
  src?: string;
  showBadge?: boolean;
  /** miniatura sem borda, cantos 12px, só ícone (a tira do editor) */
  plain?: boolean;
  /** Mostra a arte inteira em vez de preencher o quadro (preview do editor). */
  contain?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const url = media?.url ?? src;
  const isVideo = media?.kind === "video";
  const fit = contain ? "object-contain" : "object-cover";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        plain
          ? "rounded-thumb bg-surface-2"
          : "rounded-card border border-border bg-surface",
        className,
      )}
    >
      {url ? (
        isVideo ? (
          <video
            src={url}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedData={() => setLoaded(true)}
            className={cn(
              "h-full w-full transition-opacity duration-300",
              fit,
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={media?.name ?? ""}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className={cn(
              "h-full w-full transition-opacity duration-300",
              fit,
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        )
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted">
          <ImageIcon size={plain ? 24 : 22} />
          {!plain && <span className="text-[11px]">{size}</span>}
        </div>
      )}

      {/* Vídeo se anuncia como vídeo mesmo parado. */}
      {url && isVideo && (
        <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-fg-soft backdrop-blur-sm">
          <FilmIcon size={13} />
        </span>
      )}

      {/* Carrossel: avisa que tem mais arte além da primeira. */}
      {!!count && count > 1 && (
        <span className="absolute right-1.5 top-1.5 rounded-pill bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-fg-soft backdrop-blur-sm">
          1/{count}
        </span>
      )}

      {showBadge && status && (
        <div className="absolute left-2.5 top-2.5">
          <StatusBadge status={status} />
        </div>
      )}
      {children}
    </div>
  );
}
