import test from "ava";
import { range, seq } from "../lib/main";

const segment = range(1, 255);

const ipAddress = seq`${segment}.${segment}.${segment}.${segment}`;

test("ip address", (t) => {
  const { value } = ipAddress.translate("192.168.1.1");

  t.deepEqual(value, [192, 168, 1, 1]);
});
