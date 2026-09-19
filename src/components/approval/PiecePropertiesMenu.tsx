"use client";

import type { Piece, PieceChannel, PieceFormat } from "@/lib/approval/types";
import {
  PIECE_CHANNELS,
  PIECE_FORMATS,
  pieceChannel,
  pieceFormat,
} from "@/lib/approval/constants";
import { toDatetimeLocal } from "@/lib/format";
import {
  CalendarIcon,
  FacebookIcon,
  InstagramIcon,
  Music2Icon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

/*
 * Propriedades da peça — data de publicação, formato e canal.
 *
 * Saíram do corpo do editor e vieram para um menu, no mesmo espírito do
 * `DisplayMenu` das Tarefas: quem está escrevendo a legenda não mexe nisso a
 * todo momento, e cada campo aberto em cena era mais uma moldura na tela.
 * O painel herda a mesma casca do menu de visualização (300px, `rounded-panel`,
 * sombra) para os dois menus do produto serem o mesmo objeto.
 */

const CHANNEL_ICON = {
  instagram: InstagramIcon,
  tiktok: Music2Icon,
  facebook: FacebookIcon,
} as const;

export function PiecePropertiesMenu({
  piece,
  onChange,
}: {
  piece: Piece;
  /** `now` grava sem esperar o debounce — usado pelos chips. */
  onChange: (patch: Partial<Piece>, opts?: { now?: boolean }) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Propriedades da peça"
      className="w-[300px] max-w-[calc(100vw-32px)] animate-pop-in rounded-panel border border-border bg-surface pb-3.5 pt-3 shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
    >
      <Section label="Data de publicação">
        <label className="flex items-center gap-2 rounded-mark border border-border bg-bg px-3 py-2.5">
          <CalendarIcon size={15} className="text-muted" />
          <input
            type="datetime-local"
            aria-label="Data de publicação"
            value={toDatetimeLocal(piece.date)}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              onChange({ date: new Date(v).toISOString() });
            }}
            className="w-full bg-transparent text-[13px] text-fg-soft focus:outline-none [color-scheme:dark]"
          />
        </label>
      </Section>

      <Divider />

      <Section label="Formato">
        <div className="flex flex-wrap gap-1.5">
          {PIECE_FORMATS.map((f) => (
            <Chip
              key={f.id}
              active={pieceFormat(piece) === f.id}
              onClick={() => onChange({ format: f.id as PieceFormat }, { now: true })}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Divider />

      <Section label="Canal">
        <div className="flex flex-wrap gap-1.5">
          {PIECE_CHANNELS.map((c) => {
            const Icon = CHANNEL_ICON[c.id];
            return (
              <Chip
                key={c.id}
                active={pieceChannel(piece) === c.id}
                onClick={() =>
                  onChange({ channel: c.id as PieceChannel }, { now: true })
                }
              >
                <Icon size={13} />
                {c.label}
              </Chip>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      <span className="text-[12px] text-muted">{label}</span>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-border" aria-hidden="true" />;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "tap flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] transition-colors",
        active
          ? "bg-primary font-semibold text-on-primary"
          : "text-muted outline outline-1 -outline-offset-[0.5px] outline-border hover:text-fg-soft",
      )}
    >
      {children}
    </button>
  );
}
