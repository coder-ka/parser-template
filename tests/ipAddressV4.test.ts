import test from "ava";

import {
  seq,
  range,
} from "../lib/main2";

const segment = range(0, 255);
const ipAddressV4 = seq`${segment}.${segment}.${segment}.${segment}`;

test("ip address translation", () => {
  const res = ipAddressV4.translate("192.168.0.1");

  console.log(res);
});
