import test from "ava";
import { any, empty, exists, or, seq, translate } from "../lib/main";
import { debugTest } from "./util";

test.skip("exists expr", (t) => {
  const expr = seq`${any()}${or(exists("?"), empty(false))}: ${any()}`;
  const { value } = translate("hoge?: string", expr);

  t.deepEqual(value, ["hoge", true, "string"]);
});

test("exists expr not exists", (t) => {
  debugTest(t, () => {
    const expr = seq`${any()}${or(exists("?"), empty(false))}: ${any()}`;
    const { value } = translate("hoge: string", expr);

    t.deepEqual(value, ["hoge", false, "string"]);
  });
});
