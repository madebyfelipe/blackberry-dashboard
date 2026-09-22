"use client";

import { cn } from "@/lib/cn";

/*
 * Menu de comandos do texto — export "menu_comando_tarefas": painel de 264px,
 * a linha de busca com a tecla do gatilho, régua, e as linhas com o atalho à
 * direita.
 *
 * Quem digita não digita aqui: o cursor fica no texto e o que vem depois do
 * `/` (ou do `@`) aparece na linha de busca e filtra as opções. É por isso que
 * a busca é um texto, não um `input` — dois campos disputando o foco fariam o
 * cursor sair de onde o comando vai ser aplicado.
 */

export type Command = {
  id: string;
  label: string;
  /** "Ctrl Alt 1", como o desenho escreve. */
  shortcut?: string;
  run: () => void;
};

/** Onde o menu abre: coordenadas de viewport, calculadas junto ao cursor. */
export type MenuAt = { left: number; top: number };

export function CommandMenu({
  at,
  trigger,
  query,
  groups,
  active,
  onActive,
  onPick,
}: {
  at: MenuAt;
  /** "/" ou "@" — é o que a tecla da direita mostra. */
  trigger: string;
  query: string;
  /** Grupos do desenho: cada um vira um bloco separado por régua. */
  groups: Command[][];
  active: number;
  onActive: (index: number) => void;
  onPick: (command: Command) => void;
}) {
  const flat = groups.flat();

  return (
    <div
      role="menu"
      aria-label="Formatação"
      style={{ left: at.left, top: at.top }}
      className="fixed z-[70] w-[264px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center justify-between gap-3 px-2.5 py-[7px]">
        <span
          className={cn(
            "min-w-0 truncate text-[13px]",
            query ? "text-fg-soft" : "text-muted",
          )}
        >
          {query || (trigger === "@" ? "Marque alguém..." : "Buscar comando...")}
        </span>
        <span className="shrink-0 rounded-mark bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted inset-ring-1 inset-ring-border">
          {trigger}
        </span>
      </div>

      {flat.length === 0 ? (
        <>
          <Divider />
          <p className="px-2.5 py-1.5 text-[13px] text-muted">
            Nada com esse nome.
          </p>
        </>
      ) : (
        groups
          .filter((g) => g.length > 0)
          .map((group, gi) => (
            <div key={gi}>
              <Divider />
              {group.map((command) => {
                const index = flat.indexOf(command);
                return (
                  <button
                    key={command.id}
                    type="button"
                    role="menuitem"
                    // O foco não sai do texto: o menu é conduzido pelo teclado
                    // de lá (↑ ↓ Enter Esc) e pelo ponteiro aqui.
                    onMouseDown={(e) => e.preventDefault()}
                    onPointerEnter={() => onActive(index)}
                    onClick={() => onPick(command)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-mark px-2.5 py-1.5 text-left transition-colors",
                      index === active ? "bg-border" : "hover:bg-border",
                    )}
                  >
                    <span className="min-w-0 truncate text-[13px] text-fg-soft">
                      {command.label}
                    </span>
                    {command.shortcut && (
                      <span className="shrink-0 text-[11px] text-muted">
                        {command.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
      )}
    </div>
  );
}

function Divider() {
  return (
    <div className="p-1">
      <div className="h-px bg-border" />
    </div>
  );
}
