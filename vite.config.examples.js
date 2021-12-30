const path = require("path");
const { defineConfig } = require("vite");
const builtinModules = require("builtin-modules");

module.exports = defineConfig({
  build: {
    outDir: 'examples-bundle',
    lib: {
      entry: path.resolve(__dirname, "examples/index.ts"),
      name: "ParseTemplateTest",
      fileName: (format) => `parse-template.test.${format}.js`,
    },
    rollupOptions: {
      external: builtinModules,
      output: {
        globals: builtinModules.reduce(
          (res, m) =>
            Object.assign(res, {
              [m]: m,
            }),
          {}
        ),
      },
    },
  },
});
