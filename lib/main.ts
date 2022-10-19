const debugSym = Symbol();
type ExpresisonDebugger = {};
export function withDebug<TExpression extends Expression>(
  expr: TExpression,
  exprDebugger: ExpresisonDebugger = {}
) {
  expr[debugSym] = exprDebugger;

  return expr;
}

export type Expression = (
  | string
  | RegExp
  | ((str: string) => unknown)
  | PrimitiveExpression
  | SeqExpression
  | OrExpression
  | LazyExpression
  | FlatExpression
  | ReduceExpression
  | ObjectExpression
) & {
  [debugSym]?: ExpresisonDebugger;
};
// TODO
// | IgnoreExpression;

type Head = string | undefined;
type CanGetHeads = {
  getHeads: (index: number) => Head[];
};

function isCanGetHeads(x: any): x is CanGetHeads {
  return (
    isSeqExpression(x) ||
    isFlattendExpression(x) ||
    isReducedExpression(x) ||
    isLazyExpression(x) ||
    isOrExpression(x)
  );
}
function resolveHeads(x: Expression | undefined, index: number): Head[] {
  if (x === undefined) return [undefined];
  if (isCanGetHeads(x)) return x.getHeads(index);
  if (typeof x === "string") return [x];
  if (isObjectExpression(x)) {
    return resolveHeads((x as any)[Object.keys(x)[0]], index);
  }

  return [undefined];
}

type ObjectExpression = {
  [p: string]: Expression;
};
function isObjectExpression(x: any): x is ObjectExpression {
  return (
    x !== null &&
    typeof x === "object" &&
    !isSeqExpression(x) &&
    !isFlattendExpression(x) &&
    !isReducedExpression(x) &&
    !isLazyExpression(x) &&
    !isOrExpression(x) &&
    !isPrimitiveExpression(x)
  );
}

const seqExpr = Symbol();
export type SeqExpression = {
  [seqExpr]: true;
  exprs: Expression[];
} & CanGetHeads;
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
    getHeads(index) {
      return typeof first === "string"
        ? [first as Head].concat(resolveHeads(second, index))
        : resolveHeads(first, index);
    },
    [seqExpr]: true,
    exprs: arr,
  };
}

const flatExpr = Symbol();
export type FlatExpression = {
  [flatExpr]: true;
  expr: Expression;
} & CanGetHeads;
function isFlattendExpression(x: any): x is FlatExpression {
  return x[flatExpr];
}
export function flat(expr: Expression): FlatExpression {
  return {
    [flatExpr]: true,
    getHeads(index) {
      return resolveHeads(expr, index);
    },
    expr,
  };
}

const reduceExpr = Symbol();
export type ReduceExpression = {
  [reduceExpr]: true;
  expr: Expression;
} & CanGetHeads;
function isReducedExpression(x: any): x is ReduceExpression {
  return x[reduceExpr];
}
export function reduce(expr: Expression): ReduceExpression {
  return {
    [reduceExpr]: true,
    getHeads(index) {
      return resolveHeads(expr, index);
    },
    expr,
  };
}

const lazyExpr = Symbol();
export type LazyExpression = {
  [lazyExpr]: true;
  resolveExpr: () => Expression;
} & CanGetHeads;
function isLazyExpression(x: any): x is LazyExpression {
  return x[lazyExpr];
}
export function lazy(resolveExpr: () => Expression): LazyExpression {
  return {
    [lazyExpr]: true,
    getHeads(index) {
      return resolveHeads(resolveExpr(), index);
    },
    resolveExpr,
  };
}

const orExpr = Symbol();
export type OrExpression = {
  [orExpr]: true;
  e1: Expression;
  e2: Expression;
} & CanGetHeads;
function isOrExpression(x: any): x is OrExpression {
  return x[orExpr];
}
export function or(e1: Expression, e2: Expression): OrExpression {
  return {
    [orExpr]: true,
    getHeads(index) {
      return resolveHeads(e1, index).concat(resolveHeads(e2, index));
    },
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

export function split(delimiter: string, expr?: Expression) {
  return seq`${any(expr)}${flat(repeat(seq`${delimiter}${any(expr)}`))}`;
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
  next?: Head;
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
    if (expr[debugSym]) {
      console.log("index", index);
      console.log("context", context);
    }

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

        function getNexts(): Head[] {
          if (nextExpr === undefined) {
            return [context.next];
          } else {
            return resolveHeads(nextExpr, index);
          }
        }

        getNexts().some((next, j, nexts) => {
          try {
            if (typeof expr === "string") {
              const { index: newIndex } = translateExpr(expr, index, {
                next,
              });

              index = newIndex;
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
            } else if (expr instanceof RegExp) {
              const { value, index: newIndex } = translateExpr(expr, index, {
                next,
              });

              index = newIndex;

              res.push(value);
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
            }

            return true;
          } catch (error) {
            if (j === nexts.length - 1) {
              throw error;
            } else {
              return false;
            }
          }
        });

        return res;
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
      try {
        const { index: newIndex, value } = expr.parse(str, index, context);
        return {
          value,
          index: newIndex,
        };
      } catch (error) {
        throw error;
      }
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
