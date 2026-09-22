import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { toDeviceOptions } from "../src/lib/inbox/devices";

describe("toDeviceOptions", () => {
  test("mantém o nome que o navegador dá ao aparelho", () => {
    assert.deepEqual(
      toDeviceOptions(
        [
          { deviceId: "default", label: "Padrão - MacBook Pro Microphone" },
          { deviceId: "abc", label: "AirPods Pro" },
        ],
        "audioinput",
      ),
      [
        { id: "default", label: "Padrão - MacBook Pro Microphone" },
        { id: "abc", label: "AirPods Pro" },
      ],
    );
  });

  test("sem permissão, aparelho sem nome vira um nome numerado", () => {
    assert.deepEqual(
      toDeviceOptions(
        [
          { deviceId: "c1", label: "" },
          { deviceId: "c2", label: "  " },
        ],
        "videoinput",
      ),
      [
        { id: "c1", label: "Câmera 1" },
        { id: "c2", label: "Câmera 2" },
      ],
    );
    assert.equal(toDeviceOptions([{ deviceId: "s", label: "" }], "audiooutput")[0].label, "Saída 1");
  });

  test("aparelho sem id não pode ser escolhido e sai da lista", () => {
    assert.deepEqual(toDeviceOptions([{ deviceId: "", label: "" }], "audioinput"), []);
  });
});
