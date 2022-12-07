import type { ExecutionContext } from "ava";
import chalk from "picocolors";

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
        console.error(chalk.red("◆◆◆◆◆◆◆◆◆◆ ERROR!!!! ◆◆◆◆◆◆◆◆◆◆◆◆"));
        console.error(chalk.red(error.message));
        console.error(chalk.red("◆◆◆◆◆◆◆◆◆◆ ERROR!!!! ◆◆◆◆◆◆◆◆◆◆◆◆"));
        console.error();
      }, 1);
      t.pass();
    }
  }
}
