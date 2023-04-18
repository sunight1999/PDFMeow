const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { MeowSpacebar } = require('bindings')("meowspacebar");

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

let config;
function loadConfiguration(){
    const raw = fs.readFile(CONFIG_PATH, (err, data) => {
        if (err){
            log(err.message);
            config = {
                "pageMoveInterval": 500,
                "cropImageWaitTime": 5,
                "scanBeginWaitTime": 5
            };
        }
        else {
            config = JSON.parse(data);
        }
    });
}
loadConfiguration();

function handleWindowControls() {
    // Make minimise/close buttons work when they are clicked
    document.getElementById('min-button').onclick = event => {
        ipcRenderer.send('HANDLE_WINDOW', "minimize")
    };

    document.getElementById('close-button').onclick = event => {
        ipcRenderer.send('HANDLE_WINDOW', "close")
    };
}

window.addEventListener('DOMContentLoaded', () => {
    handleWindowControls();

    document.getElementById('beginBtn').onclick = (e) => {
        // 캡쳐 작업이 끝날 때까지 버튼 비활성화
        document.getElementById('beginBtn').disabled = true;

        // 메인 프로세스에 BEGIN_SERVICE 이벤트 발생 요청
        ipcRenderer.send('INVOKE_CLICK', parseInt(document.getElementById('pageNum').value));
    };
});

/*
 * 서비스 시작 지점.
 * 다음 페이지 전환 등 화면 조작
 */
ipcRenderer.on('BEGIN_SERVICE', async (event, sparam) => {
    try {
        let param = JSON.parse(sparam);
        let pageNum = param.pageNum;

        // meow 디렉토리 존재 여부 확인
        // let appPath = '';
        let meowPath = path.join(process.cwd(), 'meow');
        // await ipcRenderer.invoke('GET_APP_PATH', null).then((result) => {
        //     appPath = result;
        //     meowPath = path.join(appPath, 'meow')
        // });

        if (fs.existsSync(meowPath))
            fs.rmSync(meowPath, { recursive: true, force: true });

        fs.mkdirSync(meowPath);

        // 이미지 크롭 범위 설정 시작~
        meowIndex = 0;
        for (let i = config.cropImageWaitTime; i > 0; --i) {
            announce(i + '초 뒤 화면이 캡쳐됩니다. e-book 뷰어 화면을 띄우고 기다려주세요.');
            await new Promise(r => setTimeout(r, 1000));
        }

        // 뷰어 화면을 캡쳐하고 크롭 영역 설정을 위해 해당 이미지를 전체 화면으로 출력
        await doCapture(param.sourceId, meowPath);
        await new Promise(r => setTimeout(r, 500));
        maximize();
        document.getElementById('sample').src = path.join(meowPath, 'meow_1.png');

        let cropArea;
        await ipcRenderer.invoke('BEGIN_SETTING_CROP_AREA', null).then((result) => {
            cropArea = JSON.parse(result);
        });

        unmaximize();
        // ~이미지 크롭 범위 설정 종료

        // 이미지 캡쳐 시작~
        meowIndex = 0;

        for (let i = config.scanBeginWaitTime; i > 0; --i) {
            announce(i + '초 뒤 스캔이 시작됩니다. e-book 뷰어 화면을 띄우고 기다려주세요.');
            await new Promise(r => setTimeout(r, 1000));
        }

        minimize();

        do {
            // 크롭 영역 정보를 같이 전달해 canvas로 크롭 수행
            announce((meowIndex + 1) + ' 페이지 캡쳐 중...');

            await doCapture(param.sourceId, meowPath, cropArea);
            await new Promise(r => setTimeout(r, config.pageMoveInterval));

            MeowSpacebar();

            await new Promise(r => setTimeout(r, 100));
        } while (--pageNum > 0)

        focus();
        // ~이미지 캡쳐 종료

        // PDF 변환 시작~
        announce('PDF 변환을 시작합니다.');

        let croppedSize = calcCroppedSize(cropArea);
        const doc = new PDFDocument({size: [croppedSize.width, croppedSize.height]});
        let wstream = fs.createWriteStream('meow.pdf');
        doc.pipe(wstream);

        for (let i = 1; i <= meowIndex; ++i){
            doc.image(path.join(meowPath, 'meow_' + i + '.png'), 0, 0);

            if (i < meowIndex)
                doc.addPage();
        }

        doc.end();
        // ~PDF 변환 종료

        wstream.on('finish', () => {
            announce('작업이 완료되었습니다. 폴더를 확인해주세요.');
            document.getElementById('beginBtn').disabled = false;
        });
    } catch (e) {
        handleError(e)
    }
});

function calcCroppedSize(cropArea){
    let croppedSize = {};
    croppedSize.width = 1920 - cropArea[0].x - (1920 - cropArea[1].x);
    croppedSize.height = 1080 - cropArea[0].y - (1080 - cropArea[1].y);

    return croppedSize;
}

let announcement = null;
function announce(msg) {
    if (announcement == null)
        announcement = document.getElementById('announcement');

    announcement.textContent = msg;
}

function maximize(){
    ipcRenderer.send('HANDLE_WINDOW', 'maximize');
    toggleSections();
}

function unmaximize(){
    ipcRenderer.send('HANDLE_WINDOW', 'unmaximize');
    toggleSections();
}

function minimize(){
    ipcRenderer.send('HANDLE_WINDOW', 'minimize');
}

function focus(){
    ipcRenderer.send('HANDLE_WINDOW', 'focus');
}

function toggleSections(){
    toggleDisplay(document.getElementById('title-section'));
    toggleDisplay(document.getElementById('main-section'));
    toggleDisplay(document.getElementById('sample-section'));
}

function toggleDisplay(e){
    let cur = window.getComputedStyle(e).display;
    
    if (cur === 'none')
        e.style.display = 'block';
    else
        e.style.display = 'none';
}

/*
 * 이미지 캡쳐 및 저장
 */
let meowIndex = 0;
async function doCapture(sourceId, meowPath, cropArea = null) {
    try {
        console.log(sourceId)
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    minWidth: 1920,
                    maxWidth: 3840,
                    minHeight: 1080,
                    maxHeight: 2160
                }
            }
        });

        await _doCapture(stream, meowPath, cropArea);
    } catch (e) {
        handleError(e)
    }
}

async function _doCapture(stream, meowPath, cropArea = null) {
    let video = document.createElement('video');
    video.style.cssText = 'position:absolute;top:-10000px;left:-10000px;';

    video.onloadedmetadata = () => {
        video.style.width = '1920px';
        video.style.height = '1080px';

        video.play();

        var canvas = document.createElement('canvas');

        var ctx = canvas.getContext('2d');
        if (cropArea !== null) {
            let croppedSize = calcCroppedSize(cropArea);
            canvas.width = croppedSize.width;
            canvas.height = croppedSize.height;
        }
        else {
            canvas.width = 1920;
            canvas.height = 1080;
        }
        
        ctx.drawImage(video,
            cropArea === null ? 0 : cropArea[0].x, cropArea === null ? 0 : cropArea[0].y,   // Start from the specified left and the top of the image,
            canvas.width, canvas.height,     // Get a canvas.width * canvas.height area from the source image,
            0, 0,                            // Place the result at 0, 0 in the canvas,
            canvas.width, canvas.height);    // With as width * height (used when do scaling)

        // 이미지 저장
        var raw = canvas.toDataURL('image/png');
        var data = raw.replace(/^data:image\/\w+;base64,/, "");
        var buf = Buffer.from(data, 'base64');
        fs.writeFile(path.join(meowPath, 'meow_' + ++meowIndex + '.png'), buf, err => {
            if (err)
                log('meow_' + meowIndex + '.png failed.', err);
            else
                log('meow_' + meowIndex + '.png saved.');
        });

        video.remove();

        try {
            // Destroy connect to stream
            stream.getTracks()[0].stop();
        } catch (e) {
            console.log(e);
        }
    }

    video.srcObject = stream
    document.body.appendChild(video);
}

function handleError(e) {
    console.log(e)
}

function log(msg){
    ipcRenderer.send('PRINT_LOG', msg);
}