import test from "ava";
import { empty, or, translate } from "../lib/main";
import { debugTest } from "./util";

const expr = or("test", empty(undefined));

test("or expr test.", (t) => {
  const { value } = translate("test", expr);

  t.deepEqual(value, []);
});

test("or expr test when empty.", (t) => {
  const { value } = translate("", expr);

  t.deepEqual(value, []);
});
