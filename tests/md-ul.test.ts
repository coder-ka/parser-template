import test from "ava";
import {
  any,
  debug,
  empty,
  Expression,
  flat,
  lazy,
  or,
  OrExpression,
  seq,
  translate,
} from "../lib/main";

// type MarkdownList<TItem> = {
//   item: TItem;
//   children: MarkdownList<TItem>;
// }[];

function MarkdownUnorderedList(
  itemExpr: Expression,
  indent = ""
): Expression {
  return or(
    seq`${indent}- ${{ item: itemExpr }}¥n${{
      children: lazy(() =>
        MarkdownUnorderedList(itemExpr, debug(indent + "  "))
      ),
    }}¥n${flat(lazy(() => MarkdownUnorderedList(itemExpr, indent)))}`,
    empty([])
  );
}

const markdownUnorderedList = MarkdownUnorderedList(any());

test("empty string returns empty array.", (t) => {
  const { value } = translate(``, markdownUnorderedList);

  t.deepEqual(value, []);
});

// TODO 
// 先読みのあたりが訳分からなくなってきたので保留
test("two list item.", (t) => {
  const { value } = translate(
    `
- item
`.slice(1),
    markdownUnorderedList
  );

  t.deepEqual(value, []);
});

// test("markdown unordered list", (t) => {
//   const { value } = translate(
//     `
// - hoge
//   - fuga
//   - piyo
// - puge
//   - nyonyo`.slice(1),
//     markdownUnorderedList
//   );

//   t.deepEqual(value, [
//     {
//       item: "hoge",
//       children: [
//         {
//           item: "fuga",
//           children: [],
//         },
//         {
//           item: "piyo",
//           children: [],
//         },
//       ],
//     },
//     {
//       item: "puge",
//       children: [
//         {
//           item: "nyonyo",
//           children: [],
//         },
//       ],
//     },
//   ]);
// });
