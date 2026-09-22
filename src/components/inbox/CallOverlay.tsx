"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { MicIcon, MicOffIcon, PhoneOffIcon, ScreenShareIcon } from "@/components/icons";
import type { ConversationDetail, InboxMember } from "@/lib/inbox/types";
import { callClock, initialsOf } from "@/lib/inbox/view";
import { apiJoinCall, apiLeaveCall, leaveCallOnExit } from "./api";

/*
 * A chamada, no popup que o Felipe pediu: os dois avatares frente a frente, o
 * cronômetro e os controles embaixo. Ela vive **dentro** da conversa — sai
 * daqui e o chat continua exatamente onde estava.
 *
 * O áudio e a tela passam pelo LiveKit, e a sala é a da conversa: o crachá é
 * emitido pelo servidor, vale para uma sala só e leva a identidade do membro
 * (ver `/api/inbox/conversations/[id]/call`). O navegador nunca escolhe em que
 * sala entra.
 *
 * Sem provedor de mídia configurado no ambiente, a chamada ainda abre: conta o
 * tempo e deixa o registro no histórico, com os controles desligados dizendo
 * por quê. É o mesmo desenho servindo os dois casos — nenhuma tela some
 * porque uma variável de ambiente falta.
 */

type Estado = "entrando" | "na-chamada" | "sem-midia" | "erro";

/** O mínimo da `Room` do LiveKit que esta tela usa. */
type Faixa = {
  kind: string;
  source: string;
  attach: (el?: HTMLMediaElement) => HTMLMediaElement;
  detach: () => HTMLMediaElement[];
};
type Sala = {
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  startAudio: () => Promise<void>;
  localParticipant: {
    setMicrophoneEnabled: (on: boolean) => Promise<unknown>;
    setScreenShareEnabled: (on: boolean) => Promise<unknown>;
  };
  remoteParticipants: Map<string, { identity: string; name?: string }>;
  on: (evento: string, handler: (...args: never[]) => void) => Sala;
};

export function CallOverlay({
  detail,
  me,
  withScreen,
  onClose,
}: {
  detail: ConversationDetail;
  me: InboxMember;
  /** Chamada aberta pelo botão de tela compartilhada. */
  withScreen: boolean;
  /** Fecha a chamada. Vem com a conversa atualizada quando o servidor respondeu. */
  onClose: (conversation?: ConversationDetail) => void;
}) {
  const [estado, setEstado] = useState<Estado>("entrando");
  const [seconds, setSeconds] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [naSala, setNaSala] = useState<string[]>([]);

  const salaRef = useRef<Sala | null>(null);
  const startedAt = useRef(0);
  /** Onde os <audio> das outras pessoas são pendurados — não aparecem na tela. */
  const audioRef = useRef<HTMLDivElement>(null);
  /** A tela compartilhada, quando alguém está compartilhando. */
  const videoRef = useRef<HTMLVideoElement>(null);
  const [temTela, setTemTela] = useState(false);
  /** O navegador recusou o microfone: a chamada segue, ouvindo e mostrando tela. */
  const [semMicrofone, setSemMicrofone] = useState(false);
  /** Celular não compartilha tela pelo navegador — o botão não promete. */
  const [podeTela, setPodeTela] = useState(true);
  useEffect(() => {
    setPodeTela(typeof navigator.mediaDevices?.getDisplayMedia === "function");
  }, []);
  /**
   * Já avisamos o servidor que saímos? A saída tem três portas (o botão, a
   * aba fechando, a tela desmontando) e só a primeira que passar avisa.
   */
  const saiuRef = useRef(false);
  const entrouRef = useRef(false);
  /** Qual montagem do efeito de entrada é a atual (o modo estrito monta duas). */
  const rodadaRef = useRef(0);

  // Cronômetro. Começa quando a chamada entra em tela, não no render.
  useEffect(() => {
    const inicio = Date.now();
    startedAt.current = inicio;
    const id = setInterval(
      () => setSeconds(Math.floor((Date.now() - inicio) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  // Entrar: registrar no servidor e, havendo provedor, conectar na sala.
  useEffect(() => {
    let vivo = true;
    let sala: Sala | null = null;
    const rodada = ++rodadaRef.current;

    (async () => {
      let media;
      try {
        ({ media } = await apiJoinCall(detail.id));
      } catch {
        if (!vivo) return;
        setEstado("erro");
        return;
      }
      if (!vivo) {
        /*
         * A tela fechou enquanto o servidor registrava a entrada — a saída
         * que foi antes pode ter chegado primeiro que ela. Sem esta segunda
         * saída a pessoa ficaria "na chamada" sem estar em lugar nenhum.
         * Só vale se nenhuma montagem mais nova assumiu a chamada (o modo
         * estrito do React monta o efeito duas vezes no `next dev`).
         */
        if (rodadaRef.current === rodada) leaveCallOnExit(detail.id);
        return;
      }
      entrouRef.current = true;
      if (!media) {
        setEstado("sem-midia");
        return;
      }

      try {
        /*
         * Import dinâmico: a biblioteca de mídia é pesada e só faz falta
         * quando alguém liga. Quem só troca mensagem nunca a baixa.
         */
        const { Room, RoomEvent, Track } = await import("livekit-client");
        if (!vivo) return;

        sala = new Room({ adaptiveStream: true, dynacast: true }) as unknown as Sala;
        salaRef.current = sala;

        const anotarQuemEsta = () => {
          if (!vivo || !sala) return;
          setNaSala([...sala.remoteParticipants.values()].map((p) => p.identity));
        };

        sala
          .on(RoomEvent.ParticipantConnected, anotarQuemEsta)
          .on(RoomEvent.ParticipantDisconnected, anotarQuemEsta)
          .on(RoomEvent.TrackSubscribed, ((faixa: Faixa) => {
            if (!vivo) return;
            if (faixa.kind === Track.Kind.Audio) {
              // A voz das outras pessoas: elemento fora da tela, só para tocar.
              audioRef.current?.appendChild(faixa.attach());
              return;
            }
            if (faixa.source === Track.Source.ScreenShare && videoRef.current) {
              faixa.attach(videoRef.current);
              setTemTela(true);
            }
          }) as never)
          .on(RoomEvent.TrackUnsubscribed, ((faixa: Faixa) => {
            faixa.detach().forEach((el) => el.remove());
            if (faixa.source === Track.Source.ScreenShare) setTemTela(false);
          }) as never)
          // Só é interrupção se não fomos nós que desligamos.
          .on(RoomEvent.Disconnected, (() => {
            if (vivo && salaRef.current === sala) setEstado("erro");
          }) as never);

        await sala.connect(media.url, media.token);
        if (!vivo) return;
        try {
          await sala.localParticipant.setMicrophoneEnabled(true);
        } catch {
          /*
           * Microfone recusado (ou nenhum no computador). Isso não é queda:
           * a pessoa ainda ouve o outro lado e pode mostrar a tela. Ela entra
           * no mudo, e o aviso diz como destravar.
           */
          if (!vivo) return;
          setSemMicrofone(true);
          setMudo(true);
        }
        // A chamada nasce de um clique, então o navegador deixa o áudio tocar.
        await sala.startAudio().catch(() => undefined);
        anotarQuemEsta();
        setEstado("na-chamada");

        if (withScreen) {
          try {
            await sala.localParticipant.setScreenShareEnabled(true);
            if (vivo) setCompartilhando(true);
          } catch {
            // Escolher a tela é decisão de quem está na frente do
            // computador: recusar não derruba a chamada.
          }
        }
      } catch {
        // O provedor explica a falha em inglês e em termos de rede; quem está
        // na chamada precisa saber outra coisa — que a voz não vai passar.
        if (!vivo) return;
        setEstado("erro");
      }
    })();

    return () => {
      vivo = false;
      salaRef.current = null;
      void sala?.disconnect();
      // Saiu da tela sem apertar encerrar (trocou de página no meio da
      // chamada): o servidor precisa saber, ou a chamada fica fantasma.
      if (entrouRef.current && !saiuRef.current) {
        saiuRef.current = true;
        leaveCallOnExit(detail.id);
      }
    };
  }, [detail.id, withScreen]);

  /*
   * Aba fechando, recarregando ou o celular matando a página: nada de
   * `await` chega a rodar aqui, então a saída vai num pedido que o navegador
   * termina de mandar sozinho. Sem isso a pessoa ficava presa na chamada até
   * o registro envelhecer (4h), e o "Chamada em andamento" mentia esse tempo.
   */
  useEffect(() => {
    function onPageHide() {
      if (!entrouRef.current || saiuRef.current) return;
      saiuRef.current = true;
      leaveCallOnExit(detail.id);
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [detail.id]);

  async function encerrar() {
    const sala = salaRef.current;
    salaRef.current = null;
    await sala?.disconnect().catch(() => undefined);
    if (saiuRef.current) return onClose();
    saiuRef.current = true;
    try {
      onClose(await apiLeaveCall(detail.id));
    } catch {
      onClose();
    }
  }

  // Esc encerra, como fecha qualquer sobreposição do produto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void encerrar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `encerrar` só depende de refs e do id da conversa.
  }, [detail.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function alternarMudo() {
    const sala = salaRef.current;
    if (!sala) return;
    const proximo = !mudo;
    setMudo(proximo);
    try {
      await sala.localParticipant.setMicrophoneEnabled(!proximo);
      if (!proximo) setSemMicrofone(false);
    } catch {
      setMudo(!proximo);
      setSemMicrofone(true);
    }
  }

  async function alternarTela() {
    const sala = salaRef.current;
    if (!sala) return;
    const proximo = !compartilhando;
    try {
      await sala.localParticipant.setScreenShareEnabled(proximo);
      setCompartilhando(proximo);
      if (!proximo) setTemTela(false);
    } catch {
      // Cancelar o seletor de tela do navegador não é erro.
    }
  }

  const outros = detail.members.filter((m) => m.id !== me.id);
  const doOutroLado = detail.kind === "direta" ? outros[0]?.name : detail.title;
  const extras = detail.kind === "grupo" ? Math.max(0, outros.length - 1) : 0;
  const ativo = estado === "na-chamada";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chamada em ${detail.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 animate-fade-in bg-black/75 backdrop-blur-[3px]" />

      <div
        className={cn(
          "relative flex w-full animate-scale-in flex-col items-center gap-5 rounded-card border border-border bg-surface p-6 shadow-[0_24px_64px_rgba(0,0,0,0.65)]",
          // A tela compartilhada precisa de espaço; sem ela o popup é o do desenho.
          temTela ? "max-w-[720px]" : "max-w-[380px]",
        )}
      >
        <div className="flex flex-col items-center gap-1">
          <p className="text-[15px] font-semibold text-fg">{detail.title}</p>
          <p className="text-[12px] tabular-nums text-muted">
            {estado === "entrando"
              ? "Entrando na chamada…"
              : estado === "erro"
                ? "Chamada interrompida"
                : callClock(seconds)}
            {ativo && naSala.length > 0 && ` · ${naSala.length + 1} na chamada`}
          </p>
        </div>

        {/*
         * A tela compartilhada. O desenho do Felipe tem os dois avatares; onde
         * a tela aparece quando alguém compartilha ainda não foi desenhado —
         * por ora ela ocupa o corpo do popup e os avatares descem, que é o
         * arranjo que não esconde nenhum dos dois. Falta confirmar.
         */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "w-full rounded-panel bg-black",
            temTela ? "block aspect-video" : "hidden",
          )}
        />

        <div className="flex items-center gap-3">
          <CallAvatar name={me.name} label="Você" falando={ativo && !mudo} />
          <span className="h-px w-6 bg-border" aria-hidden="true" />
          <CallAvatar
            name={doOutroLado ?? detail.title}
            label={doOutroLado ?? detail.title}
            falando={ativo && naSala.length > 0}
          />
          {extras > 0 && (
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-pill border border-dashed border-border text-[12px] font-medium text-muted">
              +{extras}
            </span>
          )}
        </div>

        {estado === "sem-midia" && (
          <p className="max-w-[280px] text-center text-[11px] leading-[16px] text-muted">
            Áudio e tela precisam do provedor de mídia configurado neste
            ambiente. A chamada segue marcando o tempo e fica registrada na
            conversa.
          </p>
        )}
        {estado === "erro" && (
          <p className="max-w-[280px] text-center text-[11px] leading-[16px] text-muted">
            O áudio não conseguiu passar — pode ser a conexão de alguém ou o
            provedor de mídia fora do ar. O tempo até aqui fica registrado na
            conversa.
          </p>
        )}
        {estado === "entrando" && (
          <p className="text-[11px] text-muted">Pedindo o microfone…</p>
        )}
        {ativo && semMicrofone && (
          <p className="max-w-[280px] text-center text-[11px] leading-[16px] text-muted">
            O navegador não liberou o microfone. Você ouve a chamada e pode
            mostrar a tela; para falar, libere o microfone no cadeado da barra
            de endereço e tire do mudo.
          </p>
        )}

        <div className="flex items-center gap-3">
          <CallButton
            label={mudo ? "Tirar do mudo" : "Ficar no mudo"}
            onClick={alternarMudo}
            disabled={!ativo}
            active={mudo}
          >
            {mudo ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
          </CallButton>
          <CallButton
            label={
              !podeTela
                ? "Este navegador não compartilha tela"
                : compartilhando
                  ? "Parar de compartilhar"
                  : "Compartilhar tela"
            }
            onClick={alternarTela}
            disabled={!ativo || !podeTela}
            active={compartilhando}
          >
            <ScreenShareIcon size={18} />
          </CallButton>
          <button
            type="button"
            onClick={encerrar}
            aria-label="Encerrar chamada"
            title="Encerrar chamada"
            autoFocus
            className="tap flex h-control w-control items-center justify-center rounded-pill bg-primary text-on-primary transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3"
          >
            <PhoneOffIcon size={18} />
          </button>
        </div>
      </div>

      {/* A voz das outras pessoas mora aqui — som, sem nada para ver. */}
      <div ref={audioRef} className="sr-only" aria-hidden="true" />
    </div>
  );
}

function CallAvatar({
  name,
  label,
  falando,
}: {
  name: string;
  label: string;
  falando?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={cn(
          "flex h-[52px] w-[52px] items-center justify-center rounded-pill bg-border-strong text-[16px] font-semibold text-fg transition-shadow",
          falando && "inset-ring-2 inset-ring-fg-3",
        )}
        aria-hidden="true"
      >
        {initialsOf(name)}
      </span>
      <span className="max-w-[96px] truncate text-[11px] text-fg-3">{label}</span>
    </div>
  );
}

function CallButton({
  label,
  disabled,
  active,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "tap flex h-control w-control items-center justify-center rounded-pill transition-colors",
        active ? "bg-border text-fg-soft" : "bg-surface-2 text-fg-3",
        disabled ? "cursor-not-allowed opacity-45" : "hover:bg-border hover:text-fg-soft",
      )}
    >
      {children}
    </button>
  );
}
