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

/*
 * Os ajustes da chamada: qual microfone, qual saída de som, qual câmera.
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
