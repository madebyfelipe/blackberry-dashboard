"use client";

import { useState } from "react";
import type { Batch, Piece } from "@/lib/approval/types";
import { batchProgress } from "@/lib/approval/constants";
import { formatPieceDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PieceThumb } from "./PieceThumb";
import { Logo } from "@/components/brand/Logo";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockIcon,
  SparklesIcon,
} from "@/components/icons";

/*
 * Abertura do link público — fiel ao export "Clínica Aurora - Aprovação
 * (início)": topo com o selo de link privado, hero com o carrossel de peças e
 * as duas chamadas (começar / ver resumo).
 *
 * No celular o carrossel mostra só a peça central; as laterais aparecem a
 * partir de sm, como no desenho de 1440.
 */

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "Lote setembro · 01-30 set" → "setembro" */
function monthFromLabel(label: string): string | null {
  const lower = label.toLowerCase();
  return MONTHS.find((m) => lower.includes(m)) ?? null;
}

const STATUS_LABEL: Record<Piece["status"], string> = {
  pendente: "Aguardando",
  aprovado: "Aprovada",
  ajuste: "Ajuste pedido",
};

export function ApprovalIntro({
  batch,
  agencyLogoUrl = null,
  onStart,
}: {
  batch: Batch;
  /** O logo da agência (Configurações › Agência). Sem ele, o do black berry. */
  agencyLogoUrl?: string | null;
  onStart: () => void;
}) {
  const pieces = batch.pieces;
  const firstPending = Math.max(
    0,
    pieces.findIndex((p) => p.status === "pendente"),
  );
  const [index, setIndex] = useState(firstPending);
  const [summary, setSummary] = useState(false);
  const month = monthFromLabel(batch.label);
  const progress = batchProgress(batch);

  const go = (delta: number) =>
    setIndex((i) => Math.min(pieces.length - 1, Math.max(0, i + delta)));

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      {/* Top bar — o export mobile ("Aprovação (Mobile)") não tem: no celular a tela abre direto no lote. */}
      <header className="hidden flex-wrap items-center justify-between gap-3 px-5 py-5 sm:flex sm:px-8">
        {agencyLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agencyLogoUrl} alt="" className="h-9 w-auto max-w-[160px] rounded-chip object-contain" />
        ) : (
          <Logo className="h-7" />
        )}
        <span className="flex items-center gap-2 rounded-pill border border-border bg-surface-2 px-4 py-2 text-[13px] text-fg-2">
          <LockIcon size={14} className="text-fg-3" />
          Link privado · {batch.client}
        </span>
      </header>

      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-4 sm:gap-8 sm:py-8">
        <span className="flex items-center gap-2 rounded-pill border border-border bg-surface-2 px-3.5 py-1.5 text-[12px] text-fg-2 sm:px-4 sm:py-2 sm:text-[13px]">
          <SparklesIcon size={12} className="text-fg-3" />
          {batch.label} · {pieces.length} {pieces.length === 1 ? "peça" : "peças"}
        </span>

        <div className="flex flex-col items-center gap-3 sm:gap-3.5">
          <h1 className="text-center text-[24px] font-semibold leading-[28px] text-fg-soft sm:text-[42px] sm:leading-tight">
            {month
              ? `Seus criativos de ${month} estão prontos ✨`
              : "Seus criativos estão prontos ✨"}
          </h1>
          <p className="max-w-[560px] text-center text-[14px]/[21px] text-muted sm:text-[16px]/[24px]">
            Revise cada peça em poucos segundos: aprove, comente ou peça ajustes.
            <span className="hidden sm:inline"> Sem e-mail, sem bagunça — tudo em um só lugar.</span>
          </p>
        </div>

        {summary ? (
          <Summary batch={batch} onBack={() => setSummary(false)} />
        ) : (
          <>
            {/* Slider */}
            <div className="-mx-5 flex items-center justify-center gap-2 sm:mx-0 sm:gap-6">
              <SliderBtn
                label="Peça anterior"
                disabled={index === 0}
                onClick={() => go(-1)}
              >
                <ChevronLeftIcon size={18} />
              </SliderBtn>

              {pieces[index - 1] && (
                <PeekCard piece={pieces[index - 1]} />
              )}
              {pieces[index] && <MainCard piece={pieces[index]} />}
              {pieces[index + 1] && (
                <PeekCard piece={pieces[index + 1]} />
              )}

              <SliderBtn
                label="Próxima peça"
                disabled={index === pieces.length - 1}
                onClick={() => go(1)}
              >
                <ChevronRightIcon size={18} />
              </SliderBtn>
            </div>

            {/* Dots */}
            <div className="flex items-center gap-2">
              {pieces.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`Ir para ${p.name}`}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-1.5 rounded-pill transition-all",
                    i === index ? "w-5 bg-primary sm:w-6" : "w-1.5 bg-border hover:bg-border-strong",
                  )}
                />
              ))}
            </div>
          </>
        )}

        {/* CTA */}
        <div className="flex w-full flex-col items-center justify-center gap-2.5 px-5 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3 sm:px-0">
          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-center gap-2.5 rounded-pill bg-primary px-6 py-3.5 text-[14px] font-semibold text-on-primary transition-opacity hover:opacity-90 sm:w-auto sm:px-7 sm:py-4 sm:text-[15px]"
          >
            {progress.decided > 0 ? "Continuar aprovação" : "Começar aprovação"}
            <ArrowRightIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => setSummary((s) => !s)}
            className="w-full rounded-pill border border-border px-6 py-3.5 text-[14px] font-medium text-fg-soft transition-colors hover:bg-surface-2 sm:w-auto sm:px-7 sm:py-4 sm:text-[15px]"
          >
            {summary ? "Ver as peças" : "Ver resumo do lote"}
          </button>
        </div>

        <p className="text-center text-[11px] text-dim sm:text-[12px]">
          Leva cerca de {Math.max(1, Math.round(pieces.length * 0.4))} minutos · Não
          precisa de senha
        </p>
      </div>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-1 px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-2 sm:py-5 sm:px-8">
        <span className="text-[10px] text-dim sm:text-[12px]">black berry · aprovação de criativos</span>
        <span className="text-[10px] text-muted sm:text-[12px]">
          Precisa de ajuda? Fale com a agência →
        </span>
      </footer>
    </main>
  );
}

function MainCard({ piece }: { piece: Piece }) {
  return (
    <article className="flex h-[260px] w-[200px] shrink-0 flex-col gap-2.5 rounded-[20px] border-[1.5px] border-dim bg-surface-2 p-3 sm:h-[310px] sm:w-[250px] sm:rounded-card sm:p-3.5">
      <CardHead size="lg" />
      <PieceThumb
        size={piece.size}
        media={piece.media?.[0]}
        count={piece.media?.length}
        showBadge={false}
        className="flex-1 rounded-panel"
      >
        {!piece.media?.length && (
          <span className="absolute bottom-3 text-[12px] text-dim">
            {piece.size.replace(" x ", " × ")}
          </span>
        )}
      </PieceThumb>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-fg-2">{piece.name}</span>
        <span className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              piece.status === "pendente" ? "bg-primary" : "bg-dim",
            )}
          />
          <span className="text-[10px] text-fg-soft">{STATUS_LABEL[piece.status]}</span>
        </span>
      </div>
    </article>
  );
}

function PeekCard({ piece, className }: { piece: Piece; className?: string }) {
  return (
    <article
      className={cn(
        // No celular é só a borda da peça vizinha (35%, como no export mobile), estreita
        // o bastante para as duas setas caberem numa tela de 375px.
        "flex h-[200px] w-[32px] shrink-0 flex-col gap-2 overflow-hidden rounded-[20px] border border-border bg-surface-2 p-2.5 opacity-35 sm:h-[230px] sm:w-[170px] sm:gap-2.5 sm:rounded-card sm:p-3.5 sm:opacity-40",
        className,
      )}
    >
      <CardHead size="sm" />
      <PieceThumb
        size={piece.size}
        media={piece.media?.[0]}
        count={piece.media?.length}
        showBadge={false}
        className="flex-1 rounded-panel"
      />
      <div className="hidden items-center justify-between gap-2 sm:flex">
        <span className="text-[11px] font-semibold text-fg-2">{piece.name}</span>
        <span className="text-[10px] text-dim">{formatPieceDate(piece.date)}</span>
      </div>
    </article>
  );
}

/** Cabeçalho "de post" do card: avatar + duas linhas, como no desenho. */
function CardHead({ size }: { size: "sm" | "lg" }) {
  const lg = size === "lg";
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "shrink-0 rounded-full bg-border-strong",
          lg ? "h-[22px] w-[22px]" : "h-4 w-4",
        )}
      />
      <span className="flex flex-1 flex-col gap-1">
        <span
          className={cn(
            "h-1.5 rounded-pill bg-border-strong",
            lg ? "w-[70px]" : "w-12",
          )}
        />
        <span
          className={cn("h-[5px] rounded-pill bg-border", lg ? "w-11" : "w-[30px]")}
        />
      </span>
    </div>
  );
}

function SliderBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-border bg-surface-2 text-fg-soft transition-colors hover:bg-surface disabled:opacity-30 sm:h-11 sm:w-11"
    >
      {children}
    </button>
  );
}

function Summary({ batch, onBack }: { batch: Batch; onBack: () => void }) {
  const progress = batchProgress(batch);
  return (
    <section className="w-full max-w-[560px] overflow-hidden rounded-card border border-border bg-surface-2">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="text-[12px] font-semibold tracking-[0.3px] text-muted">
          /RESUMO DO LOTE
        </h2>
        <span className="text-[12px] text-fg-2">
          {progress.decided} de {progress.total} decididas
        </span>
      </header>
      <div className="h-1.5 w-full bg-border">
        <div
          className="h-1.5 bg-primary transition-all duration-500"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      <ul className="max-h-[260px] divide-y divide-border overflow-y-auto">
        {batch.pieces.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-medium text-fg-soft">
                {p.name}
              </span>
              <span className="truncate text-[11px] text-muted">
                {p.kind} · {formatPieceDate(p.date)}
              </span>
            </span>
            <span className="shrink-0 rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] text-fg-2">
              {STATUS_LABEL[p.status]}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onBack}
        className="w-full border-t border-border px-5 py-3 text-[12px] text-muted transition-colors hover:text-fg-soft"
      >
        Voltar para as peças
      </button>
    </section>
  );
}
