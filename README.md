# Parser Template

Parser Template is a parser generator using [JS's Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals).

# Installation

```bash
npm install @coder-ka/parser-template
```

# Example

Creating an IPAddressV4 parser.

```ts
import { regularExpression, seq, generateParser } from "@coder-ka/parser-template";

const segment = regularExpression(/\d+/);

const ipAddressV4 = seq`${segment}.${segment}.${segment}.${segment}`;

const ipAddressV4Parser = generateParser(ipAddressV4);

console.log(ipAddressV4Parser.parse("192.168.0.1"));
```

# TODO

- A guide for creating custom primitives
- Implementing packrat parsing
