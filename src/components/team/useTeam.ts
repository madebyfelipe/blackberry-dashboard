"use client";

import { useEffect, useState } from "react";

/*
 * O time da agência no navegador: quem aparece nos menus de @ e de
 * responsável. Uma busca por aba, dividida por todo mundo que pede — o menu
 * de menção abre em vários campos da mesma tela, e cada um buscar de novo
 * seria um pedido por campo.
 */

export type TeamPerson = { id: string; name: string; handle: string };

let cache: Promise<TeamPerson[]> | null = null;

function load(): Promise<TeamPerson[]> {
  cache ??= fetch("/api/team", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : { members: [] }))
    .then((data) => (Array.isArray(data.members) ? data.members : []))
    .catch(() => {
      // Falhou: a próxima abertura tenta de novo em vez de ficar sem time.
      cache = null;
      return [];
    });
  return cache;
}

/** Esquece o time guardado — depois de alguém trocar o @, por exemplo. */
export function forgetTeam() {
  cache = null;
}

export function useTeam(): TeamPerson[] {
  const [team, setTeam] = useState<TeamPerson[]>([]);
  useEffect(() => {
    let vivo = true;
    void load().then((t) => vivo && setTeam(t));
    return () => {
      vivo = false;
    };
  }, []);
  return team;
}
