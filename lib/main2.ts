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
type CustomExpression = {
  id: number;
  nexts?: Expression[];
  getMinLength(): MinLength;
  getHeads(): Head[];

  _translate(
    str: string,
    state: ParseState,
    context: ParseContext
  ): ParseResult;
};
type SeqExpression = CustomExpression & {
  type: "seq";
};
function isOrExpression(x: any): x is OrExpression {
  return x["type"] === "or" && isCustomExpression(x);
}
type OrExpression = CustomExpression & {
  type: "or";
  a: Expression;
  b: Expression;
};
function isLazyExpression(x: any): x is LazyExpression {
  return x["type"] === "lazy" && isCustomExpression(x);
}
type LazyExpression = CustomExpression & {
  type: "lazy";
};
function isFlatExpression(x: any): x is FlatExpression {
  return x["type"] === "flat" && isCustomExpression(x);
}
type FlatExpression = CustomExpression & {
  type: "flat";
};
function isReduceExpression(x: any): x is ReduceExpression {
  return x["type"] === "reduce" && isCustomExpression(x);
}
type ReduceExpression = CustomExpression & {
  type: "reduce";
};
function isCustomExpression(x: any): x is CustomExpression {
  return typeof x["_translate"] === "function";
}
type Expression =
  | string
  | {
      [prop: string | number | symbol]: Expression;
    }
  | ((str: string) => unknown)
  | RegExp
  | CustomExpression;

function translateExpr(
  str: string,
  expr: Expression,
  state: ParseState = {
    index: 0,
  },
  context: ParseContext = {
    next: undefined,
  }
): ParseResult {
  if (typeof expr === "string") {
    const newIndex = state.index + expr.length;
    if (str.slice(state.index, newIndex) === expr) {
      return {
        state: {
          index: newIndex,
        },
        value: undefined,
      };
    } else {
      throw new Error();
    }
  } else if (expr instanceof RegExp) {
    const matched = expr.exec(str.slice(state.index));

    if (matched === null || matched.index !== 0) {
      throw new Error(
        `Regexp ${expr} does not match string at ${state.index}.`
      );
    }

    const matchedStr = matched[0];

    const newIndex = state.index + matchedStr.length;

    return {
      value: matchedStr,
      state: {
        index: newIndex,
      },
    };
  } else if (typeof expr === "function") {
    return {
      value: expr(str),
      state: {
        index: str.length,
      },
    };
  } else if (isCustomExpression(expr)) {
    return expr._translate(str, state, context);
  } else {
    const firstKey = Object.keys(expr)[0];
    const next = translateExpr(str, expr[firstKey], state, context);

    return {
      value: {
        [firstKey]: next.value,
      },
      state: next.state,
    };
  }
}

export function translate(str: string, expr: Expression) {
  const { value } = translateExpr(str, seq`${expr}${end()}`);

  return value;
}

function getExprInfo(expr: Expression): {
  cacheId: string | number | null;
  minLength: MinLength;
} {
  if (typeof expr === "string") {
    return {
      cacheId: expr,
      minLength: expr.length,
    };
  } else if (isCustomExpression(expr)) {
    return {
      cacheId: expr.id,
      minLength: expr.getMinLength(),
    };
  } else if (expr instanceof RegExp) {
    return {
      cacheId: expr.toString(),
      minLength: 0,
    };
  } else if (typeof expr === "function") {
    return {
      cacheId: null,
      minLength: 0,
    };
  } else {
    return getExprInfo(expr[Object.keys(expr)[0]]);
  }
}

function getMinLength(expr: Expression): MinLength {
  if (typeof expr === "string") {
    return expr.length;
  } else if (isCustomExpression(expr)) {
    return expr.getMinLength();
  } else if (expr instanceof RegExp) {
    return 0;
  } else if (typeof expr === "function") {
    return 0;
  } else {
    return getMinLength(expr[Object.keys(expr)[0]]);
  }
}

function resolveHeads(expr: Expression): Head[] {
  if (typeof expr === "string") {
    return [expr];
  } else if (isCustomExpression(expr)) {
    return expr.getHeads();
  } else if (expr instanceof RegExp) {
    return [expr];
  } else if (typeof expr === "function") {
    return [undefined];
  } else {
    return resolveHeads(expr[Object.keys(expr)[0]]);
  }
}

const cache = new Map<string, ParseResult>();
let ExpressionId = -1;

export function createExpression<T extends CustomExpression>(
  x: Omit<T, "id">
): T {
  return {
    ...x,
    id: ExpressionId++,
    _translate(str, state, context): ParseResult {
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
            : getExprInfo(next);

        const cacheKey =
          cacheId === null ? null : `${this.id}-${state.index}-${cacheId}`;
        const cached = cacheKey === null ? null : cache.get(cacheKey);

        if (cached) {
          return cached;
        } else {
          if (minLength !== 0 && state.index + minLength > str.length)
            throw new Error();

          try {
            const result = x._translate(str, state, { next });
            if (cacheKey !== null) {
              cache.set(cacheKey, result);
            }
            return result;
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
  strings: TemplateStringsArray,
  placeholders: Expression[]
) {
  const exprs: Expression[] = [];
  let i = 0,
    lastIsString = false;

  while (i < strings.length) {
    const string = strings[i];
    if (string !== "") {
      if (lastIsString) {
        exprs[exprs.length - 1] += string;
      } else {
        exprs.push(string);
      }
      lastIsString = typeof string === "string";
    }
    const placeholder = placeholders[i];
    const placeholderIsString = typeof placeholder === "string";
    if (lastIsString && placeholderIsString) {
      exprs[exprs.length - 1] += placeholder;
    } else {
      if (isCustomExpression(placeholder)) {
        const nextString = strings[i + 1];
        const nextPlaceholder = placeholders[i + 1];
        placeholder.nexts =
          nextString !== ""
            ? [nextString]
            : nextPlaceholder === undefined
            ? undefined
            : isOrExpression(nextPlaceholder)
            ? [nextPlaceholder.a, nextPlaceholder.b]
            : [nextPlaceholder];
      }
      exprs.push(placeholder);
    }
    lastIsString = placeholderIsString;

    i = (i + 1) | 0;
  }

  if (lastIsString) {
    exprs[exprs.length - 1] += strings[i];
  } else {
    exprs.push(strings[i]);
  }

  return exprs;
}

export function seq(
  strings: TemplateStringsArray,
  ...placeholders: Expression[]
): SeqExpression {
  const exprs = normalizeSeqExpr(strings, placeholders);

  return createExpression({
    type: "seq",
    getHeads() {
      let i = 1,
        heads = resolveHeads(exprs[0]);
      while (i < exprs.length) {
        const expr = exprs[i];
        const nextStringHeads = resolveHeads(expr).flatMap((x) =>
          typeof x === "string" ? [x] : []
        );
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

        minLength = (minLength + getMinLength(expr)) | 0;

        i = (i + 1) | 0;
      }

      return minLength;
    },
    _translate(str, state, context) {
      let i = 1,
        value = [] as unknown[],
        newState = state;
      while (i < exprs.length) {
        const expr = exprs[i];

        const res = translateExpr(str, expr, newState, context);

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

        i = (i + 1) | 0;
      }

      return {
        value,
        state: newState,
      };
    },
  });
}

export function or(a: Expression, b: Expression): OrExpression {
  return createExpression({
    type: "or",
    a,
    b,
    getHeads() {
      return [...resolveHeads(a), ...resolveHeads(b)];
    },
    getMinLength() {
      return Math.min(getMinLength(a), getMinLength(b));
    },
    _translate(str, state, context) {
      try {
        return translateExpr(str, a, state, context);
      } catch (error) {
        return translateExpr(str, b, state, context);
      }
    },
  });
}

export function lazy(resolver: () => Expression): LazyExpression {
  return createExpression({
    type: "lazy",
    getHeads() {
      return resolveHeads(resolver());
    },
    getMinLength() {
      return getMinLength(resolver());
    },
    _translate(str, state, context) {
      return translateExpr(str, resolver(), state, context);
    },
  });
}

export function flat(expr: Expression): FlatExpression {
  return createExpression({
    type: "flat",
    getHeads() {
      return resolveHeads(expr);
    },
    getMinLength() {
      return getMinLength(expr);
    },
    _translate(str, state, context) {
      return translateExpr(str, expr, state, context);
    },
  });
}

export function reduce(expr: Expression): ReduceExpression {
  return createExpression({
    type: "reduce",
    getHeads() {
      return resolveHeads(expr);
    },
    getMinLength() {
      return getMinLength(expr);
    },
    _translate(str, state, context) {
      if (isCustomExpression(expr)) {
        const { state: newState, value } = expr._translate(str, state, context);

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

          return {
            value: newValue,
            state: newState,
          };
        }
      }

      return translateExpr(str, expr, state, context);
    },
  });
}

export function repeat(expr: Expression): Expression {
  return flat(
    seq`${flat(expr)}${flat(
      or(
        lazy(() => repeat(expr)),
        empty([])
      )
    )}`
  );
}

export function empty<T>(value: T): CustomExpression {
  return createExpression({
    getMinLength() {
      return 0;
    },
    getHeads() {
      return [undefined];
    },
    _translate(_str, state) {
      return {
        state,
        value,
      };
    },
  });
}

export function end(): Expression {
  return createExpression({
    getHeads() {
      return [undefined];
    },
    getMinLength() {
      return 0;
    },
    _translate(str, state) {
      if (str.length === state.index) {
        return {
          value: undefined,
          state,
        };
      }

      throw new Error();
    },
  });
}

export function any(expr?: Expression): Expression {
  return createExpression({
    getHeads() {
      return [undefined];
    },
    getMinLength() {
      return 0;
    },
    _translate(str, state, context) {
      function handleValue(value: string) {
        return expr
          ? translateExpr(value, expr, { index: 0 })
          : {
              state: {
                index: state.index + value.length,
              },
              value,
            };
      }

      const heads =
        context.next === undefined ? [undefined] : resolveHeads(context.next);

      let i = 1,
        error: unknown;
      while (i < heads.length) {
        const head = heads[i];

        if (head instanceof RegExp) {
          head.lastIndex = state.index;
          const match = head.exec(str);
          if (match && match.index === 0) {
            const value = match[0];

            return handleValue(value);
          } else {
            error = new Error();
          }
        } else if (head) {
          const value = str.slice(state.index, head.length);
          if (value !== head) {
            return handleValue(value);
          } else {
            error = new Error();
          }
        } else {
          return handleValue(str.slice(state.index));
        }

        i = (i + 1) | 0;
      }

      throw error;
    },
  });
}

// exists
export function exists(target: string): Expression {
  return createExpression({
    getHeads() {
      return [target];
    },
    getMinLength() {
      return target.length;
    },
    _translate(str, state) {
      const sliced = str.slice(state.index, state.index + target.length);

      if (sliced === target) {
        return {
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

export function regexp(
  regexp: RegExp,
  {
    minLength,
  }: {
    minLength: MinLength;
  } = {
    minLength: 0,
  }
): Expression {
  return createExpression({
    getHeads() {
      return [regexp];
    },
    getMinLength() {
      return minLength;
    },
    _translate(str, state) {
      regexp.lastIndex = state.index;
      const match = regexp.exec(str);

      if (match && match.index === 0) {
        const value = match[0];
        return {
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

export function integer(): Expression {
  return regexp(/\d+/, {
    minLength: 1,
  });
}

export function split(delimiter: string, expr?: Expression) {
  return flat(
    any(
      seq`${any(expr)}${flat(
        or(repeat(seq`${delimiter}${any(expr)}`), empty([]))
      )}`
    )
  );
}
