import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { clickableProps } from "../src/lib/ui/clickable";

type FakeKey = Parameters<NonNullable<ReturnType<typeof clickableProps>["onKeyDown"]>>[0];

function press(key: string, fromChild = false) {
  const self = {};
  let prevented = false;
  const event = {
    key,
    currentTarget: self,
    target: fromChild ? {} : self,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as FakeKey;
  return { event, prevented: () => prevented };
}

describe("clickableProps", () => {
  test("sem onClick, o bloco não vira botão", () => {
    assert.deepEqual(clickableProps(), {});
  });

  test("com onClick, entra no Tab como botão", () => {
    const props = clickableProps(() => {});
    assert.equal(props.role, "button");
    assert.equal(props.tabIndex, 0);
  });

  test("Enter e Espaço abrem, e o Espaço não rola a página", () => {
    let opened = 0;
    const props = clickableProps(() => opened++);
    for (const key of ["Enter", " "]) {
      const { event, prevented } = press(key);
      props.onKeyDown!(event);
      assert.equal(prevented(), true);
    }
    assert.equal(opened, 2);
  });

  test("outras teclas não abrem", () => {
    let opened = 0;
    const props = clickableProps(() => opened++);
    for (const key of ["Tab", "Escape", "a", "ArrowDown"]) props.onKeyDown!(press(key).event);
    assert.equal(opened, 0);
  });

  test("tecla num controle de dentro (caixa de seleção, ⋯) é dele, não da linha", () => {
    let opened = 0;
    const props = clickableProps(() => opened++);
    const { event, prevented } = press("Enter", true);
    props.onKeyDown!(event);
    assert.equal(opened, 0);
    assert.equal(prevented(), false);
  });
});
