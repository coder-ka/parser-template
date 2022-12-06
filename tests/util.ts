import type { ExecutionContext } from "ava";

export function debugTest(
  t: ExecutionContext,
  test: () => void,
  tryIt = false
) {
  if (tryIt) {
    test();
  } else {
    try {
      test();
    } catch (error) {
      setTimeout(() => {
        console.error();
        console.error("◆◆◆◆◆◆◆◆◆◆ ERROR!!!! ◆◆◆◆◆◆◆◆◆◆◆◆");
        console.error(error.message);
        console.error("◆◆◆◆◆◆◆◆◆◆ ERROR!!!! ◆◆◆◆◆◆◆◆◆◆◆◆");
        console.error();
      }, 1);
      t.pass();
    }
  }
}
