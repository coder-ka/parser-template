import test from "ava";
import { any, seq, translate } from "../lib/main";

test("function expr", (t) => {
  const { value } = translate(
    "words split in whitespace",
    seq`words ${any((str) => str.split(" "))}`
  );

  t.deepEqual(value, [["split", "in", "whitespace"]]);
});
