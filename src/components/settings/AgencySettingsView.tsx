"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRightIcon,
  Building2Icon,
  CalendarIcon,
  CheckIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  FilePlusIcon,
  GlobeIcon,
  HandshakeIcon,
  HardDriveIcon,
  ImagePlayIcon,
  KeyRoundIcon,
  PhoneCallIcon,
  PlugIcon,
  RadioIcon,
  ShieldCheckIcon,
  Trash2Icon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UploadIcon,
  UserPlusIcon,
  UsersIcon,
  WorkflowIcon,
} from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import {
  ADJUSTMENT_INDEXES,
  CONTRACT_CYCLES,
  PAYMENT_KINDS,
  agencyInitials,
  type AgencySettings,
  type ClientDefaults,
} from "@/lib/agency/settings";
import type { IntegrationId, IntegrationStatus } from "@/lib/agency/integrations";
import type { MemberRole, TeamSettings } from "@/lib/inbox/types";
import { MEMBER_ROLES } from "@/lib/inbox/users";
import {
  BareInput,
  Field,
  FieldBox,
  HeaderButton,
  IconBox,
  PageNav,
  Pill,
  Row,
  Section,
  Segmented,
  SelectBox,
  SettingsBody,
  SettingsShell,
  SmallButton,
  Sub,
  type SettingsTab,
} from "./kit";

/*
 * Configurações › Agência (export "Configurações · Agência"): identidade da
 * agência, entrada pelo domínio, atalhos, padrões para cliente novo,
 * integrações e a zona de perigo. Só Admin e Gerente chegam aqui; excluir a
 * agência é só de Admin.
 *
 * Mesma lógica de rascunho da aba Pessoal. O logo sobe na hora (é arquivo);
 * o resto espera "Salvar alterações".
 *
 * Fora do desenho, de propósito: "Exportar dados da agência" (descartado pelo
 * Felipe) e SVG no logo (o arquivo é servido pelo próprio app, e SVG pode
 * carregar script — ver `PROFILE_IMAGE_POLICY`).
 */

type Draft = {
  name: string;
  domain: string;
  domainRole: MemberRole;
  defaults: ClientDefaults;
};

const INTEGRATION_TEXT: Record<IntegrationId, { label: string; note: string; icon: React.ReactNode }> = {
  "tempo-real": { label: "Tempo real", note: "Conversas, presença e avisos instantâneos", icon: <RadioIcon size={16} /> },
  chamadas: { label: "Chamadas", note: "Áudio, vídeo e tela compartilhada", icon: <PhoneCallIcon size={16} /> },
  gifs: { label: "GIFs", note: "Busca de GIFs nas conversas", icon: <ImagePlayIcon size={16} /> },
  armazenamento: { label: "Armazenamento", note: "Arquivos, peças e anexos", icon: <HardDriveIcon size={16} /> },
  banco: { label: "Banco de dados", note: "Todos os dados da agência", icon: <DatabaseIcon size={16} /> },
};

/** Onde está o passo a passo das variáveis — o README do repositório. */
const SETUP_HELP = "https://github.com/madebyfelipe/blackberry-dashboard#vari%C3%A1veis-de-ambiente";

const NO_FLOW = "__padrao__";
const NO_DAY = "__sem__";
const NO_INDEX = "__sem__";
const NO_PAYMENT = "__sem__";

export function AgencySettingsView({
  tabs,
  name,
  settings,
  team,
  viewerEmail,
  canDelete,
  counts,
  flows,
  integrations,
}: {
  tabs: SettingsTab[];
  name: string;
  settings: AgencySettings;
  team: TeamSettings;
  viewerEmail: string;
  canDelete: boolean;
  counts: { members: number; invites: number; activeFlows: number; draftFlows: number };
  flows: { id: string; name: string }[];
  integrations: IntegrationStatus[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const initial: Draft = useMemo(
    () => ({ name, domain: team.domain ?? "", domainRole: team.domainRole, defaults: settings.clientDefaults }),
    [name, team.domain, team.domainRole, settings.clientDefaults],
  );
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);

  const changes =
    Number(draft.name.trim() !== saved.name.trim()) +
    Number(draft.domain.trim() !== saved.domain.trim()) +
    Number(draft.domainRole !== saved.domainRole) +
    (Object.keys(draft.defaults) as (keyof ClientDefaults)[]).filter((k) => draft.defaults[k] !== saved.defaults[k])
      .length;

  const setDefaults = (patch: Partial<ClientDefaults>) =>
    setDraft((d) => ({ ...d, defaults: { ...d.defaults, ...patch } }));

  async function save() {
    if (!changes || saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (draft.name.trim() !== saved.name.trim()) body.name = draft.name.trim();
      if (draft.domain.trim() !== saved.domain.trim() || draft.domainRole !== saved.domainRole) {
        body.domain = draft.domain.trim() || null;
        body.domainRole = draft.domainRole;
      }
      if (JSON.stringify(draft.defaults) !== JSON.stringify(saved.defaults)) body.clientDefaults = draft.defaults;
      const res = await fetch("/api/configuracoes/agencia", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar.");
      const next = { ...draft, name: draft.name.trim(), domain: draft.domain.trim().replace(/^@/, "") };
      setSaved(next);
      setDraft(next);
      toast("Alterações salvas.");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  const nav = [
    { id: "agencia", label: "Agência", icon: <Building2Icon size={15} /> },
    { id: "atalhos", label: "Atalhos", icon: <ArrowUpRightIcon size={15} /> },
    { id: "padroes", label: "Padrões para cliente novo", icon: <FilePlusIcon size={15} /> },
    { id: "integracoes", label: "Integrações", icon: <PlugIcon size={15} /> },
    ...(canDelete ? [{ id: "perigo", label: "Zona de perigo", icon: <TriangleAlertIcon size={15} />, danger: true }] : []),
  ];

  const domainOn = !!saved.domain;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <SettingsShell
      tab="agencia"
      tabs={tabs}
      dirty={changes > 0}
      actions={
        <>
          <span className="hidden text-[12px] text-muted xl:inline">
            {changes > 0
              ? `${changes} ${changes === 1 ? "alteração não salva" : "alterações não salvas"}`
              : "Visível para Admin e Gerente"}
          </span>
          <HeaderButton className="hidden md:flex" disabled={!changes || saving} onClick={() => setDraft(saved)}>
            Descartar
          </HeaderButton>
          <HeaderButton primary disabled={!changes || saving} onClick={() => void save()}>
            {saving ? <Spinner /> : <CheckIcon size={14} />}
            <span className="hidden sm:inline">Salvar alterações</span>
            <span className="sm:hidden">Salvar</span>
          </HeaderButton>
        </>
      }
    >
      <SettingsBody
        nav={
          <PageNav
            items={nav}
            footer={
              <div className="flex flex-col gap-1.5 rounded-[10px] border border-rule bg-flow-panel p-3">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-fg-soft">
                  <ShieldCheckIcon size={13} className="text-fg-3" /> Quem vê esta aba
                </span>
                <span className="text-[11.5px] text-muted">Admin e Gerente. As outras pessoas só veem a aba Pessoal.</span>
              </div>
            }
          />
        }
      >
        <Section id="agencia" title="Agência" note="Identidade da agência e quem pode entrar sem convite.">
          <LogoRow name={draft.name || name} logoUrl={logoUrl} onChange={setLogoUrl} />
          <div className="flex flex-col gap-4 px-5 pb-5 pt-4 md:flex-row">
            <Field label="Nome da agência" htmlFor="agencia-nome" help="Aparece para a equipe e para os clientes nas aprovações.">
              <FieldBox icon={<Building2Icon size={14} />}>
                <BareInput
                  id="agencia-nome"
                  value={draft.name}
                  maxLength={80}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </FieldBox>
            </Field>
            <div className="hidden flex-1 md:block" />
          </div>
          <Sub label="Entrada pelo domínio" />
          <Row
            icon={<GlobeIcon size={15} />}
            label="Domínio do convite automático"
            help="Quem criar conta com um e-mail deste domínio entra direto na agência. Deixe vazio para desligar."
          >
            <FieldBox
              className="w-full md:w-[300px]"
              trailing={domainOn ? <Pill>Ligado</Pill> : <Pill tone="neutral">Desligado</Pill>}
            >
              <span className="text-muted">@</span>
              <BareInput
                aria-label="Domínio do convite automático"
                value={draft.domain}
                placeholder={viewerEmail.split("@")[1] ?? "suaagencia.com"}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setDraft((d) => ({ ...d, domain: e.target.value.replace(/^@+/, "").toLowerCase() }))}
              />
            </FieldBox>
          </Row>
          <Row
            icon={<UserPlusIcon size={15} />}
            label="Função de quem entra pelo domínio"
            help="Pode ser trocada depois, pessoa a pessoa, em Membros."
          >
            <Segmented
              label="Função de quem entra pelo domínio"
              options={MEMBER_ROLES}
              value={draft.domainRole}
              onChange={(domainRole) => setDraft((d) => ({ ...d, domainRole }))}
            />
          </Row>
        </Section>

        <section id="atalhos" className="flex scroll-mt-2 flex-col gap-2.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.7px] text-set-hint">Atalhos</span>
          <div className="grid gap-3 md:grid-cols-2">
            <Shortcut
              href="/equipe"
              icon={<UsersIcon size={18} />}
              title="Membros"
              note={`${plural(counts.members, "membro", "membros")} · ${plural(counts.invites, "convite pendente", "convites pendentes")}`}
            />
            <Shortcut
              href="/configuracoes/fluxos"
              icon={<WorkflowIcon size={18} />}
              title="Fluxos e Processos"
              note={`${plural(counts.activeFlows, "fluxo ativo", "fluxos ativos")} · ${plural(counts.draftFlows, "rascunho", "rascunhos")}`}
            />
          </div>
        </section>

        <Section
          id="padroes"
          title="Padrões para cliente novo"
          note="Já vêm preenchidos ao cadastrar um cliente. Dá para mudar em cada cliente depois."
        >
          <div className="flex flex-col gap-[18px] p-5">
            <div className="flex flex-col gap-4 md:flex-row">
              <Field label="Dia de cobrança">
                <SelectBox
                  icon={<CalendarIcon size={14} />}
                  label="Dia de cobrança"
                  value={draft.defaults.billingDay === null ? NO_DAY : String(draft.defaults.billingDay)}
                  options={[
                    { id: NO_DAY, label: "Sem padrão" },
                    ...Array.from({ length: 31 }, (_, i) => ({ id: String(i + 1), label: `Dia ${i + 1}` })),
                  ]}
                  onChange={(v) => setDefaults({ billingDay: v === NO_DAY ? null : Number(v) })}
                />
              </Field>
              <Field label="Índice de reajuste">
                <SelectBox
                  icon={<TrendingUpIcon size={14} />}
                  label="Índice de reajuste"
                  value={draft.defaults.adjustmentIndex || NO_INDEX}
                  options={[
                    { id: NO_INDEX, label: "Sem reajuste" },
                    ...ADJUSTMENT_INDEXES.map((i) => ({ id: i, label: i })),
                  ]}
                  onChange={(v) => setDefaults({ adjustmentIndex: v === NO_INDEX ? "" : v })}
                />
              </Field>
              <Field label="Fidelidade" htmlFor="fidelidade" help="Use 0 para contrato sem fidelidade.">
                <FieldBox icon={<HandshakeIcon size={14} />} trailing={<span className="text-muted">meses</span>}>
                  <BareInput
                    id="fidelidade"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    value={draft.defaults.fidelityMonths}
                    onChange={(e) =>
                      setDefaults({ fidelityMonths: Math.max(0, Math.min(120, Math.floor(Number(e.target.value) || 0))) })
                    }
                  />
                </FieldBox>
              </Field>
            </div>
            <div className="flex flex-col gap-4 md:flex-row">
              <Field label="Forma de pagamento">
                <Segmented
                  label="Forma de pagamento"
                  className="w-fit"
                  options={[{ id: NO_PAYMENT, label: "Nenhuma" }, ...PAYMENT_KINDS]}
                  value={draft.defaults.paymentKind ?? NO_PAYMENT}
                  onChange={(v) => setDefaults({ paymentKind: v === NO_PAYMENT ? null : (v as ClientDefaults["paymentKind"]) })}
                />
              </Field>
              <Field label="Ciclo do contrato">
                <Segmented
                  label="Ciclo do contrato"
                  className="w-fit"
                  options={CONTRACT_CYCLES}
                  value={draft.defaults.cycle}
                  onChange={(cycle) => setDefaults({ cycle })}
                />
              </Field>
            </div>
            <div className="flex flex-col gap-4 md:flex-row">
              <Field label="Fluxo padrão" help="Cliente novo já começa com este fluxo de tarefas e aprovação.">
                <SelectBox
                  icon={<WorkflowIcon size={14} />}
                  label="Fluxo padrão"
                  value={draft.defaults.flowId ?? NO_FLOW}
                  options={[{ id: NO_FLOW, label: "O padrão da agência" }, ...flows.map((f) => ({ id: f.id, label: f.name }))]}
                  onChange={(v) => setDefaults({ flowId: v === NO_FLOW ? null : v })}
                />
              </Field>
              <div className="hidden flex-1 md:block" />
            </div>
          </div>
        </Section>

        <Section id="integracoes" title="Integrações" note="Serviços que fazem o app funcionar. Aqui aparece só o status.">
          <div className="flex items-center gap-2.5 border-b border-set-line bg-set-sub px-5 py-2.5 text-[12px] text-muted">
            <KeyRoundIcon size={14} className="shrink-0" />
            As chaves ficam guardadas na Vercel e nunca aparecem nesta tela.
          </div>
          {integrations.map((i) => {
            const text = INTEGRATION_TEXT[i.id];
            return (
              <div key={i.id} className="flex items-center gap-3.5 border-b border-set-line px-5 py-3.5 last:border-b-0">
                <IconBox>
                  <span className={i.configured ? "text-fg-soft" : "text-muted"}>{text.icon}</span>
                </IconBox>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-fg-soft">
                    {text.label} <span className="text-[12px] font-normal text-set-hint">{i.provider}</span>
                  </span>
                  <span className="text-[12px] text-muted">{text.note}</span>
                </div>
                {!i.configured && (
                  <a
                    href={SETUP_HELP}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden items-center gap-[5px] text-[12px] text-fg-3 hover:text-fg-soft sm:flex"
                  >
                    Como configurar <ExternalLinkIcon size={12} className="text-muted" />
                  </a>
                )}
                {i.configured ? <Pill>Configurado</Pill> : <Pill tone="warn">Não configurado</Pill>}
              </div>
            );
          })}
        </Section>

        {canDelete && <DangerZone name={saved.name} />}
      </SettingsBody>
    </SettingsShell>
  );
}

function Shortcut({ href, icon, title, note }: { href: string; icon: React.ReactNode; title: string; note: string }) {
  return (
    <Link
      href={href}
      className="tap flex items-center gap-3.5 rounded-panel border border-rule bg-flow-panel p-4 transition-colors hover:bg-surface"
    >
      <IconBox size={40}>{icon}</IconBox>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-fg">{title}</span>
          <span className="font-mono text-[11px] text-faint">{href}</span>
        </span>
        <span className="text-[12px] text-muted">{note}</span>
      </span>
      <ArrowUpRightIcon size={16} className="shrink-0 text-muted" />
    </Link>
  );
}

function LogoRow({
  name,
  logoUrl,
  onChange,
}: {
  name: string;
  logoUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function send(file: File | null) {
    setBusy(true);
    try {
      let res: Response;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        res = await fetch("/api/configuracoes/agencia/logo", { method: "POST", body: form });
      } else {
        res = await fetch("/api/configuracoes/agencia/logo", { method: "DELETE" });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível mudar o logo.");
      onChange(data.logoUrl ?? null);
      toast(file ? "Logo atualizado." : "Logo removido.");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível mudar o logo.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-[18px] px-5 pb-2 pt-5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-panel bg-surface object-contain" />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-panel bg-primary text-[22px] font-extrabold tracking-[-0.5px] text-set-ink">
          {agencyInitials(name)}
        </span>
      )}
      <div className="flex min-w-[180px] flex-1 flex-col gap-1">
        <span className="text-[13px] font-medium text-fg-soft">Logo da agência</span>
        <span className="text-[12px] text-muted">
          PNG, JPG ou WebP com fundo transparente, até 2 MB. Aparece nos links de aprovação enviados aos clientes.
        </span>
      </div>
      <div className="flex gap-2">
        <SmallButton icon={busy ? <Spinner /> : <UploadIcon size={14} />} disabled={busy} onClick={() => input.current?.click()}>
          Enviar logo
        </SmallButton>
        {logoUrl && (
          <SmallButton disabled={busy} onClick={() => void send(null)}>
            Remover
          </SmallButton>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void send(file);
        }}
      />
    </div>
  );
}

/**
 * Excluir a agência pede o nome digitado — o botão só acende quando bate. A
 * rota confere de novo (e confere que quem pede é Admin).
 */
function DangerZone({ name }: { name: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLocaleLowerCase("pt-BR") === name.trim().toLocaleLowerCase("pt-BR");

  async function remove() {
    if (!matches || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/configuracoes/agencia", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: typed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível excluir a agência.");
      router.replace("/login");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível excluir a agência.", "error");
      setBusy(false);
    }
  }

  return (
    <Section id="perigo" danger title="Zona de perigo" note="Ações que afetam a agência inteira. Só um Admin pode fazer.">
      <Row
        icon={<Trash2Icon size={15} />}
        label="Excluir agência"
        help="Apaga a agência e todos os dados, para todas as pessoas. Não dá para desfazer."
      >
        {!open && (
          <SmallButton variant="danger" icon={<Trash2Icon size={14} />} onClick={() => setOpen(true)}>
            Excluir agência
          </SmallButton>
        )}
      </Row>
      {open && (
        <div className="flex flex-col gap-3 border-t border-bad-line bg-bad-bg/40 px-5 py-4">
          <p className="text-[12px] text-fg-3">
            Clientes, tarefas, lotes, conversas, arquivos e as contas de todo o time saem junto. Para confirmar, digite{" "}
            <strong className="font-semibold text-fg-soft">{name}</strong>.
          </p>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <FieldBox className="md:w-[300px]">
              <BareInput
                aria-label="Nome da agência para confirmar"
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void remove();
                  if (e.key === "Escape") setOpen(false);
                }}
              />
            </FieldBox>
            <div className="flex gap-2">
              <SmallButton onClick={() => {
                setOpen(false);
                setTyped("");
              }}>
                Cancelar
              </SmallButton>
              <SmallButton variant="danger" disabled={!matches || busy} icon={busy ? <Spinner /> : <Trash2Icon size={14} />} onClick={() => void remove()}>
                Excluir para sempre
              </SmallButton>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
