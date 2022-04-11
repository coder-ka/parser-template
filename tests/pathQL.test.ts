import test from "ava";

import {
  regularExpression,
  seq,
  or,
  kleeneClojure,
  empty,
  lazy,
  Expression,
} from "../lib/main";

const identifier = () => regularExpression(/\w+/);

const placeholderAttributeValue = identifier();
const stringAttributeValue = regularExpression(/[^']+/);
const falseAttributeValue = seq`false`;
const trueAttributeValue = seq`true`;
const booleanAttributeValue = or(trueAttributeValue, falseAttributeValue);
const numberAttributeValue = regularExpression(/[\d]+/);
const identifierAttributeValue = identifier();
const attributeValue = or(
  seq`@${placeholderAttributeValue}`,
  seq`'${stringAttributeValue}'`,
  booleanAttributeValue,
  numberAttributeValue,
  identifierAttributeValue
);
const attributeName = identifier();
const predicate = seq`${attributeName}${or(seq`(${attributeValue})`, empty)}`;
const predicatesUnion = seq`${predicate}${kleeneClojure(seq`+${predicate}`)}`;
const predicatesIntersection: Expression = seq`:${predicatesUnion}${or(
  lazy(() => predicatesIntersection),
  empty
)}`;
const entityName = identifier();
const pathQL: Expression = seq`/${entityName}${or(
  predicatesIntersection,
  empty
)}${or(
  lazy(() => pathQL),
  empty
)}`;

const parseResult = pathQL.parse(
  "/todos:completed+inProgress:id('12345')/piyo:id(@piyoId):user(me)"
);

test("Correctly parse the pathQL string.", (t) => {
  t.deepEqual(parseResult, {
    type: "success",
    node: {
      expressionType: pathQL.type,
      type: "internal",
      children: [
        {
          expressionType: entityName.type,
          type: "leaf",
          value: "todos",
        },
        {
          expressionType: predicatesIntersection.type,
          type: "internal",
          children: [
            {
              expressionType: predicatesUnion.type,
              type: "internal",
              children: [
                {
                  expressionType: predicate.type,
                  type: "internal",
                  children: [
                    {
                      expressionType: attributeName.type,
                      type: "leaf",
                      value: "completed",
                    },
                  ],
                },
                {
                  expressionType: predicate.type,
                  type: "internal",
                  children: [
                    {
                      expressionType: attributeName.type,
                      type: "leaf",
                      value: "inProgress",
                    },
                  ],
                },
              ],
            },
            {
              expressionType: predicatesIntersection.type,
              type: "internal",
              children: [
                {
                  expressionType: predicatesUnion.type,
                  type: "internal",
                  children: [
                    {
                      expressionType: predicate.type,
                      type: "internal",
                      children: [
                        {
                          expressionType: attributeName.type,
                          type: "leaf",
                          value: "id",
                        },
                        {
                          expressionType: stringAttributeValue.type,
                          type: "leaf",
                          value: "12345",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          expressionType: pathQL.type,
          type: "internal",
          children: [
            {
              expressionType: entityName.type,
              type: "leaf",
              value: "piyo",
            },
            {
              expressionType: predicatesIntersection.type,
              type: "internal",
              children: [
                {
                  expressionType: predicatesUnion.type,
                  type: "internal",
                  children: [
                    {
                      expressionType: predicate.type,
                      type: "internal",
                      children: [
                        {
                          expressionType: attributeName.type,
                          type: "leaf",
                          value: "id",
                        },
                        {
                          expressionType: placeholderAttributeValue.type,
                          type: "leaf",
                          value: "piyoId",
                        },
                      ],
                    },
                  ],
                },
                {
                  expressionType: predicatesIntersection.type,
                  type: "internal",
                  children: [
                    {
                      expressionType: predicatesUnion.type,
                      type: "internal",
                      children: [
                        {
                          expressionType: predicate.type,
                          type: "internal",
                          children: [
                            {
                              expressionType: attributeName.type,
                              type: "leaf",
                              value: "user",
                            },
                            {
                              expressionType: identifierAttributeValue.type,
                              type: "leaf",
                              value: "me",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                }
              ],
            },
          ],
        },
      ],
    },
    state: { index: 65 },
  });
});
