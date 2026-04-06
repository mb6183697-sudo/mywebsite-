import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_RESTARTS = 10;
const RESTART_DELAY_MS = 2000;
let restartCount = 0;
let lastCrashTime = 0;

function startServer() {
  const child = spawn("npx", ["tsx", join(__dirname, "index.ts")], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGINT" || code === 0) {
      console.log(`Server exited cleanly (code=${code}, signal=${signal})`);
      process.exit(0);
      return;
    }

    const now = Date.now();
    if (now - lastCrashTime > 60_000) {
      restartCount = 0;
    }
    lastCrashTime = now;
    restartCount++;

    if (restartCount > MAX_RESTARTS) {
      console.error(`Server crashed ${restartCount} times in 60s. Giving up.`);
      process.exit(1);
    }

    console.error(`Server crashed (code=${code}). Restarting in ${RESTART_DELAY_MS}ms... (attempt ${restartCount}/${MAX_RESTARTS})`);
    setTimeout(startServer, RESTART_DELAY_MS);
  });

  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));
}

startServer();
