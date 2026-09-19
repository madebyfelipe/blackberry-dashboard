"use client";

/**
 * Cabeçalho das telas de aprovação — mesma altura, mesmo tamanho de título e
 * mesma linha de ações nas duas telas (Lote e Editor de lote).
 *
 * Existe porque os dois cabeçalhos tinham escalas diferentes (24px/bold no lote
 * contra 20px/semibold no editor) e botões de tamanhos diferentes; centralizar
 * a tipografia aqui impede que voltem a divergir.
 */
export function ScreenHeader({
  title,
  subtitle,
  leading,
  children,
}: {
  title: string;
  /** Linha de apoio: cliente, contagem de peças, posição da peça… */
  subtitle: React.ReactNode;
  /** Slot antes do título — a seta de voltar do editor. */
  leading?: React.ReactNode;
  /** Ações à direita: botões redondos de 40px e, no máximo, uma pílula. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {leading}
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="truncate text-[24px] font-bold text-fg">{title}</h1>
          <p className="text-[13px] text-muted">{subtitle}</p>
        </div>
      </div>

      {children && (
        /*
         * `shrink-0` aqui travava a linha no tamanho de tudo somado e a
         * pílula vazava para fora da tela no celular; sem ele, as ações
         * quebram de linha e continuam inteiras.
         */
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
