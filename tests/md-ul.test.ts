import test from "ava";
import {
  any,
  empty,
  Expression,
  flat,
  lazy,
  or,
  OrExpression,
  seq,
  translate,
} from "../lib/main";

type MarkdownList<TItem> = {
  item: TItem;
  children: MarkdownList<TItem>;
}[];

function MarkdownUnorderedList(itemExpr: Expression, indent = "") {
  return or(
    seq`${indent}- ${itemExpr}${or(
      flat(lazy(() => MarkdownUnorderedList(itemExpr, indent + "  "))),
      empty([])
    )}\n${flat(lazy(() => MarkdownUnorderedList(itemExpr, indent)))}`,
    empty([])
  );
}

const markdownUnorderedList = MarkdownUnorderedList(any());

test("markdown unordered list", (t) => {
  const { value } = translate(
    `
- hoge
  - fuga
  - piyo
- puge
  - nyonyo`.slice(1),
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
