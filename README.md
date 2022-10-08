# Parser Template

Parser Template is a parser generator using [JS's Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals).

# Installation

```bash
npm install @coder-ka/parser-template
```

# Example

Creating an IPAddressV4 parser.

```ts
import { range, seq } from "../lib/main";

const segment = range(1, 255);

const ipAddress = seq`${segment}.${segment}.${segment}.${segment}`;

const { value } = ipAddress.translate("192.168.1.1");

// [192,168,1,1]
console.log(value);
```

# TODO

- A guide for creating custom primitives
- Implementing packrat parsing
- Custom transformation to internal representation
