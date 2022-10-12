import test from "ava";
import { any, flat, seq, translate } from "../lib/main";

const child = seq`${{ test: any() }}`;
const parent = seq`${{ child: flat(child) }}`;

test("object flat", (t) => {
  const { value } = translate("test", parent);

  t.deepEqual(value, [{ child: { test: "test" } }]);
});
