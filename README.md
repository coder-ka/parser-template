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

const { value } = ipV4.translate("192.168.1.1");

// ["192","168","1","1"]
console.log(value);
```

A more complex example parsing markdown unordered list is [here](./tests/md-ul.test.ts).

# Structural Expressions

- seq
- flat
- object

# Control Expressions

- lazy
- or
- repeat(at least 1)

# Built-in Primitive Expressions

- string
- regexp
- empty
- any
- integer
