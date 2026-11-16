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
clearLineEndingNoise();
if (t.status !== 0) {
    console.error("\nBUILD FAILED: TypeScript errors above. The Lua files were written and post-processed anyway; fix the errors before running games.");
    process.exit(t.status || 1);
}
if (p.status !== 0) {
    console.error("\nBUILD FAILED: post-process-lua.js failed.");
    process.exit(p.status || 1);
}

// tstl writes LF; with core.autocrlf=true the checked-out files are CRLF, so every rewritten file showed as
// modified in `git status` with no content change (`git diff` empty), and `git update-index --refresh` does
// not clear that under autocrlf. Re-adding a file whose content git sees as unchanged only refreshes its
// stat (nothing gets staged). Files with real changes are left alone.
function clearLineEndingNoise() {
    const git = args => spawnSync("git", args, { cwd: root, encoding: "utf8" });
    const st = git(["status", "--porcelain", "--", "bots"]);
    if (st.status !== 0) return; // not a git checkout
    const marked = st.stdout.split("\n").filter(l => l.startsWith(" M ")).map(l => l.slice(3).trim());
    if (!marked.length) return;
    const real = new Set(git(["diff", "--name-only", "--", "bots"]).stdout.split("\n").map(s => s.trim()).filter(Boolean));
    const noise = marked.filter(f => !real.has(f));
    for (let i = 0; i < noise.length; i += 100) git(["add", "--", ...noise.slice(i, i + 100)]);
    if (noise.length) console.log(`build: cleared ${noise.length} line-ending-only changes (no content change)`);
}
