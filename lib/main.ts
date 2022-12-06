import { nanoid } from "nanoid";
import chalk from "picocolors";

type ParseState = {
  index: number;
};
type ParseContext = {
  next: Expression | undefined;
};
type Head = RegExp | string | undefined;
type ParseResult = {
  value: unknown;
  state: ParseState;
};
type MinLength = number;
type Expression = {
  id: string;
  nexts?: Expression[];
  getMinLength(): MinLength;
  getHeads(): Head[];

  _translate(
    str: string,
    state: ParseState,
    context: ParseContext
  ): Generator<ParseResult>;

  __debug_info?: unknown;
};
function isExpression(x: any): x is Expression {
  return typeof x["_translate"] === "function";
}
type ExpressionOrLiteral =
  | string
  | {
      [prop: string | number | symbol]: ExpressionOrLiteral;
    }
  | ((str: string) => unknown)
  | RegExp
  | Expression;

export function translate(str: string, expr: ExpressionOrLiteral) {
  console.log();
  console.log("translation start.");
  console.log();

  const tree = toExpression(seq`${flat(expr)}${end()}`)._translate(
    str,
    {
      index: 0,
    },
    {
      next: undefined,
    }
  );

  let error: unknown,
    result: ParseResult | undefined = undefined;
  do {
    try {
      const { done, value } = tree.next();

      console.log(value, done);
      if (done) break;

      result = value;
      break;
    } catch (e) {
      console.log("failed to translate.");
      error = e;
    }
  } while (true);

  if (result) {
    console.log();
    console.log("translation end successfully.");
    console.log();

    return result;
  } else {
    throw error || new Error("No translation executed.");
  }
}

function toExpression(exprOrLiteral: ExpressionOrLiteral): Expression {
  if (typeof exprOrLiteral === "string") {
    return stringLiteralExpr(exprOrLiteral);
  } else if (isExpression(exprOrLiteral)) {
    return exprOrLiteral;
  } else if (exprOrLiteral instanceof RegExp) {
    return regexp(exprOrLiteral);
  } else if (typeof exprOrLiteral === "function") {
    return fn(exprOrLiteral);
  } else {
    return obj(exprOrLiteral);
  }
}

const cache = new Map<string, Generator<ParseResult>>();
// let expressionId = 0;

export function createExpression<T extends Expression = Expression>(
  expr: Omit<T, "id">
): T {
  // expressionId = (expressionId + 1) | 0;
  const id = nanoid(10);
  return {
    ...expr,
    id,
    _translate: function* (str, state, context): Generator<ParseResult> {
      if (state.index > str.length)
        throw new Error(`Failed to parse string ${str} at ${state.index}.`);

      const nexts = this.nexts || [context.next];

      let i = 0,
        error: unknown;
      while (i < nexts.length) {
        const next = nexts[i];

        const { cacheId, minLength } =
          next === undefined
            ? {
                minLength: 0,
                cacheId: "",
              }
            : {
                cacheId: next.id,
                minLength: next.getMinLength(),
              };

        const cacheKey =
          cacheId === null ? null : `${id}-${state.index}-${cacheId}`;
        const cached = cacheKey === null ? null : cache.get(cacheKey);

        if (cached) {
          yield* cached;
        } else {
          if (minLength !== 0 && state.index + minLength >= str.length)
            throw new Error("min length error");

          console.log(
            "/start translate",
            `"${str.slice(0, state.index)}${
              str[state.index] === undefined
                ? ""
                : chalk.blue(chalk.underline(str[state.index]))
            }${str.slice(state.index + 1)}"(${str.length})`,
            "with",
            id,
            expr.__debug_info,
            "at",
            state
          );

          try {
            const result = expr._translate(
              str,
              {
                index: state.index,
              },
              { next }
            );

            if (cacheKey !== null) {
              cache.set(cacheKey, result);
            }

            yield* result;
          } catch (e) {
            error = e;
          }
        }

        i = (i + 1) | 0;
      }

      if (error) throw error;
    },
  } as T;
}

function normalizeSeqExpr(
  stringLiterals: TemplateStringsArray,
  placeholders: ExpressionOrLiteral[]
) {
  const exprs: Expression[] = [];
  let i = 0,
    lastIsString = false;

  while (i < placeholders.length) {
    const stringLiteral = stringLiterals[i];
    if (stringLiteral !== "") {
      if (lastIsString) {
        exprs[exprs.length - 1] = (
          exprs[exprs.length - 1] as StringLiteralExpression
        ).concat(stringLiteral);
      } else {
        exprs.push(stringLiteralExpr(stringLiteral));
      }
      lastIsString = typeof stringLiteral === "string";
    }
    const placeholder = placeholders[i];
    const placeholderIsString = typeof placeholder === "string";
    if (lastIsString && placeholderIsString) {
      exprs[exprs.length - 1] = (
        exprs[exprs.length - 1] as StringLiteralExpression
      ).concat(placeholder);
    } else {
      exprs.push(toExpression(placeholder));
    }
    lastIsString = placeholderIsString;

    i = (i + 1) | 0;
  }

  const lastStringLiteral = stringLiterals[i];
  if (lastStringLiteral !== "") {
    if (lastIsString) {
      exprs[exprs.length - 1] = (
        exprs[exprs.length - 1] as StringLiteralExpression
      ).concat(stringLiterals[i]);
    } else {
      exprs.push(stringLiteralExpr(stringLiterals[i]));
    }
  }

  i = 0;
  while (i < exprs.length) {
    const expr = exprs[i];
    const next = exprs[i + 1];
    expr.nexts =
      next === undefined
        ? undefined
        : isOrExpression(next)
        ? [next.a, next.b]
        : [next];

    i = (i + 1) | 0;
  }

  return exprs;
}

type SeqExpression = Expression & {
  type: "seq";
};
export function seq(
  strings: TemplateStringsArray,
  ...placeholders: ExpressionOrLiteral[]
): SeqExpression {
  const exprs = normalizeSeqExpr(strings, placeholders);

  return createExpression({
    type: "seq",
    getHeads() {
      let i = 1,
        heads = exprs[0].getHeads();
      while (i < exprs.length) {
        const expr = exprs[i];
        const nextStringHeads = expr
          .getHeads()
          .flatMap((x) => (typeof x === "string" ? [x] : []));
        if (nextStringHeads.length === 0) {
          break;
        } else {
          heads = heads.flatMap<Head>((head) => {
            if (typeof head === "string") {
              return nextStringHeads.map((nextHead) => head + nextHead);
            } else {
              return [head];
            }
          });
        }

        i = (i + 1) | 0;
      }

      return heads;
    },
    getMinLength() {
      let i = 1,
        minLength = 0;
      while (i < exprs.length) {
        const expr = exprs[i];

        minLength = (minLength + expr.getMinLength()) | 0;

        i = (i + 1) | 0;
      }

      return minLength;
    },
    _translate: function* (str, state, context) {
      function* results(
        value: unknown[],
        state: ParseState,
        i: number
      ): Generator<ParseResult> {
        if (i < exprs.length) {
          const expr = exprs[i];
          for (const { state: newState, value: item } of expr._translate(
            str,
            state,
            context
          )) {
            if (isFlatExpression(expr) && Array.isArray(item)) {
              yield* results(value.concat(item), newState, i + 1);
            } else {
              yield* results(
                value.concat(item === undefined ? [] : [item]),
                newState,
                i + 1
              );
            }
          }
        } else if (i === exprs.length) {
          yield {
            value,
            state,
          };
        }
      }

      yield* results([], state, 0);
    },
    __debug_info: {
      type: "seq",
      exprsLen: exprs.length,
    },
  });
}

function isOrExpression(x: any): x is OrExpression {
  return x["type"] === "or" && isExpression(x);
}
type OrExpression = Expression & {
  type: "or";
  a: Expression;
  b: Expression;
};
export function or(
  aOrLiteral: ExpressionOrLiteral,
  bOrLiteral: ExpressionOrLiteral
): OrExpression {
  const a = toExpression(aOrLiteral),
    b = toExpression(bOrLiteral);

  return createExpression({
    type: "or",
    a,
    b,
    getHeads() {
      // return [undefined];
      return [...a.getHeads(), ...b.getHeads()];
    },
    getMinLength() {
      return 0;
      // return Math.min(a.getMinLength(), b.getMinLength());
    },
    _translate: function* (str, state, context) {
      try {
        console.log("a");
        yield* a._translate(str, state, context);
      } catch (error) {
        console.log("b");
        yield* b._translate(str, state, context);
      }
    },
    __debug_info: {
      type: "or",
    },
  });
}

// function isLazyExpression(x: any): x is LazyExpression {
//   return x["type"] === "lazy" && isExpression(x);
// }
type LazyExpression = Expression & {
  type: "lazy";
};
export function lazy(resolver: () => Expression): LazyExpression {
  return createExpression({
    type: "lazy",
    getHeads() {
      // return [undefined];
      return resolver().getHeads();
    },
    getMinLength() {
      return 0;
      // return resolver().getMinLength();
    },
    _translate(str, state, context) {
      return resolver()._translate(str, state, context);
    },
    __debug_info: {
      type: "lazy",
    },
  });
}

function isFlatExpression(x: any): x is FlatExpression {
  return x["type"] === "flat" && isExpression(x);
}
type FlatExpression = Expression & {
  type: "flat";
};
export function flat(exprOrLiteral: ExpressionOrLiteral): FlatExpression {
  const expr = toExpression(exprOrLiteral);
  return createExpression({
    type: "flat",
    getHeads() {
      return expr.getHeads();
    },
    getMinLength() {
      return expr.getMinLength();
    },
    _translate(str, state, context) {
      return expr._translate(str, state, context);
    },
    __debug_info: {
      type: "flat",
    },
  });
}

// function isReduceExpression(x: any): x is ReduceExpression {
//   return x["type"] === "reduce" && isExpression(x);
// }
type ReduceExpression = Expression & {
  type: "reduce";
};
export function reduce(exprOrLiteral: ExpressionOrLiteral): ReduceExpression {
  const expr = toExpression(exprOrLiteral);
  return createExpression({
    type: "reduce",
    getHeads() {
      return expr.getHeads();
    },
    getMinLength() {
      return expr.getMinLength();
    },
    _translate: function* (str, state, context) {
      for (const result of expr._translate(str, state, context)) {
        const { state: newState, value } = result;

        if (Array.isArray(value)) {
          const newValue = (value as unknown[]).reduce((res, item) => {
            if (typeof item === "object" && item) {
              return {
                ...(res as any),
                ...item,
              };
            } else {
              return res;
            }
          }, {});

          yield {
            value: newValue,
            state: newState,
          };
        } else {
          yield {
            state: newState,
            value,
          };
        }
      }
    },
    __debug_info: {
      type: "reduce",
    },
  });
}

export function repeat(expr: ExpressionOrLiteral): FlatExpression {
  return flat(
    seq`${flat(expr)}${flat(
      or(
        lazy(() => repeat(expr)),
        empty([])
      )
    )}`
  );
}

export function empty<T>(value: T) {
  return createExpression({
    getMinLength() {
      return 0;
    },
    getHeads() {
      return [undefined];
    },
    _translate: function* (_str, state) {
      console.log("empty");
      yield {
        state,
        value,
      };
    },
  });
}

export function end() {
  return createExpression({
    getHeads() {
      return [undefined];
    },
    getMinLength() {
      return 0;
    },
    _translate: function* (str, state) {
      if (str.length === state.index) {
        yield {
          value: undefined,
          state,
        };
      }

      throw new Error(`${state.index} does not end at ${str.length}.`);
    },
  });
}

export function any(childExprOrLiteral?: ExpressionOrLiteral): Expression {
  const childExpr =
    childExprOrLiteral === undefined
      ? undefined
      : toExpression(childExprOrLiteral);
  return createExpression({
    getHeads() {
      return [undefined];
    },
    getMinLength() {
      return 0;
    },
    _translate: function* (str, state, context) {
      function* handleValue(value: string) {
        console.log(value);

        if (childExpr) {
          for (const res of childExpr._translate(
            value,
            { index: 0 },
            {
              next: undefined,
            }
          )) {
            yield {
              value: res.value,
              state: {
                index: state.index + res.state.index,
              },
            };
          }
        } else {
          yield {
            state: {
              index: state.index + value.length,
            },
            value,
          };
        }
      }

      const heads =
        context.next === undefined ? [undefined] : context.next.getHeads();

      console.log("heads:", heads);
      let i = 0;
      while (i < heads.length) {
        const head = heads[i];

        if (head instanceof RegExp) {
          head.lastIndex = state.index;
          const match = head.exec(str);
          if (match) {
            const value = str.slice(state.index, match.index);

            yield* handleValue(value);
          } else {
            yield* handleValue(str.slice(state.index));
          }
        } else if (head) {
          const index = str.indexOf(head, state.index);
          console.log(index);
          if (index === -1) {
            yield* handleValue(str.slice(state.index));
          } else {
            yield* handleValue(str.slice(state.index, index));
          }
        } else {
          yield* handleValue(str.slice(state.index));
        }

        i = (i + 1) | 0;
      }
    },
    __debug_info: {
      type: "any",
    },
  });
}

// exists
export function exists(target: string) {
  return createExpression({
    getHeads() {
      return [target];
    },
    getMinLength() {
      return target.length;
    },
    _translate: function* (str, state) {
      const sliced = str.slice(state.index, state.index + target.length);

      if (sliced === target) {
        yield {
          state: {
            index: state.index + target.length,
          },
          value: true,
        };
      } else {
        throw new Error(`${target} does not exists at ${state.index}.`);
      }
    },
  });
}

type StringLiteralExpression = Expression & {
  type: "stringLiteral";
  concat(str: string): StringLiteralExpression;
};
export function stringLiteralExpr(expected: string): StringLiteralExpression {
  return createExpression({
    type: "stringLiteral",
    concat(str) {
      return stringLiteralExpr(expected + str);
    },
    getHeads() {
      return [expected];
    },
    getMinLength() {
      return expected.length;
    },
    _translate: function* (str, state) {
      const newIndex = state.index + expected.length;
      const actual = str.slice(state.index, newIndex);
      if (actual === expected) {
        yield {
          state: {
            index: newIndex,
          },
          value: undefined,
        };
      } else {
        throw new Error(
          `string '${expected}' does not match '${actual}' at ${state.index}.`
        );
      }
    },
    __debug_info: {
      type: "stringLiteral",
      expected,
    },
  });
}

export function regexp(
  regexpNotSticky: RegExp,
  {
    minLength,
  }: {
    minLength: MinLength;
  } = {
    minLength: 0,
  }
) {
  const regexp = new RegExp(regexpNotSticky, "y");

  return createExpression({
    getHeads() {
      return [regexp];
    },
    getMinLength() {
      return minLength;
    },
    _translate: function* (str, state) {
      regexp.lastIndex = state.index;
      const match = regexp.exec(str);

      if (match && match.index === state.index) {
        const value = match[0];
        yield {
          value,
          state: {
            index: state.index + value.length,
          },
        };
      } else {
        throw new Error(
          `RegExp ${regexp.toString()} does not match string at ${state.index}`
        );
      }
    },
    __debug_info: {
      type: "regexp",
      regexp,
    },
  });
}

export function integer() {
  return regexp(/\d+/, {
    minLength: 1,
  });
}

export function fn(fn: (str: string) => unknown): Expression {
  return createExpression({
    getHeads() {
      return [undefined];
    },
    getMinLength() {
      return 0;
    },
    _translate: function* (str, state) {
      yield {
        value: fn(str.slice(state.index)),
        state: {
          index: str.length,
        },
      };
    },
  });
}

export function obj(obj: { [prop: string]: ExpressionOrLiteral }): Expression {
  const firstKey = Object.keys(obj)[0];
  const expr = toExpression(obj[firstKey]);

  return createExpression({
    getHeads() {
      return expr.getHeads();
    },
    getMinLength() {
      return expr.getMinLength();
    },
    _translate: function* (str, state, context) {
      for (const result of expr._translate(str, state, context)) {
        const { state: newState, value } = result;

        yield {
          state: newState,
          value: {
            [firstKey]: {
              value,
            },
          },
        };
      }
    },
  });
}

export function split(delimiter: string, expr?: ExpressionOrLiteral) {
  return flat(
    any(
      seq`${any(expr)}${flat(
        or(repeat(seq`${delimiter}${any(expr)}`), empty([]))
      )}`
    )
  );
}
