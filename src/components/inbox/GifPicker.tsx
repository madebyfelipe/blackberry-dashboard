"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon, XIcon } from "@/components/icons";
import { apiSearchGifs, type GifResult } from "./api";

/*
 * A biblioteca de GIFs, aberta pelo botão do campo de escrever. Busca no
 * Tenor ou no Giphy — o que estiver configurado no servidor (ver
 * `/api/inbox/gifs`) — e, sem busca, mostra os que estão em alta. Escolher
 * manda na hora, como no Discord e no Slack.
 */

export function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: GifResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  // Busca com um respiro de 300ms entre teclas — não uma chamada por letra.
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      apiSearchGifs(query.trim())
        .then((r) => {
          if (!vivo) return;
          setResults(r);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!vivo) return;
          setResults([]);
          setError(e instanceof Error ? e.message : "A biblioteca de GIFs não respondeu.");
        });
    }, query ? 300 : 0);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Escolher um GIF"
      className="absolute bottom-[calc(100%+8px)] right-0 z-50 flex h-[360px] w-[min(340px,calc(100vw-32px))] animate-pop-in flex-col overflow-hidden rounded-menu border border-border bg-surface-2 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <SearchIcon size={13} className="shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar GIF"
          aria-label="Buscar GIF"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-fg-soft outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="tap shrink-0 text-fg-3 transition-colors hover:text-fg-soft"
        >
          <XIcon size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {error ? (
          <p className="p-4 text-center text-[12px] leading-[18px] text-muted">{error}</p>
        ) : results === null ? (
          <p className="p-4 text-center text-[12px] text-muted">Carregando…</p>
        ) : results.length === 0 ? (
          <p className="p-4 text-center text-[12px] text-muted">Nenhum GIF para “{query}”.</p>
        ) : (
          <div className="columns-2 gap-2">
            {results.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onPick(g)}
                title={g.title}
                className="tap mb-2 block w-full overflow-hidden rounded-mark bg-border transition-opacity hover:opacity-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.preview} alt={g.title} loading="lazy" className="block h-auto w-full" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
