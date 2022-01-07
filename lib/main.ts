type ParseState = {
  index: number;
};

type ASTNode = {
  expressionType: symbol;
} & (
  | {
      type: "internal";
      children: ASTNode[];
    }
  | {
      type: "leaf";
      value: string;
    }
);

type ParseResult =
  | {
      type: "success";
      node: ASTNode;
      state: ParseState;
    }
  | {
      type: "error";
    };

const lazyExpressionSymbol = Symbol();
export type Expression = {
  type: symbol;
  [lazyExpressionSymbol]: boolean;
  parse(sentence: string, parseState?: ParseState): ParseResult;
};

const initialParseState: ParseState = {
  index: 0,
};

function isLazyExpression(x: any): boolean {
  return x[lazyExpressionSymbol];
}

const justExpressionType = Symbol();
export function just(str: string): Expression {
  return {
    type: justExpressionType,
    [lazyExpressionSymbol]: false,
    parse(sentence, parseState = initialParseState) {
      let { index } = parseState;

      for (let i = 0, imax = str.length; i < imax; i++, index++) {
        if (sentence[index] !== str[i]) {
          return {
            type: "error",
          };
        }
      }

      return {
        type: "success",
        node: {
          type: "leaf",
          expressionType: justExpressionType,
          value: str,
        },
        state: {
          index,
        },
      };
    },
  };
}

export function seq(
  strings: TemplateStringsArray,
  ...exprs: Expression[]
): Expression {
  const expressions = strings.flatMap((string, i) => {
    const expr = exprs[i];

    return [
      ...(string === "" ? [] : [just(string)]),
      ...(expr === undefined ? [] : [expr]),
    ];
  });

  if (expressions.length !== 0 && isLazyExpression(expressions[0]))
    throw new Error("left recursion is not allowed.");

  const expressionType = Symbol();

  return {
    type: expressionType,
    [lazyExpressionSymbol]: false,
    parse(sentence, parseState = initialParseState) {
      const parseResult = expressions.reduce<ParseResult>(
        (pre, expression) => {
          if (pre.type === "success") {
            const res = expression.parse(sentence, pre.state);
            if (res.type === "success") {
              return {
                type: "success",
                node: {
                  expressionType,
                  type: "internal",
                  children:
                    pre.node.type === "internal"
                      ? pre.node.children.concat(
                          res.node.expressionType === emptyExpressionType ||
                            res.node.expressionType === justExpressionType
                            ? []
                            : res.node.expressionType ===
                                kleeneClojureExpressionType &&
                              res.node.type === "internal"
                            ? res.node.children
                            : [res.node]
                        )
                      : [],
                },
                state: res.state,
              };
            } else {
              return {
                type: "error",
              };
            }
          } else if (pre.type === "error") {
            return pre;
          } else {
            return {} as never;
          }
        },
        {
          type: "success",
          node: {
            expressionType,
            type: "internal",
            children: [],
          },
          state: parseState,
        }
      );

      if (parseResult.type === 'success' && parseResult.node.type === 'internal' && exprs.length === 1) {
        parseResult.node = parseResult.node.children[0];
      }

      return parseResult;
    },
  };
}

const orExpressionType = Symbol();
export function or(...expressions: Expression[]): Expression {
  return {
    type: orExpressionType,
    [lazyExpressionSymbol]: expressions.some(isLazyExpression),
    parse(sentence, parseState = initialParseState) {
      for (const expression of expressions) {
        const res = expression.parse(sentence, parseState);

        if (res.type === "success") {
          return res;
        }
      }

      return {
        type: "error",
      };
    },
  };
}

const kleeneClojureExpressionType = Symbol();
export function kleeneClojure(expression: Expression): Expression {
  return {
    type: kleeneClojureExpressionType,
    [lazyExpressionSymbol]: false,
    parse(sentence, parseState = initialParseState) {
      let state: ParseState = { ...parseState };
      const nodes: ASTNode[] = [];
      while (true) {
        const res = expression.parse(sentence, state);

        if (res.type === "success") {
          nodes.push(res.node);
          state = res.state;
        } else {
          break;
        }
      }

      return {
        type: "success",
        node: {
          type: "internal",
          expressionType: kleeneClojureExpressionType,
          children: nodes,
        },
        state,
      };
    },
  };
}

const emptyExpressionType = Symbol();
export const empty: Expression = {
  type: emptyExpressionType,
  [lazyExpressionSymbol]: false,
  parse(_sentence, parseState = initialParseState) {
    return {
      type: "success",
      node: {
        expressionType: emptyExpressionType,
        type: "leaf",
        value: "",
      },
      state: parseState,
    };
  },
};

const lazyExpressionType = Symbol();
export function lazy(resolveExpression: () => Expression): Expression {
  return {
    type: lazyExpressionType,
    [lazyExpressionSymbol]: true,
    parse(sentence, parseState = initialParseState) {
      const expression = resolveExpression();
      const parseResult = expression.parse(sentence, parseState);

      return parseResult;
    },
  };
}

export function regularExpression(regexp: RegExp): Expression {
  const expressionType = Symbol();
  return {
    type: expressionType,
    [lazyExpressionSymbol]: false,
    parse(sentence, parseState = initialParseState) {
      const start = parseState.index;
      const result = regexp.exec(sentence.slice(start));
      if (result !== null && result.index === 0) {
        const matched = result[0];
        return {
          type: "success",
          state: {
            index: parseState.index + matched.length,
          },
          node: {
            type: "leaf",
            expressionType,
            value: matched,
          },
        };
      } else {
        return {
          type: "error",
        };
      }
    },
  };
}
