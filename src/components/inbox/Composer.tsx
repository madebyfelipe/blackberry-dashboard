"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MentionText, useMentionInput } from "@/components/team/Mentions";
import { cn } from "@/lib/cn";
import {
  ArrowUpIcon,
  FileIcon,
  MicIcon,
  PaperclipIcon,
  ReplyIcon,
  SmileIcon,
  SquareStopIcon,
  StickerIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";
import { ATTACHMENTS_MAX } from "@/lib/inbox/constants";
import type { Attachment, ConversationDetail, Message } from "@/lib/inbox/types";
import { memberName, messageText } from "@/lib/inbox/view";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME, baseMime, formatBytes } from "@/lib/media/constants";
import { apiUploadAttachment, type GifResult, type OutgoingExtra } from "./api";
import { GifPicker } from "./GifPicker";

/*
 * O campo de escrever da conversa.
 *
 * Além do texto (com o menu de @), leva:
 *
 * - **anexos** — o clipe, arrastar para cima do campo ou colar (Ctrl+V de
 *   uma imagem). Cada arquivo sobe assim que entra, até 20 MB; o envio só
 *   libera quando todos chegaram;
 * - **mensagem de voz** — o microfone grava no navegador (MediaRecorder) e
 *   o quadrado para e manda;
 * - **GIF** — da biblioteca configurada no servidor; escolher manda na hora;
 * - **resposta** — a faixa "Respondendo a…" em cima, vinda do menu da
 *   mensagem. Esc ou o × tiram.
 */

type Pending = {
  key: string;
  name: string;
  size: number;
  status: "subindo" | "pronto" | "erro";
  attachment?: Attachment;
  error?: string;
};

export function Composer({
  detail,
  meId,
  sending,
  blobUploads,
  replyTo,
  onCancelReply,
  onSend,
  onUndesigned,
  onError,
}: {
  detail: ConversationDetail;
  meId: string;
  sending: boolean;
  blobUploads: boolean;
  replyTo: Message | null;
  onCancelReply: () => void;
  onSend: (text: string, extra: OutgoingExtra) => void;
  onUndesigned: (what: string) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [gifs, setGifs] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gifButtonRef = useRef<HTMLSpanElement>(null);
  // Passou dos 5 minutos, o gravador para sozinho e a mensagem vai.
  const recorder = useRecorder(onError, () => void stopAndSend());
  const mentions = useMentionInput({
    value: draft,
    onChange: (v) => {
      setDraft(v);
      requestAnimationFrame(grow);
    },
    field: ref,
  });

  // Trocar de conversa limpa o que estava por mandar nela.
  useEffect(() => {
    setDraft("");
    setFiles([]);
    setGifs(false);
  }, [detail.id]);

  // Responder põe o cursor no campo.
  useEffect(() => {
    if (replyTo) ref.current?.focus();
  }, [replyTo]);

  function grow() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    if (incoming.length === 0) return;
    const room = ATTACHMENTS_MAX - files.length;
    if (room <= 0) return onError(`Uma mensagem leva até ${ATTACHMENTS_MAX} anexos.`);
    for (const file of incoming.slice(0, room)) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const problem =
        file.size > ATTACHMENT_MAX_BYTES
          ? `"${file.name}" passa de 20 MB.`
          : !ATTACHMENT_MIME[baseMime(file.type)]
            ? `"${file.name}": esse tipo de arquivo não vai na conversa.`
            : null;
      if (problem) {
        onError(problem);
        continue;
      }
      setFiles((f) => [...f, { key, name: file.name, size: file.size, status: "subindo" }]);
      apiUploadAttachment(detail.id, file, blobUploads)
        .then((attachment) =>
          setFiles((f) => f.map((p) => (p.key === key ? { ...p, status: "pronto", attachment } : p))),
        )
        .catch((e: unknown) => {
          const error = e instanceof Error ? e.message : "Falha ao subir o anexo.";
          setFiles((f) => f.map((p) => (p.key === key ? { ...p, status: "erro", error } : p)));
          onError(error);
        });
    }
  }

  const uploading = files.some((f) => f.status === "subindo");
  const ready = files.filter((f) => f.status === "pronto" && f.attachment).map((f) => f.attachment!);
  const canSend = !sending && !uploading && (!!draft.trim() || ready.length > 0);

  function submit() {
    if (!canSend) return;
    onSend(draft.trim(), { attachments: ready, replyToId: replyTo?.id ?? null });
    setDraft("");
    setFiles([]);
    requestAnimationFrame(grow);
  }

  const closeGifs = useCallback(() => setGifs(false), []);

  function sendGif(gif: GifResult) {
    setGifs(false);
    onSend("", { gif, replyToId: replyTo?.id ?? null });
  }

  async function stopAndSend() {
    const file = await recorder.stop();
    if (!file) return;
    setFiles((f) => [...f, { key: "voz", name: "Mensagem de voz", size: file.size, status: "subindo" }]);
    try {
      const attachment = await apiUploadAttachment(detail.id, file, blobUploads);
      setFiles((f) => f.filter((p) => p.key !== "voz"));
      onSend("", { attachments: [attachment], replyToId: replyTo?.id ?? null });
    } catch (e) {
      setFiles((f) => f.filter((p) => p.key !== "voz"));
      onError(e instanceof Error ? e.message : "Falha ao enviar a mensagem de voz.");
    }
  }

  const replyName = replyTo
    ? replyTo.authorId === meId
      ? "você mesmo"
      : memberName(detail.members, replyTo.authorId)
    : "";

  return (
    <div className="shrink-0 px-4 pb-4 pt-3 md:px-5 md:pb-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex flex-col rounded-nav border bg-surface-2 transition-colors",
          dragging ? "border-border-strong" : "border-panel-ring",
        )}
      >
        {replyTo && (
          <div className="flex items-center gap-2 border-b border-panel-ring px-3 py-2 text-[12px] text-muted">
            <ReplyIcon size={13} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Respondendo a <span className="font-semibold text-fg-3">{replyName}</span>
              {" · "}
              <MentionText text={messageText(replyTo)} />
            </span>
            <button
              type="button"
              onClick={onCancelReply}
              aria-label="Cancelar resposta"
              className="tap shrink-0 text-fg-3 transition-colors hover:text-fg-soft"
            >
              <XIcon size={13} />
            </button>
          </div>
        )}

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-panel-ring px-3 py-2.5">
            {files.map((f) => (
              <span
                key={f.key}
                className={cn(
                  "flex max-w-[220px] items-center gap-2 rounded-mark border bg-surface px-2 py-1.5",
                  f.status === "erro" ? "border-danger/50" : "border-panel-ring",
                )}
                title={f.error ?? f.name}
              >
                {f.status === "subindo" ? (
                  <Spinner size={13} className="shrink-0 text-muted" />
                ) : (
                  <FileIcon size={14} className={cn("shrink-0", f.status === "erro" ? "text-danger" : "text-muted")} />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[12px] text-fg-soft">{f.name}</span>
                  <span className="text-[10px] text-muted">
                    {f.status === "subindo" ? "Enviando…" : f.status === "erro" ? "Não subiu" : formatBytes(f.size)}
                  </span>
                </span>
                {f.key !== "voz" && (
                  <button
                    type="button"
                    onClick={() => setFiles((all) => all.filter((p) => p.key !== f.key))}
                    aria-label={`Tirar ${f.name}`}
                    className="tap shrink-0 text-fg-3 transition-colors hover:text-fg-soft"
                  >
                    <XIcon size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2.5 px-3 py-2.5">
          {recorder.recording ? (
            <>
              <ComposerIcon label="Descartar gravação" onClick={recorder.cancel}>
                <TrashIcon size={16} />
              </ComposerIcon>
              <div className="flex min-h-[26px] flex-1 items-center gap-2.5" role="status" aria-live="polite">
                <span className="h-2 w-2 shrink-0 animate-breathe rounded-full bg-danger" aria-hidden="true" />
                <span className="text-[13px] tabular-nums text-fg-soft">
                  Gravando {clock(recorder.seconds)}
                </span>
                <span className="hidden text-[11px] text-muted sm:inline">— o quadrado para e envia</span>
              </div>
              <button
                type="button"
                onClick={() => void stopAndSend()}
                aria-label="Parar e enviar a mensagem de voz"
                title="Parar e enviar"
                className="tap flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-primary text-on-primary"
              >
                <SquareStopIcon size={13} />
              </button>
            </>
          ) : (
            <>
              <ComposerIcon label="Anexar arquivo (até 20 MB)" onClick={() => fileRef.current?.click()}>
                <PaperclipIcon size={16} />
              </ComposerIcon>
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                accept={Object.keys(ATTACHMENT_MIME).join(",")}
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              <textarea
                ref={ref}
                rows={1}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  grow();
                }}
                onPaste={(e) => {
                  if (e.clipboardData.files.length > 0) {
                    e.preventDefault();
                    addFiles(e.clipboardData.files);
                  }
                }}
                {...mentions.inputProps}
                onKeyDown={(e) => {
                  // Com o menu de @ aberto, Enter escolhe a pessoa — não envia.
                  if (mentions.onKeyDown(e)) return;
                  if (e.key === "Escape" && replyTo) {
                    e.preventDefault();
                    onCancelReply();
                    return;
                  }
                  // Enter manda; Shift+Enter quebra a linha, como em toda conversa.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={`Mensagem em ${detail.kind === "grupo" ? "#" : ""}${detail.title}`}
                aria-label={`Mensagem em ${detail.title}`}
                className="max-h-[120px] min-h-[20px] flex-1 resize-none bg-transparent py-[3px] text-[13px] leading-[18px] text-fg-soft outline-none placeholder:text-muted"
              />

              <ComposerIcon label="Emoji" onClick={() => onUndesigned("Seletor de emoji")}>
                <SmileIcon size={16} />
              </ComposerIcon>
              <span ref={gifButtonRef} className="flex">
                <ComposerIcon label="GIF" pressed={gifs} onClick={() => setGifs((g) => !g)}>
                  <StickerIcon size={16} />
                </ComposerIcon>
              </span>

              {draft.trim() || ready.length > 0 || uploading ? (
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Enviar mensagem"
                  title={uploading ? "Esperando os anexos subirem" : "Enviar mensagem"}
                  className={cn(
                    "tap flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-primary text-on-primary transition-opacity",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3",
                    !canSend && "opacity-40",
                  )}
                >
                  <ArrowUpIcon size={14} />
                </button>
              ) : (
                <ComposerIcon label="Gravar mensagem de voz" onClick={() => void recorder.start()}>
                  <MicIcon size={16} />
                </ComposerIcon>
              )}
            </>
          )}
          {mentions.menu()}
        </div>

        {gifs && <GifPicker onPick={sendGif} onClose={closeGifs} toggleRef={gifButtonRef} />}
      </form>
    </div>
  );
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Até 5 minutos por mensagem de voz — passou disso, para e manda sozinha. */
const VOICE_MAX_SECONDS = 5 * 60;

/**
 * O gravador de voz do navegador. Pede o microfone só no clique; o formato é
 * o que o navegador grava (webm/opus no Chrome e Firefox, mp4 no Safari).
 */
function useRecorder(onError: (message: string) => void, onLimit: () => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitRef = useRef(onLimit);
  useEffect(() => {
    limitRef.current = onLimit;
  });

  function release() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setRecording(false);
    setSeconds(0);
  }

  useEffect(() => () => release(), []);

  async function start() {
    if (recording) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return onError("Este navegador não grava áudio.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.start(250);
      recRef.current = rec;
      setRecording(true);
      setSeconds(0);
      const began = Date.now();
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - began) / 1000);
        setSeconds(s);
        if (s >= VOICE_MAX_SECONDS) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          limitRef.current();
        }
      }, 250);
    } catch {
      release();
      onError("Sem acesso ao microfone. Libere a permissão do navegador para gravar.");
    }
  }

  function stop(): Promise<File | null> {
    const rec = recRef.current;
    if (!rec) return Promise.resolve(null);
    return new Promise((resolve) => {
      rec.onstop = () => {
        const type = baseMime(rec.mimeType || "audio/webm");
        const blob = new Blob(chunks.current, { type });
        release();
        if (blob.size === 0) return resolve(null);
        const ext = type === "audio/mp4" ? "m4a" : type === "audio/ogg" ? "ogg" : "webm";
        resolve(new File([blob], `mensagem-de-voz.${ext}`, { type }));
      };
      rec.stop();
    });
  }

  function cancel() {
    const rec = recRef.current;
    if (rec) {
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        // já parado
      }
    }
    release();
  }

  return { recording, seconds, start, stop, cancel };
}

function ComposerIcon({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        "tap flex h-7 w-7 shrink-0 items-center justify-center rounded-chip transition-colors",
        pressed ? "bg-border text-fg-soft" : "text-fg-3 hover:bg-border hover:text-fg-soft",
      )}
    >
      {children}
    </button>
  );
}
