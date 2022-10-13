import test from "ava";
import { any, translate } from "../lib/main";

test("any split", (t) => {
  const { value } = translate("192.168.1.1", any({ split: "." }));

  t.deepEqual(value, ["192", "168", "1", "1"]);
});
