import test from "ava";
import { any, repeat, seq, translate } from "../lib/main";

test("any child expr", (t) => {
  const { value } = translate(
    "words split in whitespace",
    seq`${any()} ${any(seq`${repeat(seq`${any()} `)}${any()}`)}`
  );

  t.deepEqual(value, ["words", ["split", "in", "whitespace"]]);
});
