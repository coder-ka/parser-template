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

const emptyHead = Symbol();
type Head = string | undefined | typeof emptyHead;
type CanGetHeads = {
  getHeads: (index: number) => Head[];
};

function isCanGetHeads(x: any): x is CanGetHeads {
  return (
    isSeqExpression(x) ||
    isFlattendExpression(x) ||
    isReducedExpression(x) ||
    isLazyExpression(x) ||
    isOrExpression(x) ||
    isPrimitiveExpression(x)
  );
}

type CanDetectOptional = {
  isOptionalExpr: () => boolean;
};

function isCanDetectOptional(x: any): x is CanDetectOptional {
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
} & CanGetHeads &
  CanDetectOptional;
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
    isOptionalExpr() {
      return (
        arr.length === 1 &&
        isCanDetectOptional(arr[0]) &&
        arr[0].isOptionalExpr()
      );
    },
    [seqExpr]: true,
    exprs: arr,
  };
}

const flatExpr = Symbol();
export type FlatExpression = {
  [flatExpr]: true;
  expr: Expression;
} & CanGetHeads &
  CanDetectOptional;
function isFlattendExpression(x: any): x is FlatExpression {
  return x[flatExpr];
}
export function flat(expr: Expression): FlatExpression {
  return {
    [flatExpr]: true,
    getHeads(index) {
      return resolveHeads(expr, index);
    },
    isOptionalExpr() {
      return isCanDetectOptional(expr) && expr.isOptionalExpr();
    },
    expr,
  };
}

const reduceExpr = Symbol();
export type ReduceExpression = {
  [reduceExpr]: true;
  expr: Expression;
} & CanGetHeads &
  CanDetectOptional;
function isReducedExpression(x: any): x is ReduceExpression {
  return x[reduceExpr];
}
export function reduce(expr: Expression): ReduceExpression {
  return {
    [reduceExpr]: true,
    getHeads(index) {
      return resolveHeads(expr, index);
    },
    isOptionalExpr() {
      return isCanDetectOptional(expr) && expr.isOptionalExpr();
    },
    expr,
  };
}

const lazyExpr = Symbol();
export type LazyExpression = {
  [lazyExpr]: true;
  resolveExpr: () => Expression;
} & CanGetHeads &
  CanDetectOptional;
function isLazyExpression(x: any): x is LazyExpression {
  return x[lazyExpr];
}
export function lazy(resolveExpr: () => Expression): LazyExpression {
  return {
    [lazyExpr]: true,
    getHeads(index) {
      return resolveHeads(resolveExpr(), index);
    },
    isOptionalExpr() {
      const expr = resolveExpr();
      return isCanDetectOptional(expr) && expr.isOptionalExpr();
    },
    resolveExpr,
  };
}

const orExpr = Symbol();
export type OrExpression = {
  [orExpr]: true;
  e1: Expression;
  e2: Expression;
} & CanGetHeads &
  CanDetectOptional;
function isOrExpression(x: any): x is OrExpression {
  return x[orExpr];
}
export function or(e1: Expression, e2: Expression): OrExpression {
  return {
    [orExpr]: true,
    isOptionalExpr: () =>
      isEmptyExpr(e2) ||
      (isCanDetectOptional(e1) && e1.isOptionalExpr()) ||
      (isCanDetectOptional(e2) && e2.isOptionalExpr()),
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
  return flat(
    any(
      seq`${any(expr)}${flat(
        or(repeat(seq`${delimiter}${any(expr)}`), empty([]))
      )}`
    )
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
  next?: Head;
};
const emptyExpr = Symbol();
function isEmptyExpr(x: any) {
  return !!x[emptyExpr];
}
export type PrimitiveExpression = {
  [emptyExpr]?: boolean;
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
} & CanGetHeads;

export function empty<T>(value: T): PrimitiveExpression {
  return {
    [emptyExpr]: true,
    [primitiveExpr]: true,
    __name: "empty",
    getHeads() {
      return [emptyHead];
    },
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
    getHeads() {
      return [undefined];
    },
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
    getHeads() {
      return [undefined];
    },
    parse(str, index?, options?) {
      function read() {
        const next = options?.next;

        if (next !== emptyHead && next) {
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

export function exists(target: string): PrimitiveExpression {
  return {
    [primitiveExpr]: true,
    __name: "exists",
    getHeads() {
      return [target];
    },
    parse(str, index = 0) {
      for (let i = 0, imax = target.length; i < imax; i++) {
        const char = target[i];
        if (str[index + i] !== char) {
          throw new Error(`${target} not exists at ${index}.`);
        }
      }

      return {
        index: index + target.length,
        value: true,
      };
    },
  };
}

export function integer(): PrimitiveExpression {
  return {
    [primitiveExpr]: true,
    __name: "integer",
    getHeads() {
      return [undefined];
    },
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
        function getNexts(nextIndex: number): Head[] {
          if (nextIndex >= arr.length) {
            return [context.next];
          } else {
            const nextExpr = arr[nextIndex];
            return resolveHeads(nextExpr, index).flatMap((head) =>
              head === emptyHead ? getNexts(nextIndex + 1) : [head]
            );
          }
        }

        const results = getNexts(i + 1).map((next) => {
          try {
            if (typeof expr === "string") {
              const { index: newIndex } = translateExpr(expr, index, {
                next,
              });

              return {
                type: "success" as const,
                newIndex,
                applyValue() {},
              };
            } else if (isFlattendExpression(expr)) {
              const { value, index: newIndex } = translateExpr(expr, index, {
                next,
              });

              return {
                type: "success" as const,
                newIndex,
                applyValue() {
                  if (Array.isArray(value)) {
                    res = res.concat(value);
                  } else {
                    res.push(value);
                  }
                },
              };
            } else if (expr instanceof RegExp) {
              const { value, index: newIndex } = translateExpr(expr, index, {
                next,
              });

              return {
                type: "success" as const,
                newIndex,
                applyValue() {
                  res.push(value);
                },
              };
            } else {
              const { value, index: newIndex } = translateExpr(expr, index, {
                next,
              });

              return {
                type: "success" as const,
                newIndex,
                applyValue() {
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
                },
              };
            }
          } catch (error) {
            return {
              type: "error" as const,
              error,
            };
          }
        });

        if (results.length === 0) {
          throw new Error("no results error");
        } else {
          const res = results.reduce((res, x) => {
            if (
              x.newIndex !== undefined &&
              x.newIndex < (res?.newIndex || Infinity)
            ) {
              return x;
            } else {
              return res;
            }
          }, null as typeof results[0] | null);

          if (res === null) {
            throw results[0].error;
          } else {
            if (res.newIndex !== undefined && res.applyValue !== undefined) {
              index = res.newIndex;
              res.applyValue && res.applyValue();
            }
          }
        }

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
