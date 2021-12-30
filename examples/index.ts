import assert from "assert";
import {
  regularExpression,
  seq,
  or,
  kleeneClojure,
  empty,
  lazy,
} from "../lib/main";

const identifier = () => regularExpression(/\w*/);

const attributeName = identifier();
const numberAttributeValue = regularExpression(/[\d]+/);
const stringAttributeValue = seq`'${regularExpression(/[^']+/)}'`;
const booleanAttributeValue = or(seq`true`, seq`false`);
const attributeValue = or(
  stringAttributeValue,
  booleanAttributeValue,
  numberAttributeValue
);
const predicate = seq`${attributeName}${or(seq`(${attributeValue})`, empty)}`;
const predicatesUnion = seq`${predicate}${kleeneClojure(seq`+${predicate}`)}`;
const predicatesIntersection = seq`:${predicatesUnion}${or(
  lazy(() => predicatesIntersection),
  empty
)}`;
const entityName = identifier();
const pathQL = seq`/${entityName}${predicatesIntersection}${or(
  lazy(() => pathQL),
  empty
)}`;

const parseResult = pathQL.parse(
  "/todos:completed+inProgress:id('12345')/piyo"
);

assert.deepEqual(parseResult, {
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
                        expressionType: attributeValue.type,
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
        ],
      },
    ],
  },
  state: { index: 39 },
});
