import test from "ava";
import { any, empty, exists, or, seq, translate } from "../lib/main";
import { debugTest } from "./util";

const expr = seq`${any()}${or(exists("?"), empty(false))}: ${any()}`;

test("exists expr", (t) => {
  const { value } = translate("hoge?: string", expr);

  t.deepEqual(value, ["hoge", true, "string"]);
});

test("exists expr not exists", (t) => {
  const { value } = translate("hoge: string", expr);

  t.deepEqual(value, ["hoge", false, "string"]);
});
