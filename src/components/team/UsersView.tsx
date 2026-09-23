"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { anchorMenu, useCloseOnScroll, type MenuPosition } from "@/components/ui/anchoredMenu";
import { cn } from "@/lib/cn";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Screen, ScreenAction, ScreenHeader, ScreenIconAction, FieldLabel } from "@/components/ui/Screen";
import { TabStrip } from "@/components/ui/Tabs";
import { Toolbar, ToolbarButton, ToolbarDivider, ToolbarSearch } from "@/components/ui/Toolbar";
import { SelectionBar } from "@/components/ui/SelectionBar";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { ModalShell, chipState, modalBodyInput, modalChip, modalPrimary, modalTitleInput } from "@/components/ui/ModalShell";
import {
  Cell,
  Checkbox,
  ColumnsProvider,
  HeadCell,
  TableBody,
  TableFrame,
  TableHead,
  TableRow,
} from "@/components/ui/DataTable";
import { useColumnWidths } from "@/components/ui/useColumnWidths";
import { tableMinWidth, type ColumnSpec } from "@/lib/ui/columns";
import { initialsOf } from "@/components/ui/Mark";
import { formatShortDate } from "@/lib/format";
import type { MemberRole, MemberStatus, TeamSettings } from "@/lib/inbox/types";
import {
  MEMBER_ROLES,
  MEMBER_STATUSES,
  ROLE_LABEL,
  STATUS_BY_ID,
  lastSeenLabel,
  matchesMember,
} from "@/lib/inbox/users";
import type { UserRow } from "@/lib/team/rows";
import { forgetTeam } from "./useTeam";
import {
  ArchiveIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  EllipsisIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  ListIcon,
  MailIcon,
  PencilIcon,
  RotateIcon,
  Settings2Icon,
  ShieldIcon,
  SlidersIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";

/*
 * Usuários — export "Usuários · Painel (Lista)".
 *
 * O time da agência: as mesmas pessoas do Inbox, das menções e dos fluxos
 * (ver `lib/inbox`). "Adicionar usuário" cria um convite pendente com link de
 * cadastro — a pessoa entra no time ao criar a conta por ele. Não há disparo
 * de e-mail no produto, então o link é copiado para quem convidou mandar.
 *
 * Quem não é Admin nem Gerente vê a lista, mas não mexe: a trava é do
 * repositório, e a tela só não oferece o que seria recusado.
 */

type Tab = "todos" | MemberStatus;

const NOME: ColumnSpec = { id: "nome", label: "Nome", width: 240, flex: true };
const COLUMNS: ColumnSpec[] = [
  { id: "email", label: "E-mail", width: 220 },
  { id: "funcao", label: "Função", width: 130 },
  { id: "status", label: "Status", width: 150 },
  { id: "acesso", label: "Último acesso", width: 120 },
  { id: "criado", label: "Criado em", width: 110 },
];
const ALL_SPECS = [NOME, ...COLUMNS];

function absolute(path: string): string {
  return typeof window === "undefined" ? path : `${window.location.origin}${path}`;
}

export function UsersView({
  initialUsers,
  meId,
  canManage,
  initialSettings,
  myEmail,
}: {
  initialUsers: UserRow[];
  meId: string;
  canManage: boolean;
  initialSettings: TeamSettings;
  myEmail: string;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [domainOpen, setDomainOpen] = useState(false);
  const { toast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [tab, setTab] = useState<Tab>("todos");
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<MemberRole[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; user: UserRow } | null>(null);
  /** A linha com o menu aberto, e onde está o botão que o abriu. */
  const [menu, setMenu] = useState<{ id: string; anchor: DOMRect } | null>(null);

  const visible = useMemo(
    () =>
      users
        .filter((u) => (tab === "todos" ? u.status !== "arquivado" : u.status === tab))
        .filter((u) => roles.length === 0 || roles.includes(u.role))
        .filter((u) => matchesMember(u, search))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [users, tab, roles, search],
  );
  const visibleIds = visible.map((u) => u.id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));

  const countOf = (s: MemberStatus) => users.filter((u) => u.status === s).length;
  const requests = users.filter((u) => u.joinRequest);

  function replace(user: UserRow) {
    setUsers((all) => all.map((u) => (u.id === user.id ? user : u)));
    forgetTeam();
  }

  async function call<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar.");
    return data as T;
  }

  async function patch(user: UserRow, body: Partial<Pick<UserRow, "name" | "role" | "status">>, done?: string) {
    try {
      const data = await call<{ user: UserRow }>(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      replace(data.user);
      if (done) toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    }
  }

  async function remove(user: UserRow) {
    try {
      await call(`/api/users/${user.id}`, { method: "DELETE" });
      setUsers((all) => all.filter((u) => u.id !== user.id));
      setSelected((s) => {
        const n = new Set(s);
        n.delete(user.id);
        return n;
      });
      toast(`Convite de ${user.name} excluído.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível excluir.", "error");
    }
  }

  async function copyInvite(user: UserRow, renew = false) {
    try {
      let path = user.invitePath;
      if (renew || !path) {
        const data = await call<{ user: UserRow }>(`/api/users/${user.id}/convite`, { method: "POST" });
        replace(data.user);
        path = data.user.invitePath;
      }
      if (!path) return;
      await navigator.clipboard.writeText(absolute(path));
      toast(renew ? "Link novo copiado — o anterior deixou de valer." : "Link do convite copiado. Mande para a pessoa.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não deu para copiar o link.", "error");
    }
  }

  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const guard = (fn: () => void) => () => {
    if (!canManage) return toast("Só Admin e Gerente mexem no time.", "info");
    fn();
  };

  const soon = (what: string) => toast(`${what} chega com o desenho dele.`, "info");

  return (
    <Screen gap="md">
      <Breadcrumb items={[{ label: "black berry", href: "/tarefas" }, { label: "Usuários" }]} />

      <ScreenHeader
        actions={
          <>
            <ScreenAction onClick={guard(() => setModal({ mode: "create" }))}>Adicionar usuário</ScreenAction>
            <ScreenIconAction label="Domínio da agência" onClick={guard(() => setDomainOpen(true))}>
              <EllipsisIcon size={16} />
            </ScreenIconAction>
          </>
        }
      >
        <TabStrip
          tabs={[
            { id: "todos", label: "Todos" },
            ...MEMBER_STATUSES.slice(0, 3).map((s) => ({ id: s.id, label: s.tab, count: countOf(s.id) })),
          ]}
          overflow={MEMBER_STATUSES.slice(3).map((s) => ({ id: s.id, label: s.tab, count: countOf(s.id) }))}
          active={tab}
          onSelect={(id) => setTab(id as Tab)}
          overflowLabel="Mais status"
        />
      </ScreenHeader>

      {requests.length > 0 && canManage && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-border bg-surface-2 px-4 py-3">
          <p className="text-[13px] text-fg-soft">
            {requests.length === 1
              ? `${requests[0].name} pediu para entrar pelo domínio @${settings.domain ?? "—"}.`
              : `${requests.length} pessoas pediram para entrar pelo domínio @${settings.domain ?? "—"}.`}
          </p>
          <button
            type="button"
            onClick={() => setTab("convite")}
            className="tap rounded-mark bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-on-primary hover:bg-white"
          >
            Revisar
          </button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
        <Toolbar
          right={
            <>
              <div className="flex gap-0.5 rounded-mark bg-surface-2 p-0.5" role="group" aria-label="Visualização">
                <span className="flex h-6 w-7 items-center justify-center rounded-[5px] bg-border text-fg-soft" aria-label="Lista">
                  <ListIcon size={14} />
                </span>
                <button
                  type="button"
                  aria-label="Grade"
                  onClick={() => soon("A grade de usuários")}
                  className="flex h-6 w-7 items-center justify-center rounded-[5px] text-muted hover:text-fg-soft"
                >
                  <LayoutGridIcon size={14} />
                </button>
              </div>
              <ToolbarDivider />
              <ToolbarButton
                icon={<Settings2Icon size={15} />}
                label="Personalizar"
                onClick={() => soon("O menu Personalizar de usuários")}
              />
            </>
          }
        >
          <Popover
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            align="left"
            trigger={
              <ToolbarButton
                icon={<SlidersIcon size={15} />}
                label="Filtros"
                active={filtersOpen || roles.length > 0}
                badge={roles.length || undefined}
                aria-haspopup="menu"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((o) => !o)}
              />
            }
          >
            <div className="w-[220px] animate-pop-in rounded-menu border border-border bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.6px] text-label">Função</p>
              {MEMBER_ROLES.map((r) => {
                const on = roles.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={on}
                    onClick={() => setRoles((rs) => (on ? rs.filter((x) => x !== r.id) : [...rs, r.id]))}
                    className="flex w-full items-center gap-2 rounded-mark px-2 py-[7px] text-left text-[13px] text-fg-soft hover:bg-row-raised"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-check",
                        on ? "bg-primary text-on-primary" : "inset-ring-1 inset-ring-badge",
                      )}
                    >
                      {on && <CheckIcon size={11} strokeWidth={3} />}
                    </span>
                    {r.label}
                  </button>
                );
              })}
              {roles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRoles([])}
                  className="mt-1 w-full rounded-mark px-2 py-[7px] text-left text-[12px] text-muted hover:bg-row-raised hover:text-fg-soft"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </Popover>
          <ToolbarDivider />
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Buscar usuários" />
        </Toolbar>

        <div className="min-h-0 flex-1">
          {visible.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8">
              <p className="max-w-[300px] text-center text-[13px] leading-[19px] text-muted">
                {search || roles.length || tab !== "todos"
                  ? "Ninguém com esse filtro."
                  : "Só você por aqui. Chame o time em “Adicionar usuário”."}
              </p>
            </div>
          ) : (
            <UsersTable
              users={visible}
              meId={meId}
              selected={selected}
              allSelected={visibleIds.length > 0 && selectedVisible.length === visibleIds.length}
              someSelected={selectedVisible.length > 0}
              onToggle={toggleOne}
              onToggleAll={(next) => setSelected(next ? new Set(visibleIds) : new Set())}
              onOpen={(u) => (canManage ? setModal({ mode: "edit", user: u }) : undefined)}
              menuFor={menu?.id ?? null}
              onMenu={(id, anchor) => setMenu(id && anchor ? { id, anchor } : null)}
              rowMenu={(u) => (
                <RowMenu
                  user={u}
                  isMe={u.id === meId}
                  onEdit={guard(() => setModal({ mode: "edit", user: u }))}
                  onResend={guard(() => void copyInvite(u, true))}
                  onCopy={guard(() => void copyInvite(u))}
                  onResetPassword={() =>
                    toast(
                      `${u.name} redefine a senha em “Esqueceu a senha?”, na tela de entrada.`,
                      "info",
                    )
                  }
                  onPermissions={() => soon("A tela de permissões")}
                  onArchive={guard(() =>
                    void patch(
                      u,
                      { status: u.status === "arquivado" ? "ativo" : "arquivado" },
                      u.status === "arquivado" ? `${u.name} voltou ao time.` : `${u.name} arquivado.`,
                    ),
                  )}
                  onToggleActive={guard(() =>
                    void patch(
                      u,
                      { status: u.status === "inativo" ? "ativo" : "inativo" },
                      u.status === "inativo" ? `${u.name} reativado.` : `${u.name} inativo — deixa de receber tarefas.`,
                    ),
                  )}
                  onDelete={guard(() => void remove(u))}
                  onApprove={guard(() => void patch(u, { status: "ativo" }, `${u.name} entrou no time.`))}
                  onReject={guard(() => void patch(u, { status: "arquivado" }, `Pedido de ${u.name} recusado.`))}
                  anchor={menu!.anchor}
                  onClose={() => setMenu(null)}
                />
              )}
            />
          )}
        </div>

        <SelectionBar
          count={selectedVisible.length}
          noun={["usuário selecionado", "usuários selecionados"]}
          onClear={() => setSelected(new Set())}
          actions={[
            {
              label: "Copiar convites",
              icon: <MailIcon size={16} />,
              onSelect: guard(async () => {
                const links = users
                  .filter((u) => selected.has(u.id) && u.invitePath)
                  .map((u) => `${u.name} <${u.email}>: ${absolute(u.invitePath!)}`);
                if (links.length === 0) return toast("Nenhum convite pendente na seleção.", "info");
                await navigator.clipboard.writeText(links.join("\n"));
                toast(`${links.length} ${links.length === 1 ? "convite copiado" : "convites copiados"}.`);
              }),
            },
            {
              label: "Arquivar",
              icon: <ArchiveIcon size={16} />,
              onSelect: guard(async () => {
                const targets = users.filter(
                  (u) => selected.has(u.id) && u.id !== meId && (u.status === "ativo" || u.status === "inativo"),
                );
                for (const u of targets) await patch(u, { status: "arquivado" });
                toast(
                  targets.length
                    ? `${targets.length} ${targets.length === 1 ? "usuário arquivado" : "usuários arquivados"}.`
                    : "Nada para arquivar: convites são excluídos, e você não arquiva a si mesmo.",
                  targets.length ? "success" : "info",
                );
                setSelected(new Set());
              }),
            },
            {
              label: "Excluir",
              icon: <TrashIcon size={16} />,
              danger: true,
              onSelect: guard(async () => {
                const targets = users.filter((u) => selected.has(u.id) && u.status === "convite");
                if (targets.length === 0) {
                  return toast("Só convite pendente é excluído — quem já trabalhou é arquivado.", "info");
                }
                for (const u of targets) await remove(u);
              }),
            },
            {
              label: "Mais",
              icon: <EllipsisIcon size={16} />,
              onSelect: () => soon("Mais ações da seleção"),
            },
          ]}
        />
      </div>

      {domainOpen && (
        <DomainDialog
          settings={settings}
          myEmail={myEmail}
          onClose={() => setDomainOpen(false)}
          onSaved={(s) => {
            setSettings(s);
            setDomainOpen(false);
          }}
          call={call}
        />
      )}

      {modal && (
        <UserModal
          state={modal}
          meId={meId}
          onClose={() => setModal(null)}
          onCreated={(u) => {
            setUsers((all) => [...all, u]);
            forgetTeam();
          }}
          onSaved={(u) => replace(u)}
          call={call}
          onCopyInvite={(u) => void copyInvite(u)}
        />
      )}
    </Screen>
  );
}

/* ================================================================ lista */

function UsersTable({
  users,
  meId,
  selected,
  allSelected,
  someSelected,
  onToggle,
  onToggleAll,
  onOpen,
  menuFor,
  onMenu,
  rowMenu,
}: {
  users: UserRow[];
  meId: string;
  selected: ReadonlySet<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: (next: boolean) => void;
  onOpen: (u: UserRow) => void;
  menuFor: string | null;
  onMenu: (id: string | null, anchor?: DOMRect) => void;
  rowMenu: (u: UserRow) => React.ReactNode;
}) {
  const api = useColumnWidths("usuarios.lista", ALL_SPECS);
  // 32 (pontas) + 18 (seleção) + 32 (botão de ações) + os vãos.
  const minWidth = tableMinWidth(ALL_SPECS, api.widths, 32 + 18 + 32 + 16);

  return (
    <ColumnsProvider value={api}>
      <TableFrame minWidth={minWidth}>
        <TableHead>
          <Checkbox
            label="Selecionar todos os usuários"
            checked={allSelected}
            indeterminate={!allSelected && someSelected}
            onChange={onToggleAll}
          />
          <HeadCell spec={NOME}>
            <FieldLabel>Nome</FieldLabel>
            <ChevronDownIcon size={13} className="text-label" />
          </HeadCell>
          {COLUMNS.map((c) => (
            <HeadCell key={c.id} spec={c}>
              <FieldLabel>{c.label}</FieldLabel>
            </HeadCell>
          ))}
          <span className="w-8 shrink-0" aria-hidden="true" />
        </TableHead>

        <TableBody>
          {users.map((u, i) => {
            const status = u.joinRequest
              ? { ...STATUS_BY_ID.convite, label: "Pediu para entrar" }
              : STATUS_BY_ID[u.status];
            return (
              <TableRow key={u.id} index={i} selected={selected.has(u.id)} onClick={() => onOpen(u)}>
                <Checkbox
                  label={`Selecionar ${u.name}`}
                  checked={selected.has(u.id)}
                  onChange={() => onToggle(u.id)}
                />
                <Cell spec={NOME}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-surface-2 text-[11px] font-semibold text-initials-strong">
                      {initialsOf(u.name)}
                    </span>
                    <span className="truncate text-[13px] font-medium text-fg">{u.name}</span>
                    {/* O @ não está no export; entra discreto porque é por ele que se marca e atribui. */}
                    <span className="shrink-0 truncate text-[12px] text-dim">@{u.handle}</span>
                    {u.id === meId && (
                      <span className="shrink-0 rounded-mark bg-border px-1.5 py-0.5 text-[10px] font-medium text-fg-3">você</span>
                    )}
                  </span>
                </Cell>
                <Cell spec={COLUMNS[0]}>
                  <span className="truncate text-[13px] text-muted">{u.email || "—"}</span>
                </Cell>
                <Cell spec={COLUMNS[1]}>
                  <span className="truncate text-[13px] text-fg-soft">{ROLE_LABEL[u.role]}</span>
                </Cell>
                <Cell spec={COLUMNS[2]}>
                  <span
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-mark px-2 py-1 text-[11.5px] font-medium"
                    style={{ backgroundColor: status.bg, color: status.fg }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.fg }} />
                    {status.label}
                  </span>
                </Cell>
                <Cell spec={COLUMNS[3]}>
                  <span className="truncate text-[13px] text-muted">{lastSeenLabel(u.lastSeenAt)}</span>
                </Cell>
                <Cell spec={COLUMNS[4]}>
                  <span className="truncate text-[13px] text-muted">{formatShortDate(u.createdAt)}</span>
                </Cell>
                <span className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-label={`Ações de ${u.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menuFor === u.id}
                    onClick={(e) =>
                      onMenu(menuFor === u.id ? null : u.id, e.currentTarget.getBoundingClientRect())
                    }
                    className="flex h-7 w-8 items-center justify-center rounded-mark text-muted transition-colors hover:bg-border hover:text-fg-soft"
                  >
                    <EllipsisIcon size={16} />
                  </button>
                  {menuFor === u.id && rowMenu(u)}
                </span>
              </TableRow>
            );
          })}
        </TableBody>
      </TableFrame>
    </ColumnsProvider>
  );
}

function RowMenu({
  user,
  isMe,
  onEdit,
  onResend,
  onCopy,
  onResetPassword,
  onPermissions,
  onArchive,
  onToggleActive,
  onDelete,
  onApprove,
  onReject,
  anchor,
  onClose,
}: {
  user: UserRow;
  onApprove: () => void;
  onReject: () => void;
  anchor: DOMRect;
  isMe: boolean;
  onEdit: () => void;
  onResend: () => void;
  onCopy: () => void;
  onResetPassword: () => void;
  onPermissions: () => void;
  onArchive: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  /*
   * Por portal, no `body`: dentro da linha (que anima com `transform`) o menu
   * ficava atrás das linhas de baixo — ver `ui/anchoredMenu`.
   */
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPosition | null>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (m) setPos(anchorMenu(anchor, { width: m.offsetWidth, height: m.offsetHeight }, "right"));
  }, [anchor]);
  useCloseOnScroll(true, onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const invite = user.status === "convite";
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div
        ref={ref}
        role="menu"
        aria-label={`Ações de ${user.name}`}
        style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: "hidden" }}
        className="fixed z-[61] flex w-[238px] animate-pop-in flex-col gap-0.5 rounded-nav border border-border bg-overlay p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
      >
        {user.joinRequest && (
          <>
            <Item icon={<CheckIcon size={15} />} label="Aprovar entrada" onClick={run(onApprove)} />
            <Item icon={<XIcon size={15} />} label="Recusar" danger onClick={run(onReject)} />
            <div className="my-1 h-px bg-divider" />
          </>
        )}
        <Item icon={<PencilIcon size={15} />} label="Editar" onClick={run(onEdit)} />
        {user.joinRequest ? null : invite ? (
          <>
            <Item icon={<CopyIcon size={15} />} label="Copiar link do convite" onClick={run(onCopy)} />
            <Item icon={<MailIcon size={15} />} label="Reenviar acesso" onClick={run(onResend)} />
          </>
        ) : (
          <Item icon={<KeyRoundIcon size={15} />} label="Redefinir senha" onClick={run(onResetPassword)} />
        )}
        <Item icon={<ShieldIcon size={15} />} label="Permissões" onClick={run(onPermissions)} />
        {!isMe && !invite && (
          <>
            <div className="my-1 h-px bg-divider" />
            {user.status !== "arquivado" && (
              <Item
                icon={<RotateIcon size={15} />}
                label={user.status === "inativo" ? "Reativar" : "Marcar como inativo"}
                onClick={run(onToggleActive)}
              />
            )}
            <Item
              icon={<ArchiveIcon size={15} />}
              label={user.status === "arquivado" ? "Desarquivar" : "Arquivar"}
              onClick={run(onArchive)}
            />
          </>
        )}
        {invite && !user.joinRequest && (
          <>
            <div className="my-1 h-px bg-divider" />
            <Item icon={<TrashIcon size={15} />} label="Excluir" danger onClick={run(onDelete)} />
          </>
        )}
      </div>
    </>,
    document.body,
  );
}

function Item({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-chip px-2.5 text-left text-[13px] transition-colors hover:bg-rule focus-visible:bg-rule focus-visible:outline-none",
        danger ? "text-danger" : "text-fg-soft",
      )}
    >
      <span className={danger ? "text-danger" : "text-fg-3"}>{icon}</span>
      {label}
    </button>
  );
}

/* ============================================ adicionar / editar usuário */

function UserModal({
  state,
  meId,
  onClose,
  onCreated,
  onSaved,
  call,
  onCopyInvite,
}: {
  state: { mode: "create" } | { mode: "edit"; user: UserRow };
  meId: string;
  onClose: () => void;
  onCreated: (u: UserRow) => void;
  onSaved: (u: UserRow) => void;
  call: <T>(url: string, init: RequestInit) => Promise<T>;
  onCopyInvite: (u: UserRow) => void;
}) {
  const { toast } = useToast();
  const editing = state.mode === "edit" ? state.user : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [role, setRole] = useState<MemberRole>(editing?.role ?? "editor");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<UserRow | null>(null);

  async function submit() {
    if (saving || !name.trim() || (!editing && !email.trim())) return;
    setSaving(true);
    try {
      if (editing) {
        const data = await call<{ user: UserRow }>(`/api/users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, role }),
        });
        onSaved(data.user);
        toast("Usuário atualizado.");
        onClose();
      } else {
        const data = await call<{ user: UserRow }>("/api/users", {
          method: "POST",
          body: JSON.stringify({ name, email, role }),
        });
        onCreated(data.user);
        setCreated(data.user);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  // Convite criado: o mesmo modal mostra o link para copiar e mandar.
  if (created) {
    return (
      <ModalShell
        trail={["Usuários"]}
        title="Convite criado"
        onClose={onClose}
        footerStart={<span className="text-[12px] text-muted">Vale até {created.name} entrar.</span>}
        footerEnd={
          <button type="button" onClick={onClose} className={modalPrimary}>
            Pronto
          </button>
        }
      >
        <p className={modalTitleInput}>{created.name}</p>
        <p className="text-[14px] leading-[21px] text-fg-soft">
          Entra no time ao criar a conta por este link. O black berry ainda não manda e-mail —
          envie por onde o time já conversa; “Reenviar acesso” gera outro se este se perder.
        </p>
        <div className="flex items-center gap-2 rounded-field bg-surface-2 py-1.5 pl-4 pr-1.5 inset-ring-1 inset-ring-border">
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-3">
            {created.invitePath ? absolute(created.invitePath) : "—"}
          </span>
          <button
            type="button"
            onClick={() => onCopyInvite(created)}
            className="tap flex shrink-0 items-center gap-1.5 rounded-pill bg-primary px-3.5 py-2 text-[12px] font-semibold text-on-primary hover:bg-white"
          >
            <CopyIcon size={13} /> Copiar link
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      trail={["Usuários"]}
      title={editing ? "Editar usuário" : "Adicionar usuário"}
      onClose={onClose}
      onSubmit={() => void submit()}
      chips={MEMBER_ROLES.map((r) => (
        <button
          key={r.id}
          type="button"
          aria-pressed={role === r.id}
          disabled={editing?.id === meId && r.id !== "admin" && r.id !== "gerente"}
          onClick={() => setRole(r.id)}
          className={cn(modalChip, chipState(role === r.id), "disabled:cursor-not-allowed disabled:opacity-40")}
        >
          {role === r.id && <CheckIcon size={13} />}
          {r.label}
        </button>
      ))}
      footerStart={
        <span className="text-[12px] text-muted">
          {editing ? `@${editing.handle}` : "Recebe um link de cadastro que entra no seu time."}
        </span>
      }
      footerEnd={
        <button
          type="submit"
          disabled={saving || !name.trim() || (!editing && !email.trim())}
          className={modalPrimary}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Spinner /> Salvando…
            </span>
          ) : editing ? (
            "Salvar"
          ) : (
            "Criar convite"
          )}
        </button>
      }
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da pessoa"
        aria-label="Nome"
        className={modalTitleInput}
      />
      <input
        type="email"
        value={email}
        readOnly={!!editing}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-mail (pessoa@agencia.com)"
        aria-label="E-mail"
        className={cn(modalBodyInput, "read-only:text-muted")}
      />
    </ModalShell>
  );
}

/* ================================================== domínio da agência */

function DomainDialog({
  settings,
  myEmail,
  onClose,
  onSaved,
  call,
}: {
  settings: TeamSettings;
  myEmail: string;
  onClose: () => void;
  onSaved: (s: TeamSettings) => void;
  call: <T>(url: string, init: RequestInit) => Promise<T>;
}) {
  const { toast } = useToast();
  const suggested = myEmail.includes("@") ? myEmail.split("@").pop()! : "";
  const [on, setOn] = useState(!!settings.domain);
  const [domain, setDomain] = useState(settings.domain ?? suggested);
  const [role, setRole] = useState<MemberRole>(settings.domainRole);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      const data = await call<{ settings: TeamSettings }>("/api/users/ajustes", {
        method: "PATCH",
        body: JSON.stringify({ domain: on ? domain : null, domainRole: role }),
      });
      onSaved(data.settings);
      toast(
        data.settings.domain
          ? `Convite automático ligado para @${data.settings.domain}.`
          : "Convite automático desligado.",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      trail={["Usuários"]}
      title="Domínio da agência"
      onClose={onClose}
      onSubmit={() => void submit()}
      chips={
        <>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => setOn((v) => !v)}
            className={cn(modalChip, chipState(on))}
          >
            <span className={cn("h-[7px] w-[7px] rounded-full", on ? "bg-flow-on" : "bg-badge-strong")} />
            {on ? "Convite automático ligado" : "Convite automático desligado"}
          </button>
          {on &&
            MEMBER_ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={role === r.id}
                onClick={() => setRole(r.id)}
                className={cn(modalChip, chipState(role === r.id))}
              >
                {role === r.id && <CheckIcon size={13} />}
                {r.label}
              </button>
            ))}
        </>
      }
      footerStart={
        <span className="text-[12px] text-muted">
          {on ? "Função com que os pedidos entram, se aprovados." : "Ninguém entra pelo domínio."}
        </span>
      }
      footerEnd={
        <button type="submit" disabled={saving} className={modalPrimary}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      }
    >
      <div className="flex items-baseline gap-1">
        <span className="text-[20px] font-semibold text-muted">@</span>
        <input
          autoFocus
          value={domain}
          disabled={!on}
          onChange={(e) => setDomain(e.target.value.replace(/^@+/, "").toLowerCase())}
          placeholder="estudionorte.com"
          aria-label="Domínio"
          className={cn(modalTitleInput, "disabled:text-muted")}
        />
      </div>
      <p className="text-[14px] leading-[21px] text-fg-soft">
        Quem criar conta com um e-mail deste domínio ganha um convite automático para o time e
        espera a aprovação de um Admin ou Gerente — o black berry ainda não confirma e-mail. Só
        vale o domínio do seu próprio e-mail; Gmail, Outlook e afins não.
      </p>
    </ModalShell>
  );
}
