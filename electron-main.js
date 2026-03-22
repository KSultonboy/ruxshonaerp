const { app, BrowserWindow } = require("electron");
const path = require("path");
const electronServe = require("electron-serve");

const serve = electronServe.default ?? electronServe;
const loadURL = serve({ directory: "out" });

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: "Ruxshona ERP",
    });

    if (app.isPackaged) {
        loadURL(mainWindow);
    } else {
        mainWindow.loadURL("http://localhost:3000");
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
