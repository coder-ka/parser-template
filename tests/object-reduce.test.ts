import test from "ava";
import { any, reduce, seq, translate } from "../lib/main";

const child = seq`${{ test: any() }}`;
const parent = seq`${{ child: reduce(child) }}`;

test("object reduce", (t) => {
  const { value } = translate("test", parent);

  t.deepEqual(value, [{ child: { test: "test" } }]);
});
