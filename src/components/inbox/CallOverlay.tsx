"use client";

import { playCallCue, startRing } from "@/components/settings/sounds";
import { stopIncomingRing } from "./InboxNotifier";
import { useDraggable } from "@/components/ui/useDraggable";
import { MemberAvatar } from "./MemberAvatar";
import { loadAudioPrefs, saveAudioPrefs } from "@/lib/inbox/audioPrefs";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  ChevronUpIcon,
  EllipsisIcon,
  LayoutGridIcon,
  Maximize2Icon,
  MessageSquareIcon,
  MicIcon,
  MicOffIcon,
  Minimize2Icon,
  PhoneOffIcon,
  ScreenShareIcon,
  SettingsIcon,
  SignalHighIcon,
  SmilePlusIcon,
  UsersIcon,
  VideoIcon,
  VideoOffIcon,
  XIcon,
} from "@/components/icons";
import { Popover } from "@/components/ui/Popover";
import { MenuDropdown, MenuPanel, MenuRow, MenuTitle, MenuToggle } from "@/components/ui/MenuPanel";
import type { ConversationDetail, InboxMember } from "@/lib/inbox/types";
import { callClock, initialsOf } from "@/lib/inbox/view";
import { apiJoinCall, apiLeaveCall, apiTouchCall, leaveCallOnExit } from "./api";
import { CALL_HEARTBEAT_MS } from "@/lib/inbox/call";
import { desktopBridge, hasSharePicker } from "@/lib/desktop";
import {
  toDeviceOptions,
  type ActiveDevices,
  type CallDevices,
  type DeviceKind,
} from "@/lib/inbox/devices";
import {
  DEFAULT_SCREEN_QUALITY,
  loadScreenQuality,
  saveScreenQuality,
  screenShareOptions,
  type ScreenQuality,
} from "@/lib/inbox/screenQuality";
import {
  DEFAULT_CAMERA_PREFS,
  REACTIONS,
  REACTION_MS,
  cameraCapture,
  cameraEffects,
  decodeReaction,
  encodeReaction,
  loadCameraPrefs,
  saveCameraPrefs,
  supportsEffect,
  type CameraPrefs,
  type Reaction,
} from "@/lib/inbox/callPrefs";
import { CameraModal, ShareScreenModal, StreamQualityModal } from "./CallModals";

/*
 * A chamada — export "Call View (Discord)" e "Modais de controle da
 * chamada". Aberta, ela ocupa o lugar da conversa no Inbox: cabeçalho com a
 * sala e o tempo, os quadros de quem está na chamada, o palco de quem
 * apresenta e a barra de controles embaixo. Minimizada, vira o cartão do
 * canto e a sala segue de pé enquanto a pessoa usa o resto do produto.
 *
 * O áudio, a câmera e a tela passam pelo LiveKit, e a sala é a da conversa:
 * o crachá é emitido pelo servidor, vale para uma sala só e leva a
 * identidade do membro (ver `/api/inbox/conversations/[id]/call`). O
 * navegador nunca escolhe em que sala entra.
 *
 * Sem provedor de mídia configurado no ambiente, a chamada ainda abre: conta o
 * tempo e deixa o registro no histórico, com os controles desligados dizendo
 * por quê. É o mesmo desenho servindo os dois casos — nenhuma tela some
 * porque uma variável de ambiente falta.
 */

/**
 * `outra-aba`: você entrou nesta mesma chamada por outra aba ou outro
 * aparelho, e ela passou para lá. Não é queda, e esta aba não avisa saída
 * nenhuma, porque você continua na chamada.
 */
type Estado = "entrando" | "na-chamada" | "sem-midia" | "erro" | "outra-aba";

/** O mínimo da `Room` do LiveKit que esta tela usa. */
type Faixa = {
  kind: string;
  source: string;
  attach: (el?: HTMLMediaElement) => HTMLMediaElement;
  detach: (el?: HTMLMediaElement) => unknown;
  attachedElements?: HTMLMediaElement[];
  mediaStreamTrack?: MediaStreamTrack;
};
type Publicacao = {
  isMuted: boolean;
  source?: string;
  track?: Faixa & {
    restartTrack?: (opcoes: unknown) => Promise<void>;
    sender?: RTCRtpSender;
  };
};
type Captura = {
  deviceId?: string;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
};
type Participante = {
  identity: string;
  getTrackPublication: (source: string) => Publicacao | undefined;
};
type Sala = {
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  startAudio: () => Promise<void>;
  switchActiveDevice: (kind: DeviceKind, deviceId: string) => Promise<boolean>;
  getActiveDevice: (kind: DeviceKind) => string | undefined;
  localParticipant: {
    identity: string;
    setMicrophoneEnabled: (on: boolean, opcoes?: Captura) => Promise<unknown>;
    setCameraEnabled: (on: boolean, opcoes?: ReturnType<typeof cameraCapture>) => Promise<Publicacao | undefined>;
    setScreenShareEnabled: (on: boolean, captura?: unknown, publicacao?: unknown) => Promise<unknown>;
    getTrackPublication: (source: string) => Publicacao | undefined;
    publishData: (data: Uint8Array, opcoes?: { reliable?: boolean }) => Promise<void>;
  };
  remoteParticipants: Map<string, Participante>;
  on: (evento: string, handler: (...args: never[]) => void) => Sala;
};

/** Quem está do outro lado, do jeito que a tela desenha. */
type Remoto = { id: string; camera: Faixa | null; tela: Faixa | null; mudo: boolean };

const SEM_APARELHOS: CallDevices = { audioinput: [], audiooutput: [], videoinput: [] };

/** Os nomes que o LiveKit dá às fontes — fixos, para não importar a biblioteca no render. */
const FONTE = { camera: "camera", tela: "screen_share", microfone: "microphone" } as const;

/** Tela cheia de um elemento: entra, ou sai se já estiver nela. */
function alternarTelaCheiaDe(el: HTMLElement | null) {
  if (!el) return;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  else void el.requestFullscreen?.().catch(() => undefined);
}

/** Liga a tela com a escolha do modal (tipo, resolução, quadros, som). */
function ligarTela(sala: Sala, q: ScreenQuality) {
  const o = screenShareOptions(q);
  return sala.localParticipant.setScreenShareEnabled(true, o.capture, o.publish);
}

/**
 * Reajusta a tela que já está no ar para a qualidade `q`: resolução e
 * quadros na captura, teto de banda e quadros no codificador — sem abrir o
 * seletor de novo.
 */
async function aplicarQualidade(sala: Sala, q: ScreenQuality) {
  const faixa = sala.localParticipant.getTrackPublication(FONTE.tela)?.track;
  const o = screenShareOptions(q);
  try {
    const mst = faixa?.mediaStreamTrack;
    if (mst) {
      await mst.applyConstraints(o.constraints);
      mst.contentHint = o.capture.contentHint;
    }
    const sender = faixa?.sender;
    if (sender) {
      const params = sender.getParameters();
      for (const enc of params.encodings ?? []) {
        enc.maxBitrate = o.publish.screenShareEncoding.maxBitrate;
        enc.maxFramerate = o.publish.screenShareEncoding.maxFramerate;
      }
      (params as { degradationPreference?: string }).degradationPreference = o.publish.degradationPreference;
      await sender.setParameters(params);
    }
  } catch {
    // Tela que não aceita a resolução pedida segue na que tinha.
  }
}

/** Por quanto tempo quem liga ouve o "chamando" antes de ele parar sozinho. */
const CHAMANDO_MAX_MS = 45_000;

/** O Chrome e o Edge deixam a página escolher o alto-falante; o Safari não. */
function escolheSaida(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

/** Os efeitos da câmera (desfoque, iluminação) que o aparelho oferece. */
function aplicarEfeitos(faixa: Faixa | undefined, prefs: CameraPrefs) {
  const mst = faixa?.mediaStreamTrack;
  if (!mst) return;
  const caps = (mst.getCapabilities?.() as Record<string, unknown>) ?? {};
  const pedidos = cameraEffects(prefs, caps);
  const valem = Object.fromEntries(
    Object.entries(pedidos).filter(([k]) => supportsEffect(caps, k === "backgroundBlur" ? "blur" : "lighting")),
  );
  if (Object.keys(valem).length) void mst.applyConstraints(valem as MediaTrackConstraints).catch(() => undefined);
}

export function CallOverlay({
  detail,
  me,
  withScreen,
  minimized,
  slot,
  onMinimize,
  onExpand,
  onClose,
}: {
  detail: ConversationDetail;
  me: InboxMember;
  /** Chamada aberta pelo botão de tela compartilhada. */
  withScreen: boolean;
  /** Recolhida no cartão do canto: a sala segue de pé. */
  minimized: boolean;
  /** O lugar da conversa no Inbox; sem ele, a chamada ocupa a tela inteira. */
  slot: HTMLElement | null;
  onMinimize: () => void;
  onExpand: () => void;
  /** Fecha a chamada. Vem com a conversa atualizada quando o servidor respondeu. */
  onClose: (conversation?: ConversationDetail) => void;
}) {
  const [estado, setEstado] = useState<Estado>("entrando");
  const [mudo, setMudo] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [naSala, setNaSala] = useState<string[]>([]);
  const [remotos, setRemotos] = useState<Remoto[]>([]);
  const [falando, setFalando] = useState<Set<string>>(new Set());
  const [meuVideo, setMeuVideo] = useState<Faixa | null>(null);
  const [minhaTela, setMinhaTela] = useState<Faixa | null>(null);
  const [reacoes, setReacoes] = useState<Record<string, { emoji: Reaction; key: number }>>({});

  const salaRef = useRef<Sala | null>(null);
  const startedAt = useRef(0);
  /** Onde os <audio> das outras pessoas são pendurados — não aparecem na tela. */
  const audioRef = useRef<HTMLDivElement>(null);
  /** O vídeo do palco (quem apresenta) — de onde sai o selo de resolução. */
  const palcoBoxRef = useRef<HTMLDivElement>(null);
  /** A chamada inteira — o que vai para a tela cheia pelo botão do cabeçalho. */
  const vistaRef = useRef<HTMLDivElement>(null);
  /** O navegador recusou o microfone: a chamada segue, ouvindo e mostrando tela. */
  const [semMicrofone, setSemMicrofone] = useState(false);

  const [aparelhos, setAparelhos] = useState<CallDevices>(SEM_APARELHOS);
  const [ativos, setAtivos] = useState<ActiveDevices>({});
  const ativosRef = useRef(ativos);
  ativosRef.current = ativos;
  const [saidaSuportada, setSaidaSuportada] = useState(false);
  const [camera, setCamera] = useState(false);
  const [semCamera, setSemCamera] = useState(false);
  // Começa com o que foi escolhido em Configurações › Chamada e áudio.
  const [reduzirRuido, setReduzirRuido] = useState(() => loadAudioPrefs().noiseSuppression);
  const lerAparelhosRef = useRef<() => Promise<void>>(async () => {});

  /** A qualidade da transmissão e a câmera — preferências guardadas entre chamadas. */
  const [qualidade, setQualidade] = useState<ScreenQuality>(DEFAULT_SCREEN_QUALITY);
  const qualidadeRef = useRef(qualidade);
  qualidadeRef.current = qualidade;
  const [cameraPrefs, setCameraPrefs] = useState<CameraPrefs>(DEFAULT_CAMERA_PREFS);
  useEffect(() => {
    setQualidade(loadScreenQuality());
    setCameraPrefs(loadCameraPrefs());
  }, []);

  const [modal, setModal] = useState<"tela" | "camera" | "qualidade" | null>(null);
  const [menu, setMenu] = useState<"audio" | "reagir" | "mais" | null>(null);
  const [painel, setPainel] = useState(false);
  const [layout, setLayout] = useState<"palco" | "grade">("palco");
  const [telaCheia, setTelaCheia] = useState(false);
  /** Resolução e quadros que estão chegando de verdade, para o selo do palco. */
  const [recebendo, setRecebendo] = useState<{ w: number; h: number; fps: number } | null>(null);
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

  // Onde desenhar: em cima do lugar da conversa no Inbox, acompanhando o tamanho dele.
  const [lugar, setLugar] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    if (!slot) {
      setLugar(null);
      return;
    }
    const medir = () => {
      const r = slot.getBoundingClientRect();
      setLugar({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(slot);
    window.addEventListener("resize", medir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [slot]);

  const mostrarReacao = useCallback((id: string, emoji: Reaction) => {
    const key = Date.now() + Math.random();
    setReacoes((r) => ({ ...r, [id]: { emoji, key } }));
    setTimeout(() => {
      setReacoes((r) => {
        if (r[id]?.key !== key) return r;
        const { [id]: _saiu, ...resto } = r;
        void _saiu;
        return resto;
      });
    }, REACTION_MS);
  }, []);

  // Cronômetro. Começa quando a chamada entra em tela, não no render.
  useEffect(() => {
    startedAt.current = Date.now();
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
        const { DisconnectReason, Room, RoomEvent, Track } = await import("livekit-client");
        if (!vivo) return;

        sala = new Room({ adaptiveStream: true, dynacast: true }) as unknown as Sala;
        salaRef.current = sala;

        /*
         * Quem está do outro lado e o que cada um mostra, relido da sala a
         * cada evento que pode mudar isso. Desligar a câmera no LiveKit
         * silencia a faixa em vez de tirá-la, então a pergunta é sempre
         * "está acesa agora?".
         */
        const atualizar = () => {
          if (!vivo || !sala) return;
          const lista: Remoto[] = [];
          for (const p of sala.remoteParticipants.values()) {
            const cam = p.getTrackPublication(Track.Source.Camera);
            const tela = p.getTrackPublication(Track.Source.ScreenShare);
            const mic = p.getTrackPublication(Track.Source.Microphone);
            lista.push({
              id: p.identity,
              camera: cam?.track && !cam.isMuted ? cam.track : null,
              tela: tela?.track && !tela.isMuted ? tela.track : null,
              mudo: !mic || mic.isMuted,
            });
          }
          setRemotos(lista);
          setNaSala(lista.map((r) => r.id));
        };

        const lerAparelhos = async () => {
          const kinds: DeviceKind[] = ["audioinput", "audiooutput", "videoinput"];
          try {
            const listas = await Promise.all(kinds.map((k) => Room.getLocalDevices(k, false)));
            if (!vivo || !sala) return;
            const atual = sala;
            setAparelhos({
              audioinput: toDeviceOptions(listas[0], "audioinput"),
              audiooutput: toDeviceOptions(listas[1], "audiooutput"),
              videoinput: toDeviceOptions(listas[2], "videoinput"),
            });
            setAtivos((a) => ({
              audioinput: atual.getActiveDevice("audioinput") ?? a.audioinput,
              audiooutput: atual.getActiveDevice("audiooutput") ?? a.audiooutput,
              videoinput: atual.getActiveDevice("videoinput") ?? a.videoinput,
            }));
          } catch {
            // Sem lista, o menu mostra "Nenhum encontrado" — a chamada segue.
          }
        };
        lerAparelhosRef.current = lerAparelhos;

        sala
          .on(RoomEvent.ParticipantConnected, atualizar)
          .on(RoomEvent.ParticipantDisconnected, atualizar)
          .on(RoomEvent.TrackSubscribed, ((faixa: Faixa) => {
            if (!vivo) return;
            if (faixa.kind === Track.Kind.Audio) {
              // A voz das outras pessoas: elemento fora da tela, só para tocar.
              const el = faixa.attach();
              audioRef.current?.appendChild(el);
              // A saída escolhida no menu vale também para quem entra depois.
              const saida = ativosRef.current.audiooutput;
              if (saida) void sala?.switchActiveDevice("audiooutput", saida);
            }
            atualizar();
          }) as never)
          .on(RoomEvent.TrackUnsubscribed, ((faixa: Faixa) => {
            // Só os <audio> fomos nós que criamos; os <video> são da tela e se soltam sozinhos.
            if (faixa.kind === Track.Kind.Audio) {
              const els = faixa.detach() as HTMLMediaElement[];
              els.forEach((el) => el.remove());
            }
            atualizar();
          }) as never)
          .on(RoomEvent.TrackMuted, atualizar)
          .on(RoomEvent.TrackUnmuted, atualizar)
          // "Parar de compartilhar" na barra do navegador também desliga o botão.
          .on(RoomEvent.LocalTrackUnpublished, ((pub: Publicacao) => {
            if (!vivo || pub.source !== Track.Source.ScreenShare) return;
            setCompartilhando(false);
            setMinhaTela(null);
          }) as never)
          .on(RoomEvent.ActiveSpeakersChanged, ((quem: { identity: string }[]) => {
            if (vivo) setFalando(new Set(quem.map((p) => p.identity)));
          }) as never)
          .on(RoomEvent.DataReceived, ((dados: Uint8Array, de?: { identity: string }) => {
            const emoji = decodeReaction(dados);
            if (vivo && emoji && de) mostrarReacao(de.identity, emoji);
          }) as never)
          .on(RoomEvent.MediaDevicesChanged, (() => void lerAparelhos()) as never)
          // Só é interrupção se não fomos nós que desligamos.
          .on(RoomEvent.Disconnected, ((motivo?: number) => {
            if (!vivo || salaRef.current !== sala) return;
            if (motivo === DisconnectReason.DUPLICATE_IDENTITY) {
              /*
               * A mesma pessoa entrou na sala por outra aba: o LiveKit deixa
               * uma conexão por pessoa e derruba a mais velha. Esta aba sai
               * de cena calada — avisar a saída tiraria você da chamada em
               * que você acabou de entrar pela outra.
               */
              saiuRef.current = true;
              salaRef.current = null;
              setEstado("outra-aba");
              return;
            }
            setEstado("erro");
          }) as never);

        await sala.connect(media.url, media.token);
        if (!vivo) return;
        try {
          const audio = loadAudioPrefs();
          await sala.localParticipant.setMicrophoneEnabled(true, {
            ...(audio.inputId ? { deviceId: audio.inputId } : {}),
            noiseSuppression: audio.noiseSuppression,
            echoCancellation: true,
            autoGainControl: true,
          });
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
        // A saída de som escolhida nas Configurações, se este navegador deixa escolher.
        const saidaSalva = loadAudioPrefs().outputId;
        if (saidaSalva && escolheSaida()) {
          const trocou = await sala.switchActiveDevice("audiooutput", saidaSalva).catch(() => false);
          if (trocou && vivo) setAtivos((a) => ({ ...a, audiooutput: saidaSalva }));
        }
        atualizar();
        setSaidaSuportada(escolheSaida());
        // Depois do microfone: antes da permissão o navegador esconde os nomes.
        await lerAparelhos();
        if (!vivo) return;
        setEstado("na-chamada");

        if (withScreen) {
          try {
            await ligarTela(sala, qualidadeRef.current);
            if (!vivo) return;
            setCompartilhando(true);
            setMinhaTela(sala.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track ?? null);
          } catch {
            // Escolher a tela é decisão de quem está na frente do computador:
            // recusar não derruba a chamada.
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
  }, [detail.id, withScreen, mostrarReacao]);

  /*
   * O "ainda estou aqui". Quem para de mandar sai da chamada sozinho (ver
   * `lib/inbox/call.ts`), então é isto que separa uma chamada longa de uma
   * chamada abandonada. Se o servidor já tinha te dado como fora (aba
   * dormindo tempo demais), você volta — a sala do LiveKit nunca caiu.
   */
  useEffect(() => {
    if (estado !== "na-chamada" && estado !== "sem-midia") return;
    let vivo = true;
    async function sinal() {
      if (!vivo || saiuRef.current) return;
      try {
        const { inCall } = await apiTouchCall(detail.id);
        if (!inCall && vivo && !saiuRef.current) await apiJoinCall(detail.id);
      } catch {
        // Rede instável: o próximo sinal tenta de novo, e há folga de 2 min.
      }
    }
    const id = setInterval(sinal, CALL_HEARTBEAT_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void sinal();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [estado, detail.id]);

  /*
   * Aba fechando, recarregando ou o celular matando a página: nada de
   * `await` chega a rodar aqui, então a saída vai num pedido que o navegador
   * termina de mandar sozinho.
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

  /*
   * No app de desktop, Ctrl/Cmd+Shift+M liga e desliga o microfone mesmo com
   * outra janela na frente. O atalho só existe enquanto a sala está
   * conectada — fora da chamada ele fica livre para os outros programas.
   */
  const alternarMudoRef = useRef(alternarMudo);
  alternarMudoRef.current = alternarMudo;
  useEffect(() => {
    const desktop = desktopBridge();
    if (!desktop || estado !== "na-chamada") return;
    desktop.setInCall(true);
    const parar = desktop.onToggleMute(() => void alternarMudoRef.current());
    return () => {
      parar();
      desktop.setInCall(false);
    };
  }, [estado]);

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

  async function trocarAparelho(kind: DeviceKind, id: string) {
    const sala = salaRef.current;
    if (!sala) return;
    const antes = ativos[kind];
    setAtivos((a) => ({ ...a, [kind]: id }));
    try {
      const ok = await sala.switchActiveDevice(kind, id);
      if (!ok) throw new Error("troca recusada");
      // Microfone e saída trocados aqui valem para a próxima chamada também.
      if (kind === "audioinput") saveAudioPrefs({ ...loadAudioPrefs(), inputId: id });
      if (kind === "audiooutput") saveAudioPrefs({ ...loadAudioPrefs(), outputId: id });
    } catch {
      // Aparelho desconectado no meio do caminho: volta a marcar o anterior.
      setAtivos((a) => ({ ...a, [kind]: antes }));
    }
  }

  /** Liga a câmera com as preferências do modal (aparelho, resolução, efeitos). */
  async function ligarCamera(prefs: CameraPrefs): Promise<boolean> {
    const sala = salaRef.current;
    if (!sala) return false;
    try {
      const pub = await sala.localParticipant.setCameraEnabled(true, cameraCapture(prefs));
      aplicarEfeitos(pub?.track, prefs);
      setMeuVideo(pub?.track ?? null);
      setCamera(true);
      setSemCamera(false);
      // A primeira permissão de câmera é o que libera o nome delas na lista.
      void lerAparelhosRef.current();
      return true;
    } catch {
      setCamera(false);
      setMeuVideo(null);
      setSemCamera(true);
      return false;
    }
  }

  async function alternarCamera() {
    const sala = salaRef.current;
    if (!sala) return;
    if (camera) {
      await sala.localParticipant.setCameraEnabled(false).catch(() => undefined);
      setCamera(false);
      setMeuVideo(null);
      return;
    }
    await ligarCamera(cameraPrefs);
  }

  /** "Aplicar" do modal Câmera: guarda e, com a câmera acesa, reabre com a escolha nova. */
  async function aplicarCamera(prefs: CameraPrefs) {
    setCameraPrefs(prefs);
    saveCameraPrefs(prefs);
    setModal(null);
    const sala = salaRef.current;
    if (!sala || !camera) return;
    await sala.localParticipant.setCameraEnabled(false).catch(() => undefined);
    await ligarCamera(prefs);
  }

  async function alternarReduzirRuido() {
    const sala = salaRef.current;
    if (!sala) return;
    const proximo = !reduzirRuido;
    setReduzirRuido(proximo);
    saveAudioPrefs({ ...loadAudioPrefs(), noiseSuppression: proximo });
    // O filtro é do navegador: mudar exige reabrir o microfone com a regra nova.
    const faixa = sala.localParticipant.getTrackPublication(FONTE.microfone)?.track;
    try {
      await faixa?.restartTrack?.({
        deviceId: ativos.audioinput,
        noiseSuppression: proximo,
        echoCancellation: true,
        autoGainControl: true,
      });
    } catch {
      setReduzirRuido(!proximo);
    }
  }

  /** "Compartilhar" do modal: guarda a escolha e liga (ou troca) a transmissão. */
  async function compartilhar(q: ScreenQuality) {
    setModal(null);
    setQualidade(q);
    saveScreenQuality(q);
    const sala = salaRef.current;
    if (!sala) return;
    try {
      if (compartilhando) await sala.localParticipant.setScreenShareEnabled(false);
      await ligarTela(sala, q);
      setCompartilhando(true);
      setMinhaTela(sala.localParticipant.getTrackPublication(FONTE.tela)?.track ?? null);
    } catch {
      // Cancelou o seletor do navegador: se já transmitia, a anterior parou.
      setCompartilhando(false);
      setMinhaTela(null);
    }
  }

  async function pararTela() {
    const sala = salaRef.current;
    if (!sala) return;
    await sala.localParticipant.setScreenShareEnabled(false).catch(() => undefined);
    setCompartilhando(false);
    setMinhaTela(null);
  }

  /*
   * "Salvar" da Qualidade da transmissão no meio da transmissão vale na
   * hora: a captura é reajustada e o codificador recebe o novo teto de banda
   * e de quadros — sem abrir o seletor de tela de novo.
   */
  async function mudarQualidade(q: ScreenQuality) {
    setModal(null);
    setQualidade(q);
    saveScreenQuality(q);
    const sala = salaRef.current;
    if (!sala || !compartilhando) return;
    await aplicarQualidade(sala, q);
  }

  /*
   * No app de desktop (0.0.7+) o seletor do próprio app já é o modal
   * "Compartilhar tela" do desenho — fonte, resolução, quadros e som numa
   * janela só. Então a página não abre o modal dela: conta ao app a
   * qualidade de hoje, pede a tela e, com ela no ar, ajusta para o que foi
   * escolhido lá.
   */
  async function compartilharNoDesktop() {
    const desktop = desktopBridge();
    const sala = salaRef.current;
    if (!sala || !hasSharePicker(desktop)) return;
    setModal(null);
    desktop.setShareQuality({ resolution: qualidade.resolution, fps: qualidade.fps, systemAudio: qualidade.systemAudio });
    try {
      if (compartilhando) await sala.localParticipant.setScreenShareEnabled(false);
      // Captura no teto e desce para a escolha: subir a resolução depois não
      // funciona com toda captura. O som vai pedido — quem decide é a chave
      // do seletor.
      await ligarTela(sala, { ...qualidade, resolution: "original", fps: 60, systemAudio: true });
      const escolhida = await desktop.takeShareQuality().catch(() => null);
      const q: ScreenQuality = escolhida ? { ...qualidade, ...escolhida } : qualidade;
      setQualidade(q);
      saveScreenQuality(q);
      await aplicarQualidade(sala, q);
      setCompartilhando(true);
      setMinhaTela(sala.localParticipant.getTrackPublication(FONTE.tela)?.track ?? null);
    } catch {
      // Cancelou no seletor: se já transmitia, a anterior parou.
      setCompartilhando(false);
      setMinhaTela(null);
    }
  }

  /** "Apresentar": no app de desktop novo, direto no seletor dele; senão, o modal. */
  function abrirCompartilhar() {
    if (hasSharePicker(desktopBridge())) void compartilharNoDesktop();
    else setModal("tela");
  }

  async function reagir(emoji: Reaction) {
    setMenu(null);
    mostrarReacao(me.id, emoji);
    await salaRef.current?.localParticipant.publishData(encodeReaction(emoji), { reliable: true }).catch(() => undefined);
  }

  // Quem apresenta: a primeira tela de fora; senão a sua.
  const apresentador = remotos.find((r) => r.tela) ?? null;
  const telaNoPalco = apresentador?.tela ?? minhaTela;
  const quemApresenta = apresentador
    ? (detail.members.find((m) => m.id === apresentador.id)?.name ?? "Alguém")
    : minhaTela
      ? "Você"
      : null;

  // O selo "1080p · 30fps": o que está chegando de verdade, a cada segundo.
  useEffect(() => {
    if (!telaNoPalco) {
      setRecebendo(null);
      return;
    }
    let antes = -1;
    const id = setInterval(() => {
      // O <video> onde a tela está pendurada agora (palco ou grade).
      const v = telaNoPalco.attachedElements?.find((e): e is HTMLVideoElement => e instanceof HTMLVideoElement);
      if (!v || !v.videoWidth) return;
      const quadros = v.getVideoPlaybackQuality?.().totalVideoFrames ?? 0;
      const fps = antes < 0 ? 0 : Math.max(0, quadros - antes);
      antes = quadros;
      const w = v.videoWidth;
      const h = v.videoHeight;
      setRecebendo((r) => (r && r.w === w && r.h === h && r.fps === fps ? r : { w, h, fps }));
    }, 1000);
    return () => clearInterval(id);
  }, [telaNoPalco]);

  useEffect(() => {
    const aoMudar = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  // F: tela cheia (do palco, com alguém apresentando). Esc fecha o menu aberto.
  const minimizedRef = useRef(minimized);
  minimizedRef.current = minimized;
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const temTelaRef = useRef(!!telaNoPalco);
  temTelaRef.current = !!telaNoPalco;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Com modal aberto, o teclado é dele (o Esc ele mesmo trata).
      if (minimizedRef.current || modalRef.current) return;
      const alvo = e.target instanceof Element ? e.target : null;
      const digitando = alvo?.closest("input, textarea, select, [contenteditable='true']");
      if (e.key === "Escape") return setMenu(null);
      if ((e.key === "f" || e.key === "F") && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey) {
        alternarTelaCheiaDe(temTelaRef.current ? palcoBoxRef.current : vistaRef.current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ativo = estado === "na-chamada";
  // O cartão do canto (chamada minimizada) vai para onde a pessoa arrastar.
  const canto = useDraggable<HTMLDivElement>("bb:chamada-canto");

  const outros = detail.members.filter((m) => m.id !== me.id);
  const doOutroLado = detail.kind === "direta" ? outros[0]?.name : detail.title;
  /*
   * Quem está na chamada além de você. Com a sala conectada, quem o LiveKit
   * vê; sem provedor de mídia (ou antes de conectar), o registro do servidor.
   */
  const presentes = new Set((ativo ? naSala : detail.callMemberIds).filter((id) => id !== me.id));

  /*
   * Os sons da chamada. Entrou: o toque de quem recebe (no notificador)
   * para. Sozinho na sala e sem ninguém ter entrado ainda — você ligou —,
   * toca o "chamando" em loop até alguém chegar (no máximo 45 s). Depois,
   * cada entrada e saída tem o seu toque curto.
   */
  const chaveSala = [...presentes].sort().join(",");
  const jaTeveAlguem = useRef(false);
  const salaAntes = useRef<Set<string> | null>(null);
  // Você entrou numa chamada que já tinha gente (o registro do servidor)?
  // Então não foi você quem ligou: sem "chamando", e quem já estava lá
  // aparecendo na conexão não conta como "entrou".
  const jaTinhaGente = useRef(false);
  const tinhaGenteAgora = detail.callMemberIds.some((id) => id !== me.id);
  const tinhaGenteRef = useRef(tinhaGenteAgora);
  tinhaGenteRef.current = tinhaGenteAgora;
  useEffect(() => {
    if (!ativo) return;
    stopIncomingRing(detail.id);
    jaTinhaGente.current = tinhaGenteRef.current;
  }, [ativo, detail.id]);
  useEffect(() => {
    if (!ativo) {
      salaAntes.current = null;
      jaTeveAlguem.current = false;
      return;
    }
    const agora = new Set(chaveSala ? chaveSala.split(",") : []);
    const antes = salaAntes.current;
    const chegandoNaSala = jaTinhaGente.current && !jaTeveAlguem.current;
    if (antes && !chegandoNaSala) {
      if ([...agora].some((id) => !antes.has(id))) playCallCue("entrou");
      else if ([...antes].some((id) => !agora.has(id))) playCallCue("saiu");
    }
    if (agora.size > 0) jaTeveAlguem.current = true;
    salaAntes.current = agora;
  }, [ativo, chaveSala]);
  useEffect(() => {
    if (!ativo || chaveSala || jaTeveAlguem.current || jaTinhaGente.current) return;
    const parar = startRing("chamando");
    const limite = setTimeout(parar, CHAMANDO_MAX_MS);
    return () => {
      parar();
      clearTimeout(limite);
    };
  }, [ativo, chaveSala]);

  const remotoDe = (id: string) => remotos.find((r) => r.id === id);

  /** Os quadros: você, quem está na sala e, na direta, quem está sendo chamado. */
  const quadros: TileInfo[] = [
    {
      id: me.id,
      name: me.name,
      photoUrl: me.photoUrl,
      label: "Você",
      video: meuVideo,
      mirrored: cameraPrefs.mirror,
      self: true,
      muted: mudo || !ativo,
      speaking: ativo && falando.has(me.id),
    },
    ...outros
      .filter((m) => presentes.has(m.id) || detail.kind === "direta")
      .map((m) => {
        const r = remotoDe(m.id);
        const dentro = presentes.has(m.id);
        return {
          id: m.id,
          name: m.name,
          photoUrl: m.photoUrl,
          label: m.name,
          video: r?.camera ?? null,
          muted: r ? r.mudo : true,
          speaking: falando.has(m.id),
          absent: !dentro,
          status: dentro ? undefined : "Chamando…",
        };
      }),
  ];

  const titulo = detail.kind === "direta" ? `Chamada com ${outros[0]?.name ?? detail.title}` : "Sala de reunião";
  const situacao =
    estado === "entrando"
      ? "entrando…"
      : estado === "erro"
        ? "chamada interrompida"
        : estado === "outra-aba"
          ? "continua em outra aba"
          : quemApresenta
            ? `${quemApresenta === "Você" ? "você está" : `${quemApresenta} está`} apresentando`
            : presentes.size > 0
              ? `${presentes.size + 1} na chamada`
              : detail.kind === "direta"
                ? "chamando…"
                : "só você, esperando o grupo";
  const contexto = detail.kind === "grupo" ? detail.title : "Chamada direta";
  const usarPalco = !!telaNoPalco && layout === "palco";

  const aviso =
    estado === "sem-midia"
      ? "Áudio, câmera e tela precisam do provedor de mídia configurado neste ambiente. A chamada segue marcando o tempo e fica registrada na conversa."
      : estado === "erro"
        ? "O áudio não conseguiu passar — pode ser a conexão de alguém ou o provedor de mídia fora do ar. O tempo até aqui fica registrado na conversa."
        : estado === "outra-aba"
          ? "Você entrou nesta chamada por outra aba ou outro aparelho, e ela continua por lá. Pode fechar esta sem sair da chamada."
          : ativo && semCamera
            ? "A câmera não abriu — o navegador não liberou, ou outro programa está usando. Libere no cadeado da barra de endereço e tente de novo."
            : ativo && semMicrofone
              ? "O navegador não liberou o microfone. Você ouve a chamada e pode mostrar a tela; para falar, libere o microfone no cadeado da barra de endereço e tire do mudo."
              : null;

  const semMidiaTitulo = estado === "sem-midia" ? "Precisa do provedor de mídia neste ambiente" : undefined;

  return (
    <>
      {/*
       * Recolhida: o cartão do canto. A vista de cima continua montada (só
       * escondida) porque é nela que as câmeras e a tela estão penduradas —
       * desmontar os <video> cortaria a imagem ao voltar.
       */}
      {minimized && (
        <div
          ref={canto.ref}
          {...canto.handlers}
          role="region"
          aria-label={`Chamada em ${detail.title} — arraste para mover`}
          title="Arraste para mover"
          style={canto.style}
          className={cn(
            "fixed bottom-3 right-3 z-50 flex w-[280px] max-w-[calc(100vw-24px)] animate-scale-in touch-none select-none items-center gap-2 rounded-card border border-border bg-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.6)] md:bottom-4 md:right-4",
            canto.dragging ? "cursor-grabbing shadow-[0_24px_56px_rgba(0,0,0,0.7)]" : "cursor-grab",
          )}
        >
          <button
            type="button"
            onClick={onExpand}
            title="Abrir a chamada"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-mark text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3"
          >
            <MemberAvatar
              name={doOutroLado ?? detail.title}
              photoUrl={detail.kind === "direta" ? outros[0]?.photoUrl : null}
              className={cn(
                "h-9 w-9 bg-border-strong text-[12px] font-semibold text-fg",
                ativo && naSala.length > 0 && "ring-2 ring-fg-3",
              )}
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold text-fg">{detail.title}</span>
              <span className="truncate text-[11px] tabular-nums text-muted">
                <Cronometro desde={startedAt} />
                {telaNoPalco && " · tela"}
              </span>
            </span>
          </button>
          <MiniButton label={mudo ? "Tirar do mudo" : "Ficar no mudo"} onClick={alternarMudo} disabled={!ativo} active={mudo}>
            {mudo ? <MicOffIcon size={15} /> : <MicIcon size={15} />}
          </MiniButton>
          <MiniButton label="Abrir a chamada" onClick={onExpand}>
            <Maximize2Icon size={15} />
          </MiniButton>
          <button
            type="button"
            onClick={encerrar}
            aria-label={estado === "outra-aba" ? "Fechar" : "Encerrar chamada"}
            title={estado === "outra-aba" ? "Fechar" : "Encerrar chamada"}
            className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3"
          >
            <PhoneOffIcon size={15} />
          </button>
        </div>
      )}

      <div
        ref={vistaRef}
        role="region"
        aria-label={`Chamada em ${detail.title}`}
        className={cn(
          "fixed flex flex-col overflow-hidden bg-bg",
          minimized && "hidden",
          lugar && !telaCheia ? "z-30 rounded-r-[27px]" : "inset-0 z-50",
        )}
        style={lugar && !telaCheia ? lugar : undefined}
      >
        {/* Cabeçalho: a sala, o tempo e os botões de vista */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-panel-ring bg-surface px-3 py-3 md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-pill bg-border text-fg-soft">
              <VideoIcon size={18} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="truncate text-[15px] font-semibold text-fg">{titulo}</h2>
              <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    ativo ? "bg-fg-soft" : estado === "erro" ? "bg-flow-danger" : "bg-dim",
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {contexto} · {situacao}
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-pill border border-panel-ring bg-surface-2 px-2.5 py-1.5 text-[12px] font-semibold tabular-nums text-fg-soft">
              <span className={cn("h-[7px] w-[7px] rounded-full", ativo ? "bg-call-live" : "bg-dim")} aria-hidden="true" />
              <Cronometro desde={startedAt} />
            </span>
            <HeaderButton
              label={layout === "grade" ? "Destacar quem apresenta" : "Ver todos em grade"}
              pressed={layout === "grade"}
              onClick={() => setLayout((l) => (l === "grade" ? "palco" : "grade"))}
              className="hidden sm:flex"
            >
              <LayoutGridIcon size={16} />
            </HeaderButton>
            <HeaderButton label="Voltar à conversa (a chamada segue no canto)" onClick={onMinimize}>
              <MessageSquareIcon size={16} />
            </HeaderButton>
            <HeaderButton
              label={telaCheia ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
              pressed={telaCheia}
              onClick={() => alternarTelaCheiaDe(vistaRef.current)}
              className="hidden sm:flex"
            >
              {telaCheia ? <Minimize2Icon size={16} /> : <Maximize2Icon size={16} />}
            </HeaderButton>
            <Popover
              open={menu === "mais"}
              onClose={() => setMenu(null)}
              align="right"
              trigger={
                <HeaderButton label="Mais opções da chamada" pressed={menu === "mais"} onClick={() => setMenu((m) => (m === "mais" ? null : "mais"))}>
                  <EllipsisIcon size={16} />
                </HeaderButton>
              }
            >
              <div role="menu" className="w-[230px] animate-pop-in rounded-menu border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                <MenuItem onClick={() => { setMenu(null); onMinimize(); }}>Minimizar no canto</MenuItem>
                <MenuItem onClick={() => { setMenu(null); setModal("qualidade"); }}>Qualidade da transmissão</MenuItem>
                <MenuItem disabled={!ativo} onClick={() => { setMenu(null); setModal("camera"); }}>Ajustes da câmera</MenuItem>
                {telaNoPalco && (
                  <MenuItem onClick={() => { setMenu(null); alternarTelaCheiaDe(palcoBoxRef.current); }}>Tela cheia da apresentação</MenuItem>
                )}
              </div>
            </Popover>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* O palco */}
          <div className="flex min-w-0 flex-1 flex-col gap-3.5 p-3 md:p-4">
            {usarPalco ? (
              <>
                <div className="-mx-1 flex shrink-0 gap-3 overflow-x-auto px-1">
                  {quadros.map((q) => (
                    <Tile key={q.id} info={q} reaction={reacoes[q.id]?.emoji} className="h-[96px] min-w-[140px] flex-1 md:h-[116px]" />
                  ))}
                </div>
                <div
                  ref={palcoBoxRef}
                  onDoubleClick={() => alternarTelaCheiaDe(palcoBoxRef.current)}
                  className="relative min-h-0 flex-1 overflow-hidden rounded-panel border border-border-strong bg-call-stage"
                >
                  <VideoTrack track={telaNoPalco} fit="contain" />
                  {quemApresenta && (
                    <span className="absolute left-4 top-4 flex items-center gap-2 rounded-pill border border-call-live bg-black/70 px-3 py-[7px] text-[12px] font-semibold text-fg">
                      <ScreenShareIcon size={14} />
                      {quemApresenta === "Você" ? "Você está apresentando" : `${quemApresenta} está apresentando`}
                    </span>
                  )}
                  {recebendo && (
                    <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-chip bg-black/70 px-2.5 py-1.5 text-[11px] font-semibold tabular-nums text-fg-soft">
                      <SignalHighIcon size={13} />
                      {recebendo.h}p{recebendo.fps > 0 && ` · ${recebendo.fps}fps`}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <TileGrid
                tiles={quadros}
                reacoes={reacoes}
                share={
                  telaNoPalco
                    ? { track: telaNoPalco, label: quemApresenta === "Você" ? "Sua tela" : `Tela de ${quemApresenta}` }
                    : null
                }
              />
            )}
            {aviso && <p className="mx-auto max-w-[520px] shrink-0 text-center text-[12px] leading-[17px] text-muted">{aviso}</p>}
          </div>

          {painel && (
            <aside className="hidden w-[260px] shrink-0 flex-col border-l border-panel-ring bg-surface md:flex" aria-label="Participantes">
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="text-[13px] font-semibold text-fg-soft">Participantes</h3>
                <button
                  type="button"
                  aria-label="Fechar participantes"
                  onClick={() => setPainel(false)}
                  className="tap flex h-7 w-7 items-center justify-center rounded-mark text-muted hover:bg-border hover:text-fg-soft"
                >
                  <XIcon size={14} />
                </button>
              </div>
              <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
                {[me, ...outros].map((m) => {
                  const eu = m.id === me.id;
                  const dentro = eu || presentes.has(m.id);
                  const mutado = eu ? mudo || !ativo : (remotoDe(m.id)?.mudo ?? true);
                  const fala = dentro && falando.has(m.id);
                  return (
                    <li key={m.id} className="flex items-center gap-2.5 rounded-chip px-2 py-2">
                      <MemberAvatar
                        name={m.name}
                        photoUrl={m.photoUrl}
                        className={cn(
                          "h-8 w-8 text-[11px] font-semibold",
                          dentro ? "bg-border-strong text-fg" : "border border-dashed border-border-strong text-muted",
                          !dentro && m.photoUrl && "opacity-60",
                          fala && "ring-2 ring-call-live",
                        )}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn("truncate text-[13px]", dentro ? "text-fg-soft" : "text-muted")}>
                          {eu ? `${m.name} (você)` : m.name}
                        </span>
                        <span className="text-[11px] text-muted">
                          {fala ? "falando" : dentro ? "na chamada" : detail.kind === "direta" ? "chamando…" : "fora da chamada"}
                        </span>
                      </span>
                      {dentro && (mutado ? <MicOffIcon size={14} className="text-muted" /> : <MicIcon size={14} className="text-fg-3" />)}
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}
        </div>

        {/* Barra de controles */}
        <footer className="flex shrink-0 items-center justify-center border-t border-panel-ring bg-surface px-2 py-3 md:px-5 md:py-4">
          <div className="flex max-w-full items-center gap-2 px-1 md:gap-3">
            <Popover
              open={menu === "audio"}
              onClose={() => setMenu(null)}
              side="top"
              align="left"
              trigger={
                <Control
                  label="Microfone"
                  title={semMidiaTitulo ?? (mudo ? "Tirar do mudo" : "Ficar no mudo")}
                  tone={mudo ? "off" : "neutral"}
                  disabled={!ativo}
                  onClick={alternarMudo}
                  chevron={{ label: "Microfone e som", open: menu === "audio", onClick: () => setMenu((m) => (m === "audio" ? null : "audio")) }}
                >
                  {mudo ? <MicOffIcon size={22} /> : <MicIcon size={22} />}
                </Control>
              }
            >
              <MenuPanel>
                <MenuTitle first>Áudio</MenuTitle>
                <DeviceRow label="Microfone" kind="audioinput" devices={aparelhos} active={ativos} onSelect={trocarAparelho} />
                {saidaSuportada && (
                  <DeviceRow label="Saída de som" kind="audiooutput" devices={aparelhos} active={ativos} onSelect={trocarAparelho} />
                )}
                <MenuRow label="Reduzir ruído">
                  <MenuToggle on={reduzirRuido} onClick={alternarReduzirRuido} label="Reduzir ruído do microfone" />
                </MenuRow>
              </MenuPanel>
            </Popover>

            <Control
              label="Câmera"
              title={semMidiaTitulo ?? (camera ? "Desligar a câmera" : "Ligar a câmera")}
              tone={camera ? "neutral" : "off"}
              disabled={!ativo}
              onClick={alternarCamera}
              chevron={{ label: "Ajustes da câmera", onClick: () => setModal("camera") }}
            >
              {camera ? <VideoIcon size={22} /> : <VideoOffIcon size={22} />}
            </Control>

            <Control
              label={compartilhando ? "Apresentando" : "Apresentar"}
              title={
                semMidiaTitulo ??
                (!podeTela ? "Este navegador não compartilha tela" : compartilhando ? "Parar de apresentar" : "Compartilhar tela")
              }
              tone={compartilhando ? "on" : "neutral"}
              disabled={!ativo || !podeTela}
              onClick={() => (compartilhando ? void pararTela() : abrirCompartilhar())}
              chevron={
                podeTela
                  ? { label: compartilhando ? "Trocar o que estou apresentando" : "Opções de compartilhamento", onClick: abrirCompartilhar }
                  : undefined
              }
            >
              <ScreenShareIcon size={22} />
            </Control>

            <Popover
              open={menu === "reagir"}
              onClose={() => setMenu(null)}
              side="top"
              align="center"
              trigger={
                <Control
                  label="Reagir"
                  title={semMidiaTitulo ?? "Reagir"}
                  disabled={!ativo}
                  pressed={menu === "reagir"}
                  onClick={() => setMenu((m) => (m === "reagir" ? null : "reagir"))}
                >
                  <SmilePlusIcon size={22} />
                </Control>
              }
            >
              <div role="menu" aria-label="Reações" className="flex animate-pop-in gap-1 rounded-pill border border-border bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                {REACTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="menuitem"
                    aria-label={`Reagir com ${r}`}
                    onClick={() => void reagir(r)}
                    className="flex h-10 w-10 items-center justify-center rounded-pill text-[22px] transition-transform hover:scale-110 hover:bg-border"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </Popover>

            <Control
              label="Participantes"
              title="Quem está na chamada"
              pressed={painel}
              onClick={() => setPainel((p) => !p)}
              className="hidden md:flex"
            >
              <UsersIcon size={22} />
            </Control>

            <Control label="Configurações" title="Qualidade da transmissão" onClick={() => setModal("qualidade")}>
              <SettingsIcon size={22} />
            </Control>

            <span className="mx-1 hidden h-9 w-px shrink-0 bg-border md:block" aria-hidden="true" />

            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={encerrar}
                aria-label={estado === "outra-aba" ? "Fechar" : "Encerrar chamada"}
                title={estado === "outra-aba" ? "Fechar" : "Encerrar chamada"}
                className="tap flex h-11 items-center gap-2 rounded-pill bg-black px-4 text-[14px] font-semibold text-fg ring-1 ring-panel-ring transition-colors hover:bg-danger hover:text-on-primary md:h-[52px] md:px-[22px]"
              >
                <PhoneOffIcon size={20} />
                <span className="hidden sm:inline">{estado === "outra-aba" ? "Fechar" : "Sair"}</span>
              </button>
              <span className="hidden text-[10px] font-medium text-muted md:block">Encerrar</span>
            </div>
          </div>
        </footer>
      </div>

      {/* A voz das outras pessoas mora aqui — som, sem nada para ver. */}
      <div ref={audioRef} className="sr-only" aria-hidden="true" />

      {modal === "tela" && (
        <ShareScreenModal quality={qualidade} onClose={() => setModal(null)} onShare={(q) => void compartilhar(q)} />
      )}
      {modal === "camera" && (
        <CameraModal
          prefs={cameraPrefs}
          devices={aparelhos.videoinput}
          initials={initialsOf(me.name)}
          onClose={() => setModal(null)}
          onApply={(p) => void aplicarCamera(p)}
        />
      )}
      {modal === "qualidade" && (
        <StreamQualityModal quality={qualidade} onClose={() => setModal(null)} onSave={(q) => void mudarQualidade(q)} />
      )}
    </>
  );
}

/* ================================================================ quadros */

type TileInfo = {
  id: string;
  name: string;
  /** A foto da pessoa — sem câmera, é ela que aparece no quadro. */
  photoUrl?: string | null;
  label: string;
  video: Faixa | null;
  mirrored?: boolean;
  self?: boolean;
  muted: boolean;
  speaking: boolean;
  absent?: boolean;
  status?: string;
};

/** Pendura a faixa no <video> enquanto ele existe; solta só este elemento ao sair. */
function VideoTrack({
  track,
  mirrored,
  fit = "cover",
}: {
  track: Faixa | null;
  mirrored?: boolean;
  fit?: "cover" | "contain";
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  if (!track) return null;
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn("absolute inset-0 h-full w-full", fit === "cover" ? "object-cover" : "object-contain", mirrored && "-scale-x-100")}
    />
  );
}

function Tile({ info, reaction, className }: { info: TileInfo; reaction?: Reaction; className?: string }) {
  const semVideo = !info.video;
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-thumb border",
        info.self && semVideo ? "border-panel-ring" : "border-panel-ring bg-surface-2",
        info.speaking && "ring-2 ring-call-live",
        info.absent && "opacity-60",
        className,
      )}
      style={
        info.self && semVideo
          ? { background: "linear-gradient(-109deg, var(--color-call-self-from), var(--color-call-self-to))" }
          : undefined
      }
    >
      <VideoTrack track={info.video} mirrored={info.mirrored} />
      {semVideo && (
        <MemberAvatar
          name={info.name}
          photoUrl={info.photoUrl}
          className={cn(
            "font-semibold",
            info.self ? "h-14 w-14 bg-white/15 text-[18px] text-fg" : "h-[52px] w-[52px] bg-border text-[18px] text-fg-soft",
            info.absent && "border border-dashed border-border-strong bg-transparent text-muted",
            info.absent && info.photoUrl && "opacity-70",
          )}
        />
      )}
      <span className="absolute bottom-2.5 left-2.5 flex max-w-[calc(100%-20px)] items-center gap-[5px] rounded-mark bg-black/65 px-2 py-[3px] text-[12px] font-medium text-fg-soft">
        {info.muted ? <MicOffIcon size={12} className="shrink-0 text-muted" /> : <MicIcon size={12} className="shrink-0" />}
        <span className="truncate">{info.status ? `${info.label} · ${info.status}` : info.label}</span>
      </span>
      {reaction && (
        <span className="absolute right-2 top-2 animate-pop-in text-[28px] leading-none drop-shadow" aria-label={`${info.label} reagiu com ${reaction}`}>
          {reaction}
        </span>
      )}
    </div>
  );
}

function TileGrid({
  tiles,
  reacoes,
  share,
}: {
  tiles: TileInfo[];
  reacoes: Record<string, { emoji: Reaction }>;
  share: { track: Faixa; label: string } | null;
}) {
  const total = tiles.length + (share ? 1 : 0);
  const cols = total <= 1 ? 1 : total <= 4 ? 2 : 3;
  return (
    <div
      className="grid min-h-0 flex-1 gap-3"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" }}
    >
      {share && (
        <div className="relative overflow-hidden rounded-thumb border border-border-strong bg-call-stage">
          <VideoTrack track={share.track} fit="contain" />
          <span className="absolute bottom-2.5 left-2.5 flex items-center gap-[5px] rounded-mark bg-black/65 px-2 py-[3px] text-[12px] font-medium text-fg-soft">
            <ScreenShareIcon size={12} />
            {share.label}
          </span>
        </div>
      )}
      {tiles.map((t) => (
        <Tile key={t.id} info={t} reaction={reacoes[t.id]?.emoji} className="min-h-[96px]" />
      ))}
    </div>
  );
}

/* ================================================================= botões */

function Control({
  label,
  title,
  tone = "neutral",
  pressed,
  disabled,
  onClick,
  chevron,
  className,
  children,
}: {
  /** A legenda embaixo ("Microfone"). */
  label: string;
  title: string;
  /** `off`: desligado (mudo, câmera apagada); `on`: em uso (apresentando). */
  tone?: "neutral" | "off" | "on";
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  chevron?: { label: string; open?: boolean; onClick: () => void };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-1.5", className)}>
      <span className="relative">
        <button
          type="button"
          aria-label={title}
          aria-pressed={pressed ?? (tone === "neutral" ? undefined : tone === "on")}
          title={title}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "tap flex h-11 w-11 items-center justify-center rounded-pill transition-colors md:h-[52px] md:w-[52px]",
            tone === "on"
              ? "bg-primary text-on-primary hover:bg-white"
              : tone === "off"
                ? "bg-call-off-bg text-fg-soft hover:bg-border-strong"
                : pressed
                  ? "bg-border-strong text-fg"
                  : "bg-border text-fg-soft hover:bg-border-strong",
            disabled && "cursor-not-allowed opacity-45 hover:bg-border",
          )}
        >
          {children}
        </button>
        {chevron && (
          <button
            type="button"
            aria-label={chevron.label}
            title={chevron.label}
            aria-haspopup="true"
            aria-expanded={chevron.open}
            disabled={disabled}
            onClick={chevron.onClick}
            className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-pill border border-panel-ring bg-surface text-fg-3 transition-colors hover:text-fg disabled:opacity-45"
          >
            <ChevronUpIcon size={12} />
          </button>
        )}
      </span>
      <span className="hidden text-[10px] font-medium text-muted md:block">{label}</span>
    </div>
  );
}

function HeaderButton({
  label,
  pressed,
  onClick,
  className,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  className?: string;
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
        "tap flex h-8 w-8 items-center justify-center rounded-chip transition-colors",
        pressed ? "bg-border text-fg" : "bg-surface-2 text-fg-3 hover:bg-border hover:text-fg-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center rounded-mark px-2.5 py-[7px] text-left text-[12.5px] text-fg-soft hover:bg-row-raised disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function MiniButton({
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
        "tap flex h-8 w-8 shrink-0 items-center justify-center rounded-pill transition-colors",
        active ? "bg-border text-fg-soft" : "bg-surface-2 text-fg-3",
        disabled ? "cursor-not-allowed opacity-45" : "hover:bg-border hover:text-fg-soft",
      )}
    >
      {children}
    </button>
  );
}

function DeviceRow({
  label,
  kind,
  devices,
  active,
  onSelect,
}: {
  label: string;
  kind: DeviceKind;
  devices: CallDevices;
  active: ActiveDevices;
  onSelect: (kind: DeviceKind, id: string) => void;
}) {
  const options = devices[kind];
  if (options.length === 0) {
    return (
      <MenuRow label={label}>
        <span className="text-[13px] text-muted">Nenhum encontrado</span>
      </MenuRow>
    );
  }
  return (
    <MenuRow label={label}>
      <MenuDropdown label={label} value={active[kind] ?? options[0].id} options={options} onSelect={(id) => onSelect(kind, id)} />
    </MenuRow>
  );
}

/*
 * O tempo de chamada, num componente só dele. Morando no estado da chamada,
 * o tique de cada segundo re-renderizava a vista inteira — vídeos, quadros,
 * controles — durante a ligação toda, para mudar quatro dígitos.
 */
function Cronometro({ desde }: { desde: React.RefObject<number> }) {
  const segundos = () => (desde.current ? Math.floor((Date.now() - desde.current) / 1000) : 0);
  const [s, setS] = useState(segundos);
  useEffect(() => {
    const id = setInterval(() => setS(segundos()), 1000);
    return () => clearInterval(id);
    // `desde` é uma ref: estável durante a chamada toda.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{callClock(s)}</>;
}
