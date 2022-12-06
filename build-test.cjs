const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const esbuild = require("esbuild");
const { spawn } = require("child_process");

async function readdirRecursively(dir, parent = "") {
  const entries = await fs.readdir(path.join(parent, dir), {
    withFileTypes: true,
  });

  return [
    ...entries
      .filter((x) => x.isFile())
      .map((x) => path.join(parent, dir, x.name)),
    ...(await Promise.all(
      entries
        .filter((x) => x.isDirectory())
        .map((x) => readdirRecursively(x.name, dir))
    )),
  ];
}

const entryPath = process.argv[2] || "tests";
fs.stat(entryPath)
  .then((entry) => {
    return entry.isFile()
      ? [entryPath]
      : entry.isDirectory()
      ? readdirRecursively(entryPath)
      : null;
  })
  .then((paths) => {
    if (paths === null) {
      throw new Error(`Specified path ${entryPath} not found.`);
    } else {
      paths.forEach((filePath) => {
        const outfile = path.join(
          //   os.tmpdir,
          __dirname,
          "tests-build",
          path.basename(filePath, path.extname(filePath)) + ".cjs"
        );
        esbuild
          .build({
            entryPoints: [filePath],
            platform: "node",
            bundle: true,
            external: ["ava"],
            outfile,
          })
          .catch(() => process.exit(1))
          .then(() => {
            const ava = spawn("npx", ["ava", outfile], {
              stdio: [process.stdin, process.stdout, process.stderr],
            });

            ava.on("close", (code) => {
              console.log(`ava exited with code ${code}`);
            });
          });
      });
    }
  });
