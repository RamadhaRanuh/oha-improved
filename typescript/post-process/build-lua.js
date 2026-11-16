// npm run build: TypeScript -> Lua, then the require-path post-process, always.
// tstl still writes the Lua files when it reports a type error, so with `tstl && post-process` a TS error
// left every generated file with raw require("bots.x") paths the game cannot load (2026-11-16). Here the
// post-process runs either way and the build fails loudly on a TS error.
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "../..");
const tstl = path.join(root, "node_modules/typescript-to-lua/dist/tstl.js");
const t = spawnSync(process.execPath, [tstl, "-p", "tsconfig-tstl.json"], { cwd: root, stdio: "inherit" });
const p = spawnSync(process.execPath, [path.join(__dirname, "post-process-lua.js")], { cwd: root, stdio: "inherit" });
if (t.status !== 0) {
    console.error("\nBUILD FAILED: TypeScript errors above. The Lua files were written and post-processed anyway; fix the errors before running games.");
    process.exit(t.status || 1);
}
if (p.status !== 0) {
    console.error("\nBUILD FAILED: post-process-lua.js failed.");
    process.exit(p.status || 1);
}
