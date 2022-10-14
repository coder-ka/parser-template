export type Expression =
  | string
  | RegExp
  | ((str: string) => unknown)
  | SeqExpression
  | OrExpression
  | LazyExpression
  | FlatExpression
  | ReduceExpression
  | PrimitiveExpression
  | {
      [p: string]: Expression;
    };

type Head = string | undefined;
type HasHead = {
  head: Head;
};

function isHasHead(x: any): x is HasHead {
  return (
    isSeqExpression(x) || isFlattendExpression(x) || isReducedExpression(x)
  );
}
function getHead(x: Expression): Head {
  if (isHasHead(x)) return x.head;
  if (typeof x === "string") return x;

  return undefined;
}

const seqExpr = Symbol();
export type SeqExpression = {
  [seqExpr]: true;
  exprs: Expression[];
} & HasHead;
function isSeqExpression(x: any): x is SeqExpression {
  return x[seqExpr];
}
export function seq(
  strings: TemplateStringsArray,
  ...exprs: Expression[]
): SeqExpression {
  const arr = [
    strings[0],
    ...Array(exprs.length)
      .fill(null)
      .flatMap((_, i) => [exprs[i], strings[i + 1]]),
  ].reduce((res, item) => {
    if (item === "") return res;

    if (res.length) {
      const last = res[res.length - 1];
      if (typeof last === "string" && typeof item === "string") {
        res[res.length - 1] = last + item;
        return res;
      }
    }

    res.push(item);

    return res;
  }, [] as Expression[]);

  const first = arr[0];
  const second = arr[1];

  return {
    head: typeof first === "string" ? first + getHead(second) : getHead(first),
    [seqExpr]: true,
    exprs: arr,
  };
}

const flatExpr = Symbol();
export type FlatExpression = {
  [flatExpr]: true;
  expr: Expression;
} & HasHead;
function isFlattendExpression(x: any): x is FlatExpression {
  return x[flatExpr];
}
export function flat(expr: Expression): FlatExpression {
  return {
    [flatExpr]: true,
    head: getHead(expr),
    expr,
  };
}

const reduceExpr = Symbol();
export type ReduceExpression = {
  [reduceExpr]: true;
  expr: Expression;
} & HasHead;
function isReducedExpression(x: any): x is ReduceExpression {
  return x[reduceExpr];
}
export function reduce(expr: Expression): ReduceExpression {
  return {
    [reduceExpr]: true,
    head: getHead(expr),
    expr,
  };
}

const lazyExpr = Symbol();
export type LazyExpression = {
  [lazyExpr]: true;
  resolveExpr: () => Expression;
};
function isLazyExpression(x: any): x is LazyExpression {
  return x[lazyExpr];
}
export function lazy(resolveExpr: () => Expression): LazyExpression {
  return {
    [lazyExpr]: true,
    resolveExpr,
  };
}

const orExpr = Symbol();
export type OrExpression = {
  [orExpr]: true;
  e1: Expression;
  e2: Expression;
};
function isOrExpression(x: any): x is OrExpression {
  return x[orExpr];
}
export function or(e1: Expression, e2: Expression): OrExpression {
  return {
    [orExpr]: true,
    e1,
    e2,
  };
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

export function primitive(
  p: Pick<
    PrimitiveExpression,
    Exclude<keyof PrimitiveExpression, typeof primitiveExpr>
  >
): PrimitiveExpression {
  return {
    [primitiveExpr]: true,
    ...p,
  };
}
function isPrimitiveExpression(x: any): x is PrimitiveExpression {
  return x[primitiveExpr];
}
const primitiveExpr = Symbol();
type ParseContext = {
  next?: string;
};
export type PrimitiveExpression = {
  [primitiveExpr]: true;
  __name: string; // for debug
  parse(
    str: string,
    index?: number,
    options?: ParseContext
  ): {
    value: unknown;
    index: number;
  };
};

export function empty<T>(value: T): PrimitiveExpression {
  return {
    [primitiveExpr]: true,
    __name: "empty",
    parse(_str, index = 0) {
      return {
        index,
        value,
      };
    },
  };
}

export function end<T>(value: T): PrimitiveExpression {
  return {
    [primitiveExpr]: true,
    __name: "end",
    parse(str, index = 0) {
      if (str.length === index) {
        return {
          index,
          value,
        };
      } else throw new Error(`string does not end at ${index}`);
    },
  };
}

export function any(childExpr?: Expression): PrimitiveExpression {
  return {
    [primitiveExpr]: true,
    __name: "any",
    parse(str, index?, options?) {
      function read() {
        const next = options?.next;

        if (next) {
          const found = str.indexOf(next, index);

          if (found === -1) {
            return {
              index: str.length,
              value: str.slice(index),
            };
          } else {
            return {
              index: found,
              value: str.slice(index, found),
            };
          }
        } else {
          return {
            index: str.length,
            value: str.slice(index),
          };
        }
      }

      const { index: newIndex, value } = read();

      return {
        index: newIndex,
        value: childExpr ? translate(value, childExpr).value : value,
      };
    },
  };
}

export function integer(): PrimitiveExpression {
  return {
    [primitiveExpr]: true,
    __name: "integer",
    parse(str, index = 0) {
      let value = "";
      while (true) {
        const code = str.charCodeAt(index);

        if (code >= 48 && code <= 57) {
          value += str[index];

          index++;
        } else break;
      }

      return {
        index,
        value,
      };
    },
  };
}

type TranslationResult = {
  value: unknown;
  index: number;
};

export function translate(str: string, expr: Expression): TranslationResult {
  function translateExpr(
    expr: Expression,
    index = 0,
    context: ParseContext = {}
  ): TranslationResult {
    if (typeof expr === "string") {
      for (let i = 0; i < expr.length; i++) {
        if (str[index] !== expr[i]) {
          throw new Error(
            `'${str[index]}' at ${index} does not match string '${expr}'`
          );
        }

        index++;
      }

      return {
        value: undefined,
        index,
      };
    } else if (expr instanceof RegExp) {
      const matched = expr.exec(str.slice(index));

      if (matched === null || matched.index !== 0) {
        throw new Error(`Regexp ${expr} does not match string at ${index}.`);
      }

      const matchedStr = matched[0];

      return {
        value: matchedStr,
        index: index + matchedStr.length,
      };
    } else if (typeof expr === "function") {
      return {
        value: expr(str.slice(index)),
        index: str.length,
      };
    } else if (isSeqExpression(expr)) {
      const value = expr.exprs.reduce((res, expr, i, arr) => {
        const nextExpr = arr[i + 1];
        const next = nextExpr === undefined ? context.next : getHead(nextExpr);

        if (typeof expr === "string") {
          const { index: newIndex } = translateExpr(expr, index, {
            next,
          });

          index = newIndex;

          return res;
        } else if (isFlattendExpression(expr)) {
          const { value, index: newIndex } = translateExpr(expr, index, {
            next,
          });

          index = newIndex;

          if (Array.isArray(value)) {
            res = res.concat(value);
          } else {
            res.push(value);
          }

          return res;
        } else if (expr instanceof RegExp) {
          const { value, index: newIndex } = translateExpr(expr, index, {
            next,
          });

          index = newIndex;

          res.push(value);

          return res;
        } else {
          const { value, index: newIndex } = translateExpr(expr, index, {
            next,
          });

          const objectFound = res.findIndex(
            (x) => typeof x === "object" && x !== null
          );

          if (objectFound !== -1) {
            res[objectFound] = {
              ...res[objectFound],
              ...(value as object),
            };
          } else {
            res.push(value);
          }

          index = newIndex;

          return res;
        }
      }, [] as any[]);

      return {
        value,
        index,
      };
    } else if (isOrExpression(expr)) {
      try {
        return translateExpr(expr.e1, index, context);
      } catch (error) {
        return translateExpr(expr.e2, index, context);
      }
    } else if (isLazyExpression(expr)) {
      return translateExpr(expr.resolveExpr(), index, context);
    } else if (isFlattendExpression(expr)) {
      return translateExpr(expr.expr, index, context);
    } else if (isReducedExpression(expr)) {
      const { index: newIndex, value } = translateExpr(
        expr.expr,
        index,
        context
      );

      return {
        value: Array.isArray(value)
          ? value.reduce((res, item) => {
              const objectFound = res.findIndex(
                (x: any) => typeof x === "object" && x !== null
              );

              if (objectFound !== -1) {
                res[objectFound] = {
                  ...res[objectFound],
                  ...(item as object),
                };
              } else {
                res.push(item);
              }

              return res;
            }, [] as any[])[0]
          : value,
        index: newIndex,
      };
    } else if (isPrimitiveExpression(expr)) {
      const { index: newIndex, value } = expr.parse(str, index, context);
      return {
        value,
        index: newIndex,
      };
    } else {
      // object
      const key = Object.keys(expr)[0];
      const first = expr[key];
      const { value, index: newIndex } = translateExpr(first, index, context);

      index = newIndex;

      return {
        value: {
          [key]: value,
        },
        index,
      };
    }
  }

  const { index, value } = translateExpr(expr);

  if (index !== str.length)
    throw new Error(
      `string length does not match.expected: ${str.length}.actual: ${index}.`
    );

  return {
    index,
    value,
  };
}

export function debug<T>(x: T): T {
  console.log("debug: ", x);
  return x;
}
