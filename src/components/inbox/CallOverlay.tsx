"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  FullscreenIcon,
  Maximize2Icon,
  MaximizeIcon,
  MicIcon,
  MicOffIcon,
  Minimize2Icon,
  MinimizeIcon,
  ReplaceIcon,
  PhoneOffIcon,
  ScreenShareIcon,
  Settings2Icon,
} from "@/components/icons";
import { Popover } from "@/components/ui/Popover";
import type { ConversationDetail, InboxMember } from "@/lib/inbox/types";
import { callClock, initialsOf } from "@/lib/inbox/view";
import { apiJoinCall, apiLeaveCall, apiTouchCall, leaveCallOnExit } from "./api";
import { CALL_HEARTBEAT_MS } from "@/lib/inbox/call";
import { CallSettingsMenu } from "./CallSettingsMenu";
import { desktopBridge } from "@/lib/desktop";
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
  detach: () => HTMLMediaElement[];
};
type Publicacao = {
  isMuted: boolean;
  source?: string;
  track?: Faixa & {
    restartTrack?: (opcoes: unknown) => Promise<void>;
    mediaStreamTrack?: MediaStreamTrack;
    sender?: RTCRtpSender;
  };
};
type Captura = {
  deviceId?: string;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
};
type Sala = {
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  startAudio: () => Promise<void>;
  switchActiveDevice: (kind: DeviceKind, deviceId: string) => Promise<boolean>;
  getActiveDevice: (kind: DeviceKind) => string | undefined;
  localParticipant: {
    setMicrophoneEnabled: (on: boolean, opcoes?: Captura) => Promise<unknown>;
    setCameraEnabled: (
      on: boolean,
      opcoes?: { deviceId?: string },
    ) => Promise<Publicacao | undefined>;
    setScreenShareEnabled: (on: boolean, captura?: unknown, publicacao?: unknown) => Promise<unknown>;
    getTrackPublication: (source: string) => Publicacao | undefined;
  };
  remoteParticipants: Map<
    string,
    {
      identity: string;
      name?: string;
      getTrackPublication: (source: string) => Publicacao | undefined;
    }
  >;
  on: (evento: string, handler: (...args: never[]) => void) => Sala;
};

const SEM_APARELHOS: CallDevices = { audioinput: [], audiooutput: [], videoinput: [] };

/** Largura mínima do popup redimensionado — a do desenho sem tela. */
const LARGURA_MIN = 380;
const LARGURA_KEY = "bb:largura-chamada";

/** Tela cheia da transmissão: entra, ou sai se já estiver nela. */
function alternarTelaCheiaDe(el: HTMLElement | null) {
  if (!el) return;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  else void el.requestFullscreen?.().catch(() => undefined);
}

/** Liga a tela com a qualidade escolhida (resolução, quadros, nitidez/fluidez). */
function ligarTela(sala: Sala, q: ScreenQuality) {
  const o = screenShareOptions(q);
  return sala.localParticipant.setScreenShareEnabled(true, o.capture, o.publish);
}

/** O Chrome e o Edge deixam a página escolher o alto-falante; o Safari não. */
function escolheSaida(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype
  );
}

export function CallOverlay({
  detail,
  me,
  withScreen,
  minimized,
  onMinimize,
  onExpand,
  onClose,
}: {
  detail: ConversationDetail;
  me: InboxMember;
  /** Chamada aberta pelo botão de tela compartilhada. */
  withScreen: boolean;
  /**
   * Recolhida no cartão do canto, como a do Discord: a sala segue de pé e a
   * pessoa continua usando o resto do produto.
   */
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  /** Fecha a chamada. Vem com a conversa atualizada quando o servidor respondeu. */
  onClose: (conversation?: ConversationDetail) => void;
}) {
  const [estado, setEstado] = useState<Estado>("entrando");
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

  /*
   * O menu de ajustes: aparelhos do computador, qual está em uso, câmera e
   * redução de ruído. Tudo isso só existe com a sala conectada.
   */
  const [menuAberto, setMenuAberto] = useState(false);
  const menuAbertoRef = useRef(menuAberto);
  menuAbertoRef.current = menuAberto;
  const [aparelhos, setAparelhos] = useState<CallDevices>(SEM_APARELHOS);
  const [ativos, setAtivos] = useState<ActiveDevices>({});
  const ativosRef = useRef(ativos);
  ativosRef.current = ativos;
  const [saidaSuportada, setSaidaSuportada] = useState(false);
  const [camera, setCamera] = useState(false);
  const [cameraRemota, setCameraRemota] = useState(false);
  const [semCamera, setSemCamera] = useState(false);
  const [reduzirRuido, setReduzirRuido] = useState(true);
  /** A sua câmera (espelhada, como um espelho) e a do outro lado. */
  const cameraLocalRef = useRef<HTMLVideoElement>(null);
  const cameraRemotaRef = useRef<HTMLVideoElement>(null);
  /** Relê a lista de aparelhos — preenchida quando a sala conecta. */
  const lerAparelhosRef = useRef<() => Promise<void>>(async () => {});
  /** A qualidade da transmissão — preferência guardada entre chamadas. */
  const [qualidade, setQualidade] = useState<ScreenQuality>(DEFAULT_SCREEN_QUALITY);
  const qualidadeRef = useRef(qualidade);
  qualidadeRef.current = qualidade;
  useEffect(() => setQualidade(loadScreenQuality()), []);
  /** Ver a própria tela enquanto transmite (desligado: poupa processamento). */
  const [previa, setPrevia] = useState(false);
  const previaRef = useRef<HTMLVideoElement>(null);
  /** O popup ocupando a janela inteira, para ver a tela grande. */
  const [maximizado, setMaximizado] = useState(false);
  /** A largura escolhida arrastando o canto; `null` é a do desenho. */
  const [largura, setLargura] = useState<number | null>(null);
  useEffect(() => {
    try {
      const salvo = Number(localStorage.getItem(LARGURA_KEY));
      if (salvo >= LARGURA_MIN) setLargura(salvo);
    } catch {
      // Sem armazenamento: começa na largura do desenho.
    }
  }, []);
  /** Onde a tela compartilhada mora — é ele que vai para a tela cheia. */
  const telaRef = useRef<HTMLDivElement>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  /** Resolução e quadros que estão chegando de verdade, para o selo da tela. */
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

  // Cronômetro. Começa quando a chamada entra em tela, não no render. Quem
  // conta os segundos é o `<Cronometro>`: só o texto dele muda a cada segundo.
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

        const anotarQuemEsta = () => {
          if (!vivo || !sala) return;
          setNaSala([...sala.remoteParticipants.values()].map((p) => p.identity));
        };

        /*
         * A câmera do outro lado. Desligar a câmera no LiveKit silencia a
         * faixa em vez de tirá-la da sala, então a pergunta é sempre "alguém
         * tem câmera acesa agora?", refeita a cada evento que pode mudar isso.
         */
        const conferirCameraRemota = () => {
          if (!vivo || !sala) return;
          for (const p of sala.remoteParticipants.values()) {
            const pub = p.getTrackPublication(Track.Source.Camera);
            if (pub?.track && !pub.isMuted && cameraRemotaRef.current) {
              pub.track.attach(cameraRemotaRef.current);
              setCameraRemota(true);
              return;
            }
          }
          setCameraRemota(false);
        };

        const lerAparelhos = async () => {
          const kinds: DeviceKind[] = ["audioinput", "audiooutput", "videoinput"];
          try {
            const listas = await Promise.all(
              kinds.map((k) => Room.getLocalDevices(k, false)),
            );
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
          .on(RoomEvent.ParticipantConnected, anotarQuemEsta)
          .on(RoomEvent.ParticipantDisconnected, (() => {
            anotarQuemEsta();
            conferirCameraRemota();
          }) as never)
          .on(RoomEvent.TrackSubscribed, ((faixa: Faixa) => {
            if (!vivo) return;
            if (faixa.kind === Track.Kind.Audio) {
              // A voz das outras pessoas: elemento fora da tela, só para tocar.
              const el = faixa.attach();
              audioRef.current?.appendChild(el);
              // A saída escolhida no menu vale também para quem entra depois.
              const saida = ativosRef.current.audiooutput;
              if (saida) void sala?.switchActiveDevice("audiooutput", saida);
              return;
            }
            if (faixa.source === Track.Source.ScreenShare && videoRef.current) {
              faixa.attach(videoRef.current);
              setTemTela(true);
              return;
            }
            if (faixa.source === Track.Source.Camera) conferirCameraRemota();
          }) as never)
          .on(RoomEvent.TrackUnsubscribed, ((faixa: Faixa) => {
            const els = faixa.detach();
            if (faixa.kind === Track.Kind.Audio) {
              // Só os <audio> fomos nós que criamos. Os <video> da tela e da
              // câmera são da página: tirá-los do DOM faria o próximo
              // compartilhamento não ter onde aparecer.
              els.forEach((el) => el.remove());
              return;
            }
            if (faixa.source === Track.Source.ScreenShare) setTemTela(false);
            if (faixa.source === Track.Source.Camera) conferirCameraRemota();
          }) as never)
          // "Parar de compartilhar" na barra do navegador também desliga o botão.
          .on(RoomEvent.LocalTrackUnpublished, ((pub: Publicacao) => {
            if (vivo && pub.source === Track.Source.ScreenShare) setCompartilhando(false);
          }) as never)
          .on(RoomEvent.TrackMuted, conferirCameraRemota)
          .on(RoomEvent.TrackUnmuted, conferirCameraRemota)
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
          await sala.localParticipant.setMicrophoneEnabled(true, {
            noiseSuppression: true,
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
        anotarQuemEsta();
        setSaidaSuportada(escolheSaida());
        // Depois do microfone: antes da permissão o navegador esconde os nomes.
        await lerAparelhos();
        if (!vivo) return;
        setEstado("na-chamada");

        if (withScreen) {
          try {
            await ligarTela(sala, qualidadeRef.current);
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
  const minimizedRef = useRef(minimized);
  minimizedRef.current = minimized;
  const maximizadoRef = useRef(maximizado);
  maximizadoRef.current = maximizado;
  const temTelaRef = useRef(temTela);
  temTelaRef.current = temTela;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Recolhida no canto ela não é sobreposição: o teclado é de quem está na tela.
      if (minimizedRef.current) return;
      const alvo = e.target instanceof Element ? e.target : null;
      const digitando = alvo?.closest("input, textarea, [contenteditable='true']");
      // F: tela cheia da transmissão, quando há uma na tela.
      if ((e.key === "f" || e.key === "F") && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (temTelaRef.current) alternarTelaCheiaDe(telaRef.current);
        return;
      }
      if (e.key !== "Escape") return;
      // Na tela cheia, o Esc é do navegador (sai dela) — não derruba a chamada.
      if (document.fullscreenElement) return;
      // Com o menu aberto, o Esc fecha o menu — não derruba a chamada.
      if (menuAbertoRef.current) return setMenuAberto(false);
      // Maximizada, o Esc seguinte só devolve o popup ao tamanho normal.
      if (maximizadoRef.current) return setMaximizado(false);
      void encerrar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `encerrar` só depende de refs e do id da conversa.
  }, [detail.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch {
      // Aparelho desconectado no meio do caminho: volta a marcar o anterior.
      setAtivos((a) => ({ ...a, [kind]: antes }));
    }
  }

  async function alternarCamera() {
    const sala = salaRef.current;
    if (!sala) return;
    const proximo = !camera;
    try {
      const pub = await sala.localParticipant.setCameraEnabled(proximo, {
        deviceId: ativos.videoinput,
      });
      setCamera(proximo);
      setSemCamera(false);
      if (proximo && pub?.track && cameraLocalRef.current) {
        pub.track.attach(cameraLocalRef.current);
      }
      // A primeira permissão de câmera é o que libera o nome delas na lista.
      if (proximo) void lerAparelhosRef.current();
    } catch {
      setCamera(false);
      setSemCamera(true);
    }
  }

  async function alternarReduzirRuido() {
    const sala = salaRef.current;
    if (!sala) return;
    const proximo = !reduzirRuido;
    setReduzirRuido(proximo);
    // O filtro é do navegador: mudar exige reabrir o microfone com a regra nova.
    const { Track } = await import("livekit-client");
    const faixa = sala.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
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

  async function alternarTela() {
    const sala = salaRef.current;
    if (!sala) return;
    const proximo = !compartilhando;
    try {
      if (proximo) await ligarTela(sala, qualidade);
      else await sala.localParticipant.setScreenShareEnabled(false);
      setCompartilhando(proximo);
    } catch {
      // Cancelar o seletor de tela do navegador não é erro.
    }
  }

  /** Trocar o que está sendo mostrado sem sair da chamada: abre o seletor de novo. */
  async function trocarTela() {
    const sala = salaRef.current;
    if (!sala || !compartilhando) return;
    try {
      await sala.localParticipant.setScreenShareEnabled(false);
      await ligarTela(sala, qualidade);
      setCompartilhando(true);
    } catch {
      // Cancelou o seletor: a transmissão anterior já parou, o botão acompanha.
      setCompartilhando(false);
    }
  }

  /*
   * Trocar a qualidade no meio da transmissão vale na hora: a captura é
   * reajustada e o codificador recebe o novo teto de banda e de quadros —
   * sem abrir o seletor de tela de novo.
   */
  async function mudarQualidade(q: ScreenQuality) {
    setQualidade(q);
    saveScreenQuality(q);
    const sala = salaRef.current;
    if (!sala || !compartilhando) return;
    const { Track } = await import("livekit-client");
    const faixa = sala.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
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
        (params as { degradationPreference?: string }).degradationPreference =
          o.publish.degradationPreference;
        await sender.setParameters(params);
      }
    } catch {
      // Tela que não aceita a resolução pedida segue na que tinha.
    }
  }

  // A prévia da própria tela: pendura a faixa local no <video> só quando pedida.
  useEffect(() => {
    const el = previaRef.current;
    if (!el || !previa || !compartilhando) return;
    let faixa: Faixa | undefined;
    let vivo = true;
    void import("livekit-client").then(({ Track }) => {
      if (!vivo) return;
      faixa = salaRef.current?.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
      faixa?.attach(el);
    });
    return () => {
      vivo = false;
      // Só solta este <video>: o `detach()` sem argumento soltaria todos.
      (faixa as unknown as { detach: (el?: HTMLMediaElement) => unknown } | undefined)?.detach(el);
    };
  }, [previa, compartilhando]);

  // O selo "1920×1080 · 30 fps": o que está chegando de verdade, a cada segundo.
  useEffect(() => {
    if (!temTela) {
      setRecebendo(null);
      return;
    }
    let antes = -1;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const quadros = v.getVideoPlaybackQuality?.().totalVideoFrames ?? 0;
      const fps = antes < 0 ? 0 : Math.max(0, quadros - antes);
      antes = quadros;
      const w = v.videoWidth;
      const h = v.videoHeight;
      // Mesmo selo de antes: não re-renderiza a chamada inteira por nada.
      setRecebendo((r) => (r && r.w === w && r.h === h && r.fps === fps ? r : { w, h, fps }));
    }, 1000);
    return () => clearInterval(id);
  }, [temTela]);

  // Tela cheia do navegador: acompanha também o Esc do próprio navegador.
  useEffect(() => {
    const aoMudar = () =>
      setTelaCheia(!!telaRef.current && document.fullscreenElement === telaRef.current);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  const alternarTelaCheia = () => alternarTelaCheiaDe(telaRef.current);

  /*
   * Arrastar o canto do popup: cresce para os dois lados, porque ele é
   * centralizado. Durante o arrasto a largura vai direto no elemento — passar
   * pelo estado re-renderizava a chamada inteira (vídeos, participantes) a
   * cada movimento do mouse, e o canto ficava para trás do cursor. O estado
   * só recebe a largura final, ao soltar.
   */
  function redimensionar(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const painel = e.currentTarget.parentElement;
    if (!painel) return;
    const inicioX = e.clientX;
    const inicio = painel.getBoundingClientRect().width;
    let final = inicio;
    let moveu = false;
    const mover = (ev: PointerEvent) => {
      const max = window.innerWidth - 32;
      final = Math.round(Math.min(max, Math.max(LARGURA_MIN, inicio + (ev.clientX - inicioX) * 2)));
      moveu = true;
      painel.style.maxWidth = `${final}px`;
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      if (moveu) setLargura(final);
      try {
        localStorage.setItem(LARGURA_KEY, String(final));
      } catch {
        // Sem armazenamento: a largura vale só para esta chamada.
      }
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  }

  function larguraPadrao() {
    setLargura(null);
    try {
      localStorage.removeItem(LARGURA_KEY);
    } catch {
      // Nada guardado para apagar.
    }
  }

  const ativo = estado === "na-chamada";
  const outros = detail.members.filter((m) => m.id !== me.id);
  const doOutroLado = detail.kind === "direta" ? outros[0]?.name : detail.title;
  /*
   * Quem está na chamada além de você. Com a sala conectada, quem o LiveKit
   * vê; sem provedor de mídia (ou antes de conectar), o registro do servidor.
   */
  const presentes = new Set(
    (ativo ? naSala : detail.callMemberIds).filter((id) => id !== me.id),
  );
  const ordenados = [...outros].sort(
    (a, b) => Number(presentes.has(b.id)) - Number(presentes.has(a.id)),
  );
  const principal = ordenados[0];
  const resto = ordenados.slice(1, 4);
  const sobra = Math.max(0, ordenados.length - 1 - resto.length);
  const statusDe = (id: string) =>
    presentes.has(id) ? "na chamada" : detail.kind === "direta" ? "chamando…" : "fora da chamada";
  const mostraPrevia = previa && compartilhando;

  function minimizar() {
    setMenuAberto(false);
    setMaximizado(false);
    onMinimize();
  }

  const status =
    estado === "entrando"
      ? "Entrando na chamada…"
      : estado === "erro"
        ? "Chamada interrompida"
        : estado === "outra-aba"
          ? "Chamada em outra aba"
          : <Cronometro desde={startedAt} />;

  return (
    <div
      role={minimized ? "region" : "dialog"}
      aria-modal={minimized ? undefined : true}
      aria-label={`Chamada em ${detail.title}`}
      className={cn(
        "fixed z-50",
        minimized
          ? "bottom-3 right-3 md:bottom-4 md:right-4"
          : cn("inset-0 flex items-center justify-center", maximizado ? "p-3" : "p-4"),
      )}
    >
      {/*
       * Recolhida: o cartão do canto. O popup de cima continua montado (só
       * escondido) porque é nele que a tela compartilhada e as câmeras estão
       * penduradas — desmontar os <video> cortaria a imagem ao voltar.
       */}
      {minimized && (
        <div className="flex w-[280px] max-w-[calc(100vw-24px)] animate-scale-in items-center gap-2 rounded-card border border-border bg-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <button
            type="button"
            onClick={onExpand}
            title="Abrir a chamada"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-mark text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-border-strong text-[12px] font-semibold text-fg",
                ativo && naSala.length > 0 && "inset-ring-2 inset-ring-fg-3",
              )}
              aria-hidden="true"
            >
              {initialsOf(doOutroLado ?? detail.title)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold text-fg">
                {detail.title}
              </span>
              <span className="truncate text-[11px] tabular-nums text-muted">
                {status}
                {temTela && " · tela"}
              </span>
            </span>
          </button>
          <MiniButton
            label={mudo ? "Tirar do mudo" : "Ficar no mudo"}
            onClick={alternarMudo}
            disabled={!ativo}
            active={mudo}
          >
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

      {!minimized && (
        <div className="absolute inset-0 animate-fade-in bg-black/75 backdrop-blur-[3px]" />
      )}

      <div
        className={cn(
          "relative w-full animate-scale-in flex-col items-center rounded-card border border-border bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.65)]",
          minimized ? "hidden" : "flex",
          maximizado
            ? cn("h-full max-w-none gap-3 p-4", !temTela && !mostraPrevia && "justify-center")
            : cn(
                "max-h-[calc(100dvh-32px)] gap-5 p-6",
                // A tela compartilhada precisa de espaço; sem ela o popup é o do desenho.
                largura === null && (temTela || mostraPrevia ? "max-w-[720px]" : "max-w-[380px]"),
              ),
        )}
        style={!maximizado && largura !== null ? { maxWidth: largura } : undefined}
      >
        {/* Recolher para o canto — a chamada continua. */}
        <button
          type="button"
          onClick={minimizar}
          aria-label="Minimizar a chamada"
          title="Minimizar a chamada"
          className="tap absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-pill text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3"
        >
          <Minimize2Icon size={15} />
        </button>

        {/* Ocupar a janela inteira — para ver a tela compartilhada grande. */}
        <button
          type="button"
          onClick={() => setMaximizado((m) => !m)}
          aria-label={maximizado ? "Restaurar o tamanho da chamada" : "Maximizar a chamada"}
          aria-pressed={maximizado}
          title={maximizado ? "Restaurar tamanho" : "Maximizar"}
          className="tap absolute right-12 top-3 flex h-8 w-8 items-center justify-center rounded-pill text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3"
        >
          {maximizado ? <MinimizeIcon size={15} /> : <MaximizeIcon size={15} />}
        </button>

        <div className="flex flex-col items-center gap-1">
          <p className="text-[15px] font-semibold text-fg">{detail.title}</p>
          <p className="text-[12px] tabular-nums text-muted">
            {status}
            {estado !== "entrando" &&
              (presentes.size > 0
                ? ` · ${presentes.size + 1} na chamada`
                : detail.kind === "direta"
                  ? " · chamando…"
                  : " · só você, esperando o grupo")}
          </p>
        </div>

        {/*
         * A tela compartilhada. O desenho do Felipe tem os dois avatares; onde
         * a tela aparece quando alguém compartilha ainda não foi desenhado —
         * por ora ela ocupa o corpo do popup e os avatares descem, que é o
         * arranjo que não esconde nenhum dos dois. Falta confirmar.
         */}
        <div
          ref={telaRef}
          onDoubleClick={alternarTelaCheia}
          className={cn(
            "group relative w-full overflow-hidden rounded-panel bg-black",
            !temTela && "hidden",
            maximizado || telaCheia ? "min-h-0 flex-1" : "aspect-video shrink",
            telaCheia && "rounded-none",
          )}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-contain"
          />
          {/* Controles da transmissão: aparecem ao passar o mouse. */}
          <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {recebendo && (
              <span className="rounded-pill bg-black/70 px-2 py-1 text-[11px] tabular-nums text-fg-soft">
                {recebendo.w}×{recebendo.h}
                {recebendo.fps > 0 && ` · ${recebendo.fps} fps`}
              </span>
            )}
            <ScreenControl
              label={telaCheia ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
              onClick={alternarTelaCheia}
            >
              {telaCheia ? <MinimizeIcon size={14} /> : <FullscreenIcon size={14} />}
            </ScreenControl>
          </div>
        </div>

        {/* A prévia da sua própria tela, quando pedida no menu de ajustes. */}
        {mostraPrevia && (
          <div className={cn("relative w-full overflow-hidden rounded-panel bg-black", temTela ? "max-w-[240px] self-end" : "aspect-video")}>
            <video
              ref={previaRef}
              autoPlay
              playsInline
              muted
              className={cn("w-full object-contain", temTela ? "aspect-video" : "absolute inset-0 h-full")}
            />
            <span className="absolute left-2 top-2 rounded-pill bg-black/70 px-2 py-1 text-[11px] text-fg-soft">
              Sua tela
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-center gap-3">
          <CallAvatar
            name={me.name}
            label="Você"
            status={estado === "entrando" ? "entrando…" : "na chamada"}
            ausente={estado === "entrando"}
            falando={ativo && !mudo}
            videoRef={cameraLocalRef}
            comVideo={ativo && camera}
            espelhado
          />
          <span className="mt-[26px] h-px w-6 bg-border" aria-hidden="true" />
          {/*
           * Quem está do outro lado, e se está **de fato** na chamada: dentro,
           * o avatar aceso com "na chamada"; fora, apagado e tracejado, com
           * "chamando…" (direta) ou "fora" (grupo). Quem entrou vem primeiro.
           */}
          {principal ? (
            <CallAvatar
              name={principal.name}
              label={principal.name}
              status={statusDe(principal.id)}
              ausente={!presentes.has(principal.id)}
              falando={ativo && presentes.has(principal.id)}
              videoRef={cameraRemotaRef}
              comVideo={ativo && cameraRemota}
            />
          ) : (
            <CallAvatar
              name={detail.title}
              label={detail.title}
              ausente
              videoRef={cameraRemotaRef}
            />
          )}
          {resto.map((m) => (
            <CallAvatar
              key={m.id}
              name={m.name}
              label={m.name}
              status={statusDe(m.id)}
              ausente={!presentes.has(m.id)}
              falando={ativo && presentes.has(m.id)}
              pequeno
            />
          ))}
          {sobra > 0 && (
            <span
              title={`Mais ${sobra} no grupo`}
              className="flex h-[40px] w-[40px] items-center justify-center self-start rounded-pill border border-dashed border-border text-[12px] font-medium text-muted"
            >
              +{sobra}
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
        {estado === "outra-aba" && (
          <p className="max-w-[280px] text-center text-[11px] leading-[16px] text-muted">
            Você entrou nesta chamada por outra aba ou outro aparelho, e ela
            continua por lá. Pode fechar esta janela sem sair da chamada.
          </p>
        )}
        {ativo && semCamera && (
          <p className="max-w-[280px] text-center text-[11px] leading-[16px] text-muted">
            A câmera não abriu — o navegador não liberou, ou outro programa
            está usando. Libere no cadeado da barra de endereço e tente de novo.
          </p>
        )}
        {ativo && semMicrofone && (
          <p className="max-w-[280px] text-center text-[11px] leading-[16px] text-muted">
            O navegador não liberou o microfone. Você ouve a chamada e pode
            mostrar a tela; para falar, libere o microfone no cadeado da barra
            de endereço e tire do mudo.
          </p>
        )}

        <Popover
          open={menuAberto && ativo && !minimized}
          onClose={() => setMenuAberto(false)}
          side="top"
          align="center"
          trigger={
            <div className="flex items-center gap-3">
              <CallButton
                label="Ajustes de áudio e vídeo"
                onClick={() => setMenuAberto((m) => !m)}
                disabled={!ativo}
                active={menuAberto}
                menu
              >
                <Settings2Icon size={18} />
              </CallButton>
              <CallButton
                label={mudo ? "Tirar do mudo" : "Ficar no mudo"}
                onClick={alternarMudo}
                disabled={!ativo}
                active={mudo}
              >
                {mudo ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
              </CallButton>
              {compartilhando && (
                <CallButton label="Trocar o que estou compartilhando" onClick={trocarTela} disabled={!ativo}>
                  <ReplaceIcon size={18} />
                </CallButton>
              )}
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
                // Na chamada que passou para outra aba, este botão só fecha a janela.
                aria-label={estado === "outra-aba" ? "Fechar" : "Encerrar chamada"}
                title={estado === "outra-aba" ? "Fechar" : "Encerrar chamada"}
                autoFocus
                className="tap flex h-control w-control items-center justify-center rounded-pill bg-primary text-on-primary transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3"
              >
                <PhoneOffIcon size={18} />
              </button>
            </div>
          }
        >
          <CallSettingsMenu
            devices={aparelhos}
            active={ativos}
            onSelect={trocarAparelho}
            camera={camera}
            onToggleCamera={alternarCamera}
            noiseSuppression={reduzirRuido}
            onToggleNoiseSuppression={alternarReduzirRuido}
            outputSupported={saidaSuportada}
            screenQuality={qualidade}
            onScreenQuality={mudarQualidade}
            screenSupported={podeTela}
            preview={previa}
            onTogglePreview={() => setPrevia((v) => !v)}
          />
        </Popover>

        {/* Arrastar o canto muda a largura; dois cliques voltam à do desenho. */}
        {!maximizado && (
          <div
            role="separator"
            aria-label="Redimensionar a chamada"
            title="Arraste para redimensionar · dois cliques para o tamanho padrão"
            onPointerDown={redimensionar}
            onDoubleClick={larguraPadrao}
            className="absolute bottom-0 right-0 hidden h-5 w-5 cursor-nwse-resize md:block"
          >
            <svg viewBox="0 0 20 20" className="h-full w-full text-border-strong" aria-hidden="true">
              <path d="M16 8 8 16M16 12l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {/* A voz das outras pessoas mora aqui — som, sem nada para ver. */}
      <div ref={audioRef} className="sr-only" aria-hidden="true" />
    </div>
  );
}

function CallAvatar({
  name,
  label,
  status,
  ausente,
  pequeno,
  falando,
  videoRef,
  comVideo,
  espelhado,
}: {
  name: string;
  label: string;
  /** "na chamada", "chamando…", "fora da chamada" — a linha de baixo. */
  status?: string;
  /** Ainda não entrou: apagado e tracejado, para não parecer que está ouvindo. */
  ausente?: boolean;
  /** Os outros membros do grupo, menores ao lado do principal. */
  pequeno?: boolean;
  falando?: boolean;
  /** Onde a câmera desta pessoa é pendurada. Fica montado sempre. */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** A câmera está acesa: o vídeo toma o lugar das iniciais. */
  comVideo?: boolean;
  /** A sua própria imagem vem espelhada, como em qualquer espelho. */
  espelhado?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/*
       * Câmera no lugar do avatar, no mesmo círculo, só maior. O export não
       * desenha a chamada com câmera — este é o arranjo que não mexe em mais
       * nada do popup até o desenho chegar.
       */}
      <span
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-pill font-semibold transition-all",
          comVideo ? "h-[96px] w-[96px]" : pequeno ? "h-[40px] w-[40px] text-[13px]" : "h-[52px] w-[52px] text-[16px]",
          ausente
            ? "border border-dashed border-border-strong bg-surface-2 text-muted opacity-60"
            : "bg-border-strong text-fg",
          falando && "inset-ring-2 inset-ring-fg-3",
        )}
        aria-hidden="true"
      >
        {videoRef && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              espelhado && "-scale-x-100",
              !comVideo && "hidden",
            )}
          />
        )}
        {!comVideo && initialsOf(name)}
      </span>
      <span className={cn("truncate text-[11px]", pequeno ? "max-w-[64px]" : "max-w-[96px]", ausente ? "text-muted" : "text-fg-3")}>
        {label}
      </span>
      {status && (
        <span
          className={cn(
            "-mt-1.5 flex items-center gap-1 text-[10px]",
            ausente ? "text-muted" : "text-fg-soft",
          )}
        >
          {!ausente && <span className="h-1.5 w-1.5 rounded-full bg-presence-on" aria-hidden="true" />}
          {status}
        </span>
      )}
    </div>
  );
}

function ScreenControl({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onDoubleClick={(e) => e.stopPropagation()}
      className="tap flex h-7 w-7 items-center justify-center rounded-pill bg-black/70 text-fg-soft transition-colors hover:bg-black hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3"
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

function CallButton({
  label,
  disabled,
  active,
  menu,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  active?: boolean;
  /** Abre um menu: anuncia isso em vez de "apertado/solto". */
  menu?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={menu ? undefined : active}
      aria-haspopup={menu ? "menu" : undefined}
      aria-expanded={menu ? active : undefined}
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

/*
 * O tempo de chamada, num componente só dele. Morando no estado da chamada,
 * o tique de cada segundo re-renderizava o popup inteiro — vídeos, avatares,
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
