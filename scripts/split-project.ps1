param(
  [string]$OutputRoot = "separated-repos",
  [switch]$InitGit
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path

if ([System.IO.Path]::IsPathRooted($OutputRoot)) {
  $outputPath = $OutputRoot
} else {
  $outputPath = Join-Path $repoRoot $OutputRoot
}

function Copy-Entry {
  param(
    [string]$Source,
    [string]$DestinationRoot
  )

  if (!(Test-Path $Source)) {
    Write-Warning "Skip (not found): $Source"
    return
  }

  Copy-Item -Path $Source -Destination $DestinationRoot -Recurse -Force
}

function Copy-FolderContent {
  param(
    [string]$SourceFolder,
    [string]$DestinationFolder,
    [string[]]$ExcludeNames
  )

  $entries = Get-ChildItem -Path $SourceFolder -Force
  foreach ($entry in $entries) {
    if ($ExcludeNames -contains $entry.Name) {
      continue
    }
    Copy-Item -Path $entry.FullName -Destination $DestinationFolder -Recurse -Force
  }
}

function Initialize-GitRepo {
  param([string]$FolderPath)

  if (!$InitGit) {
    return
  }

  Push-Location $FolderPath
  try {
    git init | Out-Null
    git add . | Out-Null
    git commit -m "Initial split import" | Out-Null
  } finally {
    Pop-Location
  }
}

if (Test-Path $outputPath) {
  Remove-Item -Path $outputPath -Recurse -Force
}
New-Item -ItemType Directory -Path $outputPath | Out-Null

# 1) ERP UI repo
$erpTarget = Join-Path $outputPath "erp-ui"
New-Item -ItemType Directory -Path $erpTarget | Out-Null

$erpEntries = @(
  ".gitignore",
  "README.md",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "next-env.d.ts",
  "tsconfig.json",
  "eslint.config.mjs",
  "tailwind.config.js",
  "postcss.config.js",
  "docker-compose.yml",
  "electron-main.js",
  "setup-electron.js",
  "public",
  "src",
  "docs",
  "test"
)

foreach ($entry in $erpEntries) {
  Copy-Entry -Source (Join-Path $repoRoot $entry) -DestinationRoot $erpTarget
}

Initialize-GitRepo -FolderPath $erpTarget

# 2) Server repo
$serverTarget = Join-Path $outputPath "server"
New-Item -ItemType Directory -Path $serverTarget | Out-Null

Copy-FolderContent `
  -SourceFolder (Join-Path $repoRoot "server") `
  -DestinationFolder $serverTarget `
  -ExcludeNames @("node_modules", "dist", ".next", "coverage", "start-test.log", ".env", "uploads", "server")

@'
NODE_ENV=development
PORT=8090

DATABASE_URL=postgresql://user:password@localhost:5432/ruxshonaerp?schema=public

CORS_ORIGIN=http://localhost:3000

JWT_SECRET=change_me
ACCESS_TOKEN_TTL=30m
REFRESH_TOKEN_TTL_DAYS=15

ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_me
'@ | Set-Content -Path (Join-Path $serverTarget ".env.example") -Encoding UTF8

Initialize-GitRepo -FolderPath $serverTarget

# 3) Website repo
$websiteTarget = Join-Path $outputPath "website"
New-Item -ItemType Directory -Path $websiteTarget | Out-Null

Copy-FolderContent `
  -SourceFolder (Join-Path $repoRoot "website") `
  -DestinationFolder $websiteTarget `
  -ExcludeNames @("node_modules", ".next", "out")

Initialize-GitRepo -FolderPath $websiteTarget

Write-Host ""
Write-Host "Split complete:"
Write-Host " - ERP UI:  $erpTarget"
Write-Host " - Server:  $serverTarget"
Write-Host " - Website: $websiteTarget"
Write-Host ""
if ($InitGit) {
  Write-Host "Each folder has its own git history (single initial commit)."
} else {
  Write-Host "Tip: run with -InitGit to auto-initialize repositories."
}
