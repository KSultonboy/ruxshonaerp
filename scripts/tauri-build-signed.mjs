#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const keyPath =
  process.env.TAURI_SIGNING_PRIVATE_KEY_PATH ||
  path.join(os.homedir(), ".tauri", "ruxshona-updater.key");

if (!fs.existsSync(keyPath)) {
  console.error(`Updater private key topilmadi: ${keyPath}`);
  process.exit(1);
}

const keyStat = fs.statSync(keyPath);
if (!keyStat.size) {
  console.error(`Updater private key bo'sh: ${keyPath}`);
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, "utf8").replace(/\r/g, "").trimEnd();
const productionApiBaseUrl =
  process.env.RUXSHONA_PROD_API_BASE_URL?.trim() || "https://api.ruhshonatort.com/api";

const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_PUBLIC_SERVICE_MODE: "api",
  // Signed desktop releases must always point at production, never localhost.
  NEXT_PUBLIC_API_BASE_URL: productionApiBaseUrl,
  TAURI_SIGNING_PRIVATE_KEY_PATH: keyPath,
  TAURI_SIGNING_PRIVATE_KEY: privateKey,
};

console.log(`Signed build API: ${env.NEXT_PUBLIC_API_BASE_URL}`);

if (process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
}

const isWin = process.platform === "win32";
const command = isWin ? "cmd.exe" : "npx";
const args = isWin ? ["/d", "/s", "/c", "npx @tauri-apps/cli build"] : ["@tauri-apps/cli", "build"];

const child = spawn(command, args, {
  stdio: "inherit",
  env,
});

child.on("exit", (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
    return;
  }

  const rootDir = process.cwd();
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const nsisDir = path.join(rootDir, "src-tauri", "target", "release", "bundle", "nsis");
  const releasesDir = path.join(rootDir, "releases");

  const exeFiles = fs
    .readdirSync(nsisDir)
    .filter((name) => name.toLowerCase().endsWith(".exe"))
    .map((name) => {
      const fullPath = path.join(nsisDir, name);
      return { name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const newestExe = exeFiles[0];
  if (!newestExe) {
    console.error("NSIS .exe topilmadi, releases ga ko'chirish bajarilmadi.");
    process.exit(1);
    return;
  }

  const newestSig = `${newestExe.fullPath}.sig`;
  if (!fs.existsSync(newestSig)) {
    console.error("NSIS .sig topilmadi, releases ga ko'chirish bajarilmadi.");
    process.exit(1);
    return;
  }

  const safeName = `Ruxshona-ERP-${pkg.version}-x64-setup.exe`;
  const safeSigName = `${safeName}.sig`;
  const safeExePath = path.join(releasesDir, safeName);
  const safeSigPath = path.join(releasesDir, safeSigName);

  fs.mkdirSync(releasesDir, { recursive: true });
  fs.copyFileSync(newestExe.fullPath, safeExePath);
  fs.copyFileSync(newestSig, safeSigPath);

  console.log(`Release tayyor: ${safeExePath}`);
  console.log(`Signature tayyor: ${safeSigPath}`);
  process.exit(0);
});
