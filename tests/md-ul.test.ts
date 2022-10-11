import test from "ava";
import {
  any,
  empty,
  // empty,
  // empty,
  end,
  Expression,
  lazy,
  // flat,
  // lazy,
  or,
  repeat,
  // repeat,
  seq,
  translate,
} from "../lib/main";

// type MarkdownList<TItem> = {
//   item: TItem;
//   children: MarkdownList<TItem>;
// }[];

function MarkdownUnorderedList(itemExpr: Expression): Expression {
  function ListItems(indent = ""): Expression {
    return repeat(seq`${indent}- ${{ item: itemExpr }}
${{
  children: or(
    lazy(() => ListItems(indent + "  ")),
    empty([])
  ),
}}`);
  }

  return or(end([]), ListItems());
}

const markdownUnorderedList = MarkdownUnorderedList(any());

test("empty string returns empty array.", (t) => {
  const { value } = translate(``, markdownUnorderedList);

  t.deepEqual(value, []);
});

// TODO
// 先読みのあたりが訳分からなくなってきたので保留
test("one list item.", (t) => {
  const { value } = translate(
    `
- item1
`.slice(1),
    markdownUnorderedList
  );

  t.deepEqual(value, [
    {
      item: "item1",
      children: [],
    },
  ]);
});

test("two list item.", (t) => {
  const { value } = translate(
    `
- item1
- item2
`.slice(1),
    markdownUnorderedList
  );

  t.deepEqual(value, [
    {
      item: "item1",
      children: [],
    },
    {
      item: "item2",
      children: [],
    },
  ]);
});

test("nested list.", (t) => {
  const { value } = translate(
    `
- hoge
  - fuga
  - piyo
- puge
  - nyonyo
`.slice(1),
    markdownUnorderedList
  );

  t.deepEqual(value, [
    {
      item: "hoge",
      children: [
        {
          item: "fuga",
          children: [],
        },
        {
          item: "piyo",
          children: [],
        },
      ],
    },
    {
      item: "puge",
      children: [
        {
          item: "nyonyo",
          children: [],
        },
      ],
    },
  ]);
});
