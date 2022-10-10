export type Expression<T> =
  | string
  | SeqExpression<T>
  | OrExpression<T>
  | LazyExpression<T>
  | FlatExpression<T>
  | PrimitiveExpression<T>;

const seqExpr = Symbol();
export type SeqExpression<T> = {
  [seqExpr]: true;
  head: string;
  exprs: Expression<T>[];
};
function isSeqExpression(x: any): x is SeqExpression<T> {
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
      .flatMap((_, i) => [strings[i + 1], exprs[i]]),
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
  }, [] as (string | Expression | LazyExpression | FlatExpression | OrExpression)[]);

  return {
    [seqExpr]: true,
    head: arr.reduce<string>((head, item) => {
      return (
        head +
        (typeof item === "string"
          ? item
          : isSeqExpression(item)
          ? item.head
          : "")
      );
    }, ""),
    exprs: arr,
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
export function or<T1, T2>(
  e1: Expression<T1>,
  e2: Expression<T2>
): OrExpression<T1 | T2> {
  return {
    [orExpr]: true,
    e1,
    e2,
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

export function primitive<T>(
  p: Pick<
    PrimitiveExpression<T>,
    Exclude<keyof PrimitiveExpression<T>, typeof primitiveExpr>
  >
): PrimitiveExpression<T> {
  return {
    [primitiveExpr]: true,
    ...p,
  };
}

const primitiveExpr = Symbol();
export type PrimitiveExpression<T> = {
  [primitiveExpr]: true;
  parse(
    str: string,
    index?: number,
    options?: {
      next?: string;
    }
  ): {
    value: T;
    index: number;
  };
};

export function empty<T>(value: T): PrimitiveExpression<T> {
  return {
    [primitiveExpr]: true,
    parse(str, index = 0) {
      if (str.length === index) {
        return {
          index,
          value,
        };
      } else throw new Error();
    },
  };
}

export function any(): PrimitiveExpression<string> {
  return {
    [primitiveExpr]: true,
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

export function range(from: number, to: number): PrimitiveExpression<number> {
  return {
    [primitiveExpr]: true,
    parse(str, index = 0) {
      let result = "";
      while (true) {
        const code = str.charCodeAt(index);

        if (code >= 48 && code <= 57) {
          result += str[index];

          index++;
        } else break;
      }

      const value = Number(result);

      if (value < from || value > to) {
        throw new Error(`${value} is not between ${from} and ${to}.`);
      }

      return {
        index,
        value,
      };
    },
  };
}

type ValueOfPrimitive<T> = T extends PrimitiveExpression<infer R> ? R : never;

type ValueOf<TExpression extends Expression> = TExpression extends SeqExpression
  ? ValueOf<TExpression["exprs"][number]>[]
  : never;

export function translate<TExpression extends Expression>(
  str: string,
  expr: TExpression,
  index?: number
): {
  value: ValueOf<TExpression>;
  index: number;
} {
  return {};
}

// return {
//   translate(str, index?, options?) {
//     let result: T[] = [];
//     let currentIndex = (index === undefined ? 0 : index) + strings[0].length;
//     for (let i = 0; i < exprs.length; i++) {
//       const expr = exprs[i];
//       const literalstr = strings[i + 1];

//       function _translate() {
//         if (typeof expr === "string") {
//           return {
//             values: [],
//             index: currentIndex + expr.length,
//           };
//         } else if (isFlattendExpression(expr)) {
//           const { index: newIndex, value } = (
//             isLazyExpression(expr.expr) ? expr.expr() : expr.expr
//           ).translate(str, currentIndex, {
//             ...options,
//             next: literalstr,
//           });

//           return {
//             values: value,
//             newIndex,
//           };
//         } else {
//           const { index: newIndex, value } = (
//             isLazyExpression(expr) ? expr() : expr
//           ).translate(str, currentIndex, {
//             ...options,
//             next: literalstr,
//           });

//           return {
//             values: [value],
//             newIndex,
//           };
//         }
//       }

//       const { values, newIndex } = _translate();

//       currentIndex = newIndex + literalstr.length;

//       result = result.concat(values);
//     }

//     if (currentIndex !== str.length) throw new Error();

//     return {
//       value: result,
//       index: currentIndex,
//     };
//   },
// };
