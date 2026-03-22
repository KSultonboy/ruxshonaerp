const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.main = "electron-main.js";
pkg.scripts = {
    ...pkg.scripts,
    "electron": "electron .",
    "dist": "next build && electron-builder"
};

pkg.build = {
    "appId": "com.ruxshona.erp",
    "productName": "Ruxshona ERP",
    "directories": {
        "output": "dist-electron"
    },
    "files": [
        "out/**/*",
        "electron-main.js",
        "package.json"
    ],
    "win": {
        "target": "portable",
        "icon": "public/favicon.ico"
    }
};

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2), 'utf8');
console.log('package.json updated for Electron.');
