#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const targets = [
  ".next",
  "out",
  ".eslintcache",
  path.join("src-tauri", "target"),
];

for (const relativeTarget of targets) {
  const fullPath = path.join(rootDir, relativeTarget);
  try {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`Tozalandi: ${relativeTarget}`);
  } catch (error) {
    console.error(`Tozalashda xato: ${relativeTarget}`);
    console.error(error);
    process.exit(1);
  }
}

console.log("Build cache tozalash yakunlandi.");
