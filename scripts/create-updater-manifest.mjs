#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const pkgPath = path.join(rootDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const bundleDir = path.join(rootDir, "src-tauri", "target", "release", "bundle", "nsis");
const releasesDir = path.join(rootDir, "releases");
const outputPath = process.env.UPDATE_MANIFEST_PATH || path.join(rootDir, "releases", "latest.json");

const releaseVersion = process.env.UPDATE_VERSION || pkg.version;
const releaseDate = process.env.UPDATE_PUB_DATE || new Date().toISOString();
const releaseNotes = process.env.UPDATE_NOTES || `Ruxshona ERP ${releaseVersion} update`;
const targetPlatform = process.env.UPDATE_PLATFORM || "windows-x86_64";

function findNewestExe(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".exe"))
    .map((file) => {
      const filePath = path.join(dir, file);
      return {
        name: file,
        fullPath: filePath,
        mtimeMs: fs.statSync(filePath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files[0] ?? null;
}

function findPreferredReleaseExe(version) {
  const safeName = `Ruxshona-ERP-${version}-x64-setup.exe`;
  const safePath = path.join(releasesDir, safeName);
  const safeSigPath = `${safePath}.sig`;

  if (fs.existsSync(safePath) && fs.existsSync(safeSigPath)) {
    return {
      name: safeName,
      fullPath: safePath,
    };
  }

  return null;
}

if (!fs.existsSync(bundleDir)) {
  console.error(`Bundle papkasi topilmadi: ${bundleDir}`);
  process.exit(1);
}

const exeFile = process.env.UPDATE_EXE_PATH
  ? { fullPath: process.env.UPDATE_EXE_PATH, name: path.basename(process.env.UPDATE_EXE_PATH) }
  : findPreferredReleaseExe(releaseVersion) || findNewestExe(bundleDir);

if (!exeFile) {
  console.error("NSIS .exe fayl topilmadi. Avval `npm run desktop:build` qiling.");
  process.exit(1);
}

const sigPath = process.env.UPDATE_SIG_PATH || `${exeFile.fullPath}.sig`;
if (!fs.existsSync(sigPath)) {
  console.error(`Signature fayl topilmadi: ${sigPath}`);
  process.exit(1);
}

const signature = fs.readFileSync(sigPath, "utf8").trim();
const assetUrl =
  process.env.UPDATE_ASSET_URL ||
  (process.env.UPDATE_ASSET_BASE_URL
    ? `${process.env.UPDATE_ASSET_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(exeFile.name)}`
    : null);

if (!assetUrl) {
  console.error("UPDATE_ASSET_URL yoki UPDATE_ASSET_BASE_URL berilmagan.");
  process.exit(1);
}

const manifest = {
  version: releaseVersion,
  notes: releaseNotes,
  pub_date: releaseDate,
  platforms: {
    [targetPlatform]: {
      signature,
      url: assetUrl,
    },
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Updater manifest tayyor: ${outputPath}`);
console.log(`Version: ${releaseVersion}`);
console.log(`Asset: ${assetUrl}`);
