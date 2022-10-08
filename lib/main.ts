export type Expression<T> = {
  translate(
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

export function range(from: number, to: number): Expression<number> {
  return {
    translate(str, index = 0) {
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

export function seq<T>(
  strings: TemplateStringsArray,
  ...exprs: Expression<T>[]
): Expression<T[]> {
  return {
    translate(str, index) {
      const result = [];
      let currentIndex = (index === undefined ? 0 : index) + strings[0].length;
      for (let i = 0; i < exprs.length; i++) {
        const expr = exprs[i];
        const literalstr = strings[i + 1];

        const { index: newIndex, value } = expr.translate(str, currentIndex, {
          next: literalstr,
        });

        currentIndex = newIndex + literalstr.length;

        result.push(value);
      }

      if (currentIndex !== str.length) throw new Error();

      return {
        value: result,
        index: currentIndex,
      };
    },
  };
}
