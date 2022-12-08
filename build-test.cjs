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

const args = (argv = require("minimist")(process.argv.slice(2)));
const entryPath = args._[0] || "tests";
const buildDir = (args.build && args.build[0]) || args.build || "tests-build";

let entryIsDir = false;
let entryIsFile = false;
fs.stat(entryPath)
  .then((entry) => {
    entryIsDir = entry.isDirectory();
    entryIsFile = entry.isFile();

    return entryIsFile
      ? [entryPath]
      : entryIsDir
      ? readdirRecursively(entryPath)
      : null;
  })
  .then((paths) => {
    if (paths === null) {
      throw new Error(`Specified path ${entryPath} not found.`);
    } else {
      const builds = paths.map((filePath) => {
        const isTestFile =
          filePath.split(".")[filePath.split(".").length - 2] === "test";
        if (!isTestFile) return;

        const outfile = path.join(
          //   os.tmpdir,
          __dirname,
          buildDir,
          path.basename(filePath, path.extname(filePath)) + ".cjs"
        );
        return esbuild
          .build({
            entryPoints: [filePath],
            platform: "node",
            bundle: true,
            external: ["ava"],
            outfile,
          })
          .catch(() => process.exit(1))
          .then(() => {
            if (entryIsFile) {
              return execAva(outfile);
            }
          });
      });

      return Promise.all(builds);
    }
  })
  .then(() => {
    if (entryIsDir) {
      return execAva(buildDir);
    }
  });

async function execAva(path) {
  return new Promise((res, rej) => {
    const ava = spawn("npx", ["ava", path], {
      stdio: [process.stdin, process.stdout, process.stderr],
    });

    ava.on("end", () => {
      res();
    });

    ava.on("error", (err) => {
      rej(err);
    });

    ava.on("close", (code) => {
      console.log(`ava exited with code ${code}`);
    });
  });
}
