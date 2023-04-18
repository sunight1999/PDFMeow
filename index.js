const { app, BrowserWindow } = require('electron');
const { desktopCapturer } = require('electron')
const { ipcMain } = require('electron');

const path = require('path');

let win = null;
const createWindow = () => {
    win = new BrowserWindow({
        width: 550,
        height: 200,
        resizable: false,
        frame: false,
        icon: path.join(__dirname, 'img/TrayIconTemplate.png'),
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'js/preload.js')
        }
    });

    win.setMenu(null);
    win.loadFile('html/index.html');
    //win.loadFile('css/style.css');
}

app.whenReady().then(() => {
    createWindow();
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    });

    // 1. 렌더러에서 버튼 클릭을 감지하면 INVOKE_CLICK 이벤트 생성
    // 2. INVOKE_CLICK 이벤트를 감지하면 화면 정보를 찾고 BEGIN_SERVICE 이벤트 생성
    // 3. 렌더러에서 화면 캡쳐 및 저장 수행
    ipcMain.on('INVOKE_CLICK', (e, pageNum) => {
        desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
            for (const source of sources) {
                console.log(source.name);

                if (source.name === '화면 1' || source.name === 'Screen 1') {
                    win.webContents.send('BEGIN_SERVICE', JSON.stringify({sourceId: source.id, pageNum: pageNum}));
                    return;
                }
            }
        });
    });

    ipcMain.on('HANDLE_WINDOW', (e, type) => {
        switch (type) {
            case 'minimize':
                win.minimize();
                break;

            case 'close':
                win.close();
                break;
        }
    });

    ipcMain.on('PRINT_LOG', (e, log) => {
        console.log(log);
    });
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});