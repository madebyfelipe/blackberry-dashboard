"use client";

import { cn } from "@/lib/cn";
import { parseMarkdown, type Inline } from "@/lib/editor/markdown";

/*
 * O texto do briefing como ele se lê.
 *
 * O menu de formatação escreve markdown (ver `lib/editor/markdown.ts`); isto
 * é a outra metade: fora do modo de edição, `## Objetivo` aparece como título
 * e `**prazo**` como negrito. Clicar volta ao texto cru, que é o que se
 * digita — sem dois estados de dado, só dois jeitos de mostrar o mesmo.
 *
 * A tipografia sai dos tamanhos que as telas já usam; nada aqui inventa
 * hierarquia nova.
 */

export function MarkdownText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseMarkdown(text);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "heading": {
            const size =
              block.level === 1
                ? "text-[17px] text-fg"
                : block.level === 2
                  ? "text-[15px] text-fg"
                  : "text-[14px] text-fg-soft";
            return (
              <p key={i} className={cn("font-semibold leading-snug", size)}>
                <Spans spans={block.spans} />
              </p>
            );
          }
          case "quote":
            return (
              <p
                key={i}
                className="border-l-2 border-border-strong pl-3 text-fg-3 italic"
              >
                <Spans spans={block.spans} />
              </p>
            );
          case "code":
            return (
              <pre
                key={i}
                className="overflow-x-auto rounded-mark bg-surface-2 px-3 py-2 text-[12px] text-fg-3"
              >
                <code>{block.text}</code>
              </pre>
            );
          case "list":
            return (
              <ul key={i} className="flex flex-col gap-1 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="shrink-0 text-muted">
                      {block.ordered ? `${j + 1}.` : "•"}
                    </span>
                    <span className="min-w-0">
                      <Spans spans={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          default:
            return (
              <p key={i} className="whitespace-pre-wrap break-words">
                <Spans spans={block.spans} />
              </p>
            );
        }
      })}
    </div>
  );
}

function Spans({ spans }: { spans: Inline[] }) {
  return (
    <>
      {spans.map((span, i) => {
        const className = cn(
          span.bold && "font-semibold text-fg",
          span.italic && "italic",
          span.strike && "line-through",
          span.underline && "underline",
          span.code &&
            "rounded-[4px] bg-surface-2 px-1 py-0.5 font-mono text-[12px]",
          span.href && "underline decoration-border-strong underline-offset-2",
        );
        return (
          <span key={i} className={className || undefined}>
            {span.text}
          </span>
        );
      })}
    </>
  );
}
