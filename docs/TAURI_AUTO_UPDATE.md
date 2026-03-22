# Tauri Auto Update (Ruxshona ERP)

Bu loyiha endi Tauri updater bilan ishlaydi.

## 1) Bir martalik sozlama

- `src-tauri/tauri.conf.json` ichida updater yoqilgan:
  - endpoint: `https://api.ruhshonatort.com/desktop-updates/latest.json`
  - `bundle.createUpdaterArtifacts: true`
- Rust plugin ulangan: `tauri-plugin-updater`.
- Frontend auto-check qo'shilgan: app ochilganda yangi versiya bo'lsa toast chiqadi.

## 2) Har bir yangi update chiqarish

1. Versiyani oshiring (`package.json` + `src-tauri/tauri.conf.json`).
2. Desktop build qiling (sign bilan):

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="Ruxshona@2026"
npm run desktop:build:signed
```

Builddan keyin tayyor fayllar:
- `releases/Ruxshona-ERP-<version>-x64-setup.exe`
- `releases/Ruxshona-ERP-<version>-x64-setup.exe.sig`

3. `latest.json` yarating:

```powershell
$env:UPDATE_ASSET_BASE_URL="https://api.ruhshonatort.com/desktop-updates"
$env:UPDATE_NOTES="Bugfix va yangi funksiyalar"
npm run desktop:manifest
```

4. Quyidagi 3 faylni serverga yuklang (`/desktop-updates` ichiga):
- yangi `.exe`
- shu `.exe.sig`
- `releases/latest.json` (serverda nomi `latest.json`)

### Agar Git Bash ishlatsangiz

PowerShell sintaksisini emas, `export` ishlating:

```bash
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="Ruxshona@2026"
export UPDATE_ASSET_BASE_URL="https://api.ruhshonatort.com/desktop-updates"
export UPDATE_NOTES="Bugfix va yangi funksiyalar"
npm run desktop:manifest
```

## 3) Foydalanuvchi tomoni

- App ochilganda update tekshiriladi.
- Yangi versiya bo'lsa `O'rnatish` tugmasi chiqadi.
- O'rnatilgandan keyin ilovani yopib-qayta ochsa yangi versiya ishlaydi.
