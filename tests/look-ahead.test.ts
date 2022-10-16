import test from "ava";
import {
  any,
  empty,
  flat,
  or,
  reduce,
  repeat,
  seq,
  translate,
} from "../lib/main";

test("look-ahead", (t) => {
  const { value } = translate("'test'", seq`'${any()}'`);

  t.deepEqual(value, ["test"]);
});

test("look-ahead 2", (t) => {
  const { value } = translate("'test'", seq`'${{ a: or(any(), empty("")) }}'`);

  t.deepEqual(value, [{ a: "test" }]);
});

test("look-ahead 3", (t) => {
  const { value } = translate(
    `sec1:
  fuga: piko
  hoge: piyo[]
sec2:
  fuga: piko
  hoge: piyo[]
`,
    seq`sec1:
${{
  sec1: repeat(seq`  ${{ name: any() }}: ${{
    p: or({ hoge: reduce(seq`${/[^[ ]+/}[]`) }, { piyo: any() }),
  }}
`),
}}sec2:
${{
  sec2: repeat(seq`  ${{ name: any() }}: ${{
    p: or({ hoge: reduce(seq`${/[^[ ]+/}[]`) }, { piyo: any() }),
  }}
`),
}}`
  );

  t.deepEqual(value, [
    {
      sec1: [
        {
          name: "fuga",
          p: { piyo: "piko" },
        },
        {
          name: "hoge",
          p: { hoge: "piyo" },
        },
      ],
      sec2: [
        {
          name: "fuga",
          p: { piyo: "piko" },
        },
        {
          name: "hoge",
          p: { hoge: "piyo" },
        },
      ],
    },
  ]);
});

test("look-ahead 4", (t) => {
  const { value } = translate(
    `Hoge Fuga Piii`,
    seq`${{
      name: any(),
    }}${{
      obj: or(
        seq` ${flat(any((x) => x.split(" ").map((name) => ({ name }))))}`,
        empty([])
      ),
    }}`
  );

  t.deepEqual(value, [
    {
      name: "Hoge",
      obj: [
        {
          name: "Fuga",
        },
        {
          name: "Piii",
        },
      ],
    },
  ]);
});
