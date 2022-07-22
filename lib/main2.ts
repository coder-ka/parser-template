type Expression = {
  translate(sent: string): any;
};

export function seq(
  strings: TemplateStringsArray,
  ...exprs: Expression[]
): Expression {
  return {
    translate(sent) {},
  };
}

export function range<T extends number>(from: T, to: T): Expression {
  return {
    translate(sent) {
      return;
    },
  };
}
