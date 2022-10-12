export type Expression =
  | string
  | SeqExpression
  | OrExpression
  | LazyExpression
  | FlatExpression
  | ReduceExpression
  | PrimitiveExpression
  | {
      [p: string]: Expression;
    };

const seqExpr = Symbol();
export type SeqExpression = {
  [seqExpr]: true;
  exprs: Expression[];
};
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

  return {
    [seqExpr]: true,
    exprs: arr,
  };
}

const flatExpr = Symbol();
export type FlatExpression = {
  [flatExpr]: true;
  expr: Expression;
};
function isFlattendExpression(x: any): x is FlatExpression {
  return x[flatExpr];
}
export function flat(expr: Expression): FlatExpression {
  return {
    [flatExpr]: true,
    expr,
  };
}

const reduceExpr = Symbol();
export type ReduceExpression = {
  [reduceExpr]: true;
  expr: Expression;
};
function isReducedExpression(x: any): x is ReduceExpression {
  return x[reduceExpr];
}
export function reduce(expr: Expression): ReduceExpression {
  return {
    [reduceExpr]: true,
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
type ParseOptions = {
  next?: string;
};
export type PrimitiveExpression = {
  [primitiveExpr]: true;
  __name: string; // for debug
  parse(
    str: string,
    index?: number,
    options?: ParseOptions
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

export function any(): PrimitiveExpression {
  return {
    [primitiveExpr]: true,
    __name: "any",
    parse(str, index?, options?) {
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
    options: ParseOptions = {}
  ): TranslationResult {
    if (typeof expr === "string") {
      for (let i = 0; i < expr.length; i++) {
        if (str[index] !== expr[i]) {
          throw new Error(
            `'${str[index]}' at ${index} does not match expression '${expr}'`
          );
        }

        index++;
      }

      return {
        value: undefined,
        index,
      };
    } else if (isSeqExpression(expr)) {
      const value = expr.exprs.reduce((res, expr, i, arr) => {
        const next = arr[i + 1];
        if (typeof next === "string") {
          options.next = next;
        }

        if (typeof expr === "string") {
          const { index: newIndex } = translateExpr(expr, index, options);

          index = newIndex;

          return res;
        } else if (isFlattendExpression(expr)) {
          const { value, index: newIndex } = translateExpr(
            expr,
            index,
            options
          );

          index = newIndex;

          if (Array.isArray(value)) {
            res = res.concat(value);
          } else {
            res.push(value);
          }

          return res;
        } else {
          const { value, index: newIndex } = translateExpr(
            expr,
            index,
            options
          );

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
        return translateExpr(expr.e1, index, options);
      } catch (error) {
        return translateExpr(expr.e2, index, options);
      }
    } else if (isLazyExpression(expr)) {
      return translateExpr(expr.resolveExpr(), index, options);
    } else if (isFlattendExpression(expr) || isReducedExpression(expr)) {
      return translateExpr(expr.expr, index, options);
    } else if (isPrimitiveExpression(expr)) {
      const { index: newIndex, value } = expr.parse(str, index, options);
      return {
        value,
        index: newIndex,
      };
    } else {
      // object
      const value = Object.keys(expr).reduce((res, key) => {
        const { value, index: newIndex } = translateExpr(
          expr[key],
          index,
          options
        );

        if (isReducedExpression(expr[key]) && Array.isArray(value)) {
          res[key] = value.reduce((res, item) => {
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
          }, [] as any[])[0];
        } else {
          res[key] = value;
        }

        index = newIndex;

        return res;
      }, {} as Record<keyof typeof expr, TranslationResult["value"]>);

      return {
        value,
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
