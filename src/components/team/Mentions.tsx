"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { applyTrigger, matchesQuery, triggerAt, type Trigger } from "@/lib/editor/markdown";
import { CommandMenu, type Command } from "@/components/editor/CommandMenu";
import { useTeam, type TeamPerson } from "./useTeam";

/*
 * O @ nos campos de uma linha só — o comentário da tarefa, a mensagem do
 * Inbox, o responsável. O menu é o mesmo do briefing (export
 * "menu_comando_tarefas", no modo "Marque alguém..."), aberto logo abaixo do
 * campo: num `input` não dá para medir onde o cursor está, e o menu colado na
 * borda do campo é o que continua legível.
 *
 * O que entra no texto é sempre o @ (`@marina `), não o nome: é ele que é
 * único na agência, então é ele que diz de quem se está falando.
 */

const MENU_WIDTH = 264;
const MENU_HEIGHT = 300;

type Field = HTMLInputElement | HTMLTextAreaElement;

/** As pessoas que casam com o que foi digitado depois do @. */
export function peopleFor(team: TeamPerson[], query: string): TeamPerson[] {
  return team
    .filter((p) => matchesQuery(p.name, query) || matchesQuery(p.handle, query))
    .slice(0, 8);
}

export function useMentionInput<T extends Field>({
  value,
  onChange,
  field,
}: {
  value: string;
  onChange: (v: string) => void;
  field: React.RefObject<T | null>;
}) {
  const team = useTeam();
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [closed, setClosed] = useState<number | null>(null);

  const found: Trigger | null = caret === null ? null : triggerAt(value, caret);
  const trigger = found?.kind === "mencao" && closed !== found.from ? found : null;
  const people = trigger ? peopleFor(team, trigger.query) : [];
  const open = !!trigger && team.length > 0;

  function track(e: { currentTarget: T }) {
    const el = e.currentTarget;
    setCaret(el.selectionStart === el.selectionEnd ? el.selectionStart : null);
  }

  function pick(person: TeamPerson) {
    if (!trigger || caret === null) return;
    const result = applyTrigger(value, trigger, caret, `@${person.handle} `);
    onChange(result.text);
    setActive(0);
    setCaret(result.selection.start);
    requestAnimationFrame(() => {
      const el = field.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(result.selection.start, result.selection.start);
    });
  }

  /**
   * Devolve `true` quando a tecla era do menu — quem usa o hook não deve
   * tratá-la de novo (o Enter que escolhe alguém não pode enviar a mensagem).
   */
  function onKeyDown(e: React.KeyboardEvent<T>): boolean {
    if (!open) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = Math.max(1, people.length);
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
      return true;
    }
    if ((e.key === "Enter" || e.key === "Tab") && people.length > 0) {
      e.preventDefault();
      pick(people[Math.min(active, people.length - 1)]);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setClosed(trigger?.from ?? null);
      return true;
    }
    return false;
  }

  const inputProps = {
    onSelect: track,
    onKeyUp: track,
    onClick: track,
    onBlur: () => setCaret(null),
  };

  function menu() {
    if (!open || typeof document === "undefined") return null;
    const el = field.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const below = r.bottom + 6;
    const top = below + MENU_HEIGHT > window.innerHeight ? Math.max(8, r.top - 6 - MENU_HEIGHT) : below;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_WIDTH - 8));
    const commands: Command[] = people.map((p) => ({
      id: p.id,
      label: p.name,
      shortcut: `@${p.handle}`,
      run: () => pick(p),
    }));
    return createPortal(
      // O menu não pode roubar o foco: o clique cai nele antes do blur do campo.
      <div onMouseDown={(e) => e.preventDefault()}>
        <CommandMenu
          at={{ left, top }}
          trigger="@"
          query={trigger?.query ?? ""}
          groups={[commands]}
          active={Math.min(active, Math.max(0, commands.length - 1))}
          onActive={setActive}
          onPick={(c) => c.run()}
        />
      </div>,
      document.body,
    );
  }

  return { inputProps, onKeyDown, menu, open };
}

/**
 * Texto com as menções em destaque. Só vira destaque o @ de alguém do time —
 * um "@2x" num nome de arquivo continua texto comum.
 */
export function MentionText({ text, className }: { text: string; className?: string }) {
  const team = useTeam();
  const handles = new Set(team.map((p) => p.handle));
  const parts = text.split(/((?:^|(?<=[^a-z0-9._@]))@[a-z0-9](?:[a-z0-9._]*[a-z0-9])?)/gi);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        const handle = part.startsWith("@") ? part.slice(1).toLowerCase() : "";
        if (!handle || !handles.has(handle)) return part;
        const person = team.find((p) => p.handle === handle);
        return (
          <span
            key={i}
            title={person?.name}
            className={cn("rounded-mark bg-surface-2 px-1 font-medium text-fg")}
          >
            {part}
          </span>
        );
      })}
    </span>
  );
}
