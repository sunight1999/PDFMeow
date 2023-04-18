const { ipcRenderer } = require('electron');
const fs = require('fs');
const { MeowSpacebar } = require('bindings')("meowspacebar");

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
        document.getElementById('beginBtn').setAttribute('disabled', true);

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
        meowIndex = 0;

        for (let i = 3; i > 0; --i) {
            document.getElementById('announcement').textContent = i + "초 뒤 스캔이 시작됩니다. 포커스를 뷰어에 맞춰주세요.";
            await new Promise(r => setTimeout(r, 1000));
        }

        do {
            document.getElementById('announcement').textContent = (meowIndex + 1) + ' 페이지 캡쳐 중...';
            await doCapture(param.sourceId);

            MeowSpacebar();

            await new Promise(r => setTimeout(r, 500));
        } while (--pageNum > 0)

        document.getElementById('announcement').textContent = 'PDF 변환을 시작합니다.';

    } catch (e) {
        handleError(e)
    }
});

/*
 * 이미지 캡쳐 및 저장
 */
let meowIndex = 0;
async function doCapture(sourceId) {
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

        _doCapture(stream);
    } catch (e) {
        handleError(e)
    }
}

function _doCapture(stream) {
    let video = document.createElement('video');
    video.style.cssText = 'position:absolute;top:-10000px;left:-10000px;';

    video.onloadedmetadata = () => {
        video.style.width = '1920px';
        video.style.height = '1080px';

        video.play();

        var canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;

        var ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 이미지 저장
        var raw = canvas.toDataURL('image/png');
        var data = raw.replace(/^data:image\/\w+;base64,/, "");
        var buf = Buffer.from(data, 'base64');
        fs.writeFile('meow_' + ++meowIndex + '.png', buf, err => {
            if (err)
                console.log('meow_' + meowIndex + '.png failed.', err);
            else
                console.log('meow_' + meowIndex + '.png saved.');
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