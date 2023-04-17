const { isUtf8 } = require('buffer');
const { app, BrowserWindow } = require('electron');
const { desktopCapturer } = require('electron')

const path = require('path');

let win = null;
const createWindow = () => {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'js/preload.js')
        }
    });

    win.loadFile('html/index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    });

    // 화면 캡쳐
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
        for (const source of sources) {
            console.log(source.name);

            if (source.name === '화면 1' || source.name === 'Screen 1') {
                win.webContents.send('SET_SOURCE', source.id);
                return;
            }
        }
    });
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});