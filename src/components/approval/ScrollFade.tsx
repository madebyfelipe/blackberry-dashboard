"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Envolve um painel com scroll interno e acende um degradê sutil na base
 * enquanto houver mais conteúdo abaixo.
 *
 * Sem isso, um painel cheio "termina" exatamente onde a viewport corta — e
 * como o navegador pode não desenhar nenhuma barra de rolagem visível (é o
 * padrão em versões recentes do Chrome/Windows, "overlay scrollbar"), o
 * corte parece bug, não "role para ver mais". O scroll continua funcionando
 * igual sem este componente; ele só avisa que existe.
 */
export function ScrollFade({
  wrapperClassName,
  className,
  children,
}: {
  /** Classes de como este bloco se encaixa no layout pai (`flex-1`, `w-[…]`…). */
  wrapperClassName?: string;
  /** Classes do painel que rola de verdade — passe o `overflow-y-*` aqui. */
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 2px de folga: alguns navegadores arredondam scrollHeight 1px para cima.
    function check() {
      if (!el) return;
      setHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
    }

    check();
    el.addEventListener("scroll", check, { passive: true });
    // O painel muda de tamanho (breakpoint, sidebar) e o conteúdo pode
    // crescer depois do primeiro layout (artes carregando, peça sendo
    // adicionada) — os dois precisam reavaliar se ainda há mais abaixo.
    const resize = new ResizeObserver(check);
    resize.observe(el);
    const mutate = new MutationObserver(check);
    mutate.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener("scroll", check);
      resize.disconnect();
      mutate.disconnect();
    };
  }, []);

  return (
    <div className={cn("relative flex min-h-0 flex-col", wrapperClassName)}>
      <div ref={ref} className={cn("min-h-0 flex-1", className)}>
        {children}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-bg to-transparent transition-opacity duration-200",
          hasMore ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
