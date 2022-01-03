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
const stringAttributeValue = regularExpression(/[^']+/);
const falseAttributeValue = seq`false`;
const trueAttributeValue = seq`true`;
const booleanAttributeValue = or(trueAttributeValue, falseAttributeValue);
const attributeValue = or(
  seq`'${stringAttributeValue}'`,
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
const pathQL = seq`/${entityName}${or(
  predicatesIntersection,
  empty
)}${or(
  lazy(() => pathQL),
  empty
)}`;

const parseResult = pathQL.parse(
  "/todos:completed+inProgress:id('12345')/piyo"
);

console.log(JSON.stringify(parseResult));
