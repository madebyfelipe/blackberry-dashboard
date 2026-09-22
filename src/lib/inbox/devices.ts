/*
 * Os aparelhos da chamada (microfone, saída de som, câmera) como o menu de
 * ajustes os mostra. Função pura, fora do componente, para ser testada.
 */

export type DeviceKind = "audioinput" | "audiooutput" | "videoinput";

export type DeviceOption = { id: string; label: string };

export type CallDevices = Record<DeviceKind, DeviceOption[]>;

export type ActiveDevices = Partial<Record<DeviceKind, string>>;

const NOME: Record<DeviceKind, string> = {
  audioinput: "Microfone",
  audiooutput: "Saída",
  videoinput: "Câmera",
};

/**
 * Lista do navegador → opções do menu. Sem permissão o navegador devolve o
 * aparelho sem nome; aí ele vira "Câmera 2" em vez de uma linha em branco.
 * O "default" do Chrome é um apelido de outro aparelho da lista — continua,
 * porque é o que acompanha a troca de fone no sistema. Aparelho sem id (o
 * Firefox antes da permissão) não tem como ser escolhido, então sai.
 */
export function toDeviceOptions(
  list: { deviceId: string; label: string }[],
  kind: DeviceKind,
): DeviceOption[] {
  return list
    .filter((d) => d.deviceId)
    .map((d, i) => ({
      id: d.deviceId,
      label: d.label.trim() || `${NOME[kind]} ${i + 1}`,
    }));
}
