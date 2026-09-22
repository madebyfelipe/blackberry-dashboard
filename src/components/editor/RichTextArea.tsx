"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import {
  applyTrigger,
  currentBlock,
  duplicateSelection,
  insertLink,
  isEmptyLine,
  lineRange,
  matchesQuery,
  removeFormatting,
  toggleBlock,
  toggleCodeBlock,
  toggleInlineMark,
  triggerAt,
  type BlockKind,
  type EditResult,
  type InlineMark,
  type Selection,
  type Trigger,
} from "@/lib/editor/markdown";
import { CommandMenu, type Command } from "./CommandMenu";
import { FormatToolbar } from "./FormatToolbar";
import { MarkdownText } from "./MarkdownText";

/*
 * O campo de texto do briefing: o `textarea` de sempre, com os três menus do
 * desenho por cima.
 *
 * - linha vazia mostra o hint "/ para formatação" (export do pedido);
 * - `/` abre os comandos e `@` as pessoas (export "menu_comando_tarefas");
 * - texto selecionado abre o menu de formatação (export "menu_formatacao"),
 *   e o controle de título abre a lista de níveis no hover ("formatacao_hover").
 *
 * O texto continua sendo texto: as marcas são markdown (ver
 * `lib/editor/markdown.ts`), então o que se digita, o que se guarda e o que a
 * busca varre são a mesma string.
 *
 * Os dois menus e o hint saem por portal no `body`. A troca de tela do shell
 * anima com `transform` (`.animate-page-in`, `fill-mode: both`), e dentro de um
 * ancestral com transform um elemento `fixed` passa a se posicionar nele — os
 * menus nasceriam deslocados.
 */

const MENU_WIDTH = 264;
const TOOLBAR_WIDTH = 480;
const MARGIN = 12;

type At = { left: number; top: number };

export function RichTextArea({
  value,
  placeholder,
  onChange,
  onCommit,
  className,
  people = [],
  preview = false,
  onAttach,
  onComment,
  ...rest
}: {
  value: string;
  placeholder?: string;
  /** Avisa a cada tecla — para quem edita em rascunho (o modal da tarefa). */
  onChange?: (v: string) => void;
  /** Avisa quando o texto se firma: no blur e no "salvar agora" do menu. */
  onCommit: (v: string) => void;
  className?: string;
  /** Nomes que o menu de menção oferece — quem já aparece nesta tarefa. */
  people?: string[];
  /**
   * Fora da edição, mostra o markdown formatado em vez do texto cru. É o que
   * faz o menu de formatação ter efeito visível; clicar volta a editar.
   */
  preview?: boolean;
  /** "Anexar arquivos"/"Anexar imagens"; ausente, as linhas não aparecem. */
  onAttach?: (kind: "arquivos" | "imagens") => void;
  /** "Comentar o trecho": recebe o texto selecionado. */
  onComment?: (selected: string) => void;
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "placeholder"
>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value);
  const [sel, setSel] = useState<Selection>({ start: 0, end: 0 });
  const [focused, setFocused] = useState(false);
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [active, setActive] = useState(0);
  const [caretTop, setCaretTop] = useState(0);
  const [lineH, setLineH] = useState(21);
  /** Seleção a devolver ao DOM depois de um comando reescrever o texto. */
  const pending = useRef<Selection | null>(null);

  useEffect(() => setDraft(value), [value]);

  const reading = preview && !focused && draft.trim() !== "";

  // Altura acompanha o conteúdo — o campo não tem rolagem própria.
  useEffect(() => {
    const el = ref.current;
    if (!el || reading) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, reading]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !pending.current) return;
    const next = pending.current;
    pending.current = null;
    el.setSelectionRange(next.start, next.end);
    setSel(next);
  }, [draft]);

  /** Onde começa, em pixels dentro do campo, a linha em que o cursor está. */
  const measure = useCallback((text: string, caret: number) => {
    const el = ref.current;
    if (!el) return;
    setCaretTop(lineTop(el, text.slice(0, lineRange(text, caret).start)));
    const parsed = parseFloat(getComputedStyle(el).lineHeight);
    if (Number.isFinite(parsed)) setLineH(parsed);
  }, []);

  const sync = useCallback(
    (el: HTMLTextAreaElement) => {
      const next = { start: el.selectionStart, end: el.selectionEnd };
      setSel(next);
      const t = next.start === next.end ? triggerAt(el.value, next.start) : null;
      setTrigger(t);
      setActive(0);
      measure(el.value, next.start);
    },
    [measure],
  );

  /** Toda mudança de texto passa por aqui — inclusive a que vem dos menus. */
  function change(text: string) {
    setDraft(text);
    onChange?.(text);
  }

  /** Aplica um comando e deixa o cursor onde o comando pediu. */
  function apply(result: EditResult) {
    pending.current = result.selection;
    change(result.text);
    setTrigger(null);
  }

  const block = currentBlock(draft, sel.start);
  const selected = draft.slice(
    Math.min(sel.start, sel.end),
    Math.max(sel.start, sel.end),
  );

  /* --------------------------------------------------------- os comandos */

  const commandGroups: Command[][] = (() => {
    if (trigger?.kind === "mencao") {
      const rows = people
        .filter((p) => p && p !== "—" && matchesQuery(p, trigger.query))
        .slice(0, 8)
        .map((p) => ({
          id: `mencao-${p}`,
          label: p,
          run: () =>
            apply(applyTrigger(draft, trigger, sel.start, `@${p} `)),
        }));
      return [rows];
    }

    const query = trigger?.query ?? "";
    const make = (
      id: string,
      label: string,
      shortcut: string,
      run: () => void,
    ): Command => ({ id, label, shortcut, run });

    /** Um comando vindo do `/` primeiro apaga o gatilho, depois formata. */
    const afterTrigger = (change: (text: string, caret: number) => EditResult) => () => {
      if (!trigger) return apply(change(draft, sel.start));
      const cleaned = applyTrigger(draft, trigger, sel.start, "");
      return apply(change(cleaned.text, cleaned.selection.start));
    };

    const groups: Command[][] = [
      [
        make("h1", "Heading 1", "Ctrl Alt 1", afterTrigger((t, c) =>
          toggleBlock(t, { start: c, end: c }, "h1"),
        )),
        make("h2", "Heading 2", "Ctrl Alt 2", afterTrigger((t, c) =>
          toggleBlock(t, { start: c, end: c }, "h2"),
        )),
        make("h3", "Heading 3", "Ctrl Alt 3", afterTrigger((t, c) =>
          toggleBlock(t, { start: c, end: c }, "h3"),
        )),
      ],
      onAttach
        ? [
            make("arquivos", "Anexar arquivos", "Ctrl ↑ F", () => {
              setTrigger(null);
              onAttach("arquivos");
            }),
            make("imagens", "Anexar imagens", "Ctrl ↑ I", () => {
              setTrigger(null);
              onAttach("imagens");
            }),
          ]
        : [],
      [
        make("codigo", "Bloco de código", "Ctrl ↑ C", afterTrigger((t, c) =>
          toggleCodeBlock(t, { start: c, end: c }),
        )),
        make("bullet", "Bullet point", "Ctrl ↑ 8", afterTrigger((t, c) =>
          toggleBlock(t, { start: c, end: c }, "bullet"),
        )),
        make("numerada", "Lista numerada", "Ctrl ↑ 9", afterTrigger((t, c) =>
          toggleBlock(t, { start: c, end: c }, "numbered"),
        )),
      ],
    ];

    if (!query) return groups;
    return groups.map((g) => g.filter((c) => matchesQuery(c.label, query)));
  })();

  const flat = commandGroups.flat();
  const menuOpen = trigger !== null && flat.length > 0;

  /* ------------------------------------------------------------ atalhos */

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menuOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + step + flat.length) % flat.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        flat[active]?.run();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTrigger(null);
        return;
      }
    }

    const mod = e.ctrlKey || e.metaKey;
    const at = (kind: BlockKind) => {
      e.preventDefault();
      apply(toggleBlock(draft, sel, kind));
    };

    if (mod && e.altKey) {
      if (e.key === "1") return at("h1");
      if (e.key === "2") return at("h2");
      if (e.key === "3") return at("h3");
    }
    if (mod && e.shiftKey) {
      const key = e.key.toLowerCase();
      if (key === "8") return at("bullet");
      if (key === "9") return at("numbered");
      if (key === "c") {
        e.preventDefault();
        return apply(toggleCodeBlock(draft, sel));
      }
      if (key === "f" && onAttach) {
        e.preventDefault();
        return onAttach("arquivos");
      }
      if (key === "i" && onAttach) {
        e.preventDefault();
        return onAttach("imagens");
      }
    }
    if (mod && !e.altKey && !e.shiftKey) {
      const marks: Record<string, InlineMark> = {
        b: "bold",
        i: "italic",
        u: "underline",
      };
      const mark = marks[e.key.toLowerCase()];
      if (mark) {
        e.preventDefault();
        return apply(toggleInlineMark(draft, sel, mark));
      }
    }

    if (e.key === "Escape") {
      change(value);
      e.currentTarget.blur();
    }
  }

  /* ------------------------------------------------------------ posições */

  const rect = () => ref.current?.getBoundingClientRect();

  function menuAt(): At | null {
    const r = rect();
    if (!r) return null;
    return {
      left: Math.max(
        MARGIN,
        Math.min(r.left, window.innerWidth - MENU_WIDTH - MARGIN),
      ),
      top: r.top + caretTop + lineH + 6,
    };
  }

  function toolbarAt(): At | null {
    const r = rect();
    if (!r) return null;
    const above = r.top + caretTop - 52;
    return {
      left: Math.max(
        MARGIN,
        Math.min(r.left, window.innerWidth - TOOLBAR_WIDTH - MARGIN),
      ),
      top: above > MARGIN ? above : r.top + caretTop + lineH + 8,
    };
  }

  const menuPlace = menuOpen ? menuAt() : null;
  const toolbarPlace =
    focused && !menuOpen && selected.trim() !== "" ? toolbarAt() : null;
  const showHint =
    focused && !menuOpen && sel.start === sel.end && isEmptyLine(draft, sel.start);

  return (
    <div className="relative w-full">
      <textarea
        ref={ref}
        rows={1}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          change(e.target.value);
          sync(e.currentTarget);
        }}
        onSelect={(e) => sync(e.currentTarget)}
        onFocus={(e) => {
          setFocused(true);
          sync(e.currentTarget);
        }}
        onBlur={() => {
          setFocused(false);
          setTrigger(null);
          onCommit(draft.trim());
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full resize-none overflow-hidden rounded-mark bg-transparent px-1 py-0.5 -mx-1",
          "transition-colors placeholder:text-muted hover:bg-surface-2 focus:bg-surface-2 focus:outline-none",
          // Em leitura ele sai da tela mas continua no documento: é assim que
          // o Tab ainda chega no campo e a edição começa.
          reading && "absolute h-px w-px overflow-hidden p-0 opacity-0",
          className,
        )}
        {...rest}
      />

      {reading && (
        <div
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(draft.length, draft.length);
          }}
          className={cn(
            "w-full cursor-text rounded-mark px-1 py-0.5 -mx-1 transition-colors hover:bg-surface-2",
            className,
          )}
        >
          <MarkdownText text={draft} />
        </div>
      )}

      {/*
       * O hint mora dentro do campo (não em portal): ele acompanha a linha, e
       * um `absolute` aqui já faz isso porque o campo não rola por dentro. A
       * cor é `muted`, não `faint`: é texto para ler, e `faint` não passa no
       * contraste (ver a nota do token em `globals.css`).
       */}
      {showHint && (
        <span
          aria-hidden="true"
          style={{ top: caretTop, height: lineH }}
          className="pointer-events-none absolute left-0 flex select-none items-center text-[13px] text-muted"
        >
          / para formatação
        </span>
      )}

      {menuPlace &&
        trigger &&
        createPortal(
          <CommandMenu
            at={menuPlace}
            trigger={trigger.kind === "mencao" ? "@" : "/"}
            query={trigger.query}
            groups={commandGroups}
            active={active}
            onActive={setActive}
            onPick={(c) => c.run()}
          />,
          document.body,
        )}

      {toolbarPlace &&
        createPortal(
          <FormatToolbar
            at={toolbarPlace}
            block={block}
            onBlock={(kind) => apply(toggleBlock(draft, sel, kind))}
            onInline={(mark) => apply(toggleInlineMark(draft, sel, mark))}
            onLink={() => apply(insertLink(draft, sel))}
            onQuote={() => apply(toggleBlock(draft, sel, "quote"))}
            onClear={() => apply(removeFormatting(draft, sel))}
            onCodeBlock={() => apply(toggleCodeBlock(draft, sel))}
            onComment={onComment ? () => onComment(selected) : undefined}
            onBulletList={() => apply(toggleBlock(draft, sel, "bullet"))}
            onDuplicate={() => apply(duplicateSelection(draft, sel))}
            onSend={() => {
              onCommit(draft.trim());
              ref.current?.blur();
            }}
          />,
          document.body,
        )}
    </div>
  );
}

/**
 * Altura, em pixels, do topo da linha que começa depois de `upto`.
 *
 * Um espelho invisível com a mesma tipografia e a mesma largura do campo é a
 * única forma honesta de saber isso: contar "\n" e multiplicar por
 * `line-height` erra assim que uma linha longa quebra sozinha.
 */
function lineTop(el: HTMLTextAreaElement, upto: string): number {
  const cs = getComputedStyle(el);
  const mirror = document.createElement("div");
  const copy = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "textTransform",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderLeftWidth",
    "boxSizing",
  ] as const;
  for (const prop of copy) mirror.style[prop] = cs[prop];
  mirror.style.width = `${el.clientWidth}px`;
  mirror.style.position = "absolute";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.textContent = upto;

  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  mirror.remove();
  return top;
}
