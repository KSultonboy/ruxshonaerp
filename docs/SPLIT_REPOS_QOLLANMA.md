# Projectni 3 ta alohida repo qilish

Bu qollanma `ruxshona-erp-ui` ichidagi kodni 3 ta mustaqil papkaga ajratadi:

- `erp-ui`
- `server`
- `website`

## 1) Split scriptni ishga tushirish

Root papkada:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\split-project.ps1
```

Natija:

- `separated-repos/erp-ui`
- `separated-repos/server`
- `separated-repos/website`

Agar har biriga avtomatik `git init` + initial commit kerak bo'lsa:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\split-project.ps1 -InitGit
```

## 2) GitHub'ga push qilish (har biri alohida)

### ERP UI

```powershell
cd .\separated-repos\erp-ui
git init
git add .
git commit -m "Initial ERP UI import"
git branch -M main
git remote add origin https://github.com/<username>/<erp-ui-repo>.git
git push -u origin main
```

### Server

```powershell
cd .\separated-repos\server
git init
git add .
git commit -m "Initial server import"
git branch -M main
git remote add origin https://github.com/<username>/<server-repo>.git
git push -u origin main
```

### Website

```powershell
cd .\separated-repos\website
git init
git add .
git commit -m "Initial website import"
git branch -M main
git remote add origin https://github.com/<username>/<website-repo>.git
git push -u origin main
```

## 3) Muhim eslatma

- `server/.env` split paytida ataylab **ko'chirilmaydi** (xavfsizlik uchun).
- `server/.env.example` avtomatik yaratiladi.
- `node_modules`, `.next`, `dist` kabi build artifactlar split repo'ga kirmaydi.
