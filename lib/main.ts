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
  id: number;
  nexts?: Expression[];
  getMinLength(): MinLength;
  getHeads(): Head[];

  _translate(
    str: string,
    state: ParseState,
    context: ParseContext
  ): Generator<ParseResult>;
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
  const tree = toExpression(seq`${expr}${end()}`)._translate(
    str,
    {
      index: 0,
    },
    {
      next: undefined,
    }
  );

  let error: unknown;
  do {
    try {
      const { done, value } = tree.next();

      if (done) break;

      return value;
    } catch (e) {
      error = e;
    }
  } while (true);

  throw error;
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
let ExpressionId = -1;

export function createExpression<T extends Expression = Expression>(
  x: Omit<T, "id">
): T {
  return {
    ...x,
    id: ExpressionId++,
    _translate: function* (str, state, context): Generator<ParseResult> {
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
          cacheId === null ? null : `${this.id}-${state.index}-${cacheId}`;
        const cached = cacheKey === null ? null : cache.get(cacheKey);

        if (cached) {
          return cached;
        } else {
          if (minLength !== 0 && state.index + minLength > str.length)
            throw new Error("min length error");

          try {
            const result = x._translate(str, state, { next });
            if (cacheKey !== null) {
              cache.set(cacheKey, result);
            }

            for (const res of result) {
              yield res;
            }
          } catch (e) {
            error = e;
          }
        }

        i = (i + 1) | 0;
      }

      throw error;
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

  if (lastIsString) {
    exprs[exprs.length - 1] = (
      exprs[exprs.length - 1] as StringLiteralExpression
    ).concat(stringLiterals[i]);
  } else {
    exprs.push(stringLiteralExpr(stringLiterals[i]));
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
      let i = 1,
        value = [] as unknown[],
        newState = state;
      while (i < exprs.length) {
        const expr = exprs[i];

        for (const res of expr._translate(str, newState, context)) {
          if (isFlatExpression(expr) && Array.isArray(res.value)) {
            res.value.forEach((item) => {
              value.push(item);
            });
          } else {
            if (res.value !== undefined) {
              value.push(res.value);
            }
          }

          newState = res.state;
        }

        i = (i + 1) | 0;
      }

      yield {
        value,
        state: newState,
      };
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
export function or(a: Expression, b: Expression): OrExpression {
  return createExpression({
    type: "or",
    a,
    b,
    getHeads() {
      return [...a.getHeads(), ...b.getHeads()];
    },
    getMinLength() {
      return Math.min(a.getMinLength(), b.getMinLength());
    },
    _translate(str, state, context) {
      try {
        return a._translate(str, state, context);
      } catch (error) {
        return b._translate(str, state, context);
      }
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
      return resolver().getHeads();
    },
    getMinLength() {
      return resolver().getMinLength();
    },
    _translate(str, state, context) {
      return resolver()._translate(str, state, context);
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

export function any(exprOrLiteral?: ExpressionOrLiteral): Expression {
  const expr =
    exprOrLiteral === undefined ? undefined : toExpression(exprOrLiteral);
  return createExpression({
    getHeads() {
      return [undefined];
    },
    getMinLength() {
      return 0;
    },
    _translate: function* (str, state, context) {
      function* handleValue(value: string) {
        if (expr) {
          for (const res of expr._translate(
            value,
            { index: 0 },
            {
              next: undefined,
            }
          )) {
            yield res;
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

      let i = 1,
        error: unknown;
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
          if (index === -1) {
            yield* handleValue(str.slice(state.index));
          } else {
            yield* handleValue(str.slice(state.index, state.index + index));
          }
        } else {
          yield* handleValue(str.slice(state.index));
        }

        i = (i + 1) | 0;
      }

      throw error;
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
        throw new Error();
      }
    },
  });
}

type StringLiteralExpression = Expression & {
  type: "stringLiteral";
  concat(str: string): StringLiteralExpression;
};
export function stringLiteralExpr(matchStr: string): StringLiteralExpression {
  return createExpression({
    type: "stringLiteral",
    concat(str) {
      return stringLiteralExpr(matchStr + str);
    },
    getHeads() {
      return [matchStr];
    },
    getMinLength() {
      return matchStr.length;
    },
    _translate: function* (str, state) {
      const newIndex = state.index + matchStr.length;
      if (str.slice(state.index, newIndex) === matchStr) {
        yield {
          state: {
            index: newIndex,
          },
          value: undefined,
        };
      } else {
        throw new Error();
      }
    },
  });
}

export function regexp(
  regexp: RegExp,
  {
    minLength,
  }: {
    minLength: MinLength;
  } = {
    minLength: 0,
  }
) {
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

      if (match && match.index === 0) {
        const value = match[0];
        yield {
          value,
          state: {
            index: state.index + value.length,
          },
        };
      } else {
        throw new Error();
      }
    },
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

export function integer() {
  return regexp(/\d+/, {
    minLength: 1,
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
