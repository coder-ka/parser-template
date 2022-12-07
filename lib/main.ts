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
type ExprMetadata = {
  head: Head;
  minLength: MinLength;
};
export type Expression = {
  id: string;
  nexts?: Expression[];
  getMetadata(): Generator<ExprMetadata>;

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
export type ExpressionOrLiteral =
  | string
  | {
      [prop: string | number | symbol]: ExpressionOrLiteral;
    }
  | ((str: string) => unknown)
  | RegExp
  | Expression;

export function translate(str: string, expr: ExpressionOrLiteral) {
  console.log();
  console.log(chalk.blue("translation start."));
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

      console.log("value:", value, "done:", done);
      if (done) break;

      result = value;
      break;
    } catch (e) {
      console.log();
      console.log("failed to translate.");
      error = e;
    }
  } while (true);

  if (result) {
    console.log();
    console.log(chalk.green("translation end successfully."));
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

export function createExpression<T extends Expression = Expression>(
  expr: Omit<T, "id">
): T {
  const id = nanoid(10);
  return {
    ...expr,
    id,
    *_translate(str, state, context): Generator<ParseResult> {
      if (state.index > str.length)
        throw new Error(`Failed to parse string ${str} at ${state.index}.`);

      function resolveNexts(
        nexts: Expression["nexts"]
      ): (Expression | undefined)[] {
        return (nexts || [context.next]).flatMap((next) =>
          next && isEmptyExpression(next) ? resolveNexts(next?.nexts) : [next]
        );
      }
      const nexts = resolveNexts(this.nexts);
      // const nexts = this.nexts || [context.next];
      console.log();
      console.log(
        "nexts:",
        nexts.map((x) => x?.__debug_info)
      );

      let i = 0,
        error: unknown;
      while (i < nexts.length) {
        const next = nexts[i];

        const nextId = next === undefined ? "" : next.id;
        const cacheKey = `${id}-${state.index}-${nextId}`;
        const cached = cacheKey === null ? null : cache.get(cacheKey);

        if (cached) {
          yield* cached;
        } else {
          console.log(
            `${
              state.index === str.length
                ? `${chalk.dim(str)}`
                : `${str.slice(0, state.index)}${
                    str[state.index] === undefined
                      ? ""
                      : chalk.bold(
                          chalk.blue(chalk.underline(str[state.index]))
                        )
                  }${str.slice(state.index + 1)}`
            }(${str.length})`,
            "with",
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

            // if (cacheKey !== null) {
            //   cache.set(cacheKey, result);
            // }

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
    function setNexts(expr: Expression, next: Expression | undefined) {
      if (isOrExpression(expr)) {
        setNexts(expr.a, next);
        setNexts(expr.b, next);
      } else {
        expr.nexts =
          next === undefined
            ? undefined
            : isOrExpression(next)
            ? [next.a, next.b]
            : [next];
      }
    }

    setNexts(expr, next);

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
    *getMetadata() {
      function* genMetadata(
        info: ExprMetadata,
        i: number
      ): Generator<ExprMetadata> {
        if (i < exprs.length) {
          const expr = exprs[i];
          for (const nextInfo of expr.getMetadata()) {
            const minLength = info.minLength + nextInfo.minLength;
            if (typeof info.head === "string") {
              if (typeof info.head === "string") {
                yield {
                  head: info.head + nextInfo.head,
                  minLength,
                };
              } else {
                yield {
                  head: info.head,
                  minLength,
                };
              }
            } else if (info.head instanceof RegExp) {
              yield {
                head: info.head,
                minLength,
              };
            } else {
              yield {
                head: info.head,
                minLength,
              };
            }
          }
        } else if (i === exprs.length) {
          yield info;
        }
      }

      yield* genMetadata(
        {
          head: "",
          minLength: 0,
        },
        0
      );
    },
    *_translate(str, state, context) {
      function* results(
        value: unknown[],
        state: ParseState,
        i: number
      ): Generator<ParseResult> {
        if (i < exprs.length) {
          const expr = exprs[i];
          for (const { state: itemState, value: itemValue } of expr._translate(
            str,
            state,
            context
          )) {
            if (isFlatExpression(expr) && Array.isArray(itemValue)) {
              yield* results(value.concat(itemValue), itemState, i + 1);
            } else if (isObjectExpression(expr)) {
              const objIndex = value.findIndex((x) => typeof x === "object");
              if (objIndex === -1) {
                yield* results(value.concat(itemValue), itemState, i + 1);
              } else {
                value[objIndex] = {
                  ...(value[objIndex] as any),
                  ...(itemValue as any),
                };
                yield* results(
                  Object.assign(value, itemValue),
                  itemState,
                  i + 1
                );
              }
            } else {
              yield* results(
                value.concat(itemValue === undefined ? [] : [itemValue]),
                itemState,
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
      len: exprs.length,
      exprs: exprs.map((x) => x.__debug_info),
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
    *getMetadata() {
      yield* a.getMetadata();
      yield* b.getMetadata();
    },
    *_translate(str, state, context) {
      try {
        yield* a._translate(str, state, context);
      } catch (error) {
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
export function lazy(
  resolverExprOrLiteral: () => ExpressionOrLiteral
): LazyExpression {
  const resolver = () => toExpression(resolverExprOrLiteral());
  return createExpression({
    type: "lazy",
    *getMetadata() {
      yield* resolver().getMetadata();
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
    *getMetadata() {
      yield* expr.getMetadata();
    },
    *_translate(str, state, context) {
      yield* expr._translate(str, state, context);
    },
    __debug_info: {
      type: "flat",
    },
  });
}

export function reduce(exprOrLiteral: ExpressionOrLiteral): Expression {
  const expr = toExpression(exprOrLiteral);
  return createExpression({
    *getMetadata() {
      yield* expr.getMetadata();
    },
    *_translate(str, state, context) {
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

function isEmptyExpression(x: any): x is EmptyExpression {
  return x.type === "empty" && isExpression(x);
}
type EmptyExpression = Expression & { type: "empty" };
export function empty<T>(value: T): EmptyExpression {
  return createExpression({
    type: "empty",
    *getMetadata() {
      yield {
        head: undefined,
        minLength: 0,
      };
    },
    *_translate(_str, state) {
      yield {
        state,
        value,
      };
    },
    __debug_info: {
      type: "empty",
    },
  });
}

export function end() {
  return createExpression({
    *getMetadata() {
      yield {
        head: undefined,
        minLength: 0,
      };
    },
    *_translate(str, state) {
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
    *getMetadata() {
      yield {
        head: undefined,
        minLength: 0,
      };
    },
    *_translate(str, state, context) {
      function* handleValue(value: string) {
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

      const infos: Iterable<ExprMetadata> =
        context.next === undefined
          ? [
              {
                head: undefined,
                minLength: 0,
              },
            ]
          : context.next.getMetadata();

      for (const info of infos) {
        console.log("head:", info.head);
        if (info.head instanceof RegExp) {
          info.head.lastIndex = state.index;
          const match = info.head.exec(str);
          if (match) {
            const value = str.slice(state.index, match.index);

            yield* handleValue(value);
          } else {
            yield* handleValue(str.slice(state.index));
          }
        } else if (info.head) {
          const index = str.indexOf(info.head, state.index);
          console.log(index);
          if (index === -1) {
            yield* handleValue(str.slice(state.index));
          } else {
            yield* handleValue(str.slice(state.index, index));
          }
        } else {
          yield* handleValue(str.slice(state.index));
        }
      }
    },
    __debug_info: {
      type: "any",
    },
  });
}

export function exists(target: string) {
  return createExpression({
    *getMetadata() {
      yield {
        head: target,
        minLength: target.length,
      };
    },
    *_translate(str, state) {
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
    __debug_info: {
      type: "exists",
      target,
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
    *getMetadata() {
      yield {
        head: expected,
        minLength: expected.length,
      };
    },
    *_translate(str, state) {
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
    *getMetadata() {
      yield {
        head: regexp,
        minLength,
      };
    },
    *_translate(str, state) {
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
    *getMetadata() {
      yield {
        head: undefined,
        minLength: 0,
      };
    },
    *_translate(str, state) {
      yield {
        value: fn(str.slice(state.index)),
        state: {
          index: str.length,
        },
      };
    },
    __debug_info: {
      type: "function",
    },
  });
}

function isObjectExpression(x: any): x is ObjectExpression {
  return x.type === "obj" && isExpression(x);
}
type ObjectExpression = Expression & {
  type: "obj";
};
export function obj(obj: {
  [prop: string]: ExpressionOrLiteral;
}): ObjectExpression {
  const firstKey = Object.keys(obj)[0];
  const expr = toExpression(obj[firstKey]);

  return createExpression({
    type: "obj",
    *getMetadata() {
      yield* expr.getMetadata();
    },
    *_translate(str, state, context) {
      for (const result of expr._translate(str, state, context)) {
        const { state: newState, value } = result;

        yield {
          state: newState,
          value: {
            [firstKey]: value,
          },
        };
      }
    },
    __debug_info: {
      type: "obj",
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
