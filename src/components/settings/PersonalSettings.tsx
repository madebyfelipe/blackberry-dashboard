"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AtSignIcon,
  BellIcon,
  BellOffIcon,
  BellRingIcon,
  BriefcaseIcon,
  CameraIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleDotIcon,
  EyeIcon,
  EyeOffIcon,
  HashIcon,
  HeadphonesIcon,
  InfoIcon,
  KeyRoundIcon,
  LaptopIcon,
  LockKeyholeIcon,
  LogOutIcon,
  MailIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  MonitorIcon,
  MonitorSmartphoneIcon,
  PlayIcon,
  SendIcon,
  ShieldIcon,
  SquareCheckIcon,
  UploadIcon,
  UserRoundIcon,
  UsersIcon,
  Volume2Icon,
} from "@/components/icons";
import { apiPatchConversation } from "@/components/inbox/api";
import { PROFILE_CHANGED, sendTestNotification } from "@/components/inbox/InboxNotifier";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { forgetTeam } from "@/components/team/useTeam";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import type { PublicUser } from "@/lib/auth/types";
import { deviceLabel, passwordStrength } from "@/lib/auth/device";
import { cn } from "@/lib/cn";
import { DEFAULT_AUDIO_PREFS, loadAudioPrefs, saveAudioPrefs } from "@/lib/inbox/audioPrefs";
import { DEFAULT_CAMERA_PREFS, loadCameraPrefs, saveCameraPrefs } from "@/lib/inbox/callPrefs";
import { PRESENCES } from "@/lib/inbox/constants";
import {
  ALERT_SOUNDS,
  type AlertKind,
  type AlertSound,
  type NotifyPrefs,
} from "@/lib/inbox/notifyPrefs";
import { DEFAULT_SCREEN_QUALITY, loadScreenQuality, saveScreenQuality } from "@/lib/inbox/screenQuality";
import type { ConversationKind, InboxMember, Presence } from "@/lib/inbox/types";
import { ROLE_LABEL, TITLE_SUGGESTIONS } from "@/lib/inbox/users";
import { initialsOf } from "@/lib/inbox/view";
import { CallSettings, type CallDraft } from "./CallSettings";
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
  Toggle,
  type PillTone,
  type SettingsTab,
} from "./kit";
import { playAlertSound } from "./sounds";

/*
 * Configurações › Pessoal (export "Configurações · Pessoal"): perfil,
 * disponibilidade, notificações, chamada e áudio, senha e sessão.
 *
 * Um rascunho só para a aba inteira: o cabeçalho conta as alterações e salva
 * tudo de uma vez ("Salvar alterações") ou volta ao que estava ("Descartar").
 * Três coisas não esperam o botão, porque já são uma ação completa: a foto
 * (sobe na hora), "Tirar silêncio" e a troca de senha.
 *
 * Onde cada coisa grava: nome na conta; @ na rota própria (é único na
 * agência); cargo, disponibilidade e avisos no membro do time; chamada e
 * áudio no navegador (são do aparelho).
 */

type MutedConversation = { id: string; kind: ConversationKind; title: string };

type Draft = {
  name: string;
  handle: string;
  title: string;
  presence: Presence;
  notify: NotifyPrefs;
  call: CallDraft;
};

const PRESENCE_TONE: Record<Presence, PillTone> = {
  disponivel: "ok",
  ocupado: "bad",
  ausente: "warn",
  offline: "neutral",
};

/** Quantos campos mudaram — é o "2 alterações não salvas" do cabeçalho. */
function countChanges(a: Draft, b: Draft): number {
  const flat = (d: Draft): Record<string, unknown> => ({
    name: d.name.trim(),
    handle: d.handle,
    title: d.title.trim(),
    presence: d.presence,
    ...Object.fromEntries(Object.entries(d.notify.kinds).map(([k, v]) => [`k.${k}`, v])),
    inApp: d.notify.inApp,
    system: d.notify.system,
    sound: d.notify.sound,
    ...Object.fromEntries(Object.entries(d.call.audio).map(([k, v]) => [`a.${k}`, v])),
    ...Object.fromEntries(Object.entries(d.call.camera).map(([k, v]) => [`c.${k}`, v])),
    ...Object.fromEntries(Object.entries(d.call.screen).map(([k, v]) => [`s.${k}`, v])),
  });
  const fa = flat(a);
  const fb = flat(b);
  return Object.keys(fa).filter((k) => fa[k] !== fb[k]).length;
}

export function PersonalSettings({
  user,
  me,
  tabs,
  muted: initialMuted,
  city,
}: {
  user: PublicUser;
  me: InboxMember;
  tabs: SettingsTab[];
  muted: MutedConversation[];
  city: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { anunciar } = useRealtime();

  const initial: Draft = useMemo(
    () => ({
      name: user.name,
      handle: me.handle,
      title: me.title,
      presence: me.presence,
      notify: me.notify,
      call: { audio: DEFAULT_AUDIO_PREFS, camera: DEFAULT_CAMERA_PREFS, screen: DEFAULT_SCREEN_QUALITY },
    }),
    [user.name, me.handle, me.title, me.presence, me.notify],
  );
  const [saved, setSaved] = useState<Draft>(initial);
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(me.photoUrl);
  const [muted, setMuted] = useState(initialMuted);

  // Chamada e áudio moram no navegador: só dá para ler depois de montar.
  useEffect(() => {
    const call: CallDraft = { audio: loadAudioPrefs(), camera: loadCameraPrefs(), screen: loadScreenQuality() };
    setSaved((s) => ({ ...s, call }));
    setDraft((d) => ({ ...d, call }));
  }, []);

  const changes = countChanges(draft, saved);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setNotify = (patch: Partial<NotifyPrefs>) => setDraft((d) => ({ ...d, notify: { ...d.notify, ...patch } }));
  const setKind = (kind: AlertKind, on: boolean) =>
    setDraft((d) => ({ ...d, notify: { ...d.notify, kinds: { ...d.notify.kinds, [kind]: on } } }));

  async function save() {
    if (!changes || saving) return;
    if (!draft.name.trim()) {
      toast("O nome não pode ficar vazio.", "error");
      return;
    }
    setSaving(true);
    try {
      if (draft.handle !== saved.handle) {
        const res = await fetch("/api/inbox/handle", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ handle: draft.handle }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar o @.");
        // Os menus de @ guardam o time da aba: sem isto mostrariam o @ antigo.
        forgetTeam();
      }
      const body: Record<string, unknown> = {};
      if (draft.name.trim() !== saved.name.trim()) body.name = draft.name.trim();
      if (draft.title.trim() !== saved.title.trim()) body.title = draft.title.trim();
      if (draft.presence !== saved.presence) body.presence = draft.presence;
      if (JSON.stringify(draft.notify) !== JSON.stringify(saved.notify)) body.notify = draft.notify;
      if (Object.keys(body).length > 0) {
        const res = await fetch("/api/configuracoes/pessoal", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar.");
      }
      saveAudioPrefs(draft.call.audio);
      saveCameraPrefs(draft.call.camera);
      saveScreenQuality(draft.call.screen);
      if (draft.presence !== saved.presence) anunciar(draft.presence);
      window.dispatchEvent(
        new CustomEvent(PROFILE_CHANGED, { detail: { notify: draft.notify, presence: draft.presence } }),
      );
      const next = { ...draft, name: draft.name.trim(), title: draft.title.trim() };
      setSaved(next);
      setDraft(next);
      toast("Alterações salvas.");
      // A lateral (nome, status) é desenhada no servidor com a sessão.
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  const nav = [
    { id: "perfil", label: "Perfil", icon: <UserRoundIcon size={15} /> },
    { id: "disponibilidade", label: "Disponibilidade", icon: <CircleDotIcon size={15} /> },
    { id: "notificacoes", label: "Notificações", icon: <BellIcon size={15} /> },
    { id: "chamada", label: "Chamada e áudio", icon: <HeadphonesIcon size={15} /> },
    { id: "senha", label: "Senha e sessão", icon: <KeyRoundIcon size={15} /> },
  ];

  return (
    <SettingsShell
      tab="pessoal"
      tabs={tabs}
      dirty={changes > 0}
      actions={
        <>
          {changes > 0 && (
            <span className="hidden text-[12px] text-muted md:inline">
              {changes} {changes === 1 ? "alteração não salva" : "alterações não salvas"}
            </span>
          )}
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
      <SettingsBody nav={<PageNav items={nav} />}>
        <ProfileSection
          user={user}
          me={me}
          draft={draft}
          photoUrl={photoUrl}
          onPhoto={setPhotoUrl}
          set={set}
        />

        <Section
          id="disponibilidade"
          title="Disponibilidade"
          note="Seu status aparece ao lado do seu nome para a equipe. Também dá para trocar pelo menu da conta."
        >
          <Row label="Presença" help="Ocupado silencia os avisos do sistema, mas as menções continuam chegando no app.">
            <Segmented
              label="Presença"
              options={PRESENCES.map((p) => ({ id: p.id, label: p.label, dot: p.color }))}
              value={draft.presence}
              onChange={(presence) => set("presence", presence)}
            />
          </Row>
        </Section>

        <NotificationsSection
          notify={draft.notify}
          setNotify={setNotify}
          setKind={setKind}
          muted={muted}
          onUnmute={async (c) => {
            try {
              await apiPatchConversation(c.id, { muted: false });
              setMuted((list) => list.filter((x) => x.id !== c.id));
              toast(`${c.title} voltou a avisar.`);
            } catch (err) {
              toast(err instanceof Error ? err.message : "Não foi possível tirar o silêncio.", "error");
            }
          }}
        />

        <CallSettings draft={draft.call} onChange={(call) => set("call", call)} />

        <PasswordSection city={city} />
      </SettingsBody>
    </SettingsShell>
  );
}

/* ================================================================ Perfil */

function ProfileSection({
  user,
  me,
  draft,
  photoUrl,
  onPhoto,
  set,
}: {
  user: PublicUser;
  me: InboxMember;
  draft: Draft;
  photoUrl: string | null;
  onPhoto: (url: string | null) => void;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/configuracoes/foto", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível enviar a foto.");
      onPhoto(data.me.photoUrl);
      window.dispatchEvent(new CustomEvent(PROFILE_CHANGED, { detail: { photoUrl: data.me.photoUrl } }));
      toast("Foto atualizada.");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível enviar a foto.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/configuracoes/foto", { method: "DELETE" });
      if (!res.ok) throw new Error();
      onPhoto(null);
      window.dispatchEvent(new CustomEvent(PROFILE_CHANGED, { detail: { photoUrl: null } }));
      toast("Foto removida.");
      router.refresh();
    } catch {
      toast("Não foi possível remover a foto.", "error");
    } finally {
      setBusy(false);
    }
  }

  const presence = PRESENCES.find((p) => p.id === draft.presence)!;

  return (
    <Section
      id="perfil"
      title="Perfil"
      note="Como você aparece para a equipe e para os clientes nas tarefas, conversas e aprovações."
    >
      <div className="flex flex-wrap items-center gap-[18px] px-5 pb-2 pt-5">
        <div className="relative h-[72px] w-[72px] shrink-0">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-[72px] w-[72px] rounded-full border border-border-strong object-cover" />
          ) : (
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-border-strong bg-border text-[24px] font-semibold text-fg">
              {initialsOf(draft.name || user.name)}
            </span>
          )}
          <button
            type="button"
            aria-label="Trocar foto"
            onClick={() => input.current?.click()}
            className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border border-flow-panel bg-primary text-set-ink"
          >
            <CameraIcon size={12} />
          </button>
        </div>
        <div className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="text-[13px] font-medium text-fg-soft">Foto</span>
          <span className="text-[12px] text-muted">JPG, PNG ou WebP, até 2 MB. Sem foto, mostramos suas iniciais.</span>
        </div>
        <div className="flex items-center gap-2">
          <SmallButton icon={busy ? <Spinner /> : <UploadIcon size={14} />} disabled={busy} onClick={() => input.current?.click()}>
            Enviar foto
          </SmallButton>
          {photoUrl && (
            <SmallButton disabled={busy} onClick={() => void remove()}>
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
            if (file) void upload(file);
          }}
        />
      </div>

      <div className="flex flex-col gap-[18px] px-5 pb-[22px] pt-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <Field label="Nome" htmlFor="nome">
            <FieldBox>
              <BareInput id="nome" value={draft.name} autoComplete="name" onChange={(e) => set("name", e.target.value)} />
            </FieldBox>
          </Field>
          <Field
            label="Seu @"
            htmlFor="handle"
            help="Único na agência. É por ele que te mencionam nas tarefas e conversas."
          >
            <FieldBox
              trailing={
                <Pill tone={PRESENCE_TONE[draft.presence]} >
                  {presence.label}
                </Pill>
              }
            >
              <span className="text-muted">@</span>
              <BareInput
                id="handle"
                value={draft.handle}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => set("handle", e.target.value.replace(/^@+/, "").toLowerCase())}
              />
            </FieldBox>
          </Field>
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          <Field label="E-mail" htmlFor="email" help="É o seu login. Para trocar, fale com um Admin.">
            <FieldBox locked icon={<MailIcon size={14} />}>
              <BareInput id="email" value={user.email} readOnly />
            </FieldBox>
          </Field>
          <Field label="Cargo" htmlFor="cargo" help="Aparece na ficha do cliente. Ex.: Designer, Social media, Atendimento.">
            <FieldBox icon={<BriefcaseIcon size={14} />}>
              <BareInput
                id="cargo"
                list="cargos"
                value={draft.title}
                maxLength={40}
                placeholder="Seu cargo na agência"
                onChange={(e) => set("title", e.target.value)}
              />
              <datalist id="cargos">
                {TITLE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </FieldBox>
          </Field>
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          <Field label="Papel" htmlFor="papel" help="Define o que você pode ver e fazer. Só um Admin altera, em Membros.">
            <FieldBox locked icon={<ShieldIcon size={14} />}>
              <BareInput id="papel" value={ROLE_LABEL[me.role]} readOnly />
            </FieldBox>
          </Field>
          <div className="hidden flex-1 md:block" />
        </div>
      </div>
    </Section>
  );
}

/* ========================================================= Notificações */

const KIND_ROWS: { kind: AlertKind; label: string; help: string; icon: React.ReactNode }[] = [
  { kind: "mencao", label: "Menções", help: "Quando alguém usa o seu @ em tarefa, comentário ou conversa.", icon: <AtSignIcon size={15} /> },
  { kind: "atribuicao", label: "Tarefa atribuída a você", help: "Quando você vira responsável por uma tarefa.", icon: <SquareCheckIcon size={15} /> },
  {
    kind: "comentario",
    label: "Comentários nas suas tarefas",
    help: "Novos comentários em tarefas que você criou ou é responsável.",
    icon: <MessageSquareIcon size={15} />,
  },
  { kind: "mensagem", label: "Mensagens", help: "Conversas diretas e em grupo.", icon: <MessagesSquareIcon size={15} /> },
];

type Permission = "granted" | "denied" | "default" | "unsupported";

function readPermission(): Permission {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

function NotificationsSection({
  notify,
  setNotify,
  setKind,
  muted,
  onUnmute,
}: {
  notify: NotifyPrefs;
  setNotify: (patch: Partial<NotifyPrefs>) => void;
  setKind: (kind: AlertKind, on: boolean) => void;
  muted: MutedConversation[];
  onUnmute: (c: MutedConversation) => Promise<void>;
}) {
  const { toast } = useToast();
  const [permission, setPermission] = useState<Permission>("default");
  useEffect(() => setPermission(readPermission()), []);

  const permissionPill: Record<Permission, React.ReactNode> = {
    granted: <Pill>Permitida</Pill>,
    denied: <Pill tone="bad">Bloqueada</Pill>,
    default: <Pill tone="warn">Não perguntado</Pill>,
    unsupported: <Pill tone="neutral">Indisponível</Pill>,
  };

  return (
    <Section id="notificacoes" title="Notificações" note="Escolha o que merece um aviso e por onde ele chega.">
      <Sub label="O que avisar" />
      {KIND_ROWS.map((r) => (
        <Row key={r.kind} icon={r.icon} label={r.label} help={r.help}>
          <Toggle label={r.label} on={notify.kinds[r.kind]} onChange={(on) => setKind(r.kind, on)} />
        </Row>
      ))}

      <Sub label="Onde avisar" />
      <div className="grid gap-3 border-b border-set-line px-5 py-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-[14px] border border-rule bg-surface p-4">
          <div className="flex items-center justify-between">
            <IconBox size={32}>
              <BellIcon size={16} />
            </IconBox>
            <Toggle label="Avisar no app" on={notify.inApp} onChange={(inApp) => setNotify({ inApp })} />
          </div>
          <div className="flex flex-col gap-[3px]">
            <span className="text-[13px] font-medium text-fg-soft">No app</span>
            <span className="text-[12px] text-muted">Sino com contador na barra lateral e aviso no canto da tela.</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-[14px] border border-rule bg-surface p-4">
          <div className="flex items-center justify-between">
            <IconBox size={32}>
              <MonitorIcon size={16} />
            </IconBox>
            <Toggle
              label="Notificação do sistema"
              on={notify.system}
              onChange={(system) => setNotify({ system })}
            />
          </div>
          <div className="flex flex-col gap-[3px]">
            <span className="text-[13px] font-medium text-fg-soft">Notificação do sistema</span>
            <span className="text-[12px] text-muted">Aparece mesmo com a aba em segundo plano.</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[12px] text-muted">
              Navegador: {permissionPill[permission]}
            </span>
            {permission === "default" ? (
              <SmallButton
                icon={<BellRingIcon size={14} />}
                onClick={async () => {
                  const result = await Notification.requestPermission().catch(() => "default" as const);
                  setPermission(result);
                }}
              >
                Permitir
              </SmallButton>
            ) : (
              <SmallButton
                icon={<SendIcon size={14} />}
                onClick={() => {
                  const where = sendTestNotification(toast, notify);
                  if (where === "app" && notify.system && permission === "denied") {
                    toast("O navegador bloqueou as notificações. Libere no cadeado da barra de endereço.", "error");
                  }
                }}
              >
                Enviar teste
              </SmallButton>
            )}
          </div>
        </div>
      </div>

      <Row icon={<Volume2Icon size={15} />} label="Som do aviso" help="Toca junto com os avisos no app e do sistema.">
        <SelectBox<AlertSound>
          className="w-[180px]"
          label="Som do aviso"
          value={notify.sound}
          options={ALERT_SOUNDS}
          onChange={(sound) => {
            setNotify({ sound });
            playAlertSound(sound);
          }}
        />
        <SmallButton aria-label="Ouvir o som" icon={<PlayIcon size={14} />} onClick={() => playAlertSound(notify.sound)} />
      </Row>

      <Sub label="Conversas silenciadas" right={`${muted.length} ${muted.length === 1 ? "conversa" : "conversas"}`} />
      {muted.length === 0 ? (
        <p className="px-5 py-4 text-[12px] text-muted">
          Nenhuma conversa silenciada. Para silenciar, use o &quot;⋯&quot; da conversa no Inbox.
        </p>
      ) : (
        muted.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b border-set-line px-5 py-3 last:border-b-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-badge-neutral text-fg-3">
              {c.kind === "grupo" ? <UsersIcon size={14} /> : c.title.startsWith("#") ? <HashIcon size={14} /> : <UserRoundIcon size={14} />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[13px] font-medium text-fg-soft">{c.title}</span>
              <span className="text-[12px] text-muted">
                {c.kind === "grupo" ? "Grupo" : "Conversa direta"} · silenciada até você reativar
              </span>
            </span>
            <BellOffIcon size={14} className="hidden shrink-0 text-faint sm:block" />
            <SmallButton icon={<BellRingIcon size={14} />} onClick={() => void onUnmute(c)}>
              Tirar silêncio
            </SmallButton>
          </div>
        ))
      )}
    </Section>
  );
}

/* ======================================================= Senha e sessão */

function PasswordSection({ city }: { city: string | null }) {
  const { toast } = useToast();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState<"este" | "todos" | null>(null);
  const [device, setDevice] = useState("Este navegador");
  useEffect(() => setDevice(deviceLabel(navigator.userAgent)), []);

  const strength = passwordStrength(next);
  const matches = confirm.length > 0 && confirm === next;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = !!current && next.length >= 8 && matches && !saving;

  async function changePassword() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/senha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, nextPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível trocar a senha.");
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Senha atualizada. Os outros aparelhos foram desconectados.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível trocar a senha.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function signOut(all: boolean) {
    if (
      all &&
      !window.confirm("Sair de todos os aparelhos? Você também sai deste, e vai precisar entrar de novo.")
    ) {
      return;
    }
    setLeaving(all ? "todos" : "este");
    try {
      const res = await fetch(all ? "/api/auth/sessoes" : "/api/auth/logout", {
        method: all ? "DELETE" : "POST",
      });
      if (!res.ok) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch {
      setLeaving(null);
      toast("Não foi possível sair.", "error");
    }
  }

  const eye = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      aria-label={show ? "Esconder senhas" : "Mostrar senhas"}
      className="shrink-0 text-set-hint hover:text-fg-3"
    >
      {show ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
    </button>
  );

  return (
    <Section id="senha" title="Senha e sessão" note="Proteja sua conta e controle onde ela está aberta.">
      <Sub label="Trocar senha" />
      <form
        className="flex flex-col gap-4 border-b border-set-line p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void changePassword();
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row">
          <Field label="Senha atual" htmlFor="senha-atual">
            <FieldBox icon={<LockKeyholeIcon size={14} />} trailing={eye}>
              <BareInput
                id="senha-atual"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </FieldBox>
          </Field>
          <Field label="Nova senha" htmlFor="senha-nova">
            <FieldBox icon={<KeyRoundIcon size={14} />} trailing={eye}>
              <BareInput
                id="senha-nova"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </FieldBox>
            {next && (
              <div className="flex items-center gap-1" aria-live="polite">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-[3px] flex-1 rounded-[2px]",
                      i <= strength.score ? (strength.score >= 3 ? "bg-ok" : strength.score === 2 ? "bg-warn" : "bg-bad") : "bg-rule",
                    )}
                  />
                ))}
                <span
                  className={cn(
                    "pl-1 text-[11px] font-medium",
                    strength.score >= 3 ? "text-ok-fg" : strength.score === 2 ? "text-warn-fg" : "text-bad-fg",
                  )}
                >
                  {strength.label}
                </span>
              </div>
            )}
          </Field>
          <Field label="Confirmar nova senha" htmlFor="senha-confirma">
            <FieldBox
              icon={<KeyRoundIcon size={14} />}
              trailing={
                matches ? (
                  <CircleCheckIcon size={14} className="shrink-0 text-ok" />
                ) : mismatch ? (
                  <span className="shrink-0 text-[11px] text-bad-fg">diferente</span>
                ) : null
              }
            >
              <BareInput
                id="senha-confirma"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </FieldBox>
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[12px] text-muted">
            <InfoIcon size={14} className="shrink-0" />
            Ao trocar a senha, seus outros aparelhos são desconectados.
          </span>
          <SmallButton type="submit" variant="primary" disabled={!canSubmit}>
            {saving ? "Atualizando…" : "Atualizar senha"}
          </SmallButton>
        </div>
      </form>

      <Sub label="Sessão" />
      <div className="flex items-center gap-3 border-b border-set-line px-5 py-3.5">
        <IconBox>
          <LaptopIcon size={16} />
        </IconBox>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[13px] font-medium text-fg-soft">
            Este aparelho <Pill>Atual</Pill>
          </span>
          <span className="truncate text-[12px] text-muted">
            {[device, city, "ativo agora"].filter(Boolean).join(" · ")}
          </span>
        </div>
        <SmallButton icon={<LogOutIcon size={14} />} disabled={!!leaving} onClick={() => void signOut(false)}>
          {leaving === "este" ? "Saindo…" : "Sair"}
        </SmallButton>
      </div>
      <Row
        icon={<MonitorSmartphoneIcon size={15} />}
        label="Sair de todos os aparelhos"
        help="Encerra a sua conta em outros navegadores e no app de desktop. Você também sai deste aparelho."
      >
        <SmallButton
          variant="danger"
          icon={<LogOutIcon size={14} />}
          disabled={!!leaving}
          onClick={() => void signOut(true)}
        >
          {leaving === "todos" ? "Saindo…" : "Sair de todos"}
        </SmallButton>
      </Row>
    </Section>
  );
}
