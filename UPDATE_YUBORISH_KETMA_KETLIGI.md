# Ruxshona ERP Desktop Update (Ketma-ket)

Bu yo'riqnoma **Git Bash** uchun yozilgan.

## 0) Oldindan tekshiruv

```bash
cd /d/ONGOINGPROJECTS/RuxshonaTort/ruxshona-erp-ui
npm run lint
npx tsc --noEmit
```

## 1) Versiyani oshirish

`package.json` va `src-tauri/tauri.conf.json` ichida bir xil versiya yozing.

Misol: `0.1.6`

## 2) Imzolangan installer build qilish

Muhim: `SIZNING_KEY_PAROLINGIZ` ni **o'zingizdagi real parolga** almashtiring.

```bash
cd /d/ONGOINGPROJECTS/RuxshonaTort/ruxshona-erp-ui
export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/ruxshona-updater.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="SIZNING_KEY_PAROLINGIZ"
npm run desktop:build:clean:signed
```

Natija:
- `releases/Ruxshona-ERP-<VERSION>-x64-setup.exe`
- `releases/Ruxshona-ERP-<VERSION>-x64-setup.exe.sig`

## 3) `latest.json` manifest yaratish

`<VERSION>` ni real versiyaga almashtiring.

```bash
cd /d/ONGOINGPROJECTS/RuxshonaTort/ruxshona-erp-ui
export UPDATE_EXE_PATH="$(pwd)/releases/Ruxshona-ERP-<VERSION>-x64-setup.exe"
export UPDATE_SIG_PATH="$(pwd)/releases/Ruxshona-ERP-<VERSION>-x64-setup.exe.sig"
export UPDATE_ASSET_URL="https://api.ruhshonatort.com/desktop-updates/Ruxshona-ERP-<VERSION>-x64-setup.exe"
export UPDATE_NOTES="Yangilanish izohi"
npm run desktop:manifest
```

Natija:
- `releases/latest.json`

## 4) Gateway serverga yuklash (161.97.176.32)

`<VERSION>` ni real versiyaga almashtiring.

```bash
cd /d/ONGOINGPROJECTS/RuxshonaTort/ruxshona-erp-ui
scp releases/Ruxshona-ERP-<VERSION>-x64-setup.exe root@161.97.176.32:/var/www/desktop-updates/
scp releases/Ruxshona-ERP-<VERSION>-x64-setup.exe.sig root@161.97.176.32:/var/www/desktop-updates/
scp releases/latest.json root@161.97.176.32:/var/www/desktop-updates/
```

## 5) Serverda tekshiruv

```bash
curl -s https://api.ruhshonatort.com/desktop-updates/latest.json
curl -I https://api.ruhshonatort.com/desktop-updates/Ruxshona-ERP-<VERSION>-x64-setup.exe
```

Kutilgan holat:
- `latest.json` ichida `version` = `<VERSION>`
- EXE uchun `HTTP/1.1 200 OK`

## 6) App ichida update tekshirish

1. Desktop appni oching.
2. `Sozlamalar -> Update` sahifasiga kiring.
3. `Yangilanishni tekshirish` ni bosing.
4. Update chiqsa o'rnatib, app qayta ochilsin.

## 7) Tez rollback

Agar xato bo'lsa:
1. Oldingi `latest.json` ni qayta upload qiling.
2. Kerak bo'lsa oldingi EXE nomiga qaytaring.

## 8) Print tekshiruv (release oldidan)

Bir marta default printerni o'rnating (har bir PC da):

```powershell
Set-Printer -Name "Xprinter XP-245B" -IsDefault $true
```

1. `Ishlab chiqarish -> Kiritish` da bitta barcode-li mahsulot tanlang.
2. `Miqdor=5`, `Label chiqarish=Har biriga bitta` bilan `Saqlash` bosing.
3. Printer dialog chiqmasligini va 5 ta label navbatga tushishini tekshiring.
4. `Label chiqarish=Umumiy bitta` bilan qayta tekshiring (1 ta chiqishi kerak).
5. `Sotuv` bo'limida test savdo qilib chek avtomatik print bo'lishini tekshiring.

## 9) Eslatma (Git Bash vs PowerShell)

- Git Bash da `export VAR=value` ishlatiladi.
- PowerShell da `$env:VAR=\"value\"` ishlatiladi.
- Ikkalasini aralashtirmang.
