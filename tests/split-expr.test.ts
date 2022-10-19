import test from "ava";
import { split, translate } from "../lib/main";

test("split expr", (t) => {
  const { value } = translate("a b c d", split(" "));

  t.deepEqual(value, ["a", "b", "c", "d"]);
});
