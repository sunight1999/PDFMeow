const { app, screen, BrowserWindow } = require('electron');
const { desktopCapturer } = require('electron')
const { ipcMain } = require('electron');

const path = require('path');

let isSettingCropArea = false;

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

    win.webContents.on('input-event', (e, ie) => {
        if (isSettingCropArea && ie.type === 'mouseUp'){
            if (cropArea.length < 2){
                cropArea.push(screen.getCursorScreenPoint());
            }
        }
    });

    win.setMenu(null);
    win.loadFile('html/index.html');
    //win.openDevTools();
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

            case 'maximize':
                win.setAlwaysOnTop(true, 'screen-saver');
                app.focus();
                win.setAlwaysOnTop(false, 'floating');
                win.maximize();
                break;

            case 'unmaximize':
                win.setAlwaysOnTop(true, 'screen-saver');
                app.focus();
                win.setAlwaysOnTop(false, 'floating');
                win.unmaximize();
                break;

            case 'focus':
                win.setAlwaysOnTop(true, 'screen-saver');
                app.focus();
                win.setAlwaysOnTop(false, 'floating');
                break;
                
            case 'close':
                win.close();
                break;
        }
    });

    ipcMain.handle('BEGIN_SETTING_CROP_AREA', async (e, a) => {
        isSettingCropArea = true;
        await getCropArea();

        return JSON.stringify(cropArea);
    })

    ipcMain.on('PRINT_LOG', (e, log) => {
        console.log(log);
    });
});

let cropArea = [];
async function getCropArea(){
    let clicked = 0;
    cropArea.length = 0;

    isSettingCropArea = true;

    while (cropArea.length < 2) {
        await new Promise(r => setTimeout(r, 100));
    }

    isSettingCropArea = false;
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});