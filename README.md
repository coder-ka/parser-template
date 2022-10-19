# Parser Template

Parser Template is a parser generator in JavaScript.

# Installation

```bash
npm install @coder-ka/parser-template
```

# Example

Creating an IPAddressV4 parser.

```ts
import { integer, seq } from "../lib/main";

const segment = integer();

const ipV4 = seq`${segment}.${segment}.${segment}.${segment}`;

const { value } = translate("192.168.1.1", ipV4);

// ["192","168","1","1"]
console.log(value);
```

A more complex example parsing markdown unordered list is [here](https://github.com/coder-ka/parser-template/blob/main/tests/md-ul.test.ts).

# Structural Expressions

- seq
- flat
- reduce
- object

# Control Expressions

- lazy
- or

# Built-in Primitive Expressions

- string
- regexp
- function(str: string): unknown
- empty
- end
- any
- exists
- integer

# Utility Expressions

- repeat(at least 1)
- split(delimiter, splitItemExpr)
