#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const tauriConfigPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
const tempConfigPath = path.join(rootDir, "src-tauri", "tauri.local.conf.json");

const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
const localConfig = {
  ...tauriConfig,
  bundle: {
    ...(tauriConfig.bundle ?? {}),
    // Local dist build should not require updater artifact signing keys.
    createUpdaterArtifacts: false,
  },
};

fs.writeFileSync(tempConfigPath, JSON.stringify(localConfig, null, 2));

const isWin = process.platform === "win32";
const command = isWin ? "cmd.exe" : "npx";
const configPathForCli = tempConfigPath.replace(/\\/g, "/");
const args = isWin
  ? ["/d", "/s", "/c", `npx @tauri-apps/cli build --config ${configPathForCli}`]
  : ["@tauri-apps/cli", "build", "--config", tempConfigPath];

const child = spawn(command, args, {
  stdio: "inherit",
});

const cleanup = () => {
  if (fs.existsSync(tempConfigPath)) {
    fs.unlinkSync(tempConfigPath);
  }
};

child.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 1);
});

child.on("error", () => {
  cleanup();
  process.exit(1);
});
