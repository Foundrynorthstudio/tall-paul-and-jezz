import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, script)], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited ${code}`));
    });
  });
}

await run("scripts/sync-spotify.mjs");
await run("scripts/sync-tracks.mjs");
await run("scripts/sync-paul.mjs");
await run("scripts/sync-beatport.mjs");
await run("scripts/sync-rekordbox.mjs");
