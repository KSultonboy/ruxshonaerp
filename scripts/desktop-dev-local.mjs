#!/usr/bin/env node

import path from "node:path";
import { spawn } from "node:child_process";

const uiDir = process.cwd();
const rootDir = path.resolve(uiDir, "..");
const serverDir = path.join(rootDir, "server");
const composeFile = path.join(rootDir, "docker-compose.local.yml");
const apiHealthUrl = "http://127.0.0.1:8090/api/health";

const isWin = process.platform === "win32";

function bin(name) {
  if (!isWin) return name;
  if (name === "npm" || name === "npx") return `${name}.cmd`;
  return `${name}.exe`;
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${command}`));
    });

    child.on("error", reject);
  });
}

function spawnPersistent(command, args, cwd, prefix) {
  const child = spawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${prefix}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${prefix}] ${chunk}`);
  });

  return child;
}

function runCommandLine(commandLine, cwd) {
  return runProcess(isWin ? "cmd.exe" : "sh", isWin ? ["/d", "/s", "/c", commandLine] : ["-lc", commandLine], cwd);
}

function spawnCommandLine(commandLine, cwd, prefix) {
  return spawnPersistent(isWin ? "cmd.exe" : "sh", isWin ? ["/d", "/s", "/c", commandLine] : ["-lc", commandLine], cwd, prefix);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isApiHealthy() {
  try {
    const response = await fetch(apiHealthUrl);
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.ok === true;
  } catch {
    return false;
  }
}

async function waitForApi(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isApiHealthy()) return true;
    await sleep(1000);
  }
  return false;
}

async function ensureFrontendPortFree() {
  if (!isWin) return;

  await new Promise((resolve) => {
    const script = `
$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($connections) {
  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pid in $pids) {
    try {
      Stop-Process -Id $pid -Force -ErrorAction Stop
      Write-Output "Stopped process on port 3000: $pid"
    } catch {}
  }
}
`;

    const child = spawn("powershell.exe", ["-NoProfile", "-Command", script], {
      cwd: uiDir,
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", () => resolve());
    child.on("error", () => resolve());
  });
}

async function ensureDatabase() {
  console.log("Ensuring local Postgres is running...");
  const inspectExitCode = await new Promise((resolve) => {
    const child = spawn(bin("docker"), ["inspect", "ruxshona_db"], {
      cwd: rootDir,
      stdio: "ignore",
      env: process.env,
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });

  if (inspectExitCode === 0) {
    await runProcess(bin("docker"), ["start", "ruxshona_db"], rootDir).catch(() => undefined);
    return;
  }

  await runProcess(bin("docker"), ["compose", "-f", composeFile, "up", "-d", "db"], rootDir);
}

async function ensureMigrations() {
  console.log("Applying Prisma migrations...");
  await runCommandLine("npx prisma migrate deploy", serverDir);
}

async function startBackendIfNeeded() {
  if (await isApiHealthy()) {
    console.log("Local ERP backend already running on 127.0.0.1:8090.");
    return null;
  }

  console.log("Starting local ERP backend...");
  const backend = spawnCommandLine("npm run start:dev", serverDir, "backend");
  const ready = await waitForApi(45000);
  if (!ready) {
    backend.kill();
    throw new Error("Local ERP backend did not become ready on 127.0.0.1:8090.");
  }
  console.log("Local ERP backend is ready.");
  return backend;
}

async function main() {
  let backendChild = null;
  try {
    await ensureDatabase();
    await ensureMigrations();
    backendChild = await startBackendIfNeeded();

    console.log("Starting Tauri desktop dev...");
    await ensureFrontendPortFree();
    const tauri = spawn(isWin ? "cmd.exe" : "sh", isWin ? ["/d", "/s", "/c", "npx @tauri-apps/cli dev"] : ["-lc", "npx @tauri-apps/cli dev"], {
      cwd: uiDir,
      stdio: "inherit",
      env: process.env,
    });

    const shutdown = () => {
      if (backendChild) backendChild.kill();
      tauri.kill();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    tauri.on("exit", (code) => {
      if (backendChild) backendChild.kill();
      process.exit(code ?? 0);
    });

    tauri.on("error", (error) => {
      console.error(error);
      if (backendChild) backendChild.kill();
      process.exit(1);
    });
  } catch (error) {
    if (backendChild) backendChild.kill();
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
