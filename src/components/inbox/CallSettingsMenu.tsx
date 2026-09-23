"use client";

import {
  MenuDivider,
  MenuDropdown,
  MenuPanel,
  MenuRow,
  MenuTitle,
  MenuToggle,
} from "@/components/ui/MenuPanel";
import type { ActiveDevices, CallDevices, DeviceKind } from "@/lib/inbox/devices";
import {
  FPS_OPTIONS,
  OPTIMIZE_OPTIONS,
  RESOLUTION_OPTIONS,
  type ScreenFps,
  type ScreenOptimize,
  type ScreenQuality,
  type ScreenResolution,
} from "@/lib/inbox/screenQuality";

/*
 * Os ajustes da chamada: qual microfone, qual saída de som, qual câmera.
 *
 * A seção Transmissão escolhe a qualidade da tela compartilhada; trocar no
 * meio da transmissão vale na hora, sem abrir o seletor de novo.
 *
 * Não há export desenhado para este menu, então ele é montado só com as peças
 * do painel de 300px que o Felipe já desenhou para os menus de Filtros e de
 * Visualização (`ui/MenuPanel`) — título de seção, linha rótulo/controle,
 * dropdown de pílula e chave. Nenhuma forma nova.
 *
 * O menu só mostra e escolhe; quem troca o aparelho de verdade é a
 * `CallOverlay`, que é quem tem a sala do LiveKit na mão.
 */

export function CallSettingsMenu({
  devices,
  active,
  onSelect,
  camera,
  onToggleCamera,
  noiseSuppression,
  onToggleNoiseSuppression,
  outputSupported,
  screenQuality,
  onScreenQuality,
  screenSupported,
  preview,
  onTogglePreview,
}: {
  devices: CallDevices;
  active: ActiveDevices;
  onSelect: (kind: DeviceKind, id: string) => void;
  camera: boolean;
  onToggleCamera: () => void;
  noiseSuppression: boolean;
  onToggleNoiseSuppression: () => void;
  /** Só o Chrome e o Edge deixam a página escolher o alto-falante. */
  outputSupported: boolean;
  screenQuality: ScreenQuality;
  onScreenQuality: (q: ScreenQuality) => void;
  /** Celular não compartilha tela: a seção nem aparece. */
  screenSupported: boolean;
  /** Mostrar, para você, a sua própria tela enquanto transmite. */
  preview: boolean;
  onTogglePreview: () => void;
}) {
  return (
    <MenuPanel>
      <MenuTitle first>Áudio</MenuTitle>
      <DeviceRow
        label="Microfone"
        kind="audioinput"
        devices={devices}
        active={active}
        onSelect={onSelect}
      />
      {outputSupported && (
        <DeviceRow
          label="Saída de som"
          kind="audiooutput"
          devices={devices}
          active={active}
          onSelect={onSelect}
        />
      )}
      <MenuRow label="Reduzir ruído">
        <MenuToggle
          on={noiseSuppression}
          onClick={onToggleNoiseSuppression}
          label="Reduzir ruído do microfone"
        />
      </MenuRow>

      <MenuDivider />

      <MenuTitle>Vídeo</MenuTitle>
      <MenuRow label="Câmera ligada">
        <MenuToggle
          on={camera}
          onClick={onToggleCamera}
          label={camera ? "Desligar a câmera" : "Ligar a câmera"}
        />
      </MenuRow>
      <DeviceRow
        label="Câmera"
        kind="videoinput"
        devices={devices}
        active={active}
        onSelect={onSelect}
      />

      {screenSupported && (
        <>
          <MenuDivider />
          <MenuTitle>Transmissão</MenuTitle>
          <MenuRow label="Resolução">
            <MenuDropdown
              label="Resolução da transmissão"
              value={screenQuality.resolution}
              options={RESOLUTION_OPTIONS}
              onSelect={(id) =>
                onScreenQuality({ ...screenQuality, resolution: id as ScreenResolution })
              }
            />
          </MenuRow>
          <MenuRow label="Quadros">
            <MenuDropdown
              label="Quadros por segundo da transmissão"
              value={String(screenQuality.fps)}
              options={FPS_OPTIONS}
              onSelect={(id) => onScreenQuality({ ...screenQuality, fps: Number(id) as ScreenFps })}
            />
          </MenuRow>
          <MenuRow label="Priorizar">
            <MenuDropdown
              label="Priorizar nitidez ou fluidez"
              value={screenQuality.optimize}
              options={OPTIMIZE_OPTIONS}
              onSelect={(id) =>
                onScreenQuality({ ...screenQuality, optimize: id as ScreenOptimize })
              }
            />
          </MenuRow>
          <MenuRow label="Prévia da minha tela">
            <MenuToggle
              on={preview}
              onClick={onTogglePreview}
              label={preview ? "Esconder a prévia da minha tela" : "Mostrar a prévia da minha tela"}
            />
          </MenuRow>
        </>
      )}
    </MenuPanel>
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
      <MenuDropdown
        label={label}
        value={active[kind] ?? options[0].id}
        options={options}
        onSelect={(id) => onSelect(kind, id)}
      />
    </MenuRow>
  );
}
