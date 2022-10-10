import test from "ava";
import { range, seq, translate } from "../lib/main";

const segment = range(1, 255);

const ipAddress = seq`${segment}.${segment}.${segment}.${segment}`;

test("ip address", (t) => {
  const { value } = translate("192.168.1.1", ipAddress);

  t.deepEqual(value, [192, 168, 1, 1]);
});
