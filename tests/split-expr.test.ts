import test from "ava";
import { seq, split, translate } from "../lib/main";

test("split expr", (t) => {
  const { value } = translate("a b c d", split(" "));

  t.deepEqual(value, ["a", "b", "c", "d"]);
});

test("split look-ahead expr", (t) => {
  const { value } = translate("(1,2,3)", seq`(${split(",")})`);

  t.deepEqual(value, ["1", "2", "3"]);
});
