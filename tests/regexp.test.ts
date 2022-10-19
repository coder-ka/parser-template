import test from "ava";
import { any, seq, translate } from "../lib/main";

const expr = seq`const ${{ variable: /[^\s]+/ }} = '${{ value: any() }}'`;

test("regexp", (t) => {
  const { value } = translate("const hoge = 'piyo'", expr);

  t.deepEqual(value, [
    {
      variable: "hoge",
      value: "piyo",
    },
  ]);
});
